import { Injectable, NotFoundException } from '@nestjs/common';
import { CounterKind, NumberingResetPolicy } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * NumberingService — gapless atomic counter for fiscal documents.
 *
 * Issues sequential, non-reusable numbers for invoices, quotes, and credit
 * notes. Uses a unique-index-protected upsert inside a transaction so two
 * concurrent callers cannot read the same `lastIssued` value: Postgres
 * serializes upserts on the unique key `(garageId, kind, year)`.
 *
 * Format: `<PREFIX>[-<YEAR-SEGMENT>]-<PADDED_SEQ>`
 *   - INVOICE   → garage.numberingPrefix (default "INV")
 *   - QUOTE     → "DEV"
 *   - CREDIT_NOTE → "AVO"
 *
 * Year segment depends on garage.numberingResetPolicy:
 *   - NEVER   → omitted, counter row uses year=0
 *   - YEARLY  → "-YYYY", counter row uses year=YYYY
 *   - MONTHLY → "-YYYYMM", counter row uses year=YYYYMM (e.g. 202604)
 */
@Injectable()
export class NumberingService {
  constructor(private prisma: PrismaService) {}

  async next(garageId: string, kind: CounterKind): Promise<string> {
    const garage = await this.prisma.garage.findUnique({
      where: { id: garageId },
      select: {
        numberingPrefix: true,
        numberingResetPolicy: true,
        numberingDigitCount: true,
      },
    });
    if (!garage) {
      throw new NotFoundException(`Garage ${garageId} not found`);
    }

    const policy = garage.numberingResetPolicy;
    const year = this.computeYearKey(policy, new Date());

    // Atomic increment: a single upsert is serialized by Postgres on the
    // (garageId, kind, year) unique index — two concurrent transactions can
    // never observe the same lastIssued.
    const row = await this.prisma.$transaction(async (tx) => {
      return tx.invoiceCounter.upsert({
        where: { garageId_kind_year: { garageId, kind, year } },
        create: { garageId, kind, year, lastIssued: 1 },
        update: { lastIssued: { increment: 1 } },
        select: { lastIssued: true },
      });
    });

    return this.format({
      kind,
      prefix: garage.numberingPrefix ?? 'INV',
      policy,
      year,
      seq: row.lastIssued,
      digitCount: garage.numberingDigitCount,
    });
  }

  private computeYearKey(policy: NumberingResetPolicy, now: Date): number {
    switch (policy) {
      case 'NEVER':
        return 0;
      case 'YEARLY':
        return now.getFullYear();
      case 'MONTHLY':
        return now.getFullYear() * 100 + (now.getMonth() + 1);
    }
  }

  private format(args: {
    kind: CounterKind;
    prefix: string;
    policy: NumberingResetPolicy;
    year: number;
    seq: number;
    digitCount: number;
  }): string {
    const prefix = this.prefixFor(args.kind, args.prefix);
    const seq = String(args.seq).padStart(args.digitCount, '0');

    if (args.policy === 'NEVER') {
      return `${prefix}-${seq}`;
    }
    // YEARLY → year is YYYY (4 digits). MONTHLY → year is YYYYMM (6 digits).
    return `${prefix}-${args.year}-${seq}`;
  }

  private prefixFor(kind: CounterKind, garagePrefix: string): string {
    switch (kind) {
      case 'INVOICE':
        return garagePrefix || 'INV';
      case 'QUOTE':
        return 'DEV';
      case 'CREDIT_NOTE':
        return 'AVO';
    }
  }
}
