import { NotFoundException } from '@nestjs/common';
import { AssistantBlastTier } from '@prisma/client';
import { AssistantUserContext } from '../../types';
import { createSendSmsTool, SendSmsArgs } from './send-sms.tool';
import {
  createSendEmailTool,
  SendEmailArgs,
} from './send-email.tool';
import {
  createProposeRetentionActionTool,
  ProposeRetentionActionArgs,
} from './propose-retention-action.tool';
import { ToolRegistryService } from '../../tool-registry.service';

const ownerCtx: AssistantUserContext = {
  userId: 'user-1',
  garageId: 'garage-1',
  email: 'owner@example.com',
  role: 'OWNER',
  enabledModules: [],
  locale: 'en',
};

function makeSmsService(send: jest.Mock = jest.fn()) {
  return { send } as unknown as import('../../../sms/sms.service').SmsService & {
    send: jest.Mock;
  };
}

function makeEmailService(send: jest.Mock = jest.fn()) {
  return {
    send,
  } as unknown as import('../../../email/email.service').EmailService & {
    send: jest.Mock;
  };
}

function makePrisma(
  findMany: jest.Mock = jest.fn().mockResolvedValue([]),
) {
  return {
    invoice: { findMany },
  } as unknown as import('../../../prisma/prisma.service').PrismaService & {
    invoice: { findMany: jest.Mock };
  };
}

function makeCustomersService(findOne: jest.Mock = jest.fn()) {
  return {
    findOne,
  } as unknown as import('../../../customers/customers.service').CustomersService & {
    findOne: jest.Mock;
  };
}

function makeAiActionsService(draftForCustomer: jest.Mock = jest.fn()) {
  return {
    draftForCustomer,
  } as unknown as import('../../../ai-actions/ai-actions.service').AiActionsService & {
    draftForCustomer: jest.Mock;
  };
}

describe('communications tools', () => {
  describe('send_sms', () => {
    it('sends without a customerId binding (happy path)', async () => {
      const sms = makeSmsService(
        jest.fn().mockResolvedValue({ providerMessageId: 'sm_1', status: 'queued' }),
      );
      const customers = makeCustomersService();
      const tool = createSendSmsTool({
        smsService: sms,
        customersService: customers,
      });

      const result = await tool.handler(
        { to: '+21612345678', body: 'hello' } satisfies SendSmsArgs,
        ownerCtx,
      );

      expect(sms.send).toHaveBeenCalledWith('+21612345678', 'hello');
      expect(customers.findOne).not.toHaveBeenCalled();
      expect(result).toEqual({ providerMessageId: 'sm_1', status: 'queued' });
    });

    it('verifies customer phone matches `to` and sends', async () => {
      const sms = makeSmsService(
        jest.fn().mockResolvedValue({ providerMessageId: 'sm_2', status: 'queued' }),
      );
      const customers = makeCustomersService(
        jest.fn().mockResolvedValue({
          id: 'cust-1',
          phone: '+216 12 345 678',
          firstName: 'A',
          lastName: 'B',
        }),
      );
      const tool = createSendSmsTool({
        smsService: sms,
        customersService: customers,
      });

      const result = await tool.handler(
        { to: '+21612345678', body: 'hi', customerId: 'cust-1' },
        ownerCtx,
      );

      expect(customers.findOne).toHaveBeenCalledWith('cust-1', 'garage-1');
      expect(sms.send).toHaveBeenCalled();
      expect(result).toMatchObject({ providerMessageId: 'sm_2' });
    });

    it('returns phone_mismatch error when customer phone differs from `to`', async () => {
      const sms = makeSmsService();
      const customers = makeCustomersService(
        jest.fn().mockResolvedValue({
          id: 'cust-1',
          phone: '+21699999999',
        }),
      );
      const tool = createSendSmsTool({
        smsService: sms,
        customersService: customers,
      });

      const result = await tool.handler(
        { to: '+21612345678', body: 'hi', customerId: 'cust-1' },
        ownerCtx,
      );

      expect(result).toEqual({
        error: 'phone_mismatch',
        message: expect.stringMatching(/phone does not match/i),
      });
      expect(sms.send).not.toHaveBeenCalled();
    });

    it('returns customer_not_found when binding is invalid', async () => {
      const sms = makeSmsService();
      const customers = makeCustomersService(
        jest.fn().mockRejectedValue(new NotFoundException('nope')),
      );
      const tool = createSendSmsTool({
        smsService: sms,
        customersService: customers,
      });

      const result = await tool.handler(
        { to: '+21612345678', body: 'hi', customerId: 'cust-x' },
        ownerCtx,
      );

      expect(result).toEqual({
        error: 'customer_not_found',
        message: expect.stringMatching(/cust-x/),
      });
      expect(sms.send).not.toHaveBeenCalled();
    });

    it('rejects bad args via JSON Schema (body too long, missing fields)', () => {
      const registry = new ToolRegistryService();
      registry.register(
        createSendSmsTool({
          smsService: makeSmsService(),
          customersService: makeCustomersService(),
        }),
      );

      expect(registry.validateArgs('send_sms', {}).valid).toBe(false);
      expect(
        registry.validateArgs('send_sms', { to: '+21612345678', body: 'a'.repeat(1601) }).valid,
      ).toBe(false);
      expect(
        registry.validateArgs('send_sms', { to: '+21612345678', body: 'ok' }).valid,
      ).toBe(true);
    });
  });

  describe('send_email', () => {
    it('always advertises AUTO_WRITE blast tier (no per-call resolver)', () => {
      const tool = createSendEmailTool({
        emailService: makeEmailService(),
        prisma: makePrisma(),
      });
      expect(tool.blastTier).toBe(AssistantBlastTier.AUTO_WRITE);
      expect(tool.resolveBlastTier).toBeUndefined();
    });

    it('always sends to the authenticated user (recipient is server-resolved, not LLM-supplied)', async () => {
      const email = makeEmailService(
        jest.fn().mockResolvedValue({ providerMessageId: 'em_1', status: 'queued' }),
      );
      const tool = createSendEmailTool({ emailService: email, prisma: makePrisma() });

      const result = await tool.handler(
        {
          subject: 'Hi',
          text: 'Body',
        } satisfies SendEmailArgs,
        ownerCtx,
      );

      expect(email.send).toHaveBeenCalledWith({
        to: 'owner@example.com',
        subject: 'Hi',
        html: undefined,
        text: 'Body',
        attachments: undefined,
      });
      expect(result).toMatchObject({
        providerMessageId: 'em_1',
        status: 'queued',
        to: 'owner@example.com',
      });
    });

    it('returns missing_recipient error when ctx.email is null', async () => {
      const email = makeEmailService();
      const tool = createSendEmailTool({ emailService: email, prisma: makePrisma() });

      const result = await tool.handler(
        { subject: 'Hi', text: 'Body' } satisfies SendEmailArgs,
        { ...ownerCtx, email: null },
      );

      expect(result).toEqual({
        error: 'missing_recipient',
        message: expect.stringMatching(/no email address/i),
      });
      expect(email.send).not.toHaveBeenCalled();
    });

    it('returns missing_body error when neither html nor text is provided', async () => {
      const email = makeEmailService();
      const tool = createSendEmailTool({ emailService: email, prisma: makePrisma() });

      const result = await tool.handler(
        { subject: 'Hi' } as SendEmailArgs,
        ownerCtx,
      );

      expect(result).toEqual({
        error: 'missing_body',
        message: expect.stringMatching(/at least one of/i),
      });
      expect(email.send).not.toHaveBeenCalled();
    });

    it('attaches invoices.csv when attachInvoiceIds resolves to garage rows', async () => {
      const email = makeEmailService(
        jest.fn().mockResolvedValue({ providerMessageId: 'em_2', status: 'queued' }),
      );
      const prisma = makePrisma(
        jest.fn().mockResolvedValue([
          {
            id: 'inv-1',
            invoiceNumber: 'INV-001',
            status: 'PAID',
            total: 100,
            dueDate: null,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            customer: { firstName: 'A', lastName: 'B' },
            payments: [{ amount: 100 }],
          },
        ]),
      );
      const tool = createSendEmailTool({ emailService: email, prisma });

      const result = await tool.handler(
        {
          subject: 'Hi',
          text: 'Body',
          attachInvoiceIds: ['inv-1'],
        },
        ownerCtx,
      );

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['inv-1'] },
            garageId: ownerCtx.garageId,
          }),
        }),
      );
      const sendArg = email.send.mock.calls[0][0];
      expect(sendArg.to).toBe('owner@example.com');
      expect(sendArg.attachments).toHaveLength(1);
      expect(sendArg.attachments[0]).toMatchObject({
        filename: 'invoices.csv',
        contentType: 'text/csv',
      });
      expect(result).toMatchObject({
        providerMessageId: 'em_2',
        to: 'owner@example.com',
        attachedInvoiceCount: 1,
      });
    });

    it('rejects bad args via JSON Schema (missing subject, or stray `to`)', () => {
      const registry = new ToolRegistryService();
      registry.register(
        createSendEmailTool({ emailService: makeEmailService(), prisma: makePrisma() }),
      );

      // Missing subject
      expect(registry.validateArgs('send_email', {}).valid).toBe(false);
      // Stray `to` is not allowed (additionalProperties: false)
      expect(
        registry.validateArgs('send_email', {
          to: 'a@b.com',
          subject: 'x',
          text: 'y',
        }).valid,
      ).toBe(false);
      // Subject + text alone is valid — recipient is implicit
      expect(
        registry.validateArgs('send_email', { subject: 'x', text: 'y' }).valid,
      ).toBe(true);
    });
  });

  describe('propose_retention_action', () => {
    it('drafts a retention action and returns its summary (happy path)', async () => {
      const draft = {
        id: 'act-1',
        kind: 'WIN_BACK',
        messageBody: 'hi',
        discountKind: 'PERCENT',
        discountValue: 10,
        expiresAt: new Date('2026-05-10T00:00:00.000Z'),
        churnRiskSnapshot: 0.81,
        customer: {
          id: 'cust-1',
          firstName: 'A',
          lastName: 'B',
          phone: '+21612345678',
          smsOptIn: true,
        },
      };
      const aiActions = makeAiActionsService(jest.fn().mockResolvedValue(draft));
      const tool = createProposeRetentionActionTool({
        aiActionsService: aiActions,
      });

      const result = await tool.handler(
        { customerId: 'cust-1' } satisfies ProposeRetentionActionArgs,
        ownerCtx,
      );

      expect(aiActions.draftForCustomer).toHaveBeenCalledWith('garage-1', 'cust-1');
      expect(result).toEqual({
        id: 'act-1',
        kind: 'WIN_BACK',
        messageBody: 'hi',
        discountKind: 'PERCENT',
        discountValue: 10,
        expiresAt: '2026-05-10T00:00:00.000Z',
        churnRiskSnapshot: 0.81,
        customer: {
          id: 'cust-1',
          displayName: 'A B',
          phone: '+21612345678',
          smsOptIn: true,
        },
      });
    });

    it('returns customer_not_found when the customer does not belong to the garage', async () => {
      const aiActions = makeAiActionsService(
        jest.fn().mockRejectedValue(new NotFoundException('Customer not found')),
      );
      const tool = createProposeRetentionActionTool({
        aiActionsService: aiActions,
      });

      const result = await tool.handler({ customerId: 'cust-x' }, ownerCtx);

      expect(result).toEqual({
        error: 'customer_not_found',
        message: expect.stringMatching(/cust-x/),
      });
    });

    it('returns draft_failed for non-NotFound errors', async () => {
      const aiActions = makeAiActionsService(
        jest.fn().mockRejectedValue(new Error('llm exploded')),
      );
      const tool = createProposeRetentionActionTool({
        aiActionsService: aiActions,
      });

      const result = await tool.handler({ customerId: 'cust-1' }, ownerCtx);

      expect(result).toEqual({
        error: 'draft_failed',
        message: 'llm exploded',
      });
    });

    it('exposes READ blast tier (it does not contact customers)', () => {
      const tool = createProposeRetentionActionTool({
        aiActionsService: makeAiActionsService(),
      });
      expect(tool.blastTier).toBe(AssistantBlastTier.READ);
    });

    it('rejects bad args via JSON Schema', () => {
      const registry = new ToolRegistryService();
      registry.register(
        createProposeRetentionActionTool({
          aiActionsService: makeAiActionsService(),
        }),
      );
      expect(registry.validateArgs('propose_retention_action', {}).valid).toBe(false);
      expect(
        registry.validateArgs('propose_retention_action', { customerId: '' }).valid,
      ).toBe(false);
      expect(
        registry.validateArgs('propose_retention_action', { customerId: 'cust-1' }).valid,
      ).toBe(true);
    });
  });
});
