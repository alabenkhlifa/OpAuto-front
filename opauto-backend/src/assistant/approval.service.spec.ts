import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { AssistantBlastTier, AssistantToolCallStatus } from '@prisma/client';
import { APPROVAL_TTL_MS, ApprovalService } from './approval.service';
import { PrismaService } from '../prisma/prisma.service';

const GARAGE_ID = 'garage-1';
const OTHER_GARAGE_ID = 'garage-2';
const USER_ID = 'user-1';
const CONVERSATION_ID = 'conv-1';

type Row = {
  id: string;
  conversationId: string;
  toolName: string;
  argsJson: unknown;
  status: AssistantToolCallStatus;
  blastTier: AssistantBlastTier;
  expiresAt: Date | null;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  conversation: { garageId: string };
};

const makePrismaMock = (conversationGarageId: string = GARAGE_ID) => {
  const store = new Map<string, Row>();
  return {
    store,
    assistantToolCall: {
      create: jest.fn(async ({ data }: any) => {
        const row: Row = {
          id: data.id,
          conversationId: data.conversationId,
          toolName: data.toolName,
          argsJson: data.argsJson,
          status: data.status,
          blastTier: data.blastTier,
          expiresAt: data.expiresAt ?? null,
          approvedByUserId: null,
          approvedAt: null,
          conversation: { garageId: conversationGarageId },
        };
        store.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        return store.get(where.id) ?? null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = store.get(where.id);
        if (!cur) throw new Error('row not found');
        const next: Row = { ...cur, ...data };
        store.set(where.id, next);
        return next;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        const now = new Date();
        for (const [id, row] of store.entries()) {
          const matchStatus = row.status === where.status;
          const matchExpired =
            where.expiresAt?.lt instanceof Date
              ? row.expiresAt !== null && row.expiresAt.getTime() < where.expiresAt.lt.getTime()
              : row.expiresAt !== null && row.expiresAt.getTime() < now.getTime();
          if (matchStatus && matchExpired) {
            store.set(id, { ...row, ...data });
            count++;
          }
        }
        return { count };
      }),
    },
  };
};

describe('ApprovalService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: ApprovalService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ApprovalService(prisma as unknown as PrismaService);
  });

  describe('createPending', () => {
    it('writes a PENDING_APPROVAL row with a 5-minute expiry', async () => {
      const before = Date.now();
      const result = await service.createPending({
        conversationId: CONVERSATION_ID,
        toolCallId: 'tc-1',
        toolName: 'send_sms',
        blastTier: 'CONFIRM_WRITE',
        args: { to: '+216 20 000 000', body: 'hi' },
      });
      const after = Date.now();

      expect(prisma.assistantToolCall.create).toHaveBeenCalledTimes(1);
      const row = prisma.store.get('tc-1');
      expect(row).toBeDefined();
      expect(row!.status).toBe(AssistantToolCallStatus.PENDING_APPROVAL);
      expect(row!.blastTier).toBe(AssistantBlastTier.CONFIRM_WRITE);
      expect(row!.toolName).toBe('send_sms');
      expect(row!.expiresAt).toBeInstanceOf(Date);

      const expiresMs = result.expiresAt.getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + APPROVAL_TTL_MS - 50);
      expect(expiresMs).toBeLessThanOrEqual(after + APPROVAL_TTL_MS + 50);
    });

    it('rejects unknown blast tiers', async () => {
      await expect(
        service.createPending({
          conversationId: CONVERSATION_ID,
          toolCallId: 'tc-x',
          toolName: 'noop',
          blastTier: 'BOGUS',
          args: {},
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('decide', () => {
    const seedPending = async (overrides: Partial<Row> = {}) => {
      await service.createPending({
        conversationId: CONVERSATION_ID,
        toolCallId: 'tc-1',
        toolName: 'send_sms',
        blastTier: 'CONFIRM_WRITE',
        args: { to: '+216 20 000 000' },
      });
      const row = prisma.store.get('tc-1')!;
      Object.assign(row, overrides);
      prisma.store.set('tc-1', row);
    };

    it('approves a pending row and returns approved=true', async () => {
      await seedPending();
      const result = await service.decide('tc-1', 'approve', USER_ID, GARAGE_ID);
      expect(result).toEqual({ approved: true });
      const row = prisma.store.get('tc-1')!;
      expect(row.status).toBe(AssistantToolCallStatus.APPROVED);
      expect(row.approvedByUserId).toBe(USER_ID);
      expect(row.approvedAt).toBeInstanceOf(Date);
    });

    it('denies a pending row and returns approved=false', async () => {
      await seedPending();
      const result = await service.decide('tc-1', 'deny', USER_ID, GARAGE_ID);
      expect(result).toEqual({ approved: false });
      const row = prisma.store.get('tc-1')!;
      expect(row.status).toBe(AssistantToolCallStatus.DENIED);
      expect(row.approvedByUserId).toBe(USER_ID);
    });

    it('throws NotFoundException when the row is missing', async () => {
      await expect(
        service.decide('missing', 'approve', USER_ID, GARAGE_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when the row is already approved', async () => {
      await seedPending({ status: AssistantToolCallStatus.APPROVED });
      await expect(
        service.decide('tc-1', 'approve', USER_ID, GARAGE_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('marks expired and throws GoneException when past expiresAt', async () => {
      await seedPending({ expiresAt: new Date(Date.now() - 1000) });
      await expect(
        service.decide('tc-1', 'approve', USER_ID, GARAGE_ID),
      ).rejects.toBeInstanceOf(GoneException);
      const row = prisma.store.get('tc-1')!;
      expect(row.status).toBe(AssistantToolCallStatus.EXPIRED);
    });

    it('throws ForbiddenException when garageId does not match', async () => {
      await seedPending();
      await expect(
        service.decide('tc-1', 'approve', USER_ID, OTHER_GARAGE_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      // Status untouched.
      expect(prisma.store.get('tc-1')!.status).toBe(
        AssistantToolCallStatus.PENDING_APPROVAL,
      );
    });

    it('approves a TYPED_CONFIRM_WRITE row when typedConfirmation matches', async () => {
      await seedPending({
        blastTier: AssistantBlastTier.TYPED_CONFIRM_WRITE,
        argsJson: { invoiceId: 'inv-1', _expectedConfirmation: 'INV-2026-001' },
      });
      const result = await service.decide(
        'tc-1',
        'approve',
        USER_ID,
        GARAGE_ID,
        '  INV-2026-001  ',
      );
      expect(result).toEqual({ approved: true });
      expect(prisma.store.get('tc-1')!.status).toBe(
        AssistantToolCallStatus.APPROVED,
      );
    });

    it('rejects a TYPED_CONFIRM_WRITE row when typedConfirmation is wrong', async () => {
      await seedPending({
        blastTier: AssistantBlastTier.TYPED_CONFIRM_WRITE,
        argsJson: { invoiceId: 'inv-1', _expectedConfirmation: 'INV-2026-001' },
      });
      await expect(
        service.decide('tc-1', 'approve', USER_ID, GARAGE_ID, 'wrong'),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Comparison is case-sensitive — different case should still fail.
      await expect(
        service.decide('tc-1', 'approve', USER_ID, GARAGE_ID, 'inv-2026-001'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.store.get('tc-1')!.status).toBe(
        AssistantToolCallStatus.PENDING_APPROVAL,
      );
    });

    it('rejects a TYPED_CONFIRM_WRITE row when typedConfirmation is missing', async () => {
      await seedPending({
        blastTier: AssistantBlastTier.TYPED_CONFIRM_WRITE,
        argsJson: { invoiceId: 'inv-1', _expectedConfirmation: 'INV-2026-001' },
      });
      await expect(
        service.decide('tc-1', 'approve', USER_ID, GARAGE_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('still allows deny on TYPED_CONFIRM_WRITE without typedConfirmation', async () => {
      await seedPending({
        blastTier: AssistantBlastTier.TYPED_CONFIRM_WRITE,
        argsJson: { invoiceId: 'inv-1', _expectedConfirmation: 'INV-2026-001' },
      });
      const result = await service.decide('tc-1', 'deny', USER_ID, GARAGE_ID);
      expect(result).toEqual({ approved: false });
      expect(prisma.store.get('tc-1')!.status).toBe(
        AssistantToolCallStatus.DENIED,
      );
    });
  });

  describe('expireOverdue', () => {
    it('marks only PENDING+expired rows as EXPIRED and returns the count', async () => {
      // Seed three rows with different statuses/expiry.
      await service.createPending({
        conversationId: CONVERSATION_ID,
        toolCallId: 'tc-old-pending',
        toolName: 'send_sms',
        blastTier: 'CONFIRM_WRITE',
        args: {},
      });
      await service.createPending({
        conversationId: CONVERSATION_ID,
        toolCallId: 'tc-fresh-pending',
        toolName: 'send_sms',
        blastTier: 'CONFIRM_WRITE',
        args: {},
      });
      await service.createPending({
        conversationId: CONVERSATION_ID,
        toolCallId: 'tc-already-approved',
        toolName: 'send_sms',
        blastTier: 'CONFIRM_WRITE',
        args: {},
      });

      // Backdate one pending and approve another.
      const oldRow = prisma.store.get('tc-old-pending')!;
      oldRow.expiresAt = new Date(Date.now() - 60_000);
      const approvedRow = prisma.store.get('tc-already-approved')!;
      approvedRow.status = AssistantToolCallStatus.APPROVED;
      approvedRow.expiresAt = new Date(Date.now() - 60_000);

      const count = await service.expireOverdue();
      expect(count).toBe(1);
      expect(prisma.store.get('tc-old-pending')!.status).toBe(
        AssistantToolCallStatus.EXPIRED,
      );
      expect(prisma.store.get('tc-fresh-pending')!.status).toBe(
        AssistantToolCallStatus.PENDING_APPROVAL,
      );
      expect(prisma.store.get('tc-already-approved')!.status).toBe(
        AssistantToolCallStatus.APPROVED,
      );
    });

    it('returns 0 when nothing is expired', async () => {
      await service.createPending({
        conversationId: CONVERSATION_ID,
        toolCallId: 'tc-fresh',
        toolName: 'send_sms',
        blastTier: 'CONFIRM_WRITE',
        args: {},
      });
      expect(await service.expireOverdue()).toBe(0);
    });
  });
});
