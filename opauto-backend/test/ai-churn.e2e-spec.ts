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
 * Integration test for AiService.predictChurn against a real Postgres
 * (opauto_test). Creates its own garage + three customers covering the
 * three risk bands + a "too new" customer that must be skipped.
 */
describe('AiService – predictChurn (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let aiService: AiService;

  let garageId: string;
  const customerIds: string[] = [];

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
      data: { name: 'Churn Integration Garage', currency: 'TND', taxRate: 19 },
    });
    garageId = garage.id;

    // Helper: create customer + one car + their appointments in one go
    const seedCustomer = async (opts: {
      firstName: string;
      lastName: string;
      phone: string;
      status: 'ACTIVE' | 'INACTIVE';
      visitCount: number;
      createdAt: Date;
      appointments: Array<{ status: string; title: string; startTime: Date }>;
    }) => {
      const customer = await prisma.customer.create({
        data: {
          garageId,
          firstName: opts.firstName,
          lastName: opts.lastName,
          phone: opts.phone,
          status: opts.status,
          visitCount: opts.visitCount,
          createdAt: opts.createdAt,
        },
      });
      const car = await prisma.car.create({
        data: {
          garageId,
          customerId: customer.id,
          make: 'Test',
          model: 'Car',
          year: 2020,
          licensePlate: `CHURN-${customer.id.slice(0, 6)}`,
        },
      });
      await prisma.appointment.createMany({
        data: opts.appointments.map((a) => ({
          garageId,
          customerId: customer.id,
          carId: car.id,
          status: a.status as any,
          title: a.title,
          startTime: a.startTime,
          endTime: a.startTime,
        })),
      });
      return customer;
    };

    // Healthy: low risk
    customerIds.push((await seedCustomer({
      firstName: 'Healthy', lastName: 'Hana', phone: '+216 20 000 001',
      status: 'ACTIVE', visitCount: 10, createdAt: daysAgo(365),
      appointments: [{ status: 'COMPLETED', title: 'Oil change', startTime: daysAgo(20) }],
    })).id);

    // Overdue: high risk
    customerIds.push((await seedCustomer({
      firstName: 'Overdue', lastName: 'Omar', phone: '+216 20 000 002',
      status: 'ACTIVE', visitCount: 12, createdAt: daysAgo(365),
      appointments: [{ status: 'COMPLETED', title: 'Brake check', startTime: daysAgo(120) }],
    })).id);

    // Rebounding: overdue but has future appointment → demoted
    customerIds.push((await seedCustomer({
      firstName: 'Rebound', lastName: 'Rim', phone: '+216 20 000 003',
      status: 'ACTIVE', visitCount: 12, createdAt: daysAgo(365),
      appointments: [
        { status: 'COMPLETED', title: 'Oil change', startTime: daysAgo(120) },
        { status: 'SCHEDULED', title: 'Follow-up', startTime: daysAgo(-5) },
      ],
    })).id);

    // Too new: only 1 visit → skipped
    customerIds.push((await seedCustomer({
      firstName: 'Fresh', lastName: 'Fares', phone: '+216 20 000 004',
      status: 'ACTIVE', visitCount: 1, createdAt: daysAgo(30),
      appointments: [{ status: 'COMPLETED', title: 'Oil change', startTime: daysAgo(10) }],
    })).id);
  });

  afterAll(async () => {
    // Delete in FK-safe order: appointments → cars → customers → garage
    await prisma.appointment.deleteMany({ where: { garageId } });
    await prisma.car.deleteMany({ where: { garageId } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.garage.deleteMany({ where: { id: garageId } });
    await app.close();
  });

  it('returns a prediction for each scoreable customer (not the too-new one)', async () => {
    const result = await aiService.predictChurn(garageId, {});
    expect(result.predictions).toHaveLength(3);
    const names = result.predictions.map((p) => p.customerName);
    expect(names).not.toContain('Fresh Fares');
  });

  it('ranks the overdue customer as high and the healthy one as low', async () => {
    const result = await aiService.predictChurn(garageId, {});
    const byName = (n: string) => result.predictions.find((p) => p.customerName === n);
    expect(byName('Overdue Omar')?.riskLevel).toBe('high');
    expect(byName('Healthy Hana')?.riskLevel).toBe('low');
  });

  it('demotes the rebounding customer below the overdue one due to future appointment', async () => {
    const result = await aiService.predictChurn(garageId, {});
    const byName = (n: string) => result.predictions.find((p) => p.customerName === n);
    const overdue = byName('Overdue Omar')!;
    const rebounding = byName('Rebound Rim')!;
    expect(rebounding.churnRisk).toBeLessThan(overdue.churnRisk);
    expect(rebounding.factors.some((f) => /upcoming/i.test(f))).toBe(true);
  });

  it('sorts predictions by churnRisk descending', async () => {
    const result = await aiService.predictChurn(garageId, {});
    for (let i = 1; i < result.predictions.length; i++) {
      expect(result.predictions[i - 1].churnRisk).toBeGreaterThanOrEqual(result.predictions[i].churnRisk);
    }
  });

  it('filters to a single customer when customerId is provided', async () => {
    const result = await aiService.predictChurn(garageId, { customerId: customerIds[1] }); // Overdue Omar
    expect(result.predictions).toHaveLength(1);
    expect(result.predictions[0].customerName).toBe('Overdue Omar');
  });

  it('populates a non-empty suggestedAction for every prediction (via LLM or template)', async () => {
    const result = await aiService.predictChurn(garageId, {});
    // Provider is either "template" (no LLM keys) or the LLM name (groq/openai/etc).
    // We just assert every prediction has a non-empty action.
    expect(['template', 'groq', 'openai', 'claude', 'gemini', 'mock']).toContain(result.provider);
    for (const p of result.predictions) {
      expect(typeof p.suggestedAction).toBe('string');
      expect(p.suggestedAction.trim().length).toBeGreaterThan(0);
    }
  });
});
