import { ArAgingService } from './ar-aging.service';

describe('ArAgingService — bucketing math (unit)', () => {
  describe('bucketFor', () => {
    it('not yet due → current', () => {
      expect(ArAgingService.bucketFor(-5)).toBe('current');
      expect(ArAgingService.bucketFor(0)).toBe('current');
    });

    it('1-30 days', () => {
      expect(ArAgingService.bucketFor(1)).toBe('b1_30');
      expect(ArAgingService.bucketFor(15)).toBe('b1_30');
      expect(ArAgingService.bucketFor(30)).toBe('b1_30');
    });

    it('31-60 days', () => {
      expect(ArAgingService.bucketFor(31)).toBe('b31_60');
      expect(ArAgingService.bucketFor(60)).toBe('b31_60');
    });

    it('61-90 days', () => {
      expect(ArAgingService.bucketFor(61)).toBe('b61_90');
      expect(ArAgingService.bucketFor(90)).toBe('b61_90');
    });

    it('91+ days', () => {
      expect(ArAgingService.bucketFor(91)).toBe('b90_plus');
      expect(ArAgingService.bucketFor(365)).toBe('b90_plus');
    });
  });

  describe('daysOverdue', () => {
    it('returns 0 for null due date', () => {
      expect(ArAgingService.daysOverdue(null, new Date('2026-04-30'))).toBe(0);
    });

    it('positive when invoice is past due', () => {
      const due = new Date('2026-04-15T00:00:00Z');
      const today = new Date('2026-04-30T00:00:00Z');
      expect(ArAgingService.daysOverdue(due, today)).toBe(15);
    });

    it('negative when invoice is not yet due', () => {
      const due = new Date('2026-05-15T00:00:00Z');
      const today = new Date('2026-04-30T00:00:00Z');
      expect(ArAgingService.daysOverdue(due, today)).toBe(-15);
    });

    it('handles same-day exactly (0 = current)', () => {
      const due = new Date('2026-04-30T00:00:00Z');
      const today = new Date('2026-04-30T00:00:00Z');
      expect(ArAgingService.daysOverdue(due, today)).toBe(0);
    });

    it('ignores time-of-day — 23:59 same day still 0', () => {
      const due = new Date('2026-04-30T00:00:00Z');
      const today = new Date('2026-04-30T23:59:59Z');
      expect(ArAgingService.daysOverdue(due, today)).toBe(0);
    });
  });
});

describe('ArAgingService.toCsv (unit)', () => {
  it('escapes commas and quotes in customer names', () => {
    const svc = new ArAgingService({} as any);
    const csv = svc.toCsv({
      asOf: '2026-04-30',
      totals: {
        current: 0,
        b1_30: 0,
        b31_60: 0,
        b61_90: 0,
        b90_plus: 0,
        total: 0,
      },
      rows: [
        {
          customerId: 'c1',
          customerName: 'Smith, John "JJ"',
          current: 100,
          b1_30: 0,
          b31_60: 0,
          b61_90: 0,
          b90_plus: 0,
          total: 100,
        },
      ],
    });
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'customer_id,customer_name,current,1_30,31_60,61_90,90_plus,total',
    );
    expect(lines[1]).toContain('"Smith, John ""JJ"""');
    expect(lines[1]).toContain('100.000');
  });
});
