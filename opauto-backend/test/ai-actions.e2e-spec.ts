import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiActionsService } from '../src/ai-actions/ai-actions.service';
import { execSync } from 'child_process';
import * as path from 'path';

const TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('AiActionsService (integration, SMS_PROVIDER=mock)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: AiActionsService;
  let garageId: string;
  let userId: string;
  let highRiskId: string;
  let optedOutId: string;

  const daysAgo = (n: number): Date => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.SMS_PROVIDER = 'mock';

    try {
      execSync('npx prisma db push --skip-generate', {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'pipe',
      });
    } catch {
      // ignore warnings
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    service = app.get(AiActionsService);

    const garage = await prisma.garage.create({
      data: { name: 'AI Actions Garage', currency: 'TND', taxRate: 19 },
    });
    garageId = garage.id;

    const user = await prisma.user.create({
      data: {
        garageId,
        email: `ai-actions-${Date.now()}@test.local`,
        password: 'x',
        firstName: 'Test',
        lastName: 'Approver',
        role: 'OWNER',
      },
    });
    userId = user.id;

    const highRisk = await prisma.customer.create({
      data: {
        garageId,
        firstName: 'Omar',
        lastName: 'Overdue',
        phone: '+216 20 111 222',
        status: 'ACTIVE',
        visitCount: 12,
        createdAt: daysAgo(365),
        smsOptIn: true,
      },
    });
    highRiskId = highRisk.id;
    await prisma.appointment.create({
      data: {
        garageId,
        customerId: highRisk.id,
        carId: (
          await prisma.car.create({
            data: {
              garageId,
              customerId: highRisk.id,
              make: 'Peugeot',
              model: '208',
              year: 2020,
              licensePlate: `HI-${highRisk.id.slice(0, 4)}`,
            },
          })
        ).id,
        status: 'COMPLETED',
        title: 'Old service',
        startTime: daysAgo(160),
        endTime: daysAgo(160),
      },
    });

    const optedOut = await prisma.customer.create({
      data: {
        garageId,
        firstName: 'Nadia',
        lastName: 'NoSms',
        phone: '+216 20 333 444',
        status: 'ACTIVE',
        visitCount: 8,
        createdAt: daysAgo(365),
        smsOptIn: false,
      },
    });
    optedOutId = optedOut.id;
    await prisma.appointment.create({
      data: {
        garageId,
        customerId: optedOut.id,
        carId: (
          await prisma.car.create({
            data: {
              garageId,
              customerId: optedOut.id,
              make: 'Renault',
              model: 'Clio',
              year: 2019,
              licensePlate: `NO-${optedOut.id.slice(0, 4)}`,
            },
          })
        ).id,
        status: 'COMPLETED',
        title: 'Old service',
        startTime: daysAgo(180),
        endTime: daysAgo(180),
      },
    });
  }, 60000);

  afterAll(async () => {
    await prisma.aiAction.deleteMany({ where: { garageId } });
    await prisma.appointment.deleteMany({ where: { garageId } });
    await prisma.car.deleteMany({ where: { garageId } });
    await prisma.customer.deleteMany({ where: { garageId } });
    await prisma.user.deleteMany({ where: { garageId } });
    await prisma.garage.deleteMany({ where: { id: garageId } });
    await app.close();
  });

  it('drafts → approves → sends (status SENT) for opted-in customer', async () => {
    const draft = await service.draftForCustomer(garageId, highRiskId);
    expect(draft.status).toBe('DRAFT');
    expect(draft.messageBody.length).toBeGreaterThan(10);

    const sent = await service.approveAndSend(garageId, userId, draft.id, {});
    expect(['SENT', 'FAILED']).toContain(sent.status);
    // Under mock provider we always succeed
    expect(sent.status).toBe('SENT');
    expect(sent.providerMessageId).toMatch(/^mock-/);
  }, 60000);

  it('rejects approve when customer has opted out of SMS', async () => {
    const draft = await service.draftForCustomer(garageId, optedOutId);
    await expect(
      service.approveAndSend(garageId, userId, draft.id, {}),
    ).rejects.toThrow(/opted out/i);
  }, 60000);

  it('marks a sent action as redeemed', async () => {
    const draft = await service.draftForCustomer(garageId, highRiskId);
    await service.approveAndSend(garageId, userId, draft.id, {});
    const redeemed = await service.markRedeemed(garageId, draft.id, {});
    expect(redeemed.status).toBe('REDEEMED');
    expect(redeemed.redeemedAt).toBeInstanceOf(Date);
  }, 60000);

  it('lists actions filtered by customer', async () => {
    const actions = await service.list(garageId, { customerId: highRiskId });
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) expect(a.customerId).toBe(highRiskId);
  });
});
