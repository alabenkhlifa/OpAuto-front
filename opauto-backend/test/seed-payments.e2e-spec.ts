import { PrismaClient } from '@prisma/client';

/**
 * Read-only invariant test against the seeded database.
 *
 * Expectation (enforced by prisma/seed.ts):
 *   Every Invoice with status = 'PAID' must have at least one Payment row
 *   whose summed amount is >= invoice.total.
 *
 * This test never writes or mutates data — it only reads. It assumes the seed
 * has already been run against the configured DATABASE_URL (e.g. via
 * `npx prisma db seed`). If no PAID invoices are present, the test is skipped
 * so it doesn't fail in a pristine test DB.
 */
describe('Seed invariant – PAID invoices have matching payments', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Use the DATABASE_URL already configured for the environment.
    // Do NOT override — we intentionally read whichever DB was seeded.
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('every PAID invoice has at least one payment row', async () => {
    const paidInvoices = await prisma.invoice.findMany({
      where: { status: 'PAID' },
      select: { id: true, invoiceNumber: true, total: true },
    });

    if (paidInvoices.length === 0) {
      console.warn('[seed-invariant] no PAID invoices in DB — skipping');
      return;
    }

    const sums = await prisma.payment.groupBy({
      by: ['invoiceId'],
      _sum: { amount: true },
      where: { invoiceId: { in: paidInvoices.map(i => i.id) } },
    });
    const sumByInvoiceId = new Map(sums.map(s => [s.invoiceId, s._sum.amount ?? 0]));

    const missing = paidInvoices.filter(inv => !sumByInvoiceId.has(inv.id));

    expect(missing).toEqual([]);
  });

  it('summed payment amount >= invoice.total for every PAID invoice', async () => {
    const paidInvoices = await prisma.invoice.findMany({
      where: { status: 'PAID' },
      select: { id: true, invoiceNumber: true, total: true },
    });

    if (paidInvoices.length === 0) {
      console.warn('[seed-invariant] no PAID invoices in DB — skipping');
      return;
    }

    const sums = await prisma.payment.groupBy({
      by: ['invoiceId'],
      _sum: { amount: true },
      where: { invoiceId: { in: paidInvoices.map(i => i.id) } },
    });
    const sumByInvoiceId = new Map(sums.map(s => [s.invoiceId, s._sum.amount ?? 0]));

    // Allow for floating-point jitter (amounts are stored as Float in Postgres)
    const EPSILON = 0.01;
    const underpaid = paidInvoices.filter(inv => {
      const paid = sumByInvoiceId.get(inv.id) ?? 0;
      return paid + EPSILON < inv.total;
    });

    expect(underpaid).toEqual([]);
  });

  it('seeded payments use CASH method (per seed convention)', async () => {
    const paidInvoices = await prisma.invoice.findMany({
      where: { status: 'PAID' },
      select: { id: true },
    });

    if (paidInvoices.length === 0) {
      console.warn('[seed-invariant] no PAID invoices in DB — skipping');
      return;
    }

    // Only assert on payments linked to seed-PAID invoices, so this test
    // ignores any ad-hoc payments inserted by other flows.
    const payments = await prisma.payment.findMany({
      where: { invoiceId: { in: paidInvoices.map(i => i.id) } },
      select: { method: true },
    });

    expect(payments.length).toBeGreaterThan(0);
    // Every payment tied to a seeded PAID invoice should be CASH
    for (const p of payments) {
      expect(p.method).toBe('CASH');
    }
  });
});
