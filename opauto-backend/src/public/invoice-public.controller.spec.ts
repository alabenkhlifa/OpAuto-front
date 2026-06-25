import { ConfigService } from '@nestjs/config';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InvoicePublicController } from './invoice-public.controller';
import { InvoiceTokenService } from './invoice-token.service';

/**
 * Unit tests for InvoiceTokenService and InvoicePublicController.
 * Heavy integration (real DB + JWT round-trip) lives in the e2e suite;
 * here we cover the pure logic — token sign/verify, expiry, type
 * mismatch — and the controller's VIEWED side-effect.
 */
describe('InvoiceTokenService', () => {
  let svc: InvoiceTokenService;
  let jwt: JwtService;

  beforeEach(() => {
    jwt = new JwtService({});
    const config = {
      get: jest.fn((k: string) => {
        if (k === 'INVOICE_TOKEN_SECRET') return 'unit-test-secret';
        if (k === 'INVOICE_TOKEN_EXPIRES_IN') return '30d';
        return undefined;
      }),
    } as unknown as ConfigService;
    svc = new InvoiceTokenService(jwt, config);
  });

  it('signs and verifies a token round-trip', () => {
    const token = svc.sign('inv-1', 'invoice');
    expect(typeof token).toBe('string');
    const payload = svc.verify(token);
    expect(payload.id).toBe('inv-1');
    expect(payload.type).toBe('invoice');
  });

  it('rejects a token signed with a different secret', () => {
    const otherJwt = new JwtService({});
    const bad = otherJwt.sign(
      { id: 'x', type: 'invoice' },
      { secret: 'wrong' },
    );
    expect(() => svc.verify(bad)).toThrow(UnauthorizedException);
  });

  it('rejects a token whose type does not match expected', () => {
    const t = svc.sign('q-1', 'quote');
    expect(() => svc.verify(t, 'invoice')).toThrow(UnauthorizedException);
    expect(() => svc.verify(t, 'creditNote')).toThrow(UnauthorizedException);
    // matching type passes
    expect(svc.verify(t, 'quote').id).toBe('q-1');
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(
      { id: 'inv-1', type: 'invoice' },
      { secret: 'unit-test-secret', expiresIn: '-1s' },
    );
    expect(() => svc.verify(expired)).toThrow(UnauthorizedException);
    try {
      svc.verify(expired);
    } catch (e: any) {
      expect(e.message.toLowerCase()).toContain('expired');
    }
  });

  it('rejects a token without id/type claims', () => {
    const malformed = jwt.sign(
      { foo: 'bar' },
      { secret: 'unit-test-secret', expiresIn: '1h' },
    );
    expect(() => svc.verify(malformed)).toThrow(UnauthorizedException);
  });

  it('throws TokenExpiredError mapping cleanly', () => {
    // sanity: our verify catches TokenExpiredError correctly
    const verify = jest.spyOn(jwt, 'verify').mockImplementationOnce(() => {
      throw new TokenExpiredError('jwt expired', new Date(0));
    });
    expect(() => svc.verify('whatever')).toThrow(/expired/i);
    verify.mockRestore();
  });
});

describe('InvoicePublicController', () => {
  let controller: InvoicePublicController;
  let prisma: any;
  let pdf: any;
  let tokens: any;
  let res: any;

  beforeEach(() => {
    prisma = {
      invoice: {
        findUnique: jest.fn(),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      quote: { findUnique: jest.fn() },
      creditNote: { findUnique: jest.fn() },
      maintenanceJobApprovalRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      maintenanceJobTimelineEvent: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      assistantToolCall: {
        findFirst: jest.fn(),
      },
      assistantMessage: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    pdf = {
      renderInvoice: jest.fn(async () => Buffer.from('%PDF-1.4 fake-inv')),
      renderQuote: jest.fn(async () => Buffer.from('%PDF-1.4 fake-q')),
      renderCreditNote: jest.fn(async () => Buffer.from('%PDF-1.4 fake-cn')),
    };
    tokens = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    res = makeRes();
    controller = new InvoicePublicController(prisma, pdf, tokens);
  });

  describe('getInvoicePdf', () => {
    it('verifies token, loads invoice, returns PDF, transitions SENT → VIEWED', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'inv-1', type: 'invoice' });
      prisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        garageId: 'g-1',
        status: 'SENT',
        invoiceNumber: 'INV-2026-0001',
      });

      await controller.getInvoicePdf('signed.token', res);

      expect(tokens.verify).toHaveBeenCalledWith('signed.token', 'invoice');
      expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
        where: { id: 'inv-1', status: 'SENT' },
        data: { status: 'VIEWED' },
      });
      expect(res.headers['Content-Type']).toBe('application/pdf');
      expect(res.headers['Content-Disposition']).toContain(
        'invoice-INV-2026-0001.pdf',
      );
      expect(res.bodyBuffer?.slice(0, 4).toString()).toBe('%PDF');
    });

    it('does NOT update status when invoice is PAID', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'inv-1', type: 'invoice' });
      prisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        garageId: 'g-1',
        status: 'PAID',
        invoiceNumber: 'INV-2026-0002',
      });

      await controller.getInvoicePdf('signed.token', res);
      expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    });

    it('still serves PDF when the VIEWED update throws', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'inv-1', type: 'invoice' });
      prisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        garageId: 'g-1',
        status: 'SENT',
        invoiceNumber: 'INV-2026-0003',
      });
      prisma.invoice.updateMany.mockRejectedValueOnce(new Error('DB busy'));

      await controller.getInvoicePdf('signed.token', res);
      expect(res.bodyBuffer?.slice(0, 4).toString()).toBe('%PDF');
    });

    /**
     * S-EDGE-015 — Public token after invoice deletion → 404 (not 401).
     * The token verifies cleanly; the resource is gone (e.g. DRAFT was
     * deleted before the link was opened). Surface NotFoundException so
     * the recipient sees "Invoice not found" rather than implying their
     * token is invalid.
     */
    it('S-EDGE-015 — throws NotFoundException (not Unauthorized) when invoice is missing', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'gone', type: 'invoice' });
      prisma.invoice.findUnique.mockResolvedValueOnce(null);
      await expect(
        controller.getInvoicePdf('signed.token', res),
      ).rejects.toThrow(NotFoundException);
    });

    it('rethrows token verification errors', async () => {
      tokens.verify.mockImplementationOnce(() => {
        throw new UnauthorizedException('Invalid token');
      });
      await expect(controller.getInvoicePdf('bad', res)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getQuotePdf', () => {
    it('serves quote PDF and never touches invoice status', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'q-1', type: 'quote' });
      prisma.quote.findUnique.mockResolvedValueOnce({
        id: 'q-1',
        garageId: 'g-1',
        quoteNumber: 'DEV-2026-0001',
      });
      await controller.getQuotePdf('t', res);
      expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
      expect(pdf.renderQuote).toHaveBeenCalledWith('q-1', 'g-1', {
        publicToken: 't',
      });
    });

    // S-EDGE-015 parity for quotes — token verifies, quote gone → 404.
    it('S-EDGE-015 — NotFoundException when quote is missing', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'gone', type: 'quote' });
      prisma.quote.findUnique.mockResolvedValueOnce(null);
      await expect(controller.getQuotePdf('t', res)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCreditNotePdf', () => {
    it('serves credit note PDF', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'cn-1', type: 'creditNote' });
      prisma.creditNote.findUnique.mockResolvedValueOnce({
        id: 'cn-1',
        garageId: 'g-1',
        creditNoteNumber: 'AVO-2026-0001',
      });
      await controller.getCreditNotePdf('t', res);
      expect(pdf.renderCreditNote).toHaveBeenCalledWith('cn-1', 'g-1', {
        publicToken: 't',
      });
    });

    // S-EDGE-015 parity for credit notes — token verifies, CN gone → 404.
    it('S-EDGE-015 — NotFoundException when credit note is missing', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'gone', type: 'creditNote' });
      prisma.creditNote.findUnique.mockResolvedValueOnce(null);
      await expect(controller.getCreditNotePdf('t', res)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('job approvals', () => {
    it('returns summary payload including request, job and timeline', async () => {
      tokens.verify.mockReturnValueOnce({
        id: 'approval-1',
        type: 'jobApproval',
      });
      prisma.maintenanceJobApprovalRequest.findUnique.mockResolvedValueOnce({
        id: 'approval-1',
        status: 'PENDING',
        maintenanceJobId: 'job-1',
        requestedAmount: 120,
        summary: 'Brake overhaul',
        maintenanceJob: {
          id: 'job-1',
          title: 'Brake overhaul',
          status: 'COMPLETED',
          car: {
            id: 'car-1',
            make: 'Renault',
            model: 'Clio',
            licensePlate: 'TN-100-TN',
            customer: {
              id: 'cus-1',
              firstName: 'John',
              lastName: 'Doe',
              phone: '+216 99 000 000',
            },
          },
        },
      });
      prisma.maintenanceJobTimelineEvent.findMany.mockResolvedValueOnce([
        {
          id: 'te-1',
          eventType: 'part_added',
          details: { lineId: 'l1' },
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);

      const res = await controller.getJobApprovalSummary('job-token');

      expect(tokens.verify).toHaveBeenCalledWith('job-token', 'jobApproval');
      expect(
        prisma.maintenanceJobApprovalRequest.findUnique,
      ).toHaveBeenCalledWith({
        where: { id: 'approval-1' },
        include: expect.objectContaining({
          maintenanceJob: expect.any(Object),
        }),
      });
      expect(prisma.maintenanceJobTimelineEvent.findMany).toHaveBeenCalledWith({
        where: { maintenanceJobId: 'job-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(res.request).toHaveProperty('id', 'approval-1');
      expect(res.job).toHaveProperty('title', 'Brake overhaul');
      expect(res.timeline).toHaveLength(1);
      expect(res.timeline[0]).toEqual({
        id: 'te-1',
        eventType: 'part_added',
        details: { lineId: 'l1' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
    });

    it('recording approval through public approve endpoint updates status and timeline', async () => {
      tokens.verify.mockReturnValueOnce({
        id: 'approval-2',
        type: 'jobApproval',
      });
      prisma.maintenanceJobApprovalRequest.findUnique
        .mockResolvedValueOnce({
          id: 'approval-2',
          status: 'PENDING',
          maintenanceJobId: 'job-2',
          requestedAmount: 120,
        })
        .mockResolvedValueOnce({
          id: 'approval-2',
          status: 'APPROVED',
          maintenanceJobId: 'job-2',
          requestedAmount: 120,
          summary: 'Brake pads',
          customerName: null,
          customerEmail: null,
          customerPhone: null,
          respondedAt: new Date('2026-01-01T01:00:00.000Z'),
          respondedBy: null,
          responseChannel: 'public',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          maintenanceJob: {
            id: 'job-2',
            title: 'Brake service',
            status: 'IN_PROGRESS',
            car: {
              id: 'car-2',
              year: 2020,
              make: 'Renault',
              model: 'Clio',
              licensePlate: 'TN-200-TN',
              customer: {
                id: 'cus-2',
                firstName: 'Jane',
                lastName: 'Doe',
                phone: '+216 22 000 000',
                email: 'jane@example.com',
              },
            },
          },
        });
      prisma.maintenanceJobApprovalRequest.update.mockResolvedValueOnce({
        id: 'approval-2',
        status: 'APPROVED',
      });
      prisma.maintenanceJobTimelineEvent.create.mockResolvedValueOnce({
        id: 'e2',
      });
      prisma.maintenanceJobTimelineEvent.findMany.mockResolvedValueOnce([]);
      prisma.assistantToolCall.findFirst.mockResolvedValueOnce({
        id: 'tc-approval-email',
        conversationId: 'conv-approval-email',
      });
      prisma.assistantMessage.findFirst.mockResolvedValueOnce(null);

      const res = await controller.approveJobByPublicLink('job-token', {
        responseNote: 'Customer accepts',
      });

      expect(prisma.maintenanceJobApprovalRequest.update).toHaveBeenCalledWith({
        where: { id: 'approval-2' },
        data: {
          status: 'APPROVED',
          responseNote: 'Customer accepts',
          responseChannel: 'public',
          respondedAt: expect.any(Date),
        },
      });
      expect(prisma.maintenanceJobTimelineEvent.create).toHaveBeenCalledWith({
        data: {
          maintenanceJobId: 'job-2',
          eventType: 'approval_responded',
          details: {
            approvalId: 'approval-2',
            status: 'APPROVED',
            responseChannel: 'public',
          },
        },
      });
      expect(prisma.assistantToolCall.findFirst).toHaveBeenCalledWith({
        where: {
          status: 'EXECUTED',
          OR: [
            {
              toolName: 'send_job_customer_approval_email',
              resultJson: {
                path: ['approvalRequestId'],
                equals: 'approval-2',
              },
            },
            {
              toolName: 'request_job_customer_approval',
              resultJson: {
                path: ['id'],
                equals: 'approval-2',
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, conversationId: true },
      });
      expect(prisma.assistantMessage.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-approval-email',
          role: 'ASSISTANT',
          toolCallId: 'tc-approval-email',
          content:
            'Customer approval update: The customer approved the maintenance approval request for 120.00 TND. Reason: Customer accepts',
        },
      });
      expect(res.status).toBe('approved');
      expect(res.request.description).toBe('Brake pads');
      expect(res.jobTitle).toBe('Brake service');
    });

    it('recording rejection through public reject endpoint updates status and timeline', async () => {
      tokens.verify.mockReturnValueOnce({
        id: 'approval-3',
        type: 'jobApproval',
      });
      prisma.maintenanceJobApprovalRequest.findUnique
        .mockResolvedValueOnce({
          id: 'approval-3',
          status: 'PENDING',
          maintenanceJobId: 'job-3',
          requestedAmount: 95,
        })
        .mockResolvedValueOnce({
          id: 'approval-3',
          status: 'REJECTED',
          maintenanceJobId: 'job-3',
          requestedAmount: 95,
          summary: 'Brake sensor',
          customerName: null,
          customerEmail: null,
          customerPhone: null,
          respondedAt: new Date('2026-01-01T01:00:00.000Z'),
          respondedBy: null,
          responseChannel: 'public',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          maintenanceJob: {
            id: 'job-3',
            title: 'Sensor service',
            status: 'IN_PROGRESS',
            car: {
              id: 'car-3',
              year: 2021,
              make: 'Peugeot',
              model: '208',
              licensePlate: 'TN-300-TN',
              customer: {
                id: 'cus-3',
                firstName: 'Sam',
                lastName: 'Ray',
                phone: '+216 33 000 000',
                email: 'sam@example.com',
              },
            },
          },
        });
      prisma.maintenanceJobApprovalRequest.update.mockResolvedValueOnce({
        id: 'approval-3',
        status: 'REJECTED',
      });
      prisma.maintenanceJobTimelineEvent.create.mockResolvedValueOnce({
        id: 'e3',
      });
      prisma.maintenanceJobTimelineEvent.findMany.mockResolvedValueOnce([]);
      prisma.assistantToolCall.findFirst.mockResolvedValueOnce({
        id: 'tc-request-approval',
        conversationId: 'conv-request-approval',
      });
      prisma.assistantMessage.findFirst.mockResolvedValueOnce(null);

      const res = await controller.rejectJobByPublicLink('job-token', {
        responseNote: 'Customer rejects',
      });

      expect(prisma.maintenanceJobApprovalRequest.update).toHaveBeenCalledWith({
        where: { id: 'approval-3' },
        data: {
          status: 'REJECTED',
          responseNote: 'Customer rejects',
          responseChannel: 'public',
          respondedAt: expect.any(Date),
        },
      });
      expect(prisma.assistantMessage.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-request-approval',
          role: 'ASSISTANT',
          toolCallId: 'tc-request-approval',
          content:
            'Customer approval update: The customer rejected the maintenance approval request for 95.00 TND. Reason: Customer rejects',
        },
      });
      expect(res.status).toBe('rejected');
      expect(res.request.description).toBe('Brake sensor');
    });

    it('returns the public summary when public response is already closed', async () => {
      tokens.verify.mockReturnValueOnce({
        id: 'approval-4',
        type: 'jobApproval',
      });
      prisma.maintenanceJobApprovalRequest.findUnique
        .mockResolvedValueOnce({
          id: 'approval-4',
          status: 'APPROVED',
          maintenanceJobId: 'job-4',
        })
        .mockResolvedValueOnce({
          id: 'approval-4',
          status: 'APPROVED',
          maintenanceJobId: 'job-4',
          requestedAmount: 75,
          summary: 'Oil filter',
          customerName: null,
          customerEmail: null,
          customerPhone: null,
          respondedAt: new Date('2026-01-01T01:00:00.000Z'),
          respondedBy: null,
          responseChannel: 'public',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          maintenanceJob: {
            id: 'job-4',
            title: 'Oil service',
            status: 'IN_PROGRESS',
            car: {
              id: 'car-4',
              year: 2022,
              make: 'Toyota',
              model: 'Yaris',
              licensePlate: 'TN-400-TN',
              customer: {
                id: 'cus-4',
                firstName: 'Ali',
                lastName: 'Ben',
                phone: '+216 44 000 000',
                email: 'ali@example.com',
              },
            },
          },
        });
      prisma.maintenanceJobTimelineEvent.findMany.mockResolvedValueOnce([]);

      const res = await controller.approveJobByPublicLink('job-token', {});

      expect(res.status).toBe('approved');
      expect(res.alreadyResponded).toBe(true);
      expect(res.request.description).toBe('Oil filter');
      expect(
        prisma.maintenanceJobApprovalRequest.update,
      ).not.toHaveBeenCalled();
      expect(prisma.maintenanceJobTimelineEvent.create).not.toHaveBeenCalled();
      expect(prisma.assistantMessage.create).not.toHaveBeenCalled();
    });

    it('throws NotFound when job approval request token maps to nothing', async () => {
      tokens.verify.mockReturnValueOnce({
        id: 'approval-missing',
        type: 'jobApproval',
      });
      prisma.maintenanceJobApprovalRequest.findUnique.mockResolvedValueOnce(
        null,
      );
      await expect(
        controller.getJobApprovalSummary('bad-job-token'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

function makeRes(): any {
  const headers: Record<string, string> = {};
  return {
    headers,
    bodyBuffer: undefined as Buffer | undefined,
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    end(buf: Buffer) {
      this.bodyBuffer = buf;
    },
  };
}
