import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { NumberingService } from './numbering.service';
import {
  TaxCalculatorService,
  type LineItemInput,
} from './tax-calculator.service';
import { assertCanTransition, isLocked } from './invoice-state';
import { InvoiceLockedException } from './exceptions/invoice-locked.exception';

/**
 * InvoicingService — orchestrates invoice CRUD with state-machine
 * enforcement, gapless fiscal numbering, and Tunisian TVA computation.
 *
 * Lifecycle:
 *   create()  → DRAFT, placeholder invoiceNumber `DRAFT-<uuid8>`
 *   update()  → mutate freely while DRAFT; only `notes` post-issue
 *   issue()   → DRAFT → SENT, assigns gapless fiscal number, lockedAt set
 *   addPayment() → drives PARTIALLY_PAID → PAID via state machine
 *   remove()  → only DRAFT or CANCELLED (issued invoices need a credit note)
 *
 * Stock decrement, PDF rendering, and customer email send are owned by
 * Phase 2 / Phase 4 and intentionally not invoked here.
 */
@Injectable()
export class InvoicingService {
  private readonly logger = new Logger(InvoicingService.name);

  constructor(
    private prisma: PrismaService,
    private numbering: NumberingService,
    private taxCalculator: TaxCalculatorService,
  ) {}

  async findAll(garageId: string) {
    return this.prisma.invoice.findMany({
      where: { garageId },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        car: {
          select: {
            make: true,
            model: true,
            year: true,
            licensePlate: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            paidAt: true,
            reference: true,
          },
        },
        _count: { select: { lineItems: true, payments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, garageId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, garageId },
      include: { customer: true, car: true, lineItems: true, payments: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(garageId: string, dto: CreateInvoiceDto) {
    const garage = await this.prisma.garage.findUnique({
      where: { id: garageId },
      select: {
        defaultTvaRate: true,
        fiscalStampEnabled: true,
        currency: true,
      },
    });
    if (!garage) throw new NotFoundException('Garage not found');

    const tvaRate = garage.defaultTvaRate ?? 19;
    const lines: LineItemInput[] = dto.lineItems.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      tvaRate,
    }));

    const calc = this.taxCalculator.calculate(lines, {
      invoiceDiscount: dto.discount ?? 0,
      fiscalStampEnabled: garage.fiscalStampEnabled,
    });

    const lineItemRows = dto.lineItems.map((item) => {
      const totals = this.taxCalculator.computeLineTotals({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        tvaRate,
      });
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        type: item.type,
        tvaRate,
        tvaAmount: totals.tvaAmount,
        total: totals.lineTotal,
      };
    });

    return this.prisma.invoice.create({
      data: {
        garageId,
        customerId: dto.customerId,
        carId: dto.carId,
        // Placeholder identifier for the DRAFT — `invoiceNumber` is
        // NOT NULL UNIQUE, but we don't want to burn a fiscal sequence
        // number on a draft that may never be issued. Replaced by
        // NumberingService.next() inside `issue()`.
        invoiceNumber: `DRAFT-${randomUUID().slice(0, 8)}`,
        currency: garage.currency ?? 'TND',
        subtotal: calc.subtotalHT,
        taxAmount: calc.totalTVA,
        discount: calc.invoiceDiscount,
        fiscalStamp: calc.fiscalStamp,
        total: calc.totalTTC,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        status: InvoiceStatus.DRAFT,
        lineItems: { create: lineItemRows },
      },
      include: { lineItems: true, customer: true, car: true },
    });
  }

  async update(id: string, garageId: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(id, garageId);

    if (isLocked(invoice.status)) {
      // Locked invoices accept only `notes` mutations and explicit
      // status transitions vetted by the state machine. Any attempt
      // to touch fiscal fields throws 423.
      const allowedKeys = new Set(['notes', 'status']);
      const incomingKeys = Object.keys(dto).filter(
        (k) => (dto as Record<string, unknown>)[k] !== undefined,
      );
      const forbidden = incomingKeys.filter((k) => !allowedKeys.has(k));
      if (forbidden.length > 0) {
        throw new InvoiceLockedException(invoice.invoiceNumber, invoice.status);
      }

      const data: Prisma.InvoiceUpdateInput = {};
      if (dto.notes !== undefined) data.notes = dto.notes;
      if (dto.status !== undefined && dto.status !== invoice.status) {
        assertCanTransition(invoice.status, dto.status);
        data.status = dto.status;
      }
      return this.prisma.invoice.update({ where: { id }, data });
    }

    // DRAFT path — recompute totals if line items / discount changed.
    const garage = await this.prisma.garage.findUnique({
      where: { id: garageId },
      select: {
        defaultTvaRate: true,
        fiscalStampEnabled: true,
      },
    });
    const tvaRate = garage?.defaultTvaRate ?? 19;

    const data: Prisma.InvoiceUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.customerId !== undefined) {
      data.customer = { connect: { id: dto.customerId } };
    }
    if (dto.carId !== undefined) {
      data.car = dto.carId
        ? { connect: { id: dto.carId } }
        : { disconnect: true };
    }

    if (dto.status !== undefined && dto.status !== invoice.status) {
      assertCanTransition(invoice.status, dto.status);
      data.status = dto.status;
    }

    if (dto.lineItems !== undefined || dto.discount !== undefined) {
      // We need the canonical line list to recompute totals. If the
      // caller only changed `discount`, fall back to the existing rows.
      const sourceLines =
        dto.lineItems ??
        invoice.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          type: li.type ?? undefined,
        }));

      const lines: LineItemInput[] = sourceLines.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        tvaRate,
      }));
      const calc = this.taxCalculator.calculate(lines, {
        invoiceDiscount: dto.discount ?? invoice.discount,
        fiscalStampEnabled: garage?.fiscalStampEnabled ?? true,
      });

      data.subtotal = calc.subtotalHT;
      data.taxAmount = calc.totalTVA;
      data.discount = calc.invoiceDiscount;
      data.fiscalStamp = calc.fiscalStamp;
      data.total = calc.totalTTC;

      if (dto.lineItems !== undefined) {
        const lineItemRows = sourceLines.map((item) => {
          const totals = this.taxCalculator.computeLineTotals({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            tvaRate,
          });
          return {
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            type: item.type,
            tvaRate,
            tvaAmount: totals.tvaAmount,
            total: totals.lineTotal,
          };
        });
        data.lineItems = {
          deleteMany: {},
          create: lineItemRows,
        };
      }
    }

    return this.prisma.invoice.update({
      where: { id },
      data,
      include: { lineItems: true, customer: true, car: true },
    });
  }

  /**
   * Issues a DRAFT invoice — assigns the gapless fiscal number, locks
   * the record, transitions to SENT, and decrements parts inventory.
   *
   * Stock decrement (Phase 2.2):
   *   - For every line with `partId`, sum the quantity to decrement and
   *     verify each part has enough stock BEFORE allocating a fiscal
   *     number. If any part is short, throw 400 with the shortage list
   *     and leave the invoice DRAFT — no number is burned.
   *   - Inside the transaction: create one StockMovement(type='out',
   *     reason='invoice:<number>') per line and decrement Part.quantity
   *     atomically. The whole flow rolls back if any step fails.
   */
  async issue(id: string, garageId: string, userId: string) {
    const invoice = await this.findOne(id, garageId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot issue invoice — current status is ${invoice.status}, expected DRAFT`,
      );
    }
    if (!invoice.customerId) {
      throw new BadRequestException(
        'Invoice must have a customer before issuing',
      );
    }
    if (!invoice.lineItems || invoice.lineItems.length === 0) {
      throw new BadRequestException(
        'Invoice must have at least one line item before issuing',
      );
    }
    if (!invoice.dueDate) {
      throw new BadRequestException(
        'Invoice must have a dueDate before issuing',
      );
    }

    assertCanTransition(invoice.status, InvoiceStatus.SENT);

    // ── Pre-check stock BEFORE allocating a fiscal number ──────
    const partsLines = invoice.lineItems.filter(
      (li) => li.partId !== null && li.partId !== undefined,
    );

    if (partsLines.length > 0) {
      // Aggregate requested qty per partId — multiple lines for the
      // same part collapse into a single demand check.
      const demandByPart = new Map<string, number>();
      for (const li of partsLines) {
        const qty = Math.round(li.quantity);
        if (qty <= 0) continue;
        demandByPart.set(li.partId!, (demandByPart.get(li.partId!) ?? 0) + qty);
      }

      const partIds = [...demandByPart.keys()];
      const parts = await this.prisma.part.findMany({
        where: { id: { in: partIds }, garageId },
        select: { id: true, name: true, quantity: true },
      });
      const byId = new Map(parts.map((p) => [p.id, p]));

      const shortages: Array<{
        partId: string;
        partName: string;
        requested: number;
        available: number;
      }> = [];
      for (const [partId, requested] of demandByPart.entries()) {
        const part = byId.get(partId);
        if (!part) {
          // Part vanished or belongs to another garage — treat as 0
          // available so the issue still fails cleanly.
          shortages.push({
            partId,
            partName: 'unknown',
            requested,
            available: 0,
          });
          continue;
        }
        if (part.quantity < requested) {
          shortages.push({
            partId,
            partName: part.name,
            requested,
            available: part.quantity,
          });
        }
      }

      if (shortages.length > 0) {
        // BadRequestException supports a structured cause via the
        // second-arg `description`. We embed the shortage list in the
        // response body so the front-end can render an actionable list.
        throw new BadRequestException({
          message: 'Insufficient stock to issue invoice',
          shortages,
        });
      }
    }

    // Allocate the fiscal number outside the transaction — Numbering
    // uses its own internal transaction and we accept the same small
    // "burn-on-rollback" risk that credit notes do (gapless design).
    const fiscalNumber = await this.numbering.next(garageId, 'INVOICE');

    // Parse the trailing sequence digits from the formatted number to
    // store as `issuedNumber` (the gapless integer within the period).
    const seqMatch = fiscalNumber.match(/(\d+)$/);
    const issuedNumber = seqMatch ? parseInt(seqMatch[1], 10) : null;

    // ── Lock invoice + decrement stock atomically ──────────────
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.SENT,
          invoiceNumber: fiscalNumber,
          issuedNumber,
          lockedAt: new Date(),
          lockedBy: userId,
        },
        include: {
          lineItems: true,
          customer: true,
          car: true,
          payments: true,
        },
      });

      for (const li of partsLines) {
        const qty = Math.round(li.quantity);
        if (qty <= 0) continue;
        await tx.stockMovement.create({
          data: {
            partId: li.partId!,
            type: 'out',
            quantity: qty,
            reason: `invoice:${fiscalNumber}`,
            reference: updated.id,
          },
        });
        await tx.part.update({
          where: { id: li.partId! },
          data: { quantity: { decrement: qty } },
        });
      }

      return updated;
    });
  }

  /**
   * Idempotent SENT → VIEWED transition triggered by Phase 4 public
   * link views. Currently a no-op since the schema enum lacks VIEWED;
   * once added, swap the comparison to use `InvoiceStatus.VIEWED`.
   */
  async markViewed(id: string, garageId: string) {
    const invoice = await this.findOne(id, garageId);
    // VIEWED state will be added in Phase 4 with the public link feature.
    // Until then, this method is a documented no-op so callers can be
    // wired up without a follow-up service signature change.
    return invoice;
  }

  async remove(id: string, garageId: string) {
    const invoice = await this.findOne(id, garageId);
    const removable: InvoiceStatus[] = [
      InvoiceStatus.DRAFT,
      InvoiceStatus.CANCELLED,
    ];
    if (!removable.includes(invoice.status)) {
      throw new BadRequestException(
        'Cannot delete locked invoice; issue a credit note instead.',
      );
    }
    return this.prisma.invoice.delete({ where: { id } });
  }

  async addPayment(
    invoiceId: string,
    garageId: string,
    dto: {
      amount: number;
      method?: string;
      paymentDate?: string;
      reference?: string;
      notes?: string;
      processedBy?: string;
    },
  ) {
    const invoice = await this.findOne(invoiceId, garageId);

    if (invoice.status === InvoiceStatus.DRAFT) {
      throw new BadRequestException('Issue invoice before recording payment');
    }

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId,
        amount: dto.amount,
        method: (dto.method as any) || 'CASH',
        reference: dto.reference,
        paidAt: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
      },
    });

    const payments = await this.prisma.payment.findMany({
      where: { invoiceId },
    });
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const nextStatus: InvoiceStatus =
      totalPaid >= invoice.total
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;

    if (nextStatus !== invoice.status) {
      assertCanTransition(invoice.status, nextStatus);
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: nextStatus,
        paidAt: nextStatus === InvoiceStatus.PAID ? payment.paidAt : null,
      },
    });

    return payment;
  }

  /**
   * Recomputes an invoice's status given the current set of credit notes
   * and payments. Called by `CreditNotesService.create()` after a new
   * credit note is persisted.
   *
   * Rules:
   *   - effectiveDue = invoice.total - sum(creditNotes)
   *   - paid         = sum(payments)
   *   - if paid >= effectiveDue AND effectiveDue > 0 → PAID
   *   - if paid > 0  AND paid < effectiveDue         → PARTIALLY_PAID
   *   - if paid == 0 AND effectiveDue == 0           → keep current
   *
   * Footgun guard: if the invoice was PAID and the new credit-note total
   * exceeds payments (i.e. the customer is "over-credited" — a refund is
   * owed out-of-band), we do NOT flip the status backwards to
   * PARTIALLY_PAID. The status stays PAID and the caller is told via the
   * returned `overCredited` flag. Refund flow is future work.
   *
   * Public — bypasses guards because it is invoked from CreditNotesService
   * inside a transaction. Does NOT throw on illegal transitions; it logs
   * a warning and skips, since this method is reactive, not user-driven.
   */
  async recomputeStatus(invoiceId: string): Promise<{
    oldStatus: InvoiceStatus;
    newStatus: InvoiceStatus;
    overCredited: boolean;
  }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const [creditAgg, paymentAgg] = await Promise.all([
      this.prisma.creditNote.aggregate({
        where: { invoiceId, status: 'ISSUED' },
        _sum: { total: true },
      }),
      this.prisma.payment.aggregate({
        where: { invoiceId },
        _sum: { amount: true },
      }),
    ]);
    const creditTotal = creditAgg._sum.total ?? 0;
    const paid = paymentAgg._sum.amount ?? 0;
    const effectiveDue = round3(invoice.total - creditTotal);

    const oldStatus = invoice.status;
    let nextStatus: InvoiceStatus = oldStatus;

    // overCredited semantics: the customer has paid more than what is now
    // owed after the credit note(s). A refund is owed out-of-band. This
    // is the strictly-greater-than case — exact-match (paid == effectiveDue)
    // is just normal "fully paid", not over-credited.
    const overCredited = paid > effectiveDue && effectiveDue >= 0;

    if (effectiveDue <= 0) {
      // Fully credited (or over-credited): there is nothing left to pay.
      // We don't have a CANCELLED-by-credit state in v1, so we leave the
      // status as-is. Over-credit is surfaced via the returned flag.
    } else if (paid >= effectiveDue) {
      nextStatus = InvoiceStatus.PAID;
    } else if (paid > 0) {
      nextStatus = InvoiceStatus.PARTIALLY_PAID;
    }
    // else: paid == 0 AND effectiveDue > 0 → keep current status

    // Footgun guard — never demote a PAID invoice to PARTIALLY_PAID via
    // a credit-note recompute. PAID is the customer-facing fiscal state;
    // the over-credit (refund-owed) signal flows via `overCredited`.
    if (oldStatus === InvoiceStatus.PAID && nextStatus !== InvoiceStatus.PAID) {
      this.logger.warn(
        `recomputeStatus: refusing to demote PAID invoice ${invoiceId} to ${nextStatus}; refund owed (overCredited=${overCredited})`,
      );
      nextStatus = InvoiceStatus.PAID;
    }

    if (nextStatus !== oldStatus) {
      if (!canTransitionRecompute(oldStatus, nextStatus)) {
        this.logger.warn(
          `recomputeStatus: skipping illegal transition ${oldStatus} → ${nextStatus} on invoice ${invoiceId}`,
        );
        nextStatus = oldStatus;
      } else {
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: nextStatus,
            paidAt:
              nextStatus === InvoiceStatus.PAID
                ? (invoice.paidAt ?? new Date())
                : invoice.paidAt,
          },
        });
      }
    }

    return { oldStatus, newStatus: nextStatus, overCredited };
  }
}

/**
 * Local helper — same allowed-transition table as `invoice-state.ts`,
 * but returns a boolean instead of throwing. We keep it inline so the
 * recompute path never crashes a credit-note transaction over a stale
 * status edge case.
 */
function canTransitionRecompute(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  if (from === to) return true;
  const allowed: Record<InvoiceStatus, InvoiceStatus[]> = {
    DRAFT: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
    SENT: [
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.PAID,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.CANCELLED,
    ],
    PARTIALLY_PAID: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE],
    OVERDUE: [
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.PAID,
      InvoiceStatus.CANCELLED,
    ],
    PAID: [],
    CANCELLED: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
