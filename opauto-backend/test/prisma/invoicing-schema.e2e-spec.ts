import { PrismaClient, Prisma } from '@prisma/client';
import { execSync } from 'child_process';
import * as path from 'path';

// Use an isolated test database — never touch the dev database. This mirrors
// the pattern used in test/invoicing.e2e-spec.ts.
const TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('Invoicing fiscal-schema integration', () => {
  let prisma: PrismaClient;

  // Track ids created during the suite so afterAll can tidy up regardless of
  // which assertion failed.
  const createdGarageIds = new Set<string>();
  const createdCustomerIds = new Set<string>();
  const createdInvoiceIds = new Set<string>();

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;

    // Make sure the schema exists in the test DB (no-op if already in sync).
    try {
      execSync('npx prisma db push --skip-generate', {
        cwd: path.resolve(__dirname, '..', '..'),
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'pipe',
      });
    } catch {
      // db push may warn but still succeed
    }

    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cascade deletes on Garage clean up everything (customers, invoices,
    // quotes, credit notes, counters, service catalog, audit/delivery logs).
    for (const id of createdGarageIds) {
      await prisma.garage.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  /** Helper: build a fresh garage + customer pair scoped to a single test. */
  async function makeGarageWithCustomer(suffix: string) {
    const garage = await prisma.garage.create({
      data: {
        name: `Schema Test Garage ${suffix}`,
        currency: 'TND',
        taxRate: 19,
      },
    });
    createdGarageIds.add(garage.id);

    const customer = await prisma.customer.create({
      data: {
        garageId: garage.id,
        firstName: 'Schema',
        lastName: `Tester-${suffix}`,
        phone: `+216-99-${suffix}`,
      },
    });
    createdCustomerIds.add(customer.id);

    return { garage, customer };
  }

  it('creates a Quote with required fields and a line item', async () => {
    const { garage, customer } = await makeGarageWithCustomer('quote');

    const quote = await prisma.quote.create({
      data: {
        garageId: garage.id,
        customerId: customer.id,
        quoteNumber: `QT-${Date.now()}-quote`,
        status: 'DRAFT',
        subtotal: 100,
        taxAmount: 19,
        total: 119,
        lineItems: {
          create: [
            {
              description: 'Brake pads',
              quantity: 2,
              unitPrice: 50,
              total: 100,
              tvaRate: 19,
              tvaAmount: 19,
            },
          ],
        },
      },
      include: { lineItems: true },
    });

    expect(quote.id).toBeDefined();
    expect(quote.status).toBe('DRAFT');
    expect(quote.lineItems).toHaveLength(1);
    expect(quote.lineItems[0].tvaRate).toBe(19);
    expect(quote.convertedToInvoiceId).toBeNull();
  });

  it('creates an InvoiceCounter row and enforces the unique (garageId, kind, year) constraint', async () => {
    const { garage } = await makeGarageWithCustomer('counter');

    const counter = await prisma.invoiceCounter.create({
      data: {
        garageId: garage.id,
        kind: 'INVOICE',
        year: 2026,
        lastIssued: 0,
      },
    });
    expect(counter.id).toBeDefined();
    expect(counter.lastIssued).toBe(0);

    // Inserting a duplicate (garageId, kind, year) must throw P2002.
    await expect(
      prisma.invoiceCounter.create({
        data: {
          garageId: garage.id,
          kind: 'INVOICE',
          year: 2026,
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    } as Partial<Prisma.PrismaClientKnownRequestError>);
  });

  it('creates a ServiceCatalog row and enforces unique (garageId, code)', async () => {
    const { garage } = await makeGarageWithCustomer('catalog');

    const entry = await prisma.serviceCatalog.create({
      data: {
        garageId: garage.id,
        code: 'OIL-CHG',
        name: 'Oil change',
        defaultPrice: 80,
        defaultLaborHours: 0.5,
      },
    });
    expect(entry.id).toBeDefined();
    expect(entry.defaultTvaRate).toBe(19);
    expect(entry.isActive).toBe(true);

    await expect(
      prisma.serviceCatalog.create({
        data: {
          garageId: garage.id,
          code: 'OIL-CHG',
          name: 'Duplicate',
          defaultPrice: 90,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' } as Partial<Prisma.PrismaClientKnownRequestError>);
  });

  it('creates a DiscountAuditLog and a DeliveryLog tied to an Invoice', async () => {
    const { garage, customer } = await makeGarageWithCustomer('audit');

    const invoice = await prisma.invoice.create({
      data: {
        garageId: garage.id,
        customerId: customer.id,
        invoiceNumber: `INV-AUDIT-${Date.now()}`,
        status: 'DRAFT',
        subtotal: 200,
        taxAmount: 38,
        total: 239,
      },
    });
    createdInvoiceIds.add(invoice.id);

    const audit = await prisma.discountAuditLog.create({
      data: {
        invoiceId: invoice.id,
        percentage: 10,
        amount: 20,
        reason: 'Loyalty discount',
        approvedBy: 'user-uuid-stub',
      },
    });
    expect(audit.id).toBeDefined();
    expect(audit.approvedAt).toBeInstanceOf(Date);

    const delivery = await prisma.deliveryLog.create({
      data: {
        invoiceId: invoice.id,
        channel: 'EMAIL',
        recipient: 'customer@example.com',
      },
    });
    expect(delivery.id).toBeDefined();
    expect(delivery.status).toBe('PENDING');
    expect(delivery.sentAt).toBeNull();
  });

  it('cascades CreditNote deletes when its parent Invoice is deleted', async () => {
    const { garage, customer } = await makeGarageWithCustomer('cn');

    const invoice = await prisma.invoice.create({
      data: {
        garageId: garage.id,
        customerId: customer.id,
        invoiceNumber: `INV-CN-${Date.now()}`,
        status: 'PAID',
        subtotal: 100,
        taxAmount: 19,
        total: 120,
      },
    });

    const creditNote = await prisma.creditNote.create({
      data: {
        garageId: garage.id,
        invoiceId: invoice.id,
        creditNoteNumber: `CN-${Date.now()}`,
        reason: 'Customer return',
        subtotal: 50,
        taxAmount: 9.5,
        total: 59.5,
        lockedAt: new Date(),
        lineItems: {
          create: [
            {
              description: 'Returned wiper',
              quantity: 1,
              unitPrice: 50,
              total: 50,
            },
          ],
        },
      },
      include: { lineItems: true },
    });

    expect(creditNote.lineItems).toHaveLength(1);
    expect(creditNote.status).toBe('ISSUED');

    // Delete the parent invoice — credit note (and its line items) must
    // cascade away with it.
    await prisma.invoice.delete({ where: { id: invoice.id } });

    const remaining = await prisma.creditNote.findUnique({ where: { id: creditNote.id } });
    expect(remaining).toBeNull();

    const remainingLines = await prisma.creditNoteLineItem.findMany({
      where: { creditNoteId: creditNote.id },
    });
    expect(remainingLines).toHaveLength(0);
  });

  it('Quote.convertedToInvoiceId accepts null and a valid Invoice id', async () => {
    const { garage, customer } = await makeGarageWithCustomer('conv');

    // (a) null is allowed
    const quote = await prisma.quote.create({
      data: {
        garageId: garage.id,
        customerId: customer.id,
        quoteNumber: `QT-CONV-${Date.now()}`,
      },
    });
    expect(quote.convertedToInvoiceId).toBeNull();

    // (b) attaching a real invoice id is allowed
    const invoice = await prisma.invoice.create({
      data: {
        garageId: garage.id,
        customerId: customer.id,
        invoiceNumber: `INV-CONV-${Date.now()}`,
        quoteId: quote.id,
        subtotal: 100,
        taxAmount: 19,
        total: 120,
      },
    });
    createdInvoiceIds.add(invoice.id);

    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: { convertedToInvoiceId: invoice.id, status: 'APPROVED' },
    });
    expect(updated.convertedToInvoiceId).toBe(invoice.id);
    expect(updated.status).toBe('APPROVED');

    // The Quote ↔ Invoice relation is wired both ways: deleting the quote
    // should null out invoice.quoteId (onDelete SetNull), not cascade.
    await prisma.quote.delete({ where: { id: quote.id } });
    const invoiceAfter = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(invoiceAfter).not.toBeNull();
    expect(invoiceAfter!.quoteId).toBeNull();
  });
});
