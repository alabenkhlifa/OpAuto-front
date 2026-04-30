import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Customer Statement — chronological ledger of every invoice, payment,
 * and credit note for a customer over a date range, with a running
 * balance after each event.
 *
 * Sign convention (mirrors how garage owners read their own books):
 *   - INVOICE   : +amount  (customer owes more)
 *   - PAYMENT   : −amount  (customer owes less)
 *   - CREDIT NOTE: −amount  (customer owes less)
 *
 * `openingBalance` is the running balance computed from all customer
 * activity STRICTLY BEFORE `from`. `closingBalance` is the final value
 * after the last event in the range.
 */
export type StatementEventType = 'invoice' | 'payment' | 'creditNote';

export interface StatementEvent {
  type: StatementEventType;
  date: string; // ISO date
  ref: string; // invoice number / payment id / credit note number
  amount: number; // signed: + adds to debt, − reduces debt
  runningBalance: number;
  description?: string;
}

export interface CustomerStatement {
  customer: { id: string; firstName: string; lastName: string; email?: string | null };
  from: string;
  to: string;
  openingBalance: number;
  items: StatementEvent[];
  closingBalance: number;
}

interface RawEvent {
  type: StatementEventType;
  date: Date;
  ref: string;
  amount: number;
  description?: string;
}

@Injectable()
export class CustomerStatementService {
  constructor(private prisma: PrismaService) {}

  async generate(
    garageId: string,
    customerId: string,
    from: Date,
    to: Date,
  ): Promise<CustomerStatement> {
    if (from > to) {
      throw new Error('`from` must be ≤ `to`');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, garageId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found in this garage');
    }

    // Fetch ALL events for the customer (so we can build the opening
    // balance accurately) — invoices live by `createdAt` (lockedAt
    // would only cover issued ones), payments by `paidAt`, credit
    // notes by `createdAt`.
    const [invoices, payments, creditNotes] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { garageId, customerId },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          createdAt: true,
          status: true,
        },
      }),
      this.prisma.payment.findMany({
        where: { invoice: { garageId, customerId } },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          method: true,
          invoice: { select: { invoiceNumber: true } },
        },
      }),
      this.prisma.creditNote.findMany({
        where: { garageId, invoice: { customerId }, status: 'ISSUED' },
        select: {
          id: true,
          creditNoteNumber: true,
          total: true,
          createdAt: true,
        },
      }),
    ]);

    const events: RawEvent[] = [];

    for (const inv of invoices) {
      // Skip DRAFT — they don't represent a real receivable yet.
      if (inv.status === 'DRAFT') continue;
      events.push({
        type: 'invoice',
        date: inv.createdAt,
        ref: inv.invoiceNumber,
        amount: inv.total, // positive: debt grows
      });
    }
    for (const pay of payments) {
      events.push({
        type: 'payment',
        date: pay.paidAt,
        ref: `${pay.invoice.invoiceNumber}/${pay.id.slice(0, 6)}`,
        amount: -pay.amount, // negative: debt shrinks
        description: pay.method,
      });
    }
    for (const cn of creditNotes) {
      events.push({
        type: 'creditNote',
        date: cn.createdAt,
        ref: cn.creditNoteNumber,
        amount: -cn.total, // negative: debt shrinks
      });
    }

    // Sort chronologically with stable per-day ordering: invoice → payment → creditNote.
    const typeOrder: Record<StatementEventType, number> = {
      invoice: 0,
      payment: 1,
      creditNote: 2,
    };
    events.sort((a, b) => {
      const dt = a.date.getTime() - b.date.getTime();
      if (dt !== 0) return dt;
      return typeOrder[a.type] - typeOrder[b.type];
    });

    let opening = 0;
    let running = 0;
    const items: StatementEvent[] = [];

    for (const ev of events) {
      if (ev.date < from) {
        opening = round3(opening + ev.amount);
        running = opening;
        continue;
      }
      if (ev.date > endOfDay(to)) {
        // Beyond range — stop. (Events were already sorted by date.)
        break;
      }
      running = round3(running + ev.amount);
      items.push({
        type: ev.type,
        date: ev.date.toISOString().slice(0, 10),
        ref: ev.ref,
        amount: round3(ev.amount),
        runningBalance: running,
        description: ev.description,
      });
    }

    return {
      customer,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      openingBalance: round3(opening),
      items,
      closingBalance: round3(running),
    };
  }
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(23, 59, 59, 999);
  return out;
}
