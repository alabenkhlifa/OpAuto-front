import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, toArray } from 'rxjs';
import { AssistantBlastTier, AssistantMessageRole, AssistantToolCallStatus } from '@prisma/client';
import { OrchestratorService } from './orchestrator.service';
import { ConversationService } from './conversation.service';
import { LlmGatewayService } from './llm-gateway.service';
import { ToolRegistryService } from './tool-registry.service';
import { SkillRegistryService } from './skill-registry.service';
import { AgentRunnerService } from './agent-runner.service';
import { ApprovalService } from './approval.service';
import { AuditService } from './audit.service';
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

const collectEvents = (obs: any) => firstValueFrom(obs.pipe(toArray())) as Promise<SseEvent[]>;

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

const makeConversation = (history: any[] = []) => ({
  appendMessage: jest.fn().mockImplementation(async (args: any) => ({
    id: `msg-${Math.random().toString(36).slice(2, 8)}`,
    ...args,
  })),
  getRecentHistory: jest.fn().mockResolvedValue(history),
  generateTitleFromFirstMessage: jest.fn().mockResolvedValue(null),
});

const makeTools = (toolNames: string[], execImpl?: (name: string, args: unknown) => any) => {
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
    resolveBlastTier: jest.fn().mockImplementation((tool: any) => tool.blastTier),
    execute: jest.fn().mockImplementation(async (name: string, args: unknown, callerCtx: any) => {
      if (execImpl) return execImpl(name, args);
      return { ok: true, result: { ran: name, ctxGarage: callerCtx.garageId }, durationMs: 1 };
    }),
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
  createPending: jest.fn().mockResolvedValue({ expiresAt: new Date('2030-01-01') }),
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

async function makeOrchestrator(overrides: {
  llm?: LlmGatewayService;
  conversation?: any;
  tools?: any;
  skills?: any;
  agents?: any;
  approvals?: any;
  audit?: any;
  prisma?: any;
}) {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      OrchestratorService,
      { provide: LlmGatewayService, useValue: overrides.llm ?? makeLlm([{ provider: 'mock', content: 'hi', toolCalls: [] }]) },
      { provide: ConversationService, useValue: overrides.conversation ?? makeConversation() },
      { provide: ToolRegistryService, useValue: overrides.tools ?? makeTools([]) },
      { provide: SkillRegistryService, useValue: overrides.skills ?? makeSkills() },
      { provide: AgentRunnerService, useValue: overrides.agents ?? makeAgents() },
      { provide: ApprovalService, useValue: overrides.approvals ?? makeApprovals() },
      { provide: AuditService, useValue: overrides.audit ?? makeAudit() },
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
    expect(calls.find((m: any) => m.role === AssistantMessageRole.USER)).toMatchObject({
      content: 'hello',
    });
    expect(calls.find((m: any) => m.role === AssistantMessageRole.ASSISTANT)).toMatchObject({
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
        toolCalls: [
          { id: 'tc-1', name: 'get_dashboard_kpis', argsJson: '{}' },
        ],
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
      { provider: 'groq', content: 'I tried but the tool was unknown.', toolCalls: [] },
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
        toolCalls: [{ id: 'tc-1', name: 'send_sms', argsJson: '{"to":"+216..."}' }],
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
      expect.objectContaining({ toolName: 'send_sms', conversationId: 'conv-1' }),
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
    tools.validateArgs.mockReturnValue({ valid: false, errors: ['count is required'] });
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
      list: jest.fn().mockReturnValue([
        { name: 'daily-briefing', description: 'morning summary' },
      ]),
      load: jest.fn().mockReturnValue('You are a briefing assistant…'),
    };
    const agents = {
      list: jest.fn().mockReturnValue([
        { name: 'AnalyticsAgent', description: 'deep dives' },
      ]),
      run: jest.fn(),
    };
    const tools = makeTools([]);
    const llm = makeLlm([
      { provider: 'groq', content: 'ok', toolCalls: [] },
    ]);
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
      list: jest.fn().mockReturnValue([
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
      list: jest.fn().mockReturnValue([
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
});
