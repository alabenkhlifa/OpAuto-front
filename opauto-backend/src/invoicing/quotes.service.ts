import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, QuoteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { NumberingService } from './numbering.service';
import {
  TaxCalculatorService,
  type LineItemInput,
} from './tax-calculator.service';
import { InvoicingService } from './invoicing.service';

/**
 * QuotesService — orchestrates devis CRUD + state machine + the
 * approve→DRAFT-invoice handoff.
 *
 * State machine: DRAFT → SENT → APPROVED|REJECTED|EXPIRED.
 * APPROVED, REJECTED, and EXPIRED are terminal.
 *
 * Numbering:
 *   - DRAFT carries a placeholder `DRAFT-<uuid8>` quoteNumber.
 *   - `send()` allocates the gapless DEV-<YEAR>-<NNNN> via NumberingService.
 *
 * Approval handoff:
 *   - On approve, we call `InvoicingService.create()` with the same line
 *     items so a DRAFT invoice is born. We then set
 *     `quote.convertedToInvoiceId` to the new invoice id and return both.
 *   - The new invoice carries `quoteId` so analytics can join the two.
 */
@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private prisma: PrismaService,
    private numbering: NumberingService,
    private taxCalculator: TaxCalculatorService,
    private invoicing: InvoicingService,
  ) {}

  // ── List + detail ────────────────────────────────────────────

  async findAll(garageId: string) {
    return this.prisma.quote.findMany({
      where: { garageId },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        car: {
          select: { make: true, model: true, year: true, licensePlate: true },
        },
        _count: { select: { lineItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, garageId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, garageId },
      include: { customer: true, car: true, lineItems: true },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  // ── Create / update ──────────────────────────────────────────

  async create(garageId: string, dto: CreateQuoteDto) {
    const garage = await this.prisma.garage.findUnique({
      where: { id: garageId },
      select: {
        defaultTvaRate: true,
        fiscalStampEnabled: true,
        defaultPaymentTermsDays: true,
      },
    });
    if (!garage) throw new NotFoundException('Garage not found');

    const defaultTvaRate = garage.defaultTvaRate ?? 19;

    // Resolve validUntil: caller value or now + paymentTerms.
    const validUntil = dto.validUntil
      ? new Date(dto.validUntil)
      : new Date(
          Date.now() +
            (garage.defaultPaymentTermsDays ?? 30) * 24 * 60 * 60 * 1000,
        );

    const lines: LineItemInput[] = dto.lineItems.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      tvaRate: item.tvaRate ?? defaultTvaRate,
      discountPct: item.discountPct,
    }));

    const calc = this.taxCalculator.calculate(lines, {
      invoiceDiscount: dto.discount ?? 0,
      // Quotes never carry a fiscal stamp — only paid invoices do.
      fiscalStampEnabled: false,
    });

    const lineItemRows = dto.lineItems.map((item) => {
      const tvaRate = item.tvaRate ?? defaultTvaRate;
      const totals = this.taxCalculator.computeLineTotals({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        tvaRate,
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
        tvaRate,
        tvaAmount: totals.tvaAmount,
        total: totals.lineTotal,
        discountPct: item.discountPct,
      };
    });

    return this.prisma.quote.create({
      data: {
        garageId,
        customerId: dto.customerId,
        carId: dto.carId,
        quoteNumber: `DRAFT-${randomUUID().slice(0, 8)}`,
        status: QuoteStatus.DRAFT,
        subtotal: calc.subtotalHT,
        taxAmount: calc.totalTVA,
        discount: calc.invoiceDiscount,
        total: calc.totalTTC,
        validUntil,
        notes: dto.notes,
        lineItems: { create: lineItemRows },
      },
      include: { lineItems: true, customer: true, car: true },
    });
  }

  async update(id: string, garageId: string, dto: UpdateQuoteDto) {
    const quote = await this.findOne(id, garageId);
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot edit a ${quote.status} quote — only DRAFT quotes are editable`,
      );
    }

    const garage = await this.prisma.garage.findUnique({
      where: { id: garageId },
      select: { defaultTvaRate: true },
    });
    const defaultTvaRate = garage?.defaultTvaRate ?? 19;

    const data: Prisma.QuoteUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.validUntil !== undefined) {
      data.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    }
    if (dto.customerId !== undefined) {
      data.customer = { connect: { id: dto.customerId } };
    }
    if (dto.carId !== undefined) {
      data.car = dto.carId
        ? { connect: { id: dto.carId } }
        : { disconnect: true };
    }

    if (dto.lineItems !== undefined || dto.discount !== undefined) {
      const sourceLines =
        dto.lineItems ??
        quote.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          tvaRate: li.tvaRate,
          type: li.type ?? undefined,
          partId: li.partId ?? undefined,
          serviceCode: li.serviceCode ?? undefined,
          mechanicId: li.mechanicId ?? undefined,
          laborHours: li.laborHours ?? undefined,
          discountPct: li.discountPct ?? undefined,
        }));

      const lines: LineItemInput[] = sourceLines.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        tvaRate: item.tvaRate ?? defaultTvaRate,
        discountPct: item.discountPct,
      }));
      const calc = this.taxCalculator.calculate(lines, {
        invoiceDiscount: dto.discount ?? quote.discount,
        fiscalStampEnabled: false,
      });

      data.subtotal = calc.subtotalHT;
      data.taxAmount = calc.totalTVA;
      data.discount = calc.invoiceDiscount;
      data.total = calc.totalTTC;

      if (dto.lineItems !== undefined) {
        const lineItemRows = sourceLines.map((item) => {
          const tvaRate = item.tvaRate ?? defaultTvaRate;
          const totals = this.taxCalculator.computeLineTotals({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            tvaRate,
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
            tvaRate,
            tvaAmount: totals.tvaAmount,
            total: totals.lineTotal,
            discountPct: item.discountPct,
          };
        });
        data.lineItems = {
          deleteMany: {},
          create: lineItemRows,
        };
      }
    }

    return this.prisma.quote.update({
      where: { id },
      data,
      include: { lineItems: true, customer: true, car: true },
    });
  }

  // ── State transitions ────────────────────────────────────────

  async send(id: string, garageId: string) {
    const quote = await this.findOne(id, garageId);
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot send a ${quote.status} quote — only DRAFT quotes can be sent`,
      );
    }
    const quoteNumber = await this.numbering.next(garageId, 'QUOTE');
    return this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.SENT, quoteNumber },
      include: { lineItems: true, customer: true, car: true },
    });
  }

  async approve(id: string, garageId: string) {
    const quote = await this.findOne(id, garageId);
    if (quote.status !== QuoteStatus.SENT) {
      throw new BadRequestException(
        `Cannot approve a ${quote.status} quote — only SENT quotes can be approved`,
      );
    }

    // Build a CreateInvoiceDto from the quote's lines.
    const invoice = await this.invoicing.create(garageId, {
      customerId: quote.customerId,
      carId: quote.carId ?? undefined,
      discount: quote.discount,
      notes: quote.notes ?? undefined,
      lineItems: quote.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        type: li.type ?? undefined,
      })),
    });

    // Link both directions: invoice.quoteId + quote.convertedToInvoiceId.
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { quoteId: id },
    });
    const updatedQuote = await this.prisma.quote.update({
      where: { id },
      data: {
        status: QuoteStatus.APPROVED,
        convertedToInvoiceId: invoice.id,
      },
      include: { lineItems: true, customer: true, car: true },
    });

    return { quote: updatedQuote, invoice };
  }

  async reject(id: string, garageId: string) {
    const quote = await this.findOne(id, garageId);
    if (quote.status !== QuoteStatus.SENT) {
      throw new BadRequestException(
        `Cannot reject a ${quote.status} quote — only SENT quotes can be rejected`,
      );
    }
    return this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.REJECTED },
      include: { lineItems: true, customer: true, car: true },
    });
  }

  /**
   * Auto-expire SENT quotes whose `validUntil` is in the past. Returns
   * the count of quotes flipped to EXPIRED. Wire to a @Cron later.
   */
  async expireOldQuotes(now: Date = new Date()): Promise<{ expired: number }> {
    const result = await this.prisma.quote.updateMany({
      where: {
        status: QuoteStatus.SENT,
        validUntil: { lt: now },
      },
      data: { status: QuoteStatus.EXPIRED },
    });
    return { expired: result.count };
  }
}
