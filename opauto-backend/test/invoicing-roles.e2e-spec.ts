import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase 3.1 — multi-role unlock for invoicing.
 *
 * Validates that the `@Roles` overrides on InvoicingController,
 * QuotesController, CreditNotesController, and PaymentsController
 * let STAFF perform routine invoicing work while keeping DELETE
 * restricted to OWNERs.
 *
 * The repo's UserRole enum is `OWNER | STAFF` — the original plan
 * mentioned MECHANIC, which doesn't exist in this schema. STAFF is
 * the closest non-OWNER role and is the one we authorise.
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('Invoicing — multi-role access (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let staffToken: string;
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
      // db push warnings are non-fatal
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

    // Wipe DB so prior suites' rows can't muddy role checks.
    await prisma.$executeRawUnsafe(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations')
        LOOP
          EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
        END LOOP;
      END $$;
    `);

    // Register OWNER (auth.service auto-assigns OWNER on register).
    const ownerReg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'owner@roles.tn',
        password: 'Owner1234!',
        firstName: 'Olive',
        lastName: 'Owner',
        garageName: 'Roles Garage',
      })
      .expect(201);
    ownerToken = ownerReg.body.access_token;
    garageId = ownerReg.body.user.garage.id;

    await prisma.garageModule.create({
      data: { garageId, moduleId: 'invoicing' },
    });

    // Create STAFF via direct DB write — auth.service.register only
    // makes OWNERs. We then use /api/auth/login to mint a real JWT
    // with role=STAFF.
    const staffPwd = await bcrypt.hash('Staff1234!', 10);
    await prisma.user.create({
      data: {
        garageId,
        email: 'staff@roles.tn',
        password: staffPwd,
        firstName: 'Stan',
        lastName: 'Staff',
        role: 'STAFF',
      },
    });
    const staffLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'staff@roles.tn', password: 'Staff1234!' })
      .expect(201);
    staffToken = staffLogin.body.access_token;

    const customer = await prisma.customer.create({
      data: { garageId, firstName: 'Ru', lastName: 'Le', phone: '+216-99-001-001' },
    });
    customerId = customer.id;
    const car = await prisma.car.create({
      data: {
        garageId,
        customerId,
        make: 'Peugeot',
        model: '208',
        year: 2024,
        licensePlate: '111 TUN 1111',
      },
    });
    carId = car.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. STAFF can list/read/create invoices ──────────────────

  it('STAFF can GET /invoices (list)', async () => {
    await request(app.getHttpServer())
      .get('/api/invoices')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
  });

  it('STAFF can POST /invoices (create draft)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerId,
        carId,
        dueDate: '2026-06-30',
        lineItems: [
          { description: 'Oil change', quantity: 1, unitPrice: 50, type: 'service' },
        ],
      })
      .expect(201);
    expect(res.body.invoiceNumber).toMatch(/^DRAFT-/);
    expect(res.body.status).toBe('DRAFT');
  });

  // ── 2. STAFF can record a payment ───────────────────────────

  it('STAFF can POST /invoices/:id/payments after issue', async () => {
    // OWNER creates + issues, then STAFF records the cash payment.
    const draft = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        customerId,
        carId,
        dueDate: '2026-06-30',
        lineItems: [
          { description: 'Brake check', quantity: 1, unitPrice: 100, type: 'service' },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/issue`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({})
      .expect(201);

    const payRes = await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/payments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ amount: 50, method: 'CASH' })
      .expect(201);
    expect(payRes.body.amount).toBe(50);
  });

  // ── 3. STAFF cannot DELETE invoices ─────────────────────────

  it('STAFF cannot DELETE /invoices/:id (403)', async () => {
    const draft = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        customerId,
        carId,
        dueDate: '2026-06-30',
        lineItems: [
          { description: 'Lights inspection', quantity: 1, unitPrice: 30 },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/invoices/${draft.body.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);
  });

  // ── 4. OWNER can DELETE the draft they made ─────────────────

  it('OWNER can DELETE /invoices/:id for a DRAFT invoice', async () => {
    const draft = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        customerId,
        carId,
        dueDate: '2026-06-30',
        lineItems: [{ description: 'Wheel balance', quantity: 1, unitPrice: 25 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/invoices/${draft.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });

  // ── 5. STAFF can read & create quotes ───────────────────────

  it('STAFF can GET /quotes and POST /quotes', async () => {
    await request(app.getHttpServer())
      .get('/api/quotes')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/quotes')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerId,
        carId,
        validUntil: '2026-06-30',
        lineItems: [{ description: 'Estimate', quantity: 1, unitPrice: 200 }],
      })
      .expect(201);
  });

  // ── 6. STAFF can read & create credit notes ─────────────────

  it('STAFF can GET /credit-notes', async () => {
    await request(app.getHttpServer())
      .get('/api/credit-notes')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
  });
});
