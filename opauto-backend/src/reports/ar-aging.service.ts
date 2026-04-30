import { Injectable } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * AR Aging — receivables broken down by how many days an outstanding
 * invoice is past its `dueDate`, grouped per customer.
 *
 * Bucket convention (Tunisian accountant practice + standard SaaS
 * dashboards):
 *   - current     : invoice not yet due (`dueDate >= today`)
 *   - 1-30        : 1 to 30 days past due
 *   - 31-60       : 31 to 60 days past due
 *   - 61-90       : 61 to 90 days past due
 *   - 90+         : 91 days or more past due
 *
 * `remainingAmount` = invoice.total
 *                     − sum(payments where invoiceId = invoice.id)
 *                     − sum(creditNotes ISSUED for that invoice).total
 *
 * Only invoices in {SENT, PARTIALLY_PAID, OVERDUE} are considered —
 * DRAFT is not yet a receivable, PAID/CANCELLED have nothing to age.
 */
export interface ArAgingRow {
  customerId: string;
  customerName: string;
  current: number;
  b1_30: number;
  b31_60: number;
  b61_90: number;
  b90_plus: number;
  total: number;
}

export interface ArAgingReport {
  asOf: string; // ISO date — the "today" used to compute buckets
  totals: Omit<ArAgingRow, 'customerId' | 'customerName'>;
  rows: ArAgingRow[];
}

@Injectable()
export class ArAgingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Bucket a delta-in-days into the AR-aging label.
   * `daysOverdue` is `today - dueDate` rounded down to whole days.
   * Negative or zero means not yet due → 'current'.
   */
  static bucketFor(daysOverdue: number): keyof Omit<
    ArAgingRow,
    'customerId' | 'customerName' | 'total'
  > {
    if (daysOverdue <= 0) return 'current';
    if (daysOverdue <= 30) return 'b1_30';
    if (daysOverdue <= 60) return 'b31_60';
    if (daysOverdue <= 90) return 'b61_90';
    return 'b90_plus';
  }

  /**
   * Compute days overdue between `dueDate` and `today` (both treated
   * as UTC midnights to dodge DST/locale skew).
   */
  static daysOverdue(dueDate: Date | null, today: Date): number {
    if (!dueDate) return 0;
    const dueMs = Date.UTC(
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth(),
      dueDate.getUTCDate(),
    );
    const todayMs = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const diffDays = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  async generate(garageId: string, asOf: Date = new Date()): Promise<ArAgingReport> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        garageId,
        status: {
          in: [
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.OVERDUE,
          ],
        },
      },
      select: {
        id: true,
        total: true,
        dueDate: true,
        customerId: true,
        customer: { select: { firstName: true, lastName: true } },
        payments: { select: { amount: true } },
        creditNotes: {
          where: { status: 'ISSUED' },
          select: { total: true },
        },
      },
    });

    const byCustomer = new Map<string, ArAgingRow>();

    for (const inv of invoices) {
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      const credited = inv.creditNotes.reduce((s, c) => s + c.total, 0);
      const remaining = inv.total - paid - credited;
      // Skip cleanly-zero balances (could be slightly negative after
      // over-credit; we don't ask the customer for negative cash).
      if (remaining <= 0.0001) continue;

      const days = ArAgingService.daysOverdue(inv.dueDate, asOf);
      const bucket = ArAgingService.bucketFor(days);

      const name = inv.customer
        ? `${inv.customer.firstName} ${inv.customer.lastName}`.trim()
        : 'Unknown';

      let row = byCustomer.get(inv.customerId);
      if (!row) {
        row = {
          customerId: inv.customerId,
          customerName: name,
          current: 0,
          b1_30: 0,
          b31_60: 0,
          b61_90: 0,
          b90_plus: 0,
          total: 0,
        };
        byCustomer.set(inv.customerId, row);
      }
      row[bucket] += remaining;
      row.total += remaining;
    }

    // Sort rows by total desc, round to 3 decimals (Tunisian fiscal
    // convention rounds to 3 decimals throughout the system).
    const rows = [...byCustomer.values()]
      .map((r) => ({
        ...r,
        current: round3(r.current),
        b1_30: round3(r.b1_30),
        b31_60: round3(r.b31_60),
        b61_90: round3(r.b61_90),
        b90_plus: round3(r.b90_plus),
        total: round3(r.total),
      }))
      .sort((a, b) => b.total - a.total);

    const totals = rows.reduce(
      (acc, r) => ({
        current: round3(acc.current + r.current),
        b1_30: round3(acc.b1_30 + r.b1_30),
        b31_60: round3(acc.b31_60 + r.b31_60),
        b61_90: round3(acc.b61_90 + r.b61_90),
        b90_plus: round3(acc.b90_plus + r.b90_plus),
        total: round3(acc.total + r.total),
      }),
      { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0 },
    );

    return {
      asOf: asOf.toISOString().slice(0, 10),
      totals,
      rows,
    };
  }

  /**
   * Render the report as RFC 4180 CSV. Numeric columns use `.` as
   * decimal separator (the i18n layer is the front-end's job).
   */
  toCsv(report: ArAgingReport): string {
    const header = [
      'customer_id',
      'customer_name',
      'current',
      '1_30',
      '31_60',
      '61_90',
      '90_plus',
      'total',
    ];
    const lines = [header.join(',')];
    for (const r of report.rows) {
      lines.push(
        [
          r.customerId,
          escapeCsv(r.customerName),
          r.current.toFixed(3),
          r.b1_30.toFixed(3),
          r.b31_60.toFixed(3),
          r.b61_90.toFixed(3),
          r.b90_plus.toFixed(3),
          r.total.toFixed(3),
        ].join(','),
      );
    }
    return lines.join('\n');
  }
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function escapeCsv(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
