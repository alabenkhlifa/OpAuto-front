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
 * Skipped unless a real email provider is configured. With Mailtrap, use a
 * verified sending domain. With Resend sandbox, `ala.khliifa@gmail.com`
 * (double-i) is the only known valid recipient for a smoke check.
 *
 * To run locally:
 *   MAILTRAP_API_KEY=… MAILTRAP_FROM=no-reply@example.com EMAIL_PROVIDER=mailtrap \
 *     npm run test:e2e -- --testPathPattern=delivery-email
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

const MAILTRAP_KEY = process.env.MAILTRAP_API_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const SHOULD_RUN = !!MAILTRAP_KEY || !!RESEND_KEY;
const LIVE_EMAIL_TO = process.env.LIVE_EMAIL_TO || 'ala.khliifa@gmail.com';
const describeIfLive = SHOULD_RUN ? describe : describe.skip;

describeIfLive(
  'Live email delivery (e2e, requires a real email provider)',
  () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let delivery: DeliveryService;

    let garageId: string;
    let customerId: string;
    let invoiceId: string;

    beforeAll(async () => {
      process.env.DATABASE_URL = TEST_DATABASE_URL;
      process.env.EMAIL_PROVIDER =
        process.env.EMAIL_PROVIDER || (MAILTRAP_KEY ? 'mailtrap' : 'resend');

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
          email: LIVE_EMAIL_TO,
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
        await prisma.invoice
          .delete({ where: { id: invoiceId } })
          .catch(() => {});
      }
      if (customerId) {
        await prisma.customer
          .delete({ where: { id: customerId } })
          .catch(() => {});
      }
      if (garageId) {
        await prisma.garage.delete({ where: { id: garageId } }).catch(() => {});
      }
      await app.close();
    });

    it('sends an invoice to the live recipient and writes a SENT log', async () => {
      const result = await delivery.deliverInvoice(invoiceId, garageId, {
        channel: 'EMAIL',
      });
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].channel).toBe('EMAIL');
      expect(result.logs[0].status).toBe('SENT');
      expect(result.logs[0].recipient).toBe(LIVE_EMAIL_TO);
      expect(result.logs[0].sentAt).toBeInstanceOf(Date);
    }, 30000);
  },
);
