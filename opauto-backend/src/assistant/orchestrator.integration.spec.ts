import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, toArray } from 'rxjs';
import {
  AssistantBlastTier,
  AssistantMessageRole,
  AssistantToolCallStatus,
} from '@prisma/client';
import { OrchestratorService } from './orchestrator.service';
import { IntentClassifierService } from './intent-classifier.service';
import { ConversationService } from './conversation.service';
import { LlmGatewayService } from './llm-gateway.service';
import { ToolRegistryService } from './tool-registry.service';
import { SkillRegistryService } from './skill-registry.service';
import { AgentRunnerService } from './agent-runner.service';
import { ApprovalService } from './approval.service';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssistantUserContext,
  LlmCompletionResult,
  SseEvent,
  ToolDefinition,
} from './types';

/**
 * Integration tests for OrchestratorService that wire the real Wave 1 services
 * (ToolRegistryService, SkillRegistryService, ConversationService,
 * ApprovalService, AuditService) end-to-end, with only PrismaService and the
 * outbound side-effects (LlmGatewayService, AgentRunnerService) mocked.
 *
 * Complement to orchestrator.service.spec.ts which mocks every collaborator —
 * here we exercise the real glue between the registry, gateway, approvals and
 * audit, so we catch bugs that pure unit mocks would mask.
 */

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

interface PrismaMock {
  assistantMessage: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    deleteMany: jest.Mock;
    aggregate: jest.Mock;
  };
  assistantConversation: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
  };
  assistantToolCall: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
}

/**
 * Deterministic in-memory Prisma mock.
 *
 * Only the methods the orchestrator + ConversationService + ApprovalService +
 * AuditService actually touch are implemented. Each store is keyed by id so
 * tests can pre-seed rows (e.g. a PENDING_APPROVAL row to resume).
 */
function createPrismaMock(): {
  prisma: PrismaMock;
  messages: any[];
  toolCalls: Map<string, any>;
} {
  const messages: any[] = [];
  const toolCalls = new Map<string, any>();

  const prisma: PrismaMock = {
    assistantMessage: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: data.id ?? `msg-${messages.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        messages.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ where, orderBy, take }: any) => {
        const filtered = messages.filter(
          (m) => m.conversationId === where.conversationId,
        );
        const dir = orderBy?.createdAt === 'desc' ? -1 : 1;
        filtered.sort(
          (a, b) =>
            (a.createdAt.getTime() - b.createdAt.getTime()) * dir,
        );
        return filtered.slice(0, take ?? filtered.length);
      }),
      findFirst: jest.fn(async () => null),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      aggregate: jest.fn(async () => ({
        _sum: { tokensIn: null, tokensOut: null },
      })),
    },
    assistantConversation: {
      findUnique: jest.fn(async ({ where }: any) => ({
        id: where.id,
        title: null,
      })),
      findFirst: jest.fn(async () => null),
      update: jest.fn(async () => ({})),
      create: jest.fn(async () => ({ id: 'conv-new' })),
      findMany: jest.fn(async () => []),
    },
    assistantToolCall: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: data.id,
          createdAt: new Date(),
          approvedByUserId: null,
          approvedAt: null,
          resultJson: null,
          errorMessage: null,
          durationMs: null,
          messageId: null,
          ...data,
        };
        toolCalls.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        return toolCalls.get(where.id) ?? null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = toolCalls.get(where.id);
        if (!cur) throw new Error('not found');
        const next = { ...cur, ...data };
        toolCalls.set(where.id, next);
        return next;
      }),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
  };

  return { prisma, messages, toolCalls };
}

/**
 * Scripted LLM gateway: pulls completions off a queue per `complete()` call.
 * Captures every request payload so tests can assert what messages/tools the
 * orchestrator handed off.
 */
function createScriptedLlm(script: LlmCompletionResult[]): {
  gateway: LlmGatewayService;
  calls: Array<{ messages: any[]; tools?: any[] }>;
} {
  const calls: Array<{ messages: any[]; tools?: any[] }> = [];
  let i = 0;
  const gateway = {
    complete: jest.fn(async (req: any) => {
      // Deep-copy so later mutations of the orchestrator's internal message
      // buffer don't bleed into our recorded snapshot of this call.
      calls.push({
        messages: JSON.parse(JSON.stringify(req.messages)),
        tools: req.tools ? JSON.parse(JSON.stringify(req.tools)) : undefined,
      });
      const idx = Math.min(i, script.length - 1);
      i++;
      return script[idx];
    }),
  } as unknown as LlmGatewayService;
  return { gateway, calls };
}

function createMockAgentRunner(): AgentRunnerService {
  return {
    list: jest.fn().mockReturnValue([]),
    run: jest.fn().mockResolvedValue({ result: '' }),
    register: jest.fn(),
    getDefinition: jest.fn(),
  } as unknown as AgentRunnerService;
}

interface BuildOpts {
  llm: LlmGatewayService;
  agents?: AgentRunnerService;
  prismaOverride?: PrismaMock;
  skillsDir?: string;
  registerTools?: (registry: ToolRegistryService) => void;
}

interface Built {
  orchestrator: OrchestratorService;
  toolRegistry: ToolRegistryService;
  skillRegistry: SkillRegistryService;
  conversation: ConversationService;
  approval: ApprovalService;
  audit: AuditService;
  prisma: PrismaMock;
  messages: any[];
  toolCalls: Map<string, any>;
}

async function buildModule(opts: BuildOpts): Promise<Built> {
  const { prisma, messages, toolCalls } = (() => {
    if (opts.prismaOverride) {
      // Caller pre-seeded the mock; reuse internal stores by reflecting on
      // mock implementations isn't worth the complexity, so keep new arrays
      // and rely on callers to pre-populate via the override directly.
      return {
        prisma: opts.prismaOverride,
        messages: [] as any[],
        toolCalls: new Map<string, any>(),
      };
    }
    return createPrismaMock();
  })();

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      OrchestratorService,
      ToolRegistryService,
      SkillRegistryService,
      ConversationService,
      ApprovalService,
      AuditService,
      { provide: LlmGatewayService, useValue: opts.llm },
      { provide: AgentRunnerService, useValue: opts.agents ?? createMockAgentRunner() },
      // Integration tests pre-determine which tools are visible via
      // registerTools(); bypass the classifier (return null → fall through to
      // full registry) so the existing assertions keep working.
      { provide: IntentClassifierService, useValue: { classify: async () => null } },
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();

  const skillRegistry = moduleRef.get(SkillRegistryService);
  if (opts.skillsDir) {
    skillRegistry.setSkillsDir(opts.skillsDir);
  }
  // Run lifecycle so SkillRegistryService loads from disk.
  await moduleRef.init();

  const toolRegistry = moduleRef.get(ToolRegistryService);
  if (opts.registerTools) {
    opts.registerTools(toolRegistry);
  }

  return {
    orchestrator: moduleRef.get(OrchestratorService),
    toolRegistry,
    skillRegistry,
    conversation: moduleRef.get(ConversationService),
    approval: moduleRef.get(ApprovalService),
    audit: moduleRef.get(AuditService),
    prisma,
    messages,
    toolCalls,
  };
}

// ── Tool fixtures used across scenarios ─────────────────────────────────

const READ_KPIS_TOOL: ToolDefinition = {
  name: 'get_test_kpis',
  description: 'Return test KPIs.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  blastTier: AssistantBlastTier.READ,
  handler: async () => ({ revenue: 12345 }),
};

const CONFIRM_SMS_TOOL: ToolDefinition = {
  name: 'send_test_sms',
  description: 'Send a test SMS.',
  parameters: {
    type: 'object',
    properties: { to: { type: 'string' }, body: { type: 'string' } },
    required: ['to', 'body'],
    additionalProperties: false,
  },
  blastTier: AssistantBlastTier.CONFIRM_WRITE,
  handler: async () => ({ sid: 'SM_TEST' }),
};

describe('OrchestratorService (integration)', () => {
  beforeEach(() => {
    // gray-matter logs when frontmatter is malformed — keep the test output
    // clean.
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Scenario 1: READ tool happy path ─────────────────────────────────
  it('executes a READ tool, streams events, persists messages, and audits', async () => {
    const handlerSpy = jest.fn(async () => ({ revenue: 12345 }));
    const { gateway } = createScriptedLlm([
      {
        provider: 'mock',
        content: null,
        toolCalls: [{ id: 'tc-1', name: 'get_test_kpis', argsJson: '{}' }],
      },
      {
        provider: 'mock',
        content: "Today's revenue is 12345 TND.",
        toolCalls: [],
      },
    ]);

    const built = await buildModule({
      llm: gateway,
      registerTools: (registry) => {
        registry.register({ ...READ_KPIS_TOOL, handler: handlerSpy });
      },
    });

    const events = await collectEvents(
      built.orchestrator.run(ctx, 'conv-1', 'show me kpis', undefined),
    );

    const types = events.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(['tool_call', 'tool_result', 'text', 'done']),
    );
    expect(events.find((e) => e.type === 'tool_call')).toMatchObject({
      name: 'get_test_kpis',
      toolCallId: 'tc-1',
    });
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({
      status: 'executed',
      result: { revenue: 12345 },
    });
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: "Today's revenue is 12345 TND.",
    });

    expect(handlerSpy).toHaveBeenCalledTimes(1);

    // User + assistant turns persisted via real ConversationService.
    const persistedRoles = built.prisma.assistantMessage.create.mock.calls
      .map((c: any[]) => c[0].data.role);
    expect(persistedRoles).toEqual(
      expect.arrayContaining([
        AssistantMessageRole.USER,
        AssistantMessageRole.ASSISTANT,
      ]),
    );
    const userPersist = built.prisma.assistantMessage.create.mock.calls.find(
      (c: any[]) => c[0].data.role === AssistantMessageRole.USER,
    );
    expect(userPersist[0].data.content).toBe('show me kpis');

    // Real AuditService logs an EXECUTED row with READ blast tier.
    const auditCalls = built.prisma.assistantToolCall.create.mock.calls.map(
      (c: any[]) => c[0].data,
    );
    const auditRow = auditCalls.find(
      (d: any) => d.toolName === 'get_test_kpis',
    );
    expect(auditRow).toBeDefined();
    expect(auditRow.status).toBe(AssistantToolCallStatus.EXECUTED);
    expect(auditRow.blastTier).toBe(AssistantBlastTier.READ);
  });

  // ── Scenario 2: CONFIRM_WRITE defers the turn ────────────────────────
  it('emits approval_request, persists PENDING_APPROVAL, and skips the handler for CONFIRM_WRITE', async () => {
    const handlerSpy = jest.fn(async () => ({ sid: 'SHOULD_NOT_RUN' }));
    const before = Date.now();
    const { gateway } = createScriptedLlm([
      {
        provider: 'mock',
        content: null,
        toolCalls: [
          {
            id: 'tc-confirm',
            name: 'send_test_sms',
            argsJson: '{"to":"+216 12 345 678","body":"hi"}',
          },
        ],
      },
    ]);

    const built = await buildModule({
      llm: gateway,
      registerTools: (registry) => {
        registry.register({ ...CONFIRM_SMS_TOOL, handler: handlerSpy });
      },
    });

    const events = await collectEvents(
      built.orchestrator.run(ctx, 'conv-1', 'send the sms', undefined),
    );

    expect(handlerSpy).not.toHaveBeenCalled();

    const approval = events.find((e) => e.type === 'approval_request');
    expect(approval).toBeDefined();
    expect(approval).toMatchObject({
      toolName: 'send_test_sms',
      blastTier: AssistantBlastTier.CONFIRM_WRITE,
      args: { to: '+216 12 345 678', body: 'hi' },
    });
    const expiresAt = new Date((approval as any).expiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(before + 4 * 60 * 1000);
    expect(expiresAt).toBeLessThan(before + 6 * 60 * 1000);

    expect(events[events.length - 1].type).toBe('done');

    // Real ApprovalService persisted the row in PENDING_APPROVAL.
    const pendingCreate = built.prisma.assistantToolCall.create.mock.calls.find(
      (c: any[]) => c[0].data.status === AssistantToolCallStatus.PENDING_APPROVAL,
    );
    expect(pendingCreate).toBeDefined();
    expect(pendingCreate[0].data.toolName).toBe('send_test_sms');
    expect(pendingCreate[0].data.blastTier).toBe(
      AssistantBlastTier.CONFIRM_WRITE,
    );
  });

  // ── Scenario 3: __resume__ sentinel flow ─────────────────────────────
  it('resumes an APPROVED tool call via the __resume__ sentinel and audits EXECUTED', async () => {
    // Pre-seed the prisma mock with an APPROVED row.
    const { prisma, messages, toolCalls } = createPrismaMock();
    toolCalls.set('tc-approved', {
      id: 'tc-approved',
      conversationId: 'conv-1',
      toolName: 'send_test_sms',
      argsJson: { to: '+216 11 222 333', body: 'approved msg' },
      status: AssistantToolCallStatus.APPROVED,
      blastTier: AssistantBlastTier.CONFIRM_WRITE,
      conversation: { garageId: 'garage-1', userId: 'user-1' },
    });

    const handlerSpy = jest.fn(async () => ({ sid: 'SM_OK' }));
    const { gateway, calls: llmCalls } = createScriptedLlm([
      { provider: 'mock', content: 'Done.', toolCalls: [] },
    ]);

    const built = await buildModule({
      llm: gateway,
      prismaOverride: prisma,
      registerTools: (registry) => {
        registry.register({ ...CONFIRM_SMS_TOOL, handler: handlerSpy });
      },
    });
    // Replace internal stores with the pre-seeded ones.
    (built as any).messages = messages;
    (built as any).toolCalls = toolCalls;

    const events = await collectEvents(
      built.orchestrator.run(
        ctx,
        'conv-1',
        '__resume__:tc-approved',
        undefined,
      ),
    );

    expect(handlerSpy).toHaveBeenCalledTimes(1);
    expect(handlerSpy).toHaveBeenCalledWith(
      { to: '+216 11 222 333', body: 'approved msg' },
      expect.objectContaining({ garageId: 'garage-1' }),
    );

    expect(events.find((e) => e.type === 'tool_call')).toMatchObject({
      toolCallId: 'tc-approved',
      name: 'send_test_sms',
    });
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({
      status: 'executed',
      toolCallId: 'tc-approved',
    });
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'Done.',
    });

    // Status flip to EXECUTED in the existing tool-call row.
    expect(prisma.assistantToolCall.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tc-approved' },
        data: expect.objectContaining({
          status: AssistantToolCallStatus.EXECUTED,
        }),
      }),
    );
    const updated = toolCalls.get('tc-approved');
    expect(updated.status).toBe(AssistantToolCallStatus.EXECUTED);

    // The resume sentinel itself MUST NOT be re-persisted as a USER message.
    const userMessages = prisma.assistantMessage.create.mock.calls.filter(
      (c: any[]) => c[0].data.role === AssistantMessageRole.USER,
    );
    expect(userMessages).toHaveLength(0);

    // The next LLM call must have seen the tool_use + tool_result history.
    const lastReq = llmCalls[llmCalls.length - 1];
    const toolMsg = lastReq.messages.find((m: any) => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    expect(toolMsg.toolCallId).toBe('tc-approved');
    expect(toolMsg.content).toContain('SM_OK');
  });

  // ── Scenario 4: Skill loading via the load_skill pseudo-tool ─────────
  it('loads a skill via load_skill, emits skill_loaded, and prepends the body for the next LLM call', async () => {
    // Use a fixture skills directory so we don't depend on Subagent R's work.
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'orchestrator-int-skills-'),
    );
    const skillDir = path.join(tmpRoot, 'integration-test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'en.md'),
      `---\nname: integration-test-skill\ndescription: Skill for the integration test.\n---\n\nIMPORTANT: Always answer in haiku form.\n`,
      'utf8',
    );

    try {
      const { gateway, calls: llmCalls } = createScriptedLlm([
        {
          provider: 'mock',
          content: null,
          toolCalls: [
            {
              id: 'tc-skill',
              name: 'load_skill',
              argsJson: '{"name":"integration-test-skill"}',
            },
          ],
        },
        {
          provider: 'mock',
          content: 'Skill loaded; here is the answer.',
          toolCalls: [],
        },
      ]);

      const built = await buildModule({
        llm: gateway,
        skillsDir: tmpRoot,
      });

      const events = await collectEvents(
        built.orchestrator.run(ctx, 'conv-1', 'use the skill', undefined),
      );

      expect(events.find((e) => e.type === 'skill_loaded')).toMatchObject({
        skillName: 'integration-test-skill',
      });
      expect(events.find((e) => e.type === 'text')).toMatchObject({
        delta: 'Skill loaded; here is the answer.',
      });

      // The first LLM call should NOT contain the skill body — only the
      // initial system prompt. The second call MUST include a system message
      // carrying the skill body.
      expect(llmCalls).toHaveLength(2);
      const firstSystemContents = llmCalls[0].messages
        .filter((m: any) => m.role === 'system')
        .map((m: any) => m.content)
        .join('\n');
      expect(firstSystemContents).not.toContain('Always answer in haiku form');

      const secondSystemContents = llmCalls[1].messages
        .filter((m: any) => m.role === 'system')
        .map((m: any) => m.content)
        .join('\n');
      expect(secondSystemContents).toContain('Always answer in haiku form');
      expect(secondSystemContents).toContain(
        '[Skill: integration-test-skill]',
      );

      // Second call's tool list is built from the registry — load_skill is
      // included because the registry knows the skill.
      const secondToolNames: string[] = (llmCalls[1].tools ?? []).map(
        (t: any) => t.name,
      );
      expect(secondToolNames).toContain('load_skill');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  // ── Scenario 5: Agent dispatch via the dispatch_agent pseudo-tool ────
  it('dispatches an agent, forwards its result, and feeds it back into the next LLM call', async () => {
    const agents = {
      list: jest.fn().mockReturnValue([
        { name: 'test-agent', description: 'A specialist for testing.' },
      ]),
      run: jest.fn().mockResolvedValue({ result: 'Agent finished.' }),
      register: jest.fn(),
      getDefinition: jest.fn(),
    } as unknown as AgentRunnerService;

    const { gateway, calls: llmCalls } = createScriptedLlm([
      {
        provider: 'mock',
        content: null,
        toolCalls: [
          {
            id: 'tc-dispatch',
            name: 'dispatch_agent',
            argsJson:
              '{"name":"test-agent","input":"Analyze stuff","reason":"deep dive"}',
          },
        ],
      },
      {
        provider: 'mock',
        content: 'Per the agent: Agent finished.',
        toolCalls: [],
      },
    ]);

    const built = await buildModule({ llm: gateway, agents });

    const events = await collectEvents(
      built.orchestrator.run(ctx, 'conv-1', 'analyze it', undefined),
    );

    expect(events.find((e) => e.type === 'agent_dispatch')).toMatchObject({
      agentName: 'test-agent',
      reason: 'deep dive',
    });
    expect(events.find((e) => e.type === 'agent_result')).toMatchObject({
      agentName: 'test-agent',
      result: 'Agent finished.',
    });
    expect(events.find((e) => e.type === 'text')).toMatchObject({
      delta: 'Per the agent: Agent finished.',
    });

    expect(agents.run).toHaveBeenCalledWith(
      'test-agent',
      'Analyze stuff',
      expect.objectContaining({ garageId: 'garage-1', userId: 'user-1' }),
    );

    // Next LLM call must include a tool message with the agent's result so the
    // model can incorporate it.
    const secondReq = llmCalls[1];
    const toolMsg = secondReq.messages.find(
      (m: any) => m.role === 'tool' && m.toolCallId === 'tc-dispatch',
    );
    expect(toolMsg).toBeDefined();
    expect(toolMsg.content).toContain('Agent finished.');

    // The first call must advertise dispatch_agent.
    const firstToolNames: string[] = (llmCalls[0].tools ?? []).map(
      (t: any) => t.name,
    );
    expect(firstToolNames).toContain('dispatch_agent');
  });

  // ── Scenario 6: Iteration cap enforcement ────────────────────────────
  it('stops after iterationCap hits and emits the apology text + done', async () => {
    const handlerSpy = jest.fn(async () => ({ revenue: 1 }));
    const { gateway } = createScriptedLlm([
      // Always return another tool call — the orchestrator should cut us off.
      {
        provider: 'mock',
        content: null,
        toolCalls: [{ id: 'tc-loop', name: 'get_test_kpis', argsJson: '{}' }],
      },
    ]);

    const built = await buildModule({
      llm: gateway,
      registerTools: (registry) => {
        registry.register({ ...READ_KPIS_TOOL, handler: handlerSpy });
      },
    });

    const events = await collectEvents(
      built.orchestrator.run(
        ctx,
        'conv-1',
        'loop forever',
        undefined,
        { iterationCap: 2 },
      ),
    );

    expect((gateway.complete as jest.Mock).mock.calls).toHaveLength(2);

    const text = events.find((e) => e.type === 'text');
    expect(text).toBeDefined();
    expect((text as any).delta).toMatch(/couldn't finish/i);

    expect(events[events.length - 1].type).toBe('done');
  });

  // ── Scenario 7: Multi-tenancy — handler receives ctx.garageId ────────
  it('forwards ctx (garageId, userId) to the tool handler — never via LLM args', async () => {
    let capturedCtx: AssistantUserContext | null = null;
    let capturedArgs: unknown = null;

    const captureTool: ToolDefinition = {
      name: 'capture_ctx',
      description: 'Capture the ctx passed by the orchestrator.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      blastTier: AssistantBlastTier.READ,
      handler: async (args, callerCtx) => {
        capturedArgs = args;
        capturedCtx = callerCtx;
        return { ok: true };
      },
    };

    const { gateway } = createScriptedLlm([
      {
        provider: 'mock',
        content: null,
        toolCalls: [{ id: 'tc-ctx', name: 'capture_ctx', argsJson: '{}' }],
      },
      { provide: 'mock' as any, content: 'done', toolCalls: [] } as any,
    ]);

    const built = await buildModule({
      llm: gateway,
      registerTools: (registry) => {
        registry.register(captureTool);
      },
    });

    const tenantCtx: AssistantUserContext = {
      ...ctx,
      garageId: 'garage-tenant-X',
      userId: 'user-tenant-X',
    };

    await collectEvents(
      built.orchestrator.run(tenantCtx, 'conv-tenant', 'go', undefined),
    );

    expect(capturedCtx).not.toBeNull();
    expect(capturedCtx!.garageId).toBe('garage-tenant-X');
    expect(capturedCtx!.userId).toBe('user-tenant-X');
    // The model can never inject garageId via args because it's not in the
    // schema we registered — confirm the handler saw an empty object.
    expect(capturedArgs).toEqual({});
  });
});
