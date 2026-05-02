import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmCompletionRequest,
  LlmCompletionResult,
  LlmMessage,
  LlmToolCall,
  LlmValidationOutcome,
  ToolDescriptor,
} from './types';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// llama-3.1-8b-instant: non-reasoning, fast, supports OpenAI-format
// tool-calling, and fits the classifier-narrowed (≤5) tool list cleanly
// inside the 1024-token budget. With the IntentClassifierService
// pre-filter this model now selects the right tool reliably without
// burning budget on reasoning (which is what blew up gpt-oss-20b and
// qwen3-32b — both reasoning models, both starved their content/tool
// output).
//
// Tested + rejected:
//  - llama-3.3-70b-versatile: malformed JSON with 25 tools, narrates
//    instead of calling with ≤5 tools.
//  - openai/gpt-oss-20b: emits tool_calls but reasoning tokens leave 0
//    bytes of content/tool output within budget.
//  - qwen/qwen3-32b: tool_calls land in dev probes but selection is
//    inconsistent under our prompt + leaks <think> trace into content;
//    6000 TPM ceiling is also tight.
const GROQ_MODEL = 'llama-3.1-8b-instant';

// Cerebras OpenAI-compatible endpoint. Free tier: 1M tokens/day with no
// per-minute throttle that resembles Groq's 6000 TPM ceiling — purpose-built
// for tool-heavy turns the orchestrator emits when the augmenter expands the
// classifier slice. Same wire format as Groq (OpenAI chat-completions shape),
// different model ids.
const CEREBRAS_URL = 'https://api.cerebras.ai/v1/chat/completions';
// qwen-3-235b-a22b-instruct-2507 is the largest instruction-tuned (non-
// "thinking") model on this account's free tier. The 8b llama variant on the
// same tier returned tool-call payloads as plain JSON in the content field
// instead of the OpenAI `tool_calls` structure once the augmenter pushed the
// tool list past 5 — so the orchestrator parsed zero tool calls and dumped
// raw JSON to the user. The 235B instruct model handles structured tool
// calling reliably and doesn't leak <think> traces (that's the "thinking"
// variant; this one is instruction-only).
const CEREBRAS_MODEL = 'qwen-3-235b-a22b-instruct-2507';
// Cerebras model-id prefixes we recognise. Strict so the classifier's
// Groq-specific `llama-3.1-8b-instant` (with hyphen + suffix) is rejected
// and we override with CEREBRAS_MODEL.
const CEREBRAS_MODEL_PATTERN = /^(llama3\.|qwen-?3-|gpt-oss-|zai-glm-)/i;

// OVHcloud AI Endpoints — OpenAI-compatible inference. Pay-as-you-go (no daily
// quota cliff like Gemini Flash-Lite, no per-minute TPM ceiling like Groq).
// Default model Meta-Llama-3.3-70B is a reliable tool caller — it replaces the
// llama-3.1-8b on Groq that was hallucinating "Email sent" claims after only
// firing list_invoices in iteration 1 (see agent-runner hallucination guard).
//
// Pricing (catalog as of 2026-05): €0.67/1M tokens both ways → ~€0.002 per
// tool-calling turn at OpAuto's average shape (~2.5k in / 500 out). Cheap
// enough to sit in front of Mistral as the "always works" tool-call rail.
const OVH_DEFAULT_URL =
  'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions';
const OVH_DEFAULT_MODEL = 'Meta-Llama-3_3-70B-Instruct';
// OVH hosts a curated set of open-weight models; accept any of them when the
// caller passes an explicit model id. Pattern is strict so cross-provider
// routing (e.g. Groq's bare `llama-3.1-8b-instant`) doesn't accidentally hit
// OVH and 404 — those fall through to OVH_DEFAULT_MODEL instead.
const OVH_MODEL_PATTERN =
  /^(meta-llama|mistral-(small|nemo|7b|codestral|ministral)|qwen[23]|gpt-oss-(20|120)b|deepseek)/i;

// Mistral OpenAI-compatible endpoint. Free tier: 1B tokens/month with phone
// verification — a deeper safety net than Cerebras's daily bucket. Sits below
// Cerebras in the chain so tool-heavy turns hit Cerebras first (faster), and
// only spill over to Mistral if Cerebras itself is having a bad day.
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
// mistral-small-latest is the right default for the free tier:
//   - Tool-calling supported and reliable for our 5-7 tool slice.
//   - Open-weight family covered by the 1B-token monthly free quota
//     (the larger commercial models are not).
//   - 24B params — quality is comparable to Llama 3.3 70B on tool routing
//     for our orchestrator's narrow prompts.
const MISTRAL_MODEL = 'mistral-small-latest';
const MISTRAL_MODEL_PATTERN = /^(mistral|ministral|open-)/i;

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
// Match the model id used in the existing AiService so we share a single
// Anthropic version across the codebase. Bumping to a newer Sonnet should be
// done in one place when ready.
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLAUDE_VERSION = '2023-06-01';

// Gemini free tier: 250k TPM (vs Groq's 6k) — primary provider so a single
// query can't saturate the per-minute budget.
//
// Model choice: gemini-2.5-flash-lite is the right default for free tier:
//   - 15 RPM (vs Flash's 10 RPM) → ~50% more headroom per minute
//   - Higher daily quota than Flash on the post-Dec-2025 free tier (Flash is
//     down to 20 RPD; Flash-Lite has its own bucket and a higher cap).
//   - Quotas are per-model-per-project, so falling back to Flash for harder
//     queries when Flash-Lite is exhausted is a viable future enhancement.
//   - Quality on tool routing + short narrative composition is comparable for
//     our use case; bump to Flash or Pro when we have a paid key.
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// JSON Schema fields Gemini's strict OpenAPI-3.0-subset parser rejects.
// Stripped recursively before sending tool declarations.
const GEMINI_SCHEMA_BLOCKLIST = new Set<string>([
  'additionalProperties',
  '$schema',
  '$ref',
  '$defs',
  'definitions',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'patternProperties',
]);

const DEFAULT_TIMEOUT_MS = 30_000;
// 1024 fits qwen3-32b's reasoning trace + tool_calls + content with room to
// spare in normal turns. Higher values eat into Groq's tight free-tier TPM
// budget (qwen3-32b: 6000 TPM) and trigger 429s on multi-step turns.
const DEFAULT_MAX_TOKENS = 1024;

interface GroqToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface GroqChoice {
  message?: {
    role?: string;
    content?: string | null;
    tool_calls?: GroqToolCall[];
  };
  finish_reason?: string;
}

interface GroqResponse {
  choices?: GroqChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

interface ClaudeContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface ClaudeResponse {
  content?: ClaudeContentBlock[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

interface GeminiPart {
  text?: string;
  functionCall?: { name?: string; args?: unknown };
  functionResponse?: { name?: string; response?: unknown };
}

interface GeminiContent {
  role?: string;
  parts?: GeminiPart[];
}

interface GeminiResponse {
  candidates?: Array<{ content?: GeminiContent; finishReason?: string }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string; code?: number };
}

/**
 * Provider-agnostic completion gateway.
 *
 * Order: OVH (paid pay-as-you-go, Meta-Llama-3.3-70B; the floor — no quota
 * cliffs, no per-minute TPM ceiling, so it should never legitimately fail) →
 * Gemini (250k TPM free) → Mistral (1B tokens/month free) → Cerebras
 * (1M tokens/day) → Claude (quality, last resort). OVH is primary because the
 * 2026-05-02 cascade incident — Gemini RPD exhausted, OVH model-id misconfig,
 * Mistral 400 on tool-message ordering, Cerebras RPM saturated, Claude key
 * empty — produced a mock-fallback reply ("I'm sorry — I couldn't reach the
 * AI service") even though the OVH spend was healthy. Putting OVH first means
 * a quota-saturated free-tier provider can never gate the user out.
 *
 * On any recoverable failure (network, non-2xx, malformed tool-call JSON) we
 * fall through. If everything is unavailable or unconfigured, we return a
 * `mock` result with content rather than throwing — the orchestrator depends
 * on always receiving a result so it can persist a graceful assistant message.
 *
 * Groq llama-3.1-8b removed from the active chain after a 2026-05-02 incident
 * where it produced "Email sent to your personal email address" text without
 * ever invoking the send_email tool. The callGroq method is retained but
 * unwired — the agent-runner hallucination guard catches similar failures
 * across providers.
 */
@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);
  private readonly geminiKey: string | undefined;
  private readonly groqKey: string | undefined;
  private readonly ovhKey: string | undefined;
  private readonly ovhUrl: string;
  private readonly ovhModel: string;
  private readonly cerebrasKey: string | undefined;
  private readonly mistralKey: string | undefined;
  private readonly anthropicKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.geminiKey = this.config.get<string>('GEMINI_API_KEY');
    this.groqKey = this.config.get<string>('GROQ_API_KEY');
    this.ovhKey = this.config.get<string>('OVH_API_KEY');
    const ovhBase = this.config.get<string>('OVH_BASE_URL');
    this.ovhUrl = ovhBase
      ? `${ovhBase.replace(/\/+$/, '')}/chat/completions`
      : OVH_DEFAULT_URL;
    // Truthy check (NOT `??`): docker-compose maps `OVH_MODEL: ${OVH_MODEL:-}`,
    // which forwards an EMPTY string when the host .env doesn't set it. `??`
    // only falls back on null/undefined, so an empty string from compose was
    // reaching the OVH API and 404-ing with "The model `` does not exist."
    // The same applies to OVH_BASE_URL above (already handled correctly).
    const cfgOvhModel = this.config.get<string>('OVH_MODEL');
    this.ovhModel =
      cfgOvhModel && cfgOvhModel.length > 0 ? cfgOvhModel : OVH_DEFAULT_MODEL;
    this.cerebrasKey = this.config.get<string>('CEREBRAS_API_KEY');
    this.mistralKey = this.config.get<string>('MISTRAL_API_KEY');
    this.anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (
      !this.geminiKey &&
      !this.ovhKey &&
      !this.cerebrasKey &&
      !this.mistralKey &&
      !this.anthropicKey
    ) {
      this.logger.warn(
        'No LLM provider configured (GEMINI_API_KEY / OVH_API_KEY / CEREBRAS_API_KEY / MISTRAL_API_KEY / ANTHROPIC_API_KEY missing); returning mock completion',
      );
      return {
        provider: 'mock',
        content:
          "I can't reach an LLM provider right now — no API key is configured on the server.",
        toolCalls: [],
      };
    }

    if (this.ovhKey) {
      const ovh = await this.callOvh(request);
      if (ovh.ok) {
        const validated = this.runValidator(ovh.result, request);
        if (validated.ok) return validated.result;
        this.logger.warn(
          `OVH result rejected (${(validated as { ok: false; reason: string }).reason}); falling back to Gemini`,
        );
      } else {
        this.logger.warn(
          `OVH failed (${(ovh as { reason: string }).reason}); falling back to Gemini`,
        );
      }
    }

    if (this.geminiKey) {
      const gem = await this.callGemini(request);
      if (gem.ok) {
        const validated = this.runValidator(gem.result, request);
        if (validated.ok) return validated.result;
        this.logger.warn(
          `Gemini result rejected (${(validated as { ok: false; reason: string }).reason}); falling back to Mistral`,
        );
      } else {
        this.logger.warn(
          `Gemini failed (${(gem as { reason: string }).reason}); falling back to Mistral`,
        );
      }
    }

    if (this.mistralKey) {
      const mistral = await this.callMistral(request);
      if (mistral.ok) {
        const validated = this.runValidator(mistral.result, request);
        if (validated.ok) return validated.result;
        this.logger.warn(
          `Mistral result rejected (${(validated as { ok: false; reason: string }).reason}); falling back to Cerebras`,
        );
      } else {
        this.logger.warn(
          `Mistral failed (${(mistral as { reason: string }).reason}); falling back to Cerebras`,
        );
      }
    }

    if (this.cerebrasKey) {
      const cerebras = await this.callCerebras(request);
      if (cerebras.ok) {
        const validated = this.runValidator(cerebras.result, request);
        if (validated.ok) return validated.result;
        this.logger.warn(
          `Cerebras result rejected (${(validated as { ok: false; reason: string }).reason}); falling back to Claude`,
        );
      } else {
        this.logger.warn(
          `Cerebras failed (${(cerebras as { reason: string }).reason}); falling back to Claude`,
        );
      }
    }

    if (this.anthropicKey) {
      const claude = await this.callClaude(request);
      if (claude.ok) {
        const validated = this.runValidator(claude.result, request);
        if (validated.ok) return validated.result;
        this.logger.warn(
          `Claude result rejected (${(validated as { ok: false; reason: string }).reason})`,
        );
      } else {
        this.logger.warn(
          `Claude failed (${(claude as { reason: string }).reason})`,
        );
      }
    }

    return {
      provider: 'mock',
      content:
        "I'm sorry — I couldn't reach the AI service. Please try again in a moment.",
      toolCalls: [],
    };
  }

  // ── Groq ─────────────────────────────────────────────────────────────

  private async callGroq(
    request: LlmCompletionRequest,
  ): Promise<
    { ok: true; result: LlmCompletionResult } | { ok: false; reason: string }
  > {
    const startedAt = Date.now();
    const body: Record<string, unknown> = {
      model: request.model ?? GROQ_MODEL,
      messages: request.messages.map((m) => this.toOpenAiMessage(m)),
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    };
    if (typeof request.temperature === 'number') {
      body.temperature = request.temperature;
    }
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => this.toOpenAiTool(t));
      body.tool_choice = 'auto';
    }

    let raw: GroqResponse;
    try {
      const response = await this.fetchWithTimeout(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.groqKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await this.safeText(response);
        return {
          ok: false,
          reason: `http_${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        };
      }
      raw = (await response.json()) as GroqResponse;
    } catch (err) {
      return { ok: false, reason: this.errMessage(err) };
    }

    const choice = raw.choices?.[0];
    const message = choice?.message;
    if (!message) {
      return { ok: false, reason: 'missing_message' };
    }

    const toolCalls: LlmToolCall[] = [];
    if (Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        const name = tc.function?.name;
        const argsRaw = tc.function?.arguments ?? '';
        if (typeof name !== 'string' || name.length === 0) {
          return { ok: false, reason: 'tool_call_missing_name' };
        }
        // Llama models occasionally emit malformed JSON in arguments. Validate
        // that it parses; if it doesn't, this is the documented failure mode
        // that should trigger Claude fallback.
        try {
          if (argsRaw.length > 0) {
            JSON.parse(argsRaw);
          }
        } catch (err) {
          return {
            ok: false,
            reason: `tool_call_json_parse_${this.errMessage(err)}`,
          };
        }
        toolCalls.push({
          id: tc.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
          name,
          argsJson: argsRaw.length > 0 ? argsRaw : '{}',
        });
      }
    }

    // Some Groq-hosted reasoning models (qwen3, gpt-oss) occasionally leak
    // their internal <think>…</think> trace into `content` when no tool was
    // chosen. Strip it so callers (especially the title summariser) don't
    // surface reasoning as user-visible text.
    let content = typeof message.content === 'string' ? message.content : null;
    if (content) {
      content = content
        .replace(/<think[\s\S]*?<\/think>/gi, '')
        .replace(/<\|channel\|>[\s\S]*?(?=<\|message\|>|$)/g, '')
        .replace(/<\|message\|>/g, '')
        .trim();
      if (!content) content = null;
    }

    const latency = Date.now() - startedAt;
    this.logger.log(
      `Groq completion ok in ${latency}ms (toolCalls=${toolCalls.length}, contentLen=${content?.length ?? 0})`,
    );

    return {
      ok: true,
      result: {
        provider: 'groq',
        content,
        toolCalls,
        tokensIn: raw.usage?.prompt_tokens,
        tokensOut: raw.usage?.completion_tokens,
      },
    };
  }

  // ── OVH ──────────────────────────────────────────────────────────────

  private async callOvh(
    request: LlmCompletionRequest,
  ): Promise<
    { ok: true; result: LlmCompletionResult } | { ok: false; reason: string }
  > {
    const first = await this.callOpenAiCompatible({
      provider: 'ovh',
      url: this.ovhUrl,
      apiKey: this.ovhKey!,
      defaultModel: this.ovhModel,
      modelPattern: OVH_MODEL_PATTERN,
      request,
    });
    if (first.ok) return first;

    // OVH is pay-as-you-go — it should never fail under normal operation, so a
    // failure here is almost always a misconfigured OVH_MODEL (catalog id
    // typo, decommissioned model, or a Mistral.ai-format id pasted into the
    // OVH env). Self-heal by retrying ONCE with OVH_DEFAULT_MODEL when the
    // configured model is non-default and OVH responded 404 model-not-found.
    // Loudly warn so ops sees the misconfig in container logs.
    const reason = (first as { reason: string }).reason;
    const isModelNotFound =
      reason.startsWith('http_404') &&
      /model.*(does not exist|not found|unknown)|unknown.*model/i.test(reason);
    if (isModelNotFound && this.ovhModel !== OVH_DEFAULT_MODEL) {
      this.logger.warn(
        `OVH rejected configured model "${this.ovhModel}" (404 model-not-found). ` +
          `Retrying with default "${OVH_DEFAULT_MODEL}". ` +
          `Fix OVH_MODEL in /opt/opauto/.env to silence this warning.`,
      );
      return this.callOpenAiCompatible({
        provider: 'ovh',
        url: this.ovhUrl,
        apiKey: this.ovhKey!,
        defaultModel: OVH_DEFAULT_MODEL,
        modelPattern: OVH_MODEL_PATTERN,
        request,
      });
    }

    return first;
  }

  // ── Cerebras ─────────────────────────────────────────────────────────

  private async callCerebras(
    request: LlmCompletionRequest,
  ): Promise<
    { ok: true; result: LlmCompletionResult } | { ok: false; reason: string }
  > {
    return this.callOpenAiCompatible({
      provider: 'cerebras',
      url: CEREBRAS_URL,
      apiKey: this.cerebrasKey!,
      defaultModel: CEREBRAS_MODEL,
      modelPattern: CEREBRAS_MODEL_PATTERN,
      request,
    });
  }

  // ── Mistral ──────────────────────────────────────────────────────────

  private async callMistral(
    request: LlmCompletionRequest,
  ): Promise<
    { ok: true; result: LlmCompletionResult } | { ok: false; reason: string }
  > {
    return this.callOpenAiCompatible({
      provider: 'mistral',
      url: MISTRAL_URL,
      apiKey: this.mistralKey!,
      defaultModel: MISTRAL_MODEL,
      modelPattern: MISTRAL_MODEL_PATTERN,
      request,
    });
  }

  /**
   * Shared OpenAI-compatible chat-completions caller. Used by Cerebras,
   * Mistral, and any future OpenAI-shape provider. Groq stays on its own
   * implementation because it carries a couple of provider-specific quirks
   * (reasoning-trace stripping, tool_call_json_parse retry semantics) that
   * we don't want bleeding into other providers.
   */
  private async callOpenAiCompatible(opts: {
    provider: 'cerebras' | 'mistral' | 'ovh';
    url: string;
    apiKey: string;
    defaultModel: string;
    modelPattern: RegExp;
    request: LlmCompletionRequest;
  }): Promise<
    { ok: true; result: LlmCompletionResult } | { ok: false; reason: string }
  > {
    const { provider, url, apiKey, defaultModel, modelPattern, request } = opts;
    const startedAt = Date.now();
    const model =
      request.model && modelPattern.test(request.model)
        ? request.model
        : defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: request.messages.map((m) => this.toOpenAiMessage(m)),
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    };
    if (typeof request.temperature === 'number') {
      body.temperature = request.temperature;
    }
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => this.toOpenAiTool(t));
      body.tool_choice = 'auto';
    }

    let raw: GroqResponse;
    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await this.safeText(response);
        return {
          ok: false,
          reason: `http_${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        };
      }
      raw = (await response.json()) as GroqResponse;
    } catch (err) {
      return { ok: false, reason: this.errMessage(err) };
    }

    const choice = raw.choices?.[0];
    const message = choice?.message;
    if (!message) {
      return { ok: false, reason: 'missing_message' };
    }

    const toolCalls: LlmToolCall[] = [];
    if (Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        const name = tc.function?.name;
        const argsRaw = tc.function?.arguments ?? '';
        if (typeof name !== 'string' || name.length === 0) {
          return { ok: false, reason: 'tool_call_missing_name' };
        }
        try {
          if (argsRaw.length > 0) {
            JSON.parse(argsRaw);
          }
        } catch (err) {
          return {
            ok: false,
            reason: `tool_call_json_parse_${this.errMessage(err)}`,
          };
        }
        toolCalls.push({
          id: tc.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
          name,
          argsJson: argsRaw.length > 0 ? argsRaw : '{}',
        });
      }
    }

    const content =
      typeof message.content === 'string' && message.content.length > 0
        ? message.content
        : null;

    const latency = Date.now() - startedAt;
    this.logger.log(
      `${provider[0].toUpperCase()}${provider.slice(1)} completion ok in ${latency}ms (toolCalls=${toolCalls.length}, contentLen=${content?.length ?? 0})`,
    );

    return {
      ok: true,
      result: {
        provider,
        content,
        toolCalls,
        tokensIn: raw.usage?.prompt_tokens,
        tokensOut: raw.usage?.completion_tokens,
      },
    };
  }

  // ── Claude ───────────────────────────────────────────────────────────

  private async callClaude(
    request: LlmCompletionRequest,
  ): Promise<
    { ok: true; result: LlmCompletionResult } | { ok: false; reason: string }
  > {
    const startedAt = Date.now();

    // Claude requires `system` as a top-level string and only `user`/`assistant`
    // entries in `messages`. Tool results map to a structured user message.
    const { system, messages } = this.toClaudePayload(request.messages);
    const body: Record<string, unknown> = {
      model: CLAUDE_MODEL,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages,
    };
    if (system.length > 0) {
      body.system = system;
    }
    if (typeof request.temperature === 'number') {
      body.temperature = request.temperature;
    }
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => this.toClaudeTool(t));
    }

    let raw: ClaudeResponse;
    try {
      const response = await this.fetchWithTimeout(CLAUDE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicKey!,
          'anthropic-version': CLAUDE_VERSION,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await this.safeText(response);
        return {
          ok: false,
          reason: `http_${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        };
      }
      raw = (await response.json()) as ClaudeResponse;
    } catch (err) {
      return { ok: false, reason: this.errMessage(err) };
    }

    if (!Array.isArray(raw.content)) {
      return { ok: false, reason: 'missing_content' };
    }

    let textOut = '';
    const toolCalls: LlmToolCall[] = [];
    for (const block of raw.content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        textOut += block.text;
      } else if (block.type === 'tool_use') {
        if (typeof block.name !== 'string' || block.name.length === 0) {
          return { ok: false, reason: 'tool_use_missing_name' };
        }
        let argsJson: string;
        try {
          argsJson = JSON.stringify(block.input ?? {});
        } catch (err) {
          return {
            ok: false,
            reason: `tool_use_serialize_${this.errMessage(err)}`,
          };
        }
        toolCalls.push({
          id: block.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
          name: block.name,
          argsJson,
        });
      }
    }

    const content = textOut.length > 0 ? textOut : null;

    const latency = Date.now() - startedAt;
    this.logger.log(
      `Claude completion ok in ${latency}ms (toolCalls=${toolCalls.length}, contentLen=${content?.length ?? 0})`,
    );

    return {
      ok: true,
      result: {
        provider: 'claude',
        content,
        toolCalls,
        tokensIn: raw.usage?.input_tokens,
        tokensOut: raw.usage?.output_tokens,
      },
    };
  }

  // ── Gemini ───────────────────────────────────────────────────────────

  private async callGemini(
    request: LlmCompletionRequest,
  ): Promise<
    { ok: true; result: LlmCompletionResult } | { ok: false; reason: string }
  > {
    const startedAt = Date.now();
    const { systemInstruction, contents } = this.toGeminiPayload(
      request.messages,
    );
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(typeof request.temperature === 'number'
          ? { temperature: request.temperature }
          : {}),
      },
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (request.tools && request.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: request.tools.map((t) => this.toGeminiTool(t)),
        },
      ];
    }

    // request.model is set by callers expecting Groq's model ids. Only honour
    // it when it actually refers to a Gemini model — otherwise fall back to
    // our default so cross-provider routing doesn't 404.
    const model =
      request.model && /^gemini[-/]/i.test(request.model)
        ? request.model
        : GEMINI_MODEL;
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${this.geminiKey}`;

    let raw: GeminiResponse;
    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await this.safeText(response);
        return {
          ok: false,
          reason: `http_${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        };
      }
      raw = (await response.json()) as GeminiResponse;
    } catch (err) {
      return { ok: false, reason: this.errMessage(err) };
    }

    const candidate = raw.candidates?.[0];
    if (!candidate?.content?.parts) {
      return { ok: false, reason: 'missing_content' };
    }

    let textOut = '';
    const toolCalls: LlmToolCall[] = [];
    for (const part of candidate.content.parts) {
      if (typeof part.text === 'string') {
        textOut += part.text;
      } else if (part.functionCall) {
        const name = part.functionCall.name;
        if (typeof name !== 'string' || name.length === 0) {
          return { ok: false, reason: 'tool_call_missing_name' };
        }
        let argsJson: string;
        try {
          argsJson = JSON.stringify(part.functionCall.args ?? {});
        } catch (err) {
          return {
            ok: false,
            reason: `tool_call_serialize_${this.errMessage(err)}`,
          };
        }
        toolCalls.push({
          id: `call_${Math.random().toString(36).slice(2, 10)}`,
          name,
          argsJson,
        });
      }
    }

    const content = textOut.length > 0 ? textOut : null;
    const latency = Date.now() - startedAt;
    this.logger.log(
      `Gemini completion ok in ${latency}ms (toolCalls=${toolCalls.length}, contentLen=${content?.length ?? 0})`,
    );

    return {
      ok: true,
      result: {
        provider: 'gemini',
        content,
        toolCalls,
        tokensIn: raw.usageMetadata?.promptTokenCount,
        tokensOut: raw.usageMetadata?.candidatesTokenCount,
      },
    };
  }

  private toGeminiTool(t: ToolDescriptor): Record<string, unknown> {
    return {
      name: t.name,
      description: t.description,
      parameters: this.sanitizeForGeminiSchema(t.parameters),
    };
  }

  /**
   * Gemini's function-declaration parser is a strict subset of JSON Schema
   * (closer to OpenAPI 3.0 schema) and rejects a handful of fields that our
   * OpenAI/Claude-shaped tool params commonly use. Strip them recursively
   * so the same tool definitions work across providers.
   *
   * Verified rejection set from live failures:
   *  - additionalProperties
   *  - exclusiveMinimum / exclusiveMaximum
   * Defensively stripped (likely or known to fail in some forms):
   *  - $schema, definitions, $ref, $defs
   *  - multipleOf, patternProperties
   *  - default (some shapes)
   */
  private sanitizeForGeminiSchema(node: unknown): unknown {
    if (Array.isArray(node)) {
      return node.map((n) => this.sanitizeForGeminiSchema(n));
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (GEMINI_SCHEMA_BLOCKLIST.has(k)) continue;
        out[k] = this.sanitizeForGeminiSchema(v);
      }
      return out;
    }
    return node;
  }

  /**
   * Convert our normalized message log into Gemini's `contents` array plus
   * a separate `systemInstruction`. Gemini uses 'user' / 'model' roles only;
   * tool calls and tool results are encoded as `functionCall` /
   * `functionResponse` parts within those roles.
   */
  private toGeminiPayload(messages: LlmMessage[]): {
    systemInstruction: string;
    contents: Array<Record<string, unknown>>;
  } {
    const systemParts: string[] = [];
    const contents: Array<Record<string, unknown>> = [];

    for (const m of messages) {
      if (m.role === 'system') {
        if (m.content) systemParts.push(m.content);
        continue;
      }

      if (m.role === 'tool') {
        // Tool results: a 'user' message with a functionResponse part. Gemini
        // expects an object for `response`; if the tool returned a string,
        // wrap it so the API doesn't reject the payload.
        let response: unknown;
        try {
          response = m.content ? JSON.parse(m.content) : {};
        } catch {
          response = { result: m.content ?? '' };
        }
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                // Best-effort: we don't carry tool name through tool-role
                // messages, so use a stable placeholder. Gemini matches by
                // position in practice.
                name: 'tool',
                response,
              },
            },
          ],
        });
        continue;
      }

      if (m.role === 'assistant') {
        const parts: Array<Record<string, unknown>> = [];
        if (m.content && m.content.length > 0) {
          parts.push({ text: m.content });
        }
        if (m.toolCalls) {
          for (const tc of m.toolCalls) {
            let args: unknown = {};
            try {
              args = tc.argsJson ? JSON.parse(tc.argsJson) : {};
            } catch {
              args = {};
            }
            parts.push({ functionCall: { name: tc.name, args } });
          }
        }
        contents.push({
          role: 'model',
          parts: parts.length > 0 ? parts : [{ text: m.content ?? '' }],
        });
        continue;
      }

      // user
      contents.push({ role: 'user', parts: [{ text: m.content ?? '' }] });
    }

    return { systemInstruction: systemParts.join('\n\n'), contents };
  }

  // ── Translation helpers ──────────────────────────────────────────────

  private toOpenAiMessage(m: LlmMessage): Record<string, unknown> {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: m.toolCallId ?? '',
        content: m.content ?? '',
      };
    }
    if (m.role === 'assistant') {
      const out: Record<string, unknown> = {
        role: 'assistant',
        content: m.content ?? '',
      };
      if (m.toolCalls && m.toolCalls.length > 0) {
        out.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.argsJson },
        }));
      }
      return out;
    }
    return { role: m.role, content: m.content ?? '' };
  }

  private toOpenAiTool(t: ToolDescriptor): Record<string, unknown> {
    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    };
  }

  private toClaudeTool(t: ToolDescriptor): Record<string, unknown> {
    return {
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    };
  }

  private toClaudePayload(messages: LlmMessage[]): {
    system: string;
    messages: Array<Record<string, unknown>>;
  } {
    const systemParts: string[] = [];
    const out: Array<Record<string, unknown>> = [];

    for (const m of messages) {
      if (m.role === 'system') {
        if (m.content) systemParts.push(m.content);
        continue;
      }

      if (m.role === 'tool') {
        // Claude expresses tool results as a user-role message containing a
        // tool_result content block.
        out.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId ?? '',
              content: m.content ?? '',
            },
          ],
        });
        continue;
      }

      if (m.role === 'assistant') {
        const blocks: Array<Record<string, unknown>> = [];
        if (m.content && m.content.length > 0) {
          blocks.push({ type: 'text', text: m.content });
        }
        if (m.toolCalls) {
          for (const tc of m.toolCalls) {
            let input: unknown = {};
            try {
              input = tc.argsJson ? JSON.parse(tc.argsJson) : {};
            } catch {
              input = {};
            }
            blocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input,
            });
          }
        }
        out.push({
          role: 'assistant',
          content: blocks.length > 0 ? blocks : (m.content ?? ''),
        });
        continue;
      }

      // user
      out.push({ role: 'user', content: m.content ?? '' });
    }

    return { system: systemParts.join('\n\n'), messages: out };
  }

  // ── Plumbing ─────────────────────────────────────────────────────────

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async safeText(response: Response): Promise<string | null> {
    try {
      return await response.text();
    } catch {
      return null;
    }
  }

  private errMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }

  /**
   * Apply the optional caller-side result validator. If the request didn't
   * supply one, the result passes through unchanged. If the validator throws,
   * we surface that as a rejection so the chain advances rather than aborting
   * the whole turn.
   */
  private runValidator(
    result: LlmCompletionResult,
    request: LlmCompletionRequest,
  ): LlmValidationOutcome {
    if (!request.validateResult) return { ok: true, result };
    try {
      return request.validateResult(result);
    } catch (err) {
      return { ok: false, reason: `validator_threw_${this.errMessage(err)}` };
    }
  }
}
