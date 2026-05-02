import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AssistantBlastTier } from '@prisma/client';
import {
  AgentDefinition,
  AssistantUserContext,
  LlmMessage,
  LlmToolCall,
  ToolDescriptor,
} from './types';
import { LlmGatewayService } from './llm-gateway.service';
import { ToolRegistryService } from './tool-registry.service';

const DEFAULT_ITERATION_CAP = 6;
const DEFAULT_RUN_TIMEOUT_MS = 60_000;
const DEFAULT_TOOL_TIMEOUT_MS = 15_000;

/**
 * Hallucinated-action patterns. When a model claims one of these in its final
 * text but never invoked the matching tool, force a corrective retry rather
 * than return the lie to the user.
 *
 * Trigger case: 2026-05-02, Groq llama-3.1-8b emitted "Email sent to your
 * personal email address" after only firing list_invoices. The audit table
 * had zero send_email rows. The user thought their email had been sent.
 */
interface ActionClaimPattern {
  regex: RegExp;
  requiredTool: string;
  label: string;
}

const ACTION_CLAIM_PATTERNS: readonly ActionClaimPattern[] = [
  {
    regex:
      /(email\s+(?:was\s+|has\s+been\s+)?(?:sent|delivered|forwarded)|(?:i(?:'ve|\s+have)?\s+)?sent\s+(?:an?\s+|the\s+)?email)/i,
    requiredTool: 'send_email',
    label: 'sent an email',
  },
  {
    regex:
      /(sms\s+(?:was\s+|has\s+been\s+)?(?:sent|delivered)|(?:i(?:'ve|\s+have)?\s+)?sent\s+(?:an?\s+|the\s+)?(?:sms|text)|text\s+message\s+(?:sent|delivered))/i,
    requiredTool: 'send_sms',
    label: 'sent an SMS',
  },
  {
    regex:
      /(payment\s+(?:was\s+|has\s+been\s+)?(?:recorded|logged|registered)|(?:i(?:'ve|\s+have)?\s+)?recorded\s+(?:the\s+|a\s+)?payment)/i,
    requiredTool: 'record_payment',
    label: 'recorded a payment',
  },
  {
    regex:
      /(appointment\s+(?:was\s+|has\s+been\s+)?(?:cancelled|canceled)|(?:i(?:'ve|\s+have)?\s+)?cancelled\s+(?:the\s+|an?\s+)?appointment)/i,
    requiredTool: 'cancel_appointment',
    label: 'cancelled an appointment',
  },
];

interface HallucinatedAction {
  action: string;
  requiredTool: string;
}

const TIMEOUT_RESULT = {
  result: 'Agent timed out before completing the task.',
};

interface RunOptions {
  /**
   * Override the top-level run timeout. Used in tests to avoid relying on
   * fake timers; production code should let this default.
   */
  runTimeoutMs?: number;
  /** Override per-tool timeout (forwarded to ToolRegistryService.execute). */
  toolTimeoutMs?: number;
}

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);
  private readonly agents = new Map<string, AgentDefinition>();

  constructor(
    private readonly llm: LlmGatewayService,
    private readonly tools: ToolRegistryService,
  ) {}

  register(agent: AgentDefinition): void {
    this.agents.set(agent.name, agent);
    this.logger.debug(
      `Registered agent "${agent.name}" (toolWhitelist=${agent.toolWhitelist.length}, cap=${agent.iterationCap ?? DEFAULT_ITERATION_CAP})`,
    );
  }

  getDefinition(name: string): AgentDefinition | undefined {
    return this.agents.get(name);
  }

  list(): { name: string; description: string }[] {
    return Array.from(this.agents.values()).map((a) => ({
      name: a.name,
      description: a.description,
    }));
  }

  async run(
    name: string,
    input: string,
    ctx: AssistantUserContext,
    opts: RunOptions = {},
  ): Promise<{ result: string }> {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new NotFoundException(`Agent not registered: ${name}`);
    }

    if (agent.requiredRole === 'OWNER' && ctx.role !== 'OWNER') {
      throw new ForbiddenException(`Agent "${name}" requires OWNER role`);
    }
    if (
      agent.requiredModule &&
      !ctx.enabledModules.includes(agent.requiredModule)
    ) {
      throw new ForbiddenException(
        `Agent "${name}" requires module "${agent.requiredModule}"`,
      );
    }

    const runTimeoutMs = opts.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;
    const startedAt = Date.now();

    const inner = this.runInner(agent, input, ctx, opts);
    const timeoutPromise = new Promise<{ result: string }>((resolve) => {
      const timer = setTimeout(() => resolve(TIMEOUT_RESULT), runTimeoutMs);
      // Allow the inner promise to clear the timer if it wins.
      void inner.finally(() => clearTimeout(timer));
    });

    const outcome = await Promise.race([inner, timeoutPromise]);
    const elapsedMs = Date.now() - startedAt;
    if (outcome === TIMEOUT_RESULT) {
      this.logger.warn(
        `agent "${name}" exceeded run timeout (${runTimeoutMs}ms) after ${elapsedMs}ms`,
      );
    }
    return outcome;
  }

  private async runInner(
    agent: AgentDefinition,
    input: string,
    ctx: AssistantUserContext,
    opts: RunOptions,
  ): Promise<{ result: string }> {
    const startedAt = Date.now();
    const cap =
      agent.iterationCap > 0 ? agent.iterationCap : DEFAULT_ITERATION_CAP;
    const whitelist = new Set(agent.toolWhitelist);
    const allDescriptors = this.tools.listForUser(ctx);
    const filteredDescriptors: ToolDescriptor[] = allDescriptors.filter((d) =>
      whitelist.has(d.name),
    );

    const todayIso = new Date().toISOString().slice(0, 10);
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content:
          `Today's date is ${todayIso} (UTC). When asked for time-relative data (last week, last 3 months, since X), ` +
          `compute concrete from/to dates relative to TODAY. Never anchor to a year from your training data. ` +
          `If a tool result is empty or zero, report that exactly — do not invent numbers.`,
      },
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: input },
    ];

    const toolsUsed: string[] = [];
    let iteration = 0;
    let lastAssistantText: string | null = null;

    while (iteration < cap) {
      iteration += 1;

      const completion = await this.llm.complete({
        messages,
        tools: filteredDescriptors,
      });

      // Track the latest text so iteration-cap fallbacks can echo something useful.
      if (completion.content) {
        lastAssistantText = completion.content;
      }

      // Persist the assistant turn into the local message log so subsequent
      // LLM calls see prior tool_calls. Even if there is no content, the
      // tool_calls field is what matters for the model.
      messages.push({
        role: 'assistant',
        content: completion.content ?? null,
        toolCalls:
          completion.toolCalls.length > 0 ? completion.toolCalls : undefined,
      });

      if (completion.toolCalls.length === 0) {
        const hallucinated = this.detectHallucinatedAction(
          completion.content ?? '',
          toolsUsed,
        );
        if (hallucinated && iteration < cap) {
          this.logger.warn(
            `agent "${agent.name}" claimed "${hallucinated.action}" without invoking ${hallucinated.requiredTool}; forcing corrective retry`,
          );
          messages.push({
            role: 'system',
            content:
              `Your previous response claimed you "${hallucinated.action}", ` +
              `but you never invoked the ${hallucinated.requiredTool} tool this turn. ` +
              `You MUST either: (a) invoke ${hallucinated.requiredTool} now to actually perform the action, ` +
              `or (b) correct your response and explicitly tell the user the action was NOT performed. ` +
              `Never describe write actions in the past tense unless the corresponding tool was called.`,
          });
          continue;
        }

        const totalMs = Date.now() - startedAt;
        this.logger.log(
          `agent "${agent.name}" finished after ${iteration} iter, tools=[${toolsUsed.join(',')}], ${totalMs}ms`,
        );
        return { result: completion.content ?? '' };
      }

      // v1: sequential — handle the first tool call only.
      const call = completion.toolCalls[0];
      toolsUsed.push(call.name);
      await this.handleToolCall(call, agent, whitelist, ctx, messages, opts);
    }

    const totalMs = Date.now() - startedAt;
    this.logger.warn(
      `agent "${agent.name}" exceeded iteration cap ${cap} after ${totalMs}ms; tools=[${toolsUsed.join(',')}]`,
    );

    if (lastAssistantText && lastAssistantText.trim().length > 0) {
      return { result: lastAssistantText };
    }
    return {
      result:
        'I was unable to complete the task within my iteration budget. Please narrow the request and try again.',
    };
  }

  /**
   * Scan the model's final text for action claims that weren't backed by an
   * actual tool invocation this turn. Returns null if the response is honest;
   * otherwise returns the offending claim so the caller can force a retry.
   *
   * Exposed-for-testing via the public `detectHallucinatedActionForTest`
   * wrapper below — keep this method's body the single source of truth.
   */
  private detectHallucinatedAction(
    content: string,
    toolsUsed: readonly string[],
  ): HallucinatedAction | null {
    if (!content || content.trim().length === 0) return null;
    const used = new Set(toolsUsed);
    for (const pattern of ACTION_CLAIM_PATTERNS) {
      if (pattern.regex.test(content) && !used.has(pattern.requiredTool)) {
        return { action: pattern.label, requiredTool: pattern.requiredTool };
      }
    }
    return null;
  }

  /** @internal — unit-test entrypoint for the hallucination guard. */
  detectHallucinatedActionForTest(
    content: string,
    toolsUsed: readonly string[],
  ): HallucinatedAction | null {
    return this.detectHallucinatedAction(content, toolsUsed);
  }

  private async handleToolCall(
    call: LlmToolCall,
    agent: AgentDefinition,
    whitelist: Set<string>,
    ctx: AssistantUserContext,
    messages: LlmMessage[],
    opts: RunOptions,
  ): Promise<void> {
    const appendToolMessage = (payload: unknown): void => {
      messages.push({
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(payload),
      });
    };

    const tool = this.tools.get(call.name);
    if (!tool || !whitelist.has(call.name)) {
      this.logger.warn(
        `agent "${agent.name}" attempted disallowed tool "${call.name}"`,
      );
      appendToolMessage({ error: 'tool not available to this agent' });
      return;
    }

    let parsedArgs: unknown;
    try {
      parsedArgs = call.argsJson ? JSON.parse(call.argsJson) : {};
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendToolMessage({
        error: 'invalid_arguments',
        detail: `failed to parse args JSON: ${message}`,
      });
      return;
    }

    const validation = this.tools.validateArgs(call.name, parsedArgs);
    if (!validation.valid) {
      appendToolMessage({
        error: 'invalid_arguments',
        detail: validation.errors,
      });
      return;
    }

    const tier = this.tools.resolveBlastTier(tool, parsedArgs, ctx);
    // Agents are read-heavy by design. Anything that would require user
    // approval belongs in the main orchestrator conversation where the user
    // can confirm interactively. Refusing here keeps agents non-interactive.
    if (
      tier !== AssistantBlastTier.READ &&
      tier !== AssistantBlastTier.AUTO_WRITE
    ) {
      this.logger.log(
        `agent "${agent.name}" refused write tool "${call.name}" (tier=${tier})`,
      );
      appendToolMessage({
        error:
          'agent cannot perform write actions requiring approval; ask the orchestrator to handle this',
      });
      return;
    }

    const execResult = await this.tools.execute(call.name, parsedArgs, ctx, {
      timeoutMs: opts.toolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS,
    });

    if (execResult.ok === true) {
      appendToolMessage({ result: (execResult as { result: unknown }).result });
    } else {
      appendToolMessage({ error: (execResult as { error: string }).error });
    }
  }
}
