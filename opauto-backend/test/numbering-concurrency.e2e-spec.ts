import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NumberingService } from '../src/invoicing/numbering.service';

// Use an isolated test database — never touch the dev database
const TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/opauto_test';

/**
 * Concurrency test — proves NumberingService.next() is gapless under
 * concurrent load. Real Postgres + real Prisma; no mocking.
 *
 * The (garageId, kind, year) unique index forces upserts to serialize,
 * so 100 parallel calls must yield 1..100 with no duplicates and no gaps.
 */
describe('NumberingService (integration – concurrency)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: NumberingService;

  let garageId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;

    try {
      execSync('npx prisma db push --skip-generate', {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'pipe',
      });
    } catch {
      // db push may warn but still succeed
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    service = app.get(NumberingService);

    const garage = await prisma.garage.create({
      data: {
        name: 'Numbering Concurrency Garage',
        currency: 'TND',
        taxRate: 19,
        numberingPrefix: 'INV',
        numberingResetPolicy: 'YEARLY',
        numberingDigitCount: 4,
      },
    });
    garageId = garage.id;
  });

  afterAll(async () => {
    if (garageId) {
      // counters are cascaded by FK on garage delete
      await prisma.garage.delete({ where: { id: garageId } }).catch(() => {});
    }
    await app.close();
  });

  it('100 concurrent next(INVOICE) calls produce 100 unique gapless numbers', async () => {
    const N = 100;
    const calls = Array.from({ length: N }, () => service.next(garageId, 'INVOICE'));
    const results = await Promise.all(calls);

    // All 100 returned
    expect(results).toHaveLength(N);

    // All unique
    expect(new Set(results).size).toBe(N);

    // Extract sequence portion (the trailing zero-padded integer) and assert 1..N
    const seqs = results
      .map((s) => {
        const m = s.match(/-(\d+)$/);
        if (!m) throw new Error(`Unexpected number format: ${s}`);
        return parseInt(m[1], 10);
      })
      .sort((a, b) => a - b);

    expect(seqs).toEqual(Array.from({ length: N }, (_, i) => i + 1));

    // Counter row should reflect lastIssued = N for the current year
    const year = new Date().getFullYear();
    const counter = await prisma.invoiceCounter.findUnique({
      where: { garageId_kind_year: { garageId, kind: 'INVOICE', year } },
    });
    expect(counter).not.toBeNull();
    expect(counter!.lastIssued).toBe(N);
  }, 60_000);
});
