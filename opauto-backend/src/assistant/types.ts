import { AssistantBlastTier, AssistantMessageRole, AssistantToolCallStatus } from '@prisma/client';

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
  resolveBlastTier?: (args: TArgs, ctx: AssistantUserContext) => AssistantBlastTier;
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
}

export interface LlmCompletionResult {
  provider: 'groq' | 'claude' | 'openai' | 'gemini' | 'mock';
  content: string | null;
  toolCalls: LlmToolCall[];
  tokensIn?: number;
  tokensOut?: number;
}

export type SseEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; toolCallId: string; name: string; args: unknown }
  | { type: 'tool_result'; toolCallId: string; result: unknown; status: 'executed' | 'failed' }
  | { type: 'approval_request'; toolCallId: string; toolName: string; args: unknown; blastTier: AssistantBlastTier; expiresAt: string }
  | { type: 'agent_dispatch'; agentName: string; reason?: string }
  | { type: 'agent_result'; agentName: string; result: string }
  | { type: 'skill_loaded'; skillName: string }
  | { type: 'budget_exceeded'; message: string }
  | { type: 'error'; message: string }
  | { type: 'done'; messageId?: string };
