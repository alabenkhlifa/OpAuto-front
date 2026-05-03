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

  constructor() {
    // I-011 — `coerceTypes: 'array'` lets AJV repair the type-coercion gaps
    // we saw in the behavior sweep:
    //   - `"limit": "5"` → `"limit": 5` (numeric string → integer)
    //   - `"attachInvoiceIds": "abc"` → `"attachInvoiceIds": ["abc"]`
    //     (single value → array<single>)
    // Without this, the LLM's perfectly reasonable string-encoded ints would
    // get rejected by AJV, the orchestrator would loop, and the turn would
    // burn out the iteration cap. Mutates the validated args in place so
    // downstream `execute()` calls see the coerced values too.
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      useDefaults: false,
      coerceTypes: 'array',
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
    this.logger.debug(`Registered tool "${tool.name}" (blastTier=${tool.blastTier})`);
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
      if (tool.requiredModule && !ctx.enabledModules.includes(tool.requiredModule)) {
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

    const valid = validator(args);
    if (valid) {
      return { valid: true };
    }

    const errors = (validator.errors ?? []).map((err) => {
      const where = err.instancePath || '(root)';
      return `${where} ${err.message ?? 'is invalid'}`.trim();
    });
    this.logger.warn(`validateArgs: tool "${toolName}" failed validation: ${errors.join('; ')}`);
    return { valid: false, errors };
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
      const handlerPromise = Promise.resolve().then(() => tool.handler(args, ctx));
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      });

      const result = await Promise.race([handlerPromise, timeoutPromise]);
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
