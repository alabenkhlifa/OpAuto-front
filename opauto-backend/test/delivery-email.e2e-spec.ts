import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DeliveryService } from '../src/invoicing/delivery.service';

/**
 * Live email integration — Phase 4.2.
 *
 * Skipped unless `RESEND_API_KEY` is set in the env. Per project memory
 * `reference_resend_sandbox`, the sandbox sender only delivers to
 * `ala.khliifa@gmail.com` (double-i), so that's the only valid recipient
 * we can use for an end-to-end smoke check without losing emails to
 * the bit bucket.
 *
 * To run locally:
 *   RESEND_API_KEY=… RESEND_FROM=onboarding@resend.dev EMAIL_PROVIDER=resend \
 *     npm run test:e2e -- --testPathPattern=delivery-email
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

const RESEND_KEY = process.env.RESEND_API_KEY;
const SHOULD_RUN = !!RESEND_KEY;
const describeIfLive = SHOULD_RUN ? describe : describe.skip;

describeIfLive('Live email delivery (e2e, requires RESEND_API_KEY)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let delivery: DeliveryService;

  let garageId: string;
  let customerId: string;
  let invoiceId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.EMAIL_PROVIDER = 'resend';

    try {
      execSync('npx prisma db push --skip-generate', {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'pipe',
      });
    } catch {
      // ignore
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    delivery = app.get(DeliveryService);

    const stamp = Date.now();
    const garage = await prisma.garage.create({
      data: { name: 'Live Email Test Garage', currency: 'TND' },
    });
    garageId = garage.id;

    const customer = await prisma.customer.create({
      data: {
        garageId,
        firstName: 'Sandbox',
        lastName: 'Recipient',
        // Per project memory: only this address works in Resend sandbox.
        email: 'ala.khliifa@gmail.com',
        phone: '+216 23 000 000',
      },
    });
    customerId = customer.id;

    const invoice = await prisma.invoice.create({
      data: {
        garageId,
        customerId,
        invoiceNumber: `INV-LIVE-${stamp}`,
        status: 'SENT',
        subtotal: 100,
        taxAmount: 19,
        total: 120,
        lineItems: {
          create: [
            {
              description: 'Live email test line',
              quantity: 1,
              unitPrice: 100,
              tvaRate: 19,
              tvaAmount: 19,
              total: 119,
            },
          ],
        },
      },
    });
    invoiceId = invoice.id;
  });

  afterAll(async () => {
    if (invoiceId) {
      await prisma.deliveryLog
        .deleteMany({ where: { invoiceId } })
        .catch(() => {});
      await prisma.invoiceLineItem
        .deleteMany({ where: { invoiceId } })
        .catch(() => {});
      await prisma.invoice.delete({ where: { id: invoiceId } }).catch(() => {});
    }
    if (customerId) {
      await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    }
    if (garageId) {
      await prisma.garage.delete({ where: { id: garageId } }).catch(() => {});
    }
    await app.close();
  });

  it('sends an invoice to the sandbox-allowed address and writes a SENT log', async () => {
    const result = await delivery.deliverInvoice(invoiceId, garageId, {
      channel: 'EMAIL',
    });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].channel).toBe('EMAIL');
    expect(result.logs[0].status).toBe('SENT');
    expect(result.logs[0].recipient).toBe('ala.khliifa@gmail.com');
    expect(result.logs[0].sentAt).toBeInstanceOf(Date);
  }, 30000);
});
