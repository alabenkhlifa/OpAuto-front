import { Injectable } from '@nestjs/common';

/**
 * TaxCalculatorService — Tunisian fiscal computation for invoices.
 *
 * Pure-functional service (no Prisma, no I/O). Computes per-line TVA,
 * groups by rate, applies invoice-level discount, adds the fiscal stamp.
 *
 * ── Rounding ────────────────────────────────────────────────────
 * All monetary values are rounded to 3 decimals (millimes — the Tunisian
 * dinar = 1000 millimes). Rounding happens at the LINE level: every line's
 * `baseHT` and `tvaAmount` are rounded individually, then summed. Totals
 * are not re-rounded — this matches the convention used by Tunisian fiscal
 * software (CNR / DGI invoice templates).
 *
 * ── Invoice-level discount ─────────────────────────────────────
 * `invoiceDiscount` is a flat monetary HT reduction applied to the
 * subtotal AFTER per-line TVA has already been computed. In v1 we do NOT
 * proportionally reduce the per-rate TVA buckets — the breakdown reflects
 * line items as-is and `totalTVA` stays unchanged. The discount only
 * shifts `baseAfterDiscount` (and therefore `totalTTC`). If full
 * proportional re-allocation is required for a future fiscal-control
 * audit, that becomes v2.
 *
 * ── Fiscal stamp ────────────────────────────────────────────────
 * 1.000 TND if `fiscalStampEnabled === true`, else 0. The Tunisian rule
 * (stamp due on cash payments only) is enforced by the call site at issue
 * time — this service trusts the flag.
 */
export type LineItemInput = {
  quantity: number;
  unitPrice: number;
  tvaRate: number; // e.g. 7, 13, 19, 0 (exempt)
  discountPct?: number; // 0-100, optional
};

export type TvaBreakdownEntry = {
  rate: number;
  baseHT: number;
  tvaAmount: number;
};

export type TaxCalculation = {
  subtotalHT: number;
  invoiceDiscount: number;
  baseAfterDiscount: number;
  breakdownByRate: TvaBreakdownEntry[];
  totalTVA: number;
  fiscalStamp: number;
  totalTTC: number;
};

export type TaxCalculationOptions = {
  invoiceDiscount?: number;
  fiscalStampEnabled: boolean;
};

@Injectable()
export class TaxCalculatorService {
  calculate(
    lineItems: LineItemInput[],
    options: TaxCalculationOptions,
  ): TaxCalculation {
    const invoiceDiscount = this.round3(options.invoiceDiscount ?? 0);

    // Compute per-line rounded values up-front and group by rate.
    const groups = new Map<number, { baseHT: number; tvaAmount: number }>();
    let subtotalHT = 0;

    for (const line of lineItems) {
      const { baseHT, tvaAmount } = this.computeLineTotals(line);
      subtotalHT = this.round3(subtotalHT + baseHT);

      const existing = groups.get(line.tvaRate);
      if (existing) {
        existing.baseHT = this.round3(existing.baseHT + baseHT);
        existing.tvaAmount = this.round3(existing.tvaAmount + tvaAmount);
      } else {
        groups.set(line.tvaRate, { baseHT, tvaAmount });
      }
    }

    // Build the breakdown — exclude exempt (0%) rate and empty buckets,
    // sort by rate desc. Exempt lines still feed `subtotalHT` but never
    // appear in the per-rate TVA table.
    const breakdownByRate: TvaBreakdownEntry[] = [...groups.entries()]
      .filter(([rate, v]) => rate !== 0 && v.baseHT !== 0)
      .map(([rate, v]) => ({
        rate,
        baseHT: v.baseHT,
        tvaAmount: v.tvaAmount,
      }))
      .sort((a, b) => b.rate - a.rate);

    const totalTVA = breakdownByRate.reduce(
      (sum, e) => this.round3(sum + e.tvaAmount),
      0,
    );

    // Invoice discount clamps base at zero — never negative totals.
    const baseAfterDiscount = Math.max(
      0,
      this.round3(subtotalHT - invoiceDiscount),
    );

    const fiscalStamp = options.fiscalStampEnabled ? 1.0 : 0;
    const totalTTC = this.round3(baseAfterDiscount + totalTVA + fiscalStamp);

    return {
      subtotalHT,
      invoiceDiscount,
      baseAfterDiscount,
      breakdownByRate,
      totalTVA,
      fiscalStamp,
      totalTTC,
    };
  }

  /**
   * Computes a single line's HT base, TVA amount, and total, all rounded to
   * 3 decimals. Used by InvoicingService when persisting `InvoiceLineItem`
   * rows — keeps DB values consistent with what `calculate()` aggregates.
   */
  computeLineTotals(line: LineItemInput): {
    baseHT: number;
    tvaAmount: number;
    lineTotal: number;
  } {
    const discountPct = line.discountPct ?? 0;
    const rawBase = line.quantity * line.unitPrice * (1 - discountPct / 100);
    const baseHT = this.round3(rawBase);
    const tvaAmount = this.round3((baseHT * line.tvaRate) / 100);
    const lineTotal = this.round3(baseHT + tvaAmount);
    return { baseHT, tvaAmount, lineTotal };
  }

  private round3(x: number): number {
    return Math.round(x * 1000) / 1000;
  }
}
