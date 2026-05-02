import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, toArray } from 'rxjs';
import {
  AssistantBlastTier,
  AssistantMessageRole,
  AssistantToolCallStatus,
} from '@prisma/client';
import { OrchestratorService } from './orchestrator.service';
import { ConversationService } from './conversation.service';
import { LlmGatewayService } from './llm-gateway.service';
import { ToolRegistryService } from './tool-registry.service';
import { SkillRegistryService } from './skill-registry.service';
import { AgentRunnerService } from './agent-runner.service';
import { ApprovalService } from './approval.service';
import { AuditService } from './audit.service';
import { IntentClassifierService } from './intent-classifier.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssistantUserContext, LlmCompletionResult, SseEvent } from './types';

const ctx: AssistantUserContext = {
  userId: 'user-1',
  garageId: 'garage-1',
  email: 'owner@example.com',
  role: 'OWNER',
  enabledModules: ['analytics', 'invoicing'],
  locale: 'en',
};

const collectEvents = (obs: any) =>
  firstValueFrom(obs.pipe(toArray())) as Promise<SseEvent[]>;

const makeLlm = (results: LlmCompletionResult[]): LlmGatewayService => {
  let i = 0;
  return {
    complete: jest.fn().mockImplementation(async () => {
      const result = results[Math.min(i, results.length - 1)];
      i++;
      return result;
    }),
  } as unknown as LlmGatewayService;
};

const makeConversation = (history: any[] = [], totalTokens = 0) => ({
  appendMessage: jest.fn().mockImplementation(async (args: any) => ({
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    ...args,
  })),
  getRecentHistory: jest.fn().mockResolvedValue(history),
  getTotalTokens: jest.fn().mockResolvedValue(totalTokens),
  generateTitleFromFirstMessage: jest.fn().mockResolvedValue(null),
});

const makeTools = (
  toolNames: string[],
  execImpl?: (name: string, args: unknown) => any,
) => {
  const get = jest.fn().mockImplementation((name: string) =>
    toolNames.includes(name)
      ? {
          name,
          description: 'desc',
          parameters: { type: 'object', properties: {} },
          blastTier: AssistantBlastTier.READ,
          handler: async () => ({}),
        }
      : undefined,
  );
  return {
    listForUser: jest.fn().mockReturnValue(
      toolNames.map((n) => ({
        name: n,
        description: 'desc',
        parameters: { type: 'object', properties: {} },
      })),
    ),
    get,
    validateArgs: jest.fn().mockReturnValue({ valid: true }),
    resolveBlastTier: jest
      .fn()
      .mockImplementation((tool: any) => tool.blastTier),
    execute: jest
      .fn()
      .mockImplementation(
        async (name: string, args: unknown, callerCtx: any) => {
          if (execImpl) return execImpl(name, args);
          return {
            ok: true,
            result: { ran: name, ctxGarage: callerCtx.garageId },
            durationMs: 1,
          };
        },
      ),
  };
};

const makeSkills = () => ({
  list: jest.fn().mockReturnValue([]),
  load: jest.fn().mockReturnValue(null),
});

const makeAgents = () => ({
  list: jest.fn().mockReturnValue([]),
  run: jest.fn().mockResolvedValue({ result: 'agent says hi' }),
});

const makeApprovals = () => ({
  createPending: jest
    .fn()
    .mockResolvedValue({ expiresAt: new Date('2030-01-01') }),
});

const makeAudit = () => ({
  logToolCall: jest.fn().mockResolvedValue({ id: 'audit-1' }),
});

const makePrisma = () => ({
  assistantToolCall: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
});

function makeClassifier(picked: string[] | null = null) {
  // null → "always fall through" so existing tests see the full tool set
  return { classify: jest.fn(async () => picked) };
}

async function makeOrchestrator(overrides: {
  llm?: LlmGatewayService;
  conversation?: any;
  tools?: any;
  skills?: any;
  agents?: any;
  approvals?: any;
  audit?: any;
  classifier?: any;
  prisma?: any;
}) {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      OrchestratorService,
      {
        provide: LlmGatewayService,
        useValue:
          overrides.llm ??
          makeLlm([{ provider: 'mock', content: 'hi', toolCalls: [] }]),
      },
      {
        provide: ConversationService,
        useValue: overrides.conversation ?? makeConversation(),
      },
      {
        provide: ToolRegistryService,
        useValue: overrides.tools ?? makeTools([]),
      },
      {
        provide: SkillRegistryService,
        useValue: overrides.skills ?? makeSkills(),
      },
      {
        provide: AgentRunnerService,
        useValue: overrides.agents ?? makeAgents(),
      },
      {
        provide: ApprovalService,
        useValue: overrides.approvals ?? makeApprovals(),
      },
      { provide: AuditService, useValue: overrides.audit ?? makeAudit() },
      {
        provide: IntentClassifierService,
        useValue: overrides.classifier ?? makeClassifier(),
      },
      { provide: PrismaService, useValue: overrides.prisma ?? makePrisma() },
    ],
  }).compile();
  return moduleRef.get(OrchestratorService);
}

describe('OrchestratorService', () => {
  it('emits text + done and persists assistant message on direct reply', async () => {
    const conversation = makeConversation();
    const llm = makeLlm([
      { provider: 'groq', content: 'How can I help?', toolCalls: [] },
    ]);
    const orchestrator = await makeOrchestrator({ conversation, llm });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'hello', undefined),
    );

    expect(events.find((e) => e.type === 'text')).toEqual({
      type: 'text',
      delta: 'How can I help?',
    });
    expect(events.find((e) => e.type === 'done')).toBeDefined();

    const calls = conversation.appendMessage.mock.calls.map((c: any[]) => c[0]);
    expect(
      calls.find((m: any) => m.role === AssistantMessageRole.USER),
    ).toMatchObject({
      content: 'hello',
    });
    expect(
      calls.find((m: any) => m.role === AssistantMessageRole.ASSISTANT),
    ).toMatchObject({
      content: 'How can I help?',
      llmProvider: 'groq',
    });
  });

  it('handles a READ tool call: tool_call → tool_result → text → done', async () => {
    const tools = makeTools(['get_dashboard_kpis']);
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [{ id: 'tc-1', name: 'get_dashboard_kpis', argsJson: '{}' }],
      },
      { provider: 'groq', content: 'Revenue is 1234 TND.', toolCalls: [] },
    ]);
    const audit = makeAudit();
    const orchestrator = await makeOrchestrator({ tools, llm, audit });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'how much revenue?', undefined),
    );

    const types = events.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(['tool_call', 'tool_result', 'text', 'done']),
    );
    const toolCall = events.find((e) => e.type === 'tool_call');
    expect(toolCall).toMatchObject({ name: 'get_dashboard_kpis' });
    const toolResult = events.find((e) => e.type === 'tool_result');
    expect(toolResult).toMatchObject({ status: 'executed' });

    expect(tools.execute).toHaveBeenCalledWith(
      'get_dashboard_kpis',
      {},
      expect.objectContaining({ garageId: 'garage-1', userId: 'user-1' }),
    );
    expect(audit.logToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'get_dashboard_kpis',
        status: AssistantToolCallStatus.EXECUTED,
      }),
    );
  });

  it('emits a failed tool_result for an unknown tool and continues', async () => {
    const tools = makeTools(['known_tool']);
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [{ id: 'tc-1', name: 'ghost_tool', argsJson: '{}' }],
      },
      {
        provider: 'groq',
        content: 'I tried but the tool was unknown.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'do a thing', undefined),
    );

    const failed = events.find(
      (e) => e.type === 'tool_result' && e.status === 'failed',
    );
    expect(failed).toBeDefined();
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'I tried but the tool was unknown.',
    });
    expect(events.find((e) => e.type === 'done')).toBeDefined();
  });

  it('emits approval_request and ends the turn for CONFIRM_WRITE tools', async () => {
    const tools = makeTools(['send_sms']);
    tools.resolveBlastTier.mockReturnValue(AssistantBlastTier.CONFIRM_WRITE);
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          { id: 'tc-1', name: 'send_sms', argsJson: '{"to":"+216..."}' },
        ],
      },
    ]);
    const approvals = makeApprovals();
    const orchestrator = await makeOrchestrator({ tools, llm, approvals });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'send sms', undefined),
    );

    const approval = events.find((e) => e.type === 'approval_request');
    expect(approval).toMatchObject({
      toolName: 'send_sms',
      blastTier: AssistantBlastTier.CONFIRM_WRITE,
    });
    expect(approvals.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'send_sms',
        conversationId: 'conv-1',
      }),
    );
    expect(tools.execute).not.toHaveBeenCalled();
    expect(events.find((e) => e.type === 'done')).toBeDefined();
  });

  it('emits an apology when iteration cap is exceeded', async () => {
    const tools = makeTools(['noop']);
    // Always emit a tool call, never a text reply.
    const llm = {
      complete: jest.fn().mockResolvedValue({
        provider: 'groq',
        content: null,
        toolCalls: [{ id: 'tc-x', name: 'noop', argsJson: '{}' }],
      }),
    } as unknown as LlmGatewayService;
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'loop forever', undefined, {
        iterationCap: 2,
      }),
    );

    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: expect.stringMatching(/couldn't finish/i),
    });
    expect(events.find((e) => e.type === 'done')).toBeDefined();
    expect((llm.complete as jest.Mock).mock.calls.length).toBe(2);
  });

  it('passes the caller ctx to tools.execute (multi-tenancy)', async () => {
    const tools = makeTools(['get_x']);
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [{ id: 'tc-1', name: 'get_x', argsJson: '{}' }],
      },
      { provider: 'groq', content: 'done', toolCalls: [] },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    await collectEvents(
      orchestrator.run(
        { ...ctx, garageId: 'garage-special', userId: 'user-special' },
        'conv-special',
        'go',
        undefined,
      ),
    );

    expect(tools.execute).toHaveBeenCalledWith(
      'get_x',
      {},
      expect.objectContaining({
        garageId: 'garage-special',
        userId: 'user-special',
      }),
    );
  });

  it('treats invalid tool args as a recoverable failure', async () => {
    const tools = makeTools(['needs_args']);
    tools.validateArgs.mockReturnValue({
      valid: false,
      errors: ['count is required'],
    });
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [{ id: 'tc-1', name: 'needs_args', argsJson: '{}' }],
      },
      { provider: 'groq', content: 'sorry, fixing.', toolCalls: [] },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'go', undefined),
    );

    const failed = events.find(
      (e) => e.type === 'tool_result' && e.status === 'failed',
    );
    expect(failed).toBeDefined();
    expect(tools.execute).not.toHaveBeenCalled();
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'sorry, fixing.',
    });
  });

  it('resumes an APPROVED tool call when given a __resume__ sentinel', async () => {
    const tools = makeTools(['send_sms']);
    const llm = makeLlm([
      { provider: 'groq', content: 'Sent.', toolCalls: [] },
    ]);
    const prisma = {
      assistantToolCall: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tc-99',
          conversationId: 'conv-1',
          toolName: 'send_sms',
          argsJson: { to: '+216...' },
          status: AssistantToolCallStatus.APPROVED,
          conversation: { garageId: 'garage-1', userId: 'user-1' },
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const conversation = makeConversation();
    const orchestrator = await makeOrchestrator({
      tools,
      llm,
      prisma,
      conversation,
    });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', '__resume__:tc-99', undefined),
    );

    const toolResult = events.find((e) => e.type === 'tool_result');
    expect(toolResult).toMatchObject({
      toolCallId: 'tc-99',
      status: 'executed',
    });
    expect(prisma.assistantToolCall.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tc-99' },
        data: expect.objectContaining({
          status: AssistantToolCallStatus.EXECUTED,
        }),
      }),
    );
    // The user resume sentinel itself should NOT be re-persisted as a user
    // message — only the original turn persisted that.
    const userMsgs = conversation.appendMessage.mock.calls.filter(
      (c: any[]) => c[0].role === AssistantMessageRole.USER,
    );
    expect(userMsgs).toHaveLength(0);
  });

  it('records DENIED resumption without executing the tool', async () => {
    const tools = makeTools(['send_sms']);
    const llm = makeLlm([
      { provider: 'groq', content: 'Got it, not sending.', toolCalls: [] },
    ]);
    const prisma = {
      assistantToolCall: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tc-99',
          conversationId: 'conv-1',
          toolName: 'send_sms',
          argsJson: { to: '+216...' },
          status: AssistantToolCallStatus.DENIED,
          conversation: { garageId: 'garage-1', userId: 'user-1' },
        }),
        update: jest.fn(),
      },
    };
    const orchestrator = await makeOrchestrator({ tools, llm, prisma });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', '__resume__:tc-99', undefined),
    );

    expect(tools.execute).not.toHaveBeenCalled();
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'Got it, not sending.',
    });
  });

  it('refuses resumption for a foreign garage', async () => {
    const prisma = {
      assistantToolCall: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tc-99',
          conversationId: 'conv-1',
          toolName: 'send_sms',
          argsJson: {},
          status: AssistantToolCallStatus.APPROVED,
          conversation: { garageId: 'OTHER-GARAGE', userId: 'user-1' },
        }),
        update: jest.fn(),
      },
    };
    const orchestrator = await makeOrchestrator({ prisma });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', '__resume__:tc-99', undefined),
    );

    expect(events.find((e) => e.type === 'error')).toBeDefined();
    expect(prisma.assistantToolCall.update).not.toHaveBeenCalled();
  });

  it('exposes load_skill / dispatch_agent pseudo-tools when available', async () => {
    const skills = {
      list: jest
        .fn()
        .mockReturnValue([
          { name: 'daily-briefing', description: 'morning summary' },
        ]),
      load: jest.fn().mockReturnValue('You are a briefing assistant…'),
    };
    const agents = {
      list: jest
        .fn()
        .mockReturnValue([
          { name: 'AnalyticsAgent', description: 'deep dives' },
        ]),
      run: jest.fn(),
    };
    const tools = makeTools([]);
    const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
    const orchestrator = await makeOrchestrator({ tools, llm, skills, agents });

    await collectEvents(orchestrator.run(ctx, 'conv-1', 'hi', undefined));

    const completeCall = (llm.complete as jest.Mock).mock.calls[0][0];
    const toolNames: string[] = completeCall.tools.map((t: any) => t.name);
    expect(toolNames).toEqual(
      expect.arrayContaining(['load_skill', 'dispatch_agent']),
    );
  });

  it('emits skill_loaded when the LLM calls load_skill', async () => {
    const skills = {
      list: jest
        .fn()
        .mockReturnValue([
          { name: 'daily-briefing', description: 'morning summary' },
        ]),
      load: jest.fn().mockReturnValue('You are a briefing assistant…'),
    };
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-1',
            name: 'load_skill',
            argsJson: '{"name":"daily-briefing"}',
          },
        ],
      },
      { provider: 'groq', content: 'Briefing loaded.', toolCalls: [] },
    ]);
    const orchestrator = await makeOrchestrator({ llm, skills });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'brief me', undefined),
    );

    expect(skills.load).toHaveBeenCalledWith('daily-briefing', 'en');
    expect(events.find((e) => e.type === 'skill_loaded')).toMatchObject({
      skillName: 'daily-briefing',
    });
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'Briefing loaded.',
    });
  });

  it('dispatches an agent and forwards its result', async () => {
    const agents = {
      list: jest
        .fn()
        .mockReturnValue([
          { name: 'AnalyticsAgent', description: 'deep dives' },
        ]),
      run: jest.fn().mockResolvedValue({ result: 'Q3 revenue = 12345' }),
    };
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-1',
            name: 'dispatch_agent',
            argsJson:
              '{"name":"AnalyticsAgent","input":"compute revenue","reason":"deep math"}',
          },
        ],
      },
      { provider: 'groq', content: 'Q3 revenue = 12345', toolCalls: [] },
    ]);
    const orchestrator = await makeOrchestrator({ llm, agents });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'analyze Q3', undefined),
    );

    expect(events.find((e) => e.type === 'agent_dispatch')).toMatchObject({
      agentName: 'AnalyticsAgent',
      reason: 'deep math',
    });
    expect(events.find((e) => e.type === 'agent_result')).toMatchObject({
      agentName: 'AnalyticsAgent',
      result: 'Q3 revenue = 12345',
    });
    expect(agents.run).toHaveBeenCalledWith(
      'AnalyticsAgent',
      'compute revenue',
      expect.objectContaining({ garageId: 'garage-1' }),
    );
  });

  it('emits budget_exceeded + done and skips the LLM when the conversation is over budget', async () => {
    const conversation = makeConversation([], 250_000);
    const llm = makeLlm([
      { provider: 'groq', content: 'should never run', toolCalls: [] },
    ]);
    const orchestrator = await makeOrchestrator({ conversation, llm });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'expensive question', undefined),
    );

    const types = events.map((e) => e.type);
    expect(types).toContain('budget_exceeded');
    expect(types).toContain('done');
    const budget = events.find((e) => e.type === 'budget_exceeded');
    expect(budget).toMatchObject({
      message: expect.stringContaining('token budget'),
    });

    // LLM must NOT be called once the cap is hit.
    expect(llm.complete).not.toHaveBeenCalled();

    // System message persisted so the user sees a transcript record.
    const sysMessages = conversation.appendMessage.mock.calls
      .map((c: any[]) => c[0])
      .filter((m: any) => m.role === AssistantMessageRole.SYSTEM);
    expect(sysMessages).toHaveLength(1);
    expect(sysMessages[0].content).toMatch(/token budget/i);
  });

  it('runs normally when token usage is below the per-conversation budget', async () => {
    const conversation = makeConversation([], 199_999);
    const llm = makeLlm([{ provider: 'groq', content: 'fine', toolCalls: [] }]);
    const orchestrator = await makeOrchestrator({ conversation, llm });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'still ok', undefined),
    );

    expect(events.find((e) => e.type === 'budget_exceeded')).toBeUndefined();
    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'fine',
    });
  });

  describe('action-verb tool augmentation', () => {
    const arabicCtx: AssistantUserContext = { ...ctx, locale: 'ar' };
    const frenchCtx: AssistantUserContext = { ...ctx, locale: 'fr' };

    function toolNamesFromFirstCall(llm: LlmGatewayService): string[] {
      const firstCallArgs = (llm.complete as jest.Mock).mock.calls[0][0];
      const tools = firstCallArgs.tools ?? [];
      return tools.map((t: { name: string }) => t.name);
    }

    it('adds send_email when classifier picked only the read tool for "email me invoices"', async () => {
      const tools = makeTools([
        'list_invoices',
        'send_email',
        'find_customer',
        'get_dashboard_kpis',
      ]);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier(['list_invoices']);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(
          ctx,
          'conv-1',
          'send me an email with the first 3 invoices of this year to my personal email',
          undefined,
        ),
      );

      const names = toolNamesFromFirstCall(llm);
      expect(names).toEqual(
        expect.arrayContaining(['list_invoices', 'send_email']),
      );
    });

    it('pairs find_customer with send_sms so the LLM can resolve a recipient by name', async () => {
      const tools = makeTools([
        'list_overdue_invoices',
        'send_sms',
        'find_customer',
      ]);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier(['list_overdue_invoices']);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(
          ctx,
          'conv-1',
          'send a polite SMS reminder to Ali Ben Salah about their overdue invoice',
          undefined,
        ),
      );

      const names = toolNamesFromFirstCall(llm);
      expect(names).toEqual(
        expect.arrayContaining([
          'list_overdue_invoices',
          'send_sms',
          'find_customer',
        ]),
      );
    });

    it('pairs find_customer with send_email for "email <name> a reminder" requests', async () => {
      const tools = makeTools(['send_email', 'find_customer']);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier([]);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(
          ctx,
          'conv-1',
          'email Sarah a service reminder',
          undefined,
        ),
      );

      const names = toolNamesFromFirstCall(llm);
      expect(names).toEqual(
        expect.arrayContaining(['send_email', 'find_customer']),
      );
    });

    it('adds send_email when classifier returned [] (chitchat) but the message asks to email', async () => {
      const tools = makeTools(['list_invoices', 'send_email']);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier([]);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(
          ctx,
          'conv-1',
          'email me the invoices please',
          undefined,
        ),
      );

      const names = toolNamesFromFirstCall(llm);
      // keywordFallback adds list_invoices via "invoice"; augmenter adds send_email
      expect(names).toEqual(
        expect.arrayContaining(['list_invoices', 'send_email']),
      );
    });

    it('adds send_sms for "text me" requests', async () => {
      const tools = makeTools(['list_overdue_invoices', 'send_sms']);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier(['list_overdue_invoices']);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(
          ctx,
          'conv-1',
          'text me the list of overdue customers',
          undefined,
        ),
      );

      const names = toolNamesFromFirstCall(llm);
      expect(names).toEqual(
        expect.arrayContaining(['list_overdue_invoices', 'send_sms']),
      );
    });

    it('augments French "envoie-moi un email" → send_email', async () => {
      const tools = makeTools(['get_revenue_summary', 'send_email']);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier(['get_revenue_summary']);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(
          frenchCtx,
          'conv-1',
          "envoie-moi un email avec le chiffre d'affaires du mois",
          undefined,
        ),
      );

      const names = toolNamesFromFirstCall(llm);
      expect(names).toEqual(
        expect.arrayContaining(['get_revenue_summary', 'send_email']),
      );
    });

    it('augments Arabic "أرسل ... إيميل" → send_email', async () => {
      const tools = makeTools(['list_invoices', 'send_email']);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier(['list_invoices']);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(
          arabicCtx,
          'conv-1',
          'أرسل لي إيميل بفواتير هذا الشهر',
          undefined,
        ),
      );

      const names = toolNamesFromFirstCall(llm);
      expect(names).toEqual(
        expect.arrayContaining(['list_invoices', 'send_email']),
      );
    });

    it('does NOT add send_email for bare-noun "email" in non-action queries', async () => {
      const tools = makeTools(['get_customer', 'send_email']);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier(['get_customer']);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(
          ctx,
          'conv-1',
          "what's the customer's email address?",
          undefined,
        ),
      );

      const names = toolNamesFromFirstCall(llm);
      expect(names).toEqual(expect.arrayContaining(['get_customer']));
      expect(names).not.toContain('send_email');
    });

    it('does NOT inject augmenter tools that are not in the user-visible registry', async () => {
      // send_email is missing from the user's tool slice (e.g. role-gated).
      const tools = makeTools(['list_invoices']);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier(['list_invoices']);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(ctx, 'conv-1', 'email me the invoices', undefined),
      );

      const names = toolNamesFromFirstCall(llm);
      expect(names).toEqual(expect.arrayContaining(['list_invoices']));
      expect(names).not.toContain('send_email');
    });
  });

  describe('user identity in system prompt', () => {
    function getSystemPrompt(llm: LlmGatewayService): string {
      const call = (llm.complete as jest.Mock).mock.calls[0][0];
      const sys = call.messages.find((m: any) => m.role === 'system');
      return sys?.content ?? '';
    }

    it('injects current user email + role into the verbose system prompt', async () => {
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const orchestrator = await makeOrchestrator({ llm });

      await collectEvents(orchestrator.run(ctx, 'conv-1', 'hi', undefined));

      const prompt = getSystemPrompt(llm);
      expect(prompt).toMatch(/Current user: owner@example\.com/);
      expect(prompt).toMatch(/role: OWNER/);
      expect(prompt).toMatch(/garage owner/);
      expect(prompt).toMatch(/SELF-SEND/);
    });

    it('labels STAFF role correctly and omits owner alias', async () => {
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const orchestrator = await makeOrchestrator({ llm });

      await collectEvents(
        orchestrator.run(
          { ...ctx, role: 'STAFF', email: 'mech@example.com' },
          'conv-1',
          'hi',
          undefined,
        ),
      );

      const prompt = getSystemPrompt(llm);
      expect(prompt).toMatch(/Current user: mech@example\.com/);
      expect(prompt).toMatch(/role: STAFF, staff member/);
    });

    it('handles users with no email by telling the model to refuse and not guess', async () => {
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const orchestrator = await makeOrchestrator({ llm });

      await collectEvents(
        orchestrator.run({ ...ctx, email: null }, 'conv-1', 'hi', undefined),
      );

      const prompt = getSystemPrompt(llm);
      expect(prompt).toMatch(/no email on file/);
      expect(prompt).toMatch(/Do NOT guess an address/);
      expect(prompt).not.toMatch(/SELF-SEND/);
    });
  });

  describe('multi-step action chaining (READ → write)', () => {
    it('keeps tools available after a READ tool fires so the model can chain into a write tool', async () => {
      // Iteration 1: model calls list_invoices (READ).
      // Iteration 2: model should still have tools available so it can
      // chain into send_email — the bug we're fixing was that iteration 2
      // had `offeredTools = undefined`, leaving the model unable to send.
      const tools = makeTools(['list_invoices', 'send_email']);
      tools.resolveBlastTier.mockImplementation((tool: any) => tool.blastTier);
      tools.get.mockImplementation((name: string) => {
        if (name === 'list_invoices') {
          return {
            name,
            description: 'd',
            parameters: {},
            blastTier: AssistantBlastTier.READ,
            handler: async () => ({}),
          };
        }
        if (name === 'send_email') {
          return {
            name,
            description: 'd',
            parameters: {},
            blastTier: AssistantBlastTier.AUTO_WRITE,
            handler: async () => ({}),
          };
        }
        return undefined;
      });

      const llm = makeLlm([
        // Iter 1: classifier picks list_invoices, model calls it.
        {
          provider: 'mistral',
          content: null,
          toolCalls: [{ id: 'tc-1', name: 'list_invoices', argsJson: '{}' }],
        },
        // Iter 2: model chains into send_email. THIS would have been
        // impossible before the fix because offeredTools was undefined.
        {
          provider: 'mistral',
          content: null,
          toolCalls: [
            {
              id: 'tc-2',
              name: 'send_email',
              argsJson: '{"to":"owner@example.com","subject":"X","text":"Y"}',
            },
          ],
        },
        // Iter 3: model summarises (no more tools after the AUTO_WRITE).
        {
          provider: 'mistral',
          content: 'Email sent.',
          toolCalls: [],
        },
      ]);
      const orchestrator = await makeOrchestrator({ tools, llm });

      await collectEvents(
        orchestrator.run(ctx, 'conv-1', 'email me the invoices', undefined),
      );

      const calls = (llm.complete as jest.Mock).mock.calls;
      expect(calls.length).toBe(3);

      // Iteration 2 (after the READ tool fired) MUST still receive tools.
      expect(calls[1][0].tools).toBeDefined();
      expect(calls[1][0].tools.length).toBeGreaterThan(0);

      // Iteration 3 (after the AUTO_WRITE tool fired) should drop tools
      // and switch to compose-only mode — the action is complete.
      expect(calls[2][0].tools).toBeUndefined();

      // Both tools were actually executed.
      expect(tools.execute).toHaveBeenCalledWith(
        'list_invoices',
        expect.anything(),
        expect.anything(),
      );
      expect(tools.execute).toHaveBeenCalledWith(
        'send_email',
        expect.anything(),
        expect.anything(),
      );
    });

    it('switches to compose-only immediately after a write-tier tool (no READ before)', async () => {
      // Direct write tool — no READ chain. Should swap to compose-only
      // on iter 2 just like before the fix (no regression).
      const tools = makeTools(['send_email']);
      tools.get.mockImplementation((name: string) => ({
        name,
        description: 'd',
        parameters: {},
        blastTier: AssistantBlastTier.AUTO_WRITE,
        handler: async () => ({}),
      }));
      tools.resolveBlastTier.mockReturnValue(AssistantBlastTier.AUTO_WRITE);

      const llm = makeLlm([
        {
          provider: 'mistral',
          content: null,
          toolCalls: [
            {
              id: 'tc-1',
              name: 'send_email',
              argsJson: '{"to":"owner@example.com","subject":"X","text":"Y"}',
            },
          ],
        },
        { provider: 'mistral', content: 'Done.', toolCalls: [] },
      ]);
      const orchestrator = await makeOrchestrator({ tools, llm });

      await collectEvents(
        orchestrator.run(ctx, 'conv-1', 'send a quick email', undefined),
      );

      const calls = (llm.complete as jest.Mock).mock.calls;
      expect(calls.length).toBe(2);
      // Compose-only kicks in immediately after a write tool.
      expect(calls[1][0].tools).toBeUndefined();
    });
  });
});
