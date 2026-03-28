import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// ── Mock guard that injects a fake user ──────────────────────────

const MOCK_GARAGE_ID = 'garage-ctrl-001';

const MockJwtGuard = {
  canActivate: (ctx) => {
    const req = ctx.switchToHttp().getRequest();
    req.user = {
      id: 'user-1',
      garageId: MOCK_GARAGE_ID,
      role: 'OWNER',
    };
    return true;
  },
};

describe('AiController – POST /ai/suggest-schedule', () => {
  let app: INestApplication;
  let aiService: Record<string, jest.Mock>;

  beforeEach(async () => {
    aiService = {
      suggestSchedule: jest.fn(),
      chat: jest.fn(),
      diagnose: jest.fn(),
      estimate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: aiService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(MockJwtGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ── Happy path ────────────────────────────────────────────

  it('returns 201 with suggestedSlots from the service', async () => {
    const mockResult = {
      suggestedSlots: [
        {
          start: '2026-04-01T08:00:00.000Z',
          end: '2026-04-01T09:00:00.000Z',
          mechanicId: 'emp-1',
          mechanicName: 'Karim Mechanic',
          score: 0.95,
          reason: 'Specialty match: oil-change (0 appointments this week)',
        },
      ],
      provider: 'mock',
    };
    aiService.suggestSchedule.mockResolvedValue(mockResult);

    const res = await request(app.getHttpServer())
      .post('/ai/suggest-schedule')
      .send({
        appointmentType: 'oil-change',
        estimatedDuration: 60,
      })
      .expect(201);

    expect(res.body).toEqual(mockResult);
    expect(aiService.suggestSchedule).toHaveBeenCalledWith(
      MOCK_GARAGE_ID,
      expect.objectContaining({
        appointmentType: 'oil-change',
        estimatedDuration: 60,
      }),
    );
  });

  // ── Passes preferredDate through ──────────────────────────

  it('passes preferredDate and mechanicId to the service', async () => {
    aiService.suggestSchedule.mockResolvedValue({ suggestedSlots: [], provider: 'mock' });

    await request(app.getHttpServer())
      .post('/ai/suggest-schedule')
      .send({
        appointmentType: 'brake-service',
        estimatedDuration: 120,
        preferredDate: '2026-04-05',
        mechanicId: 'emp-specific',
      })
      .expect(201);

    expect(aiService.suggestSchedule).toHaveBeenCalledWith(
      MOCK_GARAGE_ID,
      expect.objectContaining({
        appointmentType: 'brake-service',
        estimatedDuration: 120,
        preferredDate: '2026-04-05',
        mechanicId: 'emp-specific',
      }),
    );
  });

  // ── Empty result ──────────────────────────────────────────

  it('returns empty suggestedSlots when service finds no candidates', async () => {
    aiService.suggestSchedule.mockResolvedValue({ suggestedSlots: [], provider: 'none' });

    const res = await request(app.getHttpServer())
      .post('/ai/suggest-schedule')
      .send({
        appointmentType: 'unknown-service',
        estimatedDuration: 60,
      })
      .expect(201);

    expect(res.body.suggestedSlots).toEqual([]);
  });

  // ── Validation: missing appointmentType ───────────────────

  it('returns 400 when appointmentType is missing', async () => {
    await request(app.getHttpServer())
      .post('/ai/suggest-schedule')
      .send({
        estimatedDuration: 60,
      })
      .expect(400);

    expect(aiService.suggestSchedule).not.toHaveBeenCalled();
  });

  // ── Validation: missing estimatedDuration ─────────────────

  it('returns 400 when estimatedDuration is missing', async () => {
    await request(app.getHttpServer())
      .post('/ai/suggest-schedule')
      .send({
        appointmentType: 'oil-change',
      })
      .expect(400);

    expect(aiService.suggestSchedule).not.toHaveBeenCalled();
  });

  // ── Validation: extra unknown fields stripped ─────────────

  it('strips unknown fields (forbidNonWhitelisted)', async () => {
    // With forbidNonWhitelisted: true, extra fields cause 400
    await request(app.getHttpServer())
      .post('/ai/suggest-schedule')
      .send({
        appointmentType: 'oil-change',
        estimatedDuration: 60,
        hackerField: 'should-be-rejected',
      })
      .expect(400);
  });

  // ── Uses garageId from CurrentUser decorator ──────────────

  it('extracts garageId from the authenticated user', async () => {
    aiService.suggestSchedule.mockResolvedValue({ suggestedSlots: [], provider: 'mock' });

    await request(app.getHttpServer())
      .post('/ai/suggest-schedule')
      .send({
        appointmentType: 'oil-change',
        estimatedDuration: 60,
      })
      .expect(201);

    // garageId is the first argument, extracted via @CurrentUser('garageId')
    expect(aiService.suggestSchedule).toHaveBeenCalledWith(
      MOCK_GARAGE_ID,
      expect.anything(),
    );
  });

  // ── Auth guard enforcement ────────────────────────────────

  it('would reject requests without a valid JWT (guard active)', async () => {
    // Create a separate module where the guard rejects
    const rejectGuard = { canActivate: () => false };

    const module = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: aiService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(rejectGuard)
      .compile();

    const restrictedApp = module.createNestApplication();
    await restrictedApp.init();

    await request(restrictedApp.getHttpServer())
      .post('/ai/suggest-schedule')
      .send({
        appointmentType: 'oil-change',
        estimatedDuration: 60,
      })
      .expect(403);

    await restrictedApp.close();
  });

  // ── Service error propagation ─────────────────────────────

  it('returns 500 when service throws an unexpected error', async () => {
    aiService.suggestSchedule.mockRejectedValue(new Error('DB connection lost'));

    await request(app.getHttpServer())
      .post('/ai/suggest-schedule')
      .send({
        appointmentType: 'oil-change',
        estimatedDuration: 60,
      })
      .expect(500);
  });
});
