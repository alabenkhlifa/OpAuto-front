import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FromJobService } from './from-job.service';
import { InvoicingService } from './invoicing.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Unit tests — FromJobService converts a maintenance job to a DRAFT
 * invoice. Prisma + InvoicingService are mocked so we can exercise the
 * branches without a real DB.
 */
describe('FromJobService (unit)', () => {
  const GARAGE_ID = 'garage-1';
  const JOB_ID = 'job-1';

  let service: FromJobService;
  let prisma: any;
  let invoicing: any;

  beforeEach(async () => {
    prisma = {
      maintenanceJob: { findUnique: jest.fn() },
      invoice: { findFirst: jest.fn(), update: jest.fn() },
      stockMovement: { findMany: jest.fn() },
      invoiceLineItem: { findMany: jest.fn(), update: jest.fn() },
    };
    invoicing = {
      create: jest.fn(),
      findOne: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FromJobService,
        { provide: PrismaService, useValue: prisma },
        { provide: InvoicingService, useValue: invoicing },
      ],
    }).compile();

    service = moduleRef.get(FromJobService);
  });

  // ── Helpers ────────────────────────────────────────────────

  function jobFixture(overrides: Partial<any> = {}) {
    return {
      id: JOB_ID,
      garageId: GARAGE_ID,
      carId: 'car-1',
      employeeId: 'emp-1',
      actualHours: 2,
      estimatedHours: 2,
      employee: {
        id: 'emp-1',
        firstName: 'Sami',
        lastName: 'Trabelsi',
        hourlyRate: 30,
      },
      car: {
        id: 'car-1',
        customerId: 'cus-1',
        make: 'Peugeot',
        model: '208',
        licensePlate: '123 TUN 4567',
      },
      ...overrides,
    };
  }

  // ── 1. Job not found ───────────────────────────────────────
  it('throws 404 when the job does not exist', async () => {
    prisma.maintenanceJob.findUnique.mockResolvedValue(null);
    await expect(
      service.createFromJob(JOB_ID, GARAGE_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── 2. Cross-garage 404 (no leak) ──────────────────────────
  it('throws 404 (not 403) when the job belongs to another garage', async () => {
    prisma.maintenanceJob.findUnique.mockResolvedValue(
      jobFixture({ garageId: 'other-garage' }),
    );
    await expect(
      service.createFromJob(JOB_ID, GARAGE_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── 3. Already-linked rejection (409) ──────────────────────
  it('throws 409 when an invoice already references the job', async () => {
    prisma.maintenanceJob.findUnique.mockResolvedValue(jobFixture());
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0001',
      status: 'SENT',
    });
    await expect(
      service.createFromJob(JOB_ID, GARAGE_ID),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // ── 4. Empty job (no parts, no labor) → 400 ────────────────
  it('throws 400 when no parts and no labor can be derived', async () => {
    prisma.maintenanceJob.findUnique.mockResolvedValue(
      jobFixture({
        actualHours: 0,
        estimatedHours: 0,
        employee: null,
        employeeId: null,
      }),
    );
    prisma.invoice.findFirst.mockResolvedValue(null);
    prisma.stockMovement.findMany.mockResolvedValue([]);

    await expect(
      service.createFromJob(JOB_ID, GARAGE_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── 5. Happy path — parts + labor ──────────────────────────
  it('builds parts + labor lines and calls InvoicingService.create', async () => {
    prisma.maintenanceJob.findUnique.mockResolvedValue(jobFixture());
    prisma.invoice.findFirst.mockResolvedValue(null);
    prisma.stockMovement.findMany.mockResolvedValue([
      {
        partId: 'part-1',
        quantity: 2,
        part: {
          id: 'part-1',
          name: 'Brake pads',
          unitPrice: 50,
          garageId: GARAGE_ID,
        },
      },
      {
        partId: 'part-2',
        quantity: 1,
        part: {
          id: 'part-2',
          name: 'Oil filter',
          unitPrice: 12,
          garageId: GARAGE_ID,
        },
      },
    ]);
    invoicing.create.mockResolvedValue({
      id: 'inv-new',
      lineItems: [
        { id: 'li-1', type: 'part' },
        { id: 'li-2', type: 'part' },
        { id: 'li-3', type: 'labor' },
      ],
    });
    prisma.invoice.update.mockResolvedValue({});
    prisma.invoiceLineItem.findMany.mockResolvedValue([
      { id: 'li-1', type: 'part' },
      { id: 'li-2', type: 'part' },
      { id: 'li-3', type: 'labor' },
    ]);
    prisma.invoiceLineItem.update.mockResolvedValue({});
    invoicing.findOne.mockResolvedValue({ id: 'inv-new', status: 'DRAFT' });

    const result = await service.createFromJob(JOB_ID, GARAGE_ID);

    expect(invoicing.create).toHaveBeenCalledWith(
      GARAGE_ID,
      expect.objectContaining({
        customerId: 'cus-1',
        carId: 'car-1',
        lineItems: expect.arrayContaining([
          expect.objectContaining({
            description: 'Brake pads',
            quantity: 2,
            unitPrice: 50,
            type: 'part',
          }),
          expect.objectContaining({
            description: 'Oil filter',
            quantity: 1,
            unitPrice: 12,
            type: 'part',
          }),
          expect.objectContaining({
            description: expect.stringMatching(/Labor — Sami Trabelsi/),
            quantity: 2,
            unitPrice: 30,
            type: 'labor',
          }),
        ]),
      }),
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-new' },
      data: { maintenanceJobId: JOB_ID },
    });
    expect(result).toEqual({ id: 'inv-new', status: 'DRAFT' });
  });

  // ── 6. Missing hourlyRate — labor line at 0 (TODO comment) ─
  it('emits a labor line with unitPrice=0 when employee.hourlyRate is missing', async () => {
    prisma.maintenanceJob.findUnique.mockResolvedValue(
      jobFixture({
        employee: {
          id: 'emp-1',
          firstName: 'No',
          lastName: 'Rate',
          hourlyRate: null,
        },
      }),
    );
    prisma.invoice.findFirst.mockResolvedValue(null);
    prisma.stockMovement.findMany.mockResolvedValue([]);
    invoicing.create.mockResolvedValue({
      id: 'inv-new',
      lineItems: [{ id: 'li-1', type: 'labor' }],
    });
    prisma.invoice.update.mockResolvedValue({});
    prisma.invoiceLineItem.findMany.mockResolvedValue([
      { id: 'li-1', type: 'labor' },
    ]);
    prisma.invoiceLineItem.update.mockResolvedValue({});
    invoicing.findOne.mockResolvedValue({ id: 'inv-new' });

    await service.createFromJob(JOB_ID, GARAGE_ID);

    expect(invoicing.create).toHaveBeenCalledWith(
      GARAGE_ID,
      expect.objectContaining({
        lineItems: [
          expect.objectContaining({
            type: 'labor',
            unitPrice: 0,
          }),
        ],
      }),
    );
  });
});
