import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NumberingService } from '../src/invoicing/numbering.service';

/**
 * Integration suite for Task 1.5 — Garage fiscal identity settings.
 *
 * Covers:
 *  1. PATCH valid fiscal fields → 200, GET returns them
 *  2. Invalid mfNumber (e.g. "abc") → 400 with class-validator message
 *  3. Invalid rib (e.g. "123") → 400
 *  4. numberingDigitCount: 1 (below minimum) → 400
 *  5. numberingResetPolicy: "INVALID" → 400
 *  6. After save, NumberingService.next() honours the new prefix/policy/digits
 *
 * Uses the isolated `opauto_test` database — never touches dev data.
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('Garage settings — fiscal identity (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let numberingService: NumberingService;
  let accessToken: string;
  let garageId: string;

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
    numberingService = app.get(NumberingService);

    // Truncate so leftovers from other suites don't pollute us.
    await prisma.$executeRawUnsafe(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations')
        LOOP
          EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
        END LOOP;
      END $$;
    `);

    // Bootstrap an OWNER + garage via the real auth flow so the JWT has the
    // claims (garageId, role=OWNER) that the controller guards expect.
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'fiscal@opauto.tn',
        password: 'Test1234!',
        firstName: 'Fiscal',
        lastName: 'Tester',
        garageName: 'Fiscal Garage',
      })
      .expect(201);

    accessToken = reg.body.access_token;
    garageId = reg.body.user.garage.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. Valid PATCH round-trip ─────────────────────────────────

  it('PUT /garage-settings with valid fiscal payload → 200, GET returns the same', async () => {
    const payload = {
      mfNumber: '1234567/A/B/000',
      rib: '12345678901234567890',
      bankName: 'BIAT',
      logoUrl: '/uploads/garage-logo.png',
      defaultPaymentTermsDays: 45,
      numberingPrefix: 'FACT',
      numberingResetPolicy: 'MONTHLY',
      numberingDigitCount: 5,
      defaultTvaRate: 13,
      fiscalStampEnabled: false,
    };

    const put = await request(app.getHttpServer())
      .put('/api/garage-settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(200);

    expect(put.body.mfNumber).toBe(payload.mfNumber);
    expect(put.body.rib).toBe(payload.rib);
    expect(put.body.bankName).toBe(payload.bankName);
    expect(put.body.logoUrl).toBe(payload.logoUrl);
    expect(put.body.defaultPaymentTermsDays).toBe(payload.defaultPaymentTermsDays);
    expect(put.body.numberingPrefix).toBe(payload.numberingPrefix);
    expect(put.body.numberingResetPolicy).toBe(payload.numberingResetPolicy);
    expect(put.body.numberingDigitCount).toBe(payload.numberingDigitCount);
    expect(put.body.defaultTvaRate).toBe(payload.defaultTvaRate);
    expect(put.body.fiscalStampEnabled).toBe(payload.fiscalStampEnabled);

    const get = await request(app.getHttpServer())
      .get('/api/garage-settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(get.body.mfNumber).toBe(payload.mfNumber);
    expect(get.body.rib).toBe(payload.rib);
    expect(get.body.numberingResetPolicy).toBe('MONTHLY');
    expect(get.body.numberingDigitCount).toBe(5);
    expect(get.body.fiscalStampEnabled).toBe(false);
  });

  // ── 2. Invalid mfNumber ──────────────────────────────────────

  it('PUT /garage-settings with invalid mfNumber → 400', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/garage-settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ mfNumber: 'abc' })
      .expect(400);

    const messages = Array.isArray(res.body.message) ? res.body.message : [res.body.message];
    expect(messages.join(' ')).toMatch(/mfNumber/);
  });

  // ── 3. Invalid rib ───────────────────────────────────────────

  it('PUT /garage-settings with invalid rib → 400', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/garage-settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ rib: '123' })
      .expect(400);

    const messages = Array.isArray(res.body.message) ? res.body.message : [res.body.message];
    expect(messages.join(' ')).toMatch(/rib/);
  });

  // ── 4. numberingDigitCount below minimum ─────────────────────

  it('PUT /garage-settings with numberingDigitCount=1 → 400', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/garage-settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ numberingDigitCount: 1 })
      .expect(400);

    const messages = Array.isArray(res.body.message) ? res.body.message : [res.body.message];
    expect(messages.join(' ')).toMatch(/numberingDigitCount/);
  });

  // ── 5. Invalid numberingResetPolicy ──────────────────────────

  it('PUT /garage-settings with numberingResetPolicy="INVALID" → 400', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/garage-settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ numberingResetPolicy: 'INVALID' })
      .expect(400);

    const messages = Array.isArray(res.body.message) ? res.body.message : [res.body.message];
    expect(messages.join(' ')).toMatch(/numberingResetPolicy/);
  });

  // ── 6. NumberingService picks up the new settings ────────────

  it('After PUT, NumberingService.next() uses the new prefix / digits / policy', async () => {
    // Set NEVER policy so we get a deterministic shape: {PREFIX}-{NNNNNN}
    await request(app.getHttpServer())
      .put('/api/garage-settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        numberingPrefix: 'AGR',
        numberingResetPolicy: 'NEVER',
        numberingDigitCount: 6,
      })
      .expect(200);

    const number = await numberingService.next(garageId, 'INVOICE');

    expect(number).toMatch(/^AGR-\d{6}$/);
  });
});
