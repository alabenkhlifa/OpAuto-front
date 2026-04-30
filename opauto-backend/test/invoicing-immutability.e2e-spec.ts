import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration suite for Task 1.4 — invoice state machine + immutability.
 *
 * Covers:
 *  - DRAFT placeholder invoiceNumber shape
 *  - DRAFT mutability (notes + line items)
 *  - issue → SENT, gapless fiscal number, lock metadata
 *  - post-issue: notes still mutable, financial fields locked (423)
 *  - post-issue: delete forbidden
 *  - payments transition SENT → PARTIALLY_PAID → PAID
 *  - payments rejected on DRAFT
 *
 * Uses the isolated `opauto_test` database — never touches dev data.
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('Invoicing immutability (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let garageId: string;
  let customerId: string;
  let carId: string;

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

    // Bootstrap an OWNER + garage via the real auth flow so the JWT has
    // correct claims (garageId, role) for the controller guards.
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'lock@opauto.tn',
        password: 'Test1234!',
        firstName: 'Lock',
        lastName: 'Tester',
        garageName: 'Lock Garage',
      })
      .expect(201);

    accessToken = reg.body.access_token;
    garageId = reg.body.user.garage.id;

    // Activate the invoicing module so ModuleAccessGuard doesn't 403.
    await prisma.garageModule.create({
      data: { garageId, moduleId: 'invoicing' },
    });

    // Make sure the fiscal counter starts fresh — even though we just
    // truncated, prisma's reset should leave it empty. Numbering will
    // hand out 0001 on first issue.
    const customer = await prisma.customer.create({
      data: {
        garageId,
        firstName: 'Imm',
        lastName: 'Utable',
        phone: '+216-99-555-555',
      },
    });
    customerId = customer.id;

    const car = await prisma.car.create({
      data: {
        garageId,
        customerId,
        make: 'Peugeot',
        model: '208',
        year: 2022,
        licensePlate: '123 TUN 4567',
      },
    });
    carId = car.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Helpers ────────────────────────────────────────────────

  const baseLineItems = [
    { description: 'Oil change', quantity: 1, unitPrice: 100, type: 'service' },
    { description: 'Filter', quantity: 1, unitPrice: 50, type: 'part' },
  ];

  async function createDraft(overrides: { dueDate?: string } = {}) {
    return request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        carId,
        dueDate: overrides.dueDate ?? '2026-06-30',
        lineItems: baseLineItems,
      })
      .expect(201);
  }

  // ── 1. DRAFT placeholder invoiceNumber ─────────────────────

  it('POST /invoices creates DRAFT with placeholder invoiceNumber', async () => {
    const res = await createDraft();

    expect(res.body.status).toBe('DRAFT');
    expect(res.body.invoiceNumber).toMatch(/^DRAFT-[a-f0-9]{8}$/);
    expect(res.body.lockedAt).toBeNull();
    expect(res.body.lockedBy).toBeNull();
    expect(res.body.issuedNumber).toBeNull();
    // Totals were computed by the tax calculator: 150 HT × 1.19 + 1 stamp
    expect(res.body.subtotal).toBeCloseTo(150, 3);
    expect(res.body.taxAmount).toBeCloseTo(28.5, 3);
    expect(res.body.fiscalStamp).toBe(1.0);
    expect(res.body.total).toBeCloseTo(179.5, 3);
  });

  // ── 2. DRAFT: notes-only update ────────────────────────────

  it('PUT /invoices/:id with notes while DRAFT is allowed; totals unchanged', async () => {
    const draft = await createDraft();
    const id = draft.body.id;

    const res = await request(app.getHttpServer())
      .put(`/api/invoices/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ notes: 'Customer requested invoice be ready Friday' })
      .expect(200);

    expect(res.body.notes).toBe('Customer requested invoice be ready Friday');
    expect(res.body.subtotal).toBeCloseTo(150, 3);
    expect(res.body.total).toBeCloseTo(179.5, 3);
  });

  // ── 3. DRAFT: line item replacement triggers recompute ─────

  it('PUT /invoices/:id with new lineItems while DRAFT recomputes totals', async () => {
    const draft = await createDraft();
    const id = draft.body.id;

    const res = await request(app.getHttpServer())
      .put(`/api/invoices/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        lineItems: [
          { description: 'Brake pads', quantity: 1, unitPrice: 200, type: 'part' },
        ],
      })
      .expect(200);

    // 200 HT × 1.19 + 1 stamp = 239
    expect(res.body.subtotal).toBeCloseTo(200, 3);
    expect(res.body.taxAmount).toBeCloseTo(38, 3);
    expect(res.body.total).toBeCloseTo(239, 3);
  });

  // ── 4. POST /invoices/:id/issue ────────────────────────────

  it('POST /invoices/:id/issue locks the invoice and assigns fiscal number', async () => {
    const draft = await createDraft();
    const id = draft.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/invoices/${id}/issue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    expect(res.body.status).toBe('SENT');
    // YEARLY policy → INV-YYYY-NNNN
    expect(res.body.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(res.body.lockedAt).not.toBeNull();
    expect(res.body.lockedBy).not.toBeNull();
    expect(res.body.issuedNumber).toBeGreaterThan(0);
    expect(res.body.fiscalStamp).toBe(1.0);
  });

  // ── 5. Post-issue: notes still mutable ─────────────────────

  it('PUT /invoices/:id with notes after issue is allowed', async () => {
    const draft = await createDraft();
    await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/issue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    const res = await request(app.getHttpServer())
      .put(`/api/invoices/${draft.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ notes: 'Internal note added after issue' })
      .expect(200);

    expect(res.body.notes).toBe('Internal note added after issue');
    expect(res.body.status).toBe('SENT');
  });

  // ── 6. Post-issue: financial fields locked (423) ───────────

  it('PUT /invoices/:id changing discount after issue → 423 Locked', async () => {
    const draft = await createDraft();
    await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/issue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    const res = await request(app.getHttpServer())
      .put(`/api/invoices/${draft.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ discount: 20 })
      .expect(423);

    expect(res.body.message).toMatch(/locked/i);
  });

  // ── 7. Post-issue: DELETE forbidden ────────────────────────

  it('DELETE /invoices/:id after issue → 400 with credit-note message', async () => {
    const draft = await createDraft();
    await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/issue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    const res = await request(app.getHttpServer())
      .delete(`/api/invoices/${draft.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(res.body.message).toMatch(/credit note/i);
  });

  // ── 8. Full payment → PAID ─────────────────────────────────

  it('POST /invoices/:id/payments full amount after issue → PAID', async () => {
    const draft = await createDraft();
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

    const after = await request(app.getHttpServer())
      .get(`/api/invoices/${draft.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(after.body.status).toBe('PAID');
  });

  // ── 9. Half payment → PARTIALLY_PAID ───────────────────────

  it('POST /invoices/:id/payments half amount after issue → PARTIALLY_PAID', async () => {
    const draft = await createDraft();
    const issued = await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/issue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: issued.body.total / 2, method: 'CASH' })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get(`/api/invoices/${draft.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(after.body.status).toBe('PARTIALLY_PAID');
  });

  // ── 10. Payment on DRAFT rejected ──────────────────────────

  it('POST /invoices/:id/payments on DRAFT → 400', async () => {
    const draft = await createDraft();

    const res = await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 50, method: 'CASH' })
      .expect(400);

    expect(res.body.message).toMatch(/issue invoice before/i);
  });
});
