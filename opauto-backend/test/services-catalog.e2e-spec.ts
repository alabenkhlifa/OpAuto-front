import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integration suite for Task 2.4 — service catalog CRUD.
 *
 * Covers: create, list (active only by default + includeInactive=true),
 * detail, patch, soft delete, hard delete, and uniqueness on (garageId, code).
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('Service catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
        email: 'catalog@opauto.tn',
        password: 'Test1234!',
        firstName: 'Cat',
        lastName: 'Tester',
        garageName: 'Catalog Garage',
      })
      .expect(201);
    accessToken = reg.body.access_token;
    garageId = reg.body.user.garage.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /service-catalog creates an entry as OWNER', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/service-catalog')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'OIL_CHG',
        name: 'Oil change',
        category: 'Maintenance',
        defaultPrice: 80,
        defaultLaborHours: 0.5,
      })
      .expect(201);

    expect(res.body.code).toBe('OIL_CHG');
    expect(res.body.defaultTvaRate).toBe(19);
    expect(res.body.isActive).toBe(true);
  });

  it('POST /service-catalog rejects duplicate code (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/service-catalog')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'BRK_INSP',
        name: 'Brake inspection',
        defaultPrice: 30,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/service-catalog')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'BRK_INSP',
        name: 'Brake inspection 2',
        defaultPrice: 35,
      })
      .expect(409);
  });

  it('GET /service-catalog returns only active entries by default', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/service-catalog')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'WIPER_RPL',
        name: 'Wiper replacement',
        defaultPrice: 25,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/service-catalog/${create.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/service-catalog')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const codes = list.body.map((s: any) => s.code);
    expect(codes).not.toContain('WIPER_RPL');

    const listAll = await request(app.getHttpServer())
      .get('/api/service-catalog?includeInactive=true')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const allCodes = listAll.body.map((s: any) => s.code);
    expect(allCodes).toContain('WIPER_RPL');
  });

  it('PATCH /service-catalog/:id updates an entry', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/service-catalog')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'ALIGN',
        name: 'Wheel alignment',
        defaultPrice: 60,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .patch(`/api/service-catalog/${create.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ defaultPrice: 75 })
      .expect(200);

    expect(res.body.defaultPrice).toBe(75);
  });

  it('DELETE /service-catalog/:id?hard=true performs hard delete', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/service-catalog')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'DIAG',
        name: 'Diagnostics',
        defaultPrice: 40,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/service-catalog/${create.body.id}?hard=true`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/service-catalog/${create.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
