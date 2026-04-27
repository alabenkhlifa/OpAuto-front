import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmCompletionRequest,
  LlmCompletionResult,
  LlmMessage,
  LlmToolCall,
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

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
// Match the model id used in the existing AiService so we share a single
// Anthropic version across the codebase. Bumping to a newer Sonnet should be
// done in one place when ready.
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLAUDE_VERSION = '2023-06-01';

// Gemini free tier: 250k TPM (vs Groq's 6k) — primary provider so a single
// query can't saturate the per-minute budget. Flash gives 10 RPM / 250 RPD
// which is enough for the demo; bump to Pro when paid.
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.5-flash';

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
 * Order: Gemini (250k TPM, primary) → Groq (fast 8b model, secondary) →
 * Claude (quality, last resort). On any recoverable failure (network,
 * non-2xx, malformed tool-call JSON) we fall through. If everything is
 * unavailable or unconfigured, we return a `mock` result with content
 * rather than throwing — the orchestrator depends on always receiving a
 * result so it can persist a graceful assistant message.
 */
@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);
  private readonly geminiKey: string | undefined;
  private readonly groqKey: string | undefined;
  private readonly anthropicKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.geminiKey = this.config.get<string>('GEMINI_API_KEY');
    this.groqKey = this.config.get<string>('GROQ_API_KEY');
    this.anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (!this.geminiKey && !this.groqKey && !this.anthropicKey) {
      this.logger.warn(
        'No LLM provider configured (GEMINI_API_KEY / GROQ_API_KEY / ANTHROPIC_API_KEY missing); returning mock completion',
      );
      return {
        provider: 'mock',
        content:
          "I can't reach an LLM provider right now — no API key is configured on the server.",
        toolCalls: [],
      };
    }

    if (this.geminiKey) {
      const gem = await this.callGemini(request);
      if (gem.ok) return gem.result;
      this.logger.warn(
        `Gemini failed (${(gem as { reason: string }).reason}); falling back to Groq`,
      );
    }

    if (this.groqKey) {
      const groq = await this.callGroq(request);
      if (groq.ok) {
        return groq.result;
      }
      const reason = (groq as { reason: string }).reason;

      // Llama 3.3 sometimes chokes when given many tool schemas. The
      // user-visible failure is `tool_use_failed`. Retry the SAME prompt
      // against Groq without the tools — the model can still compose a
      // helpful text answer (no data lookup, but a coherent response is
      // far better than the mock apology).
      //
      // We also inject a "no tools available" system message so the model
      // doesn't hallucinate fake tool calls (e.g. "Je vais utiliser l'outil
      // ..."). Without this, the model still tries to act on the original
      // tool descriptions in the system prompt.
      if (
        request.tools &&
        request.tools.length > 0 &&
        (reason.includes('tool_use_failed') || reason.includes('tool_call_'))
      ) {
        this.logger.warn(`Groq tool-call failed (${reason}); retrying without tools`);
        const noToolsMessages: LlmMessage[] = [
          ...request.messages,
          {
            role: 'system',
            content:
              "IMPORTANT: tool calls are temporarily unavailable for this turn. Do NOT describe calling any tool, do NOT use placeholders like '(tool result)' or '(call to tool)', and do NOT promise to look something up. If the user asked for specific data you would need a tool for, briefly apologize that you can't fetch it right now and ask them to retry or rephrase. Otherwise answer their question directly using your general knowledge.",
          },
        ];
        const retry = await this.callGroq({
          ...request,
          messages: noToolsMessages,
          tools: undefined,
        });
        if (retry.ok) {
          return retry.result;
        }
        this.logger.warn(
          `Groq tools-less retry also failed (${(retry as { reason: string }).reason})`,
        );
      } else {
        this.logger.warn(`Groq failed (${reason}); falling back to Claude`);
      }
    }

    if (this.anthropicKey) {
      const claude = await this.callClaude(request);
      if (claude.ok) {
        return claude.result;
      }
      this.logger.warn(
        `Claude failed (${(claude as { reason: string }).reason})`,
      );
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
    | { ok: true; result: LlmCompletionResult }
    | { ok: false; reason: string }
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
    let content =
      typeof message.content === 'string' ? message.content : null;
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

  // ── Claude ───────────────────────────────────────────────────────────

  private async callClaude(
    request: LlmCompletionRequest,
  ): Promise<
    | { ok: true; result: LlmCompletionResult }
    | { ok: false; reason: string }
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
    | { ok: true; result: LlmCompletionResult }
    | { ok: false; reason: string }
  > {
    const startedAt = Date.now();
    const { systemInstruction, contents } = this.toGeminiPayload(request.messages);
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
}
