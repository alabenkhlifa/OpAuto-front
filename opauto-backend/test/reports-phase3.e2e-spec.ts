import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase 3 reporting endpoints — e2e coverage for:
 *   3.3 AR aging       (GET /reports/ar-aging, ?format=csv)
 *   3.4 Statement      (GET /reports/customer-statement)
 *   3.5 Z-report       (GET /reports/z-report?date=...)
 *   3.6 Accountant CSV (GET /reports/accountant-export?month=...)
 *
 * Fixtures: 3 customers spanning the AR-aging buckets, one fully paid
 * invoice for the statement happy path, a fixture day with one issued
 * invoice + one cash payment + one credit-note for the Z-report, and
 * the same data is reused for the accountant export header/row check.
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('Reports — Phase 3 endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let garageId: string;
  let cAlice: string;
  let cBob: string;
  let cCarla: string;

  // The generated `lockedAt` we stamp on issued invoices so the
  // accountant export and Z-report can deterministically pick them up.
  // Picked deliberately outside the AR-aging "today" window so that
  // the accountant-export month filter can isolate exactly ONE invoice
  // (TESTREP-INV-0010) in 2026-03. Today is 2026-04-30 per the system
  // clock — AR-aging invoices use `lockedAt: now` so they fall in
  // 2026-04, NOT in the export month.
  const FIXTURE_DAY = new Date('2026-03-15T10:00:00Z');
  const FIXTURE_MONTH = '2026-03';

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    try {
      execSync(
        `createdb -h localhost -U postgres opauto_test 2>/dev/null || true`,
        { env: { ...process.env, PGPASSWORD: 'postgres' } },
      );
      execSync('npx prisma db push --skip-generate', {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'pipe',
      });
    } catch {
      /* db push warnings non-fatal */
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations')
        LOOP
          EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
        END LOOP;
      END $$;
    `);

    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'owner@reports.tn',
        password: 'Owner1234!',
        firstName: 'Reportsy',
        lastName: 'Owner',
        garageName: 'Reports Garage',
      })
      .expect(201);
    token = reg.body.access_token;
    garageId = reg.body.user.garage.id;

    await prisma.garageModule.createMany({
      data: [
        { garageId, moduleId: 'invoicing' },
        { garageId, moduleId: 'reports' },
      ],
    });

    // ── Customers ────────────────────────────────────────────
    cAlice = (
      await prisma.customer.create({
        data: {
          garageId,
          firstName: 'Alice',
          lastName: 'A',
          phone: '+216-99-100-100',
          mfNumber: '1234567/A/B/001',
        },
      })
    ).id;
    cBob = (
      await prisma.customer.create({
        data: {
          garageId,
          firstName: 'Bob',
          lastName: 'B',
          phone: '+216-99-200-200',
        },
      })
    ).id;
    cCarla = (
      await prisma.customer.create({
        data: {
          garageId,
          firstName: 'Carla',
          lastName: 'C',
          phone: '+216-99-300-300',
        },
      })
    ).id;

    // ── AR-aging fixtures ────────────────────────────────────
    // We build the invoices via Prisma directly so we can set
    // dueDate / lockedAt explicitly (the controller would set them
    // to "now"). The endpoint cares only that status is in
    // (SENT, PARTIALLY_PAID, OVERDUE), so we set status=SENT.
    const today = new Date();
    const due = (offsetDays: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - offsetDays); // negative offsetDays = future
      d.setUTCHours(0, 0, 0, 0);
      return d;
    };

    // Alice → not-yet-due (current bucket): 200 TND, dueDate +20 days
    await prisma.invoice.create({
      data: {
        garageId,
        customerId: cAlice,
        invoiceNumber: 'TESTREP-INV-0001',
        status: 'SENT',
        subtotal: 200,
        taxAmount: 38,
        total: 200,
        dueDate: due(-20),
        lockedAt: new Date(),
      },
    });
    // Bob → 1-30 bucket: 150 TND, dueDate 15 days ago
    await prisma.invoice.create({
      data: {
        garageId,
        customerId: cBob,
        invoiceNumber: 'TESTREP-INV-0002',
        status: 'SENT',
        subtotal: 150,
        taxAmount: 0,
        total: 150,
        dueDate: due(15),
        lockedAt: new Date(),
      },
    });
    // Carla → 90+ bucket: 500 TND, dueDate 100 days ago
    await prisma.invoice.create({
      data: {
        garageId,
        customerId: cCarla,
        invoiceNumber: 'TESTREP-INV-0003',
        status: 'OVERDUE',
        subtotal: 500,
        taxAmount: 0,
        total: 500,
        dueDate: due(100),
        lockedAt: new Date(),
      },
    });

    // Fully paid invoice for Alice → should NOT show up in AR aging
    const paidInv = await prisma.invoice.create({
      data: {
        garageId,
        customerId: cAlice,
        invoiceNumber: 'TESTREP-INV-0004',
        status: 'PAID',
        subtotal: 100,
        taxAmount: 19,
        total: 120,
        dueDate: due(-5),
        paidAt: today,
        lockedAt: today,
      },
    });
    await prisma.payment.create({
      data: { invoiceId: paidInv.id, amount: 120, method: 'CASH', paidAt: today },
    });

    // ── Z-report / accountant fixtures ──────────────────────
    // Issued invoice on FIXTURE_DAY: Alice, total 230 (HT 200, TVA 19, stamp 1, kept simple)
    const zInv = await prisma.invoice.create({
      data: {
        garageId,
        customerId: cAlice,
        invoiceNumber: 'TESTREP-INV-0010',
        status: 'PAID',
        subtotal: 200,
        taxAmount: 38,
        fiscalStamp: 1,
        total: 239,
        dueDate: due(-10),
        lockedAt: FIXTURE_DAY,
        paidAt: FIXTURE_DAY,
        lineItems: {
          create: [
            {
              description: 'Service A',
              quantity: 1,
              unitPrice: 100,
              tvaRate: 19,
              tvaAmount: 19,
              total: 119,
            },
            {
              description: 'Service B',
              quantity: 1,
              unitPrice: 100,
              tvaRate: 19,
              tvaAmount: 19,
              total: 119,
            },
          ],
        },
      },
    });
    await prisma.payment.create({
      data: {
        invoiceId: zInv.id,
        amount: 239,
        method: 'CASH',
        paidAt: FIXTURE_DAY,
      },
    });
    // Credit note same day, no restock → counts toward netCash deduction
    await prisma.creditNote.create({
      data: {
        garageId,
        invoiceId: zInv.id,
        creditNoteNumber: 'TESTREP-AVO-0001',
        reason: 'Customer goodwill',
        status: 'ISSUED',
        subtotal: 50,
        taxAmount: 0,
        total: 50,
        restockParts: false,
        lockedAt: FIXTURE_DAY,
        createdAt: FIXTURE_DAY,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 3.3 AR aging ────────────────────────────────────────────

  it('GET /reports/ar-aging returns rows for each customer with outstanding balance', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/ar-aging')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.rows.length).toBe(3);

    const byName: Record<string, any> = Object.fromEntries(
      res.body.rows.map((r: any) => [r.customerName, r]),
    );
    expect(byName['Alice A'].current).toBeCloseTo(200, 3);
    expect(byName['Bob B'].b1_30).toBeCloseTo(150, 3);
    expect(byName['Carla C'].b90_plus).toBeCloseTo(500, 3);

    // Sort order: Carla (500) > Alice (200) > Bob (150)
    expect(res.body.rows[0].customerName).toBe('Carla C');
    expect(res.body.rows[1].customerName).toBe('Alice A');
    expect(res.body.rows[2].customerName).toBe('Bob B');

    // Totals tally
    expect(res.body.totals.total).toBeCloseTo(850, 3);
  });

  it('GET /reports/ar-aging?format=csv returns text/csv with proper header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/ar-aging?format=csv')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    const lines = (res.text as string).split('\n');
    expect(lines[0]).toBe(
      'customer_id,customer_name,current,1_30,31_60,61_90,90_plus,total',
    );
    expect(lines.length).toBe(4); // header + 3 rows
  });

  // ── 3.4 Customer statement ──────────────────────────────────

  it('GET /reports/customer-statement returns chronological events with running balance', async () => {
    const from = '2026-01-01';
    const to = '2026-12-31';
    const res = await request(app.getHttpServer())
      .get(
        `/api/reports/customer-statement?customerId=${cAlice}&from=${from}&to=${to}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.customer.id).toBe(cAlice);
    expect(res.body.from).toBe(from);
    expect(res.body.to).toBe(to);

    // Alice has: INV-0001 (200), INV-0004 (120) + payment (120),
    //            INV-0010 (239) + payment (239) + credit (50).
    // → 6 events (the 3 invoices + 2 payments + 1 credit note).
    // Closing balance:
    //    +200 (INV-0001) +120 (INV-0004) -120 (payment for 0004)
    //    +239 (INV-0010) -239 (payment for 0010) -50 (credit note)
    //  = 150 — Alice still owes the unpaid INV-0001 minus the credit
    //  applied against the over-paid INV-0010.
    expect(res.body.items.length).toBe(6);
    expect(res.body.closingBalance).toBeCloseTo(150, 3);
  });

  // ── 3.5 Z-report ────────────────────────────────────────────

  it('GET /reports/z-report?date=<fixtureDay> sums fixture day correctly', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/z-report?date=2026-03-15')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.date).toBe('2026-03-15');
    expect(res.body.invoicesIssued).toBe(1);
    expect(res.body.totalHT).toBeCloseTo(200, 3);
    expect(res.body.totalTVA).toBeCloseTo(38, 3);
    expect(res.body.totalTTC).toBeCloseTo(239, 3);
    expect(res.body.paymentsByMethod.CASH).toBeCloseTo(239, 3);
    expect(res.body.paymentsByMethod.CARD).toBe(0);
    expect(res.body.creditNotesIssued).toBe(1);
    expect(res.body.creditNotesTotal).toBeCloseTo(50, 3);
    // netCash = 239 (cash payments) - 50 (credit, no restock) = 189
    expect(res.body.netCash).toBeCloseTo(189, 3);
  });

  // ── 3.6 Accountant export ───────────────────────────────────

  it('GET /reports/accountant-export?month=2026-04 returns CSV with column count + totals', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/accountant-export?month=${FIXTURE_MONTH}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    const text = res.text as string;
    const lines = text.split('\n');
    expect(lines[0]).toBe(
      'date_issued,invoice_number,customer_name,customer_mf,ht_total,tva_7,tva_13,tva_19,tva_total,fiscal_stamp,ttc_total,payment_method,paid_date',
    );
    // Column count
    expect(lines[0].split(',').length).toBe(13);
    // 1 fixture invoice in March 2026 (TESTREP-INV-0010)
    expect(lines.length).toBe(2);
    const cols = lines[1].split(',');
    expect(cols[0]).toBe('2026-03-15');
    expect(cols[1]).toBe('TESTREP-INV-0010');
    expect(cols[2]).toBe('Alice A');
    expect(cols[3]).toBe('1234567/A/B/001');
    // ht_total = 200, tva_19 = 38, ttc_total = 239
    expect(parseFloat(cols[4])).toBeCloseTo(200, 3);
    expect(parseFloat(cols[7])).toBeCloseTo(38, 3);
    expect(parseFloat(cols[10])).toBeCloseTo(239, 3);
    expect(cols[11]).toBe('CASH');
    expect(cols[12]).toBe('2026-03-15');
  });

  it('GET /reports/accountant-export with malformed month → 400', async () => {
    await request(app.getHttpServer())
      .get('/api/reports/accountant-export?month=not-a-month')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
