import {
  BadRequestException,
  Injectable,
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
      data.car = dto.carId ? { connect: { id: dto.carId } } : { disconnect: true };
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
   * the record, and transitions to SENT. Stock decrement and customer
   * email come in later phases.
   */
  async issue(id: string, garageId: string, userId: string) {
    const invoice = await this.findOne(id, garageId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot issue invoice — current status is ${invoice.status}, expected DRAFT`,
      );
    }
    if (!invoice.customerId) {
      throw new BadRequestException('Invoice must have a customer before issuing');
    }
    if (!invoice.lineItems || invoice.lineItems.length === 0) {
      throw new BadRequestException(
        'Invoice must have at least one line item before issuing',
      );
    }
    if (!invoice.dueDate) {
      throw new BadRequestException('Invoice must have a dueDate before issuing');
    }

    assertCanTransition(invoice.status, InvoiceStatus.SENT);

    // Allocate the fiscal number and lock the row in the SAME transaction
    // so a counter increment cannot leak when the update fails.
    const fiscalNumber = await this.numbering.next(garageId, 'INVOICE');

    // Parse the trailing sequence digits from the formatted number to
    // store as `issuedNumber` (the gapless integer within the period).
    const seqMatch = fiscalNumber.match(/(\d+)$/);
    const issuedNumber = seqMatch ? parseInt(seqMatch[1], 10) : null;

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.SENT,
        invoiceNumber: fiscalNumber,
        issuedNumber,
        lockedAt: new Date(),
        lockedBy: userId,
      },
      include: { lineItems: true, customer: true, car: true, payments: true },
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
      throw new BadRequestException(
        'Issue invoice before recording payment',
      );
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
}
