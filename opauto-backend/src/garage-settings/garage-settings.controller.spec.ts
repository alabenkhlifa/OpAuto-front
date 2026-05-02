/**
 * BUG-108 (Sweep C-16) — STAFF can READ /garage-settings, OWNER-only on writes.
 *
 * Pre-fix: the controller had a class-level `@Roles(UserRole.OWNER)` which
 * blocked every route (GET + PUT) for STAFF. STAFF users navigating the
 * invoice surface saw a 403 spam in the console for `GET /api/garage-settings`.
 * Fix splits read vs write at the route level: GET is `OWNER + STAFF`, PUT
 * stays `OWNER` only.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { GarageSettingsController } from './garage-settings.controller';
import { GarageSettingsService } from './garage-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

const MOCK_GARAGE_ID = 'garage-ctrl-001';

function makeAuthGuard(role: 'OWNER' | 'STAFF') {
  return {
    canActivate: (ctx) => {
      const req = ctx.switchToHttp().getRequest();
      req.user = { id: 'user-1', garageId: MOCK_GARAGE_ID, role };
      return true;
    },
  };
}

describe('GarageSettingsController — BUG-108 role matrix', () => {
  let app: INestApplication;
  let svc: Record<string, jest.Mock>;

  async function bootstrapAs(role: 'OWNER' | 'STAFF') {
    svc = {
      getSettings: jest.fn().mockResolvedValue({
        garageId: MOCK_GARAGE_ID,
        defaultTvaRate: 0.19,
        fiscalStampEnabled: true,
      }),
      updateSettings: jest.fn().mockResolvedValue({ garageId: MOCK_GARAGE_ID }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GarageSettingsController],
      providers: [{ provide: GarageSettingsService, useValue: svc }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(makeAuthGuard(role))
      .compile();

    app = module.createNestApplication();
    await app.init();
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  describe('OWNER', () => {
    beforeEach(() => bootstrapAs('OWNER'));

    it('GET /garage-settings → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/garage-settings')
        .expect(200);
      expect(res.body.garageId).toBe(MOCK_GARAGE_ID);
      expect(svc.getSettings).toHaveBeenCalledWith(MOCK_GARAGE_ID);
    });

    it('PUT /garage-settings → 200', async () => {
      await request(app.getHttpServer())
        .put('/garage-settings')
        .send({ name: 'Updated Garage' })
        .expect(200);
      expect(svc.updateSettings).toHaveBeenCalled();
    });
  });

  describe('STAFF', () => {
    beforeEach(() => bootstrapAs('STAFF'));

    it('GET /garage-settings → 200 (BUG-108: STAFF can read fiscal config)', async () => {
      const res = await request(app.getHttpServer())
        .get('/garage-settings')
        .expect(200);
      expect(res.body.garageId).toBe(MOCK_GARAGE_ID);
      expect(svc.getSettings).toHaveBeenCalledWith(MOCK_GARAGE_ID);
    });

    it('PUT /garage-settings → 403 (write stays OWNER-only)', async () => {
      await request(app.getHttpServer())
        .put('/garage-settings')
        .send({ name: 'Hacked Garage' })
        .expect(403);
      expect(svc.updateSettings).not.toHaveBeenCalled();
    });
  });
});
