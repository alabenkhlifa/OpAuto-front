import { Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Daily Z-Report — end-of-day cash close summary.
 *
 * For the given calendar day:
 *   - invoicesIssued      = number of invoices whose lockedAt falls in
 *                           the day (i.e. were issued today, regardless
 *                           of when they're paid)
 *   - totalsHT/TVA/TTC    = sums across those invoices
 *   - paymentsByMethod    = sum of payments whose paidAt is in the day,
 *                           keyed by PaymentMethod
 *   - creditNotesIssued   = count + total of credit notes created in
 *                           the day
 *   - netCash             = cash payments today − credit-note totals
 *                           where parts were NOT restocked (cash
 *                           refunds owed). With restock, the credit
 *                           is settled in inventory rather than cash.
 *
 * Day window is `[date 00:00 UTC, next-day 00:00 UTC)`. We use UTC
 * intentionally — Tunisia is UTC+1 year-round (no DST), so this gives
 * a stable 24h boundary; if the garage operates "across midnight"
 * the owner can still align their printout to local-noon habits.
 */
export interface ZReport {
  date: string;
  invoicesIssued: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  paymentsByMethod: Record<PaymentMethod, number>;
  creditNotesIssued: number;
  creditNotesTotal: number;
  netCash: number;
}

@Injectable()
export class ZReportService {
  constructor(private prisma: PrismaService) {}

  async generate(garageId: string, date: Date): Promise<ZReport> {
    const start = startOfDay(date);
    const end = nextDay(start);

    const [issued, paymentsAgg, creditNotes] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          garageId,
          lockedAt: { gte: start, lt: end },
          status: { not: InvoiceStatus.CANCELLED },
        },
        select: { subtotal: true, taxAmount: true, total: true },
      }),
      this.prisma.payment.findMany({
        where: {
          invoice: { garageId },
          paidAt: { gte: start, lt: end },
        },
        select: { amount: true, method: true },
      }),
      this.prisma.creditNote.findMany({
        where: {
          garageId,
          createdAt: { gte: start, lt: end },
          status: 'ISSUED',
        },
        select: { total: true, restockParts: true },
      }),
    ]);

    const totalHT = round3(issued.reduce((s, i) => s + i.subtotal, 0));
    const totalTVA = round3(issued.reduce((s, i) => s + i.taxAmount, 0));
    const totalTTC = round3(issued.reduce((s, i) => s + i.total, 0));

    // Initialise every method to 0 so the front-end can render the
    // table without a key-existence check.
    const paymentsByMethod: Record<PaymentMethod, number> = {
      CASH: 0,
      CARD: 0,
      BANK_TRANSFER: 0,
      CHECK: 0,
      MOBILE_PAYMENT: 0,
    };
    for (const p of paymentsAgg) {
      paymentsByMethod[p.method] = round3(paymentsByMethod[p.method] + p.amount);
    }

    const creditCashRefund = creditNotes
      .filter((c) => !c.restockParts)
      .reduce((s, c) => s + c.total, 0);

    const netCash = round3(paymentsByMethod.CASH - creditCashRefund);

    return {
      date: start.toISOString().slice(0, 10),
      invoicesIssued: issued.length,
      totalHT,
      totalTVA,
      totalTTC,
      paymentsByMethod,
      creditNotesIssued: creditNotes.length,
      creditNotesTotal: round3(creditNotes.reduce((s, c) => s + c.total, 0)),
      netCash,
    };
  }
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function nextDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + 1);
  return out;
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
