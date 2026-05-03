export type AssistantLocale = 'en' | 'fr' | 'ar';

export type AssistantMessageRole = 'USER' | 'ASSISTANT' | 'TOOL' | 'SYSTEM';

export type AssistantBlastTier =
  | 'READ'
  | 'AUTO_WRITE'
  | 'CONFIRM_WRITE'
  | 'TYPED_CONFIRM_WRITE';

export type AssistantToolCallStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'DENIED'
  | 'EXECUTED'
  | 'FAILED'
  | 'EXPIRED';

export interface AssistantPageContext {
  route?: string;
  params?: Record<string, string>;
  selectedEntity?: {
    type: string;
    id: string;
    displayName?: string;
  };
}

export interface AssistantConversationSummary {
  id: string;
  title: string | null;
  pinned: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: AssistantMessageRole;
  content: string;
  toolCallId?: string | null;
  skillUsed?: string | null;
  agentUsed?: string | null;
  createdAt: string;
}

export interface AssistantToolCallView {
  id: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  status: AssistantToolCallStatus;
  blastTier: AssistantBlastTier;
  expiresAt?: string;
  durationMs?: number;
  errorMessage?: string;
}

export type AssistantSseEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; toolCallId: string; name: string; args: unknown }
  | {
      type: 'tool_result';
      toolCallId: string;
      result: unknown;
      status: 'executed' | 'failed' | 'denied';
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

export interface AssistantChatRequest {
  conversationId?: string;
  userMessage: string;
  locale?: AssistantLocale;
  pageContext?: AssistantPageContext;
}

export interface AssistantApprovalDecision {
  decision: 'approve' | 'deny';
  typedConfirmation?: string;
}

export interface AssistantRegistry {
  tools: { name: string; description: string; parameters: unknown }[];
  skills: { name: string; description: string }[];
  agents: { name: string; description: string }[];
}

export type AssistantPanelState = 'closed' | 'open' | 'minimized';

export type AssistantVoiceMode = 'idle' | 'listening' | 'speaking' | 'unsupported';

export interface AssistantPendingApproval {
  toolCallId: string;
  toolName: string;
  args: unknown;
  blastTier: AssistantBlastTier;
  expiresAt: string;
  receivedAt: number;
}

export interface AssistantUiMessage extends AssistantMessage {
  toolCall?: AssistantToolCallView;
  pendingApproval?: AssistantPendingApproval;
  agent?: { name: string; result?: string };
  skill?: { name: string };
  isStreaming?: boolean;
  error?: string;
}
