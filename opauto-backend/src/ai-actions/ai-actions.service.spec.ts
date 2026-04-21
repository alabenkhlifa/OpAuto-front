import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AiActionsService } from './ai-actions.service';
import { AiService } from '../ai/ai.service';
import { SmsService } from '../sms/sms.service';
import { PrismaService } from '../prisma/prisma.service';

const GARAGE_ID = 'garage-1';
const USER_ID = 'user-1';

const makePrismaMock = () => {
  const store = new Map<string, any>();
  return {
    store,
    aiAction: {
      create: jest.fn(async ({ data }: any) => {
        const id = `act-${store.size + 1}`;
        const action = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          customer: {
            id: data.customerId,
            firstName: 'Ali',
            lastName: 'BK',
            phone: '+216 20 123 456',
            smsOptIn: true,
          },
        };
        store.set(id, action);
        return action;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const found = [...store.values()].find(
          (a) => a.id === where.id && a.garageId === where.garageId,
        );
        return found ?? null;
      }),
      findMany: jest.fn(async () => [...store.values()]),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = store.get(where.id);
        if (!cur) throw new Error('not found');
        const next = { ...cur, ...data, updatedAt: new Date() };
        store.set(where.id, next);
        return next;
      }),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    customer: {
      findFirst: jest.fn(async () => ({
        id: 'cust-1',
        phone: '+216 20 123 456',
        smsOptIn: true,
        firstName: 'Ali',
        lastName: 'BK',
      })),
    },
    invoice: {
      findFirst: jest.fn(async () => ({ id: 'inv-1' })),
    },
  };
};

describe('AiActionsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let ai: jest.Mocked<Pick<AiService, 'proposeAction'>>;
  let sms: jest.Mocked<Pick<SmsService, 'send'>>;
  let service: AiActionsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    ai = {
      proposeAction: jest.fn().mockResolvedValue({
        kind: 'DISCOUNT_SMS',
        messageBody: 'Bonjour Ali, profitez de 10%…',
        discountKind: 'PERCENT',
        discountValue: 10,
        expiresAtDays: 14,
        churnRiskSnapshot: 0.8,
        factorsSnapshot: ['120 days since last visit'],
      }),
    } as any;
    sms = { send: jest.fn() } as any;
    service = new AiActionsService(prisma as unknown as PrismaService, ai as unknown as AiService, sms as unknown as SmsService);
  });

  it('drafts a DRAFT action for a customer', async () => {
    const action = await service.draftForCustomer(GARAGE_ID, 'cust-1');
    expect(action.status).toBe('DRAFT');
    expect(action.kind).toBe('DISCOUNT_SMS');
    expect(action.expiresAt).toBeInstanceOf(Date);
    expect(ai.proposeAction).toHaveBeenCalledWith(GARAGE_ID, 'cust-1');
  });

  it('approves a draft and transitions to SENT on success', async () => {
    const draft = await service.draftForCustomer(GARAGE_ID, 'cust-1');
    sms.send.mockResolvedValueOnce({ providerMessageId: 'SM-xyz', status: 'queued' });

    const updated = await service.approveAndSend(GARAGE_ID, USER_ID, draft.id, {});
    expect(updated.status).toBe('SENT');
    expect(updated.providerMessageId).toBe('SM-xyz');
    expect(sms.send).toHaveBeenCalledWith('+216 20 123 456', draft.messageBody);
  });

  it('transitions to FAILED when SMS send throws', async () => {
    const draft = await service.draftForCustomer(GARAGE_ID, 'cust-1');
    sms.send.mockRejectedValueOnce(new Error('invalid number'));

    const updated = await service.approveAndSend(GARAGE_ID, USER_ID, draft.id, {});
    expect(updated.status).toBe('FAILED');
    expect(updated.errorMessage).toBe('invalid number');
  });

  it('rejects approve when customer has opted out', async () => {
    const draft = await service.draftForCustomer(GARAGE_ID, 'cust-1');
    prisma.aiAction.findFirst.mockImplementationOnce(async () => ({
      ...draft,
      customer: { ...draft.customer, smsOptIn: false },
    }));

    await expect(service.approveAndSend(GARAGE_ID, USER_ID, draft.id, {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects approve when already sent', async () => {
    const draft = await service.draftForCustomer(GARAGE_ID, 'cust-1');
    prisma.aiAction.findFirst.mockImplementationOnce(async () => ({ ...draft, status: 'SENT' }));

    await expect(service.approveAndSend(GARAGE_ID, USER_ID, draft.id, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('skips a draft', async () => {
    const draft = await service.draftForCustomer(GARAGE_ID, 'cust-1');
    const skipped = await service.skip(GARAGE_ID, draft.id);
    expect(skipped.status).toBe('SKIPPED');
  });

  it('marks a sent action as redeemed', async () => {
    const draft = await service.draftForCustomer(GARAGE_ID, 'cust-1');
    sms.send.mockResolvedValueOnce({ providerMessageId: 'SM1', status: 'queued' });
    await service.approveAndSend(GARAGE_ID, USER_ID, draft.id, {});

    const redeemed = await service.markRedeemed(GARAGE_ID, draft.id, { invoiceId: 'inv-1' });
    expect(redeemed.status).toBe('REDEEMED');
    expect(redeemed.redeemedInvoiceId).toBe('inv-1');
  });

  it('does not redeem a draft', async () => {
    const draft = await service.draftForCustomer(GARAGE_ID, 'cust-1');
    await expect(service.markRedeemed(GARAGE_ID, draft.id, {})).rejects.toThrow(BadRequestException);
  });

  it('throws when action is not found', async () => {
    await expect(service.findOne(GARAGE_ID, 'missing')).rejects.toThrow(NotFoundException);
  });
});
