import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration suite for Task 1.6 — credit notes (avoirs).
 *
 * Covers the full POST /credit-notes lifecycle:
 *   - validation (DRAFT, foreign partId)
 *   - happy path with stock restore (creates StockMovement + Part.qty++)
 *   - happy path WITHOUT stock restore (Part.qty unchanged)
 *   - GET list + detail
 *   - cascade delete from Invoice → CreditNote
 *   - footgun: PAID invoice + over-credit keeps PAID, sets overCredited=true
 *
 * Uses isolated `opauto_test` DB.
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('Credit notes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let garageId: string;
  let customerId: string;
  let carId: string;
  let partId: string;

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
      // db push may warn but still succeed
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

    // Truncate all tables so other suites' leftovers can't pollute us.
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
        email: 'avoir@opauto.tn',
        password: 'Test1234!',
        firstName: 'Avoir',
        lastName: 'Tester',
        garageName: 'Avoir Garage',
      })
      .expect(201);

    accessToken = reg.body.access_token;
    garageId = reg.body.user.garage.id;

    await prisma.garageModule.create({
      data: { garageId, moduleId: 'invoicing' },
    });

    const customer = await prisma.customer.create({
      data: {
        garageId,
        firstName: 'Cred',
        lastName: 'Itable',
        phone: '+216-99-444-444',
      },
    });
    customerId = customer.id;

    const car = await prisma.car.create({
      data: {
        garageId,
        customerId,
        make: 'Renault',
        model: 'Clio',
        year: 2021,
        licensePlate: '987 TUN 6543',
      },
    });
    carId = car.id;

    // Part starts at 7 in stock — the spec assumes Phase 2.2 stock
    // decrement is NOT yet wired, so we manually represent the
    // post-issue state (10 starting - 3 sold = 7 remaining).
    const part = await prisma.part.create({
      data: {
        garageId,
        name: 'Brake pads (set)',
        partNumber: 'BP-001',
        quantity: 7,
        unitPrice: 50,
        costPrice: 30,
      },
    });
    partId = part.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Helpers ────────────────────────────────────────────────

  async function createPaidInvoice(): Promise<{
    id: string;
    total: number;
    invoiceNumber: string;
  }> {
    // Draft with one parts line + one labor line.
    const draft = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        carId,
        dueDate: '2026-06-30',
        lineItems: [
          {
            description: 'Brake pads (set)',
            quantity: 3,
            unitPrice: 50,
            type: 'part',
          },
          {
            description: 'Brake replacement labor',
            quantity: 1,
            unitPrice: 80,
            type: 'labor',
          },
        ],
      })
      .expect(201);

    // Patch partId onto the parts line directly — the existing
    // CreateLineItemDto doesn't expose partId, but the service-level
    // wiring of partId is part of Phase 2.2; for this suite we set it
    // via Prisma so the credit-note path can find a matching partId.
    const partsLine = draft.body.lineItems.find(
      (li: any) => li.type === 'part',
    );
    await prisma.invoiceLineItem.update({
      where: { id: partsLine.id },
      data: { partId },
    });

    const issued = await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/issue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: issued.body.total, method: 'CASH' })
      .expect(201);

    return {
      id: issued.body.id,
      total: issued.body.total,
      invoiceNumber: issued.body.invoiceNumber,
    };
  }

  // ── 1. Half-quantity credit note with stock restore ────────

  it('POST /credit-notes for one part (qty 1) with restockParts=true → 200, AVO number, lockedAt set, Part.qty incremented', async () => {
    const startingQty = (await prisma.part.findUnique({
      where: { id: partId },
    }))!.quantity;

    const invoice = await createPaidInvoice();

    const res = await request(app.getHttpServer())
      .post('/api/credit-notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        invoiceId: invoice.id,
        reason: 'One pad set returned defective',
        restockParts: true,
        lineItems: [
          {
            description: 'Brake pads (set) — 1 returned',
            quantity: 1,
            unitPrice: 50,
            tvaRate: 19,
            partId,
            type: 'part',
          },
        ],
      })
      .expect(201);

    expect(res.body.creditNoteNumber).toMatch(/^AVO-\d{4}-\d+$/);
    expect(res.body.lockedAt).not.toBeNull();
    expect(res.body.status).toBe('ISSUED');
    expect(res.body.restockParts).toBe(true);

    const part = await prisma.part.findUnique({ where: { id: partId } });
    expect(part!.quantity).toBe(startingQty + 1);

    // Source invoice still PAID since payments (full amount) >= effective due
    expect(res.body.sourceInvoiceStatus).toBe('PAID');
  });

  // ── 2. Second credit note for remaining qty 2 ──────────────

  it('second POST /credit-notes for qty 2 with restockParts=true → Part.quantity restored fully', async () => {
    const before = (await prisma.part.findUnique({
      where: { id: partId },
    }))!.quantity;

    const invoice = await createPaidInvoice();

    const res = await request(app.getHttpServer())
      .post('/api/credit-notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        invoiceId: invoice.id,
        reason: 'Both remaining pads returned',
        restockParts: true,
        lineItems: [
          {
            description: 'Brake pads (set) — 2 returned',
            quantity: 2,
            unitPrice: 50,
            tvaRate: 19,
            partId,
            type: 'part',
          },
        ],
      })
      .expect(201);

    const after = (await prisma.part.findUnique({ where: { id: partId } }))!
      .quantity;
    expect(after).toBe(before + 2);

    // Invoice was PAID with payments==total. Credit note worth 119 (2×50
    // HT + 19% TVA = 119) is less than total 269 (3×50 + 80 HT + TVA + stamp),
    // so paid >= effectiveDue still holds → invoice remains PAID.
    expect(res.body.sourceInvoiceStatus).toBe('PAID');
  });

  // ── 3. DRAFT invoice rejected ──────────────────────────────

  it('POST /credit-notes against a DRAFT invoice → 400 with descriptive message', async () => {
    const draft = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        carId,
        dueDate: '2026-06-30',
        lineItems: [
          {
            description: 'Filter',
            quantity: 1,
            unitPrice: 50,
            type: 'part',
          },
        ],
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/credit-notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        invoiceId: draft.body.id,
        reason: 'too early',
        lineItems: [
          {
            description: 'returned',
            quantity: 1,
            unitPrice: 50,
            tvaRate: 19,
          },
        ],
      })
      .expect(400);

    expect(res.body.message).toMatch(/DRAFT/i);
  });

  // ── 4. partId not on source → 400 ──────────────────────────

  it('POST /credit-notes with partId not on source → 400', async () => {
    const invoice = await createPaidInvoice();

    // Create a second, unrelated part — its id will not appear on the
    // source invoice's line items, so the credit-note service must reject.
    const stranger = await prisma.part.create({
      data: {
        garageId,
        name: 'Spark plug',
        quantity: 5,
        unitPrice: 10,
        costPrice: 5,
      },
    });

    try {
      const res = await request(app.getHttpServer())
        .post('/api/credit-notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          invoiceId: invoice.id,
          reason: 'foreign part',
          lineItems: [
            {
              description: 'Spark plug',
              quantity: 1,
              unitPrice: 10,
              tvaRate: 19,
              partId: stranger.id,
            },
          ],
        })
        .expect(400);

      expect(res.body.message).toMatch(/not on the source invoice/i);
    } finally {
      await prisma.part.delete({ where: { id: stranger.id } }).catch(() => {});
    }
  });

  // ── 5. restockParts=false → Part.quantity unchanged ────────

  it('POST /credit-notes with restockParts=false → 201, Part.quantity unchanged', async () => {
    const invoice = await createPaidInvoice();
    const before = (await prisma.part.findUnique({ where: { id: partId } }))!
      .quantity;

    const res = await request(app.getHttpServer())
      .post('/api/credit-notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        invoiceId: invoice.id,
        reason: 'goodwill discount, no return',
        restockParts: false,
        lineItems: [
          {
            description: 'discount',
            quantity: 1,
            unitPrice: 20,
            tvaRate: 19,
            partId,
          },
        ],
      })
      .expect(201);

    expect(res.body.restockParts).toBe(false);
    const after = (await prisma.part.findUnique({ where: { id: partId } }))!
      .quantity;
    expect(after).toBe(before);
  });

  // ── 6. GET /credit-notes lists in createdAt desc ───────────

  it('GET /credit-notes lists all credit notes for the garage in createdAt desc order', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/credit-notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    // Verify ordering: each createdAt >= the next one.
    for (let i = 0; i < res.body.length - 1; i++) {
      const a = new Date(res.body[i].createdAt).getTime();
      const b = new Date(res.body[i + 1].createdAt).getTime();
      expect(a).toBeGreaterThanOrEqual(b);
    }
  });

  // ── 7. GET /credit-notes/:id → line items + invoice info ───

  it('GET /credit-notes/:id returns line items + invoice basic info', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/credit-notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const targetId = list.body[0].id;
    const res = await request(app.getHttpServer())
      .get(`/api/credit-notes/${targetId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(targetId);
    expect(Array.isArray(res.body.lineItems)).toBe(true);
    expect(res.body.lineItems.length).toBeGreaterThan(0);
    expect(res.body.invoice).toBeDefined();
    expect(res.body.invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d+$/);
  });

  // ── 8. Cascade delete: invoice → credit notes ──────────────

  it('deleting the source invoice cascades to its credit notes', async () => {
    // Build an isolated invoice + credit note specifically so we don't
    // touch any of the existing fixtures.
    const draft = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        carId,
        dueDate: '2026-06-30',
        lineItems: [
          {
            description: 'Inspection',
            quantity: 1,
            unitPrice: 40,
            type: 'service',
          },
        ],
      })
      .expect(201);

    const issued = await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/issue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/invoices/${issued.body.id}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: issued.body.total, method: 'CASH' })
      .expect(201);

    const cnRes = await request(app.getHttpServer())
      .post('/api/credit-notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        invoiceId: issued.body.id,
        reason: 'cascade test',
        lineItems: [
          { description: 'refund', quantity: 1, unitPrice: 40, tvaRate: 19 },
        ],
      })
      .expect(201);

    const cnId = cnRes.body.id;
    expect(
      await prisma.creditNote.findUnique({ where: { id: cnId } }),
    ).not.toBeNull();

    // Bypass the service guard (locked invoices can't be deleted via
    // the API) and delete via Prisma to test the FK cascade purely.
    await prisma.invoice.delete({ where: { id: issued.body.id } });

    const after = await prisma.creditNote.findUnique({ where: { id: cnId } });
    expect(after).toBeNull();
  });

  // ── 9. Footgun: over-credit on PAID stays PAID ─────────────

  it('PAID invoice + credit note > unpaid balance → stays PAID with overCredited=true', async () => {
    // Build a PAID invoice with a well-known total, then issue a credit
    // note worth more than the unpaid balance (which is 0 here since
    // the invoice is PAID). Per spec: status must stay PAID and
    // overCredited must be true.
    const draft = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        carId,
        dueDate: '2026-06-30',
        lineItems: [
          {
            description: 'Service A',
            quantity: 1,
            unitPrice: 100,
            type: 'service',
          },
        ],
      })
      .expect(201);

    const issued = await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/issue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/invoices/${issued.body.id}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: issued.body.total, method: 'CASH' })
      .expect(201);

    const cnRes = await request(app.getHttpServer())
      .post('/api/credit-notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        invoiceId: issued.body.id,
        reason: 'over-credit footgun',
        lineItems: [
          {
            description: 'big refund',
            quantity: 1,
            unitPrice: 60,
            tvaRate: 19,
          },
        ],
      })
      .expect(201);

    expect(cnRes.body.sourceInvoiceStatus).toBe('PAID');
    expect(cnRes.body.overCredited).toBe(true);

    const inv = await prisma.invoice.findUnique({
      where: { id: issued.body.id },
    });
    expect(inv!.status).toBe('PAID');
  });
});
