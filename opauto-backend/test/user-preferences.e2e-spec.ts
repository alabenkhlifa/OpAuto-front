import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Integration coverage for the /users/me/preferences endpoints.
 * Creates its own garage + user + access token so it's independent of the
 * main api.e2e suite's shared state.
 */
describe('UserPreferences (e2e)', () => {
  const TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/opauto_test';
  let app: INestApplication;
  let prisma: PrismaService;

  let garageId: string;
  let userId: string;
  let accessToken: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;

    try {
      execSync('npx prisma db push --skip-generate', {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'pipe',
      });
    } catch {
      // push may warn but still succeed
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

    // Register a fresh owner — avoids conflicts with other suites
    const email = `prefs-${Date.now()}@opauto.tn`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email, password: 'Test1234!',
        firstName: 'Pref', lastName: 'Tester',
        garageName: 'Prefs Garage',
      })
      .expect(201);
    accessToken = res.body.access_token;
    userId = res.body.user.id;
    garageId = res.body.user.garage.id;
  });

  afterAll(async () => {
    // Clean up: preferences → user → garage
    await prisma.userPreference.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.garage.deleteMany({ where: { id: garageId } });
    await app.close();
  });

  it('GET /users/me/preferences creates defaults on first call', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.userId).toBe(userId);
    expect(res.body.emailNotifications).toBe(true);
    expect(res.body.smsNotifications).toBe(false);
    expect(res.body.browserNotifications).toBe(true);
    expect(res.body.language).toBeNull();
    expect(res.body.theme).toBeNull();
  });

  it('PUT /users/me/preferences patches only provided fields', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ smsNotifications: true, theme: 'light' })
      .expect(200);

    expect(res.body.smsNotifications).toBe(true);
    expect(res.body.theme).toBe('light');
    // Other fields untouched
    expect(res.body.emailNotifications).toBe(true);
    expect(res.body.browserNotifications).toBe(true);
  });

  it('PUT /users/me/preferences rejects unknown theme values', async () => {
    await request(app.getHttpServer())
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ theme: 'neon' })
      .expect(400);
  });

  it('PUT /users/me/preferences rejects unknown language codes', async () => {
    await request(app.getHttpServer())
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ language: 'de' })
      .expect(400);
  });

  it('GET /users/me/preferences without token returns 401', async () => {
    await request(app.getHttpServer())
      .get('/api/users/me/preferences')
      .expect(401);
  });

  it('preferences persist across subsequent GETs', async () => {
    await request(app.getHttpServer())
      .put('/api/users/me/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ emailNotifications: false, language: 'fr' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/users/me/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.emailNotifications).toBe(false);
    expect(res.body.language).toBe('fr');
  });
});
