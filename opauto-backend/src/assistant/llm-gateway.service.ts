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
// openai/gpt-oss-20b is OpenAI's open-weight model hosted on Groq. Tool-call
// reliability with large schemas (~25 tools) is markedly better than
// llama-3.3-70b-versatile, which consistently emits malformed JSON in this
// configuration. Keep llama-3.3 commented for quick A/B if needed.
const GROQ_MODEL = 'openai/gpt-oss-20b';
// const GROQ_MODEL = 'llama-3.3-70b-versatile';

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
// Match the model id used in the existing AiService so we share a single
// Anthropic version across the codebase. Bumping to a newer Sonnet should be
// done in one place when ready.
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLAUDE_VERSION = '2023-06-01';

const DEFAULT_TIMEOUT_MS = 30_000;
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

/**
 * Provider-agnostic completion gateway.
 *
 * Order: Groq (fast/cheap) → Claude (quality fallback). On any recoverable
 * failure (network, non-2xx, malformed tool-call JSON) we fall through. If
 * both providers are unavailable or unconfigured, we return a `mock` result
 * with content rather than throwing — the orchestrator depends on always
 * receiving a result so it can persist a graceful assistant message.
 */
@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);
  private readonly groqKey: string | undefined;
  private readonly anthropicKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.groqKey = this.config.get<string>('GROQ_API_KEY');
    this.anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (!this.groqKey && !this.anthropicKey) {
      this.logger.warn(
        'No LLM provider configured (GROQ_API_KEY / ANTHROPIC_API_KEY missing); returning mock completion',
      );
      return {
        provider: 'mock',
        content:
          "I can't reach an LLM provider right now — no API key is configured on the server.",
        toolCalls: [],
      };
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

    const content = typeof message.content === 'string' ? message.content : null;

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
