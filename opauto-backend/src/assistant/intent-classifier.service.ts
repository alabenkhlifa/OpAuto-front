import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from './llm-gateway.service';
import { Locale } from './types';

const MAX_TOOLS = 5;
const CLASSIFIER_MAX_TOKENS = 120;
// llama-3.1-8b-instant: cheap, non-reasoning, ~30k TPM ceiling on Groq.
// Pairs perfectly with this short JSON-extraction task. The orchestrator's
// main loop keeps the heavier primary model (openai/gpt-oss-20b) for
// real tool-calling reasoning.
const CLASSIFIER_MODEL = 'llama-3.1-8b-instant';

export interface ClassifyArgs {
  userMessage: string;
  locale: Locale;
  candidates: { name: string; description: string }[];
}

/**
 * Lightweight pre-filter that picks at most 5 tools likely relevant to the
 * user's message. Sends just `{name, description}` pairs (no JSON schemas)
 * to the LLM, so it stays cheap (~600-800 input tokens vs ~4500 for the
 * full registry). The orchestrator then sends ONLY the picked tools to the
 * selection call, keeping each per-turn TPM well under Groq's 8000 free-tier
 * limit.
 *
 * Returns:
 *  - `string[]` — the tool names to surface to the orchestrator. May be empty
 *    (genuine chitchat — no tools needed).
 *  - `null` — classifier failed (LLM error, malformed JSON, timeout). The
 *    orchestrator should fall back to the full tool list so we never block
 *    a turn on a flaky classifier.
 */
@Injectable()
export class IntentClassifierService {
  private readonly logger = new Logger(IntentClassifierService.name);

  constructor(private readonly llm: LlmGatewayService) {}

  async classify(args: ClassifyArgs): Promise<string[] | null> {
    if (args.candidates.length === 0) return [];

    const list = args.candidates
      .map((t) => `- ${t.name}: ${t.description}`)
      .join('\n');

    const systemPrompt = `You are a tool router for a garage management assistant. Given the user's message and a list of tools, pick AT MOST ${MAX_TOOLS} tool names that may help answer the user.

Strict rules:
- Output ONLY a JSON array of strings (tool names from the list). Example: ["get_revenue_summary","list_top_customers"]
- Return [] if the user is just greeting, chatting, asking what you can do, or asking for something no tool can help with.
- Match by the user's intent in any language (the user message may be in English, French, or Arabic).
- Tool names must be EXACT matches from the list below. Never invent names.
- Prefer fewer tools. 1-3 is typical; 5 is the cap.

Tools:
${list}`;

    try {
      const result = await this.llm.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: args.userMessage },
        ],
        temperature: 0,
        maxTokens: CLASSIFIER_MAX_TOKENS,
        model: CLASSIFIER_MODEL,
      });

      const text = (result.content ?? '').trim();
      if (!text) return null;

      // Tolerate the model wrapping the array in prose or markdown fences.
      const match = text.match(/\[[\s\S]*?\]/);
      if (!match) {
        this.logger.warn(`Classifier returned non-array text: ${text.slice(0, 80)}`);
        return null;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        this.logger.warn(`Classifier JSON parse failed: ${match[0].slice(0, 80)}`);
        return null;
      }

      if (!Array.isArray(parsed)) return null;

      const validNames = new Set(args.candidates.map((t) => t.name));
      const picked = parsed
        .filter((x): x is string => typeof x === 'string' && validNames.has(x))
        .slice(0, MAX_TOOLS);

      this.logger.debug(
        picked.length === 0
          ? `Classifier: no tools needed for "${args.userMessage.slice(0, 60)}"`
          : `Classifier picked ${picked.length}/${args.candidates.length} tools: ${picked.join(', ')}`,
      );
      return picked;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Classifier call threw: ${message}`);
      return null;
    }
  }
}
