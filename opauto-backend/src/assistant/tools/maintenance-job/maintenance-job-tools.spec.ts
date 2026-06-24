import { AssistantBlastTier } from '@prisma/client';
import { ToolRegistryService } from '../../tool-registry.service';
import { AssistantUserContext } from '../../types';
import { buildCreateInvoiceFromJobTool } from './create-invoice-from-job.tool';
import { buildRecordJobCustomerAcceptanceTool } from './record-job-customer-acceptance.tool';
import { buildRequestJobCustomerApprovalTool } from './request-job-customer-approval.tool';
import { buildGetJobTool } from './get-job.tool';
import { buildAddJobPartTool } from './add-job-part.tool';
import { buildSendJobCustomerApprovalEmailTool } from './send-job-customer-approval-email.tool';

const ownerCtx: AssistantUserContext = {
  userId: 'owner-1',
  garageId: 'garage-1',
  email: 'owner@example.com',
  role: 'OWNER',
  enabledModules: ['maintenance'],
  locale: 'en',
};

function maintenanceMock(overrides: Record<string, unknown> = {}) {
  return {
    findOne: jest.fn(),
    addPartLine: jest.fn(),
    listApprovals: jest.fn(),
    createApprovalRequest: jest.fn(),
    ownerRespondToApproval: jest.fn(),
    ...overrides,
  };
}

function fromJobMock(overrides: Record<string, unknown> = {}) {
  return {
    createFromJob: jest.fn(),
    ...overrides,
  };
}

function emailMock(overrides: Record<string, unknown> = {}) {
  return {
    send: jest
      .fn()
      .mockResolvedValue({ providerMessageId: 'msg-1', status: 'queued' }),
    ...overrides,
  };
}

describe('Maintenance job tools', () => {
  describe('get_job', () => {
    it('loads job details scoped to the garage and maps output', async () => {
      const maintenance = maintenanceMock({
        findOne: jest.fn().mockResolvedValue({
          id: 'job-1',
          title: 'Brake replacement',
          status: 'COMPLETED',
          car: {
            id: 'car-1',
            make: 'Peugeot',
            model: '208',
            year: 2024,
            licensePlate: 'TUN 123',
            customer: { id: 'cust-1', firstName: 'Aya', lastName: 'Ben' },
          },
          employee: { id: 'emp-1', firstName: 'Ari', lastName: 'M' },
          appointment: {
            id: 'apt-1',
            title: 'Routine',
            startTime: new Date('2026-06-22T08:00:00.000Z'),
            endTime: new Date('2026-06-22T10:00:00.000Z'),
          },
          tasks: [{ id: 't1' }, { id: 't2' }],
          photos: [{ id: 'p1' }],
          parts: [],
          approvals: [],
          approvalRequests: [],
          timelineEvents: [],
          createdAt: new Date('2026-06-20T09:00:00.000Z'),
          updatedAt: new Date('2026-06-20T12:00:00.000Z'),
        }),
      });

      const tool = buildGetJobTool(maintenance as never);
      const out = await tool.handler({ jobId: 'job-1' }, ownerCtx);

      expect(maintenance.findOne).toHaveBeenCalledWith('job-1', 'garage-1');
      expect(tool.blastTier).toBe(AssistantBlastTier.READ);
      expect(out.jobId).toBe('job-1');
      expect(out.counts).toEqual({ taskCount: 2, photoCount: 1, partCount: 0 });
      expect(out.appointment?.id).toBe('apt-1');
      expect(out.createdAt).toBe('2026-06-20T09:00:00.000Z');
    });
  });

  describe('add_job_part', () => {
    it('maps DTO and returns created part line as ISO timestamps', async () => {
      const line = {
        id: 'line-1',
        type: 'part',
        description: 'Oil filter',
        quantity: 2,
        unitPrice: 30,
        partId: 'part-1',
        partName: 'Filter',
        serviceCode: 'SRV-1',
        mechanicId: 'mech-1',
        laborHours: null,
        tvaRate: 19,
        discountPct: 0,
        createdAt: new Date('2026-06-21T07:00:00Z'),
        updatedAt: new Date('2026-06-21T07:00:00Z'),
      };
      const maintenance = maintenanceMock({
        addPartLine: jest.fn().mockResolvedValue(line),
      });
      const tool = buildAddJobPartTool(maintenance as never);

      const out = await tool.handler(
        {
          jobId: 'job-1',
          partId: 'part-1',
          type: 'part',
          quantity: 2,
          unitPrice: 30,
          description: 'Oil filter',
        },
        ownerCtx,
      );

      expect(maintenance.addPartLine).toHaveBeenCalledWith(
        'job-1',
        'garage-1',
        expect.objectContaining({
          partId: 'part-1',
          type: 'part',
          quantity: 2,
          unitPrice: 30,
        }),
      );
      expect(out).toEqual(
        expect.objectContaining({
          id: 'line-1',
          type: 'part',
          description: 'Oil filter',
          quantity: 2,
          unitPrice: 30,
          partId: 'part-1',
          createdAt: '2026-06-21T07:00:00.000Z',
          updatedAt: '2026-06-21T07:00:00.000Z',
        }),
      );
      expect(tool.blastTier).toBe(AssistantBlastTier.CONFIRM_WRITE);
    });
  });

  describe('request_job_customer_approval', () => {
    it('creates an approval request through maintenance service with requested fields', async () => {
      const maintenance = maintenanceMock({
        createApprovalRequest: jest.fn().mockResolvedValue({
          id: 'apr-1',
          maintenanceJobId: 'job-1',
          status: 'PENDING',
          requestedAmount: 420,
          summary: 'Brake work',
          customerName: 'Aya Ben',
          customerEmail: 'aya@example.com',
          customerPhone: '+216123',
          requestedBy: 'owner-1',
          responseChannel: 'email',
          responseNote: null,
          respondedBy: null,
          respondedAt: null,
          createdAt: new Date('2026-06-21T08:00:00.000Z'),
          updatedAt: new Date('2026-06-21T08:00:00.000Z'),
        }),
      });
      const tokens = {
        sign: jest.fn().mockReturnValue('signed-job-approval-token'),
      };
      const tool = buildRequestJobCustomerApprovalTool(
        maintenance as never,
        tokens as never,
      );
      const out = await tool.handler(
        {
          jobId: 'job-1',
          requestedAmount: 420,
          summary: 'Brake work',
          customerEmail: 'aya@example.com',
          sendVia: 'email',
        },
        ownerCtx,
      );

      expect(maintenance.createApprovalRequest).toHaveBeenCalledWith(
        'job-1',
        'garage-1',
        'owner-1',
        {
          requestedAmount: 420,
          summary: 'Brake work',
          customerName: undefined,
          customerEmail: 'aya@example.com',
          customerPhone: undefined,
          sendVia: 'email',
          note: undefined,
        },
      );
      expect(tool.blastTier).toBe(AssistantBlastTier.CONFIRM_WRITE);
      expect(tokens.sign).toHaveBeenCalledWith('apr-1', 'jobApproval');
      expect(out.id).toBe('apr-1');
      expect(out.status).toBe('PENDING');
      expect(out.publicUrl).toBe(
        '/public/job-approvals/signed-job-approval-token',
      );
    });
  });

  describe('send_job_customer_approval_email', () => {
    it('creates an approval request and sends a formatted public-link email to the job customer', async () => {
      const maintenance = maintenanceMock({
        findOne: jest.fn().mockResolvedValue({
          id: 'job-1',
          title: 'Approval job',
          car: {
            make: 'TestMake',
            model: 'WorkflowCar',
            licensePlate: 'AI-MNT-034633',
            customer: {
              firstName: 'AI',
              lastName: 'Maintenance',
              email: 'ala.khllifa+Job1@gmail.com',
              phone: '+21600000000',
            },
          },
          parts: [
            {
              description: 'Cabin air filter',
              quantity: 1,
              unitPrice: 18,
              tvaRate: 19,
              discountPct: 0,
            },
            {
              description: 'Oil',
              quantity: 1,
              unitPrice: 85,
              tvaRate: 19,
              discountPct: 0,
            },
          ],
          approvalRequests: [],
        }),
        createApprovalRequest: jest.fn().mockResolvedValue({
          id: 'apr-1',
          maintenanceJobId: 'job-1',
          status: 'PENDING',
        }),
      });
      const email = emailMock();
      const tokens = { sign: jest.fn().mockReturnValue('signed-token') };
      const tool = buildSendJobCustomerApprovalEmailTool(
        maintenance as never,
        email as never,
        tokens as never,
        'https://opauto.test',
      );

      const out = await tool.handler({ jobId: 'job-1' }, ownerCtx);

      expect(tool.blastTier).toBe(AssistantBlastTier.CONFIRM_WRITE);
      expect(maintenance.findOne).toHaveBeenCalledWith('job-1', 'garage-1');
      expect(maintenance.createApprovalRequest).toHaveBeenCalledWith(
        'job-1',
        'garage-1',
        'owner-1',
        expect.objectContaining({
          customerName: 'AI Maintenance',
          customerEmail: 'ala.khllifa+Job1@gmail.com',
          customerPhone: '+21600000000',
          sendVia: 'email',
        }),
      );
      const approvalDto = (maintenance.createApprovalRequest as jest.Mock).mock
        .calls[0][3];
      expect(approvalDto.requestedAmount).toBeCloseTo(122.57);
      expect(tokens.sign).toHaveBeenCalledWith('apr-1', 'jobApproval');
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ala.khllifa+Job1@gmail.com',
          replyTo: 'owner@example.com',
          subject:
            'Maintenance approval request for TestMake WorkflowCar (AI-MNT-034633)',
          html: expect.stringContaining(
            'https://opauto.test/public/job-approvals/signed-token',
          ),
          text: expect.stringContaining(
            'https://opauto.test/public/job-approvals/signed-token',
          ),
        }),
      );
      const sent = (email.send as jest.Mock).mock.calls[0][0];
      expect(sent.html).toContain('Review and approve');
      expect(sent.html).toContain('Cabin air filter');
      expect(sent.html).toContain('Oil');
      expect(out).toEqual(
        expect.objectContaining({
          providerMessageId: 'msg-1',
          status: 'queued',
          to: 'ala.khllifa+Job1@gmail.com',
          approvalRequestId: 'apr-1',
          publicUrl: 'https://opauto.test/public/job-approvals/signed-token',
        }),
      );
    });

    it('reuses an existing pending approval request for the same customer email', async () => {
      const maintenance = maintenanceMock({
        findOne: jest.fn().mockResolvedValue({
          id: 'job-1',
          car: {
            make: 'TestMake',
            model: 'WorkflowCar',
            licensePlate: 'AI-MNT-034633',
            customer: {
              firstName: 'AI',
              lastName: 'Maintenance',
              email: 'ala.khllifa+Job1@gmail.com',
            },
          },
          parts: [],
          approvalRequests: [
            {
              id: 'apr-existing',
              status: 'PENDING',
              customerEmail: 'ala.khllifa+Job1@gmail.com',
            },
          ],
        }),
        createApprovalRequest: jest.fn(),
      });
      const email = emailMock();
      const tokens = { sign: jest.fn().mockReturnValue('existing-token') };
      const tool = buildSendJobCustomerApprovalEmailTool(
        maintenance as never,
        email as never,
        tokens as never,
        'https://opauto.test/',
      );

      const out = await tool.handler({ jobId: 'job-1' }, ownerCtx);

      expect(maintenance.createApprovalRequest).not.toHaveBeenCalled();
      expect(tokens.sign).toHaveBeenCalledWith('apr-existing', 'jobApproval');
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ala.khllifa+Job1@gmail.com',
          html: expect.stringContaining(
            'https://opauto.test/public/job-approvals/existing-token',
          ),
        }),
      );
      expect(out.approvalRequestId).toBe('apr-existing');
      expect(out.publicUrl).toBe(
        'https://opauto.test/public/job-approvals/existing-token',
      );
    });

    it('returns the public approval URL when the email provider rejects delivery', async () => {
      const maintenance = maintenanceMock({
        findOne: jest.fn().mockResolvedValue({
          id: 'job-1',
          car: {
            make: 'TestMake',
            model: 'WorkflowCar',
            licensePlate: 'AI-MNT-034633',
            customer: {
              firstName: 'AI',
              lastName: 'Maintenance',
              email: 'ala.khllifa+Job1@gmail.com',
            },
          },
          parts: [],
          approvalRequests: [],
        }),
        createApprovalRequest: jest.fn().mockResolvedValue({
          id: 'apr-1',
          maintenanceJobId: 'job-1',
          status: 'PENDING',
        }),
      });
      const email = emailMock({
        send: jest
          .fn()
          .mockRejectedValue(new Error('Resend test-mode recipient rejected')),
      });
      const tokens = { sign: jest.fn().mockReturnValue('signed-token') };
      const tool = buildSendJobCustomerApprovalEmailTool(
        maintenance as never,
        email as never,
        tokens as never,
        'https://opauto.test',
      );

      const out = await tool.handler({ jobId: 'job-1' }, ownerCtx);

      expect(out).toEqual(
        expect.objectContaining({
          error: 'send_failed',
          message: 'Resend test-mode recipient rejected',
          status: 'failed',
          to: 'ala.khllifa+Job1@gmail.com',
          approvalRequestId: 'apr-1',
          publicUrl: 'https://opauto.test/public/job-approvals/signed-token',
        }),
      );
    });
  });

  describe('record_job_customer_acceptance', () => {
    it('records approved ownership response for a request id', async () => {
      const maintenance = maintenanceMock({
        ownerRespondToApproval: jest.fn().mockResolvedValue({
          id: 'apr-1',
          maintenanceJobId: 'job-1',
          status: 'APPROVED',
          requestedAmount: 420,
          summary: 'Brake work',
          responseChannel: 'phone',
          responseNote: 'Approved on call',
          respondedBy: 'owner-1',
          respondedAt: new Date('2026-06-21T09:00:00.000Z'),
        }),
      });
      const tool = buildRecordJobCustomerAcceptanceTool(maintenance as never);
      const out = await tool.handler(
        {
          jobId: 'job-1',
          requestId: 'apr-1',
          responseChannel: 'phone',
          responseNote: 'Approved on call',
        },
        ownerCtx,
      );

      expect(maintenance.ownerRespondToApproval).toHaveBeenCalledWith(
        'job-1',
        'apr-1',
        'garage-1',
        'owner-1',
        expect.objectContaining({
          status: 'APPROVED',
          responseChannel: 'phone',
          responseNote: 'Approved on call',
        }),
      );
      expect(tool.blastTier).toBe(AssistantBlastTier.CONFIRM_WRITE);
      expect(out.status).toBe('APPROVED');
      expect(out.respondedBy).toBe('owner-1');
    });
  });

  describe('create_invoice_from_job', () => {
    it('creates a draft invoice from job and maps fields', async () => {
      const fromJob = fromJobMock({
        createFromJob: jest.fn().mockResolvedValue({
          id: 'inv-1',
          invoiceNumber: 'INV-2026-001',
          status: 'DRAFT',
          total: 525,
          currency: 'TND',
          customerId: 'cust-1',
          carId: 'car-1',
          dueDate: new Date('2026-07-05T00:00:00.000Z'),
        }),
      });
      const tool = buildCreateInvoiceFromJobTool(fromJob as never);

      const out = await tool.handler(
        { jobId: 'job-1', dueDate: '2026-07-05', notes: 'First draft' },
        ownerCtx,
      );

      expect(fromJob.createFromJob).toHaveBeenCalledWith('job-1', 'garage-1', {
        dueDate: '2026-07-05',
        notes: 'First draft',
      });
      expect(tool.blastTier).toBe(AssistantBlastTier.CONFIRM_WRITE);
      expect(out).toEqual({
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-2026-001',
        status: 'DRAFT',
        total: 525,
        currency: 'TND',
        customerId: 'cust-1',
        carId: 'car-1',
        dueDate: '2026-07-05T00:00:00.000Z',
      });
    });
  });

  describe('tool schema validation', () => {
    const registry = new ToolRegistryService();
    const maintenance = maintenanceMock();
    const fromJob = fromJobMock();
    const getJob = buildGetJobTool(maintenance as never);
    const addPart = buildAddJobPartTool(maintenance as never);
    const requestApproval = buildRequestJobCustomerApprovalTool(
      maintenance as never,
    );
    const recordAcceptance = buildRecordJobCustomerAcceptanceTool(
      maintenance as never,
    );
    const createInvoiceFromJob = buildCreateInvoiceFromJobTool(
      fromJob as never,
    );
    const sendJobCustomerApprovalEmail = buildSendJobCustomerApprovalEmailTool(
      maintenance as never,
      emailMock() as never,
      { sign: jest.fn().mockReturnValue('token') } as never,
      'https://opauto.test',
    );

    registry.register(getJob);
    registry.register(addPart);
    registry.register(requestApproval);
    registry.register(recordAcceptance);
    registry.register(createInvoiceFromJob);
    registry.register(sendJobCustomerApprovalEmail);

    it('validates uuid required fields for read tool', () => {
      expect(
        registry.validateArgs('get_job', { jobId: 'not-a-uuid' }).valid,
      ).toBe(false);
      expect(
        registry.validateArgs('get_job', {
          jobId: '00000000-0000-0000-0000-000000000000',
        }).valid,
      ).toBe(true);
    });

    it('validates add_job_part request body shape', () => {
      expect(
        registry.validateArgs('add_job_part', {
          jobId: '00000000-0000-0000-0000-000000000000',
          type: 'invalid',
        }).valid,
      ).toBe(false);
      expect(
        registry.validateArgs('add_job_part', {
          jobId: '00000000-0000-0000-0000-000000000000',
          type: 'part',
          quantity: 1,
        }).valid,
      ).toBe(true);
    });

    it('requires IDs for approval workflows', () => {
      expect(
        registry.validateArgs('record_job_customer_acceptance', {
          jobId: '00000000-0000-0000-0000-000000000000',
        }).valid,
      ).toBe(false);
      expect(
        registry.validateArgs('record_job_customer_acceptance', {
          jobId: '00000000-0000-0000-0000-000000000000',
          requestId: '00000000-0000-0000-0000-000000000000',
        }).valid,
      ).toBe(true);
    });

    it('marks write tools as CONFIRM_WRITE', () => {
      expect(requestApproval.blastTier).toBe(AssistantBlastTier.CONFIRM_WRITE);
      expect(recordAcceptance.blastTier).toBe(AssistantBlastTier.CONFIRM_WRITE);
      expect(createInvoiceFromJob.blastTier).toBe(
        AssistantBlastTier.CONFIRM_WRITE,
      );
      expect(sendJobCustomerApprovalEmail.blastTier).toBe(
        AssistantBlastTier.CONFIRM_WRITE,
      );
    });
  });
});
