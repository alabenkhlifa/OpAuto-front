import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration suite for Task 2.2 — inventory ↔ invoice wiring.
 *
 * Covers:
 *   - Issue invoice with parts → Part.quantity decrements + StockMovement
 *     row(s) with type='out' and reason='invoice:<number>'.
 *   - Issue invoice when stock insufficient → 400 with shortage list,
 *     invoice stays DRAFT, no StockMovement row, no fiscal counter
 *     consumed.
 *   - Credit note with restockParts=true → stock restored.
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('Inventory on issue (e2e)', () => {
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
        email: 'invinv@opauto.tn',
        password: 'Test1234!',
        firstName: 'InvInv',
        lastName: 'Tester',
        garageName: 'Inv-Inv Garage',
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
        firstName: 'Sarra',
        lastName: 'Khaldi',
        phone: '+216-99-700-700',
      },
    });
    customerId = customer.id;

    const car = await prisma.car.create({
      data: {
        garageId,
        customerId,
        make: 'Citroen',
        model: 'C3',
        year: 2018,
        licensePlate: '555 TUN 5555',
      },
    });
    carId = car.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. Issue with parts → stock decremented + StockMovement ─

  it('issuing an invoice with a parts line decrements Part.quantity and writes a StockMovement(type=out)', async () => {
    const part = await prisma.part.create({
      data: {
        garageId,
        name: 'Air filter',
        partNumber: 'AF-INV-1',
        quantity: 10,
        unitPrice: 25,
        costPrice: 10,
      },
    });

    const draft = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        carId,
        dueDate: '2026-06-30',
        lineItems: [
          {
            description: 'Air filter',
            quantity: 4,
            unitPrice: 25,
            type: 'part',
          },
        ],
      })
      .expect(201);

    // Patch partId on the line — the public DTO doesn't expose partId yet.
    await prisma.invoiceLineItem.update({
      where: { id: draft.body.lineItems[0].id },
      data: { partId: part.id },
    });

    const issued = await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/issue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    const after = await prisma.part.findUnique({ where: { id: part.id } });
    expect(after!.quantity).toBe(6); // 10 - 4

    const movements = await prisma.stockMovement.findMany({
      where: { partId: part.id },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('out');
    expect(movements[0].quantity).toBe(4);
    expect(movements[0].reason).toBe(`invoice:${issued.body.invoiceNumber}`);
    expect(movements[0].reference).toBe(issued.body.id);
  });

  // ── 2. Insufficient stock → 400, no state change ─────────────

  it('issuing with insufficient stock → 400 with shortage list, invoice stays DRAFT, no StockMovement', async () => {
    const part = await prisma.part.create({
      data: {
        garageId,
        name: 'Shock absorber',
        partNumber: 'SA-INV-1',
        quantity: 1,
        unitPrice: 200,
        costPrice: 100,
      },
    });

    const draft = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        carId,
        dueDate: '2026-06-30',
        lineItems: [
          {
            description: 'Shock absorber',
            quantity: 3, // > stock of 1
            unitPrice: 200,
            type: 'part',
          },
        ],
      })
      .expect(201);

    await prisma.invoiceLineItem.update({
      where: { id: draft.body.lineItems[0].id },
      data: { partId: part.id },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/issue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);

    expect(res.body.message).toMatch(/insufficient stock/i);
    expect(res.body.shortages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          partId: part.id,
          partName: 'Shock absorber',
          requested: 3,
          available: 1,
        }),
      ]),
    );

    // Part untouched
    const after = await prisma.part.findUnique({ where: { id: part.id } });
    expect(after!.quantity).toBe(1);

    // Invoice still DRAFT
    const invAfter = await prisma.invoice.findUnique({
      where: { id: draft.body.id },
    });
    expect(invAfter!.status).toBe('DRAFT');
    expect(invAfter!.invoiceNumber).toMatch(/^DRAFT-/);

    // No stock movement
    const movements = await prisma.stockMovement.findMany({
      where: { partId: part.id },
    });
    expect(movements).toHaveLength(0);
  });

  // ── 3. Credit note with restockParts=true → stock restored ──

  it('credit note with restockParts=true restores Part.quantity', async () => {
    const part = await prisma.part.create({
      data: {
        garageId,
        name: 'Wiper blade',
        partNumber: 'WB-INV-1',
        quantity: 20,
        unitPrice: 15,
        costPrice: 7,
      },
    });

    const draft = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        customerId,
        carId,
        dueDate: '2026-06-30',
        lineItems: [
          {
            description: 'Wiper blade',
            quantity: 5,
            unitPrice: 15,
            type: 'part',
          },
        ],
      })
      .expect(201);

    await prisma.invoiceLineItem.update({
      where: { id: draft.body.lineItems[0].id },
      data: { partId: part.id },
    });

    const issued = await request(app.getHttpServer())
      .post(`/api/invoices/${draft.body.id}/issue`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    // After issue → 15
    expect(
      (await prisma.part.findUnique({ where: { id: part.id } }))!.quantity,
    ).toBe(15);

    await request(app.getHttpServer())
      .post(`/api/invoices/${issued.body.id}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: issued.body.total, method: 'CASH' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/credit-notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        invoiceId: issued.body.id,
        reason: 'Customer returned 2 wipers',
        restockParts: true,
        lineItems: [
          {
            description: 'Wiper blade — 2 returned',
            quantity: 2,
            unitPrice: 15,
            tvaRate: 19,
            partId: part.id,
            type: 'part',
          },
        ],
      })
      .expect(201);

    // 15 + 2 = 17
    expect(
      (await prisma.part.findUnique({ where: { id: part.id } }))!.quantity,
    ).toBe(17);

    const movements = await prisma.stockMovement.findMany({
      where: { partId: part.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(movements).toHaveLength(2);
    expect(movements[0].type).toBe('out');
    expect(movements[1].type).toBe('in');
  });
});
