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
  ToolDefinition,
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

const DEFAULT_ITERATION_CAP = 12;
const TOTAL_TURN_TIMEOUT_MS = 90_000;
const MAX_TOOL_RESULT_BYTES = 8 * 1024;
const HISTORY_LIMIT = 20;
const CONVERSATION_TOKEN_BUDGET = 200_000;
const BUDGET_EXCEEDED_MESSAGE =
  'This conversation has reached its token budget. Start a new conversation to continue.';

const RESUME_PREFIX = '__resume__:';

const RESERVED_LOAD_SKILL = 'load_skill';
const RESERVED_DISPATCH_AGENT = 'dispatch_agent';
const MONTHLY_FINANCIAL_REPORT_SKILL = 'monthly-financial-report';
const FINANCE_AGENT_NAME = 'finance-agent';
const AGENT_DISPATCH_ALIASES: Record<string, string> = {
  'retention-suggestions': 'growth-agent',
};
const RETENTION_REVIEW_AGENT_NAME = 'growth-agent';
const RETENTION_REVIEW_SOURCE_SKILL = 'retention-suggestions';
const RETENTION_REVIEW_TOOL_NAME = 'list_at_risk_customers';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_IN_TEXT_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const UUID_FRAGMENT_IN_TEXT_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{8,12}\b/i;

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

interface ResumeExecutionState {
  toolHasFired: boolean;
  lastToolTier: AssistantBlastTier | null;
  lastToolName: string | null;
  successfulToolResult?: { toolName: string; result: unknown };
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

    // B-XX — initialise per-turn execution state. Mutated by
    // ToolRegistryService.execute on each successful READ-tier call so write
    // tools (notably send_email) can refuse "no data" composes when no read
    // actually ran.
    ctx.turnState = { readToolCallsSoFar: 0, userMessage };

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
      const allRealToolsRaw = this.tools.listForUser(ctx);
      // UI Bug 7 / N-001 hard enforcement — when pageContext.selectedEntity
      // is set the conversation is scoped to a specific entity. The system
      // prompt already instructs the LLM not to call broad-scan tools, but
      // the model still emits them ~30% of the time. Drop them from the
      // tool list entirely so the model literally cannot see them.
      const allRealTools = this.scopeToolsForPageContext(
        allRealToolsRaw,
        pageContext,
      );
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
        : await this.filterToolsByIntent(
            userMessage,
            ctx,
            conversationId,
            pageContext,
            allRealTools,
          );

      const llmTools: ToolDescriptor[] = this.buildLlmToolList(
        realTools,
        skillDescriptors,
        agentDescriptors,
      );
      const growthAgentAvailable = agentDescriptors.some(
        (agent) => agent.name === RETENTION_REVIEW_AGENT_NAME,
      );
      const shouldRouteRetentionReview =
        this.userAskedForRetentionReview(userMessage);
      const monthlyFinancialReportSkillAvailable = skillDescriptors.some(
        (skill) => skill.name === MONTHLY_FINANCIAL_REPORT_SKILL,
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

      let toolHasFired = false;
      let lastToolTier: AssistantBlastTier | null = null;
      let lastToolName: string | null = null;
      const successfulToolResults: { toolName: string; result: unknown }[] = [];

      // --- If this is a resume turn, materialise the pending tool call as a
      //     synthetic assistant + tool message pair so the LLM has context. -
      if (isResume) {
        const toolCallId = userMessage.slice(RESUME_PREFIX.length).trim();
        const resumeState: ResumeExecutionState = {
          toolHasFired: false,
          lastToolTier: null,
          lastToolName: null,
        };
        const handled = await this.handleResume(
          ctx,
          conversationId,
          toolCallId,
          llmMessages,
          subject,
          resumeState,
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
        if (resumeState.toolHasFired) {
          toolHasFired = true;
          lastToolTier = resumeState.lastToolTier;
          lastToolName = resumeState.lastToolName;
          if (resumeState.successfulToolResult) {
            successfulToolResults.push(resumeState.successfulToolResult);
          }
        }
      }

      // --- Iteration loop. -------------------------------------------------
      // After a tool has executed at least once we drop the schemas from
      // the LLM payload — the model only needs to compose prose around the
      // tool result on subsequent calls, not pick another tool. This keeps
      // the second LLM round-trip lean (no 2-3k tokens of schemas re-sent)
      // so the whole turn fits inside Groq's free-tier 6000 TPM ceiling.
      // Track the LAST executed tool's blast tier so we can decide whether
      // the next iteration should still offer tools. After a READ tool we
      // must keep tools available (the model may chain into a write tool —
      // e.g. list_invoices → send_email). After a write tool the action is
      // complete and we can swap to the cheaper compose-only mode.
      // Per-turn cap on dispatch_agent (B-23/B-24): without this cap a misbehaving
      // model would re-dispatch the same specialist agent on each iteration,
      // blowing the 90s turn budget and racking up OVH spend before
      // converging. Each agent run is itself iteration-capped, so 2 dispatches
      // is plenty headroom for retry-with-feedback while still bounded.
      const MAX_AGENT_DISPATCHES_PER_TURN = 2;
      let agentDispatchesThisTurn = 0;
      let lastAgentResult: { agentName: string; result: string } | null = null;
      // Per-turn cap on EVERY tool, not just find_* (I-016 broadening):
      // the original empty-result-only cap missed B-06 in the UI path
      // because find_car returned a NON-empty array each call (the right
      // car!) but the LLM still re-called it 8×. A hard call-count cap
      // catches the loop regardless of result shape — if the model can't
      // be satisfied by 3 calls to the same tool with the same args, it
      // never will be. After hitting the cap, force compose-only so the
      // model has to synthesise from what it already has.
      const MAX_CALLS_PER_TOOL_PER_TURN = 3;
      const toolCallCounts = new Map<string, number>();
      let forceComposeOnly = false;
      const requiredActionRetriesIssued = new Set<string>();
      let monthlyFinancialReportSkillLoadedThisTurn = false;
      const recordFailedToolAttempt = (toolName: string, reason: string) => {
        const prevCount = toolCallCounts.get(toolName) ?? 0;
        const nextCount = prevCount + 1;
        toolCallCounts.set(toolName, nextCount);
        if (nextCount >= MAX_CALLS_PER_TOOL_PER_TURN) {
          forceComposeOnly = true;
          llmMessages.push({
            role: 'system',
            content:
              `${toolName} failed ${nextCount} times this turn (${reason}). ` +
              `Stop retrying that tool. Compose a brief, user-friendly reply ` +
              `from the latest error/result already available. Do NOT call any ` +
              `tool again this turn.`,
          });
        }
      };
      const dispatchGrowthAgentForRetentionReview = async (
        sourceCallId: string,
      ): Promise<boolean> => {
        if (agentDispatchesThisTurn >= MAX_AGENT_DISPATCHES_PER_TURN) {
          this.appendToolMessage(llmMessages, sourceCallId, {
            error: 'agent_dispatch_capped',
            message:
              `Refusing to dispatch another agent — already invoked ` +
              `${agentDispatchesThisTurn} time(s) this turn. Compose your ` +
              `final reply from the agent results above.`,
          });
          return false;
        }

        agentDispatchesThisTurn++;
        const dispatchCall: LlmToolCall = {
          id: `${sourceCallId}-growth-agent`,
          name: RESERVED_DISPATCH_AGENT,
          argsJson: JSON.stringify({
            name: RETENTION_REVIEW_AGENT_NAME,
            input: (ctx.turnState?.userMessage ?? '').trim() || userMessage,
            reason: 'retention review',
          }),
        };
        const agentResult = await this.handleDispatchAgent(
          dispatchCall,
          ctx,
          llmMessages,
          subject,
        );
        if (agentResult) {
          lastAgentResult = agentResult;
          return true;
        }
        return false;
      };

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
        const taskUserMessage = this.resolveTaskUserMessage(
          ctx.turnState?.userMessage,
          llmMessages,
        );
        const continueWithCustomerApprovalEmail =
          this.shouldContinueWithCustomerApprovalEmailAfterPart(
            taskUserMessage,
            pageContext,
            lastToolName,
            successfulToolResults,
          );
        const swapToComposeOnly =
          (toolHasFired &&
            lastToolTier !== AssistantBlastTier.READ &&
            !continueWithCustomerApprovalEmail) ||
          forceComposeOnly;
        const messagesForCall = continueWithCustomerApprovalEmail
          ? this.addCustomerApprovalEmailContinuationGuidance(llmMessages)
          : swapToComposeOnly
            ? this.swapSystemPromptForComposeOnly(llmMessages, ctx.locale)
            : llmMessages;
        const offeredTools = continueWithCustomerApprovalEmail
          ? llmTools.filter(
              (tool) => tool.name === 'send_job_customer_approval_email',
            )
          : swapToComposeOnly
            ? undefined
            : llmTools;
        const completion = await this.llm.complete({
          messages: messagesForCall,
          tools: offeredTools,
          purpose: swapToComposeOnly
            ? 'assistant_compose'
            : 'assistant_tool_selection',
          usageContext: {
            conversationId,
            garageId: ctx.garageId,
            userId: ctx.userId,
            toolName: lastToolName ?? undefined,
          },
          validateResult: this.buildLeakValidator(offeredTools),
        });

        let toolCalls = completion.toolCalls ?? [];

        // I-016 hardening — when we explicitly did NOT offer tools (compose-only
        // turn or find_* retry cap engaged), some LLMs still emit hallucinated
        // tool_calls. Ignore them so the cap genuinely caps. Without this, B-06
        // saw 3 find_car runs instead of 2 — the third was a tool_call returned
        // by the model on the first compose-only iteration, and we ran it.
        if (swapToComposeOnly && toolCalls.length > 0) {
          this.logger.warn(
            `assistant.compose_only.toolcalls_ignored count=${toolCalls.length} names=${toolCalls.map((c) => c.name).join(',')}`,
          );
          toolCalls = [];
        }

        if (toolCalls.length === 0) {
          const requiredActionRetry =
            !swapToComposeOnly && step < iterationCap - 1
              ? this.requiredActionToolRetry(
                  ctx.turnState?.userMessage,
                  successfulToolResults,
                )
              : null;
          if (
            requiredActionRetry &&
            !requiredActionRetriesIssued.has(requiredActionRetry.key)
          ) {
            requiredActionRetriesIssued.add(requiredActionRetry.key);
            llmMessages.push({
              role: 'system',
              content: requiredActionRetry.content,
            });
            continue;
          }

          let text = completion.content ?? '';
          if (lastAgentResult && this.shouldFallbackToAgentResult(text)) {
            text = lastAgentResult.result;
          }
          text = this.postProcessAssistantText(
            text,
            ctx,
            successfulToolResults,
          );
          const persisted = await this.persistAssistant(
            conversationId,
            text,
            completion,
          );
          if (text.length > 0) {
            subject.next({ type: 'text', delta: text });
          }
          subject.next({ type: 'done', messageId: persisted?.id });
          subject.complete();
          // Fire-and-forget: title summary on first turn, never block the
          // observable on it. Failures are logged inside the service.
          void this.maybeGenerateTitle(conversationId, ctx);
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
          completion,
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
          const parsed = this.safeParseArgs(call.argsJson);
          const parsedSkill =
            typeof parsed.value === 'object' &&
            parsed.value !== null &&
            !Array.isArray(parsed.value) &&
            typeof (parsed.value as { name?: unknown }).name === 'string'
              ? ((parsed.value as { name?: unknown }).name as string)
              : '';
          if (
            shouldRouteRetentionReview &&
            growthAgentAvailable &&
            !parsed.error &&
            parsedSkill === RETENTION_REVIEW_SOURCE_SKILL
          ) {
            const dispatched = await dispatchGrowthAgentForRetentionReview(
              call.id,
            );
            if (dispatched) {
              continue;
            }
          }
          const handled = await this.handleLoadSkill(
            call,
            ctx.locale,
            llmMessages,
            subject,
          );
          if (handled && parsedSkill === MONTHLY_FINANCIAL_REPORT_SKILL) {
            monthlyFinancialReportSkillLoadedThisTurn = true;
          }
          if (!handled) {
            // Treat as failure result and let the LLM recover.
            this.appendToolMessage(llmMessages, call.id, {
              error: 'unknown_skill',
            });
          }
          continue;
        }
        if (call.name === RESERVED_DISPATCH_AGENT) {
          const parsedDispatchArgs = this.safeParseArgs(call.argsJson);
          const parsedDispatch = parsedDispatchArgs.error
            ? null
            : (parsedDispatchArgs.value as { name?: unknown });
          const requestedAgent = this.resolveAgentDispatchName(
            typeof parsedDispatch?.name === 'string' ? parsedDispatch.name : '',
          );
          if (
            !monthlyFinancialReportSkillLoadedThisTurn &&
            monthlyFinancialReportSkillAvailable &&
            this.shouldPreferMonthlyFinancialReportSkill(
              ctx.turnState?.userMessage,
              requestedAgent,
              call.name,
            )
          ) {
            const loaded = await this.handleLoadSkill(
              {
                ...call,
                name: RESERVED_LOAD_SKILL,
                argsJson: JSON.stringify({
                  name: MONTHLY_FINANCIAL_REPORT_SKILL,
                }),
              },
              ctx.locale,
              llmMessages,
              subject,
            );
            if (loaded) {
              monthlyFinancialReportSkillLoadedThisTurn = true;
              continue;
            }
          }
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
          const agentResult = await this.handleDispatchAgent(
            call,
            ctx,
            llmMessages,
            subject,
          );
          if (agentResult) {
            lastAgentResult = agentResult;
          }
          continue;
        }

        // Real tool path.
        if (
          !monthlyFinancialReportSkillLoadedThisTurn &&
          monthlyFinancialReportSkillAvailable &&
          this.shouldPreferMonthlyFinancialReportSkill(
            ctx.turnState?.userMessage,
            null,
            call.name,
          )
        ) {
          const loaded = await this.handleLoadSkill(
            {
              ...call,
              name: RESERVED_LOAD_SKILL,
              argsJson: JSON.stringify({
                name: MONTHLY_FINANCIAL_REPORT_SKILL,
              }),
            },
            ctx.locale,
            llmMessages,
            subject,
          );
          if (loaded) {
            monthlyFinancialReportSkillLoadedThisTurn = true;
            continue;
          }
        }
        if (
          shouldRouteRetentionReview &&
          growthAgentAvailable &&
          call.name === RETENTION_REVIEW_TOOL_NAME
        ) {
          const dispatched = await dispatchGrowthAgentForRetentionReview(
            call.id,
          );
          if (dispatched) {
            continue;
          }
        }
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

        // UI Bug 7 hardening — even though we filtered broad-scan tools out
        // of llmTools when pageContext.selectedEntity is set, a loaded skill
        // body or older history can still nudge the LLM to call them. Refuse
        // any broad-scan tool when a selected entity is set, regardless of
        // whether it survived the classifier. We do NOT block other un-offered
        // tools (e.g. get_customer when the classifier didn't pick it) — those
        // are still legitimate and useful in scope.
        if (
          this.isBroadScanTool(call.name) &&
          this.hasSelectedEntity(pageContext)
        ) {
          subject.next({
            type: 'tool_result',
            toolCallId: call.id,
            result: {
              error: 'tool_not_offered',
              name: call.name,
              message:
                `${call.name} is a garage-wide scan and is not available ` +
                `while the conversation is scoped to a single entity. ` +
                `Use the id-based tools (get_customer, get_invoice, get_car) ` +
                `to answer about THIS entity, then compose the reply.`,
            },
            status: 'failed',
          });
          this.appendToolMessage(llmMessages, call.id, {
            error: 'tool_not_offered',
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
          recordFailedToolAttempt(call.name, 'invalid JSON arguments');
          continue;
        }

        parsedArgs.value = this.normaliseCreateInvoiceArgs(
          call.name,
          parsedArgs.value,
          ctx.turnState?.userMessage,
        );
        parsedArgs.value = this.normaliseRecordPaymentArgs(
          call.name,
          parsedArgs.value,
          ctx.turnState?.userMessage,
        );
        let validation = this.tools.validateArgs(call.name, parsedArgs.value);
        if (!validation.valid) {
          let recoveredArgs = this.recoverCreateInvoiceArgsFromContext(
            call.name,
            parsedArgs.value,
            validation.errors ?? [],
            ctx.turnState?.userMessage,
            successfulToolResults,
          );
          if (!recoveredArgs) {
            recoveredArgs = this.recoverRecordPaymentArgsFromContext(
              call.name,
              parsedArgs.value,
              validation.errors ?? [],
              ctx.turnState?.userMessage,
              successfulToolResults,
            );
          }
          if (recoveredArgs) {
            const recoveredValidation = this.tools.validateArgs(
              call.name,
              recoveredArgs,
            );
            if (recoveredValidation.valid) {
              parsedArgs.value = recoveredArgs;
              validation = recoveredValidation;
            }
          }
        }
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
          const invalidWriteGuidance = this.guidanceForInvalidWriteArgs(
            call.name,
            validation.errors ?? [],
            ctx.turnState?.userMessage,
          );
          if (invalidWriteGuidance) {
            forceComposeOnly = invalidWriteGuidance.forceComposeOnly;
            llmMessages.push({
              role: 'system',
              content: invalidWriteGuidance.content,
            });
          }
          recordFailedToolAttempt(call.name, 'invalid arguments');
          continue;
        }

        const tier = this.tools.resolveBlastTier(tool, parsedArgs.value, ctx);

        // Pre-approval guard: catch obviously-malformed write calls (empty
        // payloads, missing required content) BEFORE asking the user to
        // approve. Letting the LLM fix its own mistake is far better UX than
        // surfacing an empty-body approval card the user has to deny.
        const preCheck = await this.preApprovalCheck(
          call.name,
          parsedArgs.value,
          ctx,
          conversationId,
          pageContext,
          successfulToolResults,
        );
        if (preCheck) {
          subject.next({
            type: 'tool_result',
            toolCallId: call.id,
            result: preCheck,
            status: 'failed',
          });
          this.appendToolMessage(llmMessages, call.id, preCheck);
          recordFailedToolAttempt(call.name, preCheck.error);
          continue;
        }

        if (
          typeof parsedArgs.value === 'object' &&
          parsedArgs.value !== null &&
          tool.prepareApprovalArgs
        ) {
          try {
            parsedArgs.value = await tool.prepareApprovalArgs(
              parsedArgs.value,
              ctx,
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            subject.next({
              type: 'tool_result',
              toolCallId: call.id,
              result: { error: 'approval_prep_failed', detail: message },
              status: 'failed',
            });
            this.appendToolMessage(llmMessages, call.id, {
              error: 'approval_prep_failed',
              detail: message,
            });
            recordFailedToolAttempt(call.name, 'approval prep failed');
            continue;
          }
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

          const retryGuidance = this.retryGuidanceForToolResult(
            call.name,
            successExec.result,
          );
          if (retryGuidance) {
            recordFailedToolAttempt(call.name, retryGuidance.reason);
            llmMessages.push({
              role: 'system',
              content: retryGuidance.content,
            });
            continue;
          }

          toolHasFired = true;
          lastToolTier = tier;
          lastToolName = call.name;
          successfulToolResults.push({
            toolName: call.name,
            result: successExec.result,
          });

          // I-016 — hard cap on per-tool calls per turn. Stops the model from
          // looping on the same tool whether the result is empty (B-06 raw
          // SSE: 3× find_car) or non-empty (B-06 UI path: 8× find_car against
          // the SAME car). After the cap, inject a system message and force
          // compose-only so the model can't call any tool again this turn.
          const prevCount = toolCallCounts.get(call.name) ?? 0;
          const nextCount = prevCount + 1;
          toolCallCounts.set(call.name, nextCount);
          if (nextCount >= MAX_CALLS_PER_TOOL_PER_TURN) {
            forceComposeOnly = true;
            const wasEmpty = isEmptyResult(successExec.result);
            llmMessages.push({
              role: 'system',
              content: wasEmpty
                ? `${call.name} returned no results ${nextCount} times this turn. ` +
                  `STOP — there is no match. Compose a brief "I couldn't find …" ` +
                  `reply and end the turn. Do NOT call any tool again.`
                : `${call.name} has been called ${nextCount} times this turn. ` +
                  `Synthesise the answer from the result(s) you already have. ` +
                  `Do NOT call any tool again this turn.`,
            });
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

          recordFailedToolAttempt(call.name, failExec.error);
        }
      }

      // Iteration cap exceeded.
      const text =
        lastAgentResult &&
        !this.shouldFallbackToAgentResult(lastAgentResult.result)
          ? lastAgentResult.result
          : "I couldn't finish the task in time — let's try a smaller question.";
      const finalText = this.postProcessAssistantText(
        text,
        ctx,
        successfulToolResults,
      );
      await this.persistAssistant(conversationId, finalText);
      subject.next({ type: 'text', delta: finalText });
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

  private retryGuidanceForToolResult(
    toolName: string,
    result: unknown,
  ): { reason: string; content: string } | null {
    if (toolName !== 'send_email') return null;
    if (
      typeof result !== 'object' ||
      result === null ||
      Array.isArray(result)
    ) {
      return null;
    }
    const error = (result as { error?: unknown }).error;
    if (error !== 'no_supporting_reads') return null;

    return {
      reason: 'no supporting reads',
      content:
        'send_email was rejected because its body summarised live data but no read tool ran this turn. ' +
        'Retry by calling the relevant READ tool(s) first, then call send_email again with concrete values inlined. ' +
        'For dashboard totals, call get_dashboard_kpis. For overdue invoice status, call list_overdue_invoices. ' +
        'Do not call send_email again with placeholders or guessed values.',
    };
  }

  // ── Resume flow ───────────────────────────────────────────────────────

  private async handleResume(
    ctx: AssistantUserContext,
    conversationId: string,
    toolCallId: string,
    llmMessages: LlmMessage[],
    subject: ReplaySubject<SseEvent>,
    resumeState?: ResumeExecutionState,
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
        if (resumeState) {
          resumeState.toolHasFired = true;
          resumeState.lastToolTier = this.resumeBlastTier(row, tool, args, ctx);
          resumeState.lastToolName = row.toolName;
          resumeState.successfulToolResult = {
            toolName: row.toolName,
            result: successExec.result,
          };
        }
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
      if (tool.cleanupApprovalArgs) {
        try {
          await tool.cleanupApprovalArgs(args, ctx);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Approval cleanup failed for ${row.toolName}/${toolCallId}: ${message}`,
          );
        }
      }
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

  private resumeBlastTier(
    row: { blastTier?: AssistantBlastTier | string | null },
    tool: ToolDefinition,
    args: unknown,
    ctx: AssistantUserContext,
  ): AssistantBlastTier {
    if (
      row.blastTier === AssistantBlastTier.READ ||
      row.blastTier === AssistantBlastTier.AUTO_WRITE ||
      row.blastTier === AssistantBlastTier.CONFIRM_WRITE ||
      row.blastTier === AssistantBlastTier.TYPED_CONFIRM_WRITE
    ) {
      return row.blastTier;
    }

    try {
      return this.tools.resolveBlastTier(tool, args, ctx);
    } catch {
      return tool.blastTier;
    }
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
  ): Promise<{ agentName: string; result: string } | null> {
    const parsed = this.safeParseArgs(call.argsJson);
    if (parsed.error) {
      this.appendToolMessage(llmMessages, call.id, {
        error: 'invalid_arguments',
        detail: parsed.error,
      });
      return null;
    }
    const args = parsed.value as {
      name?: unknown;
      input?: unknown;
      reason?: unknown;
    };
    const agentName = this.resolveAgentDispatchName(args?.name);
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
      return null;
    }

    subject.next({ type: 'agent_dispatch', agentName, reason });
    try {
      const { result } = await this.agents.run(agentName, input, ctx);
      subject.next({ type: 'agent_result', agentName, result });
      this.appendToolMessage(llmMessages, call.id, { result });
      return { agentName, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.appendToolMessage(llmMessages, call.id, {
        error: 'agent_failed',
        detail: message,
      });
      return null;
    }
  }

  private resolveAgentDispatchName(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    const agentName = raw.trim();
    if (!agentName) return '';
    return AGENT_DISPATCH_ALIASES[agentName.toLowerCase()] ?? agentName;
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private shouldFallbackToAgentResult(text: string): boolean {
    return (
      /couldn'?t\s+finish/i.test(text) ||
      /unable\s+to\s+complete/i.test(text) ||
      /iteration\s+budget/i.test(text) ||
      /ran\s+out\s+of\s+time/i.test(text) ||
      /try\s+a\s+smaller\s+question/i.test(text)
    );
  }

  private requiredActionToolRetry(
    userMessage: string | undefined,
    successfulToolResults: { toolName: string; result: unknown }[],
  ): { key: string; content: string } | null {
    if (!this.userAskedForAppointmentCreation(userMessage)) return null;

    const hasSlot = successfulToolResults.some(
      (entry) => entry.toolName === 'find_available_slot',
    );
    const hasCustomer = successfulToolResults.some(
      (entry) =>
        entry.toolName === 'find_customer' || entry.toolName === 'get_customer',
    );
    const hasCar = successfulToolResults.some(
      (entry) => entry.toolName === 'find_car' || entry.toolName === 'get_car',
    );
    const hasCreate = successfulToolResults.some(
      (entry) => entry.toolName === 'create_appointment',
    );

    if (!hasSlot) {
      return {
        key: `appointment-slot:${hasCustomer}`,
        content:
          `The user asked to book or schedule an appointment. Do not answer with code, date-calculation snippets, or a final prose response yet. ` +
          `Call find_available_slot next using a concrete YYYY-MM-DD date computed from today's system date, durationMinutes 30 when the user did not specify duration, and the best appointment type you can infer.`,
      };
    }

    if (!hasCreate) {
      return {
        key: `appointment-create:${hasCustomer}:${hasCar}`,
        content:
          `You already have availability for a booking request. Do not stop at listing slots. ` +
          `Resolve the real customer and vehicle with find_customer/get_customer and find_car/get_car when needed, then call create_appointment with UUID customerId/carId values, scheduledAt from the chosen available slot, durationMinutes, and mechanicId when the slot returned one. ` +
          `The approval request will ask the user to confirm before anything is created.`,
      };
    }

    return null;
  }

  private resolveTaskUserMessage(
    currentUserMessage: string | undefined,
    llmMessages: LlmMessage[],
  ): string | undefined {
    if (currentUserMessage && !currentUserMessage.startsWith(RESUME_PREFIX)) {
      return currentUserMessage;
    }

    return [...llmMessages]
      .reverse()
      .find(
        (message) =>
          message.role === 'user' &&
          typeof message.content === 'string' &&
          !message.content.startsWith(RESUME_PREFIX),
      )?.content;
  }

  private shouldContinueWithCustomerApprovalEmailAfterPart(
    userMessage: string | undefined,
    pageContext: PageContext | undefined,
    lastToolName: string | null,
    successfulToolResults: { toolName: string; result: unknown }[],
  ): boolean {
    if (lastToolName !== 'add_job_part') return false;
    if (!userMessage) return false;
    if (!this.userAskedForJobCustomerApprovalEmail(userMessage, pageContext)) {
      return false;
    }
    return !successfulToolResults.some(
      (entry) => entry.toolName === 'send_job_customer_approval_email',
    );
  }

  private addCustomerApprovalEmailContinuationGuidance(
    messages: LlmMessage[],
  ): LlmMessage[] {
    return [
      ...messages,
      {
        role: 'system',
        content:
          'The user asked for a compound maintenance workflow: add a job part, then send the customer a maintenance approval email for the updated job. The part was already added. Do not call add_job_part again. Next call send_job_customer_approval_email using the same jobId from the completed add_job_part call.',
      },
    ];
  }

  private postProcessAssistantText(
    text: string,
    ctx: AssistantUserContext,
    successfulToolResults: { toolName: string; result: unknown }[],
  ): string {
    let out = this.fillEmptyReportDownloadText(text, successfulToolResults);
    out = this.correctSlotContradiction(out, successfulToolResults);
    out = this.rewriteInternalAgentRefusal(out, successfulToolResults);
    out = this.ensureAppointmentSlotNeedsConfirmation(
      out,
      ctx.turnState?.userMessage,
      successfulToolResults,
    );
    out = this.rewriteMissingInvoiceDetailsResponse(
      out,
      ctx.turnState?.userMessage,
      successfulToolResults,
    );
    out = this.fillEmptyDraftEmailText(
      out,
      ctx.turnState?.userMessage,
      successfulToolResults,
    );
    out = this.ensureDraftOnlyNoSendNotice(out, ctx.turnState?.userMessage);
    out = this.stripReasoningScaffold(out);
    out = this.stripInternalControlMessages(out);
    out = this.stripInternalAgentNames(out);
    out = this.stripWarningSymbols(out);
    out = this.scrubInternalIds(out, ctx.turnState?.userMessage);
    return out.trim();
  }

  private normaliseCreateInvoiceArgs(
    toolName: string,
    args: unknown,
    userMessage?: string,
  ): unknown {
    if (toolName !== 'create_invoice') return args;
    if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
    const a = args as Record<string, unknown>;
    if (!Array.isArray(a.lineItems)) return args;
    const rawLineItems = a.lineItems;

    const userMessageLines = this.parseInvoiceLineItemsFromText(userMessage);
    const canUsePositionalFallback =
      userMessageLines.length === rawLineItems.length;
    let lineItems = rawLineItems.map((item, index) => {
      const positionalFallback = canUsePositionalFallback
        ? userMessageLines[index]
        : null;
      return this.normaliseInvoiceLineItem(
        item,
        userMessageLines,
        positionalFallback,
      );
    });
    if (lineItems.some((item) => item === null)) {
      if (userMessageLines.length === 0) return args;
      const recovered = [...userMessageLines];
      const recoveredDescriptions = new Set(
        recovered.map((item) =>
          this.normaliseInvoiceDescription(item.description),
        ),
      );
      for (const item of lineItems) {
        if (!this.isNormalisedInvoiceLineItem(item)) continue;
        const description = this.normaliseInvoiceDescription(item.description);
        if (recoveredDescriptions.has(description)) continue;
        recovered.push(item);
        recoveredDescriptions.add(description);
      }
      lineItems = recovered;
    }

    const normalised: Record<string, unknown> = { ...a, lineItems };
    if (
      typeof normalised._expectedConfirmation !== 'string' ||
      normalised._expectedConfirmation.trim().length === 0
    ) {
      const hasPrices = lineItems.every((item) => {
        const line = item as { quantity?: unknown; unitPrice?: unknown };
        return (
          typeof line.quantity === 'number' &&
          Number.isFinite(line.quantity) &&
          typeof line.unitPrice === 'number' &&
          Number.isFinite(line.unitPrice)
        );
      });
      if (!hasPrices) return normalised;
      const total = lineItems.reduce<number>((sum, item) => {
        const line = item as { quantity: number; unitPrice: number };
        return sum + line.quantity * line.unitPrice;
      }, 0);
      normalised._expectedConfirmation = `${total.toFixed(2)} TND`;
    }
    return normalised;
  }

  private normaliseRecordPaymentArgs(
    toolName: string,
    args: unknown,
    userMessage?: string,
  ): unknown {
    if (toolName !== 'record_payment') return args;
    if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
    const a = args as Record<string, unknown>;
    const out: Record<string, unknown> = { ...a };
    const invoiceId =
      typeof out.invoiceId === 'string' ? out.invoiceId.trim() : '';
    if (invoiceId) {
      out.invoiceId = invoiceId;
    }

    if (typeof out.amount === 'string') {
      const amount = this.parsePaymentAmount(out.amount);
      if (amount !== null) {
        out.amount = amount;
      }
    }

    if (typeof out._expectedConfirmation !== 'string') {
      const invoiceRef = this.parseInvoiceIdentifier(userMessage);
      if (invoiceRef) {
        out._expectedConfirmation = invoiceRef;
      }
    }

    if (typeof out.method === 'string') {
      const method = this.normalisePaymentMethod(out.method);
      if (method) {
        out.method = method;
      }
    }

    return out;
  }

  private recoverRecordPaymentArgsFromContext(
    toolName: string,
    args: unknown,
    errors: string[],
    userMessage: string | undefined,
    successfulToolResults: { toolName: string; result: unknown }[],
  ): unknown | null {
    if (toolName !== 'record_payment') return null;
    if (!args || typeof args !== 'object' || Array.isArray(args)) return null;

    const hasInvoiceIdError = /invoiceId/i.test(errors.join(' '));
    const hasAmountError = /amount/i.test(errors.join(' '));
    const hasMethodError = /method/i.test(errors.join(' '));
    if (!hasInvoiceIdError && !hasAmountError && !hasMethodError) {
      return null;
    }

    const original = args as Record<string, unknown>;
    const recovered: Record<string, unknown> = { ...original };
    let changed = false;

    const explicitInvoiceRef = this.parseInvoiceIdentifier(userMessage);
    const invoiceRef = explicitInvoiceRef
      ? this.stripPunctuation(explicitInvoiceRef)
      : '';
    const resolvedInvoice = this.findInvoiceResultRecord(
      successfulToolResults,
      invoiceRef,
    );

    if (
      hasInvoiceIdError &&
      (typeof recovered.invoiceId !== 'string' ||
        !UUID_PATTERN.test(recovered.invoiceId))
    ) {
      if (resolvedInvoice?.id) {
        recovered.invoiceId = resolvedInvoice.id;
        changed = true;
      }
    }

    if (
      hasAmountError &&
      (typeof recovered.amount !== 'number' ||
        !Number.isFinite(recovered.amount))
    ) {
      const amountFromMessage = this.parsePaymentAmount(userMessage);
      if (amountFromMessage !== null) {
        recovered.amount = amountFromMessage;
        changed = true;
      }
    }

    if (hasMethodError && typeof recovered.method !== 'string') {
      const normalisedMethod = this.extractPaymentMethodFromText(userMessage);
      if (normalisedMethod) {
        recovered.method = normalisedMethod;
        changed = true;
      }
    }

    if (
      (typeof recovered._expectedConfirmation !== 'string' ||
        recovered._expectedConfirmation.trim().length === 0) &&
      resolvedInvoice?.invoiceNumber
    ) {
      recovered._expectedConfirmation = resolvedInvoice.invoiceNumber;
      changed = true;
    }
    if (
      !changed &&
      typeof recovered.invoiceId === 'string' &&
      !UUID_PATTERN.test(recovered.invoiceId) &&
      invoiceRef
    ) {
      const parsed = this.parseInvoiceIdentifier(invoiceRef);
      if (parsed) {
        recovered._expectedConfirmation = parsed;
        changed = true;
      }
    }

    return changed ? recovered : null;
  }

  private recoverCreateInvoiceArgsFromContext(
    toolName: string,
    args: unknown,
    errors: string[],
    userMessage: string | undefined,
    successfulToolResults: { toolName: string; result: unknown }[],
  ): unknown | null {
    if (toolName !== 'create_invoice') return null;
    if (!args || typeof args !== 'object' || Array.isArray(args)) return null;
    if (
      !errors.some((error) => /customerId|carId|lineItems|uuid/i.test(error))
    ) {
      return null;
    }

    const userMessageLines = this.parseInvoiceLineItemsFromText(userMessage);
    if (userMessageLines.length === 0) return null;

    const original = args as Record<string, unknown>;
    const recovered: Record<string, unknown> = { ...original };
    let changed = false;

    if (
      typeof recovered.customerId !== 'string' ||
      !UUID_PATTERN.test(recovered.customerId)
    ) {
      const customer = this.findResultRecord(successfulToolResults, [
        'find_customer',
        'get_customer',
      ]);
      if (customer?.id && UUID_PATTERN.test(customer.id)) {
        recovered.customerId = customer.id;
        changed = true;
      }
    }

    if (
      typeof recovered.carId !== 'string' ||
      !UUID_PATTERN.test(recovered.carId)
    ) {
      const car = this.findResultRecord(successfulToolResults, [
        'find_car',
        'get_car',
      ]);
      if (car?.id && UUID_PATTERN.test(car.id)) {
        recovered.carId = car.id;
        changed = true;
      }
    }

    if (errors.some((error) => /lineItems/i.test(error))) {
      recovered.lineItems = userMessageLines;
      changed = true;
    }

    if (
      typeof recovered._expectedConfirmation !== 'string' ||
      recovered._expectedConfirmation.trim().length === 0
    ) {
      const total = userMessageLines.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      recovered._expectedConfirmation = `${total.toFixed(2)} TND`;
      changed = true;
    }

    return changed ? recovered : null;
  }

  private findInvoiceResultRecord(
    successfulToolResults: { toolName: string; result: unknown }[],
    invoiceIdentifier?: string,
  ): { id?: string; invoiceNumber?: string } | null {
    const invoiceTools = ['create_invoice', 'get_invoice', 'list_invoices'];
    const allowed = new Set(invoiceTools);
    const wanted = invoiceIdentifier?.trim().toLowerCase();
    const records: Array<{ id?: string; invoiceNumber?: string }> = [];
    for (const entry of [...successfulToolResults].reverse()) {
      if (!allowed.has(entry.toolName)) continue;
      const raw = entry.result;
      const candidates = Array.isArray(raw) ? raw : [raw];
      for (const candidate of candidates) {
        const extracted = this.extractInvoiceRecordsFromResult(candidate);
        records.push(...extracted);
      }
    }

    if (wanted) {
      const exact = records.find(
        (record) =>
          record.id?.toLowerCase() === wanted ||
          record.invoiceNumber?.toLowerCase() === wanted,
      );
      if (exact) return exact;
    }

    for (let i = 0; i < records.length; i += 1) {
      const record = records[i];
      if (record.id && UUID_PATTERN.test(record.id)) return record;
    }

    return null;
  }

  private extractInvoiceRecordsFromResult(
    result: unknown,
  ): { id?: string; invoiceNumber?: string }[] {
    if (!result || typeof result !== 'object') return [];
    const out: { id?: string; invoiceNumber?: string }[] = [];
    const candidates = Array.isArray(result) ? result : [result];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      const record = candidate as Record<string, unknown>;
      const nested = record.invoices;
      if (Array.isArray(nested)) {
        for (const nestedCandidate of nested) {
          if (!nestedCandidate || typeof nestedCandidate !== 'object') continue;
          const invoice = nestedCandidate as Record<string, unknown>;
          const id =
            typeof invoice.id === 'string'
              ? invoice.id
              : typeof invoice.invoiceId === 'string'
                ? invoice.invoiceId
                : undefined;
          out.push({
            id,
            invoiceNumber:
              typeof invoice.invoiceNumber === 'string'
                ? invoice.invoiceNumber
                : undefined,
          });
        }
      } else if (
        typeof record.id === 'string' ||
        typeof record.invoiceId === 'string'
      ) {
        out.push({
          id:
            typeof record.id === 'string'
              ? record.id
              : (record.invoiceId as string),
          invoiceNumber:
            typeof record.invoiceNumber === 'string'
              ? record.invoiceNumber
              : undefined,
        });
      }
    }
    return out;
  }

  private findResultRecord(
    successfulToolResults: { toolName: string; result: unknown }[],
    toolNames: string[],
  ): { id?: string; customerId?: string } | null {
    const allowed = new Set(toolNames);
    for (const entry of [...successfulToolResults].reverse()) {
      if (!allowed.has(entry.toolName)) continue;
      const candidates = Array.isArray(entry.result)
        ? entry.result
        : [entry.result];
      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object') continue;
        const record = candidate as Record<string, unknown>;
        if (typeof record.id !== 'string') continue;
        return {
          id: record.id,
          customerId:
            typeof record.customerId === 'string'
              ? record.customerId
              : undefined,
        };
      }
    }
    return null;
  }

  private normaliseInvoiceLineItem(
    raw: unknown,
    userMessageLines: {
      description: string;
      quantity: number;
      unitPrice: number;
    }[],
    positionalFallback: {
      description: string;
      quantity: number;
      unitPrice: number;
    } | null,
  ): unknown {
    if (typeof raw === 'string') {
      return (
        this.parseInvoiceLineItemString(raw) ??
        this.matchInvoiceLineFromUserMessage(raw, userMessageLines) ??
        positionalFallback
      );
    }

    if (Array.isArray(raw)) {
      return (
        this.parseInvoiceLineItemTuple(raw, userMessageLines) ??
        positionalFallback
      );
    }

    if (raw && typeof raw === 'object') {
      return this.normaliseInvoiceLineItemObject(raw) ?? positionalFallback;
    }

    return positionalFallback;
  }

  private isNormalisedInvoiceLineItem(raw: unknown): raw is {
    description: string;
    quantity: number;
    unitPrice: number;
  } {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const item = raw as Record<string, unknown>;
    return (
      typeof item.description === 'string' &&
      item.description.trim().length > 0 &&
      typeof item.quantity === 'number' &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0 &&
      typeof item.unitPrice === 'number' &&
      Number.isFinite(item.unitPrice) &&
      item.unitPrice >= 0
    );
  }

  private normaliseInvoiceLineItemObject(raw: object): unknown {
    const item = raw as Record<string, unknown>;
    const description =
      typeof item.description === 'string'
        ? item.description.replace(/\s+/g, ' ').trim()
        : '';
    const quantity = this.parseInvoiceNumber(item.quantity);
    const unitPrice = this.parseInvoiceNumber(item.unitPrice);
    if (
      !description ||
      quantity === null ||
      quantity <= 0 ||
      unitPrice === null ||
      unitPrice < 0
    ) {
      return null;
    }

    return {
      ...item,
      description,
      quantity,
      unitPrice,
    };
  }

  private parseInvoiceNumber(raw: unknown): number | null {
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? raw : null;
    }
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) return null;
    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parsePaymentAmount(raw: unknown): number | null {
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? raw : null;
    }
    if (typeof raw !== 'string') return null;

    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return null;
    if (trimmed === 'undefined' || trimmed === 'null') return null;

    const withCurrency =
      trimmed.match(/(\d+(?:[.,]\d+)?)\s*(?:tnd|dt)\b/i)?.[1] ??
      trimmed.match(
        /(?:amount|total|pay|paid|for)\s*(?:of|=|:)?\s*(\d+(?:[.,]\d+)?)\s*(?:tnd|dt)\b/i,
      )?.[1];
    if (withCurrency) {
      const parsed = Number(withCurrency.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (/^[0-9]+(?:[.,][0-9]+)?$/.test(trimmed)) {
      const parsed = Number(trimmed.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private normalisePaymentMethod(raw: string): string | null {
    const value = raw.trim().toLowerCase();
    if (!value || value === 'undefined' || value === 'null') return null;

    if (value === 'cash') return 'CASH';
    if (value === 'card' || value === 'credit card' || value === 'debit card') {
      return 'CARD';
    }
    if (
      value === 'bank transfer' ||
      value === 'bank_transfer' ||
      value === 'bankwire' ||
      value === 'transfer' ||
      value === 'wire transfer'
    ) {
      return 'BANK_TRANSFER';
    }
    if (value === 'check' || value === 'cheque' || value === 'chq') {
      return 'CHECK';
    }
    if (
      value === 'mobile payment' ||
      value === 'mobile_payment' ||
      value === 'mobile' ||
      value === 'mobile money'
    ) {
      return 'MOBILE_PAYMENT';
    }
    if (
      ['cash', 'card', 'bank transfer', 'check', 'mobile payment'].includes(
        value,
      )
    ) {
      return value.toUpperCase().replace(' ', '_');
    }
    if (value === 'bank_transfer' || value === 'mobile_payment') {
      return value.toUpperCase();
    }
    return null;
  }

  private extractPaymentMethodFromText(
    text: string | undefined,
  ): string | null {
    if (!text) return null;
    const lowered = text.toLowerCase();
    const matches = [
      /(cash|in cash|by cash|espèces|espece)/i,
      /(credit card|debit card|card|by card|carte)/i,
      /(bank transfer|bank_transfer|wire transfer|transfer|virement)/i,
      /(mobile payment|mobile_payment|mobile money|mobile)/i,
      /(cheque|check|chèque)/i,
    ];
    const normalized = [
      'CASH',
      'CARD',
      'BANK_TRANSFER',
      'MOBILE_PAYMENT',
      'CHECK',
    ];
    for (let i = 0; i < matches.length; i += 1) {
      if (matches[i].test(lowered)) return normalized[i];
    }
    return null;
  }

  private parseInvoiceIdentifier(text: string | undefined): string | null {
    if (!text) return null;
    const match = text.match(/\bINV-[A-Z0-9][A-Z0-9-]*[0-9]\b/gi);
    return match?.[0]?.trim() ?? null;
  }

  private stripPunctuation(raw: string): string {
    return raw.replace(/[`"'\u2018\u2019\(\)\[\]]/g, '').trim();
  }

  private parseInvoiceLineItemString(
    raw: string,
  ): { description: string; quantity: number; unitPrice: number } | null {
    const trimmed = raw.trim();
    const atForMatch = trimmed.match(
      /^\s*(\d+(?:[.,]\d+)?)\s+(.+?)\s+(?:at|@|for)\s+(\d+(?:[.,]\d+)?)\s*(?:tnd|dt)\b/i,
    );
    if (atForMatch) {
      return this.buildParsedInvoiceLine(
        atForMatch[1],
        atForMatch[2],
        atForMatch[3],
      );
    }

    const quantityLabelMatch = trimmed.match(
      /^\s*(?:for\s+)?(.+?)\s*,?\s*(?:quantity|qty)\s+(\d+(?:[.,]\d+)?)\s*,?\s*(?:unit\s*price|price)\s+(\d+(?:[.,]\d+)?)\s*(?:tnd|dt)\b/i,
    );
    if (quantityLabelMatch) {
      return this.buildParsedInvoiceLine(
        quantityLabelMatch[2],
        quantityLabelMatch[1],
        quantityLabelMatch[3],
      );
    }
    return null;
  }

  private buildParsedInvoiceLine(
    rawQuantity: string,
    rawDescription: string,
    rawUnitPrice: string,
  ): { description: string; quantity: number; unitPrice: number } | null {
    const quantity = Number(rawQuantity.replace(',', '.'));
    const description = rawDescription
      .replace(/^.*\b(?:line|item)\s*:\s*/i, '')
      .replace(/\bHT\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const unitPrice = Number(rawUnitPrice.replace(',', '.'));
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !description ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      return null;
    }
    const parsed: {
      description: string;
      quantity: number;
      unitPrice: number;
      tvaRate?: number;
    } = { description, quantity, unitPrice };
    const tvaMatch = rawDescription.match(
      /\b(?:TVA|VAT)\s*(\d+(?:[.,]\d+)?)\s*%/i,
    );
    if (tvaMatch) {
      const tvaRate = Number(tvaMatch[1].replace(',', '.'));
      if (Number.isFinite(tvaRate)) parsed.tvaRate = tvaRate;
    }
    return parsed;
  }

  private parseInvoiceLineItemTuple(
    raw: unknown[],
    userMessageLines: {
      description: string;
      quantity: number;
      unitPrice: number;
    }[],
  ): { description: string; quantity: number; unitPrice: number } | null {
    const textParts = raw
      .filter((value) => typeof value === 'string')
      .map((value) => String(value).trim())
      .filter(Boolean);
    const numericParts = raw
      .map((value) =>
        typeof value === 'number'
          ? value
          : typeof value === 'string' && /^\d+(?:[.,]\d+)?$/.test(value.trim())
            ? Number(value.trim().replace(',', '.'))
            : null,
      )
      .filter((value): value is number => value !== null);
    const description = textParts
      .join(' ')
      .replace(/\b(?:tnd|dt|ht)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (description && numericParts.length >= 2) {
      const quantity = numericParts[0];
      const unitPrice = numericParts[numericParts.length - 1];
      return this.buildParsedInvoiceLine(
        String(quantity),
        description,
        String(unitPrice),
      );
    }

    if (description) {
      return this.matchInvoiceLineFromUserMessage(
        description,
        userMessageLines,
      );
    }
    return null;
  }

  private parseInvoiceLineItemsFromText(
    text: string | undefined,
  ): { description: string; quantity: number; unitPrice: number }[] {
    if (!text) return [];
    const lines: {
      description: string;
      quantity: number;
      unitPrice: number;
    }[] = [];
    const pattern =
      /(?:^|[.,;]|\bwith\b|\band\b)\s*(\d+(?:[.,]\d+)?)\s+(.+?)\s+(?:at|@|for)\s+(\d+(?:[.,]\d+)?)\s*(?:tnd|dt)\b/gi;
    for (const match of text.matchAll(pattern)) {
      const parsed = this.buildParsedInvoiceLine(match[1], match[2], match[3]);
      if (parsed) lines.push(parsed);
    }
    const structuredPattern =
      /(?:^|[.;]|\bwith\b|\band\b|:)\s*(?:line\s*\d+\s*:\s*)?([^.;:\n]+?)\s*,?\s*(?:quantity|qty)\s+(\d+(?:[.,]\d+)?)\s*,?\s*(?:unit\s*price|price)\s+(\d+(?:[.,]\d+)?)\s*(?:tnd|dt)\b(?:\s*HT)?(?:\s*,?\s*(?:TVA|VAT)\s*(\d+(?:[.,]\d+)?)\s*%)?/gi;
    for (const match of text.matchAll(structuredPattern)) {
      const parsed = this.buildParsedInvoiceLine(match[2], match[1], match[3]);
      if (parsed && match[4]) {
        const tvaRate = Number(match[4].replace(',', '.'));
        if (Number.isFinite(tvaRate)) {
          (parsed as { tvaRate?: number }).tvaRate = tvaRate;
        }
      }
      if (parsed) lines.push(parsed);
    }
    return lines;
  }

  private matchInvoiceLineFromUserMessage(
    rawLineItem: string,
    userMessageLines: {
      description: string;
      quantity: number;
      unitPrice: number;
    }[],
  ): { description: string; quantity: number; unitPrice: number } | null {
    const wanted = this.normaliseInvoiceDescription(rawLineItem);
    if (!wanted) return null;
    return (
      userMessageLines.find((line) => {
        const candidate = this.normaliseInvoiceDescription(line.description);
        return candidate.includes(wanted) || wanted.includes(candidate);
      }) ?? null
    );
  }

  private normaliseInvoiceDescription(raw: string): string {
    return raw
      .replace(/^\s*\d+(?:[.,]\d+)?\s+/, '')
      .replace(/\s+(?:at|@|for)\s+\d+(?:[.,]\d+)?\s*(?:tnd|dt)\b.*$/i, '')
      .replace(/\bHT\b/gi, '')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toLowerCase();
  }

  private correctSlotContradiction(
    text: string,
    successfulToolResults: { toolName: string; result: unknown }[],
  ): string {
    const slotResults = successfulToolResults
      .filter((entry) => entry.toolName === 'find_available_slot')
      .map((entry) => entry.result as { slots?: unknown[] })
      .filter(
        (result) => Array.isArray(result.slots) && result.slots.length > 0,
      );
    const latest = slotResults[slotResults.length - 1];
    if (!latest?.slots?.length) return text;
    if (
      !/\b(no|none|not any|couldn'?t find|cannot find|unable to find|not able to find|not able to execute)\b[\s\S]{0,100}\b(slot|availability|available|task|request|service)\b/i.test(
        text,
      )
    ) {
      return text;
    }

    return `I found available slots:\n${this.formatSlotBullets(latest.slots)}`;
  }

  private fillEmptyReportDownloadText(
    text: string,
    successfulToolResults: { toolName: string; result: unknown }[],
  ): string {
    const report = [...successfulToolResults]
      .reverse()
      .find(
        (entry) =>
          (entry.toolName === 'generate_invoices_pdf' ||
            entry.toolName === 'generate_period_report') &&
          typeof (entry.result as { url?: unknown }).url === 'string',
      );
    if (!report) return text;
    const result = report.result as {
      url: string;
      expiresAt?: string;
      invoiceCount?: number;
      period?: string;
      format?: string;
    };
    const misleadingReportFailure =
      /\b(?:no data available|report (?:is )?unavailable|not able to generate|unable to generate|cannot generate|could not generate)\b/i.test(
        text,
      );
    if (!misleadingReportFailure && text.includes(result.url)) return text;
    const noun =
      report.toolName === 'generate_invoices_pdf'
        ? `invoice PDF${result.invoiceCount ? ` for ${result.invoiceCount} invoice(s)` : ''}`
        : `${result.period ?? 'period'} ${result.format ?? 'report'} report`;
    const expiry = result.expiresAt
      ? ` It expires at ${result.expiresAt}.`
      : '';
    if (text.trim().length === 0 || misleadingReportFailure) {
      return `Done. Download the ${noun} here: ${result.url}.${expiry}`;
    }
    return `${text.trim()} Download it here: ${result.url}.${expiry}`;
  }

  private ensureAppointmentSlotNeedsConfirmation(
    text: string,
    userMessage: string | undefined,
    successfulToolResults: { toolName: string; result: unknown }[],
  ): string {
    if (!this.userAskedForAppointmentCreation(userMessage)) return text;
    if (
      successfulToolResults.some(
        (entry) => entry.toolName === 'create_appointment',
      )
    ) {
      return text;
    }
    const hasSlots = successfulToolResults.some(
      (entry) =>
        entry.toolName === 'find_available_slot' &&
        Array.isArray((entry.result as { slots?: unknown[] }).slots) &&
        ((entry.result as { slots?: unknown[] }).slots?.length ?? 0) > 0,
    );
    if (!hasSlots) return text;
    if (
      /\bI found available slots\b/i.test(text) &&
      /\bdid not create an appointment\b/i.test(text)
    ) {
      return text;
    }
    const latestSlotResult = [...successfulToolResults]
      .reverse()
      .find(
        (entry) =>
          entry.toolName === 'find_available_slot' &&
          Array.isArray((entry.result as { slots?: unknown[] }).slots) &&
          ((entry.result as { slots?: unknown[] }).slots?.length ?? 0) > 0,
      )?.result as { slots?: unknown[] } | undefined;
    if (!latestSlotResult?.slots?.length) return text;
    return (
      `I found available slots:\n${this.formatSlotBullets(latestSlotResult.slots)}\n\n` +
      `I did not create an appointment yet. Please confirm the customer and vehicle, then I can show the approval request.`
    );
  }

  private fillEmptyDraftEmailText(
    text: string,
    userMessage: string | undefined,
    successfulToolResults: { toolName: string; result: unknown }[],
  ): string {
    if (text.trim().length > 0) return text;
    if (!this.userAskedForDraftOnly(userMessage)) return text;
    const overdue = [...successfulToolResults]
      .reverse()
      .find(
        (entry) =>
          entry.toolName === 'list_overdue_invoices' &&
          Array.isArray((entry.result as { invoices?: unknown[] }).invoices),
      );
    if (!overdue) return text;
    const result = overdue.result as {
      invoices?: {
        invoiceNumber?: string;
        customerName?: string;
        customerPhone?: string | null;
        total?: number;
        daysOverdue?: number;
      }[];
      count?: number;
      totalOutstanding?: number;
    };
    const invoices = result.invoices ?? [];
    const count =
      typeof result.count === 'number' ? result.count : invoices.length;
    const total =
      typeof result.totalOutstanding === 'number'
        ? result.totalOutstanding
        : invoices.reduce(
            (sum, invoice) =>
              sum + (typeof invoice.total === 'number' ? invoice.total : 0),
            0,
          );

    if (count === 0) {
      return (
        `No email was sent.\n\n` +
        `Subject: Overdue invoices\n\n` +
        `Body:\n` +
        `Hi,\n\n` +
        `There are currently no overdue invoices.\n\n` +
        `Regards,`
      );
    }

    const examples = invoices
      .slice(0, 3)
      .map((invoice) => {
        const number = invoice.invoiceNumber ?? 'Invoice';
        const customer = invoice.customerName ?? 'Unknown customer';
        const phone = invoice.customerPhone ? `, ${invoice.customerPhone}` : '';
        const amount =
          typeof invoice.total === 'number'
            ? `, ${this.formatTndAmount(invoice.total)}`
            : '';
        const days =
          typeof invoice.daysOverdue === 'number'
            ? `, ${invoice.daysOverdue} day(s) overdue`
            : '';
        return `- ${number} - ${customer}${phone}${amount}${days}`;
      })
      .join('\n');
    const examplesSection = examples
      ? `\n\nOldest overdue invoices:\n${examples}`
      : '';

    return (
      `No email was sent.\n\n` +
      `Subject: Overdue invoices\n\n` +
      `Body:\n` +
      `Hi,\n\n` +
      `Here is the current overdue invoice summary:\n` +
      `- ${count} overdue invoice(s)\n` +
      `- Total outstanding: ${this.formatTndAmount(total)}` +
      `${examplesSection}\n\n` +
      `Please review these invoices and follow up with the customers.\n\n` +
      `Regards,`
    );
  }

  private ensureDraftOnlyNoSendNotice(
    text: string,
    userMessage: string | undefined,
  ): string {
    if (text.trim().length === 0) return text;
    if (!this.userAskedForDraftOnly(userMessage)) return text;
    if (/\bno (?:email|message) was sent\b/i.test(text)) return text;
    return `No email was sent.\n\n${text.trim()}`;
  }

  private stripReasoningScaffold(text: string): string {
    const marker = text.match(/the final answer is:\s*/i);
    let out = marker
      ? text.slice((marker.index ?? 0) + marker[0].length)
      : text;
    const finalAnswerLinePatterns = [
      /^(?:#+\s*)?Compile (?:the )?(?:daily )?briefing\.?\s*$/i,
      /^(?:#+\s*)?Summari[sz]e the results in the required format\.?\s*$/i,
    ];
    const lines = out.split('\n');
    const finalAnswerLineIndex = lines.findIndex((line) =>
      finalAnswerLinePatterns.some((pattern) => pattern.test(line.trim())),
    );
    if (finalAnswerLineIndex >= 0) {
      out = lines.slice(finalAnswerLineIndex + 1).join('\n');
    }
    out = out.replace(/^(#+\s*)Step\s+\d+\s*:\s*/gim, '$1');
    out = out.replace(/^Step\s+\d+\s*:\s*/gim, '');
    return out;
  }

  private rewriteInternalAgentRefusal(
    text: string,
    successfulToolResults: { toolName: string; result: unknown }[],
  ): string {
    if (!/\borchestrator\b|agent cannot perform write actions/i.test(text)) {
      return text;
    }
    const slotResults = successfulToolResults
      .filter((entry) => entry.toolName === 'find_available_slot')
      .map((entry) => entry.result as { slots?: unknown[] })
      .filter(
        (result) => Array.isArray(result.slots) && result.slots.length > 0,
      );
    const latest = slotResults[slotResults.length - 1];
    if (!latest?.slots?.length) {
      return text.replace(/\borchestrator\b/gi, 'assistant');
    }

    return (
      `I found available slots:\n${this.formatSlotBullets(latest.slots)}\n\n` +
      `I did not create an appointment yet. Please confirm the customer and vehicle, then I can show the approval request.`
    );
  }

  private rewriteMissingInvoiceDetailsResponse(
    text: string,
    userMessage: string | undefined,
    successfulToolResults: { toolName: string; result: unknown }[],
  ): string {
    if (!this.userAskedForInvoiceCreation(userMessage)) return text;
    if (
      successfulToolResults.some((entry) => entry.toolName === 'create_invoice')
    ) {
      return text;
    }
    if (!this.userMessageLacksInvoicePrices(userMessage)) return text;
    if (
      !/\binvoice\b/i.test(text) ||
      !/(unable|failed|confirm|proceed|create|prepare|amount|total|tnd)/i.test(
        text,
      )
    ) {
      return text;
    }

    const itemHint = this.extractInvoiceLineItemHint(userMessage);
    const itemText = itemHint ? ` for ${itemHint}` : '';
    return (
      `I found the customer, but I did not create the invoice. ` +
      `Please provide the quantity and HT unit price for each line item${itemText}. ` +
      `Once you provide those, I can prepare the invoice for approval.`
    );
  }

  private stripWarningSymbols(text: string): string {
    return text.replace(/(^|\n)\s*\u26a0\ufe0f?\s*/g, '$1');
  }

  private formatSlotBullets(slots: unknown[]): string {
    return slots
      .slice(0, 3)
      .map((slot) => {
        const s = slot as {
          start?: string;
          end?: string;
          mechanicName?: string | null;
        };
        const start = this.formatUtcDateTime(s.start);
        const end = this.formatUtcTime(s.end);
        const mechanic = s.mechanicName ? ` with ${s.mechanicName}` : '';
        return `- ${start}${end ? `-${end}` : ''}${mechanic}`;
      })
      .join('\n');
  }

  private stripInternalControlMessages(text: string): string {
    return text
      .replace(
        /(^|\n)\s*(?:[^\w\s"']+(?:\s+|$))*["'\u201c]?Refusing to dispatch another agent\s*[-\u2013\u2014]\s*already invoked\s+\d+\s+time\(s\)\s+this turn\.\s+Compose your final reply from the agent results above\.["'\u201d]?\s*/gi,
        '$1',
      )
      .replace(
        /(^|\n)\s*(?:[^\w\s"']+(?:\s+|$))*Error:\s*agent_dispatch_capped\.?\s*/gi,
        '$1',
      );
  }

  private stripInternalAgentNames(text: string): string {
    return text
      .replace(/\bBest,\s*[A-Z][A-Za-z]+Agent\b/g, 'Best, the garage team')
      .replace(
        /\b(?:Analytics|Communications|Finance|Growth|Inventory|Scheduling)Agent\b/g,
        'assistant',
      );
  }

  private scrubInternalIds(
    text: string,
    userMessage: string | undefined,
  ): string {
    if (this.userAskedForTechnicalIds(userMessage)) return text;

    const technicalLabelLine =
      /^\s*[-*]?\s*(locked by|locked at|created at|updated at|issued number|customer id|car id|invoice id|appointment id|toolcallid|tool call id)\s*:/i;
    return text
      .split('\n')
      .filter((line) => {
        const assistantDownloadUrl =
          /\/api\/assistant\/downloads\/[0-9a-f-]+\.(?:pdf|csv)\b/i.test(line);
        return (
          assistantDownloadUrl ||
          (!technicalLabelLine.test(line) &&
            !UUID_PATTERN.test(line.trim()) &&
            !UUID_IN_TEXT_PATTERN.test(line) &&
            !UUID_FRAGMENT_IN_TEXT_PATTERN.test(line))
        );
      })
      .join('\n');
  }

  private userAskedForTechnicalIds(userMessage: string | undefined): boolean {
    return /\b(uuid|technical id|technical ids|database id|database ids|raw id|raw ids|internal id|internal ids|customer id|invoice id|appointment id)\b/i.test(
      userMessage ?? '',
    );
  }

  private formatUtcDateTime(value: string | undefined): string {
    if (!value) return 'available time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  private formatUtcTime(value: string | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  private formatTndAmount(value: number): string {
    return `${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} TND`;
  }

  private async filterToolsByIntent(
    userMessage: string,
    ctx: AssistantUserContext,
    conversationId: string,
    pageContext: PageContext | undefined,
    allRealTools: ToolDescriptor[],
  ): Promise<ToolDescriptor[]> {
    if (allRealTools.length === 0) return allRealTools;

    const candidates = allRealTools.map((t) => ({
      name: t.name,
      description: t.description,
    }));

    const picked = await this.classifier.classify({
      userMessage,
      locale: ctx.locale,
      candidates,
      usageContext: {
        conversationId,
        garageId: ctx.garageId,
        userId: ctx.userId,
      },
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
    if (this.userAskedForJobCustomerApprovalEmail(userMessage, pageContext)) {
      augmented.add('send_job_customer_approval_email');
      augmented.add('get_job');
      augmented.delete('send_email');
    }
    if (
      this.userAskedForServiceHistory(userMessage) &&
      !this.userAskedForInvoiceData(userMessage)
    ) {
      augmented.delete('list_invoices');
      augmented.delete('list_overdue_invoices');
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
    const asksForReportDownload = this.userAskedForReportDownload(message);
    if (asksForReportDownload) {
      out.push('generate_period_report');
    }
    if (
      !asksForReportDownload &&
      (/\b(?:create|make|issue|generate|prepare)\b[\s\S]{0,60}\binvoice\b/i.test(
        message,
      ) ||
        /\binvoice\b[\s\S]{0,60}\b(?:for|to)\b/i.test(message))
    ) {
      out.push('create_invoice');
      out.push('find_customer');
      out.push('get_customer');
      out.push('find_car');
    }
    if (this.userAskedForAppointmentCreation(message)) {
      out.push('find_available_slot');
      out.push('create_appointment');
      out.push('find_customer');
      out.push('get_customer');
      out.push('find_car');
      out.push('get_car');
    }
    if (
      this.userAskedForCarDetails(message) ||
      this.userAskedForServiceHistory(message)
    ) {
      out.push('find_customer');
      out.push('get_customer');
      out.push('find_car');
      out.push('get_car');
    }
    if (this.userAskedForServiceHistory(message)) {
      out.push('list_appointments');
    }
    return out;
  }

  private userAskedForJobCustomerApprovalEmail(
    message: string,
    pageContext: PageContext | undefined,
  ): boolean {
    const asksToEmail =
      /\bemail\s+(?!(?:address|account|settings)\b)\w+/i.test(message) ||
      /\bsend\s+(?:\w+\s+)*(?:an?\s+)?e-?mails?\b/i.test(message) ||
      /\b(via|by)\s+e-?mail\b/i.test(message);
    if (!asksToEmail) return false;

    const mentionsCustomer = /\b(customer|client)\b/i.test(message);
    const mentionsJob =
      /\b(job|maintenance|approval|approve|parts?|labor|estimate|quote|quotation|devis)\b/i.test(
        message,
      );
    if (mentionsCustomer && mentionsJob) return true;

    const selected =
      pageContext?.selectedEntity ??
      deriveSelectedEntityFromRoute(pageContext?.route, pageContext?.params);
    const selectedType = selected?.type.toLowerCase();
    const selectedMaintenanceJob =
      selectedType === 'maintenance' ||
      selectedType === 'maintenancejob' ||
      selectedType === 'maintenance_job';
    return selectedMaintenanceJob && mentionsCustomer;
  }

  private userAskedForCarDetails(message: string): boolean {
    return (
      /\b(?:car|vehicle|auto|voiture|véhicule)\b[\s\S]{0,50}\bdetails?\b/i.test(
        message,
      ) ||
      /\bdetails?\b[\s\S]{0,50}\b(?:car|vehicle|auto|voiture|véhicule)\b/i.test(
        message,
      )
    );
  }

  private userAskedForServiceHistory(message: string): boolean {
    return (
      /\b(?:completed|past|previous|recent|recorded)\s+(?:maintenance|service|repair)\s+(?:jobs?|work|visits?|appointments?|history|records?)\b/i.test(
        message,
      ) ||
      /\b(?:maintenance|service|repair)\s+(?:jobs?|history|records?|visits?|appointments?)\b/i.test(
        message,
      ) ||
      /\b(?:service|repair)\s+history\b/i.test(message) ||
      /\b(?:jobs?|work)\s+(?:completed|done)\b/i.test(message) ||
      /\bhistorique\s+(?:d['’]?\s*)?(?:entretien|maintenance|réparation)\b/i.test(
        message,
      ) ||
      /صيانة|إصلاح/.test(message)
    );
  }

  private userAskedForInvoiceData(message: string): boolean {
    return /\b(?:invoice|invoices|facture|factures|payment|payments|paid|unpaid|overdue|quote|credit note|devis|avoir)\b/i.test(
      message,
    );
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
      // downloadable reports
      {
        kws: [
          'pdf report',
          'csv report',
          'download report',
          'export report',
          'generate report',
          'report for',
        ],
        tools: ['generate_period_report'],
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

  /**
   * UI Bug 7 / N-001 — when the user is on a specific-entity detail page,
   * drop broad-scan tools from the tool list so the LLM cannot derail into
   * a garage-wide query (e.g. list_at_risk_customers from inside "tell me
   * about this customer"). The system-prompt nudge alone wasn't enough.
   *
   * The exclusion is conservative — only fire when there's an explicit
   * selectedEntity AND only drop tools whose name screams "broad scan".
   * Anything that takes an id arg (get_customer, get_invoice, find_*) is
   * left in place because those are still useful in scope.
   */
  private static readonly BROAD_SCAN_TOOLS: ReadonlySet<string> = new Set([
    'list_at_risk_customers',
    'list_top_customers',
    'list_returning_customers',
    'list_overdue_invoices',
    'list_low_stock_parts',
    'list_active_jobs',
    'list_maintenance_due',
    'get_dashboard_kpis',
    'get_revenue_summary',
    'get_invoices_summary',
    'get_customer_count',
    'get_inventory_value',
  ]);

  private isBroadScanTool(name: string): boolean {
    return OrchestratorService.BROAD_SCAN_TOOLS.has(name);
  }

  private hasSelectedEntity(pageContext: PageContext | undefined): boolean {
    return (
      !!pageContext?.selectedEntity ||
      !!deriveSelectedEntityFromRoute(pageContext?.route, pageContext?.params)
    );
  }

  private scopeToolsForPageContext(
    tools: ToolDescriptor[],
    pageContext: PageContext | undefined,
  ): ToolDescriptor[] {
    if (!this.hasSelectedEntity(pageContext)) return tools;
    const dropped: string[] = [];
    const filtered = tools.filter((t) => {
      if (this.isBroadScanTool(t.name)) {
        dropped.push(t.name);
        return false;
      }
      return true;
    });
    if (dropped.length > 0) {
      this.logger.debug(
        `assistant.scope.dropped_broad_scans count=${dropped.length} tools=${dropped.join(',')}`,
      );
    }
    return filtered;
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
        `- Present the final answer only. Do NOT narrate hidden reasoning or data-gathering steps as "Step 1", "Step 2", "Analyze the tool output", or similar process notes.\n` +
        `- Currency is Tunisian Dinar. Format amounts as "1,234.56 TND" (English) or "1 234,56 DT" (French). NEVER prefix with a currency symbol — no ₸, no د.ت, no $, no €. Just the number and the code.\n` +
        `- Round currency to 2 decimal places.\n` +
        `- Do NOT include internal database IDs (customerId, carId, appointmentId, invoice UUIDs, toolCallId, or raw UUIDs) unless the user explicitly asks for technical IDs. Use names, phone numbers, invoice numbers, license plates, dates, and amounts instead.\n` +
        `- NEVER write tool-call markup in your reply. Do NOT print JSON like \`{"type":"function","name":"...","arguments":...}\`, do NOT use \`<function=name>{...}</function>\` tags, and do NOT narrate "I will call tool X". Either invoke the tool through the structured tool-use channel (the assistant runtime executes it) or describe the result in plain prose. Tool-call JSON in your reply text is treated as a malformed response and discarded.`,
    );
    parts.push(
      `Action chaining rules:\n` +
        `- When the user asks you to email/send a report or summary, FIRST call the relevant read tool to fetch real data (e.g. list_invoices, get_revenue_summary, list_at_risk_customers), THEN call send_email with a body that includes those concrete numbers. Do NOT write placeholder bodies like "please find the data below" without the data inline.\n` +
        `- When the user asks to email a maintenance-job customer, send a parts/labor approval, or send an approval link for "this job", use send_job_customer_approval_email. That tool resolves the customer from the job, creates or reuses the public approval link, and sends to the customer's stored email. Do NOT use send_email for maintenance approval links.\n` +
        `- When the user asks to create, make, issue, generate, or prepare an invoice, resolve the real customer (and car if mentioned), then verify you have complete line-item data before calling create_invoice. Each line item must be an object with description, quantity, and HT unitPrice. If the user only gives service names like "oil change and filter" without prices, ask for the missing prices instead of guessing or calling create_invoice with placeholders. Do NOT call send_email unless the user explicitly asks to email an already-created invoice or report.\n` +
        `- For customer SMS actions, resolve the real customer first and pass that real customerId plus their actual phone number to send_sms. Do NOT invent phone numbers or placeholder ids.\n` +
        `- For customer/external email actions that are not maintenance approval links, use send_email with the exact ` +
        `email address the user provided. If the user named a customer instead of typing an address, resolve the real customer first and pass that real customerId plus their actual email in send_email.to. Do NOT fall back to the owner email for customer requests.\n` +
        `- NEVER claim "no data is available" / "data could not be retrieved" / "the report is unavailable" without having actually invoked the relevant read tool this turn. If you have not called a read tool yet, call it. If the tool returns empty, report the specific empty result ("0 overdue invoices", "no at-risk customers this period") — do NOT generalise to "no data".\n` +
        `- NEVER reference an attachment ("see attached", "please find the PDF attached", "ci-joint", "pièce jointe") in the email body unless you populate attachInvoiceIds with real invoice ids. The backend rejects emails that promise an attachment without one.\n` +
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
          `- For explicit retention-review requests like "Run a retention review", ` +
          `dispatch growth-agent first.\n` +
          `- Reserve dispatch_agent for multi-step analyses that genuinely benefit from ` +
          `a private scratchpad (retention reviews, cash-flow forecasts, audits). ` +
          `If a single tool can answer the question, do not dispatch.\n` +
          `- Never refuse by saying a request "requires a conversation" with a specialist ` +
          `agent. If a specialist agent is actually needed, call dispatch_agent. If direct ` +
          `tools are enough, call the tools directly. If a tool argument is invalid, correct ` +
          `the argument and retry once or explain the exact missing concrete value.`,
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
        deriveSelectedEntityFromRoute(pageContext.route, pageContext.params);
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
            `"this appointment", "this job", "that job", etc., they mean ` +
            `the entity in the "selected" ` +
            `field above. Pass that exact id to tools like get_customer / ` +
            `get_car / get_invoice — do NOT call find_* with the id as a query ` +
            `string, and do NOT ask the user for an id you already have.\n` +
            // UI Bug 7 — when pageContext narrows the question to one entity,
            // resist the urge to chain in unrelated lookups (e.g. calling
            // list_at_risk_customers from within "tell me about this customer").
            // Stay scoped to the selected entity.
            `Stay strictly scoped to the selected entity: do NOT call ` +
            `list_at_risk_customers, list_top_customers, list_overdue_invoices, ` +
            `or other broad scans unless the user has explicitly asked for ` +
            `that broader view in the same turn. The selected entity is the ` +
            `focus; everything else is noise here.`,
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
        `Currency formatting: "1,234.56 TND" (English) or "1 234,56 DT" (French) — never prefix with a symbol. ` +
        `Do NOT include internal database IDs (customerId, carId, appointmentId, invoice UUIDs, toolCallId, or raw UUIDs) unless the user explicitly asks for technical IDs. Use names, phone numbers, invoice numbers, license plates, dates, and amounts instead.\n\n` +
        // I-014 — if a tool returned a structured error field (e.g. send_email
        // → {error: "send_failed", message: "..."}), the user MUST be told the
        // action did not succeed. Previously the LLM would happily summarise
        // the OTHER tool results in the chain ("There are 19 overdue invoices")
        // and the failed send was silently swallowed. Surface infra-level
        // failures explicitly with the original message.
        `If any tool result in the conversation contains an "error" field (for example send_email returning {error:"send_failed", message:"..."}), ` +
        `you MUST mention the failure in plain business language, but do not quote raw tool names, ` +
        `schema validation messages, JSON, or internal guard text. Never imply the action succeeded when the tool returned an error. ` +
        `If the error says the user asked for a draft only, say no email was sent and provide the draft text in the reply.`,
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
  private async preApprovalCheck(
    toolName: string,
    args: unknown,
    ctx: AssistantUserContext,
    conversationId?: string,
    pageContext?: PageContext,
    successfulToolResults: { toolName: string; result: unknown }[] = [],
  ): Promise<{ error: string; message: string } | null> {
    if (typeof args !== 'object' || args === null) return null;
    const a = args as Record<string, unknown>;

    if (toolName === 'send_email') {
      if (this.userAskedForDraftOnly(ctx.turnState?.userMessage)) {
        return {
          error: 'draft_only_email_requested',
          message:
            'The user asked for a draft only. No email was sent. Compose the email draft in the final answer instead of calling send_email.',
        };
      }
      const html = typeof a.html === 'string' ? a.html.trim() : '';
      const text = typeof a.text === 'string' ? a.text.trim() : '';
      const ids = Array.isArray(a.attachInvoiceIds) ? a.attachInvoiceIds : [];
      if (html.length === 0 && text.length === 0) {
        return {
          error: 'empty_email_payload',
          message:
            'send_email was called with an empty body. ' +
            'You must populate `text` (or `html`) with the actual content first. ' +
            'If the user asked for invoices/data attached, call list_invoices ' +
            '(or the relevant read tool) first to get real data, then call ' +
            'send_email again with a populated body and the fetched ids in ' +
            'attachInvoiceIds.',
        };
      }
      const placeholderId = ids.find(
        (id) => typeof id === 'string' && this.looksLikePlaceholder(id),
      );
      if (placeholderId) {
        return {
          error: 'unresolved_placeholder',
          message:
            `send_email received placeholder attachInvoiceIds value "${placeholderId}". ` +
            'Call the invoice read tool first and pass real invoice ids, or omit attachments.',
        };
      }
      const to = typeof a.to === 'string' ? a.to.trim() : '';
      const customerId =
        typeof a.customerId === 'string' ? a.customerId.trim() : '';
      if (!to && !customerId) {
        const explicitExternalEmail = this.findExternalEmailInUserMessage(
          ctx.turnState?.userMessage,
          ctx.email,
        );
        if (explicitExternalEmail) {
          return {
            error: 'missing_recipient',
            message:
              `The user provided recipient email "${explicitExternalEmail}", but send_email omitted ` +
              '`to`. Retry send_email with `to` set to that exact email address.',
          };
        }
        if (this.userAskedForCustomerEmailRecipient(ctx.turnState?.userMessage)) {
          return {
            error: 'unresolved_recipient',
            message:
              'send_email was called without a recipient even though the user asked to email a customer/client. ' +
              'Resolve the recipient with find_customer/get_customer, then retry with customerId and to.',
          };
        }
      }
      if (customerId) {
        const customer = await this.prisma.customer.findFirst({
          where: { id: customerId, garageId: ctx.garageId },
          select: { id: true, email: true },
        });
        if (!customer) {
          return {
            error: 'customer_not_found',
            message:
              `send_email received customerId="${customerId}", but no customer ` +
              'with that id exists in this garage. Use find_customer or ' +
              'get_customer to resolve the real recipient before asking for approval.',
          };
        }
        const customerEmail = this.normaliseEmail(customer.email);
        if (!customerEmail) {
          return {
            error: 'missing_recipient',
            message:
              'send_email resolved a customer with no email address. Ask the user for an email address or update the customer record first.',
          };
        }
        if (to && !this.emailsMatch(customerEmail, to)) {
          return {
            error: 'email_mismatch',
            message:
              'send_email recipient email does not match the resolved customer. ' +
              'Use the email from get_customer/find_customer before asking for approval.',
          };
        }
        a.to = customerEmail;
      } else if (to && !this.emailsMatch(to, ctx.email)) {
        if (!this.userMessageContainsEmail(ctx.turnState?.userMessage, to)) {
          return {
            error: 'unresolved_recipient',
            message:
              'send_email was called with an external email address that the user did not provide and no customerId binding. ' +
              'Resolve the recipient with find_customer/get_customer first, then retry with the real customerId and email.',
          };
        }
        a.to = this.normaliseEmail(to);
      }
      return null;
    }

    if (toolName === 'send_sms') {
      const to = typeof a.to === 'string' ? a.to : '';
      const customerId =
        typeof a.customerId === 'string' ? a.customerId.trim() : '';
      if (customerId) {
        const customer = await this.prisma.customer.findFirst({
          where: { id: customerId, garageId: ctx.garageId },
          select: { id: true, phone: true },
        });
        if (!customer) {
          return {
            error: 'customer_not_found',
            message:
              `send_sms received customerId="${customerId}", but no customer ` +
              'with that id exists in this garage. Use find_customer or ' +
              'get_customer to resolve the real recipient before asking for approval.',
          };
        }
        if (!this.phoneNumbersMatch(customer.phone, to)) {
          return {
            error: 'phone_mismatch',
            message:
              'send_sms recipient phone does not match the resolved customer. ' +
              'Use the phone from get_customer/find_customer before asking for approval.',
          };
        }
        a.to = this.normalisePhone(customer.phone);
      } else if (
        !this.userMessageContainsPhone(ctx.turnState?.userMessage, to)
      ) {
        return {
          error: 'unresolved_recipient',
          message:
            'send_sms was called with a phone number that the user did not provide and no customerId binding. ' +
            'Resolve the recipient with find_customer/get_customer first, then retry with the real customerId and phone.',
        };
      }
    }

    // UI Bug 6 — verify id args refer to a real, garage-owned row BEFORE
    // surfacing an approval card. The schema's format:'uuid' (I-012) catches
    // shape errors but not "wrong-type-of-uuid" — e.g. the LLM passing a
    // customer-id as appointmentId. Without these checks, the user is asked
    // to approve an action that is provably going to fail.
    if (
      toolName === 'cancel_appointment' &&
      typeof a.appointmentId === 'string'
    ) {
      const explicitIdError = this.explicitAppointmentIdError(
        ctx.turnState?.userMessage,
        a.appointmentId,
      );
      if (explicitIdError) {
        return explicitIdError;
      }
      const exists = await this.prisma.appointment.findFirst({
        where: { id: a.appointmentId, garageId: ctx.garageId },
        select: { id: true },
      });
      if (!exists) {
        return {
          error: 'appointment_not_found',
          message:
            `cancel_appointment received appointmentId="${a.appointmentId}", ` +
            `but no appointment with that id exists in this garage. Did you ` +
            `pass a customer id by mistake? Call list_appointments first to ` +
            `find the correct appointment id, then retry.`,
        };
      }
    }

    if (toolName === 'create_invoice' && typeof a.customerId === 'string') {
      const customer = await this.prisma.customer.findFirst({
        where: { id: a.customerId, garageId: ctx.garageId },
        select: { id: true },
      });
      if (!customer) {
        return {
          error: 'customer_not_found',
          message:
            `create_invoice received customerId="${a.customerId}", but no ` +
            'customer with that id exists in this garage. Use find_customer ' +
            'or get_customer to resolve the customer before asking for approval.',
        };
      }
    }

    if (toolName === 'create_invoice_from_job' && typeof a.jobId === 'string') {
      const requestedJobId = a.jobId.trim();
      const recoveredJobId =
        await this.resolveMaintenanceJobIdForInvoiceFromJob(
          requestedJobId,
          ctx,
          conversationId,
          pageContext,
          successfulToolResults,
        );
      if (!recoveredJobId) {
        return {
          error: 'maintenance_job_not_found',
          message:
            `create_invoice_from_job received jobId="${requestedJobId}", but no ` +
            'maintenance job with that id exists in this garage. If you used ' +
            'a customer or car id by mistake, call get_job for the selected ' +
            'maintenance job or use the latest maintenance job id from the ' +
            'conversation before retrying.',
        };
      }
      a.jobId = recoveredJobId;
    }

    if (toolName === 'record_payment' && typeof a.invoiceId === 'string') {
      const invoiceLookup = a.invoiceId.trim();
      if (!invoiceLookup) {
        return {
          error: 'invoice_not_found',
          message:
            'record_payment was called without an invoice identifier. Ask the user to provide the visible invoice number, then call get_invoice and record_payment.',
        };
      }
      if (!UUID_PATTERN.test(invoiceLookup)) {
        return {
          error: 'invoice_not_found',
          message:
            `record_payment received invoiceId="${a.invoiceId}", but only a UUID is accepted for execution. ` +
            'Call get_invoice with the visible invoice number first, then retry with the resolved UUID.',
        };
      }
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          garageId: ctx.garageId,
          OR: [{ id: invoiceLookup }, { invoiceNumber: invoiceLookup }],
        },
        select: { id: true, invoiceNumber: true },
      });
      if (!invoice) {
        return {
          error: 'invoice_not_found',
          message:
            `record_payment received invoiceId="${a.invoiceId}", but no ` +
            `invoice with that identifier exists in this garage. ` +
            `Call get_invoice ` +
            `with the visible invoice number (or list_invoices), then retry with the resolved UUID.`,
        };
      }
      a.invoiceId = invoice.id;
      if (
        typeof a._expectedConfirmation !== 'string' ||
        a._expectedConfirmation.trim().length === 0
      ) {
        if (invoice.invoiceNumber) {
          a._expectedConfirmation = invoice.invoiceNumber;
        }
      }
    }

    if (
      toolName === 'create_appointment' &&
      typeof a.customerId === 'string' &&
      typeof a.carId === 'string'
    ) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: a.customerId, garageId: ctx.garageId },
        select: { id: true },
      });
      if (!customer) {
        return {
          error: 'customer_not_found',
          message:
            `create_appointment received customerId="${a.customerId}", but ` +
            `no customer with that id exists in this garage. Use find_customer ` +
            `or get_customer to resolve the right id first.`,
        };
      }
      const car = await this.prisma.car.findFirst({
        where: {
          id: a.carId,
          garageId: ctx.garageId,
          customerId: a.customerId,
        },
        select: { id: true },
      });
      if (!car) {
        return {
          error: 'car_not_found',
          message:
            `create_appointment received carId="${a.carId}" for ` +
            `customerId="${a.customerId}", but that car is not registered to ` +
            `that customer in this garage. Use find_car or get_customer to ` +
            `verify the car ↔ customer relationship.`,
        };
      }
    }

    return null;
  }

  private async resolveMaintenanceJobIdForInvoiceFromJob(
    requestedJobId: string,
    ctx: AssistantUserContext,
    conversationId?: string,
    pageContext?: PageContext,
    successfulToolResults: { toolName: string; result: unknown }[] = [],
  ): Promise<string | null> {
    if (!UUID_PATTERN.test(requestedJobId)) return null;

    const direct = await this.findGarageMaintenanceJobId(
      requestedJobId,
      ctx.garageId,
    );
    if (direct) return direct;

    const pageJobId = this.findMaintenanceJobIdFromPageContext(pageContext);
    if (pageJobId) {
      const fromPage = await this.findGarageMaintenanceJobId(
        pageJobId,
        ctx.garageId,
      );
      if (fromPage) return fromPage;
    }

    const turnResultJobId = this.findMaintenanceJobIdFromSuccessfulResults(
      successfulToolResults,
    );
    if (turnResultJobId) {
      const fromTurn = await this.findGarageMaintenanceJobId(
        turnResultJobId,
        ctx.garageId,
      );
      if (fromTurn) return fromTurn;
    }

    const conversationJobId =
      await this.findRecentMaintenanceJobIdFromConversation(
        conversationId,
        ctx.garageId,
      );
    if (conversationJobId) return conversationJobId;

    const fromEntity = await this.findLatestMaintenanceJobForEntityId(
      requestedJobId,
      ctx.garageId,
    );
    return fromEntity;
  }

  private async findGarageMaintenanceJobId(
    jobId: string,
    garageId: string,
  ): Promise<string | null> {
    const job = await this.prisma.maintenanceJob.findFirst({
      where: { id: jobId, garageId },
      select: { id: true },
    });
    return job?.id ?? null;
  }

  private findMaintenanceJobIdFromPageContext(
    pageContext: PageContext | undefined,
  ): string | null {
    const selected =
      pageContext?.selectedEntity ??
      deriveSelectedEntityFromRoute(pageContext?.route, pageContext?.params);
    if (!selected) return null;
    const type = selected.type.toLowerCase();
    if (
      type !== 'maintenance' &&
      type !== 'maintenancejob' &&
      type !== 'maintenance_job'
    ) {
      return null;
    }
    return UUID_PATTERN.test(selected.id) ? selected.id : null;
  }

  private findMaintenanceJobIdFromSuccessfulResults(
    successfulToolResults: { toolName: string; result: unknown }[],
  ): string | null {
    for (const entry of [...successfulToolResults].reverse()) {
      const found = this.extractMaintenanceJobIdFromUnknown(entry.result);
      if (found) return found;
    }
    return null;
  }

  private async findRecentMaintenanceJobIdFromConversation(
    conversationId: string | undefined,
    garageId: string,
  ): Promise<string | null> {
    if (!conversationId) return null;
    const rows = await this.prisma.assistantToolCall.findMany({
      where: {
        conversationId,
        toolName: { in: ['get_job', 'get_car', 'get_customer'] },
        status: AssistantToolCallStatus.EXECUTED,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { resultJson: true },
    });

    for (const row of rows) {
      const jobId = this.extractMaintenanceJobIdFromUnknown(row.resultJson);
      if (!jobId) continue;
      const existing = await this.findGarageMaintenanceJobId(jobId, garageId);
      if (existing) return existing;
    }
    return null;
  }

  private extractMaintenanceJobIdFromUnknown(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.extractMaintenanceJobIdFromUnknown(item);
        if (found) return found;
      }
      return null;
    }

    const record = value as Record<string, unknown>;
    const directId =
      typeof record.jobId === 'string'
        ? record.jobId
        : typeof record.maintenanceJobId === 'string'
          ? record.maintenanceJobId
          : null;
    if (directId && UUID_PATTERN.test(directId)) return directId;

    if (
      typeof record.id === 'string' &&
      UUID_PATTERN.test(record.id) &&
      (Array.isArray(record.parts) ||
        Array.isArray(record.timelineEvents) ||
        Array.isArray(record.approvalRequests))
    ) {
      return record.id;
    }

    const recentJobs = record.recentMaintenanceJobs;
    if (Array.isArray(recentJobs)) {
      for (const item of recentJobs) {
        const itemRecord = item as Record<string, unknown>;
        if (
          typeof itemRecord.id === 'string' &&
          UUID_PATTERN.test(itemRecord.id)
        ) {
          return itemRecord.id;
        }
      }
    }

    const serviceHistory = record.serviceHistory;
    if (Array.isArray(serviceHistory)) {
      for (const item of serviceHistory) {
        const itemRecord = item as Record<string, unknown>;
        if (
          itemRecord.source === 'maintenance_job' &&
          typeof itemRecord.id === 'string' &&
          UUID_PATTERN.test(itemRecord.id)
        ) {
          return itemRecord.id;
        }
      }
    }

    const car = record.car;
    if (car && typeof car === 'object') {
      const found = this.extractMaintenanceJobIdFromUnknown(car);
      if (found) return found;
    }

    return null;
  }

  private async findLatestMaintenanceJobForEntityId(
    entityId: string,
    garageId: string,
  ): Promise<string | null> {
    const byCustomer = await this.prisma.maintenanceJob.findFirst({
      where: {
        garageId,
        car: { customerId: entityId },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    if (byCustomer?.id) return byCustomer.id;

    const byCar = await this.prisma.maintenanceJob.findFirst({
      where: {
        garageId,
        carId: entityId,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    return byCar?.id ?? null;
  }

  private explicitAppointmentIdError(
    userMessage: string | undefined,
    appointmentId: string,
  ): { error: string; message: string } | null {
    if (!userMessage) return null;

    const explicitUuid = userMessage.match(UUID_PATTERN)?.[0];
    if (
      explicitUuid &&
      explicitUuid.toLowerCase() !== appointmentId.toLowerCase()
    ) {
      return {
        error: 'appointment_id_mismatch',
        message:
          `The user explicitly gave appointment id "${explicitUuid}", but ` +
          `cancel_appointment was called with "${appointmentId}". Do not substitute ` +
          'a different appointment. Use the exact user-provided id or explain that it is invalid.',
      };
    }

    const explicitId = userMessage.match(
      /\b(?:appointment\s+)?id\s*(?:is|=|:|with)?\s*["'`]?([A-Za-z0-9_-]{2,80})["'`]?/i,
    )?.[1];
    if (explicitId && !UUID_PATTERN.test(explicitId)) {
      return {
        error: 'invalid_appointment_identifier',
        message:
          `The user explicitly gave appointment id "${explicitId}", which is not a valid UUID. ` +
          'Do not choose a different appointment. Ask for a valid appointment id or use list_appointments only if the user asks to search by date/customer.',
      };
    }

    return null;
  }

  private looksLikePlaceholder(value: string): boolean {
    return (
      /\[(?:[^\]]*(?:insert|placeholder|id|todo|tbd)[^\]]*)\]/i.test(value) ||
      /<(?:[^>]*(?:insert|placeholder|id|todo|tbd)[^>]*)>/i.test(value) ||
      /\b(?:insert|placeholder|todo|tbd)\b/i.test(value)
    );
  }

  private guidanceForInvalidWriteArgs(
    toolName: string,
    errors: string[],
    userMessage: string | undefined,
  ): { content: string; forceComposeOnly: boolean } | null {
    if (
      toolName === 'create_invoice' &&
      this.userMessageLacksInvoicePrices(userMessage)
    ) {
      return {
        forceComposeOnly: true,
        content:
          `create_invoice arguments are incomplete. Stop retrying tools. ` +
          `Tell the user no invoice was created. Ask for quantity and HT unitPrice ` +
          `for each line item. Do not invent prices, totals, discounts, or taxes. ` +
          `Do not mention schemas, validation, tool names, or internal IDs.`,
      };
    }

    if (
      toolName === 'create_invoice' &&
      errors.some((error) => /customerId|carId|lineItems|uuid/i.test(error))
    ) {
      return {
        forceComposeOnly: false,
        content:
          `create_invoice arguments were invalid, but the user already provided invoice details. ` +
          `Do not ask for prices that are already in the user message. Retry by resolving real records first: ` +
          `call find_customer/get_customer for the customer and find_car/get_car for the vehicle when one is mentioned. ` +
          `Then call create_invoice with UUID customerId/carId values, a dueDate, and lineItems as objects like ` +
          `{"description":"Oil change labor","quantity":1,"unitPrice":80}. ` +
          `Set _expectedConfirmation to the formatted total in TND. Do not call send_email unless the user asked to email an already-created invoice.`,
      };
    }

    if (
      toolName === 'create_appointment' &&
      errors.some((error) => /customerId|carId|mechanicId|uuid/i.test(error))
    ) {
      if (this.userMessageHasAppointmentRecordHints(userMessage)) {
        return {
          forceComposeOnly: false,
          content:
            `create_appointment arguments were invalid, but the user already named the customer and vehicle. ` +
            `Do not ask the user to confirm details that are already in the message. Retry by resolving real records first: ` +
            `call find_customer/get_customer for the customer and find_car/get_car for the vehicle or plate. ` +
            `Then call create_appointment with UUID customerId/carId values, scheduledAt from the selected available slot, ` +
            `durationMinutes, and mechanicId when a slot returned one. The approval request will ask the user to confirm before execution. ` +
            `Do not mention schemas, validation, tool names, or internal IDs.`,
        };
      }
      return {
        forceComposeOnly: true,
        content:
          `create_appointment arguments are incomplete. Stop retrying tools and do not dispatch an agent. ` +
          `Tell the user no appointment was created. If available slots are already in the conversation, ` +
          `show the best slots and ask the user to confirm the customer and vehicle before approval. ` +
          `Do not mention the orchestrator, schemas, validation, tool names, or internal IDs.`,
      };
    }

    if (
      toolName === 'record_payment' &&
      errors.some((error) =>
        /invoiceId|amount|method|uuid|_expectedConfirmation/i.test(error),
      )
    ) {
      return {
        forceComposeOnly: false,
        content:
          `record_payment arguments were invalid, but the user already supplied payment intent. ` +
          `Resolve the invoice identifier first if needed, then retry with typed values only: ` +
          `invoiceId must be the invoice UUID, amount must be a number in TND, ` +
          `method must be one of CASH, CARD, BANK_TRANSFER, CHECK, or MOBILE_PAYMENT, ` +
          `and _expectedConfirmation should be the visible invoice number. ` +
          `Prefer resolving invoiceId via get_invoice using the provided invoice number. ` +
          `Do not expose schema text, JSON validation wording, tool names, or internal IDs in the user reply.`,
      };
    }

    return null;
  }

  private userAskedForRetentionReview(
    userMessage: string | undefined,
  ): boolean {
    const msg = (userMessage ?? '').toLowerCase();
    return (
      /\bretention review\b/.test(msg) ||
      (/\bretention\b/.test(msg) &&
        /\b(review|audit|forecast|analysis|report|overview)\b/.test(msg)) ||
      (/\bchurn\b/.test(msg) &&
        /\b(review|audit|forecast|analysis|report|overview)\b/.test(msg)) ||
      (/\bat[-\s]?risk customers?\b/.test(msg) &&
        /\b(review|audit|forecast|analysis|report|overview)\b/.test(msg))
    );
  }

  private userAskedForInvoiceCreation(
    userMessage: string | undefined,
  ): boolean {
    return /\b(?:create|make|issue|generate|prepare)\b[\s\S]{0,80}\binvoice\b/i.test(
      userMessage ?? '',
    );
  }

  private userMessageHasAppointmentRecordHints(
    userMessage: string | undefined,
  ): boolean {
    const msg = userMessage ?? '';
    if (!this.userAskedForAppointmentCreation(msg)) return false;
    const hasVehicleHint =
      /\b(?:plate|license|car|vehicle|skoda|renault|peugeot|dacia|toyota|bmw|mercedes|audi|volkswagen|hyundai|kia)\b/i.test(
        msg,
      ) || /\b\d{2,5}\s*TUN\s*\d{2,5}\b/i.test(msg);
    const hasCustomerHint =
      /\bfor\s+[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)+\b/.test(msg);
    return hasVehicleHint && hasCustomerHint;
  }

  private userMessageLacksInvoicePrices(
    userMessage: string | undefined,
  ): boolean {
    const msg = userMessage ?? '';
    if (!this.userAskedForInvoiceCreation(msg)) return false;
    if (
      /\b(?:unit\s*price|price|prix|amount|total|subtotal|ht|tnd|dt)\b/i.test(
        msg,
      ) ||
      /\d+(?:[.,]\d{1,2})?\s*(?:tnd|dt)\b/i.test(msg)
    ) {
      return false;
    }
    return /\b(?:for|with)\b[\s\S]{0,120}\b(?:change|filter|oil|brake|service|part|labor|labour)\b/i.test(
      msg,
    );
  }

  private extractInvoiceLineItemHint(
    userMessage: string | undefined,
  ): string | null {
    const msg = (userMessage ?? '').replace(/\s+/g, ' ').trim();
    const matches = [...msg.matchAll(/\bfor\s+([^.!?]+?)(?=\s+for\b|\.|$)/gi)];
    const candidate = matches[matches.length - 1]?.[1]?.trim();
    if (!candidate) return null;
    if (
      !/\b(change|filter|oil|brake|service|part|labor|labour)\b/i.test(
        candidate,
      )
    ) {
      return null;
    }
    return candidate.replace(/\bdo not create.*$/i, '').trim();
  }

  private userAskedForAppointmentCreation(
    userMessage: string | undefined,
  ): boolean {
    const msg = userMessage ?? '';
    return (
      /\b(?:book|schedule|create|make|set\s*up|reserve)\b[\s\S]{0,100}\b(?:appointment|checkup|service|slot|rdv|rendez-?vous)\b/i.test(
        msg,
      ) ||
      /\b(?:appointment|checkup|service|slot|rdv|rendez-?vous)\b[\s\S]{0,100}\b(?:book|schedule|create|make|set\s*up|reserve)\b/i.test(
        msg,
      )
    );
  }

  private userAskedForReportDownload(userMessage: string | undefined): boolean {
    const msg = userMessage ?? '';
    return (
      /\b(?:generate|download|export|create|prepare)\b[\s\S]{0,100}\b(?:pdf|csv|report)\b/i.test(
        msg,
      ) ||
      /\b(?:pdf|csv)\b[\s\S]{0,80}\breport\b/i.test(msg) ||
      /\breport\b[\s\S]{0,80}\b(?:pdf|csv|download|export)\b/i.test(msg)
    );
  }

  private userAskedForMonthlyFinancialReport(
    userMessage: string | undefined,
  ): boolean {
    const msg = (userMessage ?? '').toLowerCase();
    const monthReference =
      /\b(?:last|this|previous|prior|past|current)\s+month\b/i.test(msg) ||
      /\bmonth[-\s]?end\b/i.test(msg) ||
      /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
        msg,
      );
    const financialReportIntent =
      /\b(?:financial|finance|revenue|p&l|profit|loss|cash\s*flow)\b[\s\S]{0,80}\b(?:report|summary|statement|overview)\b/i.test(
        msg,
      ) ||
      /\b(?:report|summary|statement|overview)\b[\s\S]{0,80}\b(?:financial|finance|revenue)\b/i.test(
        msg,
      ) ||
      /\bmonthly(?:ly)?\s+(?:report|summary)\b/i.test(msg) ||
      /\bmonth[-\s]?end\s+(?:report|summary)\b/i.test(msg);
    if (!monthReference || !financialReportIntent) {
      return false;
    }
    return !/\b(?:create|make|issue|prepare)\b[\s\S]{0,100}\binvoice\b/i.test(
      msg,
    );
  }

  private shouldPreferMonthlyFinancialReportSkill(
    userMessage: string | undefined,
    agentName: string | null,
    toolName: string,
  ): boolean {
    if (!this.userAskedForMonthlyFinancialReport(userMessage)) {
      return false;
    }
    if (
      agentName &&
      agentName.toLowerCase() === FINANCE_AGENT_NAME &&
      toolName === RESERVED_DISPATCH_AGENT
    ) {
      return true;
    }
    return toolName === RESERVED_DISPATCH_AGENT
      ? false
      : toolName === 'get_revenue_summary' ||
          toolName === 'get_invoices_summary';
  }

  private normalisePhone(value: string | null | undefined): string {
    return (value ?? '').replace(/[\s\-()]/g, '');
  }

  private normaliseEmail(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  private emailsMatch(
    left: string | null | undefined,
    right: string | null | undefined,
  ): boolean {
    const leftEmail = this.normaliseEmail(left);
    const rightEmail = this.normaliseEmail(right);
    return leftEmail.length > 0 && leftEmail === rightEmail;
  }

  private phoneNumbersMatch(
    left: string | null | undefined,
    right: string | null | undefined,
  ): boolean {
    const leftDigits = this.normalisePhone(left).replace(/^\+/, '');
    const rightDigits = this.normalisePhone(right).replace(/^\+/, '');
    if (!leftDigits || !rightDigits) return false;
    if (leftDigits === rightDigits) return true;
    return (
      leftDigits.length >= 8 &&
      rightDigits.length >= 8 &&
      (leftDigits.endsWith(rightDigits) || rightDigits.endsWith(leftDigits))
    );
  }

  private userMessageContainsPhone(
    userMessage: string | undefined,
    phone: string,
  ): boolean {
    const normalizedPhone = this.normalisePhone(phone);
    if (!userMessage || normalizedPhone.length === 0) return false;
    return this.normalisePhone(userMessage).includes(normalizedPhone);
  }

  private userMessageContainsEmail(
    userMessage: string | undefined,
    email: string,
  ): boolean {
    const normalizedEmail = this.normaliseEmail(email);
    if (!userMessage || normalizedEmail.length === 0) return false;
    return userMessage.toLowerCase().includes(normalizedEmail);
  }

  private findExternalEmailInUserMessage(
    userMessage: string | undefined,
    ownerEmail: string | null | undefined,
  ): string | null {
    const msg = userMessage ?? '';
    const matches = msg.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    );
    if (!matches) return null;
    const external = matches.find((email) => !this.emailsMatch(email, ownerEmail));
    return external ? this.normaliseEmail(external) : null;
  }

  private userAskedForCustomerEmailRecipient(
    userMessage: string | undefined,
  ): boolean {
    const msg = userMessage ?? '';
    const hasEmailAction =
      /\b(?:email|e-mail|mail)\b/i.test(msg) ||
      /\bsend\b[\s\S]{0,40}\b(?:email|e-mail|mail)\b/i.test(msg);
    if (!hasEmailAction || this.userAskedForEmailSelfSend(msg)) return false;
    return (
      /\b(?:customer|client|recipient)\b/i.test(msg) ||
      /\b(?:email|e-mail|mail)\s+(?!me\b|myself\b|the\s+owner\b|garage\s+owner\b)[A-Z][A-Za-z'’-]+/i.test(
        msg,
      )
    );
  }

  private userAskedForEmailSelfSend(userMessage: string | undefined): boolean {
    const msg = userMessage ?? '';
    return (
      /\b(?:email|e-mail|mail|send)\s+(?:me|myself)\b/i.test(msg) ||
      /\b(?:to\s+me|my\s+email|current\s+user|garage\s+owner|the\s+owner)\b/i.test(
        msg,
      )
    );
  }

  private userAskedForDraftOnly(userMessage: string | undefined): boolean {
    const msg = userMessage ?? '';
    return (
      /\b(draft|write|compose)\b/i.test(msg) &&
      /\b(do not|don't|dont|without|but not|no need to)\s+(?:actually\s+)?send\b/i.test(
        msg,
      )
    );
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
    completion?: Pick<
      LlmCompletionResult,
      'provider' | 'purpose' | 'model' | 'tokensIn' | 'tokensOut'
    >,
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
      llmProvider: completion?.provider,
      llmModel: completion?.model,
      tokensIn: completion?.tokensIn,
      tokensOut: completion?.tokensOut,
      llmPurpose: completion?.purpose,
    });
    return { id: row.id };
  }

  private async maybeGenerateTitle(
    conversationId: string,
    ctx: AssistantUserContext,
  ): Promise<void> {
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
            purpose: 'conversation_title',
            usageContext: {
              conversationId,
              garageId: ctx.garageId,
              userId: ctx.userId,
            },
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
