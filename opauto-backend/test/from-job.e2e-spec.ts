import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration suite for Task 2.1 — POST /invoices/from-job/:jobId.
 *
 * Covers:
 *   - Happy path: job with parts (via StockMovement reason='job:<id>')
 *     + mechanic + actualHours → DRAFT with 3 line items, totals match
 *     TaxCalculator output, invoice.maintenanceJobId === jobId.
 *   - Re-conversion: second call → 409.
 *   - Empty job (no parts, no labor) → 400.
 *   - Cross-tenant: other-garage job → 404.
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('From-job invoice (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let garageId: string;
  let customerId: string;
  let carId: string;
  let employeeId: string;
  let part1Id: string;
  let part2Id: string;

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
        email: 'fromjob@opauto.tn',
        password: 'Test1234!',
        firstName: 'Job',
        lastName: 'Tester',
        garageName: 'FromJob Garage',
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
        firstName: 'Karim',
        lastName: 'Saidi',
        phone: '+216-99-200-200',
      },
    });
    customerId = customer.id;

    const car = await prisma.car.create({
      data: {
        garageId,
        customerId,
        make: 'Renault',
        model: 'Megane',
        year: 2020,
        licensePlate: '111 TUN 2222',
      },
    });
    carId = car.id;

    const employee = await prisma.employee.create({
      data: {
        garageId,
        firstName: 'Sami',
        lastName: 'Trabelsi',
        hireDate: new Date('2022-01-01'),
        hourlyRate: 30,
      },
    });
    employeeId = employee.id;

    const p1 = await prisma.part.create({
      data: {
        garageId,
        name: 'Brake pads',
        partNumber: 'BP-FJ-1',
        quantity: 100,
        unitPrice: 50,
        costPrice: 30,
      },
    });
    part1Id = p1.id;

    const p2 = await prisma.part.create({
      data: {
        garageId,
        name: 'Oil filter',
        partNumber: 'OF-FJ-1',
        quantity: 50,
        unitPrice: 12,
        costPrice: 6,
      },
    });
    part2Id = p2.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Helpers ─────────────────────────────────────────────────

  async function createJobWithUsage(): Promise<string> {
    const job = await prisma.maintenanceJob.create({
      data: {
        garageId,
        carId,
        employeeId,
        title: 'Brake service',
        actualHours: 2,
        status: 'COMPLETED',
      },
    });

    // Two stock-out events for part1 (collapse to qty 2) + one for part2.
    await prisma.stockMovement.createMany({
      data: [
        {
          partId: part1Id,
          type: 'out',
          quantity: 1,
          reason: `job:${job.id}`,
        },
        {
          partId: part1Id,
          type: 'out',
          quantity: 1,
          reason: `job:${job.id}`,
        },
        {
          partId: part2Id,
          type: 'out',
          quantity: 1,
          reason: `job:${job.id}`,
        },
      ],
    });

    return job.id;
  }

  // ── 1. Happy path ─────────────────────────────────────────

  it('POST /invoices/from-job/:jobId creates a DRAFT with parts + labor lines', async () => {
    const jobId = await createJobWithUsage();

    const res = await request(app.getHttpServer())
      .post(`/api/invoices/from-job/${jobId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ dueDate: '2026-06-30' })
      .expect(201);

    expect(res.body.status).toBe('DRAFT');
    expect(res.body.maintenanceJobId).toBe(jobId);
    expect(Array.isArray(res.body.lineItems)).toBe(true);
    expect(res.body.lineItems).toHaveLength(3);

    // Parts lines
    const partLines = res.body.lineItems.filter(
      (li: any) => li.type === 'part',
    );
    expect(partLines).toHaveLength(2);
    const brake = partLines.find((li: any) => li.partId === part1Id);
    const oil = partLines.find((li: any) => li.partId === part2Id);
    expect(brake.quantity).toBe(2);
    expect(brake.unitPrice).toBe(50);
    expect(oil.quantity).toBe(1);
    expect(oil.unitPrice).toBe(12);

    // Labor line
    const laborLine = res.body.lineItems.find(
      (li: any) => li.type === 'labor',
    );
    expect(laborLine).toBeDefined();
    expect(laborLine.mechanicId).toBe(employeeId);
    expect(laborLine.laborHours).toBe(2);
    expect(laborLine.unitPrice).toBe(30);
    expect(laborLine.quantity).toBe(2);

    // Totals: 100 (brake) + 12 (oil) + 60 (labor) = 172 HT * 1.19 + 1 stamp = 205.68
    expect(res.body.subtotal).toBeCloseTo(172, 3);
    expect(res.body.taxAmount).toBeCloseTo(32.68, 2);
    expect(res.body.fiscalStamp).toBe(1.0);
    expect(res.body.total).toBeCloseTo(205.68, 2);
  });

  // ── 2. Second call → 409 ──────────────────────────────────

  it('second POST /invoices/from-job/:jobId → 409', async () => {
    const jobId = await createJobWithUsage();

    await request(app.getHttpServer())
      .post(`/api/invoices/from-job/${jobId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/invoices/from-job/${jobId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(409);

    expect(res.body.message).toMatch(/already exists/i);
  });

  // ── 3. Empty job (no parts, no labor) → 400 ───────────────

  it('POST /invoices/from-job/:jobId with no billable items → 400', async () => {
    const job = await prisma.maintenanceJob.create({
      data: {
        garageId,
        carId,
        title: 'Diagnostic only',
        // No employee, no actualHours.
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/invoices/from-job/${job.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);

    expect(res.body.message).toMatch(/no billable items/i);
  });

  // ── 4. Cross-tenant 404 ───────────────────────────────────

  it('POST /invoices/from-job/:jobId for another garage → 404', async () => {
    const otherGarage = await prisma.garage.create({
      data: { name: 'Other FJ Garage', currency: 'TND', taxRate: 19 },
    });
    const otherCustomer = await prisma.customer.create({
      data: {
        garageId: otherGarage.id,
        firstName: 'Other',
        lastName: 'Cust',
        phone: '+216-99-300-300',
      },
    });
    const otherCar = await prisma.car.create({
      data: {
        garageId: otherGarage.id,
        customerId: otherCustomer.id,
        make: 'Toyota',
        model: 'Corolla',
        year: 2019,
        licensePlate: '999 TUN 9999',
      },
    });
    const otherJob = await prisma.maintenanceJob.create({
      data: {
        garageId: otherGarage.id,
        carId: otherCar.id,
        title: 'Stranger job',
        actualHours: 1,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/invoices/from-job/${otherJob.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(404);

    expect(res.body.message).toMatch(/not found/i);
  });
});
