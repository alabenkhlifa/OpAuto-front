import { Test, TestingModule } from '@nestjs/testing';
import { InvoicingService } from './invoicing.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Helpers ──────────────────────────────────────────────────────

const GARAGE_ID = 'garage-test-001';
const CUSTOMER_ID = 'customer-test-001';

function makePayment(overrides: Partial<{
  id: string;
  amount: number;
  method: string;
  paidAt: Date;
  reference: string | null;
}> = {}) {
  return {
    id: overrides.id ?? 'pay-1',
    amount: overrides.amount ?? 100,
    method: overrides.method ?? 'CASH',
    paidAt: overrides.paidAt ?? new Date('2026-01-15T10:00:00Z'),
    reference: overrides.reference ?? null,
  };
}

function makeInvoice(overrides: Partial<{
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  payments: ReturnType<typeof makePayment>[];
}> = {}) {
  return {
    id: overrides.id ?? 'inv-1',
    garageId: GARAGE_ID,
    customerId: CUSTOMER_ID,
    carId: null,
    invoiceNumber: overrides.invoiceNumber ?? 'INV-202601-0001',
    status: overrides.status ?? 'PAID',
    subtotal: 100,
    taxAmount: 19,
    discount: 0,
    total: overrides.total ?? 119,
    dueDate: null,
    paidAt: new Date('2026-01-15T10:00:00Z'),
    notes: null,
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-15'),
    customer: { firstName: 'Ahmed', lastName: 'Ben Ali' },
    car: null,
    payments: overrides.payments ?? [],
    _count: { lineItems: 0, payments: (overrides.payments ?? []).length },
  };
}

// ── Test Suite ───────────────────────────────────────────────────

describe('InvoicingService – findAll', () => {
  let service: InvoicingService;
  let prisma: {
    invoice: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InvoicingService>(InvoicingService);
  });

  // ── 1. Query shape: payments select ────────────────────────

  it('includes payments with selected fields in the Prisma query', async () => {
    await service.findAll(GARAGE_ID);

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { garageId: GARAGE_ID },
        include: expect.objectContaining({
          payments: {
            select: {
              id: true,
              amount: true,
              method: true,
              paidAt: true,
              reference: true,
            },
          },
        }),
      }),
    );
  });

  // ── 2. Returned shape contains payments array ──────────────

  it('returns invoices with a payments array on each item', async () => {
    const invoiceWithPayments = makeInvoice({
      payments: [
        makePayment({ id: 'p1', amount: 100, method: 'CASH' }),
        makePayment({ id: 'p2', amount: 19, method: 'CARD' }),
      ],
    });
    const invoiceWithoutPayments = makeInvoice({
      id: 'inv-2',
      invoiceNumber: 'INV-202601-0002',
      status: 'DRAFT',
      payments: [],
    });
    prisma.invoice.findMany.mockResolvedValueOnce([
      invoiceWithPayments,
      invoiceWithoutPayments,
    ]);

    const result = await service.findAll(GARAGE_ID);

    expect(result).toHaveLength(2);
    for (const inv of result) {
      expect(inv).toHaveProperty('payments');
      expect(Array.isArray((inv as any).payments)).toBe(true);
    }
    expect((result[0] as any).payments).toHaveLength(2);
    expect((result[0] as any).payments[0]).toEqual(
      expect.objectContaining({ id: 'p1', amount: 100, method: 'CASH' }),
    );
    expect((result[1] as any).payments).toHaveLength(0);
  });

  // ── 3. Empty array when no invoices ────────────────────────

  it('returns empty array when no invoices exist for garage', async () => {
    prisma.invoice.findMany.mockResolvedValueOnce([]);

    const result = await service.findAll(GARAGE_ID);

    expect(result).toEqual([]);
  });

  // ── 4. Filters by garageId ─────────────────────────────────

  it('filters by garageId in the where clause', async () => {
    await service.findAll(GARAGE_ID);

    const call = prisma.invoice.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ garageId: GARAGE_ID });
  });

  // ── 5. Orders by createdAt desc ────────────────────────────

  it('orders invoices by createdAt descending', async () => {
    await service.findAll(GARAGE_ID);

    const call = prisma.invoice.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ createdAt: 'desc' });
  });

  // ── 6. Includes customer and car relations ─────────────────

  it('includes customer, car, payments, and _count relations', async () => {
    await service.findAll(GARAGE_ID);

    const call = prisma.invoice.findMany.mock.calls[0][0];
    expect(call.include).toHaveProperty('customer');
    expect(call.include).toHaveProperty('car');
    expect(call.include).toHaveProperty('payments');
    expect(call.include).toHaveProperty('_count');
    expect(call.include._count.select).toEqual({ lineItems: true, payments: true });
  });

  // ── 7. Payment select does NOT request sensitive/unused fields ─

  it('payment select only requests id, amount, method, paidAt, reference', async () => {
    await service.findAll(GARAGE_ID);

    const call = prisma.invoice.findMany.mock.calls[0][0];
    const paymentSelectKeys = Object.keys(call.include.payments.select).sort();
    expect(paymentSelectKeys).toEqual(['amount', 'id', 'method', 'paidAt', 'reference']);
  });
});
