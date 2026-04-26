import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { randomUUID } from 'crypto';
import {
  AssistantBlastTier,
  AssistantMessageRole,
  AssistantToolCallStatus,
  AssistantUserContext,
  LlmMessage,
  LlmToolCall,
  Locale,
  PageContext,
  SseEvent,
  ToolDescriptor,
} from './types';
import { ConversationService } from './conversation.service';
import { LlmGatewayService } from './llm-gateway.service';
import { ToolRegistryService } from './tool-registry.service';
import { SkillRegistryService } from './skill-registry.service';
import { AgentRunnerService } from './agent-runner.service';
import { ApprovalService } from './approval.service';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_ITERATION_CAP = 8;
const TOTAL_TURN_TIMEOUT_MS = 90_000;
const MAX_TOOL_RESULT_BYTES = 8 * 1024;
const HISTORY_LIMIT = 20;

const RESUME_PREFIX = '__resume__:';

const RESERVED_LOAD_SKILL = 'load_skill';
const RESERVED_DISPATCH_AGENT = 'dispatch_agent';

interface RunOptions {
  iterationCap?: number;
  totalTimeoutMs?: number;
}

/**
 * Per-turn LLM loop. Consumes tools/skills/agents via the Wave 1 services and
 * streams typed SSE events back to the controller.
 *
 * Streaming model: v1 emits the full assistant content as a single `text`
 * delta when the LLM finishes — we do not yet stream individual tokens. Token
 * streaming is a v2 polish; the SSE contract already supports it.
 *
 * Skill/agent encoding: skills and agents are surfaced to the LLM as two
 * reserved pseudo-tools (`load_skill`, `dispatch_agent`) in addition to the
 * real tool registry. Their descriptions enumerate the available
 * skills/agents and guide the model. The orchestrator intercepts these names
 * before they reach `tools.execute`. This keeps the registry pure
 * (registry == real tools only) and means adding a skill/agent never touches
 * the orchestrator.
 *
 * Approval resumption: when the user POSTs the chat endpoint with a sentinel
 * message of the form `__resume__:<toolCallId>`, the orchestrator looks up
 * the prior approval row, executes (if APPROVED) or skips (if DENIED) the
 * tool, appends a tool-result message, and continues the loop as if the LLM
 * had just received the result. This keeps the controller contract narrow
 * (one chat endpoint, one decide endpoint) while guaranteeing every
 * conversation turn flows through the same loop.
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly conversation: ConversationService,
    private readonly llm: LlmGatewayService,
    private readonly tools: ToolRegistryService,
    private readonly skills: SkillRegistryService,
    private readonly agents: AgentRunnerService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  run(
    ctx: AssistantUserContext,
    conversationId: string,
    userMessage: string,
    pageContext: PageContext | undefined,
    options: RunOptions = {},
  ): Observable<SseEvent> {
    const subject = new Subject<SseEvent>();
    const iterationCap = options.iterationCap ?? DEFAULT_ITERATION_CAP;
    const totalTimeoutMs = options.totalTimeoutMs ?? TOTAL_TURN_TIMEOUT_MS;

    void this.executeTurn(
      ctx,
      conversationId,
      userMessage,
      pageContext,
      subject,
      iterationCap,
      totalTimeoutMs,
    );

    return subject.asObservable();
  }

  private async executeTurn(
    ctx: AssistantUserContext,
    conversationId: string,
    userMessage: string,
    pageContext: PageContext | undefined,
    subject: Subject<SseEvent>,
    iterationCap: number,
    totalTimeoutMs: number,
  ): Promise<void> {
    const turnDeadline = Date.now() + totalTimeoutMs;
    const isResume = userMessage.startsWith(RESUME_PREFIX);

    try {
      // --- Persist user input (or skip on resume; the original user message
      // was already persisted on the prior turn). ----------------------------
      if (!isResume) {
        await this.conversation.appendMessage({
          conversationId,
          role: AssistantMessageRole.USER,
          content: userMessage,
        });
      }

      // --- Build tool descriptors visible to this user. --------------------
      const realTools = this.tools.listForUser(ctx);
      const skillDescriptors = this.skills.list();
      const agentDescriptors = this.agents.list();
      const llmTools: ToolDescriptor[] = this.buildLlmToolList(
        realTools,
        skillDescriptors,
        agentDescriptors,
      );

      // --- Build initial system + history messages. ------------------------
      const systemPrompt = this.buildSystemPrompt(
        ctx.locale,
        skillDescriptors,
        agentDescriptors,
        pageContext,
      );

      const history = await this.conversation.getRecentHistory(
        conversationId,
        HISTORY_LIMIT,
      );
      const llmMessages: LlmMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history.map((h) => this.toLlmMessage(h)),
      ];

      // --- If this is a resume turn, materialise the pending tool call as a
      //     synthetic assistant + tool message pair so the LLM has context. -
      if (isResume) {
        const toolCallId = userMessage.slice(RESUME_PREFIX.length).trim();
        const handled = await this.handleResume(
          ctx,
          conversationId,
          toolCallId,
          llmMessages,
          subject,
        );
        if (!handled) {
          subject.next({
            type: 'error',
            message: 'approval not found or no longer pending',
          });
          subject.next({ type: 'done' });
          subject.complete();
          return;
        }
      }

      // --- Iteration loop. -------------------------------------------------
      for (let step = 0; step < iterationCap; step++) {
        if (Date.now() > turnDeadline) {
          await this.persistAssistant(
            conversationId,
            "Sorry — I ran out of time on that turn.",
          );
          subject.next({ type: 'error', message: 'turn_timeout' });
          subject.next({ type: 'done' });
          subject.complete();
          return;
        }

        const completion = await this.llm.complete({
          messages: llmMessages,
          tools: llmTools,
        });

        const toolCalls = completion.toolCalls ?? [];

        if (toolCalls.length === 0) {
          const text = completion.content ?? '';
          const persisted = await this.persistAssistant(
            conversationId,
            text,
            completion.provider,
          );
          if (text.length > 0) {
            subject.next({ type: 'text', delta: text });
          }
          subject.next({ type: 'done', messageId: persisted?.id });
          subject.complete();
          // Fire-and-forget: title summary on first turn, never block the
          // observable on it. Failures are logged inside the service.
          void this.maybeGenerateTitle(conversationId);
          return;
        }

        // v1: handle one tool call per LLM step. The model may emit several;
        // we take the first and let it re-emit if it wants more.
        const call = toolCalls[0];

        // Persist the assistant message that emitted the tool call so the
        // history reflects what really happened on the wire.
        await this.persistAssistant(
          conversationId,
          completion.content ?? '',
          completion.provider,
        );

        // Mirror it into the in-memory LLM message buffer too — otherwise
        // the next LLM call won't see the tool_use block we just emitted.
        llmMessages.push({
          role: 'assistant',
          content: completion.content ?? '',
          toolCalls: [call],
        });

        // Reserved pseudo-tools.
        if (call.name === RESERVED_LOAD_SKILL) {
          const handled = await this.handleLoadSkill(
            call,
            ctx.locale,
            llmMessages,
            subject,
          );
          if (!handled) {
            // Treat as failure result and let the LLM recover.
            this.appendToolMessage(llmMessages, call.id, {
              error: 'unknown_skill',
            });
          }
          continue;
        }
        if (call.name === RESERVED_DISPATCH_AGENT) {
          await this.handleDispatchAgent(call, ctx, llmMessages, subject);
          continue;
        }

        // Real tool path.
        const tool = this.tools.get(call.name);
        if (!tool) {
          subject.next({
            type: 'tool_result',
            toolCallId: call.id,
            result: { error: 'unknown_tool', name: call.name },
            status: 'failed',
          });
          this.appendToolMessage(llmMessages, call.id, {
            error: 'unknown_tool',
            name: call.name,
          });
          continue;
        }

        const parsedArgs = this.safeParseArgs(call.argsJson);
        if (parsedArgs.error) {
          subject.next({
            type: 'tool_result',
            toolCallId: call.id,
            result: { error: 'invalid_arguments', detail: parsedArgs.error },
            status: 'failed',
          });
          this.appendToolMessage(llmMessages, call.id, {
            error: 'invalid_arguments',
            detail: parsedArgs.error,
          });
          continue;
        }

        const validation = this.tools.validateArgs(call.name, parsedArgs.value);
        if (!validation.valid) {
          subject.next({
            type: 'tool_result',
            toolCallId: call.id,
            result: { error: 'invalid_arguments', detail: validation.errors },
            status: 'failed',
          });
          this.appendToolMessage(llmMessages, call.id, {
            error: 'invalid_arguments',
            detail: validation.errors,
          });
          continue;
        }

        const tier = this.tools.resolveBlastTier(tool, parsedArgs.value, ctx);

        if (
          tier === AssistantBlastTier.CONFIRM_WRITE ||
          tier === AssistantBlastTier.TYPED_CONFIRM_WRITE
        ) {
          const approvalId = randomUUID();
          const { expiresAt } = await this.approvals.createPending({
            conversationId,
            toolCallId: approvalId,
            toolName: call.name,
            blastTier: tier,
            args: parsedArgs.value,
          });
          subject.next({
            type: 'approval_request',
            toolCallId: approvalId,
            toolName: call.name,
            args: parsedArgs.value,
            blastTier: tier,
            expiresAt: expiresAt.toISOString(),
          });
          subject.next({ type: 'done' });
          subject.complete();
          return;
        }

        // READ or AUTO_WRITE — execute now.
        subject.next({
          type: 'tool_call',
          toolCallId: call.id,
          name: call.name,
          args: parsedArgs.value,
        });

        const exec = await this.tools.execute(call.name, parsedArgs.value, ctx);
        if (exec.ok) {
          const successExec = exec as { ok: true; result: unknown; durationMs: number };
          subject.next({
            type: 'tool_result',
            toolCallId: call.id,
            result: successExec.result,
            status: 'executed',
          });
          await this.audit.logToolCall({
            conversationId,
            toolName: call.name,
            argsJson: parsedArgs.value,
            resultJson: successExec.result,
            status: AssistantToolCallStatus.EXECUTED,
            blastTier: tier,
            durationMs: successExec.durationMs,
          });
          this.appendToolMessage(llmMessages, call.id, successExec.result);
        } else {
          const failExec = exec as { ok: false; error: string; durationMs: number };
          subject.next({
            type: 'tool_result',
            toolCallId: call.id,
            result: { error: failExec.error },
            status: 'failed',
          });
          await this.audit.logToolCall({
            conversationId,
            toolName: call.name,
            argsJson: parsedArgs.value,
            status: AssistantToolCallStatus.FAILED,
            blastTier: tier,
            errorMessage: failExec.error,
            durationMs: failExec.durationMs,
          });
          this.appendToolMessage(llmMessages, call.id, { error: failExec.error });
        }
      }

      // Iteration cap exceeded.
      const apology =
        "I couldn't finish the task in time — let's try a smaller question.";
      await this.persistAssistant(conversationId, apology);
      subject.next({ type: 'text', delta: apology });
      subject.next({ type: 'done' });
      subject.complete();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Orchestrator turn failed: ${message}`, err instanceof Error ? err.stack : undefined);
      subject.next({ type: 'error', message });
      subject.next({ type: 'done' });
      subject.complete();
    }
  }

  // ── Resume flow ───────────────────────────────────────────────────────

  private async handleResume(
    ctx: AssistantUserContext,
    conversationId: string,
    toolCallId: string,
    llmMessages: LlmMessage[],
    subject: Subject<SseEvent>,
  ): Promise<boolean> {
    const row = await this.prisma.assistantToolCall.findUnique({
      where: { id: toolCallId },
      include: { conversation: { select: { garageId: true, userId: true } } },
    });
    if (!row) return false;
    // Multi-tenancy guard — never act on another tenant's approval.
    if (
      row.conversation.garageId !== ctx.garageId ||
      row.conversationId !== conversationId
    ) {
      return false;
    }

    const tool = this.tools.get(row.toolName);
    if (!tool) {
      this.appendToolMessage(llmMessages, toolCallId, {
        error: 'unknown_tool',
        name: row.toolName,
      });
      return true;
    }

    const args = this.coerceArgs(row.argsJson);

    if (row.status === AssistantToolCallStatus.APPROVED) {
      subject.next({
        type: 'tool_call',
        toolCallId,
        name: row.toolName,
        args,
      });
      const exec = await this.tools.execute(row.toolName, args, ctx);
      if (exec.ok) {
        const successExec = exec as { ok: true; result: unknown; durationMs: number };
        subject.next({
          type: 'tool_result',
          toolCallId,
          result: successExec.result,
          status: 'executed',
        });
        await this.prisma.assistantToolCall.update({
          where: { id: toolCallId },
          data: {
            status: AssistantToolCallStatus.EXECUTED,
            resultJson: this.safeJsonValue(successExec.result),
            durationMs: successExec.durationMs,
          },
        });
        this.appendAssistantToolUse(llmMessages, toolCallId, row.toolName, args);
        this.appendToolMessage(llmMessages, toolCallId, successExec.result);
      } else {
        const failExec = exec as { ok: false; error: string; durationMs: number };
        subject.next({
          type: 'tool_result',
          toolCallId,
          result: { error: failExec.error },
          status: 'failed',
        });
        await this.prisma.assistantToolCall.update({
          where: { id: toolCallId },
          data: {
            status: AssistantToolCallStatus.FAILED,
            errorMessage: failExec.error,
            durationMs: failExec.durationMs,
          },
        });
        this.appendAssistantToolUse(llmMessages, toolCallId, row.toolName, args);
        this.appendToolMessage(llmMessages, toolCallId, { error: failExec.error });
      }
      return true;
    }

    if (row.status === AssistantToolCallStatus.DENIED) {
      this.appendAssistantToolUse(llmMessages, toolCallId, row.toolName, args);
      this.appendToolMessage(llmMessages, toolCallId, {
        error: 'user_denied',
      });
      return true;
    }

    // EXPIRED, FAILED, EXECUTED, PENDING_APPROVAL — anything else is a no-op
    // from the user's perspective; surface a generic skip to the LLM.
    this.appendAssistantToolUse(llmMessages, toolCallId, row.toolName, args);
    this.appendToolMessage(llmMessages, toolCallId, {
      error: `tool_call_${row.status.toLowerCase()}`,
    });
    return true;
  }

  // ── Skill/agent pseudo-tool handlers ──────────────────────────────────

  private async handleLoadSkill(
    call: LlmToolCall,
    locale: Locale,
    llmMessages: LlmMessage[],
    subject: Subject<SseEvent>,
  ): Promise<boolean> {
    const parsed = this.safeParseArgs(call.argsJson);
    if (parsed.error) {
      this.appendToolMessage(llmMessages, call.id, {
        error: 'invalid_arguments',
        detail: parsed.error,
      });
      return true;
    }
    const args = parsed.value as { name?: unknown };
    const skillName = typeof args?.name === 'string' ? args.name : '';
    const body = skillName ? this.skills.load(skillName, locale) : null;
    if (!body) {
      return false;
    }

    // Inject the skill body as a system message so the next LLM step sees it.
    llmMessages.push({
      role: 'system',
      content: `[Skill: ${skillName}]\n${body}`,
    });
    subject.next({ type: 'skill_loaded', skillName });
    this.appendToolMessage(llmMessages, call.id, { loaded: skillName });
    return true;
  }

  private async handleDispatchAgent(
    call: LlmToolCall,
    ctx: AssistantUserContext,
    llmMessages: LlmMessage[],
    subject: Subject<SseEvent>,
  ): Promise<void> {
    const parsed = this.safeParseArgs(call.argsJson);
    if (parsed.error) {
      this.appendToolMessage(llmMessages, call.id, {
        error: 'invalid_arguments',
        detail: parsed.error,
      });
      return;
    }
    const args = parsed.value as { name?: unknown; input?: unknown; reason?: unknown };
    const agentName = typeof args?.name === 'string' ? args.name : '';
    const input = typeof args?.input === 'string' ? args.input : JSON.stringify(args?.input ?? '');
    const reason = typeof args?.reason === 'string' ? args.reason : undefined;

    if (!agentName) {
      this.appendToolMessage(llmMessages, call.id, {
        error: 'invalid_arguments',
        detail: 'name is required',
      });
      return;
    }

    subject.next({ type: 'agent_dispatch', agentName, reason });
    try {
      const { result } = await this.agents.run(agentName, input, ctx);
      subject.next({ type: 'agent_result', agentName, result });
      this.appendToolMessage(llmMessages, call.id, { result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.appendToolMessage(llmMessages, call.id, {
        error: 'agent_failed',
        detail: message,
      });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private buildLlmToolList(
    realTools: ToolDescriptor[],
    skillDescriptors: { name: string; description: string }[],
    agentDescriptors: { name: string; description: string }[],
  ): ToolDescriptor[] {
    const out: ToolDescriptor[] = [...realTools];
    if (skillDescriptors.length > 0) {
      const enumValues = skillDescriptors.map((s) => s.name);
      const summary = skillDescriptors
        .map((s) => `- ${s.name}: ${s.description}`)
        .join('\n');
      out.push({
        name: RESERVED_LOAD_SKILL,
        description: `Load a reusable skill playbook into the system prompt for the rest of this turn. Available skills:\n${summary}`,
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              enum: enumValues,
              description: 'The skill name to load.',
            },
          },
          required: ['name'],
          additionalProperties: false,
        },
      });
    }
    if (agentDescriptors.length > 0) {
      const enumValues = agentDescriptors.map((a) => a.name);
      const summary = agentDescriptors
        .map((a) => `- ${a.name}: ${a.description}`)
        .join('\n');
      out.push({
        name: RESERVED_DISPATCH_AGENT,
        description: `Dispatch a specialist sub-agent. Use for deep multi-step research that would clutter the main conversation. Available agents:\n${summary}`,
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              enum: enumValues,
              description: 'The agent name to dispatch.',
            },
            input: {
              type: 'string',
              description: 'A self-contained instruction for the sub-agent.',
            },
            reason: {
              type: 'string',
              description: 'Optional short reason this agent was chosen.',
            },
          },
          required: ['name', 'input'],
          additionalProperties: false,
        },
      });
    }
    return out;
  }

  private buildSystemPrompt(
    locale: Locale,
    skillDescriptors: { name: string; description: string }[],
    agentDescriptors: { name: string; description: string }[],
    pageContext: PageContext | undefined,
  ): string {
    const localeName: Record<Locale, string> = {
      en: 'English',
      fr: 'French',
      ar: 'Arabic',
    };
    const parts: string[] = [];
    parts.push(
      `You are the OpAuto AI assistant for an automotive garage business. ` +
        `Respond to the user in ${localeName[locale]}. Be concise and direct. ` +
        `You have access to tools for reading data, performing actions, ` +
        `loading reusable skill playbooks, and dispatching specialist agents. ` +
        `Use a tool whenever the user is asking for live data; never invent ` +
        `numbers. Never ask the user for ids you can look up via tools.`,
    );
    if (skillDescriptors.length > 0) {
      parts.push(
        `Skills you can load via the load_skill tool:\n` +
          skillDescriptors
            .map((s) => `- ${s.name}: ${s.description}`)
            .join('\n'),
      );
    }
    if (agentDescriptors.length > 0) {
      parts.push(
        `Specialist agents you can dispatch via the dispatch_agent tool:\n` +
          agentDescriptors
            .map((a) => `- ${a.name}: ${a.description}`)
            .join('\n'),
      );
    }
    if (pageContext) {
      const pieces: string[] = [];
      if (pageContext.route) pieces.push(`route=${pageContext.route}`);
      if (pageContext.selectedEntity) {
        const e = pageContext.selectedEntity;
        pieces.push(
          `selected=${e.type}:${e.id}${e.displayName ? ` (${e.displayName})` : ''}`,
        );
      }
      if (pieces.length > 0) {
        parts.push(`Page context: ${pieces.join(', ')}`);
      }
    }
    return parts.join('\n\n');
  }

  private toLlmMessage(h: {
    role: AssistantMessageRole;
    content: string;
    toolCallId: string | null;
  }): LlmMessage {
    if (h.role === AssistantMessageRole.TOOL) {
      return {
        role: 'tool',
        content: h.content,
        toolCallId: h.toolCallId ?? undefined,
      };
    }
    if (h.role === AssistantMessageRole.ASSISTANT) {
      return { role: 'assistant', content: h.content };
    }
    if (h.role === AssistantMessageRole.SYSTEM) {
      return { role: 'system', content: h.content };
    }
    return { role: 'user', content: h.content };
  }

  private safeParseArgs(json: string): { value: unknown; error?: undefined } | { value: undefined; error: string } {
    if (!json || json.length === 0) return { value: {} };
    try {
      return { value: JSON.parse(json) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { value: undefined, error: message };
    }
  }

  private appendToolMessage(
    llmMessages: LlmMessage[],
    toolCallId: string,
    payload: unknown,
  ): void {
    const serialised = this.truncateForLlm(this.safeStringify(payload));
    llmMessages.push({
      role: 'tool',
      content: serialised,
      toolCallId,
    });
  }

  private appendAssistantToolUse(
    llmMessages: LlmMessage[],
    toolCallId: string,
    toolName: string,
    args: unknown,
  ): void {
    llmMessages.push({
      role: 'assistant',
      content: '',
      toolCalls: [
        { id: toolCallId, name: toolName, argsJson: this.safeStringify(args) },
      ],
    });
  }

  private safeStringify(value: unknown): string {
    try {
      return JSON.stringify(value ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: 'unserialisable_result', detail: message });
    }
  }

  private truncateForLlm(text: string): string {
    if (text.length <= MAX_TOOL_RESULT_BYTES) return text;
    const head = text.slice(0, MAX_TOOL_RESULT_BYTES);
    return `${head}\n…[truncated ${text.length - MAX_TOOL_RESULT_BYTES} bytes]`;
  }

  private coerceArgs(raw: unknown): unknown {
    if (raw === null || raw === undefined) return {};
    return raw;
  }

  private safeJsonValue(value: unknown): object | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value as object;
    return { value } as object;
  }

  private async persistAssistant(
    conversationId: string,
    content: string,
    provider?: string,
  ): Promise<{ id: string } | null> {
    if (!content || content.length === 0) {
      // Empty assistant turns (tool-only) still need a row so history is
      // accurate, but skip if literally nothing was said.
      return null;
    }
    const row = await this.conversation.appendMessage({
      conversationId,
      role: AssistantMessageRole.ASSISTANT,
      content,
      llmProvider: provider,
    });
    return { id: row.id };
  }

  private async maybeGenerateTitle(conversationId: string): Promise<void> {
    try {
      await this.conversation.generateTitleFromFirstMessage(
        conversationId,
        async (text) => {
          const result = await this.llm.complete({
            messages: [
              {
                role: 'system',
                content:
                  'Summarise the user message in 4-6 words for a chat title. No quotes, no punctuation at the end.',
              },
              { role: 'user', content: text },
            ],
            maxTokens: 32,
          });
          return (result.content ?? '').trim();
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Title generation failed: ${message}`);
    }
  }
}
