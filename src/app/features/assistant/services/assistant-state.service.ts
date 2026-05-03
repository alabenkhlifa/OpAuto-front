import { Injectable, computed, effect, signal } from '@angular/core';
import {
  AssistantBlastTier,
  AssistantPanelState,
  AssistantPendingApproval,
  AssistantToolCallStatus,
  AssistantUiMessage,
} from '../../../core/models/assistant.model';

const PANEL_STATE_KEY = 'assistant.panelState';
const CONVERSATION_ID_KEY = 'assistant.currentConversationId';

/**
 * Single source of truth for the assistant panel UI.
 *
 * Owns the panel open/close lifecycle, the in-memory message stream,
 * the streaming flag, and the currently pending approval (if any).
 * Persists `panelState` and `currentConversationId` to localStorage so
 * a reload preserves the user's place.
 */
@Injectable({ providedIn: 'root' })
export class AssistantStateService {
  // ── State signals ────────────────────────────────────────────────────────
  readonly panelState = signal<AssistantPanelState>(this.loadPanelState());
  readonly currentConversationId = signal<string | null>(this.loadConversationId());
  readonly messages = signal<AssistantUiMessage[]>([]);
  readonly pendingApproval = signal<AssistantPendingApproval | null>(null);
  readonly isStreaming = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Convenience computeds
  readonly isOpen = computed(() => this.panelState() === 'open');
  readonly hasPendingApproval = computed(() => this.pendingApproval() !== null);

  constructor() {
    // Persist panel state on change
    effect(() => {
      try {
        localStorage.setItem(PANEL_STATE_KEY, this.panelState());
      } catch {
        /* ignore storage errors */
      }
    });

    // Persist conversation id on change (or remove when null)
    effect(() => {
      try {
        const id = this.currentConversationId();
        if (id) {
          localStorage.setItem(CONVERSATION_ID_KEY, id);
        } else {
          localStorage.removeItem(CONVERSATION_ID_KEY);
        }
      } catch {
        /* ignore storage errors */
      }
    });
  }

  // ── Panel lifecycle ──────────────────────────────────────────────────────
  openPanel(): void {
    this.panelState.set('open');
  }

  closePanel(): void {
    this.panelState.set('closed');
  }

  togglePanel(): void {
    this.panelState.update(s => (s === 'open' ? 'closed' : 'open'));
  }

  // ── Conversation ─────────────────────────────────────────────────────────
  setConversationId(id: string | null): void {
    this.currentConversationId.set(id);
  }

  // ── Messages ─────────────────────────────────────────────────────────────
  setMessages(msgs: AssistantUiMessage[]): void {
    this.messages.set([...msgs]);
  }

  appendMessage(msg: AssistantUiMessage): void {
    this.messages.update(list => [...list, msg]);
  }

  /**
   * Append a streaming text delta. If the most recent message is an
   * assistant message that's still streaming, append to its `content`.
   * Otherwise create a new placeholder assistant message.
   */
  appendStreamingDelta(delta: string): void {
    if (!delta) return;
    this.messages.update(list => {
      const last = list[list.length - 1];
      if (last && last.role === 'ASSISTANT' && last.isStreaming) {
        const updated: AssistantUiMessage = {
          ...last,
          content: last.content + delta,
        };
        return [...list.slice(0, -1), updated];
      }

      const placeholder: AssistantUiMessage = {
        id: `streaming-${Date.now()}`,
        conversationId: this.currentConversationId() ?? '',
        role: 'ASSISTANT',
        content: delta,
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };
      return [...list, placeholder];
    });
  }

  /**
   * Mark the latest streaming message as finalized (clears `isStreaming`).
   * If a server-confirmed message id arrives, swap it in.
   */
  finalizeStreamingMessage(messageId?: string): void {
    this.messages.update(list => {
      const last = list[list.length - 1];
      if (!last || !last.isStreaming) return list;
      const finalized: AssistantUiMessage = {
        ...last,
        id: messageId ?? last.id,
        isStreaming: false,
      };
      return [...list.slice(0, -1), finalized];
    });
  }

  /**
   * Append an in-flight tool_call as its own TOOL-role message bubble. The
   * existing assistant-message TOOL renderer picks this up and shows a chip
   * with the tool name plus an expandable result preview, so the user has a
   * live view of which tools the assistant is consulting (UI Bug 1 — until
   * now the launcher dropped tool_call SSE events on the floor).
   */
  upsertToolCall(input: {
    toolCallId: string;
    toolName: string;
    args: unknown;
    blastTier?: AssistantBlastTier;
    status?: AssistantToolCallStatus;
    result?: unknown;
    durationMs?: number;
    errorMessage?: string;
  }): void {
    this.messages.update(list => {
      const idx = list.findIndex(
        m => m.role === 'TOOL' && m.toolCall?.id === input.toolCallId,
      );
      if (idx >= 0) {
        const existing = list[idx];
        const prior = existing.toolCall!;
        const merged: AssistantUiMessage = {
          ...existing,
          toolCall: {
            id: prior.id,
            // Preserve fields a later update may not carry: tool_result events
            // omit toolName/args because the bubble already has them.
            toolName: input.toolName || prior.toolName,
            args: input.args ?? prior.args,
            blastTier: input.blastTier ?? prior.blastTier,
            status: input.status ?? prior.status,
            result: input.result ?? prior.result,
            durationMs: input.durationMs ?? prior.durationMs,
            errorMessage: input.errorMessage ?? prior.errorMessage,
          },
        };
        return [...list.slice(0, idx), merged, ...list.slice(idx + 1)];
      }

      // First sighting (tool_call) — create a new TOOL bubble.
      const newMsg: AssistantUiMessage = {
        id: `toolcall-${input.toolCallId}`,
        conversationId: this.currentConversationId() ?? '',
        role: 'TOOL',
        content: '',
        createdAt: new Date().toISOString(),
        toolCall: {
          id: input.toolCallId,
          toolName: input.toolName,
          args: input.args,
          result: input.result,
          status: input.status ?? 'APPROVED',
          blastTier: input.blastTier ?? 'READ',
          durationMs: input.durationMs,
          errorMessage: input.errorMessage,
        },
      };
      // Insert BEFORE any in-flight streaming assistant message so the chip
      // sits above the response text the LLM is composing.
      const lastIdx = list.length - 1;
      const last = list[lastIdx];
      if (last && last.role === 'ASSISTANT' && last.isStreaming) {
        return [...list.slice(0, lastIdx), newMsg, last];
      }
      return [...list, newMsg];
    });
  }

  // ── Pending approval ─────────────────────────────────────────────────────
  setPendingApproval(approval: AssistantPendingApproval): void {
    this.pendingApproval.set(approval);
  }

  clearPendingApproval(): void {
    this.pendingApproval.set(null);
  }

  // ── Streaming flag ───────────────────────────────────────────────────────
  startStreaming(): void {
    this.isStreaming.set(true);
    this.error.set(null);
  }

  stopStreaming(): void {
    this.isStreaming.set(false);
  }

  // ── Error ────────────────────────────────────────────────────────────────
  setError(message: string | null): void {
    this.error.set(message);
  }

  // ── Reset (new conversation) ─────────────────────────────────────────────
  reset(): void {
    this.messages.set([]);
    this.pendingApproval.set(null);
    this.isStreaming.set(false);
    this.error.set(null);
    this.currentConversationId.set(null);
  }

  // ── localStorage helpers ─────────────────────────────────────────────────
  private loadPanelState(): AssistantPanelState {
    try {
      const raw = localStorage.getItem(PANEL_STATE_KEY);
      if (raw === 'open' || raw === 'closed' || raw === 'minimized') {
        return raw;
      }
    } catch {
      /* ignore */
    }
    return 'closed';
  }

  private loadConversationId(): string | null {
    try {
      return localStorage.getItem(CONVERSATION_ID_KEY);
    } catch {
      return null;
    }
  }
}
