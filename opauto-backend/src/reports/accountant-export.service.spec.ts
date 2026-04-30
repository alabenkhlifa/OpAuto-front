import { AccountantExportService } from './accountant-export.service';

describe('AccountantExportService — unit', () => {
  describe('parseMonth', () => {
    it('parses YYYY-MM into UTC bounds', () => {
      const { start, nextMonth } = AccountantExportService.parseMonth('2026-04');
      expect(start.toISOString()).toBe('2026-04-01T00:00:00.000Z');
      expect(nextMonth.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });

    it('rolls over December → next year', () => {
      const { start, nextMonth } = AccountantExportService.parseMonth('2026-12');
      expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
      expect(nextMonth.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });

    it('throws on malformed input', () => {
      expect(() => AccountantExportService.parseMonth('2026-13')).toThrow();
      expect(() => AccountantExportService.parseMonth('not a month')).toThrow();
      expect(() => AccountantExportService.parseMonth('2026-1')).toThrow();
    });
  });

  describe('tvaBreakdown', () => {
    it('routes each line to its rate column', () => {
      const r = AccountantExportService.tvaBreakdown([
        { tvaRate: 7, tvaAmount: 7 },
        { tvaRate: 13, tvaAmount: 13 },
        { tvaRate: 19, tvaAmount: 19 },
      ]);
      expect(r.tva7).toBe(7);
      expect(r.tva13).toBe(13);
      expect(r.tva19).toBe(19);
      expect(r.totalTva).toBe(39);
    });

    it('aggregates multiple lines at the same rate', () => {
      const r = AccountantExportService.tvaBreakdown([
        { tvaRate: 19, tvaAmount: 5 },
        { tvaRate: 19, tvaAmount: 7 },
        { tvaRate: 19, tvaAmount: 3 },
      ]);
      expect(r.tva19).toBe(15);
      expect(r.totalTva).toBe(15);
    });

    it('ignores exempt (0) lines', () => {
      const r = AccountantExportService.tvaBreakdown([
        { tvaRate: 0, tvaAmount: 0 },
        { tvaRate: 19, tvaAmount: 19 },
      ]);
      expect(r.totalTva).toBe(19);
    });

    it('rounds to 3 decimals', () => {
      const r = AccountantExportService.tvaBreakdown([
        { tvaRate: 19, tvaAmount: 0.123456 },
        { tvaRate: 19, tvaAmount: 0.123456 },
      ]);
      expect(r.tva19).toBe(0.247);
    });
  });
});
