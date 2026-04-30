import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration suite for Task 2.3 — quotes (devis).
 *
 * Covers:
 *   - POST /quotes → DRAFT with placeholder quoteNumber + computed totals
 *   - PUT /quotes/:id → editable while DRAFT
 *   - POST /quotes/:id/send → DRAFT → SENT, DEV number assigned
 *   - POST /quotes/:id/approve → creates a DRAFT invoice with same line
 *     items, both sides linked
 *   - POST /quotes/:id/reject → SENT → REJECTED
 *   - QuotesService.expireOldQuotes() flips overdue SENT to EXPIRED
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('Quotes (e2e)', () => {
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

    // Truncate
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
        email: 'devis@opauto.tn',
        password: 'Test1234!',
        firstName: 'Devis',
        lastName: 'Tester',
        garageName: 'Devis Garage',
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
        firstName: 'Yasmine',
        lastName: 'Fellah',
        phone: '+216-99-800-800',
      },
    });
    customerId = customer.id;

    const car = await prisma.car.create({
      data: {
        garageId,
        customerId,
        make: 'Hyundai',
        model: 'i10',
        year: 2021,
        licensePlate: '888 TUN 8888',
      },
    });
    carId = car.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. Create DRAFT ─────────────────────────────────────────

  it('POST /quotes creates a DRAFT with placeholder quoteNumber + computed totals', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/quotes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        carId,
        lineItems: [
          {
            description: 'Engine diagnostic',
            quantity: 1,
            unitPrice: 80,
            type: 'service',
          },
          {
            description: 'Battery',
            quantity: 1,
            unitPrice: 120,
            type: 'part',
          },
        ],
      })
      .expect(201);

    expect(res.body.status).toBe('DRAFT');
    expect(res.body.quoteNumber).toMatch(/^DRAFT-[a-f0-9]{8}$/);
    expect(res.body.subtotal).toBeCloseTo(200, 3);
    expect(res.body.taxAmount).toBeCloseTo(38, 3);
    // Quotes carry no fiscal stamp.
    expect(res.body.total).toBeCloseTo(238, 3);
    expect(Array.isArray(res.body.lineItems)).toBe(true);
    expect(res.body.lineItems).toHaveLength(2);
    // validUntil defaulted from garage.defaultPaymentTermsDays (30).
    expect(res.body.validUntil).toBeDefined();
  });

  // ── 2. Update DRAFT ─────────────────────────────────────────

  it('PUT /quotes/:id with notes is allowed while DRAFT', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/quotes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        lineItems: [
          { description: 'Service A', quantity: 1, unitPrice: 100 },
        ],
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .put(`/api/quotes/${created.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ notes: 'Customer agreed verbally' })
      .expect(200);

    expect(res.body.notes).toBe('Customer agreed verbally');
  });

  // ── 3. Send → SENT ──────────────────────────────────────────

  it('POST /quotes/:id/send transitions DRAFT to SENT and assigns DEV number', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/quotes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        lineItems: [
          { description: 'Service A', quantity: 1, unitPrice: 100 },
        ],
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/quotes/${created.body.id}/send`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(res.body.status).toBe('SENT');
    expect(res.body.quoteNumber).toMatch(/^DEV-\d{4}-\d+$/);
  });

  // ── 4. Approve → creates DRAFT invoice ─────────────────────

  it('POST /quotes/:id/approve creates a DRAFT invoice with same line items', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/quotes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        carId,
        lineItems: [
          { description: 'Brake check', quantity: 1, unitPrice: 50 },
          { description: 'Brake pads', quantity: 2, unitPrice: 60, type: 'part' },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/quotes/${created.body.id}/send`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/quotes/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(res.body.quote.status).toBe('APPROVED');
    expect(res.body.invoice.status).toBe('DRAFT');
    expect(res.body.invoice.quoteId).toBeDefined();
    expect(res.body.quote.convertedToInvoiceId).toBe(res.body.invoice.id);

    // Line items mirror the quote's two lines.
    expect(res.body.invoice.lineItems).toHaveLength(2);
    const descriptions = res.body.invoice.lineItems.map((li: any) => li.description);
    expect(descriptions).toEqual(
      expect.arrayContaining(['Brake check', 'Brake pads']),
    );
  });

  // ── 5. Reject → REJECTED ────────────────────────────────────

  it('POST /quotes/:id/reject transitions SENT to REJECTED', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/quotes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        lineItems: [{ description: 'X', quantity: 1, unitPrice: 10 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/quotes/${created.body.id}/send`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/quotes/${created.body.id}/reject`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(res.body.status).toBe('REJECTED');
  });

  // ── 6. expireOldQuotes flips overdue SENT to EXPIRED ───────

  it('QuotesService.expireOldQuotes flips SENT quotes past validUntil to EXPIRED', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/quotes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        validUntil: '2024-01-01',
        lineItems: [{ description: 'Y', quantity: 1, unitPrice: 5 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/quotes/${created.body.id}/send`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    // Now run the expiration sweep — bypass HTTP, call the service.
    const { QuotesService } = await import('../src/invoicing/quotes.service');
    const svc = app.get<typeof QuotesService.prototype>(QuotesService);
    const out = await svc.expireOldQuotes(new Date());
    expect(out.expired).toBeGreaterThanOrEqual(1);

    const after = await prisma.quote.findUnique({
      where: { id: created.body.id },
    });
    expect(after!.status).toBe('EXPIRED');
  });
});
