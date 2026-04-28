import { LlmToolCall } from './types';

/**
 * Some providers (notably Cerebras qwen, occasionally Groq llama-3.1-8b under
 * tool-list pressure) return tool calls as TEXT inside the `content` field
 * instead of in their structured tool-use field. The orchestrator then sees
 * `toolCalls=[]` and ships the raw JSON straight to the user.
 *
 * Two leak shapes observed in production:
 *  - Raw JSON object (single or semicolon-separated chain):
 *      {"type":"function","name":"send_sms","arguments":{...}};
 *      {"type":"function","name":"find_customer","arguments":{...}}
 *  - XML-ish inline tag:
 *      <function=send_sms>{"to":"+216...","body":"..."}</function>
 *
 * This module is purposefully a set of pure, side-effect-free functions so it
 * can be unit-tested in isolation and reused by the frontend SSE sanitiser via
 * shared regex constants.
 */

export type LeakKind = 'raw_json' | 'xml_tag';

export interface DetectedLeak {
  kind: LeakKind;
  /** The raw matched substrings, in source order. */
  matches: string[];
}

// `<function=name>{...}</function>` — tolerant of whitespace and missing trailing tag.
// We capture name and args separately for salvage. Multiline + non-greedy.
const XML_FUNCTION_TAG_RE =
  /<function\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*>\s*([\s\S]*?)\s*(?:<\/function>|(?=<function\s*=)|$)/gi;

// `{"type":"function","name":"...","arguments":...}` — tolerant of whitespace,
// ordering, and `parameters` vs `arguments`. Captures the whole object.
// Bounded to a single object via brace-counting (handled in matcher); the regex
// just locates the start.
const RAW_FUNCTION_OBJECT_START_RE =
  /\{\s*"type"\s*:\s*"function"\s*,\s*"name"\s*:/g;

/** Detect tool-call-shaped text leaks anywhere in the content. */
export function detectToolCallLeak(content: string | null): DetectedLeak | null {
  if (!content) return null;
  const xml = [...content.matchAll(XML_FUNCTION_TAG_RE)].map((m) => m[0]);
  if (xml.length > 0) {
    return { kind: 'xml_tag', matches: xml };
  }
  const raw = matchAllRawFunctionObjects(content);
  if (raw.length > 0) {
    return { kind: 'raw_json', matches: raw };
  }
  return null;
}

/**
 * Try to recover a SINGLE clean tool call from the leak. Returns the call if:
 *  - exactly one match exists,
 *  - the tool name is in `knownToolNames`,
 *  - args parse as a JSON object (or are absent → `{}`).
 * Otherwise returns null and the caller should fall through to the next provider.
 */
export function salvageToolCall(
  leak: DetectedLeak,
  knownToolNames: ReadonlySet<string>,
  idGenerator: () => string = randomCallId,
): LlmToolCall | null {
  if (leak.matches.length !== 1) return null;
  const match = leak.matches[0];
  if (leak.kind === 'xml_tag') {
    return salvageXmlTag(match, knownToolNames, idGenerator);
  }
  return salvageRawJson(match, knownToolNames, idGenerator);
}

/**
 * Strip every leaked tool-call substring from the content. Used both when we
 * salvage (so the JSON never reaches the user) and as a defensive layer when
 * the structured tool_calls path worked but the model ALSO inlined a JSON dump.
 * Trims leftover whitespace but otherwise preserves prose.
 */
export function scrubLeakFromContent(content: string | null): string | null {
  if (!content) return content;
  // Strip XML tags first.
  let scrubbed = content.replace(XML_FUNCTION_TAG_RE, '');
  // Strip raw `{"type":"function",...}` objects via brace-balanced scan so we
  // correctly handle nested args. Walk back-to-front so removing a span
  // doesn't shift earlier indices. Also consume a trailing `;` and immediate
  // whitespace so the remaining prose reads cleanly.
  const ranges = findRawFunctionObjectRanges(scrubbed);
  for (let i = ranges.length - 1; i >= 0; i--) {
    const [start, end] = ranges[i];
    let consume = end + 1;
    while (consume < scrubbed.length && /[\s;]/.test(scrubbed[consume])) {
      consume++;
    }
    scrubbed = scrubbed.slice(0, start) + scrubbed.slice(consume);
  }
  scrubbed = scrubbed
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
  return scrubbed.length > 0 ? scrubbed : null;
}

/**
 * Thrown by the orchestrator when a leaked tool call cannot be salvaged. The
 * gateway catches this and advances to the next provider in the fallback chain.
 */
export class ProviderToolLeakError extends Error {
  readonly provider: string;
  readonly leakKind: LeakKind;
  readonly callCount: number;

  constructor(provider: string, leak: DetectedLeak) {
    super(
      `Provider ${provider} leaked ${leak.matches.length} tool-call shape(s) of kind=${leak.kind} in content`,
    );
    this.name = 'ProviderToolLeakError';
    this.provider = provider;
    this.leakKind = leak.kind;
    this.callCount = leak.matches.length;
  }
}

// ── internals ────────────────────────────────────────────────────────────────

function salvageXmlTag(
  match: string,
  knownToolNames: ReadonlySet<string>,
  idGenerator: () => string,
): LlmToolCall | null {
  const m = /<function\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*>\s*([\s\S]*?)\s*(?:<\/function>|$)/i.exec(
    match,
  );
  if (!m) return null;
  const name = m[1];
  const argsRaw = (m[2] ?? '').trim();
  if (!knownToolNames.has(name)) return null;
  const argsJson = normalizeArgs(argsRaw);
  if (argsJson === null) return null;
  return { id: idGenerator(), name, argsJson };
}

function salvageRawJson(
  match: string,
  knownToolNames: ReadonlySet<string>,
  idGenerator: () => string,
): LlmToolCall | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(match);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const name = typeof obj.name === 'string' ? obj.name : '';
  if (!name || !knownToolNames.has(name)) return null;
  const args = obj.arguments ?? obj.parameters ?? obj.args ?? {};
  let argsJson: string;
  if (typeof args === 'string') {
    const normalized = normalizeArgs(args);
    if (normalized === null) return null;
    argsJson = normalized;
  } else if (typeof args === 'object' && args !== null) {
    try {
      argsJson = JSON.stringify(args);
    } catch {
      return null;
    }
  } else {
    argsJson = '{}';
  }
  return { id: idGenerator(), name, argsJson };
}

function normalizeArgs(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '{}';
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return '{}';
    }
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

/**
 * Brace-balanced scan to extract complete `{"type":"function",...}` objects.
 * A bare regex can't safely match nested objects in the args field, so we
 * walk forward from each anchor counting braces until we close the object.
 */
function matchAllRawFunctionObjects(content: string): string[] {
  return findRawFunctionObjectRanges(content).map(([s, e]) =>
    content.slice(s, e + 1),
  );
}

function findRawFunctionObjectRanges(content: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const anchor of content.matchAll(RAW_FUNCTION_OBJECT_START_RE)) {
    const start = anchor.index ?? -1;
    if (start < 0) continue;
    const end = findMatchingBrace(content, start);
    if (end > start) {
      out.push([start, end]);
    }
  }
  return out;
}

function findMatchingBrace(content: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < content.length; i++) {
    const ch = content[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function randomCallId(): string {
  return `salvaged_${Math.random().toString(36).slice(2, 10)}`;
}
