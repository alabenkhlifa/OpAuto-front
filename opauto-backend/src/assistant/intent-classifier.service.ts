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

    const systemPrompt = `You are a tool router for a garage management assistant. Given the user's message and a list of tools, pick AT MOST ${MAX_TOOLS} tool names that the assistant will need to fully answer or fulfill the request.

Output rules:
- Output ONLY a JSON array of strings (tool names from the list). Example: ["get_revenue_summary","send_email"]
- Tool names must be EXACT matches from the list below. Never invent names.
- Cap at ${MAX_TOOLS}. 1-3 is typical for read-only Q&A; 2-4 when the user asks to act on data they want fetched.

Picking rules:
- The user message may be in English, French, or Arabic — match by intent.
- ALWAYS include the matching ACTION tool when the user uses an imperative verb that maps to one:
    "send/email/notify" → send_sms or send_email
    "create/book/schedule" → create_appointment
    "cancel" → cancel_appointment
    "record/log a payment" → record_payment
    "generate/produce/export/get a PDF/report" → generate_invoices_pdf or generate_period_report
- When the user asks to act on data they want fetched in the same turn (e.g. "email me a revenue summary"), include BOTH the data-read tool AND the action tool.
- Return [] only when the user is genuinely just greeting, chatting, asking what you can do, or asking for something no tool can help with.

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
