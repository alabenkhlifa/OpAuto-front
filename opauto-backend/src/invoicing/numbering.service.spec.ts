import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NumberingService } from './numbering.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Helpers ──────────────────────────────────────────────────────

const GARAGE_ID = 'garage-test-001';

interface GarageStub {
  numberingPrefix: string | null;
  numberingResetPolicy: 'NEVER' | 'YEARLY' | 'MONTHLY';
  numberingDigitCount: number;
}

/**
 * Builds a Prisma mock whose `$transaction(fn)` calls the callback with
 * `tx`, where `tx.invoiceCounter.upsert` returns a row with the given
 * `lastIssued`. Captures the upsert args for assertions.
 */
function buildPrismaMock(opts: {
  garage: GarageStub | null;
  lastIssued: number;
}) {
  const upsert = jest.fn().mockResolvedValue({ lastIssued: opts.lastIssued });
  const tx = { invoiceCounter: { upsert } };

  return {
    garage: { findUnique: jest.fn().mockResolvedValue(opts.garage) },
    $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    _upsert: upsert,
  };
}

async function buildService(prisma: any): Promise<NumberingService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NumberingService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get<NumberingService>(NumberingService);
}

// ── Tests ────────────────────────────────────────────────────────

describe('NumberingService', () => {
  // Freeze time so YEARLY/MONTHLY policies are deterministic.
  const FAKE_NOW = new Date('2026-04-15T12:00:00Z');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FAKE_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  // ── Format combinations: policy × kind × digit count ─────────────
  describe('format combinations', () => {
    type Case = {
      label: string;
      policy: 'NEVER' | 'YEARLY' | 'MONTHLY';
      kind: 'INVOICE' | 'QUOTE' | 'CREDIT_NOTE';
      prefix: string | null;
      digits: number;
      lastIssued: number;
      expected: string;
    };

    const cases: Case[] = [
      // YEARLY × kinds × digits
      { label: 'YEARLY/INV/4 → INV-2026-0001',         policy: 'YEARLY', kind: 'INVOICE',     prefix: 'INV', digits: 4, lastIssued: 1,    expected: 'INV-2026-0001' },
      { label: 'YEARLY/DEV/4 → DEV-2026-0001',         policy: 'YEARLY', kind: 'QUOTE',       prefix: 'INV', digits: 4, lastIssued: 1,    expected: 'DEV-2026-0001' },
      { label: 'YEARLY/AVO/4 → AVO-2026-0001',         policy: 'YEARLY', kind: 'CREDIT_NOTE', prefix: 'INV', digits: 4, lastIssued: 1,    expected: 'AVO-2026-0001' },
      { label: 'YEARLY/INV/3 → INV-2026-001',          policy: 'YEARLY', kind: 'INVOICE',     prefix: 'INV', digits: 3, lastIssued: 1,    expected: 'INV-2026-001' },
      { label: 'YEARLY/INV/6 → INV-2026-000001',       policy: 'YEARLY', kind: 'INVOICE',     prefix: 'INV', digits: 6, lastIssued: 1,    expected: 'INV-2026-000001' },

      // MONTHLY × kinds (April = 04 → 202604)
      { label: 'MONTHLY/INV/4 → INV-202604-0001',      policy: 'MONTHLY', kind: 'INVOICE',     prefix: 'INV', digits: 4, lastIssued: 1,   expected: 'INV-202604-0001' },
      { label: 'MONTHLY/DEV/4 → DEV-202604-0001',      policy: 'MONTHLY', kind: 'QUOTE',       prefix: 'INV', digits: 4, lastIssued: 1,   expected: 'DEV-202604-0001' },
      { label: 'MONTHLY/AVO/6 → AVO-202604-000001',    policy: 'MONTHLY', kind: 'CREDIT_NOTE', prefix: 'INV', digits: 6, lastIssued: 1,   expected: 'AVO-202604-000001' },

      // NEVER × kinds × digits (no year segment)
      { label: 'NEVER/INV/6 → INV-000001',             policy: 'NEVER', kind: 'INVOICE',     prefix: 'INV', digits: 6, lastIssued: 1,    expected: 'INV-000001' },
      { label: 'NEVER/DEV/4 → DEV-0001',               policy: 'NEVER', kind: 'QUOTE',       prefix: 'INV', digits: 4, lastIssued: 1,    expected: 'DEV-0001' },
      { label: 'NEVER/AVO/3 → AVO-001',                policy: 'NEVER', kind: 'CREDIT_NOTE', prefix: 'INV', digits: 3, lastIssued: 1,    expected: 'AVO-001' },

      // Custom invoice prefix is honored for INVOICE only
      { label: 'YEARLY/custom prefix → BIL-2026-0001', policy: 'YEARLY', kind: 'INVOICE',     prefix: 'BIL', digits: 4, lastIssued: 1,    expected: 'BIL-2026-0001' },
      { label: 'YEARLY/custom prefix ignored for QUOTE', policy: 'YEARLY', kind: 'QUOTE',     prefix: 'BIL', digits: 4, lastIssued: 1,    expected: 'DEV-2026-0001' },
    ];

    test.each(cases)('$label', async (c) => {
      const prisma = buildPrismaMock({
        garage: {
          numberingPrefix: c.prefix,
          numberingResetPolicy: c.policy,
          numberingDigitCount: c.digits,
        },
        lastIssued: c.lastIssued,
      });
      const service = await buildService(prisma);

      const out = await service.next(GARAGE_ID, c.kind);
      expect(out).toBe(c.expected);
    });
  });

  // ── Padding edges ──────────────────────────────────────────────
  describe('padding', () => {
    it('pads lastIssued=1 to 0001 with digits=4', async () => {
      const prisma = buildPrismaMock({
        garage: { numberingPrefix: 'INV', numberingResetPolicy: 'YEARLY', numberingDigitCount: 4 },
        lastIssued: 1,
      });
      const service = await buildService(prisma);

      expect(await service.next(GARAGE_ID, 'INVOICE')).toBe('INV-2026-0001');
    });

    it('renders lastIssued=9999 as 9999 with digits=4', async () => {
      const prisma = buildPrismaMock({
        garage: { numberingPrefix: 'INV', numberingResetPolicy: 'YEARLY', numberingDigitCount: 4 },
        lastIssued: 9999,
      });
      const service = await buildService(prisma);

      expect(await service.next(GARAGE_ID, 'INVOICE')).toBe('INV-2026-9999');
    });

    it('lets sequence overflow naturally past digit count (no throw)', async () => {
      const prisma = buildPrismaMock({
        garage: { numberingPrefix: 'INV', numberingResetPolicy: 'YEARLY', numberingDigitCount: 4 },
        lastIssued: 12345,
      });
      const service = await buildService(prisma);

      // padStart(4) on "12345" leaves it unchanged — overflow is allowed.
      expect(await service.next(GARAGE_ID, 'INVOICE')).toBe('INV-2026-12345');
    });
  });

  // ── Year key passed to upsert ──────────────────────────────────
  describe('upsert year key', () => {
    it('YEARLY → upserts with year=YYYY (creates new row when transitioning years)', async () => {
      const prisma = buildPrismaMock({
        garage: { numberingPrefix: 'INV', numberingResetPolicy: 'YEARLY', numberingDigitCount: 4 },
        lastIssued: 1,
      });
      const service = await buildService(prisma);

      await service.next(GARAGE_ID, 'INVOICE');

      expect(prisma._upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { garageId_kind_year: { garageId: GARAGE_ID, kind: 'INVOICE', year: 2026 } },
          create: { garageId: GARAGE_ID, kind: 'INVOICE', year: 2026, lastIssued: 1 },
          update: { lastIssued: { increment: 1 } },
        }),
      );
    });

    it('MONTHLY → upserts with year=YYYYMM', async () => {
      const prisma = buildPrismaMock({
        garage: { numberingPrefix: 'INV', numberingResetPolicy: 'MONTHLY', numberingDigitCount: 4 },
        lastIssued: 1,
      });
      const service = await buildService(prisma);

      await service.next(GARAGE_ID, 'INVOICE');

      expect(prisma._upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { garageId_kind_year: { garageId: GARAGE_ID, kind: 'INVOICE', year: 202604 } },
          create: { garageId: GARAGE_ID, kind: 'INVOICE', year: 202604, lastIssued: 1 },
        }),
      );
    });

    it('NEVER → upserts with year=0', async () => {
      const prisma = buildPrismaMock({
        garage: { numberingPrefix: 'INV', numberingResetPolicy: 'NEVER', numberingDigitCount: 4 },
        lastIssued: 1,
      });
      const service = await buildService(prisma);

      await service.next(GARAGE_ID, 'INVOICE');

      expect(prisma._upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { garageId_kind_year: { garageId: GARAGE_ID, kind: 'INVOICE', year: 0 } },
          create: { garageId: GARAGE_ID, kind: 'INVOICE', year: 0, lastIssued: 1 },
        }),
      );
    });

    it('runs the upsert inside a $transaction', async () => {
      const prisma = buildPrismaMock({
        garage: { numberingPrefix: 'INV', numberingResetPolicy: 'YEARLY', numberingDigitCount: 4 },
        lastIssued: 1,
      });
      const service = await buildService(prisma);

      await service.next(GARAGE_ID, 'INVOICE');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── Defaults & error paths ─────────────────────────────────────
  describe('defaults & errors', () => {
    it('defaults INVOICE prefix to "INV" when garage.numberingPrefix is null', async () => {
      const prisma = buildPrismaMock({
        garage: { numberingPrefix: null, numberingResetPolicy: 'YEARLY', numberingDigitCount: 4 },
        lastIssued: 1,
      });
      const service = await buildService(prisma);

      expect(await service.next(GARAGE_ID, 'INVOICE')).toBe('INV-2026-0001');
    });

    it('throws NotFoundException when the garage does not exist', async () => {
      const prisma = buildPrismaMock({ garage: null, lastIssued: 0 });
      const service = await buildService(prisma);

      await expect(service.next(GARAGE_ID, 'INVOICE')).rejects.toBeInstanceOf(NotFoundException);
      // Must not even start a transaction when the garage lookup fails.
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
