import { Test, TestingModule } from '@nestjs/testing';
import {
  LineItemInput,
  TaxCalculatorService,
} from './tax-calculator.service';

// ── Helpers ──────────────────────────────────────────────────────

async function buildService(): Promise<TaxCalculatorService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [TaxCalculatorService],
  }).compile();
  return module.get<TaxCalculatorService>(TaxCalculatorService);
}

const line = (
  quantity: number,
  unitPrice: number,
  tvaRate: number,
  discountPct?: number,
): LineItemInput => ({ quantity, unitPrice, tvaRate, discountPct });

// ── Tests ────────────────────────────────────────────────────────

describe('TaxCalculatorService', () => {
  let service: TaxCalculatorService;

  beforeEach(async () => {
    service = await buildService();
  });

  // 1. Single line, 19% TVA, no discount, stamp on
  describe('single line, 19% TVA', () => {
    it('computes baseHT, tva, and TTC with fiscal stamp', () => {
      // 2 × 50 = 100 HT, 19% → 19 TVA, +1 stamp → 120 TTC
      const result = service.calculate([line(2, 50, 19)], {
        fiscalStampEnabled: true,
      });

      expect(result.subtotalHT).toBe(100);
      expect(result.invoiceDiscount).toBe(0);
      expect(result.baseAfterDiscount).toBe(100);
      expect(result.totalTVA).toBe(19);
      expect(result.fiscalStamp).toBe(1);
      expect(result.totalTTC).toBe(120);
      expect(result.breakdownByRate).toEqual([
        { rate: 19, baseHT: 100, tvaAmount: 19 },
      ]);
    });
  });

  // 2. Each TVA rate parameterised
  describe('each TVA rate', () => {
    type Case = {
      label: string;
      rate: number;
      expectedTva: number;
      expectedTtc: number; // 100 + tva (no stamp in this suite)
      expectedBreakdownLength: number;
    };

    const cases: Case[] = [
      { label: 'rate 7%',  rate: 7,  expectedTva: 7,  expectedTtc: 107, expectedBreakdownLength: 1 },
      { label: 'rate 13%', rate: 13, expectedTva: 13, expectedTtc: 113, expectedBreakdownLength: 1 },
      { label: 'rate 19%', rate: 19, expectedTva: 19, expectedTtc: 119, expectedBreakdownLength: 1 },
      // Exempt: line still contributes to baseHT but no breakdown entry
      { label: 'rate 0% (exempt)', rate: 0, expectedTva: 0, expectedTtc: 100, expectedBreakdownLength: 0 },
    ];

    test.each(cases)('$label', (c) => {
      const result = service.calculate([line(1, 100, c.rate)], {
        fiscalStampEnabled: false,
      });

      expect(result.subtotalHT).toBe(100);
      expect(result.totalTVA).toBe(c.expectedTva);
      expect(result.totalTTC).toBe(c.expectedTtc);
      expect(result.breakdownByRate).toHaveLength(c.expectedBreakdownLength);
      if (c.expectedBreakdownLength === 1) {
        expect(result.breakdownByRate[0]).toEqual({
          rate: c.rate,
          baseHT: 100,
          tvaAmount: c.expectedTva,
        });
      }
    });
  });

  // 3. Mixed rates — three lines at 7/13/19 sorted descending
  describe('mixed rates in same invoice', () => {
    it('groups by rate and sorts descending', () => {
      const result = service.calculate(
        [line(1, 100, 7), line(1, 200, 13), line(1, 300, 19)],
        { fiscalStampEnabled: false },
      );

      expect(result.subtotalHT).toBe(600);
      expect(result.breakdownByRate).toEqual([
        { rate: 19, baseHT: 300, tvaAmount: 57 },
        { rate: 13, baseHT: 200, tvaAmount: 26 },
        { rate: 7,  baseHT: 100, tvaAmount: 7 },
      ]);
      expect(result.totalTVA).toBe(57 + 26 + 7);
      expect(result.totalTTC).toBe(600 + 90);
    });

    it('aggregates multiple lines at the same rate into one bucket', () => {
      const result = service.calculate(
        [line(1, 100, 19), line(2, 50, 19)],
        { fiscalStampEnabled: false },
      );

      expect(result.breakdownByRate).toEqual([
        { rate: 19, baseHT: 200, tvaAmount: 38 },
      ]);
    });
  });

  // 4. Exempt rate excluded from breakdown
  describe('exempt rate (0%)', () => {
    it('contributes to baseHT but is excluded from breakdownByRate', () => {
      const result = service.calculate(
        [line(1, 100, 19), line(1, 50, 0)],
        { fiscalStampEnabled: false },
      );

      expect(result.subtotalHT).toBe(150);
      expect(result.totalTVA).toBe(19);
      expect(result.breakdownByRate).toEqual([
        { rate: 19, baseHT: 100, tvaAmount: 19 },
      ]);
      expect(result.breakdownByRate.find((b) => b.rate === 0)).toBeUndefined();
    });
  });

  // 5. Line-level discount 10%
  describe('line-level discount', () => {
    it('applies discount before computing TVA', () => {
      // 1 × 100 × 0.9 = 90 HT, 19% → 17.1 TVA
      const result = service.calculate([line(1, 100, 19, 10)], {
        fiscalStampEnabled: false,
      });

      expect(result.subtotalHT).toBe(90);
      expect(result.totalTVA).toBe(17.1);
      expect(result.totalTTC).toBe(107.1);
      expect(result.breakdownByRate).toEqual([
        { rate: 19, baseHT: 90, tvaAmount: 17.1 },
      ]);
    });
  });

  // 6. Invoice-level discount
  describe('invoice-level discount', () => {
    it('reduces baseAfterDiscount but does not change totalTVA', () => {
      // 1 × 100 at 19% → 100 HT, 19 TVA
      // Invoice discount of 10 → baseAfterDiscount = 90, TVA still 19
      const result = service.calculate([line(1, 100, 19)], {
        invoiceDiscount: 10,
        fiscalStampEnabled: false,
      });

      expect(result.subtotalHT).toBe(100);
      expect(result.invoiceDiscount).toBe(10);
      expect(result.baseAfterDiscount).toBe(90);
      expect(result.totalTVA).toBe(19);
      expect(result.totalTTC).toBe(109);
      // Breakdown still reflects line items as-is.
      expect(result.breakdownByRate).toEqual([
        { rate: 19, baseHT: 100, tvaAmount: 19 },
      ]);
    });
  });

  // 7. Fiscal stamp toggle
  describe('fiscal stamp toggle', () => {
    it('adds 1.0 when enabled', () => {
      const result = service.calculate([line(1, 100, 19)], {
        fiscalStampEnabled: true,
      });
      expect(result.fiscalStamp).toBe(1);
      expect(result.totalTTC).toBe(120);
    });

    it('adds 0 when disabled', () => {
      const result = service.calculate([line(1, 100, 19)], {
        fiscalStampEnabled: false,
      });
      expect(result.fiscalStamp).toBe(0);
      expect(result.totalTTC).toBe(119);
    });
  });

  // 8. Rounding boundaries
  describe('rounding boundaries (3 decimals = millimes)', () => {
    it('1 × 0.0005 at 19% → baseHT=0.001, tvaAmount=0', () => {
      const result = service.calculate([line(1, 0.0005, 19)], {
        fiscalStampEnabled: false,
      });
      expect(result.subtotalHT).toBe(0.001);
      expect(result.totalTVA).toBe(0);
      expect(result.breakdownByRate).toEqual([
        { rate: 19, baseHT: 0.001, tvaAmount: 0 },
      ]);
    });

    it('7 × 1.4286 at 19% → baseHT=10, tvaAmount=1.9', () => {
      // 7 × 1.4286 = 10.0002 → rounded to 10.000
      // 10 × 0.19 = 1.9
      const result = service.calculate([line(7, 1.4286, 19)], {
        fiscalStampEnabled: false,
      });
      expect(result.subtotalHT).toBe(10);
      expect(result.totalTVA).toBe(1.9);
      expect(result.breakdownByRate).toEqual([
        { rate: 19, baseHT: 10, tvaAmount: 1.9 },
      ]);
    });
  });

  // 9. Empty line items
  describe('empty line items', () => {
    it('returns zeros with stamp disabled', () => {
      const result = service.calculate([], { fiscalStampEnabled: false });
      expect(result.subtotalHT).toBe(0);
      expect(result.totalTVA).toBe(0);
      expect(result.fiscalStamp).toBe(0);
      expect(result.totalTTC).toBe(0);
      expect(result.breakdownByRate).toEqual([]);
    });

    it('totalTTC equals fiscal stamp when stamp enabled and no lines', () => {
      const result = service.calculate([], { fiscalStampEnabled: true });
      expect(result.totalTTC).toBe(1);
    });
  });

  // 10. Invoice discount > subtotal clamps to 0
  describe('invoice discount overflow', () => {
    it('clamps baseAfterDiscount at 0 when discount exceeds subtotal', () => {
      // 1 × 50 at 19% → 50 HT, 9.5 TVA
      // Invoice discount 100 → baseAfterDiscount clamps to 0
      const result = service.calculate([line(1, 50, 19)], {
        invoiceDiscount: 100,
        fiscalStampEnabled: false,
      });

      expect(result.subtotalHT).toBe(50);
      expect(result.baseAfterDiscount).toBe(0);
      // TVA unchanged — still computed per-line.
      expect(result.totalTVA).toBe(9.5);
      // 0 + 9.5 + 0 stamp = 9.5
      expect(result.totalTTC).toBe(9.5);
    });
  });

  // 11. computeLineTotals helper
  describe('computeLineTotals', () => {
    it('returns baseHT, tvaAmount, and lineTotal=baseHT+tvaAmount', () => {
      const result = service.computeLineTotals(line(2, 50, 19));
      expect(result.baseHT).toBe(100);
      expect(result.tvaAmount).toBe(19);
      expect(result.lineTotal).toBe(119);
    });

    it('respects line-level discount', () => {
      const result = service.computeLineTotals(line(1, 100, 19, 10));
      expect(result.baseHT).toBe(90);
      expect(result.tvaAmount).toBe(17.1);
      expect(result.lineTotal).toBe(107.1);
    });

    it('rounds to millimes', () => {
      // 7 × 1.4286 → 10.0002 → 10.000; tva 1.900; total 11.900
      const result = service.computeLineTotals(line(7, 1.4286, 19));
      expect(result.baseHT).toBe(10);
      expect(result.tvaAmount).toBe(1.9);
      expect(result.lineTotal).toBe(11.9);
    });

    it('handles exempt rate (0%) → tva and lineTotal degenerate to base', () => {
      const result = service.computeLineTotals(line(3, 25, 0));
      expect(result.baseHT).toBe(75);
      expect(result.tvaAmount).toBe(0);
      expect(result.lineTotal).toBe(75);
    });
  });
});
