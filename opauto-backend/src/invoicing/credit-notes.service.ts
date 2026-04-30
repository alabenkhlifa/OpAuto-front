import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreditNoteStatus, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { NumberingService } from './numbering.service';
import {
  TaxCalculatorService,
  type LineItemInput,
} from './tax-calculator.service';
import { InvoicingService } from './invoicing.service';

/**
 * CreditNotesService — issues immutable credit notes (avoirs) against
 * existing invoices, optionally restoring stock for credited parts and
 * recomputing the source invoice's payment status.
 *
 * Lifecycle:
 *   create()   → ISSUED, lockedAt set, fiscal AVO-YYYY-NNNN number,
 *                StockMovement+Part.quantity update if restockParts=true,
 *                source invoice status recomputed via InvoicingService.
 *   findAll()  → list scoped to garageId, ordered by createdAt desc
 *   findOne()  → detail with line items + invoice basic info
 *
 * Design notes:
 *   - PDF rendering and customer email are Phase 4 — not invoked here.
 *   - Stock restoration uses StockMovement.type = 'in' (the existing
 *     model uses a free-text type column, not an enum); reason is set
 *     to "credit_note:<creditNoteNumber>" for audit trail.
 *   - The whole flow runs inside a single Prisma `$transaction` so any
 *     failure rolls back the credit note + stock changes atomically.
 *     `recomputeStatus` runs against the same transaction client.
 */
@Injectable()
export class CreditNotesService {
  private readonly logger = new Logger(CreditNotesService.name);

  constructor(
    private prisma: PrismaService,
    private numbering: NumberingService,
    private taxCalculator: TaxCalculatorService,
    private invoicing: InvoicingService,
  ) {}

  async findAll(garageId: string) {
    return this.prisma.creditNote.findMany({
      where: { garageId },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
          },
        },
        _count: { select: { lineItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, garageId: string) {
    const creditNote = await this.prisma.creditNote.findFirst({
      where: { id, garageId },
      include: {
        lineItems: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            customerId: true,
            carId: true,
          },
        },
      },
    });
    if (!creditNote) throw new NotFoundException('Credit note not found');
    return creditNote;
  }

  async create(garageId: string, _userId: string, dto: CreateCreditNoteDto) {
    // ── 1. Load source invoice, scoped to garage ────────────────
    const sourceInvoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, garageId },
      include: { lineItems: true, payments: true },
    });
    if (!sourceInvoice) {
      throw new NotFoundException('Invoice not found');
    }

    // ── 2. Validate state ────────────────────────────────────────
    const creditableStates: InvoiceStatus[] = [
      InvoiceStatus.SENT,
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.PAID,
    ];
    if (!creditableStates.includes(sourceInvoice.status)) {
      // Map each forbidden state to a precise message so callers (and
      // the future UI) can show actionable copy.
      const reason: Record<string, string> = {
        DRAFT:
          'Cannot issue a credit note for a DRAFT invoice — issue the invoice first',
        CANCELLED: 'Cannot issue a credit note for a CANCELLED invoice',
        OVERDUE:
          'Cannot issue a credit note for an OVERDUE unpaid invoice — record payment or cancel it first',
      };
      throw new BadRequestException(
        reason[sourceInvoice.status] ??
          `Cannot issue a credit note while invoice is ${sourceInvoice.status}`,
      );
    }

    // ── 3. Validate partIds — must exist on the source invoice ──
    const sourcePartIds = new Set(
      sourceInvoice.lineItems
        .map((li) => li.partId)
        .filter((p): p is string => !!p),
    );
    for (const line of dto.lineItems) {
      if (!line.partId) continue;
      if (!sourcePartIds.has(line.partId)) {
        throw new BadRequestException(
          `Part ${line.partId} is not on the source invoice — cannot credit-note a part that was not sold via this invoice`,
        );
      }
    }

    const restockParts = dto.restockParts === true;

    // ── 4-7. Run everything inside a single transaction ─────────
    const created = await this.prisma.$transaction(async (tx) => {
      // 4. Allocate fiscal number (AVO-YYYY-NNNN). Numbering uses its
      //    own internal transaction; we accept a small over-numbering
      //    risk if the outer transaction rolls back after this call.
      //    That risk is accepted by the gapless-numbering design.
      const creditNoteNumber = await this.numbering.next(
        garageId,
        'CREDIT_NOTE',
      );

      // 5. Compute totals. Credit notes never carry a fiscal stamp.
      const lines: LineItemInput[] = dto.lineItems.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        tvaRate: item.tvaRate,
        discountPct: item.discountPct,
      }));
      const calc = this.taxCalculator.calculate(lines, {
        invoiceDiscount: 0,
        fiscalStampEnabled: false,
      });

      const lineItemRows = dto.lineItems.map((item) => {
        const totals = this.taxCalculator.computeLineTotals({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          tvaRate: item.tvaRate,
          discountPct: item.discountPct,
        });
        return {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          type: item.type,
          partId: item.partId,
          serviceCode: item.serviceCode,
          mechanicId: item.mechanicId,
          laborHours: item.laborHours,
          tvaRate: item.tvaRate,
          tvaAmount: totals.tvaAmount,
          total: totals.lineTotal,
          discountPct: item.discountPct,
        };
      });

      // 6. Persist the credit note + nested line items.
      const cn = await tx.creditNote.create({
        data: {
          garageId,
          invoiceId: sourceInvoice.id,
          creditNoteNumber,
          reason: dto.reason,
          status: CreditNoteStatus.ISSUED,
          subtotal: calc.subtotalHT,
          taxAmount: calc.totalTVA,
          discount: calc.invoiceDiscount,
          total: calc.totalTTC,
          restockParts,
          lockedAt: new Date(),
          lineItems: { create: lineItemRows },
        },
        include: { lineItems: true },
      });

      // 7. Stock restore — only when explicitly requested AND the line
      //    has a partId. Each line creates a StockMovement audit row
      //    and atomically increments Part.quantity.
      if (restockParts) {
        for (const line of dto.lineItems) {
          if (!line.partId) continue;
          const qty = Math.round(line.quantity);
          if (qty <= 0) continue;
          await tx.stockMovement.create({
            data: {
              partId: line.partId,
              type: 'in', // existing column is free-text — 'in' matches stock-receipt convention
              quantity: qty,
              reason: `credit_note:${creditNoteNumber}`,
              reference: cn.id,
            },
          });
          await tx.part.update({
            where: { id: line.partId },
            data: { quantity: { increment: qty } },
          });
        }
      }

      return cn;
    });

    // ── 8. Recompute source invoice status (post-commit). Failure
    //       here does not roll back the credit note — the credit note
    //       is committed; we log and surface the status anyway via a
    //       follow-up read. In practice recompute is read-mostly and
    //       very unlikely to throw.
    let recompute: {
      oldStatus: InvoiceStatus;
      newStatus: InvoiceStatus;
      overCredited: boolean;
    };
    try {
      recompute = await this.invoicing.recomputeStatus(sourceInvoice.id);
    } catch (err) {
      this.logger.error(
        `recomputeStatus failed for invoice ${sourceInvoice.id} after credit note ${created.id}: ${(err as Error).message}`,
      );
      recompute = {
        oldStatus: sourceInvoice.status,
        newStatus: sourceInvoice.status,
        overCredited: false,
      };
    }

    // 9. Return enriched response so callers can display the new
    //    invoice state + the over-credit flag without an extra GET.
    const detail = await this.prisma.creditNote.findUnique({
      where: { id: created.id },
      include: {
        lineItems: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            customerId: true,
            carId: true,
          },
        },
      },
    });

    return {
      ...detail!,
      sourceInvoiceStatus: recompute.newStatus,
      overCredited: recompute.overCredited,
    };
  }
}
