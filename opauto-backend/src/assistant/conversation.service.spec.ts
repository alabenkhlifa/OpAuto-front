import { AssistantMessageRole } from '@prisma/client';
import { ConversationService } from './conversation.service';

const GARAGE_A = 'garage-a';
const GARAGE_B = 'garage-b';
const USER_A = 'user-a';

interface ConvRow {
  id: string;
  garageId: string;
  userId: string;
  title: string | null;
  pinned: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MsgRow {
  id: string;
  conversationId: string;
  role: AssistantMessageRole;
  content: string;
  toolCallId: string | null;
  skillUsed: string | null;
  agentUsed: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  llmProvider: string | null;
  createdAt: Date;
}

const makePrismaMock = () => {
  const conversations = new Map<string, ConvRow>();
  const messages = new Map<string, MsgRow>();
  let convCounter = 0;
  let msgCounter = 0;
  let now = new Date('2026-04-26T12:00:00Z').getTime();
  const tick = () => new Date((now += 1000));

  const matchesConvWhere = (c: ConvRow, where: any) => {
    if (!where) return true;
    if (where.id != null && c.id !== where.id) return false;
    if (where.garageId != null && c.garageId !== where.garageId) return false;
    if (where.userId != null && c.userId !== where.userId) return false;
    if (where.archivedAt === null && c.archivedAt !== null) return false;
    return true;
  };

  const matchesMsgWhere = (m: MsgRow, where: any) => {
    if (!where) return true;
    if (where.conversationId != null && m.conversationId !== where.conversationId) return false;
    if (where.role != null && m.role !== where.role) return false;
    return true;
  };

  return {
    conversations,
    messages,
    assistantConversation: {
      create: jest.fn(async ({ data }: any) => {
        const id = data.id ?? `conv-${++convCounter}`;
        const ts = tick();
        const row: ConvRow = {
          id,
          garageId: data.garageId,
          userId: data.userId,
          title: data.title ?? null,
          pinned: data.pinned ?? false,
          archivedAt: null,
          createdAt: ts,
          updatedAt: ts,
        };
        conversations.set(id, row);
        return row;
      }),
      findFirst: jest.fn(async ({ where, select, include }: any) => {
        const found = [...conversations.values()].find((c) => matchesConvWhere(c, where));
        if (!found) return null;
        if (select) {
          const out: any = {};
          for (const key of Object.keys(select)) if (select[key]) out[key] = (found as any)[key];
          return out;
        }
        if (include?.messages) {
          const msgs = [...messages.values()]
            .filter((m) => m.conversationId === found.id)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          return { ...found, messages: msgs };
        }
        return found;
      }),
      findUnique: jest.fn(async ({ where, select }: any) => {
        const found = conversations.get(where.id);
        if (!found) return null;
        if (select) {
          const out: any = {};
          for (const key of Object.keys(select)) if (select[key]) out[key] = (found as any)[key];
          return out;
        }
        return found;
      }),
      findMany: jest.fn(async ({ where, orderBy, take, select }: any) => {
        let rows = [...conversations.values()].filter((c) => matchesConvWhere(c, where));
        if (orderBy?.updatedAt === 'desc') {
          rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        }
        if (typeof take === 'number') rows = rows.slice(0, take);
        if (select) {
          return rows.map((r) => {
            const out: any = {};
            for (const key of Object.keys(select)) if (select[key]) out[key] = (r as any)[key];
            return out;
          });
        }
        return rows;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = conversations.get(where.id);
        if (!cur) throw new Error('not found');
        const next: ConvRow = { ...cur, ...data, updatedAt: tick() };
        conversations.set(cur.id, next);
        return next;
      }),
    },
    assistantMessage: {
      create: jest.fn(async ({ data }: any) => {
        const id = `msg-${++msgCounter}`;
        const row: MsgRow = {
          id,
          conversationId: data.conversationId,
          role: data.role,
          content: data.content,
          toolCallId: data.toolCallId ?? null,
          skillUsed: data.skillUsed ?? null,
          agentUsed: data.agentUsed ?? null,
          tokensIn: data.tokensIn ?? null,
          tokensOut: data.tokensOut ?? null,
          llmProvider: data.llmProvider ?? null,
          createdAt: tick(),
        };
        messages.set(id, row);
        return row;
      }),
      findFirst: jest.fn(async ({ where, orderBy, select }: any) => {
        let rows = [...messages.values()].filter((m) => matchesMsgWhere(m, where));
        if (orderBy?.createdAt === 'asc') {
          rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        } else if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        const found = rows[0] ?? null;
        if (!found) return null;
        if (select) {
          const out: any = {};
          for (const key of Object.keys(select)) if (select[key]) out[key] = (found as any)[key];
          return out;
        }
        return found;
      }),
      findMany: jest.fn(async ({ where, orderBy, take, select }: any) => {
        let rows = [...messages.values()].filter((m) => matchesMsgWhere(m, where));
        if (orderBy?.createdAt === 'asc') {
          rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        } else if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (typeof take === 'number') rows = rows.slice(0, take);
        if (select) {
          return rows.map((r) => {
            const out: any = {};
            for (const key of Object.keys(select)) if (select[key]) out[key] = (r as any)[key];
            return out;
          });
        }
        return rows;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const before = messages.size;
        for (const [id, m] of messages.entries()) {
          if (matchesMsgWhere(m, where)) messages.delete(id);
        }
        return { count: before - messages.size };
      }),
      aggregate: jest.fn(async ({ where, _sum }: any) => {
        const rows = [...messages.values()].filter((m) =>
          matchesMsgWhere(m, where),
        );
        const sum: Record<string, number | null> = {};
        for (const key of Object.keys(_sum ?? {})) {
          if (!_sum[key]) continue;
          const total = rows.reduce(
            (acc, m) => acc + ((m as any)[key] ?? 0),
            0,
          );
          // Mirror Prisma: returns null when there are no rows OR when every
          // value is null. For the budget guard we rely on the null fall-back.
          const anyValue = rows.some((m) => (m as any)[key] != null);
          sum[key] = anyValue ? total : null;
        }
        return { _sum: sum };
      }),
    },
  };
};

type PrismaMock = ReturnType<typeof makePrismaMock>;

const seedConversation = (
  prisma: PrismaMock,
  overrides: Partial<ConvRow> = {},
): ConvRow => {
  const id = overrides.id ?? `seed-conv-${prisma.conversations.size + 1}`;
  const ts = new Date();
  const row: ConvRow = {
    id,
    garageId: overrides.garageId ?? GARAGE_A,
    userId: overrides.userId ?? USER_A,
    title: overrides.title ?? null,
    pinned: overrides.pinned ?? false,
    archivedAt: overrides.archivedAt ?? null,
    createdAt: overrides.createdAt ?? ts,
    updatedAt: overrides.updatedAt ?? ts,
  };
  prisma.conversations.set(id, row);
  return row;
};

const seedMessage = (
  prisma: PrismaMock,
  conversationId: string,
  role: AssistantMessageRole,
  content: string,
  createdAt: Date,
  tokens: { in?: number | null; out?: number | null } = {},
): MsgRow => {
  const id = `seed-msg-${prisma.messages.size + 1}`;
  const row: MsgRow = {
    id,
    conversationId,
    role,
    content,
    toolCallId: null,
    skillUsed: null,
    agentUsed: null,
    tokensIn: tokens.in ?? null,
    tokensOut: tokens.out ?? null,
    llmProvider: null,
    createdAt,
  };
  prisma.messages.set(id, row);
  return row;
};

describe('ConversationService', () => {
  let prisma: PrismaMock;
  let service: ConversationService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ConversationService(prisma as any);
  });

  describe('getOrCreate', () => {
    it('creates a fresh conversation scoped to garage+user when no id is supplied', async () => {
      const created = await service.getOrCreate(GARAGE_A, USER_A);
      expect(created.garageId).toBe(GARAGE_A);
      expect(created.userId).toBe(USER_A);
      expect(prisma.assistantConversation.create).toHaveBeenCalledTimes(1);
      expect(prisma.assistantConversation.findFirst).not.toHaveBeenCalled();
    });

    it('returns the matching conversation when id, garage and user all match', async () => {
      const seeded = seedConversation(prisma, { garageId: GARAGE_A, userId: USER_A });
      const result = await service.getOrCreate(GARAGE_A, USER_A, seeded.id);
      expect(result.id).toBe(seeded.id);
      expect(prisma.assistantConversation.create).not.toHaveBeenCalled();
    });

    it('does NOT return a foreign-garage conversation — falls back to creating a new one', async () => {
      // Multi-tenancy guarantee
      const foreign = seedConversation(prisma, { id: 'foreign', garageId: GARAGE_B, userId: USER_A });
      const result = await service.getOrCreate(GARAGE_A, USER_A, foreign.id);
      expect(result.id).not.toBe(foreign.id);
      expect(result.garageId).toBe(GARAGE_A);
      expect(result.userId).toBe(USER_A);
      expect(prisma.assistantConversation.create).toHaveBeenCalledTimes(1);
    });

    it('does NOT return an archived conversation — falls back to creating a new one', async () => {
      const archived = seedConversation(prisma, {
        id: 'archived',
        garageId: GARAGE_A,
        userId: USER_A,
        archivedAt: new Date(),
      });
      const result = await service.getOrCreate(GARAGE_A, USER_A, archived.id);
      expect(result.id).not.toBe(archived.id);
      expect(prisma.assistantConversation.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('appendMessage', () => {
    it('writes a message with all supplied fields', async () => {
      const conv = seedConversation(prisma);
      const msg = await service.appendMessage({
        conversationId: conv.id,
        role: AssistantMessageRole.USER,
        content: 'hello',
        toolCallId: 'tc-1',
        skillUsed: 'daily-briefing',
        agentUsed: 'analytics',
        tokensIn: 100,
        tokensOut: 50,
        llmProvider: 'groq',
      });
      expect(msg.content).toBe('hello');
      expect(prisma.assistantMessage.create).toHaveBeenCalledWith({
        data: {
          conversationId: conv.id,
          role: AssistantMessageRole.USER,
          content: 'hello',
          toolCallId: 'tc-1',
          skillUsed: 'daily-briefing',
          agentUsed: 'analytics',
          tokensIn: 100,
          tokensOut: 50,
          llmProvider: 'groq',
        },
      });
    });
  });

  describe('getRecentHistory', () => {
    it('returns messages in chronological order capped at limit', async () => {
      const conv = seedConversation(prisma);
      // Seed 5 messages with strictly increasing timestamps.
      const base = Date.now();
      seedMessage(prisma, conv.id, AssistantMessageRole.USER, 'm1', new Date(base + 1));
      seedMessage(prisma, conv.id, AssistantMessageRole.ASSISTANT, 'm2', new Date(base + 2));
      seedMessage(prisma, conv.id, AssistantMessageRole.TOOL, 'm3', new Date(base + 3));
      seedMessage(prisma, conv.id, AssistantMessageRole.USER, 'm4', new Date(base + 4));
      seedMessage(prisma, conv.id, AssistantMessageRole.ASSISTANT, 'm5', new Date(base + 5));

      const history = await service.getRecentHistory(conv.id, 3);
      expect(history.map((h) => h.content)).toEqual(['m3', 'm4', 'm5']);
      // Ensure the prisma layer was queried with desc + take, then reversed in-app.
      expect(prisma.assistantMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId: conv.id },
          orderBy: { createdAt: 'desc' },
          take: 3,
        }),
      );
    });

    it('uses default limit of 20 when none is supplied', async () => {
      const conv = seedConversation(prisma);
      seedMessage(prisma, conv.id, AssistantMessageRole.USER, 'a', new Date());
      await service.getRecentHistory(conv.id);
      expect(prisma.assistantMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('returns empty array when no messages exist', async () => {
      const conv = seedConversation(prisma);
      const history = await service.getRecentHistory(conv.id);
      expect(history).toEqual([]);
    });
  });

  describe('listForUser', () => {
    it('excludes archived conversations and other users/garages', async () => {
      seedConversation(prisma, { id: 'active-1', garageId: GARAGE_A, userId: USER_A });
      seedConversation(prisma, { id: 'active-2', garageId: GARAGE_A, userId: USER_A });
      seedConversation(prisma, {
        id: 'archived',
        garageId: GARAGE_A,
        userId: USER_A,
        archivedAt: new Date(),
      });
      seedConversation(prisma, { id: 'other-garage', garageId: GARAGE_B, userId: USER_A });
      seedConversation(prisma, { id: 'other-user', garageId: GARAGE_A, userId: 'user-x' });

      const list = await service.listForUser(GARAGE_A, USER_A);
      const ids = list.map((c) => c.id).sort();
      expect(ids).toEqual(['active-1', 'active-2']);
    });
  });

  describe('getById', () => {
    it('returns the conversation with messages when authorised', async () => {
      const conv = seedConversation(prisma, { id: 'c1' });
      seedMessage(prisma, conv.id, AssistantMessageRole.USER, 'hi', new Date());
      const result = await service.getById(conv.id, GARAGE_A, USER_A);
      expect(result?.id).toBe('c1');
      expect((result as any).messages.length).toBe(1);
    });

    it('returns null when garage/user does not match', async () => {
      seedConversation(prisma, { id: 'c1', garageId: GARAGE_B });
      const result = await service.getById('c1', GARAGE_A, USER_A);
      expect(result).toBeNull();
    });

    it('returns null when archived', async () => {
      seedConversation(prisma, { id: 'c1', archivedAt: new Date() });
      const result = await service.getById('c1', GARAGE_A, USER_A);
      expect(result).toBeNull();
    });
  });

  describe('softDelete', () => {
    it('sets archivedAt and reports archived: true', async () => {
      const conv = seedConversation(prisma, { id: 'c1' });
      const result = await service.softDelete(conv.id, GARAGE_A, USER_A);
      expect(result.archived).toBe(true);
      expect(prisma.conversations.get(conv.id)?.archivedAt).toBeInstanceOf(Date);
    });

    it('reports archived: false when conversation is foreign', async () => {
      seedConversation(prisma, { id: 'c1', garageId: GARAGE_B });
      const result = await service.softDelete('c1', GARAGE_A, USER_A);
      expect(result.archived).toBe(false);
      expect(prisma.assistantConversation.update).not.toHaveBeenCalled();
    });
  });

  describe('clearMessages', () => {
    it('deletes only the messages of the conversation, leaves the shell', async () => {
      const conv = seedConversation(prisma, { id: 'c1' });
      const other = seedConversation(prisma, { id: 'c2' });
      seedMessage(prisma, conv.id, AssistantMessageRole.USER, 'a', new Date());
      seedMessage(prisma, conv.id, AssistantMessageRole.ASSISTANT, 'b', new Date());
      seedMessage(prisma, other.id, AssistantMessageRole.USER, 'c', new Date());

      const result = await service.clearMessages(conv.id, GARAGE_A, USER_A);
      expect(result.cleared).toBe(2);
      expect(prisma.conversations.has(conv.id)).toBe(true); // shell preserved
      expect([...prisma.messages.values()].some((m) => m.conversationId === conv.id)).toBe(false);
      expect([...prisma.messages.values()].some((m) => m.conversationId === other.id)).toBe(true);
    });

    it('reports cleared: 0 when conversation is foreign', async () => {
      seedConversation(prisma, { id: 'c1', garageId: GARAGE_B });
      const result = await service.clearMessages('c1', GARAGE_A, USER_A);
      expect(result.cleared).toBe(0);
      expect(prisma.assistantMessage.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('generateTitleFromFirstMessage', () => {
    it('calls summarizer and persists the resulting title', async () => {
      const conv = seedConversation(prisma, { id: 'c1' });
      seedMessage(
        prisma,
        conv.id,
        AssistantMessageRole.USER,
        'How much revenue did I make this week and which customers paid?',
        new Date(),
      );
      const summarizer = jest.fn().mockResolvedValue('Weekly revenue check');

      const title = await service.generateTitleFromFirstMessage(conv.id, summarizer);

      expect(title).toBe('Weekly revenue check');
      expect(summarizer).toHaveBeenCalledWith(
        'How much revenue did I make this week and which customers paid?',
      );
      expect(prisma.conversations.get(conv.id)?.title).toBe('Weekly revenue check');
    });

    it('returns the existing title without calling summarizer when already set', async () => {
      const conv = seedConversation(prisma, { id: 'c1', title: 'Already named' });
      seedMessage(prisma, conv.id, AssistantMessageRole.USER, 'msg', new Date());
      const summarizer = jest.fn().mockResolvedValue('Should not run');

      const title = await service.generateTitleFromFirstMessage(conv.id, summarizer);

      expect(title).toBe('Already named');
      expect(summarizer).not.toHaveBeenCalled();
      expect(prisma.assistantConversation.update).not.toHaveBeenCalled();
    });

    it('returns null and does not throw when the summarizer rejects', async () => {
      const conv = seedConversation(prisma, { id: 'c1' });
      seedMessage(prisma, conv.id, AssistantMessageRole.USER, 'hello', new Date());
      const summarizer = jest.fn().mockRejectedValue(new Error('llm down'));

      const title = await service.generateTitleFromFirstMessage(conv.id, summarizer);

      expect(title).toBeNull();
      expect(prisma.conversations.get(conv.id)?.title).toBeNull();
      expect(prisma.assistantConversation.update).not.toHaveBeenCalled();
    });

    it('returns null when no user message exists yet', async () => {
      const conv = seedConversation(prisma, { id: 'c1' });
      seedMessage(prisma, conv.id, AssistantMessageRole.ASSISTANT, 'system msg', new Date());
      const summarizer = jest.fn();

      const title = await service.generateTitleFromFirstMessage(conv.id, summarizer);

      expect(title).toBeNull();
      expect(summarizer).not.toHaveBeenCalled();
    });

    it('returns null when conversation does not exist', async () => {
      const summarizer = jest.fn();
      const title = await service.generateTitleFromFirstMessage('nope', summarizer);
      expect(title).toBeNull();
      expect(summarizer).not.toHaveBeenCalled();
    });

    it('truncates long summaries to 60 characters with an ellipsis', async () => {
      const conv = seedConversation(prisma, { id: 'c1' });
      seedMessage(prisma, conv.id, AssistantMessageRole.USER, 'long', new Date());
      const longRaw = 'a'.repeat(120);
      const summarizer = jest.fn().mockResolvedValue(longRaw);

      const title = await service.generateTitleFromFirstMessage(conv.id, summarizer);

      expect(title).not.toBeNull();
      expect(title!.length).toBeLessThanOrEqual(60);
      expect(title!.endsWith('…')).toBe(true);
    });

    it('strips wrapping quotes and newlines from summarizer output', async () => {
      const conv = seedConversation(prisma, { id: 'c1' });
      seedMessage(prisma, conv.id, AssistantMessageRole.USER, 'q', new Date());
      const summarizer = jest.fn().mockResolvedValue('  "Customer growth strategy"\n');

      const title = await service.generateTitleFromFirstMessage(conv.id, summarizer);

      expect(title).toBe('Customer growth strategy');
    });
  });

  describe('getTotalTokens', () => {
    it('returns the sum of tokensIn + tokensOut across all messages of the conversation', async () => {
      const conv = seedConversation(prisma, { id: 'c-tok' });
      const other = seedConversation(prisma, { id: 'c-other' });
      seedMessage(prisma, conv.id, AssistantMessageRole.USER, 'q', new Date(), {
        in: 100,
        out: 0,
      });
      seedMessage(prisma, conv.id, AssistantMessageRole.ASSISTANT, 'a', new Date(), {
        in: 50,
        out: 200,
      });
      // Other conversation must NOT influence the total.
      seedMessage(prisma, other.id, AssistantMessageRole.USER, 'q', new Date(), {
        in: 9999,
        out: 9999,
      });

      const total = await service.getTotalTokens(conv.id);

      expect(total).toBe(350);
      expect(prisma.assistantMessage.aggregate).toHaveBeenCalledWith({
        _sum: { tokensIn: true, tokensOut: true },
        where: { conversationId: conv.id },
      });
    });

    it('returns 0 when the conversation has no messages', async () => {
      const conv = seedConversation(prisma, { id: 'empty' });
      const total = await service.getTotalTokens(conv.id);
      expect(total).toBe(0);
    });

    it('returns 0 when messages exist but none recorded token counts', async () => {
      const conv = seedConversation(prisma, { id: 'untyped' });
      seedMessage(prisma, conv.id, AssistantMessageRole.USER, 'q', new Date());
      seedMessage(prisma, conv.id, AssistantMessageRole.ASSISTANT, 'a', new Date());
      const total = await service.getTotalTokens(conv.id);
      expect(total).toBe(0);
    });

    it('treats partial token columns as zero when only one side recorded', async () => {
      const conv = seedConversation(prisma, { id: 'partial' });
      // Only tokensIn recorded — tokensOut null. Sum must still resolve.
      seedMessage(prisma, conv.id, AssistantMessageRole.USER, 'q', new Date(), {
        in: 42,
      });
      const total = await service.getTotalTokens(conv.id);
      expect(total).toBe(42);
    });
  });
});
