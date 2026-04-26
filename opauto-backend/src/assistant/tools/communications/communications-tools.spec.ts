import { NotFoundException } from '@nestjs/common';
import { AssistantBlastTier } from '@prisma/client';
import { AssistantUserContext } from '../../types';
import { createSendSmsTool, SendSmsArgs } from './send-sms.tool';
import {
  createSendEmailTool,
  resolveSendEmailBlastTier,
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
    describe('resolveBlastTier (resolver function)', () => {
      it('returns AUTO_WRITE when `to` matches ctx.email', () => {
        const tier = resolveSendEmailBlastTier(
          { to: 'owner@example.com', subject: 's', text: 'b' },
          ownerCtx,
        );
        expect(tier).toBe(AssistantBlastTier.AUTO_WRITE);
      });

      it('returns AUTO_WRITE for case-insensitive self-match', () => {
        const tier = resolveSendEmailBlastTier(
          { to: 'OWNER@Example.COM', subject: 's', text: 'b' },
          ownerCtx,
        );
        expect(tier).toBe(AssistantBlastTier.AUTO_WRITE);
      });

      it('returns CONFIRM_WRITE for any other recipient', () => {
        const tier = resolveSendEmailBlastTier(
          { to: 'someone-else@example.com', subject: 's', text: 'b' },
          ownerCtx,
        );
        expect(tier).toBe(AssistantBlastTier.CONFIRM_WRITE);
      });

      it('returns CONFIRM_WRITE when ctx.email is missing', () => {
        const tier = resolveSendEmailBlastTier(
          { to: 'owner@example.com', subject: 's', text: 'b' },
          { ...ownerCtx, email: null },
        );
        expect(tier).toBe(AssistantBlastTier.CONFIRM_WRITE);
      });
    });

    it('sends with subject + text (happy path)', async () => {
      const email = makeEmailService(
        jest.fn().mockResolvedValue({ providerMessageId: 'em_1', status: 'queued' }),
      );
      const tool = createSendEmailTool({ emailService: email });

      const result = await tool.handler(
        {
          to: 'someone@example.com',
          subject: 'Hi',
          text: 'Body',
        } satisfies SendEmailArgs,
        ownerCtx,
      );

      expect(email.send).toHaveBeenCalledWith({
        to: 'someone@example.com',
        subject: 'Hi',
        html: undefined,
        text: 'Body',
      });
      expect(result).toEqual({ providerMessageId: 'em_1', status: 'queued' });
    });

    it('returns missing_body error when neither html nor text is provided', async () => {
      const email = makeEmailService();
      const tool = createSendEmailTool({ emailService: email });

      const result = await tool.handler(
        { to: 'a@b.com', subject: 'Hi' } as SendEmailArgs,
        ownerCtx,
      );

      expect(result).toEqual({
        error: 'missing_body',
        message: expect.stringMatching(/at least one of/i),
      });
      expect(email.send).not.toHaveBeenCalled();
    });

    it('returns attachmentsNotice when attachInvoiceIds is supplied (v1 deferred)', async () => {
      const email = makeEmailService(
        jest.fn().mockResolvedValue({ providerMessageId: 'em_2', status: 'queued' }),
      );
      const tool = createSendEmailTool({ emailService: email });

      const result = await tool.handler(
        {
          to: 'someone@example.com',
          subject: 'Hi',
          text: 'Body',
          attachInvoiceIds: ['inv-1'],
        },
        ownerCtx,
      );

      expect(result).toMatchObject({
        providerMessageId: 'em_2',
        attachmentsNotice: expect.stringMatching(/attachments/i),
      });
    });

    it('rejects bad args via JSON Schema (missing to/subject, bad email)', () => {
      const registry = new ToolRegistryService();
      registry.register(createSendEmailTool({ emailService: makeEmailService() }));

      expect(registry.validateArgs('send_email', {}).valid).toBe(false);
      expect(
        registry.validateArgs('send_email', { to: 'not-an-email', subject: 'x' }).valid,
      ).toBe(false);
      expect(
        registry.validateArgs('send_email', {
          to: 'a@b.com',
          subject: 'x',
          text: 'y',
        }).valid,
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
