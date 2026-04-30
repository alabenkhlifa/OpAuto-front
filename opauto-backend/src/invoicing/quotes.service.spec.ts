import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NumberingService } from './numbering.service';
import { TaxCalculatorService } from './tax-calculator.service';
import { InvoicingService } from './invoicing.service';

/**
 * Unit tests — quote state machine + approval handoff. Prisma,
 * NumberingService, and InvoicingService are mocked so we exercise
 * pure logic without touching a DB.
 */
describe('QuotesService (unit)', () => {
  const GARAGE_ID = 'garage-1';
  const QUOTE_ID = 'quote-1';

  let service: QuotesService;
  let prisma: any;
  let numbering: any;
  let invoicing: any;

  beforeEach(async () => {
    prisma = {
      garage: { findUnique: jest.fn() },
      quote: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      invoice: { update: jest.fn() },
    };
    numbering = { next: jest.fn() };
    invoicing = { create: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: NumberingService, useValue: numbering },
        TaxCalculatorService,
        { provide: InvoicingService, useValue: invoicing },
      ],
    }).compile();

    service = moduleRef.get(QuotesService);
  });

  function quoteFixture(overrides: Partial<any> = {}) {
    return {
      id: QUOTE_ID,
      garageId: GARAGE_ID,
      customerId: 'cus-1',
      carId: null,
      quoteNumber: 'DRAFT-12345678',
      status: 'DRAFT',
      subtotal: 100,
      taxAmount: 19,
      discount: 0,
      total: 119,
      validUntil: new Date('2026-12-31'),
      notes: null,
      lineItems: [
        {
          description: 'Service A',
          quantity: 1,
          unitPrice: 100,
          tvaRate: 19,
          type: 'service',
          partId: null,
          serviceCode: null,
          mechanicId: null,
          laborHours: null,
          discountPct: null,
        },
      ],
      ...overrides,
    };
  }

  // ── findOne not found ───────────────────────────────────────
  it('findOne throws 404 when not found / cross-tenant', async () => {
    prisma.quote.findFirst.mockResolvedValue(null);
    await expect(service.findOne(QUOTE_ID, GARAGE_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ── send: only DRAFT ────────────────────────────────────────
  it('send rejects non-DRAFT quotes', async () => {
    prisma.quote.findFirst.mockResolvedValue(quoteFixture({ status: 'SENT' }));
    await expect(service.send(QUOTE_ID, GARAGE_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('send: DRAFT → SENT and allocates DEV number', async () => {
    prisma.quote.findFirst.mockResolvedValue(quoteFixture({ status: 'DRAFT' }));
    numbering.next.mockResolvedValue('DEV-2026-0001');
    prisma.quote.update.mockResolvedValue({
      ...quoteFixture(),
      status: 'SENT',
      quoteNumber: 'DEV-2026-0001',
    });

    const result = await service.send(QUOTE_ID, GARAGE_ID);

    expect(numbering.next).toHaveBeenCalledWith(GARAGE_ID, 'QUOTE');
    expect(prisma.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: QUOTE_ID },
        data: expect.objectContaining({
          status: 'SENT',
          quoteNumber: 'DEV-2026-0001',
        }),
      }),
    );
    expect(result.status).toBe('SENT');
  });

  // ── approve: only SENT ──────────────────────────────────────
  it('approve rejects non-SENT quotes', async () => {
    prisma.quote.findFirst.mockResolvedValue(quoteFixture({ status: 'DRAFT' }));
    await expect(service.approve(QUOTE_ID, GARAGE_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('approve: SENT → APPROVED, creates a DRAFT invoice and links both ways', async () => {
    prisma.quote.findFirst.mockResolvedValue(quoteFixture({ status: 'SENT' }));
    invoicing.create.mockResolvedValue({ id: 'inv-new', status: 'DRAFT' });
    prisma.invoice.update.mockResolvedValue({});
    prisma.quote.update.mockResolvedValue({
      ...quoteFixture(),
      status: 'APPROVED',
      convertedToInvoiceId: 'inv-new',
    });

    const result = await service.approve(QUOTE_ID, GARAGE_ID);

    expect(invoicing.create).toHaveBeenCalledWith(
      GARAGE_ID,
      expect.objectContaining({
        customerId: 'cus-1',
        lineItems: expect.arrayContaining([
          expect.objectContaining({
            description: 'Service A',
            quantity: 1,
            unitPrice: 100,
            type: 'service',
          }),
        ]),
      }),
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-new' },
      data: { quoteId: QUOTE_ID },
    });
    expect(prisma.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'APPROVED',
          convertedToInvoiceId: 'inv-new',
        }),
      }),
    );
    expect(result.invoice.id).toBe('inv-new');
    expect(result.quote.status).toBe('APPROVED');
  });

  // ── reject: only SENT ───────────────────────────────────────
  it('reject rejects non-SENT quotes', async () => {
    prisma.quote.findFirst.mockResolvedValue(
      quoteFixture({ status: 'APPROVED' }),
    );
    await expect(service.reject(QUOTE_ID, GARAGE_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reject: SENT → REJECTED', async () => {
    prisma.quote.findFirst.mockResolvedValue(quoteFixture({ status: 'SENT' }));
    prisma.quote.update.mockResolvedValue({
      ...quoteFixture(),
      status: 'REJECTED',
    });
    const result = await service.reject(QUOTE_ID, GARAGE_ID);
    expect(result.status).toBe('REJECTED');
  });

  // ── update: only DRAFT ──────────────────────────────────────
  it('update rejects non-DRAFT quotes', async () => {
    prisma.quote.findFirst.mockResolvedValue(quoteFixture({ status: 'SENT' }));
    await expect(
      service.update(QUOTE_ID, GARAGE_ID, { notes: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── expireOldQuotes ─────────────────────────────────────────
  it('expireOldQuotes flips SENT quotes past validUntil to EXPIRED', async () => {
    prisma.quote.updateMany.mockResolvedValue({ count: 3 });
    const now = new Date('2026-05-01');

    const result = await service.expireOldQuotes(now);

    expect(prisma.quote.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'SENT',
        validUntil: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });
    expect(result.expired).toBe(3);
  });
});
