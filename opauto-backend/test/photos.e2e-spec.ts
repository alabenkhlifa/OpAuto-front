import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Integration coverage for the maintenance-photo endpoints.
 * Creates its own garage + owner + maintenance job, uploads a real image,
 * lists it, fetches the file, and deletes it. Cleans up after itself.
 */
describe('Maintenance photos (e2e)', () => {
  const TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/opauto_test';
  const TMP_UPLOAD_ROOT = path.resolve(__dirname, '../uploads-test');
  let app: INestApplication;
  let prisma: PrismaService;

  let garageId: string;
  let userId: string;
  let accessToken: string;
  let carId: string;
  let jobId: string;

  // 1×1 transparent PNG
  const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    // Route uploads to a suite-local dir so we don't pollute the real one
    process.env.UPLOAD_ROOT = TMP_UPLOAD_ROOT;

    try {
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
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    // Register an owner + activate the maintenance module (ModuleAccessGuard)
    const email = `photos-${Date.now()}@opauto.tn`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email, password: 'Test1234!',
        firstName: 'Photo', lastName: 'Tester',
        garageName: 'Photos Garage',
      })
      .expect(201);
    accessToken = res.body.access_token;
    userId = res.body.user.id;
    garageId = res.body.user.garage.id;
    await prisma.garageModule.createMany({
      data: ['maintenance'].map(moduleId => ({ garageId, moduleId })),
      skipDuplicates: true,
    });

    // Minimum fixtures: customer + car + maintenance job (no mechanic needed)
    const customer = await prisma.customer.create({
      data: { garageId, firstName: 'Pix', lastName: 'Customer', phone: '+216 00 000 000' },
    });
    const car = await prisma.car.create({
      data: { garageId, customerId: customer.id, make: 'Test', model: 'Photo', year: 2020, licensePlate: `PHOTOS-${Date.now()}` },
    });
    carId = car.id;
    const job = await prisma.maintenanceJob.create({
      data: { garageId, carId, title: 'Photo job', status: 'PENDING' },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    // Clean DB
    await prisma.maintenancePhoto.deleteMany({ where: { maintenanceJobId: jobId } });
    await prisma.maintenanceJob.deleteMany({ where: { id: jobId } });
    await prisma.car.deleteMany({ where: { id: carId } });
    await prisma.customer.deleteMany({ where: { garageId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.garage.deleteMany({ where: { id: garageId } });
    // Clean the tmp uploads dir for this garage
    const garageDir = path.join(TMP_UPLOAD_ROOT, garageId);
    if (fs.existsSync(garageDir)) fs.rmSync(garageDir, { recursive: true, force: true });
    await app.close();
  });

  let uploadedPhotoId: string;
  let uploadedFilename: string;

  it('POST /maintenance/:jobId/photos uploads and creates a row', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/maintenance/${jobId}/photos`)
      .set('Authorization', `Bearer ${accessToken}`)
      .field('caption', 'before shot')
      .field('type', 'before')
      .attach('file', TINY_PNG, { filename: 'test.png', contentType: 'image/png' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.maintenanceJobId).toBe(jobId);
    expect(res.body.caption).toBe('before shot');
    expect(res.body.type).toBe('before');
    expect(res.body.mimeType).toBe('image/png');
    expect(res.body.sizeBytes).toBe(TINY_PNG.length);
    expect(res.body.uploadedBy).toBe(userId);
    expect(res.body.url).toContain(`/api/maintenance/${jobId}/photos/${res.body.id}/file`);
    expect(res.body.filename).toMatch(/\.png$/);

    uploadedPhotoId = res.body.id;
    uploadedFilename = res.body.filename;

    // Actual file exists on disk
    const fullPath = path.join(TMP_UPLOAD_ROOT, garageId, uploadedFilename);
    expect(fs.existsSync(fullPath)).toBe(true);
    expect(fs.statSync(fullPath).size).toBe(TINY_PNG.length);
  });

  it('POST rejects non-image mime types', async () => {
    await request(app.getHttpServer())
      .post(`/api/maintenance/${jobId}/photos`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('GET /maintenance/:jobId/photos lists uploaded photos', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/maintenance/${jobId}/photos`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].id).toBeDefined();
  });

  it('GET /maintenance/:jobId/photos/:photoId/file streams the file bytes', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/maintenance/${jobId}/photos/${uploadedPhotoId}/file`)
      .set('Authorization', `Bearer ${accessToken}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect((res.body as unknown as Buffer).length).toBe(TINY_PNG.length);
  });

  it('DELETE removes the row and the file on disk', async () => {
    await request(app.getHttpServer())
      .delete(`/api/maintenance/${jobId}/photos/${uploadedPhotoId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const fullPath = path.join(TMP_UPLOAD_ROOT, garageId, uploadedFilename);
    expect(fs.existsSync(fullPath)).toBe(false);

    const after = await prisma.maintenancePhoto.findUnique({ where: { id: uploadedPhotoId } });
    expect(after).toBeNull();
  });

  it('GET without token returns 401', async () => {
    await request(app.getHttpServer())
      .get(`/api/maintenance/${jobId}/photos`)
      .expect(401);
  });
});
