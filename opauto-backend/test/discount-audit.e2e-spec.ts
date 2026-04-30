import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase 3.2 — discount audit trail.
 *
 * Threshold = `garage.discountAuditThresholdPct` (default 5). Crossing
 * the threshold demands `discountReason` + `discountApprovedBy`
 * (an OWNER userId of the same garage); a row in `discount_audit_logs`
 * is written per over-threshold discount (invoice-level + each line
 * with `discountPct > threshold`).
 *
 * Tests the failure path (missing fields → 400), the approver-role
 * check (STAFF id → 400), and the happy path (all required → 201,
 * exactly one audit row for invoice-level discount).
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('Invoicing — discount audit trail (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let staffToken: string;
  let ownerId: string;
  let staffId: string;
  let garageId: string;
  let customerId: string;

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

    const ownerReg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'owner@disc.tn',
        password: 'Owner1234!',
        firstName: 'Disc',
        lastName: 'Owner',
        garageName: 'Discount Garage',
      })
      .expect(201);
    ownerToken = ownerReg.body.access_token;
    ownerId = ownerReg.body.user.id;
    garageId = ownerReg.body.user.garage.id;

    await prisma.garageModule.create({
      data: { garageId, moduleId: 'invoicing' },
    });

    const staffPwd = await bcrypt.hash('Staff1234!', 10);
    const staffUser = await prisma.user.create({
      data: {
        garageId,
        email: 'staff@disc.tn',
        password: staffPwd,
        firstName: 'Stan',
        lastName: 'Staff',
        role: 'STAFF',
      },
    });
    staffId = staffUser.id;
    const staffLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'staff@disc.tn', password: 'Staff1234!' })
      .expect(201);
    staffToken = staffLogin.body.access_token;

    const customer = await prisma.customer.create({
      data: {
        garageId,
        firstName: 'Buyer',
        lastName: 'Big',
        phone: '+216-99-002-002',
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. Below-threshold discount → no audit row, 201 ─────────

  it('discount of 3% (below 5% default) → no DiscountAuditLog row', async () => {
    const before = await prisma.discountAuditLog.count();
    const res = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerId,
        dueDate: '2026-06-30',
        // subtotal HT = 100, 3 TND discount = 3% of 100, below threshold.
        discount: 3,
        lineItems: [
          { description: 'Tire rotation', quantity: 1, unitPrice: 100, type: 'service' },
        ],
      })
      .expect(201);
    expect(res.body.discount).toBeCloseTo(3, 3);

    const after = await prisma.discountAuditLog.count();
    expect(after).toBe(before);
  });

  // ── 2. Above-threshold without reason/approver → 400 ────────

  it('10% invoice discount as STAFF without approver → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerId,
        dueDate: '2026-06-30',
        discount: 10, // 10% of 100 = above 5
        lineItems: [
          { description: 'Battery check', quantity: 1, unitPrice: 100, type: 'service' },
        ],
      })
      .expect(400);
    expect(res.body.message).toMatch(/discount/i);
    expect(res.body.message).toMatch(/discountApprovedBy/);
  });

  // ── 3. Approver is STAFF, not OWNER → 400 ───────────────────

  it('above-threshold discount with STAFF approverId → 400', async () => {
    await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerId,
        dueDate: '2026-06-30',
        discount: 10,
        discountReason: 'Loyal customer',
        discountApprovedBy: staffId, // STAFF — not allowed
        lineItems: [
          { description: 'Coolant flush', quantity: 1, unitPrice: 100 },
        ],
      })
      .expect(400);
  });

  // ── 4. Above-threshold with OWNER approver → 201 + audit row ─

  it('10% discount with reason+ownerId → 201 and one audit row', async () => {
    const before = await prisma.discountAuditLog.count();
    const res = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerId,
        dueDate: '2026-06-30',
        discount: 10,
        discountReason: 'VIP customer end-of-year promo',
        discountApprovedBy: ownerId,
        lineItems: [
          { description: 'Suspension check', quantity: 1, unitPrice: 100 },
        ],
      })
      .expect(201);
    expect(res.body.discountReason).toBe('VIP customer end-of-year promo');
    expect(res.body.discountApprovedBy).toBe(ownerId);

    const logs = await prisma.discountAuditLog.findMany({
      where: { invoiceId: res.body.id },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].percentage).toBeCloseTo(10, 3);
    expect(logs[0].amount).toBeCloseTo(10, 3);
    expect(logs[0].approvedBy).toBe(ownerId);

    const after = await prisma.discountAuditLog.count();
    expect(after).toBe(before + 1);
  });

  // ── 5. Threshold respects garage configuration ──────────────

  it('garage threshold raised to 15 → 10% discount no longer needs approver', async () => {
    await prisma.garage.update({
      where: { id: garageId },
      data: { discountAuditThresholdPct: 15 },
    });

    await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerId,
        dueDate: '2026-06-30',
        discount: 10, // now below threshold
        lineItems: [
          { description: 'Cabin filter', quantity: 1, unitPrice: 100 },
        ],
      })
      .expect(201);

    // Restore default for any later test
    await prisma.garage.update({
      where: { id: garageId },
      data: { discountAuditThresholdPct: 5 },
    });
  });
});
