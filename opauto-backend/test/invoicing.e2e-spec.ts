import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { InvoicingService } from '../src/invoicing/invoicing.service';
import { execSync } from 'child_process';
import * as path from 'path';

// Use an isolated test database — never touch the dev database
const TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('InvoicingService (integration – findAll with payments)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: InvoicingService;

  // IDs created inside this test suite so we can clean up after
  let garageId: string;
  let customerId: string;
  let invoiceId: string;
  let paymentId: string;

  beforeAll(async () => {
    // Point this suite at the isolated test DB
    process.env.DATABASE_URL = TEST_DATABASE_URL;

    // Make sure the schema exists in the test DB (no-op if already in sync)
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
    await app.init();

    prisma = app.get(PrismaService);
    service = app.get(InvoicingService);

    // Create isolated fixture data (garage + customer + invoice + payment).
    // We do NOT truncate or reseed the database — we only create our own
    // rows and delete them in afterAll, so this suite can coexist with
    // any data already present in opauto_test.
    const garage = await prisma.garage.create({
      data: {
        name: 'Invoicing Integration Garage',
        currency: 'TND',
        taxRate: 19,
      },
    });
    garageId = garage.id;

    const customer = await prisma.customer.create({
      data: {
        garageId,
        firstName: 'Integration',
        lastName: 'Tester',
        phone: '+216-99-000-000',
      },
    });
    customerId = customer.id;

    const invoice = await prisma.invoice.create({
      data: {
        garageId,
        customerId,
        invoiceNumber: `INV-IT-${Date.now()}`,
        status: 'PAID',
        subtotal: 200,
        taxAmount: 38,
        discount: 0,
        total: 238,
      },
    });
    invoiceId = invoice.id;

    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount: 238,
        method: 'CASH',
        reference: 'INT-TEST-REF',
      },
    });
    paymentId = payment.id;
  });

  afterAll(async () => {
    // Clean up in FK-safe order: payment -> invoice -> customer -> garage
    if (paymentId) await prisma.payment.delete({ where: { id: paymentId } }).catch(() => {});
    if (invoiceId) await prisma.invoice.delete({ where: { id: invoiceId } }).catch(() => {});
    if (customerId) await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    if (garageId) await prisma.garage.delete({ where: { id: garageId } }).catch(() => {});
    await app.close();
  });

  it('returns the invoice with a populated payments array', async () => {
    const invoices = await service.findAll(garageId);

    expect(invoices).toHaveLength(1);
    const inv = invoices[0] as any;
    expect(inv.id).toBe(invoiceId);
    expect(inv.payments).toBeDefined();
    expect(Array.isArray(inv.payments)).toBe(true);
    expect(inv.payments).toHaveLength(1);
  });

  it('payments[0].amount matches the created payment', async () => {
    const invoices = await service.findAll(garageId);
    const inv = invoices[0] as any;

    expect(inv.payments[0].amount).toBe(238);
    expect(inv.payments[0].method).toBe('CASH');
    expect(inv.payments[0].reference).toBe('INT-TEST-REF');
    expect(inv.payments[0].id).toBe(paymentId);
    expect(inv.payments[0].paidAt).toBeInstanceOf(Date);
  });

  it('payments select excludes fields not in the select list (e.g. invoiceId)', async () => {
    const invoices = await service.findAll(garageId);
    const inv = invoices[0] as any;

    // The select only returns id, amount, method, paidAt, reference.
    // invoiceId and the invoice relation must NOT be part of the returned payment shape.
    expect(inv.payments[0]).not.toHaveProperty('invoiceId');
    expect(inv.payments[0]).not.toHaveProperty('invoice');
  });

  it('findAll scopes by garageId — does not leak invoices from other garages', async () => {
    // Create a second garage with its own invoice; it must not appear
    // in findAll(garageId) for our first garage.
    const otherGarage = await prisma.garage.create({
      data: { name: 'Other Garage', currency: 'TND', taxRate: 19 },
    });
    const otherCustomer = await prisma.customer.create({
      data: {
        garageId: otherGarage.id,
        firstName: 'Other',
        lastName: 'Person',
        phone: '+216-99-111-111',
      },
    });
    const otherInvoice = await prisma.invoice.create({
      data: {
        garageId: otherGarage.id,
        customerId: otherCustomer.id,
        invoiceNumber: `INV-IT-OTHER-${Date.now()}`,
        status: 'DRAFT',
        subtotal: 50,
        taxAmount: 9.5,
        total: 59.5,
      },
    });

    try {
      const invoices = await service.findAll(garageId);
      const ids = invoices.map((i: any) => i.id);
      expect(ids).toContain(invoiceId);
      expect(ids).not.toContain(otherInvoice.id);
    } finally {
      await prisma.invoice.delete({ where: { id: otherInvoice.id } }).catch(() => {});
      await prisma.customer.delete({ where: { id: otherCustomer.id } }).catch(() => {});
      await prisma.garage.delete({ where: { id: otherGarage.id } }).catch(() => {});
    }
  });
});
