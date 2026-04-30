import { BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import {
  ALLOWED_TRANSITIONS,
  assertCanTransition,
  canTransition,
  isLocked,
} from './invoice-state';

/**
 * Table-driven coverage of the invoice state machine. The goal is to
 * guarantee EVERY (from, to) pair behaves the same way the spec says,
 * not just the happy paths — including the disallowed ones, which are
 * what protect fiscal integrity.
 */
describe('invoice-state', () => {
  const ALL_STATES: InvoiceStatus[] = [
    'DRAFT',
    'SENT',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
    'CANCELLED',
  ];

  describe('canTransition', () => {
    // Build a list of every state pair and what canTransition should
    // return. `same → same` is allowed (idempotent). Everything else
    // looks at ALLOWED_TRANSITIONS.
    const cases: Array<[InvoiceStatus, InvoiceStatus, boolean]> = [];
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        const expected =
          from === to || (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
        cases.push([from, to, expected]);
      }
    }

    it.each(cases)('canTransition(%s → %s) === %s', (from, to, expected) => {
      expect(canTransition(from, to)).toBe(expected);
    });

    // ── Spot-check the rules called out in the spec ──

    it('allows DRAFT → SENT', () => {
      expect(canTransition('DRAFT', 'SENT')).toBe(true);
    });

    it('allows DRAFT → CANCELLED', () => {
      expect(canTransition('DRAFT', 'CANCELLED')).toBe(true);
    });

    it('allows SENT → PARTIALLY_PAID', () => {
      expect(canTransition('SENT', 'PARTIALLY_PAID')).toBe(true);
    });

    it('allows SENT → PAID', () => {
      expect(canTransition('SENT', 'PAID')).toBe(true);
    });

    it('allows PARTIALLY_PAID → PAID', () => {
      expect(canTransition('PARTIALLY_PAID', 'PAID')).toBe(true);
    });

    it('forbids PARTIALLY_PAID → SENT (no going back)', () => {
      expect(canTransition('PARTIALLY_PAID', 'SENT')).toBe(false);
    });

    it('forbids PAID → SENT (terminal)', () => {
      expect(canTransition('PAID', 'SENT')).toBe(false);
    });

    it('forbids PAID → DRAFT (no un-issuing)', () => {
      expect(canTransition('PAID', 'DRAFT')).toBe(false);
    });

    it('forbids CANCELLED → anything else', () => {
      for (const to of ALL_STATES) {
        if (to === 'CANCELLED') continue;
        expect(canTransition('CANCELLED', to)).toBe(false);
      }
    });

    it('forbids SENT → DRAFT (no un-issuing)', () => {
      expect(canTransition('SENT', 'DRAFT')).toBe(false);
    });
  });

  describe('assertCanTransition', () => {
    it('does not throw for an allowed transition', () => {
      expect(() => assertCanTransition('DRAFT', 'SENT')).not.toThrow();
    });

    it('does not throw on idempotent same-state', () => {
      expect(() => assertCanTransition('PAID', 'PAID')).not.toThrow();
    });

    it('throws BadRequestException for a disallowed transition', () => {
      expect(() => assertCanTransition('PAID', 'DRAFT')).toThrow(
        BadRequestException,
      );
    });

    it('throws with a descriptive message naming from and to', () => {
      try {
        assertCanTransition('PAID', 'DRAFT');
        fail('expected throw');
      } catch (e) {
        expect((e as Error).message).toContain('PAID');
        expect((e as Error).message).toContain('DRAFT');
      }
    });
  });

  describe('isLocked', () => {
    it('returns false for DRAFT', () => {
      expect(isLocked('DRAFT')).toBe(false);
    });

    it.each<InvoiceStatus>([
      'SENT',
      'PARTIALLY_PAID',
      'PAID',
      'OVERDUE',
      'CANCELLED',
    ])('returns true for %s', (s) => {
      expect(isLocked(s)).toBe(true);
    });
  });
});
