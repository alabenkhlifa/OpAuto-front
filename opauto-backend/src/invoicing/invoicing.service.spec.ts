import { Test, TestingModule } from '@nestjs/testing';
import { InvoicingService } from './invoicing.service';
import { PrismaService } from '../prisma/prisma.service';
import { NumberingService } from './numbering.service';
import { TaxCalculatorService } from './tax-calculator.service';

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
        // findAll() doesn't touch these, so a bare stub is enough.
        { provide: NumberingService, useValue: { next: jest.fn() } },
        TaxCalculatorService,
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

// ─────────────────────────────────────────────────────────────────
// Per-line tvaRate + new line-level fields (regression: DRAFT save
// alignment between FE mapToBackend and BE CreateLineItemDto).
// ─────────────────────────────────────────────────────────────────

describe('InvoicingService – create() / update() per-line fields', () => {
  let service: InvoicingService;
  let prisma: {
    garage: { findUnique: jest.Mock };
    invoice: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
    };
    discountAuditLog: { createMany: jest.Mock };
    user: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  function buildPrismaMock(overrides: { garageDefaultTva?: number; fiscalStampEnabled?: boolean } = {}) {
    const tx = {
      invoice: {
        create: jest.fn().mockImplementation((args) =>
          Promise.resolve({ id: 'inv-new', ...args.data, lineItems: args.data.lineItems?.create ?? [] }),
        ),
        update: jest.fn().mockImplementation((args) =>
          Promise.resolve({ id: args.where.id, ...args.data }),
        ),
      },
      discountAuditLog: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    return {
      garage: {
        findUnique: jest.fn().mockResolvedValue({
          defaultTvaRate: overrides.garageDefaultTva ?? 19,
          fiscalStampEnabled: overrides.fiscalStampEnabled ?? true,
          currency: 'TND',
          discountAuditThresholdPct: 5,
        }),
      },
      invoice: {
        create: tx.invoice.create,
        update: tx.invoice.update,
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      discountAuditLog: tx.discountAuditLog,
      user: { findFirst: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
  }

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicingService,
        { provide: PrismaService, useValue: prisma },
        { provide: NumberingService, useValue: { next: jest.fn() } },
        TaxCalculatorService,
      ],
    }).compile();

    service = module.get<InvoicingService>(InvoicingService);
  });

  // ── 1. create() honors per-line tvaRate (7 / 13 / 19) ─────────

  it('create() persists each line\'s own tvaRate (mixed 7 / 13 / 19) and produces a per-rate TVA breakdown', async () => {
    await service.create(GARAGE_ID, {
      customerId: CUSTOMER_ID,
      dueDate: '2026-05-30',
      lineItems: [
        { description: 'Reduced-rate part', quantity: 1, unitPrice: 100, tvaRate: 7 },
        { description: 'Mid-rate part',     quantity: 2, unitPrice: 50,  tvaRate: 13 },
        { description: 'Standard service',  quantity: 1, unitPrice: 200, tvaRate: 19 },
      ],
    } as any);

    const txCall = prisma.$transaction.mock.calls[0][0];
    expect(txCall).toEqual(expect.any(Function));

    const createCall = (await prisma.$transaction.mock.results[0].value);
    // The tx mock above echoes back `data`, so we can inspect what was sent.
    // Pull the recorded args from the inner tx mock instead.
    const txMockArgs = (prisma.$transaction.mock.calls[0][0] as any);

    // Re-invoke the captured tx function with a spy tx to capture the create payload.
    const innerCreate = jest.fn().mockResolvedValue({ id: 'inv-x', lineItems: [] });
    await txMockArgs({
      invoice: { create: innerCreate },
      discountAuditLog: { createMany: jest.fn() },
    });

    const created = innerCreate.mock.calls[0][0];
    const persistedLines = created.data.lineItems.create as any[];

    expect(persistedLines).toHaveLength(3);
    expect(persistedLines[0].tvaRate).toBe(7);
    expect(persistedLines[1].tvaRate).toBe(13);
    expect(persistedLines[2].tvaRate).toBe(19);

    // Per-line TVA amounts must be computed from each line's own rate,
    // NOT a flat garage default applied to the whole subtotal.
    expect(persistedLines[0].tvaAmount).toBeCloseTo(7, 3);    // 100 × 7%
    expect(persistedLines[1].tvaAmount).toBeCloseTo(13, 3);   // 100 × 13%
    expect(persistedLines[2].tvaAmount).toBeCloseTo(38, 3);   // 200 × 19%

    // Aggregate totals: subtotalHT = 100 + 100 + 200 = 400; totalTVA = 7+13+38 = 58
    expect(created.data.subtotal).toBeCloseTo(400, 3);
    expect(created.data.taxAmount).toBeCloseTo(58, 3);
  });

  // ── 2. create() falls back to garage.defaultTvaRate when omitted ─

  it('create() falls back to garage.defaultTvaRate for lines that omit tvaRate', async () => {
    prisma = buildPrismaMock({ garageDefaultTva: 13 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicingService,
        { provide: PrismaService, useValue: prisma },
        { provide: NumberingService, useValue: { next: jest.fn() } },
        TaxCalculatorService,
      ],
    }).compile();
    service = module.get<InvoicingService>(InvoicingService);

    await service.create(GARAGE_ID, {
      customerId: CUSTOMER_ID,
      lineItems: [
        { description: 'No-rate line', quantity: 1, unitPrice: 100 }, // tvaRate omitted
      ],
    } as any);

    const txFn = prisma.$transaction.mock.calls[0][0];
    const innerCreate = jest.fn().mockResolvedValue({ id: 'inv-x', lineItems: [] });
    await txFn({
      invoice: { create: innerCreate },
      discountAuditLog: { createMany: jest.fn() },
    });

    const persistedLines = innerCreate.mock.calls[0][0].data.lineItems.create as any[];
    expect(persistedLines[0].tvaRate).toBe(13); // garage default, not the hard-coded 19
    expect(persistedLines[0].tvaAmount).toBeCloseTo(13, 3); // 100 × 13%
  });

  // ── 3. create() persists partId / serviceCode / mechanicId / laborHours ─

  it('create() persists partId, serviceCode, mechanicId, laborHours from the DTO', async () => {
    await service.create(GARAGE_ID, {
      customerId: CUSTOMER_ID,
      lineItems: [
        {
          description: 'Brake pads',
          quantity: 1,
          unitPrice: 80,
          tvaRate: 19,
          partId: 'part-001',
          serviceCode: 'BRAKE_SERVICE',
          mechanicId: 'mech-001',
          laborHours: 1.5,
        },
      ],
    } as any);

    const txFn = prisma.$transaction.mock.calls[0][0];
    const innerCreate = jest.fn().mockResolvedValue({ id: 'inv-x', lineItems: [] });
    await txFn({
      invoice: { create: innerCreate },
      discountAuditLog: { createMany: jest.fn() },
    });

    const line = innerCreate.mock.calls[0][0].data.lineItems.create[0];
    expect(line).toEqual(
      expect.objectContaining({
        partId: 'part-001',
        serviceCode: 'BRAKE_SERVICE',
        mechanicId: 'mech-001',
        laborHours: 1.5,
      }),
    );
  });

  // ── 4. update() recomputes totals using per-line tvaRate ──────

  it('update() recomputes totals using per-line tvaRate and persists new fields on replaced lines', async () => {
    // findOne is called inside update() — it goes via prisma.invoice.findFirst.
    prisma.invoice.findFirst.mockResolvedValueOnce({
      id: 'inv-1',
      garageId: GARAGE_ID,
      status: 'DRAFT',
      total: 0,
      discount: 0,
      lineItems: [],
      invoiceNumber: 'DRAFT-abc',
    });

    await service.update('inv-1', GARAGE_ID, {
      lineItems: [
        { description: 'Reduced',  quantity: 1, unitPrice: 100, tvaRate: 7,  partId: 'p1' },
        { description: 'Standard', quantity: 1, unitPrice: 100, tvaRate: 19, mechanicId: 'm1', laborHours: 2 },
      ],
    } as any);

    const txFn = prisma.$transaction.mock.calls[0][0];
    const innerUpdate = jest.fn().mockResolvedValue({ id: 'inv-1' });
    await txFn({
      invoice: { update: innerUpdate },
      discountAuditLog: { createMany: jest.fn() },
    });

    const data = innerUpdate.mock.calls[0][0].data;
    // Aggregate: subtotal = 200, totalTVA = 7 + 19 = 26.
    expect(data.subtotal).toBeCloseTo(200, 3);
    expect(data.taxAmount).toBeCloseTo(26, 3);

    const replacedLines = data.lineItems.create as any[];
    expect(replacedLines[0]).toEqual(
      expect.objectContaining({ tvaRate: 7, partId: 'p1', tvaAmount: expect.any(Number) }),
    );
    expect(replacedLines[1]).toEqual(
      expect.objectContaining({ tvaRate: 19, mechanicId: 'm1', laborHours: 2 }),
    );
  });
});
