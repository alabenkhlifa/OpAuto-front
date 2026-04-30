import { Injectable, BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Monthly accountant CSV export.
 *
 * One row per issued invoice in the month (`lockedAt` between
 * [first-day 00:00 UTC, next-month 00:00 UTC)) with status in
 * {SENT, PARTIALLY_PAID, PAID, OVERDUE} — DRAFT and CANCELLED are
 * excluded.
 *
 * Columns (matches Tunisian accountant chart-of-accounts ingest):
 *   - date_issued     : YYYY-MM-DD (lockedAt)
 *   - invoice_number  : e.g. INV-2026-0042
 *   - customer_name   : "First Last"
 *   - customer_mf     : Tunisian matricule fiscal (may be empty)
 *   - ht_total        : subtotal HT
 *   - tva_7           : sum of (lineHT * 7%) where line.tvaRate = 7
 *   - tva_13          : same for 13%
 *   - tva_19          : same for 19%
 *   - tva_total       : sum of the three (rounded match)
 *   - fiscal_stamp    : 1 if collected, else 0
 *   - ttc_total       : invoice.total
 *   - payment_method  : aggregated method (one of the enum keys, or
 *                       'MIXED' if multiple methods, or '' if unpaid)
 *   - paid_date       : the latest payment date for the invoice
 *                       (empty if not paid)
 */
@Injectable()
export class AccountantExportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Parse `YYYY-MM` and return [start, nextMonthStart) UTC bounds.
   * Throws BadRequest on malformed input.
   */
  static parseMonth(month: string): { start: Date; nextMonth: Date } {
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) {
      throw new BadRequestException(
        `Invalid month '${month}', expected YYYY-MM`,
      );
    }
    const year = parseInt(m[1], 10);
    const monthIdx = parseInt(m[2], 10) - 1;
    if (monthIdx < 0 || monthIdx > 11) {
      throw new BadRequestException(`Invalid month value '${month}'`);
    }
    const start = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0, 0));
    const nextMonth = new Date(Date.UTC(year, monthIdx + 1, 1, 0, 0, 0, 0));
    return { start, nextMonth };
  }

  async generateCsv(garageId: string, month: string): Promise<string> {
    const { start, nextMonth } = AccountantExportService.parseMonth(month);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        garageId,
        lockedAt: { gte: start, lt: nextMonth },
        status: {
          in: [
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.PAID,
            InvoiceStatus.OVERDUE,
          ],
        },
      },
      include: {
        customer: { select: { firstName: true, lastName: true, mfNumber: true } },
        lineItems: {
          select: {
            quantity: true,
            unitPrice: true,
            tvaRate: true,
            tvaAmount: true,
          },
        },
        payments: { select: { method: true, paidAt: true } },
      },
      orderBy: { lockedAt: 'asc' },
    });

    const header = [
      'date_issued',
      'invoice_number',
      'customer_name',
      'customer_mf',
      'ht_total',
      'tva_7',
      'tva_13',
      'tva_19',
      'tva_total',
      'fiscal_stamp',
      'ttc_total',
      'payment_method',
      'paid_date',
    ];

    const lines: string[] = [header.join(',')];

    for (const inv of invoices) {
      const breakdown = AccountantExportService.tvaBreakdown(inv.lineItems);
      const customerName = inv.customer
        ? `${inv.customer.firstName} ${inv.customer.lastName}`.trim()
        : '';
      const customerMf = inv.customer?.mfNumber ?? '';

      // Aggregate payment method: single distinct → that method, multi
      // → MIXED, none → '' (the invoice is still SENT).
      const distinctMethods = [...new Set(inv.payments.map((p) => p.method))];
      const paymentMethod =
        distinctMethods.length === 0
          ? ''
          : distinctMethods.length === 1
            ? distinctMethods[0]
            : 'MIXED';

      const paidDate =
        inv.payments.length > 0
          ? new Date(
              Math.max(...inv.payments.map((p) => p.paidAt.getTime())),
            )
              .toISOString()
              .slice(0, 10)
          : '';

      const dateIssued =
        inv.lockedAt!.toISOString().slice(0, 10); // non-null per filter

      lines.push(
        [
          dateIssued,
          escapeCsv(inv.invoiceNumber),
          escapeCsv(customerName),
          escapeCsv(customerMf),
          inv.subtotal.toFixed(3),
          breakdown.tva7.toFixed(3),
          breakdown.tva13.toFixed(3),
          breakdown.tva19.toFixed(3),
          breakdown.totalTva.toFixed(3),
          inv.fiscalStamp.toFixed(3),
          inv.total.toFixed(3),
          paymentMethod,
          paidDate,
        ].join(','),
      );
    }

    return lines.join('\n');
  }

  /**
   * Compute per-rate TVA totals from a list of invoice line items.
   * The standard Tunisian rates are 7, 13, 19 — anything else is
   * lumped into the closest column for now (a future schema bump
   * could add `tva_other`).
   */
  static tvaBreakdown(
    lines: Array<{ tvaRate: number; tvaAmount: number }>,
  ): { tva7: number; tva13: number; tva19: number; totalTva: number } {
    let tva7 = 0;
    let tva13 = 0;
    let tva19 = 0;
    for (const li of lines) {
      if (li.tvaRate === 7) tva7 += li.tvaAmount;
      else if (li.tvaRate === 13) tva13 += li.tvaAmount;
      else if (li.tvaRate === 19) tva19 += li.tvaAmount;
      // 0 (exempt) intentionally contributes nothing.
    }
    const totalTva = tva7 + tva13 + tva19;
    return {
      tva7: round3(tva7),
      tva13: round3(tva13),
      tva19: round3(tva19),
      totalTva: round3(totalTva),
    };
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
