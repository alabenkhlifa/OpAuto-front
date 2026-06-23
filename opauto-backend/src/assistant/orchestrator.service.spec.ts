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
    listAllNames: jest.fn().mockReturnValue([...toolNames]),
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
      {
        provider: 'groq',
        purpose: 'assistant_tool_selection',
        model: 'llama-3.1-8b-instant',
        content: 'How can I help?',
        toolCalls: [],
        tokensIn: 44,
        tokensOut: 6,
      },
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
      llmModel: 'llama-3.1-8b-instant',
      llmPurpose: 'assistant_tool_selection',
      tokensIn: 44,
      tokensOut: 6,
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
          { id: 'tc-1', name: 'send_sms', argsJson: '{"to":"+21612345678"}' },
        ],
      },
    ]);
    const approvals = makeApprovals();
    const orchestrator = await makeOrchestrator({ tools, llm, approvals });

    const events = await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'send sms to +21612345678', undefined),
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

  it('rejects cancellation approval when the user explicitly provided an invalid appointment id', async () => {
    const tools = makeTools(['cancel_appointment']);
    tools.resolveBlastTier.mockReturnValue(AssistantBlastTier.CONFIRM_WRITE);
    const validButWrongId = '21a3766b-2728-4f87-9522-b1517bb5ebf7';
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-1',
            name: 'cancel_appointment',
            argsJson: JSON.stringify({ appointmentId: validButWrongId }),
          },
        ],
      },
      {
        provider: 'groq',
        content: 'That appointment id is not valid.',
        toolCalls: [],
      },
    ]);
    const approvals = makeApprovals();
    const prisma = {
      ...makePrisma(),
      appointment: { findFirst: jest.fn() },
    };
    const orchestrator = await makeOrchestrator({
      tools,
      llm,
      approvals,
      prisma,
    });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-1',
        'Cancel the appointment with id banana.',
        undefined,
      ),
    );

    expect(events.find((e) => e.type === 'approval_request')).toBeUndefined();
    expect(approvals.createPending).not.toHaveBeenCalled();
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({
      status: 'failed',
      result: expect.objectContaining({
        error: 'invalid_appointment_identifier',
      }),
    });
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'That appointment id is not valid.',
    });
  });

  it('rejects SMS approval when the recipient customer id is a placeholder', async () => {
    const tools = makeTools(['send_sms']);
    tools.resolveBlastTier.mockReturnValue(AssistantBlastTier.CONFIRM_WRITE);
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-1',
            name: 'send_sms',
            argsJson: JSON.stringify({
              to: '+21612345678',
              body: 'Your car is ready.',
              customerId: 'customer-id-12345',
            }),
          },
        ],
      },
      {
        provider: 'groq',
        content: 'I need the real customer first.',
        toolCalls: [],
      },
    ]);
    const approvals = makeApprovals();
    const prisma = {
      ...makePrisma(),
      customer: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const orchestrator = await makeOrchestrator({
      tools,
      llm,
      approvals,
      prisma,
    });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-1',
        'Text Khaoula Khelifi that her car is ready.',
        undefined,
      ),
    );

    expect(events.find((e) => e.type === 'approval_request')).toBeUndefined();
    expect(approvals.createPending).not.toHaveBeenCalled();
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({
      status: 'failed',
      result: expect.objectContaining({ error: 'customer_not_found' }),
    });
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'I need the real customer first.',
    });
  });

  it('rejects empty send_email auto-write calls before executing the handler', async () => {
    const tools = makeTools(['send_email']);
    tools.get.mockImplementation((name: string) => ({
      name,
      description: 'desc',
      parameters: { type: 'object', properties: {} },
      blastTier: AssistantBlastTier.AUTO_WRITE,
      handler: async () => ({}),
    }));
    tools.resolveBlastTier.mockReturnValue(AssistantBlastTier.AUTO_WRITE);
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-1',
            name: 'send_email',
            argsJson: JSON.stringify({
              subject: 'Invoice for Khaoula Khelifi',
              attachInvoiceIds: ['[insert invoice id here]'],
            }),
          },
        ],
      },
      {
        provider: 'groq',
        content: 'I need the invoice content first.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-1',
        'Make an invoice for Khaoula.',
        undefined,
      ),
    );

    expect(tools.execute).not.toHaveBeenCalled();
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({
      status: 'failed',
      result: expect.objectContaining({ error: 'empty_email_payload' }),
    });
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'I need the invoice content first.',
    });
  });

  it('blocks send_email when the user asked for a draft only', async () => {
    const tools = makeTools(['send_email']);
    tools.get.mockImplementation((name: string) => ({
      name,
      description: 'desc',
      parameters: { type: 'object', properties: {} },
      blastTier: AssistantBlastTier.AUTO_WRITE,
      handler: async () => ({}),
    }));
    tools.resolveBlastTier.mockReturnValue(AssistantBlastTier.AUTO_WRITE);
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-1',
            name: 'send_email',
            argsJson: JSON.stringify({
              subject: 'Overdue invoices',
              text: 'Here is the overdue invoice list.',
            }),
          },
        ],
      },
      {
        provider: 'groq',
        content: 'No email was sent. Draft: Here is the overdue invoice list.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-draft-email',
        'Draft an email to myself with the overdue invoices list, but do not send it.',
        undefined,
      ),
    );

    expect(tools.execute).not.toHaveBeenCalled();
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({
      status: 'failed',
      result: expect.objectContaining({
        error: 'draft_only_email_requested',
      }),
    });
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'No email was sent. Draft: Here is the overdue invoice list.',
    });
  });

  it('drafts overdue invoice email text when the model returns empty after fetching data', async () => {
    const tools = makeTools(['list_overdue_invoices'], () => ({
      ok: true,
      result: {
        invoices: [
          {
            invoiceNumber: 'INV-202509-0001',
            customerName: 'Ali Hassine',
            customerPhone: '+216 20 111 222',
            total: 49.98,
            daysOverdue: 273,
          },
          {
            invoiceNumber: 'INV-202510-0004',
            customerName: 'Mouna Trabelsi',
            customerPhone: '+216 20 333 444',
            total: 150,
            daysOverdue: 210,
          },
        ],
        count: 2,
        totalOutstanding: 199.98,
      },
      durationMs: 1,
    }));
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-1',
            name: 'list_overdue_invoices',
            argsJson: '{}',
          },
        ],
      },
      {
        provider: 'groq',
        content: '',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-draft-overdue-empty',
        'Draft an email to myself with the overdue invoices list, but do not send it.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining('No email was sent.'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('Subject: Overdue invoices'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('Total outstanding: 199.98 TND'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('INV-202509-0001 - Ali Hassine'),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(/customerId|invoice id|uuid/i),
    });
  });

  it('prepends no-send notice when draft-only text is non-empty', async () => {
    const llm = makeLlm([
      {
        provider: 'groq',
        content:
          'Here is a draft email:\n\nSubject: Overdue invoices\n\nBody:\nPlease review the overdue invoices.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-draft-notice',
        'Draft an email to myself with the overdue invoices list, but do not send it.',
        undefined,
      ),
    );

    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: expect.stringMatching(/^No email was sent\.\n\nHere is a draft email:/),
    });
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

  it('records DENIED resumption without executing the tool, emits deterministic ack, and skips the LLM (UI Bug 3 + behavior finding "DENY does not stick")', async () => {
    const tools = makeTools(['send_sms']);
    // The LLM stub MUST NOT be consumed — handleResume short-circuits on DENIED.
    // Previously the orchestrator handed control back to the LLM which would
    // either retry the same tool with the same payload (B-19 finding) or emit
    // an empty completion (UI Bug 3 — chat panel showed only the user prompt).
    const llm = makeLlm([
      {
        provider: 'groq',
        content: 'this should not be reached',
        toolCalls: [],
      },
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
    expect(llm.complete).not.toHaveBeenCalled();
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({
      status: 'denied',
      result: { skipped: true, reason: 'user_denied' },
    });
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: expect.stringContaining("won't run"),
    });
    expect(events.at(-1)?.type).toBe('done');
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

  it('drops broad-scan tools from the LLM tool list when pageContext.selectedEntity is set (UI Bug 7 / N-001)', async () => {
    // The customer-detail page's pageContext should narrow the allowed
    // toolset — list_at_risk_customers must NOT reach the LLM, but
    // get_customer (which takes an id) is still allowed.
    const tools = makeTools([
      'get_customer',
      'list_at_risk_customers',
      'list_top_customers',
      'find_car',
    ]);
    const llm = makeLlm([
      {
        provider: 'groq',
        content: 'Customer is fine.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    await collectEvents(
      orchestrator.run(ctx, 'conv-scope', 'tell me about this customer', {
        route: '/customers/abc-123',
        params: { id: 'abc-123' },
      }),
    );

    // Inspect what was passed to llm.complete
    const call = (llm.complete as jest.Mock).mock.calls[0][0];
    const offered = (call.tools ?? []).map((t: { name: string }) => t.name);
    expect(offered).toContain('get_customer');
    expect(offered).toContain('find_car');
    expect(offered).not.toContain('list_at_risk_customers');
    expect(offered).not.toContain('list_top_customers');
  });

  it('caps any tool at MAX_CALLS_PER_TOOL_PER_TURN regardless of result emptiness (I-016 broadened, B-06)', async () => {
    // find_car returns the SAME non-empty match each time but the LLM keeps
    // re-calling. Cap is 3. The 4th call must not execute — instead, the
    // orchestrator forces compose-only and the model emits a final text.
    // Also exercises the swapToComposeOnly toolCalls-ignore guard from
    // 9f37b4f (hallucinated tool_calls dropped on compose-only turns).
    const tools = makeTools(['find_car'], () => ({
      ok: true,
      result: [{ plate: '9109 TUN 804', make: 'Dacia' }], // non-empty
      durationMs: 1,
    }));
    const findCall = (id: string) => ({
      provider: 'groq' as const,
      content: null,
      toolCalls: [
        { id, name: 'find_car', argsJson: '{"query":"9109 TUN 804"}' },
      ],
    });
    const llm = makeLlm([
      findCall('tc-1'),
      findCall('tc-2'),
      findCall('tc-3'),
      // The 4th completion's tool calls would happen on a compose-only turn
      // (cap engaged) — they are ignored by the orchestrator. The compose
      // path then falls through to read this completion's content.
      {
        provider: 'groq',
        content: 'The car is a Dacia 9109 TUN 804.',
        toolCalls: [],
      },
      // Sentinel — should never be reached.
      findCall('tc-99'),
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'find car 9109 TUN 804', undefined),
    );

    expect(tools.execute).toHaveBeenCalledTimes(3);
  });

  it('caps repeated failed tool executions and forces compose-only', async () => {
    const tools = makeTools(['get_invoice'], () => ({
      ok: false,
      error: 'not_found',
      durationMs: 1,
    }));
    const invoiceCall = (id: string) => ({
      provider: 'groq' as const,
      content: null,
      toolCalls: [
        { id, name: 'get_invoice', argsJson: '{"invoiceId":"INV-2026-0207"}' },
      ],
    });
    const llm = makeLlm([
      invoiceCall('tc-1'),
      invoiceCall('tc-2'),
      invoiceCall('tc-3'),
      {
        provider: 'groq',
        content: 'I could not find invoice INV-2026-0207.',
        toolCalls: [],
      },
      invoiceCall('tc-99'),
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-failed-cap',
        'show invoice INV-2026-0207',
        undefined,
      ),
    );

    expect(tools.execute).toHaveBeenCalledTimes(3);
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'I could not find invoice INV-2026-0207.',
    });
  });

  it('caps repeated invalid tool arguments and forces compose-only', async () => {
    const tools = makeTools(['cancel_appointment']);
    tools.validateArgs.mockReturnValue({
      valid: false,
      errors: ['/appointmentId must match format "uuid"'],
    });
    const cancelCall = (id: string) => ({
      provider: 'groq' as const,
      content: null,
      toolCalls: [
        {
          id,
          name: 'cancel_appointment',
          argsJson: '{"appointmentId":"banana"}',
        },
      ],
    });
    const llm = makeLlm([
      cancelCall('tc-1'),
      cancelCall('tc-2'),
      cancelCall('tc-3'),
      {
        provider: 'groq',
        content: 'That appointment id is not valid. Please send the real appointment id.',
        toolCalls: [],
      },
      cancelCall('tc-99'),
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-invalid-cap',
        'Cancel the appointment with id banana.',
        undefined,
      ),
    );

    expect(tools.execute).not.toHaveBeenCalled();
    expect(
      events.filter((e) => e.type === 'tool_result' && e.status === 'failed'),
    ).toHaveLength(3);
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'That appointment id is not valid. Please send the real appointment id.',
    });
  });

  it('caps dispatch_agent at MAX_AGENT_DISPATCHES_PER_TURN (B-23/B-24 unbounded loop)', async () => {
    // Without the cap a misbehaving model can keep emitting dispatch_agent on
    // every iteration, racking up agent runs until the 90s turn budget blows.
    // Cap is 2 per turn — extra calls return an `agent_dispatch_capped` tool
    // message so the LLM can compose a final answer from prior results.
    const agents = {
      list: jest
        .fn()
        .mockReturnValue([
          { name: 'InventoryAgent', description: 'parts and stock' },
        ]),
      run: jest.fn().mockResolvedValue({ result: 'low stock: 1 item' }),
    };
    // Five turns: dispatch, dispatch, dispatch, dispatch, done — only the
    // first two should actually call agents.run().
    const dispatchCall = (id: string) => ({
      provider: 'groq' as const,
      content: null,
      toolCalls: [
        {
          id,
          name: 'dispatch_agent',
          argsJson: '{"name":"InventoryAgent","input":"audit","reason":"x"}',
        },
      ],
    });
    const llm = makeLlm([
      dispatchCall('tc-1'),
      dispatchCall('tc-2'),
      dispatchCall('tc-3'),
      dispatchCall('tc-4'),
      { provider: 'groq', content: 'final answer', toolCalls: [] },
    ]);
    const orchestrator = await makeOrchestrator({ llm, agents });

    await collectEvents(
      orchestrator.run(ctx, 'conv-1', 'audit my inventory', undefined),
    );

    expect(agents.run).toHaveBeenCalledTimes(2);
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

  it('uses the latest agent result when the final LLM response is a generic timeout', async () => {
    const agents = {
      list: jest
        .fn()
        .mockReturnValue([
          { name: 'FinanceAgent', description: 'cash flow analysis' },
        ]),
      run: jest.fn().mockResolvedValue({
        result: 'There are 49 overdue invoices totaling 11,980.12 TND.',
      }),
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
              '{"name":"FinanceAgent","input":"cash-flow risk","reason":"risk summary"}',
          },
        ],
      },
      {
        provider: 'groq',
        content:
          "I couldn't finish the task in time - let's try a smaller question.",
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ llm, agents });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-1',
        'Give me a cash-flow risk summary.',
        undefined,
      ),
    );

    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'There are 49 overdue invoices totaling 11,980.12 TND.',
    });
  });

  it('uses the latest agent result when the main loop reaches the iteration cap', async () => {
    const agents = {
      list: jest
        .fn()
        .mockReturnValue([
          { name: 'FinanceAgent', description: 'cash flow analysis' },
        ]),
      run: jest.fn().mockResolvedValue({
        result:
          'There are 49 overdue invoices totaling 11,980.12 TND. Prioritize the oldest invoices first.',
      }),
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
              '{"name":"FinanceAgent","input":"cash-flow risk","reason":"risk summary"}',
          },
        ],
      },
    ]);
    const orchestrator = await makeOrchestrator({ llm, agents });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-1',
        'Give me a cash-flow risk summary.',
        undefined,
        { iterationCap: 1 },
      ),
    );

    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta:
        'There are 49 overdue invoices totaling 11,980.12 TND. Prioritize the oldest invoices first.',
    });
  });

  it('corrects final answers that deny available slots returned by the tool', async () => {
    const tools = makeTools(['find_available_slot'], () => ({
      ok: true,
      result: {
        slots: [
          {
            start: '2026-06-30T08:00:00.000Z',
            end: '2026-06-30T08:30:00.000Z',
            mechanicName: 'Hichem Sassi',
          },
        ],
      },
      durationMs: 1,
    }));
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-1',
            name: 'find_available_slot',
            argsJson:
              '{"date":"2026-06-30","durationMinutes":30,"appointmentType":"quick-service"}',
          },
        ],
      },
      {
        provider: 'groq',
        content: 'I was unable to find a free slot next Tuesday morning.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-1',
        'Find me a free slot next Tuesday morning for a quick service.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining('I found available slots'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('Hichem Sassi'),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(/unable to find|no available slots/i),
    });
  });

  it('emits a download link when a report tool succeeds but the model returns empty text', async () => {
    const tools = makeTools(['generate_period_report'], () => ({
      ok: true,
      result: {
        url: '/api/assistant/downloads/39ef9d42-4b25-4874-a860-891855858fa3.csv',
        expiresAt: '2026-06-23T16:05:12.300Z',
        period: 'month',
        format: 'csv',
      },
      durationMs: 1,
    }));
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-1',
            name: 'generate_period_report',
            argsJson: '{"period":"month","format":"csv"}',
          },
        ],
      },
      {
        provider: 'groq',
        content: '',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-report',
        'Generate a CSV report for this month.',
        undefined,
      ),
    );

    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: expect.stringContaining(
        '/api/assistant/downloads/39ef9d42-4b25-4874-a860-891855858fa3.csv',
      ),
    });
  });

  it('adds the download link when a report tool succeeds but the model omits the url', async () => {
    const tools = makeTools(['generate_period_report'], () => ({
      ok: true,
      result: {
        url: '/api/assistant/downloads/11111111-2222-4333-8444-555555555555.pdf',
        expiresAt: '2026-06-23T16:05:12.300Z',
        period: 'custom',
        format: 'pdf',
      },
      durationMs: 1,
    }));
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-1',
            name: 'generate_period_report',
            argsJson:
              '{"period":"custom","format":"pdf","from":"2026-06-01","to":"2026-06-24"}',
          },
        ],
      },
      {
        provider: 'groq',
        content: 'The PDF report is available at the provided URL.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-report-url',
        'Generate a PDF report from June 1 to June 23.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining('The PDF report is available'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining(
        '/api/assistant/downloads/11111111-2222-4333-8444-555555555555.pdf',
      ),
    });
  });

  it('replaces no-data report text when the report tool returned a download url', async () => {
    const tools = makeTools(['generate_period_report'], () => ({
      ok: true,
      result: {
        url: '/api/assistant/downloads/22222222-3333-4444-8555-666666666666.csv',
        expiresAt: '2026-06-23T16:05:12.300Z',
        period: 'custom',
        format: 'csv',
      },
      durationMs: 1,
    }));
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-1',
            name: 'generate_period_report',
            argsJson:
              '{"period":"custom","format":"csv","from":"2026-06-01","to":"2026-06-24"}',
          },
        ],
      },
      {
        provider: 'groq',
        content: 'There is no data available for the CSV report.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-report-no-data',
        'Generate a CSV report from June 1 to June 23.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining(
        '/api/assistant/downloads/22222222-3333-4444-8555-666666666666.csv',
      ),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(/no data available/i),
    });
  });

  it('rewrites invalid appointment creation into slots plus a confirmation request', async () => {
    const tools = makeTools(['find_available_slot', 'create_appointment'], (name) => {
      if (name === 'find_available_slot') {
        return {
          ok: true,
          result: {
            slots: [
              {
                start: '2026-06-30T08:00:00.000Z',
                end: '2026-06-30T08:30:00.000Z',
                mechanicName: 'Hichem Sassi',
              },
            ],
          },
          durationMs: 1,
        };
      }
      return { ok: true, result: {}, durationMs: 1 };
    });
    tools.validateArgs.mockImplementation((name: string) =>
      name === 'create_appointment'
        ? {
            valid: false,
            errors: [
              '/customerId must match format "uuid"',
              '/carId must match format "uuid"',
            ],
          }
        : { valid: true },
    );
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-slot',
            name: 'find_available_slot',
            argsJson: '{"date":"2026-06-30","durationMinutes":30}',
          },
        ],
      },
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-create',
            name: 'create_appointment',
            argsJson: '{"customerId":"Khaoula","carId":"Khaoula"}',
          },
        ],
      },
      {
        provider: 'groq',
        content:
          'I am not able to create an appointment. Please ask the orchestrator to handle this request.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-appointment',
        'Book a checkup for Khaoula Khelifi next Tuesday morning.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining('I found available slots'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('Hichem Sassi'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('I did not create an appointment yet'),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(/orchestrator|schema|uuid/i),
    });
  });

  it('adds the no-appointment-created sentence when booking text only lists slots', async () => {
    const tools = makeTools(['find_available_slot', 'create_appointment'], (name) => {
      if (name === 'find_available_slot') {
        return {
          ok: true,
          result: {
            slots: [
              {
                start: '2026-06-30T08:00:00.000Z',
                end: '2026-06-30T08:30:00.000Z',
                mechanicName: 'Hichem Sassi',
              },
            ],
          },
          durationMs: 1,
        };
      }
      return { ok: true, result: {}, durationMs: 1 };
    });
    tools.validateArgs.mockImplementation((name: string) =>
      name === 'create_appointment'
        ? {
            valid: false,
            errors: ['/customerId must match format "uuid"'],
          }
        : { valid: true },
    );
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-slot',
            name: 'find_available_slot',
            argsJson: '{"date":"2026-06-30","durationMinutes":30}',
          },
        ],
      },
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-create',
            name: 'create_appointment',
            argsJson: '{"customerId":"Khaoula","carId":"car-1"}',
          },
        ],
      },
      {
        provider: 'groq',
        content:
          'I was not able to book a checkup. Please provide the vehicle ID.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-appointment-slots-only',
        'Book a checkup for Khaoula Khelifi next Tuesday morning.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining('I found available slots'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('Hichem Sassi'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('I did not create an appointment yet'),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(/vehicle ID|was not able/i),
    });
  });

  it('asks for line item prices instead of inventing invoice totals after invalid create_invoice args', async () => {
    const tools = makeTools(['find_customer', 'create_invoice'], (name) => {
      if (name === 'find_customer') {
        return {
          ok: true,
          result: [{ displayName: 'Khaoula Khelifi', phone: '+216 99 783 989' }],
          durationMs: 1,
        };
      }
      return { ok: true, result: {}, durationMs: 1 };
    });
    tools.validateArgs.mockImplementation((name: string) =>
      name === 'create_invoice'
        ? { valid: false, errors: ['/lineItems/0 must be object'] }
        : { valid: true },
    );
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-customer',
            name: 'find_customer',
            argsJson: '{"query":"Khaoula Khelifi"}',
          },
        ],
      },
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-invoice',
            name: 'create_invoice',
            argsJson:
              '{"customerId":"0a19350b-7648-4d82-866d-a86508775194","lineItems":["oil change","filter"]}',
          },
        ],
      },
      {
        provider: 'groq',
        content:
          '\u26a0\ufe0f I was unable to create an invoice. Please confirm if you would like to proceed with the invoice for 67.83 TND.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ tools, llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-invoice-missing',
        'Create an invoice for Khaoula Khelifi for oil change and filter.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining('I found the customer, but I did not create the invoice'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('quantity and HT unit price'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('for oil change and filter'),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(/67\.83|\u26a0|uuid|schema|for Khaoula Khelifi for/i),
    });
  });

  it('retries create_invoice toward approval when the user already provided line item prices', async () => {
    const customerId = '0a19350b-7648-4d82-866d-a86508775194';
    const carId = 'c3d3cd7a-ee09-44e8-8dc6-6953aae4da7c';
    const tools = makeTools(
      ['find_customer', 'find_car', 'create_invoice'],
      (name) => {
        if (name === 'find_customer') {
          return {
            ok: true,
            result: [{ id: customerId, displayName: 'Khaoula Khelifi' }],
            durationMs: 1,
          };
        }
        if (name === 'find_car') {
          return {
            ok: true,
            result: [
              {
                id: carId,
                customerId,
                label: 'Skoda Octavia · 8580 TUN 289',
              },
            ],
            durationMs: 1,
          };
        }
        return { ok: true, result: {}, durationMs: 1 };
      },
    );
    tools.validateArgs.mockImplementation((name: string, args: any) => {
      if (name === 'create_invoice' && args.customerId === 'Khaoula Khelifi') {
        return {
          valid: false,
          errors: [
            '/customerId must match format "uuid"',
            '/carId must match format "uuid"',
            '/lineItems/0 must be object',
          ],
        };
      }
      return { valid: true };
    });
    tools.resolveBlastTier.mockImplementation((tool: any) =>
      tool.name === 'create_invoice'
        ? AssistantBlastTier.TYPED_CONFIRM_WRITE
        : AssistantBlastTier.READ,
    );
    const approvals = makeApprovals();
    const prisma = {
      ...makePrisma(),
      customer: {
        findFirst: jest.fn().mockResolvedValue({ id: customerId }),
      },
    };
    const llm = makeLlm([
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-bad-invoice',
            name: 'create_invoice',
            argsJson:
              '{"customerId":"Khaoula Khelifi","carId":"8580 TUN 289","dueDate":"2026-07-23","lineItems":["1 oil change labor at 80 TND HT","1 oil filter at 25 TND HT"],"_expectedConfirmation":"105.00 TND"}',
          },
        ],
      },
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-customer',
            name: 'find_customer',
            argsJson: '{"query":"Khaoula Khelifi"}',
          },
        ],
      },
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-car',
            name: 'find_car',
            argsJson: '{"query":"8580 TUN 289"}',
          },
        ],
      },
      {
        provider: 'groq',
        content: null,
        toolCalls: [
          {
            id: 'tc-good-invoice',
            name: 'create_invoice',
            argsJson:
              `{"customerId":"${customerId}","carId":"${carId}","dueDate":"2026-07-23","lineItems":["1 oil change labor at 80 TND HT","1 oil filter at 25 TND HT"],"_expectedConfirmation":"105.00 TND"}`,
          },
        ],
      },
    ]);
    const orchestrator = await makeOrchestrator({
      tools,
      llm,
      approvals,
      prisma,
    });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-invoice-priced',
        'Make an invoice for Khaoula Khelifi and the Skoda Octavia plate 8580 TUN 289 with 1 oil change labor at 80 TND HT and 1 oil filter at 25 TND HT. Do not create it unless I approve the approval request.',
        undefined,
      ),
    );

    expect(tools.execute).toHaveBeenCalledWith(
      'find_customer',
      { query: 'Khaoula Khelifi' },
      expect.objectContaining({ garageId: 'garage-1' }),
    );
    expect(tools.execute).toHaveBeenCalledWith(
      'find_car',
      { query: '8580 TUN 289' },
      expect.objectContaining({ garageId: 'garage-1' }),
    );
    expect(events.find((e) => e.type === 'approval_request')).toMatchObject({
      toolName: 'create_invoice',
      blastTier: AssistantBlastTier.TYPED_CONFIRM_WRITE,
      args: expect.objectContaining({
        customerId,
        carId,
        lineItems: expect.arrayContaining([
          expect.objectContaining({
            description: 'oil change labor',
            quantity: 1,
            unitPrice: 80,
          }),
          expect.objectContaining({
            description: 'oil filter',
            quantity: 1,
            unitPrice: 25,
          }),
        ]),
      }),
    });
    expect(approvals.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'create_invoice' }),
    );
    expect(tools.validateArgs).toHaveBeenCalledWith(
      'create_invoice',
      expect.objectContaining({
        lineItems: expect.arrayContaining([
          expect.objectContaining({
            description: 'oil change labor',
            quantity: 1,
            unitPrice: 80,
          }),
          expect.objectContaining({
            description: 'oil filter',
            quantity: 1,
            unitPrice: 25,
          }),
        ]),
      }),
    );
    const secondLlmCall = (llm.complete as jest.Mock).mock.calls[1][0];
    expect(
      secondLlmCall.messages.some((m: any) =>
        String(m.content).includes(
          'Do not ask for prices that are already in the user message',
        ),
      ),
    ).toBe(true);
  });

  it('strips reasoning scaffolds and internal ids from final assistant text', async () => {
    const llm = makeLlm([
      {
        provider: 'groq',
        content:
          '## Step 1: Analyze the tool output\n' +
          'The final answer is:\n' +
          '## Step 1: Invoice\n' +
          '- Customer: Hela Mahmoud\n' +
          '| INV-202603-0030 | 75ce90a7-3221-49c8-87f8-26352a35 |\n' +
          '- Locked By: 691cb0d2-f52c-4222-8f83-b2cba96b0a0c\n' +
          '- Invoice ID: 11111111-2222-4333-8444-555555555555\n' +
          '- Total: 1,310.00 TND',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-1',
        'Show me invoice INV-2026-0001.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining('## Invoice'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('Customer: Hela Mahmoud'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('Total: 1,310.00 TND'),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(/Step 1|Locked By|Invoice ID|691cb0d2|75ce90a7/i),
    });
  });

  it('strips internal agent names from final assistant text', async () => {
    const llm = makeLlm([
      {
        provider: 'groq',
        content:
          "Hi Mehdi, we've missed you at the garage.\n\n" +
          'Best, CommunicationsAgent',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-agent-name',
        'Write a friendly outreach campaign.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining('Best, the garage team'),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(/CommunicationsAgent/),
    });
  });

  it('keeps only the compiled briefing when the model emits daily-briefing process notes', async () => {
    const llm = makeLlm([
      {
        provider: 'groq',
        content:
          '## Analyze the revenue summary for today and the week.\n' +
          'The revenue summary for today is 0 TND.\n\n' +
          '## Determine the delta between today and the 7-day average.\n' +
          'The delta is 0%.\n\n' +
          '## Compile the daily briefing.\n' +
          '**Revenue**\n' +
          'Today: 0 TND. Week: 0 TND.\n\n' +
          '**Customers**\n' +
          '1 new customer in the last 24h.\n\n' +
          'Recommended next action: Call Mehdi Gharbi.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-1',
        'Give me a quick morning briefing.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining('**Revenue**'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('Recommended next action'),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(
        /Analyze the revenue|Determine the delta|Compile the daily briefing/i,
      ),
    });
  });

  it('keeps only the compiled briefing when the model emits generic briefing process notes', async () => {
    const llm = makeLlm([
      {
        provider: 'groq',
        content:
          '## Analyze the revenue summary for today and the week.\n' +
          'The revenue summary for today is 0 TND.\n\n' +
          "## Determine the delta between today's revenue and the 7-day average.\n" +
          'The delta is 0%.\n\n' +
          '## Compile the briefing.\n' +
          '**Revenue** - Today: 0 TND, Week: 0 TND, Delta: 0%.\n' +
          '**Customers** - 1 new customer in the last 24 hours.\n' +
          'Recommended next action: Call at-risk customers.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-1',
        'Give me a quick morning briefing.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining('**Revenue** - Today: 0 TND'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('Recommended next action'),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(
        /Analyze the revenue|Determine the delta|Compile the briefing/i,
      ),
    });
  });

  it('keeps only the formatted briefing when the model emits required-format process notes', async () => {
    const llm = makeLlm([
      {
        provider: 'groq',
        content:
          '## Analyze the results from the tool calls\n' +
          'The tools returned revenue, customer, jobs, invoice, risk, and inventory data.\n\n' +
          '## Calculate the delta in revenue\n' +
          'The delta is 0%.\n\n' +
          '## Summarize the results in the required format\n' +
          '**Revenue**: Today is 0 TND, week-to-date is 0 TND.\n' +
          '**Customers**: 1 new customer in the last 24 hours.\n' +
          'Recommended next action: Call at-risk customers.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-1',
        'Give me a quick morning briefing.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining('**Revenue**: Today is 0 TND'),
    });
    expect(text).toMatchObject({
      delta: expect.stringContaining('Recommended next action'),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(
        /Analyze the results|Calculate the delta|Summarize the results/i,
      ),
    });
  });

  it('strips internal agent dispatch cap text while preserving the answer', async () => {
    const llm = makeLlm([
      {
        provider: 'groq',
        content:
          '\u26a0\ufe0f "Refusing to dispatch another agent \u2014 already invoked 2 time(s) this turn. Compose your final reply from the agent results above." ' +
          'This quarter, revenue is 7,808.21 TND. Last quarter, revenue was 28,528.62 TND.',
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-1',
        'Compare this quarter with last quarter.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining('This quarter, revenue is 7,808.21 TND'),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(
        /Refusing to dispatch|dispatch another agent|Compose your final reply/i,
      ),
    });
  });

  it('strips agent dispatch capped error text while preserving the answer', async () => {
    const llm = makeLlm([
      {
        provider: 'groq',
        content:
          '\u26a0\ufe0f Error: agent_dispatch_capped.\n' +
          "This quarter's total revenue is 7,808.21 TND.",
        toolCalls: [],
      },
    ]);
    const orchestrator = await makeOrchestrator({ llm });

    const events = await collectEvents(
      orchestrator.run(
        ctx,
        'conv-1',
        'Compare this quarter with last quarter.',
        undefined,
      ),
    );

    const text = events.find((e) => e.type === 'text');
    expect(text).toMatchObject({
      delta: expect.stringContaining(
        "This quarter's total revenue is 7,808.21 TND.",
      ),
    });
    expect(text).not.toMatchObject({
      delta: expect.stringMatching(/agent_dispatch_capped|Error:/i),
    });
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

    it('also pairs get_customer with send_sms so the LLM can resolve a recipient by UUID (page context)', async () => {
      // Repro of the "customer ID did not return a match" bug: when the user
      // is on a customer detail page and asks "send SMS to this client", the
      // page context puts a UUID in the system prompt. Without get_customer
      // augmented, the LLM falls back to find_customer({query: <uuid>}) which
      // searches name/phone/email columns and returns 0 hits.
      const tools = makeTools(['send_sms', 'find_customer', 'get_customer']);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier([]);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(
          ctx,
          'conv-1',
          'send an SMS to this client with their unpaid invoices',
          undefined,
        ),
      );

      const names = toolNamesFromFirstCall(llm);
      expect(names).toEqual(
        expect.arrayContaining(['send_sms', 'find_customer', 'get_customer']),
      );
    });

    it('also pairs get_customer with send_email so the LLM can resolve a recipient by UUID', async () => {
      const tools = makeTools(['send_email', 'find_customer', 'get_customer']);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier([]);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(
          ctx,
          'conv-1',
          'email this customer their invoice summary',
          undefined,
        ),
      );

      const names = toolNamesFromFirstCall(llm);
      expect(names).toEqual(
        expect.arrayContaining(['send_email', 'find_customer', 'get_customer']),
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

    it('adds create_invoice and customer lookup for invoice creation requests', async () => {
      const tools = makeTools([
        'list_invoices',
        'create_invoice',
        'find_customer',
        'get_customer',
        'find_car',
        'send_email',
      ]);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier(['list_invoices']);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(
          ctx,
          'conv-1',
          'Make an invoice for Khaoula Khelifi for an oil change and filter.',
          undefined,
        ),
      );

      const names = toolNamesFromFirstCall(llm);
      expect(names).toEqual(
        expect.arrayContaining([
          'list_invoices',
          'create_invoice',
          'find_customer',
          'get_customer',
          'find_car',
        ]),
      );
      const firstCall = (llm.complete as jest.Mock).mock.calls[0][0];
      expect(firstCall.messages[0].content).toContain(
        'If the user only gives service names like "oil change and filter" without prices, ask for the missing prices',
      );
    });

    it('adds generate_period_report and skips create_invoice for invoice report exports', async () => {
      const tools = makeTools([
        'list_invoices',
        'create_invoice',
        'generate_period_report',
      ]);
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const classifier = makeClassifier(['list_invoices']);
      const orchestrator = await makeOrchestrator({ tools, llm, classifier });

      await collectEvents(
        orchestrator.run(
          ctx,
          'conv-1',
          'Generate a PDF report for invoices from June 1 2026 to June 23 2026.',
          undefined,
        ),
      );

      const names = toolNamesFromFirstCall(llm);
      expect(names).toEqual(
        expect.arrayContaining(['list_invoices', 'generate_period_report']),
      );
      expect(names).not.toContain('create_invoice');
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
      expect(prompt).toMatch(/Do NOT include internal database IDs/);
      expect(prompt).toMatch(
        /Use names, phone numbers, invoice numbers, license plates/,
      );
      expect(prompt).toMatch(/Do NOT narrate hidden reasoning/);
    });

    it('forbids refusing because a specialist agent conversation is needed', async () => {
      const llm = makeLlm([{ provider: 'groq', content: 'ok', toolCalls: [] }]);
      const agents = {
        list: jest.fn().mockReturnValue([
          {
            name: 'scheduling-agent',
            description: 'Calendar and appointment specialist.',
          },
        ]),
        run: jest.fn(),
      };
      const orchestrator = await makeOrchestrator({ llm, agents });

      await collectEvents(
        orchestrator.run(
          ctx,
          'conv-1',
          'Find a 2-hour slot this Friday',
          undefined,
        ),
      );

      const prompt = getSystemPrompt(llm);
      expect(prompt).toMatch(
        /Never refuse by saying .*requires a conversation/i,
      );
      expect(prompt).toMatch(/call dispatch_agent/i);
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
      expect(calls[1][0].messages[0].content).toMatch(
        /Do NOT include internal database IDs/,
      );
    });
  });
});
