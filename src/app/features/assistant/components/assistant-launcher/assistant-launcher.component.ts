import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../../core/services/translation.service';
import { LanguageService } from '../../../../core/services/language.service';
import { AssistantStateService } from '../../services/assistant-state.service';
import { AssistantChatService } from '../../services/assistant-chat.service';
import { AssistantContextService } from '../../services/assistant-context.service';
import { AssistantPanelComponent } from '../assistant-panel/assistant-panel.component';
import { AssistantConversationDrawerComponent } from '../assistant-conversation-drawer/assistant-conversation-drawer.component';
import { AssistantMessageListComponent } from '../assistant-message-list/assistant-message-list.component';
import { AssistantApprovalCardComponent } from '../assistant-approval-card/assistant-approval-card.component';
import { AssistantInputComponent } from '../assistant-input/assistant-input.component';
import { AssistantEmptyStateComponent } from '../assistant-empty-state/assistant-empty-state.component';
import {
  AssistantApprovalDecision,
  AssistantConversationSummary,
  AssistantLocale,
  AssistantPendingApproval,
  AssistantSseEvent,
  AssistantUiMessage,
} from '../../../../core/models/assistant.model';

const AUTH_ROUTE_PREFIXES = ['/auth', '/login', '/register', '/forgot-password', '/reset-password'];

/**
 * Floating launcher button + composed panel host.
 *
 * Owns the orchestration glue between the five Phase-3 sub-components:
 * conversation list (Q), message list (N), input + voice (O), approval
 * card (P), and the panel/state/chat services (M). Translates SSE stream
 * events into state-service updates so the children stay declarative.
 */
@Component({
  selector: 'app-assistant-launcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslatePipe,
    AssistantPanelComponent,
    AssistantConversationDrawerComponent,
    AssistantMessageListComponent,
    AssistantApprovalCardComponent,
    AssistantInputComponent,
    AssistantEmptyStateComponent,
  ],
  templateUrl: './assistant-launcher.component.html',
  styleUrls: ['./assistant-launcher.component.css'],
})
export class AssistantLauncherComponent implements OnInit {
  state = inject(AssistantStateService);
  private chat = inject(AssistantChatService);
  private context = inject(AssistantContextService);
  private translation = inject(TranslationService);
  private language = inject(LanguageService);
  private router = inject(Router);

  readonly conversations = signal<AssistantConversationSummary[]>([]);
  readonly historyOpen = signal<boolean>(false);

  readonly showEmptyState = computed(
    () => this.state.messages().length === 0 && !this.state.isStreaming(),
  );

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map((e: NavigationEnd) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly visible = computed(() => {
    const url = this.currentUrl() || '/';
    if (url === '/' || url === '') return false;
    return !AUTH_ROUTE_PREFIXES.some(prefix => url.startsWith(prefix));
  });

  readonly hasPendingApproval = computed(() => this.state.hasPendingApproval());
  readonly isOpen = computed(() => this.state.isOpen());

  ngOnInit(): void {
    this.refreshConversations();
    this.rehydrateActiveConversation();
  }

  /**
   * UI Bug 2 — `assistant.currentConversationId` is persisted to localStorage
   * but on F5 reload the launcher previously did nothing with it: the
   * conversation list re-loaded but the active selection was dropped, so
   * the user landed on a fresh "Untitled chat" instead of their last one.
   *
   * If a saved id is present, fetch its messages eagerly. If the server
   * doesn't recognise it (deleted, archived, foreign garage post-relogin),
   * clear the saved id silently — never block the user with a stale
   * "connection error" toast.
   */
  private rehydrateActiveConversation(): void {
    const id = this.state.currentConversationId();
    if (!id) return;
    this.chat.getConversation(id).subscribe({
      next: (conv) => {
        this.state.setMessages(this.buildHistoryMessages(conv, id));
      },
      error: () => {
        this.state.setConversationId(null);
        this.state.setMessages([]);
      },
    });
  }

  /**
   * Merge persisted USER/ASSISTANT messages with persisted tool_calls into
   * a single chronologically-ordered list. UI Bug 5 — without this, F5 /
   * conversation-switch shows only text bubbles; the live tool chips that
   * UI Bug 1 fixed for the SSE stream disappear after a reload.
   */
  private buildHistoryMessages(
    conv: {
      messages?: { id: string; role: string; content: string; createdAt: string }[];
      toolCalls?: import('../../services/assistant-chat.service').PersistedToolCall[];
    },
    conversationId: string,
  ): AssistantUiMessage[] {
    const textMsgs = (conv.messages ?? []).map(
      (m) =>
        ({
          ...m,
          conversationId,
        }) as AssistantUiMessage,
    );
    const toolMsgs: AssistantUiMessage[] = (conv.toolCalls ?? []).map((tc) => ({
      id: `toolcall-${tc.id}`,
      conversationId,
      role: 'TOOL',
      content: '',
      createdAt: tc.createdAt,
      toolCall: {
        id: tc.id,
        toolName: tc.toolName,
        args: tc.argsJson,
        result: tc.resultJson ?? undefined,
        status: tc.status,
        blastTier: tc.blastTier,
        durationMs: tc.durationMs ?? undefined,
        errorMessage: tc.errorMessage ?? undefined,
      },
    }));
    return [...textMsgs, ...toolMsgs].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  toggle(): void {
    this.state.togglePanel();
    if (this.state.isOpen()) {
      this.refreshConversations();
    } else {
      this.historyOpen.set(false);
    }
  }

  openHistory(): void {
    this.refreshConversations();
    this.historyOpen.set(true);
  }

  closeHistory(): void {
    this.historyOpen.set(false);
  }

  onChipPicked(prompt: string): void {
    this.onSubmit(prompt);
  }

  // ── Input → send a message ──────────────────────────────────────────────
  onSubmit(text: string): void {
    if (!text.trim() || this.state.isStreaming()) return;

    const conversationId = this.state.currentConversationId() ?? undefined;
    // The __resume__:<toolCallId> sentinel is an internal protocol marker
    // — don't render it as a user-visible bubble. Same for any future
    // hidden-control message we add. Real user messages render as before.
    const isHidden = text.startsWith('__resume__:');
    if (!isHidden) {
      const userMessage: AssistantUiMessage = {
        id: `local-${Date.now()}`,
        conversationId: conversationId ?? '',
        role: 'USER',
        content: text,
        createdAt: new Date().toISOString(),
      };
      this.state.appendMessage(userMessage);
    }
    this.state.startStreaming();

    this.chat
      .sendMessage({
        conversationId,
        userMessage: text,
        locale: this.currentLocale(),
        pageContext: this.context.current(),
      })
      .subscribe({
        next: (event) => this.handleSseEvent(event),
        error: () => {
          this.state.setError(this.translation.instant('assistant.errors.connection'));
          this.state.stopStreaming();
        },
        complete: () => {
          this.state.stopStreaming();
          this.refreshConversations();
        },
      });
  }

  // ── Approval card events ─────────────────────────────────────────────────
  onApprovalDecided(decision: AssistantApprovalDecision): void {
    const pending = this.state.pendingApproval();
    if (!pending) return;
    this.chat.decideApproval(pending.toolCallId, decision).subscribe({
      next: () => {
        this.state.clearPendingApproval();
        // Re-enter the orchestrator via the resume sentinel for BOTH outcomes.
        // - 'approve' → backend executes the tool, emits tool_result + the
        //   LLM's follow-up text.
        // - 'deny'    → backend's handleResume DENIED branch emits a
        //   deterministic "won't run X" text (e34b898). Without this re-entry
        //   the user clicked Deny and saw nothing — the silent-skip UX bug
        //   from §10/§12 (UI Bug 3 still broken in re-verification).
        if (decision.decision === 'approve' || decision.decision === 'deny') {
          this.onSubmit(`__resume__:${pending.toolCallId}`);
        }
      },
      error: () => {
        this.state.setError(this.translation.instant('assistant.errors.connection'));
      },
    });
  }

  onApprovalDismissed(): void {
    this.state.clearPendingApproval();
  }

  // ── Conversation list events ─────────────────────────────────────────────
  onConvSelect(id: string): void {
    this.state.setConversationId(id);
    this.chat.getConversation(id).subscribe({
      next: (conv) => {
        this.state.setMessages(this.buildHistoryMessages(conv, id));
        this.state.setError(null);
      },
      error: () => {
        this.state.setError(this.translation.instant('assistant.errors.connection'));
      },
    });
  }

  onNewConversation(): void {
    this.state.reset();
  }

  onConvDelete(id: string): void {
    this.chat.deleteConversation(id).subscribe(() => {
      if (this.state.currentConversationId() === id) {
        this.state.reset();
      }
      this.refreshConversations();
    });
  }

  onConvClear(id: string): void {
    this.chat.clearConversation(id).subscribe(() => {
      if (this.state.currentConversationId() === id) {
        this.state.setMessages([]);
      }
    });
  }

  onApprovalRequested(_payload: { toolCallId: string }): void {
    // Already surfaced as a panel-slotted approval card via `pendingApproval`.
    // No extra work needed; the message renderer's "Review" button is a UX
    // affordance to focus the existing approval card.
  }

  // ── Internals ────────────────────────────────────────────────────────────
  private handleSseEvent(event: AssistantSseEvent): void {
    switch (event.type) {
      case 'conversation':
        // Sync our local id with whatever the server stitched this turn
        // into. Critical for the resume-after-approval flow so the next
        // POST /chat lands in the same conversation rather than spinning
        // up a fresh one.
        if (this.state.currentConversationId() !== event.conversationId) {
          this.state.setConversationId(event.conversationId);
        }
        break;
      case 'text':
        this.state.appendStreamingDelta(event.delta);
        break;
      case 'approval_request': {
        const pending: AssistantPendingApproval = {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          blastTier: event.blastTier,
          expiresAt: event.expiresAt,
          receivedAt: Date.now(),
        };
        this.state.setPendingApproval(pending);
        break;
      }
      case 'budget_exceeded':
        this.state.setError(this.translation.instant('assistant.errors.budgetExceeded'));
        break;
      case 'error':
        this.state.setError(event.message);
        break;
      case 'done':
        this.state.finalizeStreamingMessage(event.messageId);
        break;
      case 'tool_call':
        // Surface the tool the assistant is consulting as a live TOOL bubble
        // (chip + collapsed args) so the user has visibility into what's
        // happening before the result arrives. UI Bug 1.
        this.state.upsertToolCall({
          toolCallId: event.toolCallId,
          toolName: event.name,
          args: event.args,
          status: 'APPROVED',
        });
        break;
      case 'tool_result':
        this.state.upsertToolCall({
          toolCallId: event.toolCallId,
          toolName: '', // existing bubble already has the name
          args: undefined,
          result: event.result,
          status:
            event.status === 'executed'
              ? 'EXECUTED'
              : event.status === 'denied'
                ? 'DENIED'
                : 'FAILED',
        });
        break;
      // agent_dispatch / agent_result / skill_loaded are not yet rendered
      // in-stream — they decorate the final assistant message via .agent /
      // .skill fields. Tracked separately.
      default:
        break;
    }
  }

  private refreshConversations(): void {
    this.chat.listConversations().subscribe({
      next: (list) => this.conversations.set(list),
      error: () => {
        // Non-critical: leave existing list in place.
      },
    });
  }

  private currentLocale(): AssistantLocale {
    const lang = this.language.getCurrentLanguage();
    if (lang === 'fr' || lang === 'ar') return lang;
    return 'en';
  }
}
