import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalStatus } from '@prisma/client';

describe('MaintenanceService (unit)', () => {
  let service: MaintenanceService;
  let prisma: {
    maintenanceJob: any;
    maintenanceJobLineItem: any;
    maintenanceJobApprovalRequest: any;
    maintenanceJobTimelineEvent: any;
    part: any;
  };

  const GARAGE_ID = 'garage-1';
  const JOB_ID = 'job-1';

  beforeEach(async () => {
    prisma = {
      maintenanceJob: {
        findFirst: jest.fn(),
      },
      maintenanceJobLineItem: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      maintenanceJobApprovalRequest: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      maintenanceJobTimelineEvent: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      part: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(MaintenanceService);
  });

  function jobFixture(overrides: Partial<any> = {}) {
    return {
      id: JOB_ID,
      garageId: GARAGE_ID,
      status: 'PENDING',
      title: 'Brake service',
      ...overrides,
    };
  }

  it('listParts checks tenant scope and returns maintenance job lines', async () => {
    prisma.maintenanceJob.findFirst.mockResolvedValue(jobFixture());
    prisma.maintenanceJobLineItem.findMany.mockResolvedValue([{ id: 'line-1' }]);

    const rows = await service.listParts(JOB_ID, GARAGE_ID);

    expect(rows).toEqual([{ id: 'line-1' }]);
    expect(prisma.maintenanceJobLineItem.findMany).toHaveBeenCalledWith({
      where: { maintenanceJobId: JOB_ID },
      include: expect.objectContaining({
        part: expect.any(Object),
        mechanic: expect.any(Object),
      }),
      orderBy: { createdAt: 'desc' },
    });
  });

  it('addPartLine(type=part) requires partId and resolves part metadata', async () => {
    prisma.maintenanceJob.findFirst.mockResolvedValue(jobFixture());
    prisma.part.findFirst.mockResolvedValue({
      id: 'part-1',
      name: 'Brake disc',
      unitPrice: 42,
    });
    prisma.maintenanceJobLineItem.create.mockResolvedValue({ id: 'line-1' });

    const created = await service.addPartLine(JOB_ID, GARAGE_ID, {
      type: 'part',
      partId: 'part-1',
      quantity: 2,
      description: 'Brake disc',
    });

    expect(created).toEqual({ id: 'line-1' });
    expect(prisma.maintenanceJobLineItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          maintenanceJobId: JOB_ID,
          type: 'part',
          partId: 'part-1',
          quantity: 2,
        }),
      }),
    );
    expect(prisma.maintenanceJobTimelineEvent.create).toHaveBeenCalledWith({
      data: {
        maintenanceJobId: JOB_ID,
        eventType: 'part_added',
        actorUserId: undefined,
        details: { lineId: 'line-1', partId: 'part-1', type: 'part' },
      },
    });
  });

  it('addPartLine(type=labor) rejects partId payload', async () => {
    prisma.maintenanceJob.findFirst.mockResolvedValue(jobFixture());
    await expect(
      service.addPartLine(JOB_ID, GARAGE_ID, {
        type: 'labor',
        quantity: 1,
        partId: 'part-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createApprovalRequest records an approval row and timeline event', async () => {
    prisma.maintenanceJob.findFirst.mockResolvedValue(jobFixture());
    prisma.maintenanceJobApprovalRequest.create.mockResolvedValue({
      id: 'apr-1',
      status: ApprovalStatus.PENDING,
      maintenanceJobId: JOB_ID,
      requestedAmount: 150,
    });

    const req = await service.createApprovalRequest(
      JOB_ID,
      GARAGE_ID,
      'owner-1',
      { requestedAmount: 150, summary: 'Approve final invoice' },
    );

    expect(req).toEqual({ id: 'apr-1', status: ApprovalStatus.PENDING, maintenanceJobId: JOB_ID, requestedAmount: 150 });
    expect(prisma.maintenanceJobApprovalRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        maintenanceJobId: JOB_ID,
        requestedBy: 'owner-1',
        requestedAmount: 150,
        summary: 'Approve final invoice',
      }),
    });
    expect(prisma.maintenanceJobTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        maintenanceJobId: JOB_ID,
        eventType: 'approval_requested',
      }),
    });
  });

  it('ownerRespondToApproval updates open request and appends owner + generic response timeline entries', async () => {
    prisma.maintenanceJob.findFirst.mockResolvedValue(jobFixture());
    prisma.maintenanceJobApprovalRequest.findFirst.mockResolvedValue({
      id: 'apr-1',
      status: ApprovalStatus.PENDING,
      maintenanceJobId: JOB_ID,
      maintenanceJob: { id: JOB_ID },
    });
    prisma.maintenanceJobApprovalRequest.update.mockResolvedValue({
      id: 'apr-1',
      status: ApprovalStatus.APPROVED,
    });

    await service.ownerRespondToApproval(
      JOB_ID,
      'apr-1',
      GARAGE_ID,
      'owner-1',
      { status: ApprovalStatus.APPROVED, responseNote: 'Customer accepted', responseChannel: 'phone' },
    );

    expect(prisma.maintenanceJobApprovalRequest.update).toHaveBeenCalledWith({
      where: { id: 'apr-1' },
      data: expect.objectContaining({
        status: ApprovalStatus.APPROVED,
        responseNote: 'Customer accepted',
        responseChannel: 'phone',
        respondedBy: 'owner-1',
        respondedAt: expect.any(Date),
      }),
    });
    expect(prisma.maintenanceJobTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        maintenanceJobId: JOB_ID,
        eventType: 'approval_responded',
      }),
    });
    expect(prisma.maintenanceJobTimelineEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        maintenanceJobId: JOB_ID,
        eventType: 'approval_owner_recorded',
      }),
    });
  });

  it('ownerRespondToApproval throws for a closed approval request', async () => {
    prisma.maintenanceJob.findFirst.mockResolvedValue(jobFixture());
    prisma.maintenanceJobApprovalRequest.findFirst.mockResolvedValue({
      id: 'apr-2',
      status: ApprovalStatus.APPROVED,
      maintenanceJobId: JOB_ID,
    });

    await expect(
      service.ownerRespondToApproval(
        JOB_ID,
        'apr-2',
        GARAGE_ID,
        'owner-1',
        { status: ApprovalStatus.APPROVED },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.maintenanceJobApprovalRequest.update).not.toHaveBeenCalled();
  });

  it('respondToApproval throws NotFound if request not found', async () => {
    prisma.maintenanceJobApprovalRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.respondToApproval('apr-404', GARAGE_ID, ApprovalStatus.APPROVED, {
        responseNote: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
