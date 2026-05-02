import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NumberingService } from './numbering.service';
import { TaxCalculatorService } from './tax-calculator.service';
import { InvoicingService } from './invoicing.service';

// ── Helpers ─────────────────────────────────────────────────────

const GARAGE_ID = 'garage-cn-001';
const USER_ID = 'user-cn-001';
const INVOICE_ID = 'invoice-cn-001';
const PART_ID = 'part-cn-001';

function makeSourceInvoice(
  overrides: Partial<{
    status: string;
    total: number;
    partId: string;
  }> = {},
) {
  return {
    id: INVOICE_ID,
    garageId: GARAGE_ID,
    customerId: 'cust-1',
    carId: null,
    invoiceNumber: 'INV-2026-0001',
    status: overrides.status ?? 'PAID',
    subtotal: 100,
    taxAmount: 19,
    discount: 0,
    total: overrides.total ?? 119,
    fiscalStamp: 1,
    paidAt: new Date('2026-04-01'),
    lineItems: [
      {
        id: 'li-1',
        invoiceId: INVOICE_ID,
        description: 'Brake pads',
        quantity: 2,
        unitPrice: 50,
        total: 119,
        type: 'part',
        partId: overrides.partId ?? PART_ID,
        tvaRate: 19,
        tvaAmount: 19,
      },
    ],
    payments: [],
  };
}

function makeCreatedCreditNote(overrides: Partial<any> = {}) {
  return {
    id: 'cn-1',
    garageId: GARAGE_ID,
    invoiceId: INVOICE_ID,
    creditNoteNumber: 'AVO-2026-0001',
    reason: 'Defective part returned',
    status: 'ISSUED',
    subtotal: 50,
    taxAmount: 9.5,
    discount: 0,
    total: 59.5,
    restockParts: false,
    lockedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    lineItems: [],
    ...overrides,
  };
}

// ── Test Suite ──────────────────────────────────────────────────

describe('CreditNotesService – create', () => {
  let service: CreditNotesService;
  let prisma: any;
  let numbering: { next: jest.Mock };
  let taxCalculator: TaxCalculatorService;
  let invoicing: { recomputeStatus: jest.Mock };

  // Mock $transaction so we can assert interactions on the tx client
  let txClient: any;

  beforeEach(async () => {
    txClient = {
      creditNote: {
        create: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      part: {
        update: jest.fn(),
      },
    };

    prisma = {
      invoice: { findFirst: jest.fn() },
      creditNote: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (fn: any) => fn(txClient)),
    };

    numbering = { next: jest.fn().mockResolvedValue('AVO-2026-0001') };
    invoicing = {
      recomputeStatus: jest.fn().mockResolvedValue({
        oldStatus: 'PAID',
        newStatus: 'PAID',
        overCredited: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditNotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: NumberingService, useValue: numbering },
        TaxCalculatorService,
        { provide: InvoicingService, useValue: invoicing },
      ],
    }).compile();

    service = module.get<CreditNotesService>(CreditNotesService);
    taxCalculator = module.get<TaxCalculatorService>(TaxCalculatorService);
  });

  // ── Validation: missing invoice ─────────────────────────────

  it('throws NotFoundException when source invoice does not exist', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create(GARAGE_ID, USER_ID, {
        invoiceId: INVOICE_ID,
        reason: 'test',
        lineItems: [
          { description: 'x', quantity: 1, unitPrice: 50, tvaRate: 19 },
        ],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Validation: invoice in wrong state ──────────────────────

  it('rejects DRAFT invoice with state-specific message', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(
      makeSourceInvoice({ status: 'DRAFT' }),
    );

    await expect(
      service.create(GARAGE_ID, USER_ID, {
        invoiceId: INVOICE_ID,
        reason: 'test',
        lineItems: [
          { description: 'x', quantity: 1, unitPrice: 50, tvaRate: 19 },
        ],
      }),
    ).rejects.toThrow(/DRAFT/);
  });

  it('rejects CANCELLED invoice', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(
      makeSourceInvoice({ status: 'CANCELLED' }),
    );

    await expect(
      service.create(GARAGE_ID, USER_ID, {
        invoiceId: INVOICE_ID,
        reason: 'test',
        lineItems: [
          { description: 'x', quantity: 1, unitPrice: 50, tvaRate: 19 },
        ],
      }),
    ).rejects.toThrow(/CANCELLED/);
  });

  it('rejects OVERDUE invoice', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(
      makeSourceInvoice({ status: 'OVERDUE' }),
    );

    await expect(
      service.create(GARAGE_ID, USER_ID, {
        invoiceId: INVOICE_ID,
        reason: 'test',
        lineItems: [
          { description: 'x', quantity: 1, unitPrice: 50, tvaRate: 19 },
        ],
      }),
    ).rejects.toThrow(/OVERDUE/);
  });

  // ── Validation: partId not on source invoice ────────────────

  it('rejects credit-note line whose partId is not on the source invoice', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(makeSourceInvoice());

    await expect(
      service.create(GARAGE_ID, USER_ID, {
        invoiceId: INVOICE_ID,
        reason: 'test',
        lineItems: [
          {
            description: 'foreign part',
            quantity: 1,
            unitPrice: 50,
            tvaRate: 19,
            partId: 'part-NOT-on-invoice',
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ── Happy path: minimal create ──────────────────────────────

  it('creates credit note and calls numbering + tax calculator + recomputeStatus', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(makeSourceInvoice());
    txClient.creditNote.create.mockResolvedValueOnce(makeCreatedCreditNote());
    prisma.creditNote.findUnique.mockResolvedValueOnce({
      ...makeCreatedCreditNote(),
      invoice: {
        id: INVOICE_ID,
        invoiceNumber: 'INV-2026-0001',
        status: 'PAID',
        total: 119,
      },
    });

    const taxSpy = jest.spyOn(taxCalculator, 'calculate');

    const result = await service.create(GARAGE_ID, USER_ID, {
      invoiceId: INVOICE_ID,
      reason: 'Defective part returned',
      lineItems: [
        { description: 'Brake pads', quantity: 1, unitPrice: 50, tvaRate: 19 },
      ],
    });

    expect(numbering.next).toHaveBeenCalledWith(GARAGE_ID, 'CREDIT_NOTE');
    expect(taxSpy).toHaveBeenCalledWith(
      [{ quantity: 1, unitPrice: 50, tvaRate: 19, discountPct: undefined }],
      { invoiceDiscount: 0, fiscalStampEnabled: false },
    );
    expect(txClient.creditNote.create).toHaveBeenCalled();
    expect(invoicing.recomputeStatus).toHaveBeenCalledWith(INVOICE_ID);
    expect(result.creditNoteNumber).toBe('AVO-2026-0001');
    expect(result.sourceInvoiceStatus).toBe('PAID');
    expect(result.overCredited).toBe(false);
  });

  // ── restockParts=true triggers stock updates ────────────────

  it('with restockParts=true: creates StockMovement + increments Part.quantity', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(makeSourceInvoice());
    txClient.creditNote.create.mockResolvedValueOnce(
      makeCreatedCreditNote({ restockParts: true }),
    );
    prisma.creditNote.findUnique.mockResolvedValueOnce({
      ...makeCreatedCreditNote({ restockParts: true }),
      invoice: {
        id: INVOICE_ID,
        invoiceNumber: 'INV-2026-0001',
        status: 'PAID',
        total: 119,
      },
    });

    await service.create(GARAGE_ID, USER_ID, {
      invoiceId: INVOICE_ID,
      reason: 'returned',
      restockParts: true,
      lineItems: [
        {
          description: 'Brake pads',
          quantity: 2,
          unitPrice: 50,
          tvaRate: 19,
          partId: PART_ID,
        },
      ],
    });

    expect(txClient.stockMovement.create).toHaveBeenCalledTimes(1);
    expect(txClient.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        partId: PART_ID,
        type: 'in',
        quantity: 2,
        reason: 'credit_note:AVO-2026-0001',
      }),
    });
    expect(txClient.part.update).toHaveBeenCalledTimes(1);
    expect(txClient.part.update).toHaveBeenCalledWith({
      where: { id: PART_ID },
      data: { quantity: { increment: 2 } },
    });
  });

  // ── restockParts=false leaves stock alone ───────────────────

  it('with restockParts=false: does NOT touch StockMovement or Part', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(makeSourceInvoice());
    txClient.creditNote.create.mockResolvedValueOnce(makeCreatedCreditNote());
    prisma.creditNote.findUnique.mockResolvedValueOnce({
      ...makeCreatedCreditNote(),
      invoice: {
        id: INVOICE_ID,
        invoiceNumber: 'INV-2026-0001',
        status: 'PAID',
        total: 119,
      },
    });

    await service.create(GARAGE_ID, USER_ID, {
      invoiceId: INVOICE_ID,
      reason: 'discount',
      restockParts: false,
      lineItems: [
        {
          description: 'Brake pads',
          quantity: 1,
          unitPrice: 50,
          tvaRate: 19,
          partId: PART_ID,
        },
      ],
    });

    expect(txClient.stockMovement.create).not.toHaveBeenCalled();
    expect(txClient.part.update).not.toHaveBeenCalled();
  });

  // ── Lines without partId never touch stock ──────────────────

  it('with restockParts=true but line has no partId: skips stock movement for that line', async () => {
    prisma.invoice.findFirst.mockResolvedValueOnce(makeSourceInvoice());
    txClient.creditNote.create.mockResolvedValueOnce(
      makeCreatedCreditNote({ restockParts: true }),
    );
    prisma.creditNote.findUnique.mockResolvedValueOnce({
      ...makeCreatedCreditNote({ restockParts: true }),
      invoice: {
        id: INVOICE_ID,
        invoiceNumber: 'INV-2026-0001',
        status: 'PAID',
        total: 119,
      },
    });

    await service.create(GARAGE_ID, USER_ID, {
      invoiceId: INVOICE_ID,
      reason: 'labor refund',
      restockParts: true,
      lineItems: [
        {
          description: 'Diagnostic labor',
          quantity: 1,
          unitPrice: 80,
          tvaRate: 19,
          // no partId
        },
      ],
    });

    expect(txClient.stockMovement.create).not.toHaveBeenCalled();
    expect(txClient.part.update).not.toHaveBeenCalled();
  });

  // ── S-EDGE-013 (Sweep C-23) — per-line restock toggle ───────

  describe('S-EDGE-013 — per-line restockPart flag', () => {
    /**
     * Helper for per-line specs: source invoice with two part lines so we
     * can assert that one is restocked while the other is not.
     */
    function makeTwoPartInvoice() {
      const inv = makeSourceInvoice();
      inv.lineItems = [
        {
          id: 'li-A',
          invoiceId: INVOICE_ID,
          description: 'Brake pads (front)',
          quantity: 2,
          unitPrice: 50,
          total: 119,
          type: 'part',
          partId: 'part-A',
          tvaRate: 19,
          tvaAmount: 19,
        },
        {
          id: 'li-B',
          invoiceId: INVOICE_ID,
          description: 'Brake pads (rear)',
          quantity: 2,
          unitPrice: 50,
          total: 119,
          type: 'part',
          partId: 'part-B',
          tvaRate: 19,
          tvaAmount: 19,
        },
      ];
      return inv;
    }

    it('restocks only the lines whose own restockPart is true (other part line untouched)', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce(makeTwoPartInvoice());
      txClient.creditNote.create.mockResolvedValueOnce(
        makeCreatedCreditNote({ restockParts: true }),
      );
      prisma.creditNote.findUnique.mockResolvedValueOnce({
        ...makeCreatedCreditNote({ restockParts: true }),
        invoice: {
          id: INVOICE_ID,
          invoiceNumber: 'INV-2026-0001',
          status: 'PAID',
          total: 119,
        },
      });

      await service.create(GARAGE_ID, USER_ID, {
        invoiceId: INVOICE_ID,
        reason: 'partial restock',
        // Parent flag intentionally false — per-line wins.
        restockParts: false,
        lineItems: [
          {
            description: 'Brake pads (front)',
            quantity: 2,
            unitPrice: 50,
            tvaRate: 19,
            partId: 'part-A',
            restockPart: true,
          },
          {
            description: 'Brake pads (rear)',
            quantity: 2,
            unitPrice: 50,
            tvaRate: 19,
            partId: 'part-B',
            restockPart: false,
          },
        ],
      });

      // Exactly one StockMovement + one Part.update — for part-A only.
      expect(txClient.stockMovement.create).toHaveBeenCalledTimes(1);
      expect(txClient.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          partId: 'part-A',
          type: 'in',
          quantity: 2,
        }),
      });
      expect(txClient.part.update).toHaveBeenCalledTimes(1);
      expect(txClient.part.update).toHaveBeenCalledWith({
        where: { id: 'part-A' },
        data: { quantity: { increment: 2 } },
      });
    });

    it('persists restockPart on each created line item', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce(makeTwoPartInvoice());
      txClient.creditNote.create.mockResolvedValueOnce(
        makeCreatedCreditNote({ restockParts: true }),
      );
      prisma.creditNote.findUnique.mockResolvedValueOnce({
        ...makeCreatedCreditNote(),
        invoice: { id: INVOICE_ID, invoiceNumber: 'X', status: 'PAID', total: 0 },
      });

      await service.create(GARAGE_ID, USER_ID, {
        invoiceId: INVOICE_ID,
        reason: 'persist per-line flag',
        lineItems: [
          {
            description: 'Brake pads (front)',
            quantity: 1,
            unitPrice: 50,
            tvaRate: 19,
            partId: 'part-A',
            restockPart: true,
          },
          {
            description: 'Brake pads (rear)',
            quantity: 1,
            unitPrice: 50,
            tvaRate: 19,
            partId: 'part-B',
            restockPart: false,
          },
        ],
      });

      const createCall = txClient.creditNote.create.mock.calls[0][0];
      const persistedLines = createCall.data.lineItems.create as any[];
      expect(persistedLines.length).toBe(2);
      expect(persistedLines[0].restockPart).toBe(true);
      expect(persistedLines[1].restockPart).toBe(false);
    });

    it('defaults restockPart to true when the DTO field is omitted (parent restockParts=true)', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce(makeSourceInvoice());
      txClient.creditNote.create.mockResolvedValueOnce(
        makeCreatedCreditNote({ restockParts: true }),
      );
      prisma.creditNote.findUnique.mockResolvedValueOnce({
        ...makeCreatedCreditNote(),
        invoice: { id: INVOICE_ID, invoiceNumber: 'X', status: 'PAID', total: 0 },
      });

      await service.create(GARAGE_ID, USER_ID, {
        invoiceId: INVOICE_ID,
        reason: 'omitted flag',
        restockParts: true,
        lineItems: [
          {
            description: 'Brake pads',
            quantity: 1,
            unitPrice: 50,
            tvaRate: 19,
            partId: PART_ID,
            // restockPart deliberately omitted
          },
        ],
      });

      const createCall = txClient.creditNote.create.mock.calls[0][0];
      const persistedLines = createCall.data.lineItems.create as any[];
      expect(persistedLines[0].restockPart).toBe(true);
      // And stock should still be restored (parent default propagates).
      expect(txClient.stockMovement.create).toHaveBeenCalledTimes(1);
    });

    it('defaults restockPart to false when omitted AND parent restockParts is false', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce(makeSourceInvoice());
      txClient.creditNote.create.mockResolvedValueOnce(
        makeCreatedCreditNote({ restockParts: false }),
      );
      prisma.creditNote.findUnique.mockResolvedValueOnce({
        ...makeCreatedCreditNote(),
        invoice: { id: INVOICE_ID, invoiceNumber: 'X', status: 'PAID', total: 0 },
      });

      await service.create(GARAGE_ID, USER_ID, {
        invoiceId: INVOICE_ID,
        reason: 'no restock by default',
        restockParts: false,
        lineItems: [
          {
            description: 'Brake pads',
            quantity: 1,
            unitPrice: 50,
            tvaRate: 19,
            partId: PART_ID,
            // restockPart omitted; parent flag is false → resolved false.
          },
        ],
      });

      const createCall = txClient.creditNote.create.mock.calls[0][0];
      const persistedLines = createCall.data.lineItems.create as any[];
      expect(persistedLines[0].restockPart).toBe(false);
      // And no stock movement should fire.
      expect(txClient.stockMovement.create).not.toHaveBeenCalled();
      expect(txClient.part.update).not.toHaveBeenCalled();
    });

    it('aggregate parent restockParts persists true when ANY line opts in (even if parent flag was false)', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce(makeTwoPartInvoice());
      txClient.creditNote.create.mockResolvedValueOnce(
        makeCreatedCreditNote({ restockParts: true }),
      );
      prisma.creditNote.findUnique.mockResolvedValueOnce({
        ...makeCreatedCreditNote(),
        invoice: { id: INVOICE_ID, invoiceNumber: 'X', status: 'PAID', total: 0 },
      });

      await service.create(GARAGE_ID, USER_ID, {
        invoiceId: INVOICE_ID,
        reason: 'parent flag derived from lines',
        restockParts: false, // parent false; one line opts in via per-line flag
        lineItems: [
          {
            description: 'Brake pads (front)',
            quantity: 1,
            unitPrice: 50,
            tvaRate: 19,
            partId: 'part-A',
            restockPart: true,
          },
          {
            description: 'Brake pads (rear)',
            quantity: 1,
            unitPrice: 50,
            tvaRate: 19,
            partId: 'part-B',
            restockPart: false,
          },
        ],
      });

      const createCall = txClient.creditNote.create.mock.calls[0][0];
      // Aggregate parent flag is true because at least one line opted in.
      expect(createCall.data.restockParts).toBe(true);
    });

    it('aggregate parent restockParts is false when EVERY line opts out', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce(makeTwoPartInvoice());
      txClient.creditNote.create.mockResolvedValueOnce(
        makeCreatedCreditNote({ restockParts: false }),
      );
      prisma.creditNote.findUnique.mockResolvedValueOnce({
        ...makeCreatedCreditNote(),
        invoice: { id: INVOICE_ID, invoiceNumber: 'X', status: 'PAID', total: 0 },
      });

      await service.create(GARAGE_ID, USER_ID, {
        invoiceId: INVOICE_ID,
        reason: 'cash refund only',
        restockParts: true, // parent true; every line overrides to false
        lineItems: [
          {
            description: 'Brake pads (front)',
            quantity: 1,
            unitPrice: 50,
            tvaRate: 19,
            partId: 'part-A',
            restockPart: false,
          },
          {
            description: 'Brake pads (rear)',
            quantity: 1,
            unitPrice: 50,
            tvaRate: 19,
            partId: 'part-B',
            restockPart: false,
          },
        ],
      });

      const createCall = txClient.creditNote.create.mock.calls[0][0];
      expect(createCall.data.restockParts).toBe(false);
      expect(txClient.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  // ── Cross-garage isolation ──────────────────────────────────

  it('treats source invoice from another garage as not-found (no leak)', async () => {
    // findFirst with the {id, garageId} filter returns null when the
    // invoice exists but in a different garage.
    prisma.invoice.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create(GARAGE_ID, USER_ID, {
        invoiceId: INVOICE_ID,
        reason: 'cross-garage',
        lineItems: [
          { description: 'x', quantity: 1, unitPrice: 50, tvaRate: 19 },
        ],
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ── findAll / findOne ───────────────────────────────────────────

describe('CreditNotesService – findAll / findOne', () => {
  let service: CreditNotesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      creditNote: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditNotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: NumberingService, useValue: { next: jest.fn() } },
        TaxCalculatorService,
        { provide: InvoicingService, useValue: { recomputeStatus: jest.fn() } },
      ],
    }).compile();

    service = module.get<CreditNotesService>(CreditNotesService);
  });

  it('findAll filters by garageId and orders by createdAt desc', async () => {
    await service.findAll(GARAGE_ID);
    expect(prisma.creditNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { garageId: GARAGE_ID },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('findOne throws NotFoundException when missing', async () => {
    await expect(service.findOne('nope', GARAGE_ID)).rejects.toThrow(
      NotFoundException,
    );
  });
});
