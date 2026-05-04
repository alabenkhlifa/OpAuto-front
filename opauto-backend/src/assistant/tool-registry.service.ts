import { Injectable, Logger } from '@nestjs/common';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import {
  AssistantBlastTier,
  AssistantUserContext,
  ToolDefinition,
  ToolDescriptor,
} from './types';

export interface ToolValidationResult {
  valid: boolean;
  errors?: string[];
}

export type ToolExecutionResult =
  | { ok: true; result: unknown; durationMs: number }
  | { ok: false; error: string; durationMs: number };

export interface ToolExecutionOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly validators = new Map<string, ValidateFunction>();
  private readonly ajv: Ajv;
  // I-011 observability — dedupe warns to one per (tool, kind, path).
  private readonly coercionWarnSeen = new Set<string>();

  constructor() {
    // I-011 — repair the type-coercion gaps we saw in the behavior sweep so
    // the LLM's perfectly reasonable string-encoded ints / single-id strings /
    // hallucinated extra fields don't trigger an `invalid_arguments` retry
    // loop that burns out the per-turn iteration cap.
    //
    //   - `coerceTypes: 'array'`     "limit": "5"           → 5
    //                                "attachInvoiceIds": "x" → ["x"]
    //   - `removeAdditional: true`   strips unknown keys when the tool's
    //                                schema has `additionalProperties: false`
    //                                (B-12 hit "(root) must NOT have additional
    //                                properties" when Llama added a stray
    //                                `customerId` to `cancel_appointment`).
    //
    // Mutations land on the caller's args object so downstream `execute()`
    // sees the coerced/cleaned shape.
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      useDefaults: false,
      coerceTypes: 'array',
      removeAdditional: true,
    });
    addFormats(this.ajv);
  }

  register(tool: ToolDefinition): void {
    let validator: ValidateFunction;
    try {
      validator = this.ajv.compile(tool.parameters);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `ToolRegistryService.register: invalid JSON Schema for tool "${tool.name}": ${message}`,
      );
    }

    this.tools.set(tool.name, tool);
    this.validators.set(tool.name, validator);
    this.logger.debug(
      `Registered tool "${tool.name}" (blastTier=${tool.blastTier})`,
    );
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Names of every registered tool, regardless of role/module gating. Used by
   * the orchestrator's leak detector (I-013) to identify bare-name tool-call
   * dumps on compose-only turns.
   */
  listAllNames(): string[] {
    return Array.from(this.tools.keys());
  }

  listForUser(ctx: AssistantUserContext): ToolDescriptor[] {
    const descriptors: ToolDescriptor[] = [];
    for (const tool of this.tools.values()) {
      if (
        tool.requiredModule &&
        !ctx.enabledModules.includes(tool.requiredModule)
      ) {
        continue;
      }
      if (tool.requiredRole === 'OWNER' && ctx.role !== 'OWNER') {
        continue;
      }
      descriptors.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      });
    }
    this.logger.debug(
      `listForUser: returning ${descriptors.length}/${this.tools.size} tools for user=${ctx.userId} role=${ctx.role}`,
    );
    return descriptors;
  }

  validateArgs(toolName: string, args: unknown): ToolValidationResult {
    const validator = this.validators.get(toolName);
    if (!validator) {
      this.logger.warn(`validateArgs: tool "${toolName}" is not registered`);
      return { valid: false, errors: [`Unknown tool: ${toolName}`] };
    }

    // I-011 observability — snapshot the pre-validate args so we can diff
    // against the post-validate (mutated) shape and emit a one-time warn per
    // (tool, kind, path). Cheap: tool args are always small JSON.
    const before = this.snapshotArgs(args);
    const valid = validator(args);

    if (valid) {
      this.reportCoercions(toolName, before, args);
      return { valid: true };
    }

    const errors = (validator.errors ?? []).map((err) => {
      const where = err.instancePath || '(root)';
      return `${where} ${err.message ?? 'is invalid'}`.trim();
    });
    this.logger.warn(
      `validateArgs: tool "${toolName}" failed validation: ${errors.join('; ')}`,
    );
    return { valid: false, errors };
  }

  /**
   * I-011 — deep-snapshot args before AJV mutates them so we can diff and
   * report what got coerced or stripped. Returns `undefined` for non-objects
   * (which `validateArgs` will short-circuit anyway).
   */
  private snapshotArgs(args: unknown): unknown {
    if (args === null || typeof args !== 'object') return args;
    try {
      return JSON.parse(JSON.stringify(args));
    } catch {
      return undefined;
    }
  }

  /**
   * I-011 — compare the pre-validate snapshot to the post-validate (mutated)
   * args. For each top-level property that was either stripped (present
   * before, absent after) or coerced (different type/value after), emit a
   * one-time warn keyed by `(tool, kind, path)`.
   *
   * Goal: give us visibility into how often the validator boundary saves a
   * turn — if a (tool, property) shows up here in production, we know the
   * LLM keeps drifting on it and we can tighten the tool description.
   */
  private reportCoercions(
    toolName: string,
    before: unknown,
    after: unknown,
  ): void {
    if (
      !before ||
      !after ||
      typeof before !== 'object' ||
      typeof after !== 'object' ||
      Array.isArray(before) ||
      Array.isArray(after)
    ) {
      return;
    }
    const beforeRecord = before as Record<string, unknown>;
    const afterRecord = after as Record<string, unknown>;

    const seenKeys = new Set<string>([
      ...Object.keys(beforeRecord),
      ...Object.keys(afterRecord),
    ]);

    for (const key of seenKeys) {
      const had = key in beforeRecord;
      const has = key in afterRecord;

      if (had && !has) {
        this.warnOnce(toolName, 'strip', key);
        continue;
      }
      if (!had || !has) continue;

      const beforeJson = JSON.stringify(beforeRecord[key]);
      const afterJson = JSON.stringify(afterRecord[key]);
      if (beforeJson !== afterJson) {
        this.warnOnce(toolName, 'coerce', key, beforeJson, afterJson);
      }
    }
  }

  private warnOnce(
    toolName: string,
    kind: 'strip' | 'coerce',
    path: string,
    beforeJson?: string,
    afterJson?: string,
  ): void {
    const dedupeKey = `${toolName}::${kind}::${path}`;
    if (this.coercionWarnSeen.has(dedupeKey)) return;
    this.coercionWarnSeen.add(dedupeKey);

    if (kind === 'strip') {
      this.logger.warn(
        `coercion: stripped extra property tool="${toolName}" path="${path}" — LLM emitted a field not in the schema; tighten the tool description if this recurs.`,
      );
    } else {
      this.logger.warn(
        `coercion: coerced value tool="${toolName}" path="${path}" before=${beforeJson} after=${afterJson} — LLM emitted the wrong type; consider adding the right shape hint to the tool description.`,
      );
    }
  }

  resolveBlastTier(
    tool: ToolDefinition,
    args: unknown,
    ctx: AssistantUserContext,
  ): AssistantBlastTier {
    if (typeof tool.resolveBlastTier === 'function') {
      try {
        return tool.resolveBlastTier(args, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `resolveBlastTier: tool "${tool.name}" dynamic resolver threw, falling back to static tier: ${message}`,
        );
        return tool.blastTier;
      }
    }
    return tool.blastTier;
  }

  async execute(
    toolName: string,
    args: unknown,
    ctx: AssistantUserContext,
    opts: ToolExecutionOptions = {},
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolName);
    const startedAt = Date.now();
    if (!tool) {
      return {
        ok: false,
        error: `Unknown tool: ${toolName}`,
        durationMs: Date.now() - startedAt,
      };
    }

    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let timer: NodeJS.Timeout | undefined;

    try {
      const handlerPromise = Promise.resolve().then(() =>
        tool.handler(args, ctx),
      );
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      });

      const result = await Promise.race([handlerPromise, timeoutPromise]);
      // B-XX bookkeeping — track per-turn READ-tier executions so write tools
      // (notably send_email) can refuse to compose "no data" replies when no
      // read actually ran. Caller opts in by setting ctx.turnState; legacy
      // callers see a no-op.
      if (
        ctx.turnState !== undefined &&
        tool.blastTier === AssistantBlastTier.READ
      ) {
        ctx.turnState.readToolCallsSoFar += 1;
      }
      return { ok: true, result, durationMs: Date.now() - startedAt };
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'timeout') {
        this.logger.warn(
          `execute: tool "${toolName}" exceeded ${timeoutMs}ms timeout (durationMs=${durationMs})`,
        );
        return { ok: false, error: 'timeout', durationMs };
      }
      this.logger.error(
        `execute: tool "${toolName}" threw after ${durationMs}ms: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      return { ok: false, error: message, durationMs };
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
