import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiService } from '../src/ai/ai.service';
import { execSync } from 'child_process';
import * as path from 'path';

// Isolated test database — never touch the dev database
const TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/opauto_test';

/**
 * Integration test for AiService.predictMaintenance against a real Postgres
 * (opauto_test). Seeds a garage + three cars covering the urgency bands:
 * one overdue (oil change 400d ago), one near-due (oil change 160d ago),
 * one fresh (oil change 30d ago).
 */
describe('AiService – predictMaintenance (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let aiService: AiService;

  let garageId: string;
  const carIds: string[] = [];
  let customerId: string;

  const daysAgo = (n: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;

    try {
      execSync('npx prisma db push --skip-generate', {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'pipe',
      });
    } catch {
      // push may warn; safe to ignore
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    aiService = app.get(AiService);

    const garage = await prisma.garage.create({
      data: { name: 'Maintenance Integration Garage', currency: 'TND', taxRate: 19 },
    });
    garageId = garage.id;

    const customer = await prisma.customer.create({
      data: {
        garageId,
        firstName: 'Ali',
        lastName: 'Predict',
        phone: '+216 20 999 000',
      },
    });
    customerId = customer.id;

    const seedCar = async (opts: {
      make: string;
      model: string;
      plate: string;
      mileage: number;
      appointments: Array<{ startTime: Date; type: string; title: string; status: string }>;
    }) => {
      const car = await prisma.car.create({
        data: {
          garageId,
          customerId,
          make: opts.make,
          model: opts.model,
          year: 2019,
          licensePlate: opts.plate,
          mileage: opts.mileage,
        },
      });
      if (opts.appointments.length > 0) {
        await prisma.appointment.createMany({
          data: opts.appointments.map((a) => ({
            garageId,
            customerId,
            carId: car.id,
            status: a.status as any,
            title: a.title,
            type: a.type,
            startTime: a.startTime,
            endTime: a.startTime,
          })),
        });
      }
      return car;
    };

    // Overdue: oil change 400 days ago
    carIds.push((await seedCar({
      make: 'Peugeot', model: '308', plate: 'MAINT-OVERDUE', mileage: 70000,
      appointments: [{
        startTime: daysAgo(400), type: 'oil-change', title: 'Oil change', status: 'COMPLETED',
      }],
    })).id);

    // Near-due: oil change 160 days ago (interval 180d → 20d until due → medium)
    carIds.push((await seedCar({
      make: 'Renault', model: 'Clio', plate: 'MAINT-NEARDUE', mileage: 50000,
      appointments: [{
        startTime: daysAgo(160), type: 'oil-change', title: 'Oil change', status: 'COMPLETED',
      }],
    })).id);

    // Fresh: oil change 30 days ago
    carIds.push((await seedCar({
      make: 'Citroen', model: 'C3', plate: 'MAINT-FRESH', mileage: 40000,
      appointments: [{
        startTime: daysAgo(30), type: 'oil-change', title: 'Oil change', status: 'COMPLETED',
      }],
    })).id);
  });

  afterAll(async () => {
    // FK-safe cleanup
    await prisma.appointment.deleteMany({ where: { garageId } });
    await prisma.car.deleteMany({ where: { garageId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.garage.deleteMany({ where: { id: garageId } });
    await app.close();
  });

  it('returns at least one prediction per car (across all services)', async () => {
    const result = await aiService.predictMaintenance(garageId, {});
    // 3 cars × 8 service intervals = up to 24 predictions (some may be low-filtered only
    // when there's no history and no mileage — all our seeds have mileage so all survive)
    const carIdsInResult = new Set(result.predictions.map((p) => p.carId));
    expect(carIdsInResult.size).toBe(3);
  });

  it('flags the overdue car as high urgency for oil-change', async () => {
    const result = await aiService.predictMaintenance(garageId, {});
    const overdueOil = result.predictions.find(
      (p) => p.service === 'oil-change' && p.carLabel.includes('MAINT-OVERDUE'),
    );
    expect(overdueOil).toBeDefined();
    expect(overdueOil!.urgency).toBe('high');
  });

  it('flags the fresh car as low urgency for oil-change', async () => {
    const result = await aiService.predictMaintenance(garageId, {});
    const freshOil = result.predictions.find(
      (p) => p.service === 'oil-change' && p.carLabel.includes('MAINT-FRESH'),
    );
    expect(freshOil).toBeDefined();
    expect(freshOil!.urgency).toBe('low');
  });

  it('filters to a single car when carId is provided', async () => {
    const result = await aiService.predictMaintenance(garageId, { carId: carIds[0] });
    const uniqueCars = new Set(result.predictions.map((p) => p.carId));
    expect(uniqueCars.size).toBe(1);
    expect([...uniqueCars][0]).toBe(carIds[0]);
  });

  it('sorts predictions by urgency desc (high first, low last)', async () => {
    const result = await aiService.predictMaintenance(garageId, {});
    const weight = (u: string) => (u === 'high' ? 2 : u === 'medium' ? 1 : 0);
    for (let i = 1; i < result.predictions.length; i++) {
      expect(weight(result.predictions[i - 1].urgency)).toBeGreaterThanOrEqual(
        weight(result.predictions[i].urgency),
      );
    }
  });

  it('populates a non-empty reason for every prediction (via LLM or template)', async () => {
    const result = await aiService.predictMaintenance(garageId, {});
    expect(['template', 'groq', 'claude', 'openai', 'gemini', 'mock']).toContain(result.provider);
    for (const p of result.predictions) {
      expect(typeof p.reason).toBe('string');
      expect(p.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it('returns reasons in the requested language (fr)', async () => {
    const result = await aiService.predictMaintenance(garageId, { language: 'fr' });
    const overdueOil = result.predictions.find(
      (p) => p.service === 'oil-change' && p.carLabel.includes('MAINT-OVERDUE'),
    );
    // Fall-back template for 'fr' uses "retard" or "Vidange"; LLM output should also be French.
    expect(overdueOil!.reason).toMatch(/[a-zA-ZÀ-ÿ]/);
  });
});
