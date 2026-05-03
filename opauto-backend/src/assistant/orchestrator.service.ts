import { Injectable, Logger } from '@nestjs/common';
import { Observable, ReplaySubject } from 'rxjs';
import { randomUUID } from 'crypto';
import {
  AssistantBlastTier,
  AssistantMessageRole,
  AssistantToolCallStatus,
  AssistantUserContext,
  LlmCompletionResult,
  LlmMessage,
  LlmToolCall,
  LlmValidationOutcome,
  Locale,
  PageContext,
  SseEvent,
  ToolDescriptor,
} from './types';
import {
  detectToolCallLeak,
  salvageToolCall,
  scrubLeakFromContent,
} from './leak-detector';
import { ConversationService } from './conversation.service';
import { LlmGatewayService } from './llm-gateway.service';
import { ToolRegistryService } from './tool-registry.service';
import { SkillRegistryService } from './skill-registry.service';
import { AgentRunnerService } from './agent-runner.service';
import { ApprovalService } from './approval.service';
import { AuditService } from './audit.service';
import { IntentClassifierService } from './intent-classifier.service';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_ITERATION_CAP = 8;
const TOTAL_TURN_TIMEOUT_MS = 90_000;
const MAX_TOOL_RESULT_BYTES = 8 * 1024;
const HISTORY_LIMIT = 20;
const CONVERSATION_TOKEN_BUDGET = 200_000;
const BUDGET_EXCEEDED_MESSAGE =
  'This conversation has reached its token budget. Start a new conversation to continue.';

const RESUME_PREFIX = '__resume__:';

const RESERVED_LOAD_SKILL = 'load_skill';
const RESERVED_DISPATCH_AGENT = 'dispatch_agent';

// Extracted to ./page-context-resolver for direct unit testing.
import { deriveSelectedEntityFromRoute } from './page-context-resolver';

/**
 * Best-effort detection of "the tool returned no rows". Used by I-016 to
 * decide whether a find_* call should count toward the retry cap. Conservative
 * — if we can't tell for sure, we say "not empty" and let the LLM continue.
 */
function isEmptyResult(result: unknown): boolean {
  if (result === null || result === undefined) return true;
  if (Array.isArray(result)) return result.length === 0;
  if (typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if ('error' in r && (r.error === 'not_found' || r.error === 'no_match')) {
      return true;
    }
    if (typeof r.count === 'number' && r.count === 0) return true;
    if (typeof r.total === 'number' && r.total === 0) return true;
    if (Array.isArray(r.results) && r.results.length === 0) return true;
    if (Array.isArray(r.matches) && r.matches.length === 0) return true;
  }
  return false;
}

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
    private readonly classifier: IntentClassifierService,
    private readonly prisma: PrismaService,
  ) {}

  run(
    ctx: AssistantUserContext,
    conversationId: string,
    userMessage: string,
    pageContext: PageContext | undefined,
    options: RunOptions = {},
  ): Observable<SseEvent> {
    // ReplaySubject replays any events emitted before the controller's
    // @Sse() subscriber attaches — important for the up-front
    // `{type:'conversation'}` event which would otherwise race past the
    // subscription and get dropped (Subject only delivers to current
    // subscribers). Buffer is bounded; one subscriber per turn so no
    // memory concern.
    const subject = new ReplaySubject<SseEvent>(64);
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
    subject: ReplaySubject<SseEvent>,
    iterationCap: number,
    totalTimeoutMs: number,
  ): Promise<void> {
    const turnDeadline = Date.now() + totalTimeoutMs;
    const isResume = userMessage.startsWith(RESUME_PREFIX);

    try {
      // Emit the conversation id up-front so the client can sync its
      // currentConversationId and stitch follow-up turns (especially the
      // __resume__ flow after an approval) into the same conversation.
      subject.next({ type: 'conversation', conversationId });

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
      const allRealTools = this.tools.listForUser(ctx);
      const skillDescriptors = this.skills.list();
      const agentDescriptors = this.agents.list();

      // --- Pre-filter tools via cheap intent classifier so we don't ship
      // ~25 JSON schemas on every selection call. Saves ~3000 input tokens
      // per LLM round-trip — keeps us inside Groq's free 8000 TPM. The
      // classifier may return [] (chitchat — no real tools needed) or null
      // (failure — fall back to full registry). On resume turns, skip
      // classification entirely: the user input is a `__resume__:<id>`
      // sentinel, not a real query, and the orchestrator just needs the
      // composition LLM call which doesn't pick tools.
      const realTools = isResume
        ? allRealTools
        : await this.filterToolsByIntent(userMessage, ctx.locale, allRealTools);

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
        ctx,
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
        if (handled === 'not_found') {
          subject.next({
            type: 'error',
            message: 'approval not found or no longer pending',
          });
          subject.next({ type: 'done' });
          subject.complete();
          return;
        }
        if (handled === 'finished') {
          // handleResume already emitted text + done + completed the subject
          // (e.g. user denied — we acknowledge and stop, instead of asking the
          // LLM what to do, which previously led it to retry the same tool).
          return;
        }
      }

      // --- Iteration loop. -------------------------------------------------
      // After a tool has executed at least once we drop the schemas from
      // the LLM payload — the model only needs to compose prose around the
      // tool result on subsequent calls, not pick another tool. This keeps
      // the second LLM round-trip lean (no 2-3k tokens of schemas re-sent)
      // so the whole turn fits inside Groq's free-tier 6000 TPM ceiling.
      let toolHasFired = false;
      // Track the LAST executed tool's blast tier so we can decide whether
      // the next iteration should still offer tools. After a READ tool we
      // must keep tools available (the model may chain into a write tool —
      // e.g. list_invoices → send_email). After a write tool the action is
      // complete and we can swap to the cheaper compose-only mode.
      let lastToolTier: AssistantBlastTier | null = null;
      // Per-turn cap on dispatch_agent (B-23/B-24): without this cap a misbehaving
      // model would re-dispatch the same specialist agent on each iteration,
      // blowing the 90s turn budget and racking up OVH spend before
      // converging. Each agent run is itself iteration-capped, so 2 dispatches
      // is plenty headroom for retry-with-feedback while still bounded.
      const MAX_AGENT_DISPATCHES_PER_TURN = 2;
      let agentDispatchesThisTurn = 0;
      // Per-turn empty-result cap on find_* tools (I-016, B-06): the LLM
      // would retry find_car / find_customer up to 8 times against the
      // same data with slightly different query strings, never converging.
      // After 2 empty returns from the same find_* tool, force the model
      // into compose-only "no results" mode for the rest of the turn.
      const FIND_EMPTY_RETRY_CAP = 2;
      const findEmptyCounts = new Map<string, number>();
      let forceComposeOnly = false;
      for (let step = 0; step < iterationCap; step++) {
        // Cost cap: stop the conversation cold once the per-conversation
        // token budget is exhausted. Checked before every LLM call so a
        // mid-turn over-spend can't keep ratcheting up the bill.
        const totalTokens =
          await this.conversation.getTotalTokens(conversationId);
        if (totalTokens >= CONVERSATION_TOKEN_BUDGET) {
          subject.next({
            type: 'budget_exceeded',
            message: BUDGET_EXCEEDED_MESSAGE,
          });
          await this.conversation.appendMessage({
            conversationId,
            role: AssistantMessageRole.SYSTEM,
            content: BUDGET_EXCEEDED_MESSAGE,
          });
          subject.next({ type: 'done' });
          subject.complete();
          return;
        }

        if (Date.now() > turnDeadline) {
          await this.persistAssistant(
            conversationId,
            'Sorry — I ran out of time on that turn.',
          );
          subject.next({ type: 'error', message: 'turn_timeout' });
          subject.next({ type: 'done' });
          subject.complete();
          return;
        }

        // After a tool fires we have two paths:
        //   - READ tool: the model may need to chain into a write tool
        //     (list_invoices → send_email is the canonical example). Keep
        //     the full system prompt + tool list available so the chain
        //     can complete. Skipping this is what made "send me invoices"
        //     fail before — iteration 2 had no send_email to call.
        //   - Write tool (AUTO_WRITE / CONFIRM_WRITE / TYPED_CONFIRM_WRITE):
        //     the action is done. Swap to the minimal compose-only prompt
        //     and stop offering tools. This is what keeps follow-up turns
        //     inside Groq's 6000 TPM (and is cheap on every other provider).
        const swapToComposeOnly =
          (toolHasFired && lastToolTier !== AssistantBlastTier.READ) ||
          forceComposeOnly;
        const messagesForCall = swapToComposeOnly
          ? this.swapSystemPromptForComposeOnly(llmMessages, ctx.locale)
          : llmMessages;
        const offeredTools = swapToComposeOnly ? undefined : llmTools;
        const completion = await this.llm.complete({
          messages: messagesForCall,
          tools: offeredTools,
          validateResult: this.buildLeakValidator(offeredTools),
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
          if (agentDispatchesThisTurn >= MAX_AGENT_DISPATCHES_PER_TURN) {
            // Refuse further dispatches in this turn but keep the conversation
            // alive — surface a tool message so the LLM can compose a final
            // synthesis from whatever the prior agents produced rather than
            // hard-erroring on the user.
            this.appendToolMessage(llmMessages, call.id, {
              error: 'agent_dispatch_capped',
              message:
                `Refusing to dispatch another agent — already invoked ` +
                `${agentDispatchesThisTurn} time(s) this turn. Compose your ` +
                `final reply from the agent results above.`,
            });
            continue;
          }
          agentDispatchesThisTurn++;
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

        // Pre-approval guard: catch obviously-malformed write calls (empty
        // payloads, missing required content) BEFORE asking the user to
        // approve. Letting the LLM fix its own mistake is far better UX than
        // surfacing an empty-body approval card the user has to deny.
        const preCheck = this.preApprovalCheck(call.name, parsedArgs.value);
        if (preCheck) {
          subject.next({
            type: 'tool_result',
            toolCallId: call.id,
            result: preCheck,
            status: 'failed',
          });
          this.appendToolMessage(llmMessages, call.id, preCheck);
          continue;
        }

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
          const successExec = exec as {
            ok: true;
            result: unknown;
            durationMs: number;
          };
          toolHasFired = true;
          lastToolTier = tier;
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

          // I-016 — break the find_* retry loop when the same tool keeps
          // returning empty results. Without this cap the LLM would retry
          // find_car / find_customer with marginally different queries until
          // it ate the iteration budget (B-06: 8× retries → turn_timeout).
          if (
            call.name.startsWith('find_') &&
            isEmptyResult(successExec.result)
          ) {
            const prev = findEmptyCounts.get(call.name) ?? 0;
            const next = prev + 1;
            findEmptyCounts.set(call.name, next);
            if (next >= FIND_EMPTY_RETRY_CAP) {
              forceComposeOnly = true;
              llmMessages.push({
                role: 'system',
                content:
                  `${call.name} returned 0 results ${next} times this turn. ` +
                  `STOP retrying — there is no match. Compose a brief reply ` +
                  `telling the user you couldn't find what they're looking ` +
                  `for, optionally suggesting they double-check the spelling ` +
                  `or try a different search term. Do NOT call ${call.name} again.`,
              });
            }
          }
        } else {
          const failExec = exec as {
            ok: false;
            error: string;
            durationMs: number;
          };
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
          this.appendToolMessage(llmMessages, call.id, {
            error: failExec.error,
          });
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
      this.logger.error(
        `Orchestrator turn failed: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
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
    subject: ReplaySubject<SseEvent>,
  ): Promise<'continue' | 'finished' | 'not_found'> {
    const row = await this.prisma.assistantToolCall.findUnique({
      where: { id: toolCallId },
      include: { conversation: { select: { garageId: true, userId: true } } },
    });
    if (!row) return 'not_found';
    // Multi-tenancy guard — never act on another tenant's approval.
    if (
      row.conversation.garageId !== ctx.garageId ||
      row.conversationId !== conversationId
    ) {
      return 'not_found';
    }

    const tool = this.tools.get(row.toolName);
    if (!tool) {
      this.appendToolMessage(llmMessages, toolCallId, {
        error: 'unknown_tool',
        name: row.toolName,
      });
      return 'continue';
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
        const successExec = exec as {
          ok: true;
          result: unknown;
          durationMs: number;
        };
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
        this.appendAssistantToolUse(
          llmMessages,
          toolCallId,
          row.toolName,
          args,
        );
        this.appendToolMessage(llmMessages, toolCallId, successExec.result);
      } else {
        const failExec = exec as {
          ok: false;
          error: string;
          durationMs: number;
        };
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
        this.appendAssistantToolUse(
          llmMessages,
          toolCallId,
          row.toolName,
          args,
        );
        this.appendToolMessage(llmMessages, toolCallId, {
          error: failExec.error,
        });
      }
      return 'continue';
    }

    if (row.status === AssistantToolCallStatus.DENIED) {
      // Surface the denial to the LLM context so any follow-up text it composes
      // knows the action was skipped (e.g. so it doesn't immediately retry the
      // same tool with the same args).
      this.appendAssistantToolUse(llmMessages, toolCallId, row.toolName, args);
      this.appendToolMessage(llmMessages, toolCallId, {
        error: 'user_denied',
      });
      // Emit a deterministic acknowledgement so the chat panel never goes
      // silent after a Deny click. UI Bug 3: previously the resume turn would
      // either drop the LLM response or get an empty completion, and the user
      // saw nothing at all next to their original prompt — felt broken.
      // Instructing the LLM via a system prompt rule was unreliable; explicit
      // text + a deterministic event end is what users expect.
      subject.next({
        type: 'tool_result',
        toolCallId,
        result: { skipped: true, reason: 'user_denied' },
        status: 'denied',
      });
      const ack = `Okay — I won't run \`${row.toolName}\`. Let me know if you'd like to try something else.`;
      subject.next({ type: 'text', delta: ack });
      const persisted = await this.persistAssistant(conversationId, ack);
      subject.next({ type: 'done', messageId: persisted.id });
      subject.complete();
      return 'finished';
    }

    // EXPIRED, FAILED, EXECUTED, PENDING_APPROVAL — anything else is a no-op
    // from the user's perspective; surface a generic skip to the LLM.
    this.appendAssistantToolUse(llmMessages, toolCallId, row.toolName, args);
    this.appendToolMessage(llmMessages, toolCallId, {
      error: `tool_call_${row.status.toLowerCase()}`,
    });
    return 'continue';
  }

  // ── Skill/agent pseudo-tool handlers ──────────────────────────────────

  private async handleLoadSkill(
    call: LlmToolCall,
    locale: Locale,
    llmMessages: LlmMessage[],
    subject: ReplaySubject<SseEvent>,
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
    subject: ReplaySubject<SseEvent>,
  ): Promise<void> {
    const parsed = this.safeParseArgs(call.argsJson);
    if (parsed.error) {
      this.appendToolMessage(llmMessages, call.id, {
        error: 'invalid_arguments',
        detail: parsed.error,
      });
      return;
    }
    const args = parsed.value as {
      name?: unknown;
      input?: unknown;
      reason?: unknown;
    };
    const agentName = typeof args?.name === 'string' ? args.name : '';
    const input =
      typeof args?.input === 'string'
        ? args.input
        : JSON.stringify(args?.input ?? '');
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

  private async filterToolsByIntent(
    userMessage: string,
    locale: AssistantUserContext['locale'],
    allRealTools: ToolDescriptor[],
  ): Promise<ToolDescriptor[]> {
    if (allRealTools.length === 0) return allRealTools;

    const candidates = allRealTools.map((t) => ({
      name: t.name,
      description: t.description,
    }));

    const picked = await this.classifier.classify({
      userMessage,
      locale,
      candidates,
    });

    // Classifier failed → keep behavior: send everything (slower but safe).
    if (picked === null) return allRealTools;

    // Always union the deterministic action-verb augmenter with the
    // classifier's picks. The small llama-3.1-8b model is unreliable for
    // compound action+read intents — it may pick `list_invoices` for
    // "email me my invoices" but drop `send_email`. The augmenter scans for
    // imperative send/email/sms verbs in en/fr/ar and forces the matching
    // action tool back in. False positives cost a few hundred tokens of
    // unused schema; false negatives strand the LLM without the tool it
    // needs and produce an "I can't send emails" reply.
    const augmented = new Set<string>(picked);
    for (const name of this.actionAugmentation(userMessage)) {
      augmented.add(name);
    }

    // Classifier returned [] (chitchat) — run the deterministic keyword
    // safety net in addition to the action augmenter. The small llama model
    // is not always reliable here (it occasionally returns [] for obvious
    // data questions like "do I have any low stock parts?"). We deliberately
    // pick a NARROW tool slice (not the full 25-tool registry) — Groq's free
    // tier rejects requests over 6000 TPM and the full registry alone is
    // ~8000 tokens.
    if (picked.length === 0) {
      for (const name of this.keywordFallback(userMessage)) {
        augmented.add(name);
      }
    }

    if (augmented.size === 0) return [];
    return allRealTools.filter((t) => augmented.has(t.name));
  }

  /**
   * Deterministic post-classifier augmenter. Detects imperative send/email/sms
   * verbs in en/fr/ar and returns the action tool names that must appear in
   * the LLM's tool list regardless of what the classifier picked. Keep the
   * patterns NARROW: only fire on phrases that clearly request transmission
   * (`email me`, `send me an email`, `par email`, `إيميل`), not bare nouns
   * (`my email address` should NOT add `send_email`).
   */
  private actionAugmentation(message: string): string[] {
    const out: string[] = [];
    // Stopwords after `email`/`sms`/`text` that mean "talking ABOUT email" not
    // "send an email" — guards against false positives like "email address",
    // "sms history", "text settings".
    const emailNounStopwords =
      'address|account|history|settings|list|lists|server|servers|template|templates|domain|domains|provider|signature';
    const smsNounStopwords =
      'history|notifications?|settings|server|servers|template|templates|messages?|history|provider';

    const emailPatterns: RegExp[] = [
      // "email me" / "email Sarah" / "email customer" — but NOT "email address"
      new RegExp(`\\bemail\\s+(?!(?:${emailNounStopwords})\\b)\\w+`, 'i'),
      /\bsend\s+(?:\w+\s+)*(an?\s+)?e-?mails?\b/i, // "send me an email", "send Ali an email"
      /\bmail\s+(me|it|this|him|her)\b/i,
      /\bforward\s+(me|it|this)\b/i,
      /\b(via|by|as\s+an?|to\s+my)\s+(personal\s+)?e-?mail\b/i,
      /\benvoie[zr]?[\s-]+(moi|nous)?\s*(un\s+|le\s+)?(e-?mail|courriel)\b/i,
      /\bpar\s+(e-?mail|courriel)\b/i,
      /إيميل|بريد\s*(إلكتروني|الكتروني)/,
    ];
    if (emailPatterns.some((p) => p.test(message))) {
      out.push('send_email');
    }
    const smsPatterns: RegExp[] = [
      // "sms Ali" / "text Sarah" / "sms reminder" — but NOT "sms history"
      new RegExp(`\\b(sms|text)\\s+(?!(?:${smsNounStopwords})\\b)\\w+`, 'i'),
      /\bsend\s+(?:\w+\s+)*(sms|text|texts?)\b/i, // "send a polite SMS", "send Ali a text"
      /\bdraft\s+(?:\w+\s+)*(sms|text)\b/i,
      /\b(via|by|as\s+an?|by\s+a)\s+(sms|text)\b/i,
      /\benvoie[zr]?[\s-]+(moi|nous)?\s*(un\s+)?(sms|texto)\b/i,
      /\bpar\s+(sms|texto)\b/i,
      /أرسل\s+رسالة|ابعث\s+رسالة/,
    ];
    if (smsPatterns.some((p) => p.test(message))) {
      out.push('send_sms');
    }
    // Whenever a customer-facing action tool (send_sms / send_email to a third
    // party) is added, also pull in BOTH customer lookup tools:
    //   - `find_customer` for name/phone/email search
    //   - `get_customer` for UUID lookup (page context provides selectedEntity
    //     ids; chained reads like list_overdue_invoices return customerId)
    // Without `get_customer`, the LLM forced to call `find_customer({query: <uuid>})`
    // gets zero hits because findAll only LIKE-matches name/phone/email columns,
    // and reports back "customer not found" instead of resolving the recipient.
    // Cost is two extra schemas (~400 tokens); the LLM picks the right one based
    // on whether it has a UUID or a partial name.
    if (out.length > 0) {
      out.push('find_customer');
      out.push('get_customer');
    }
    return out;
  }

  /**
   * Map common keyword patterns to a small tool slice (≤3 tools). Used as a
   * safety net when the small classifier model returns []. Kept tight so the
   * resulting LLM call stays well under Groq's 6000 TPM ceiling.
   */
  private keywordFallback(message: string): string[] {
    const m = message.toLowerCase();
    const groups: { kws: string[]; tools: string[] }[] = [
      // inventory
      {
        kws: ['stock', 'inventory', 'pièce', 'pieces', 'parts', 'مخزون'],
        tools: ['list_low_stock_parts', 'get_inventory_value'],
      },
      // at-risk / churn
      {
        kws: ['churn', 'at-risk', 'at risk', 'risque'],
        tools: ['list_at_risk_customers'],
      },
      // top customers
      {
        kws: ['top customer', 'best customer', 'biggest spender'],
        tools: ['list_top_customers'],
      },
      // customer count
      {
        kws: ['how many customer', 'customer count', 'new customer'],
        tools: ['get_customer_count'],
      },
      // overdue invoices
      {
        kws: ['overdue', 'unpaid', 'late invoice', 'impayé'],
        tools: ['list_overdue_invoices'],
      },
      // invoices generic
      { kws: ['invoice', 'facture', 'فاتورة'], tools: ['list_invoices'] },
      // revenue
      {
        kws: ['revenue', 'chiffre', 'sales today', 'sales this'],
        tools: ['get_revenue_summary'],
      },
      // dashboard / kpis
      { kws: ['dashboard', 'kpi', 'overview'], tools: ['get_dashboard_kpis'] },
      // appointments
      {
        kws: [
          'appointment',
          'rendez-vous',
          'rdv',
          'موعد',
          'schedule today',
          'schedule for',
        ],
        tools: ['list_appointments'],
      },
      // available slot
      {
        kws: ['available slot', 'free slot', 'when can i book'],
        tools: ['find_available_slot'],
      },
      // active jobs
      {
        kws: ['active job', 'in progress', "what's being worked"],
        tools: ['list_active_jobs'],
      },
      // maintenance due
      {
        kws: ['maintenance due', 'service due', 'needs service'],
        tools: ['list_maintenance_due'],
      },
      // car lookup
      {
        kws: ['plate', 'license plate', 'find car', 'find vehicle'],
        tools: ['find_car'],
      },
      // customer lookup (find_ for name/phone/email, get_ for UUID)
      {
        kws: [
          'find customer',
          'search customer',
          'look up customer',
          'customer details',
          'this customer',
          'this client',
        ],
        tools: ['find_customer', 'get_customer'],
      },
    ];
    for (const g of groups) {
      if (g.kws.some((kw) => m.includes(kw))) return g.tools;
    }
    return [];
  }

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
    ctx: AssistantUserContext,
  ): string {
    const localeName: Record<Locale, string> = {
      en: 'English',
      fr: 'French',
      ar: 'Arabic',
    };
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const parts: string[] = [];
    parts.push(
      `Today's date is ${todayIso} (UTC). The current year is ${now.getUTCFullYear()}. ` +
        `When the user asks for a time-relative window — "today", "yesterday", "last week", ` +
        `"last 3 months", "this quarter", "since March", etc. — compute concrete from/to dates ` +
        `relative to TODAY. Never anchor to a year from your training data. For "last 3 months" ` +
        `pass from = today minus 90 days, to = today.\n\n` +
        `If the user asks for a specific past year your tools can't filter on (e.g. "in 1990", ` +
        `"in 2010") — DO NOT silently drop the year and run with default args. Either pass an ` +
        `explicit from/to date range that brackets the requested year, OR if the tool's schema ` +
        `does not support that window, reply: "I don't have data filterable to <year>; my ` +
        `records start at <earliest sensible date>." Never label present-day data with a ` +
        `historical year — that is a fabrication and is strictly forbidden.`,
    );
    parts.push(
      `You are the OpAuto AI assistant for an automotive garage business in Tunisia. ` +
        `Respond to the user in ${localeName[locale]}. Be concise and direct. ` +
        `You have access to tools for reading data, performing actions, ` +
        `loading reusable skill playbooks, and dispatching specialist agents. ` +
        `Use a tool whenever the user is asking for live data; never invent ` +
        `numbers. If a tool result is 0 or empty, report exactly that — do NOT fabricate ` +
        `figures. Never ask the user for ids you can look up via tools.`,
    );

    // Identity block — without this, the model has no way to resolve "send me /
    // email me / garage owner / current user" to a concrete email address. It
    // would either guess (often wrong) or refuse with "I cannot send directly".
    const ownerLabel = ctx.role === 'OWNER' ? 'garage owner' : 'staff member';
    const userEmail = ctx.email && ctx.email.length > 0 ? ctx.email : null;
    const identityLines: string[] = [
      `Current user: ${userEmail ?? '(no email on file)'} (role: ${ctx.role}, ${ownerLabel}).`,
    ];
    if (userEmail) {
      identityLines.push(
        `When the user says "send me", "email me", "text me", "to me", "myself", ` +
          `"current user", or — if role is OWNER — "garage owner" / "the owner", ` +
          `the recipient is the email above. That's a SELF-SEND and executes ` +
          `immediately without approval (recipient == current user's email). Do NOT ` +
          `ask the user to provide their own address; do NOT draft for manual sending.`,
      );
    } else {
      identityLines.push(
        `The current user has no email on file. If asked to "send me" or "email me", ` +
          `tell the user their account has no email registered and ask them to set one ` +
          `in account settings. Do NOT guess an address.`,
      );
    }
    parts.push(identityLines.join('\n'));
    parts.push(
      `Formatting rules:\n` +
        `- Use Markdown: **bold** for emphasis, lists with - or 1., backticks for code, links as [text](url). The chat UI renders Markdown.\n` +
        `- Currency is Tunisian Dinar. Format amounts as "1,234.56 TND" (English) or "1 234,56 DT" (French). NEVER prefix with a currency symbol — no ₸, no د.ت, no $, no €. Just the number and the code.\n` +
        `- Round currency to 2 decimal places.\n` +
        `- Reference customer/car/invoice IDs as monospace code (\`abc-123\`) when you must show them; prefer human-readable names otherwise.\n` +
        `- NEVER write tool-call markup in your reply. Do NOT print JSON like \`{"type":"function","name":"...","arguments":...}\`, do NOT use \`<function=name>{...}</function>\` tags, and do NOT narrate "I will call tool X". Either invoke the tool through the structured tool-use channel (the assistant runtime executes it) or describe the result in plain prose. Tool-call JSON in your reply text is treated as a malformed response and discarded.`,
    );
    parts.push(
      `Action chaining rules:\n` +
        `- When the user asks you to email/send a report or summary, FIRST call the relevant read tool to fetch real data (e.g. list_invoices, get_revenue_summary, list_at_risk_customers), THEN call send_email with a body that includes those concrete numbers. Do NOT write placeholder bodies like "please find the data below" without the data inline.\n` +
        `- When the user wants invoices attached to an email, call list_invoices first to get the invoice IDs, then pass them as attachInvoiceIds in send_email — the backend converts them to a CSV attachment automatically.\n` +
        `- Self-sends (recipient == the user's own email) execute immediately without approval. External recipients require approval — pre-fetch all data BEFORE asking the LLM to call send_email so the user only approves once.`,
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
            .join('\n') +
          `\n\nWhen to dispatch an agent vs. call a tool directly (I-015):\n` +
          `- For an atomic single-fact question ("how many X", "total Y", "list latest Z", ` +
          `"what is my <kpi>"), prefer a DIRECT tool call. ` +
          `e.g. "Inventory total value" → get_inventory_value, NOT dispatch_agent. ` +
          `Each agent dispatch costs 3-5× the tokens of a direct call.\n` +
          `- Reserve dispatch_agent for multi-step analyses that genuinely benefit from ` +
          `a private scratchpad (retention reviews, cash-flow forecasts, audits). ` +
          `If a single tool can answer the question, do not dispatch.`,
      );
    }
    if (pageContext) {
      const pieces: string[] = [];
      if (pageContext.route) pieces.push(`route=${pageContext.route}`);
      // Derive a "selected entity" hint from the route pattern + params when
      // the frontend hasn't set one explicitly. Without this, the LLM sees
      // "route=/customers/abc-123" and has to infer the id-extraction itself,
      // which it gets wrong often enough to break "tell me about this customer"
      // flows. Explicit > clever.
      const selected =
        pageContext.selectedEntity ??
        deriveSelectedEntityFromRoute(
          pageContext.route,
          pageContext.params,
        );
      if (selected) {
        pieces.push(
          `selected=${selected.type}:${selected.id}` +
            (selected.displayName ? ` (${selected.displayName})` : ''),
        );
      }
      if (pageContext.params && Object.keys(pageContext.params).length > 0) {
        const paramStr = Object.entries(pageContext.params)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        pieces.push(`params={${paramStr}}`);
      }
      if (pieces.length > 0) {
        parts.push(
          `Page context: ${pieces.join(' | ')}\n` +
            `When the user says "this customer", "this car", "this invoice", ` +
            `"this appointment", etc., they mean the entity in the "selected" ` +
            `field above. Pass that exact id to tools like get_customer / ` +
            `get_car / get_invoice — do NOT call find_* with the id as a query ` +
            `string, and do NOT ask the user for an id you already have.`,
        );
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

  /**
   * Replace the verbose first-turn system prompt with a minimal compose-only
   * one. Used after a tool has fired — the model only needs to answer the
   * user using the tool results already in the conversation, not pick more
   * tools. Saves ~2k input tokens per follow-up call which keeps the turn
   * inside Groq free-tier 6000 TPM.
   */
  private swapSystemPromptForComposeOnly(
    messages: LlmMessage[],
    locale: AssistantUserContext['locale'],
  ): LlmMessage[] {
    const localeName = { en: 'English', fr: 'French', ar: 'Arabic' }[locale];
    const todayIso = new Date().toISOString().slice(0, 10);
    const compose: LlmMessage = {
      role: 'system',
      content:
        `Today is ${todayIso}. Respond to the user in ${localeName}. The conversation above contains the tool result you need. ` +
        `Phrase a concise, direct answer using the EXACT numbers from the tool result. If the result is 0, empty, or shows no data, ` +
        `say that explicitly — do NOT invent or estimate figures. Do NOT call another tool. ` +
        `Currency formatting: "1,234.56 TND" (English) or "1 234,56 DT" (French) — never prefix with a symbol.\n\n` +
        // I-014 — if a tool returned a structured error field (e.g. send_email
        // → {error: "send_failed", message: "..."}), the user MUST be told the
        // action did not succeed. Previously the LLM would happily summarise
        // the OTHER tool results in the chain ("There are 19 overdue invoices")
        // and the failed send was silently swallowed. Surface infra-level
        // failures explicitly with the original message.
        `If any tool result in the conversation contains an "error" field (for example send_email returning {error:"send_failed", message:"..."}), ` +
        `you MUST mention the failure in your reply, prefixed with "⚠️", and quote the underlying message verbatim. Never imply the action ` +
        `succeeded when the tool returned an error. If a write/send action failed, the user expects to know — silence is a bug.`,
    };
    // Keep all non-system messages; replace the first system message (the
    // big buildSystemPrompt output) with the compose-only one. Other system
    // messages (e.g. skill bodies prepended via load_skill) are preserved.
    const first = messages.findIndex((m) => m.role === 'system');
    if (first === -1) return [compose, ...messages];
    return [compose, ...messages.slice(0, first), ...messages.slice(first + 1)];
  }

  /**
   * Catch tool-specific malformed write calls before holding for user approval.
   * Returns a tool-error payload to feed back to the LLM, or null if args are
   * acceptable to surface for approval. Keeping this orchestrator-side avoids
   * wiring a per-tool hook for the one or two cases where Groq's small model
   * routinely emits empty-payload writes.
   */
  private preApprovalCheck(
    toolName: string,
    args: unknown,
  ): { error: string; message: string } | null {
    if (toolName !== 'send_email') return null;
    if (typeof args !== 'object' || args === null) return null;
    const a = args as Record<string, unknown>;
    const html = typeof a.html === 'string' ? a.html.trim() : '';
    const text = typeof a.text === 'string' ? a.text.trim() : '';
    const ids = Array.isArray(a.attachInvoiceIds) ? a.attachInvoiceIds : [];
    if (html.length === 0 && text.length === 0 && ids.length === 0) {
      return {
        error: 'empty_email_payload',
        message:
          'send_email was called with an empty body and no attachInvoiceIds. ' +
          'You must populate `text` (or `html`) with the actual content first. ' +
          'If the user asked for invoices/data attached, call list_invoices ' +
          '(or the relevant read tool) first to get real data, then call ' +
          'send_email again with a populated body and the fetched ids in ' +
          'attachInvoiceIds.',
      };
    }
    return null;
  }

  /**
   * Build a per-call validator that catches text-mode tool-call leaks (raw
   * JSON or `<function=...>` markup in `content`) before they reach the user.
   *
   * Behaviour:
   *  - Result has structured `toolCalls` AND content has a leak: scrub the
   *    content (defensive — model executed correctly but also dumped JSON in
   *    prose) and accept.
   *  - Result has zero structured tool calls AND content has a leak:
   *    - If exactly one valid call salvages cleanly → inject it as
   *      `toolCalls`, scrub the content, accept.
   *    - Otherwise → reject so the gateway advances to the next provider.
   *  - On a tool-less turn (e.g. compose-only after a tool fired): scrub any
   *    leak but never reject — there are no tools to retry against and the
   *    next provider would only re-emit the same prose.
   *  - No leak detected: pass through unchanged.
   */
  private buildLeakValidator(
    offeredTools: ToolDescriptor[] | undefined,
  ): (result: LlmCompletionResult) => LlmValidationOutcome {
    const toolNames = new Set<string>((offeredTools ?? []).map((t) => t.name));
    const wasOfferedTools = toolNames.size > 0;
    // I-013 — also scrub bare `{"name":"<known>","input":...}` leaks on
    // compose-only turns. The orchestrator's pseudo-tools (`load_skill`,
    // `dispatch_agent`) and every registered real tool count as "known".
    // Without this, B-11 leaked `{"name":"dispatch_agent","input":"…"}` raw
    // to the user even after the agent had finished.
    const allKnownNames = new Set<string>([
      RESERVED_LOAD_SKILL,
      RESERVED_DISPATCH_AGENT,
      ...toolNames,
      ...this.tools.listAllNames(),
    ]);
    return (result) => {
      const leak = detectToolCallLeak(result.content, allKnownNames);
      if (!leak) {
        return { ok: true, result };
      }

      if (result.toolCalls.length > 0 || !wasOfferedTools) {
        // Either the model made a structured call (and incidentally dumped
        // JSON), or this is a compose-only turn where retrying buys us
        // nothing. Scrub and pass through.
        const scrubbed = scrubLeakFromContent(result.content, allKnownNames);
        this.logger.warn(
          `assistant.leak.scrubbed provider=${result.provider} kind=${leak.kind} count=${leak.matches.length} hadStructured=${result.toolCalls.length > 0} offeredTools=${wasOfferedTools}`,
        );
        return { ok: true, result: { ...result, content: scrubbed } };
      }

      // No structured calls but the model emitted text-mode tool calls. Try
      // to salvage one clean call.
      const salvaged = salvageToolCall(leak, toolNames);
      if (salvaged) {
        const scrubbed = scrubLeakFromContent(result.content, allKnownNames);
        this.logger.warn(
          `assistant.leak.salvaged provider=${result.provider} kind=${leak.kind} tool=${salvaged.name}`,
        );
        return {
          ok: true,
          result: {
            ...result,
            content: scrubbed,
            toolCalls: [salvaged],
          },
        };
      }

      this.logger.warn(
        `assistant.leak.fallthrough provider=${result.provider} kind=${leak.kind} count=${leak.matches.length} preview=${(result.content ?? '').slice(0, 120)}`,
      );
      return {
        ok: false,
        reason: `tool_call_leak_${leak.kind}_count=${leak.matches.length}`,
      };
    };
  }

  private safeParseArgs(
    json: string,
  ):
    | { value: unknown; error?: undefined }
    | { value: undefined; error: string } {
    if (!json || json.length === 0) return { value: {} };
    try {
      const parsed = JSON.parse(json);
      // Llama models occasionally emit `null`, primitive strings, or arrays
      // instead of an args object when the tool takes no required params.
      // Normalise to `{}` so ajv's `type: 'object'` doesn't reject what is
      // semantically a no-arg call.
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      ) {
        return { value: {} };
      }
      return { value: parsed };
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
      return JSON.stringify({
        error: 'unserialisable_result',
        detail: message,
      });
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
