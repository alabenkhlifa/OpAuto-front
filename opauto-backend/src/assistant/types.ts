import {
  AssistantBlastTier,
  AssistantMessageRole,
  AssistantToolCallStatus,
} from '@prisma/client';

export { AssistantBlastTier, AssistantMessageRole, AssistantToolCallStatus };

export type Locale = 'en' | 'fr' | 'ar';

export interface AssistantUserContext {
  userId: string;
  garageId: string;
  email?: string | null;
  role: 'OWNER' | 'STAFF';
  enabledModules: string[];
  locale: Locale;
}

export interface PageContext {
  route?: string;
  params?: Record<string, string>;
  selectedEntity?: {
    type: string;
    id: string;
    displayName?: string;
  };
}

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  blastTier: AssistantBlastTier;
  requiredModule?: string;
  requiredRole?: 'OWNER' | 'STAFF';
  resolveBlastTier?: (
    args: TArgs,
    ctx: AssistantUserContext,
  ) => AssistantBlastTier;
  handler: (args: TArgs, ctx: AssistantUserContext) => Promise<TResult>;
}

export interface ToolDescriptor {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface SkillDefinition {
  name: string;
  description: string;
  triggers?: string[];
  toolWhitelist?: string[];
  bodyByLocale: Record<Locale, string>;
  /**
   * Marks the skill as internal (test fixture, scratch playbook, etc.) so it
   * is excluded from the router-visible list passed to the LLM. Set via
   * frontmatter `internal: true`.
   */
  internal?: boolean;
}

export interface SkillDescriptor {
  name: string;
  description: string;
}

export interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  toolWhitelist: string[];
  iterationCap: number;
  requiredRole?: 'OWNER' | 'STAFF';
  requiredModule?: string;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCallId?: string;
  toolCalls?: LlmToolCall[];
  name?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  argsJson: string;
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  tools?: ToolDescriptor[];
  temperature?: number;
  maxTokens?: number;
  /**
   * Optional Groq model override for this single call. Defaults to the
   * gateway's primary model when omitted. Useful when a caller has a
   * cheap/non-reasoning task (e.g. intent classification) that pairs
   * better with `llama-3.1-8b-instant` than with the heavier primary.
   */
  model?: string;
  /**
   * Optional caller-side validator run after each provider's successful
   * response and before it's returned. Lets callers reject results that are
   * structurally OK but semantically broken (e.g. tool-call JSON leaked into
   * the `content` field) and trigger fallthrough to the next provider in the
   * chain. May also mutate the result to apply transforms like content
   * scrubbing or salvaged tool-call injection — return the mutated value as
   * `result`.
   */
  validateResult?: (result: LlmCompletionResult) => LlmValidationOutcome;
}

export type LlmValidationOutcome =
  | { ok: true; result: LlmCompletionResult }
  | { ok: false; reason: string };

export interface LlmCompletionResult {
  provider:
    | 'groq'
    | 'claude'
    | 'openai'
    | 'gemini'
    | 'cerebras'
    | 'mistral'
    | 'ovh'
    | 'mock';
  content: string | null;
  toolCalls: LlmToolCall[];
  tokensIn?: number;
  tokensOut?: number;
}

export type SseEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; toolCallId: string; name: string; args: unknown }
  | {
      type: 'tool_result';
      toolCallId: string;
      result: unknown;
      status: 'executed' | 'failed';
    }
  | {
      type: 'approval_request';
      toolCallId: string;
      toolName: string;
      args: unknown;
      blastTier: AssistantBlastTier;
      expiresAt: string;
    }
  | { type: 'agent_dispatch'; agentName: string; reason?: string }
  | { type: 'agent_result'; agentName: string; result: string }
  | { type: 'skill_loaded'; skillName: string }
  | { type: 'budget_exceeded'; message: string }
  | { type: 'error'; message: string }
  | { type: 'done'; messageId?: string };
