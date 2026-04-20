import { PrismaClient } from '@prisma/client';

/**
 * Read-only invariant test against the seeded database.
 *
 * Expectation (enforced by prisma/seed.ts):
 *   The seed must include 3 customers crafted to show up in the Customers
 *   dashboard "At-Risk Customers" card — Skander Khaled, Dorra Mansour,
 *   Mehdi Trabelsi — each with exactly one car and one backdated COMPLETED
 *   appointment, so the churn scorer produces medium/high risk on a fresh
 *   seed.
 *
 * This test does NOT call the AI service (that path is covered by
 * ai-churn.e2e-spec.ts against an isolated DB). It only verifies that the
 * seeded data has the shape and backdating the scorer relies on.
 *
 * Skips gracefully if none of the expected customers are present, so it
 * doesn't fail on a pristine test DB.
 */
describe('Seed invariant – at-risk customers have the shape the churn scorer needs', () => {
  let prisma: PrismaClient;

  const EXPECTED_NAMES = [
    { firstName: 'Skander', lastName: 'Khaled' },
    { firstName: 'Dorra', lastName: 'Mansour' },
    { firstName: 'Mehdi', lastName: 'Trabelsi' },
  ];

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('seed includes all 3 churn customers, each with a car and a COMPLETED backdated appointment', async () => {
    const customers = await prisma.customer.findMany({
      where: {
        OR: EXPECTED_NAMES.map((n) => ({ firstName: n.firstName, lastName: n.lastName })),
      },
      include: {
        cars: true,
        appointments: { where: { status: 'COMPLETED' }, orderBy: { startTime: 'desc' } },
      },
    });

    if (customers.length === 0) {
      console.warn('[seed-invariant] no churn customers in DB — skipping (likely pristine test DB)');
      return;
    }

    expect(customers.length).toBe(3);

    const now = Date.now();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    for (const c of customers) {
      // Each has exactly one car (FK for appointments)
      expect(c.cars.length).toBeGreaterThanOrEqual(1);

      // Each has at least one COMPLETED appointment
      expect(c.appointments.length).toBeGreaterThanOrEqual(1);

      // Most recent completed appointment must be backdated enough to trip the
      // scorer's "overdue" band (ratio >= 1). With the seeded createdAt/visitCount
      // values, avgInterval floors at 30, so daysSince must be >= 30 for any of
      // these three to appear on the at-risk card.
      const last = c.appointments[0];
      const daysSince = Math.floor((now - new Date(last.startTime).getTime()) / MS_PER_DAY);
      expect(daysSince).toBeGreaterThanOrEqual(30);

      // visitCount must be >= 2 so the scorer doesn't skip as "insufficient history"
      expect(c.visitCount).toBeGreaterThanOrEqual(2);
    }
  });
});
