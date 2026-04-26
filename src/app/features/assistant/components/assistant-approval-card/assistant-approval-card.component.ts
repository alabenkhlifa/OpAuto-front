import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  AssistantApprovalDecision,
  AssistantPendingApproval,
} from '../../../../core/models/assistant.model';

/**
 * Inline approval card. Rendered when the orchestrator emits an `approval_request`
 * SSE event with a blast tier of `CONFIRM_WRITE` or `TYPED_CONFIRM_WRITE`. The
 * card surfaces a live countdown to the `expiresAt` deadline and emits the
 * user's decision back to the parent panel, which is responsible for sending
 * it to the backend and clearing the pending state.
 */
@Component({
  selector: 'app-assistant-approval-card',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './assistant-approval-card.component.html',
  styleUrl: './assistant-approval-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantApprovalCardComponent implements OnInit, OnDestroy {
  readonly pendingApproval = input.required<AssistantPendingApproval>();

  readonly decided = output<AssistantApprovalDecision>();
  readonly dismissed = output<void>();

  /** Reactive "now" — ticks every second so the countdown re-evaluates. */
  private readonly now = signal(Date.now());
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  /** Has the user submitted a decision already? Locks the buttons after one click. */
  readonly settled = signal(false);

  /** Has the post-expiry auto-dismiss already fired? Prevents double-emit. */
  private autoDismissed = false;

  readonly typedConfirmation = signal('');
  readonly argsExpanded = signal(false);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  /** Seconds until expiry. Negative once expired; clamped to 0 for display. */
  readonly secondsRemaining = computed(() => {
    const expires = new Date(this.pendingApproval().expiresAt).getTime();
    if (Number.isNaN(expires)) return 0;
    return Math.max(0, Math.floor((expires - this.now()) / 1000));
  });

  readonly isExpired = computed(() => {
    const expires = new Date(this.pendingApproval().expiresAt).getTime();
    if (Number.isNaN(expires)) return true;
    return expires <= this.now();
  });

  readonly minutesPart = computed(() => {
    const total = this.secondsRemaining();
    return Math.floor(total / 60).toString();
  });

  readonly secondsPart = computed(() => {
    const total = this.secondsRemaining();
    return (total % 60).toString().padStart(2, '0');
  });

  /** Tier of the pending approval — drives which controls render. */
  readonly tier = computed(() => this.pendingApproval().blastTier);
  readonly isConfirmWrite = computed(() => this.tier() === 'CONFIRM_WRITE');
  readonly isTypedConfirm = computed(() => this.tier() === 'TYPED_CONFIRM_WRITE');

  /**
   * The token the user must type verbatim to enable the Approve button.
   * Extracted from `args._expectedConfirmation`. The orchestrator embeds this
   * field on the args payload precisely for the typed-confirm flow; if it's
   * absent (defensive) we fall back to the empty string, which guarantees the
   * Approve button stays disabled rather than allowing a free-pass approval.
   */
  readonly expectedConfirmation = computed(() => {
    const args = this.pendingApproval().args;
    if (args && typeof args === 'object' && '_expectedConfirmation' in args) {
      const value = (args as Record<string, unknown>)['_expectedConfirmation'];
      return typeof value === 'string' ? value : '';
    }
    return '';
  });

  /** Approve button disabled logic. */
  readonly approveDisabled = computed(() => {
    if (this.settled() || this.isExpired()) return true;
    if (this.isTypedConfirm()) {
      const expected = this.expectedConfirmation();
      if (!expected) return true;
      return this.typedConfirmation().trim() !== expected;
    }
    return false;
  });

  readonly denyDisabled = computed(() => this.settled() || this.isExpired());

  /** Compact one-line summary of the args payload for the card body. */
  readonly argsSummary = computed(() => {
    const args = this.pendingApproval().args;
    if (args === null || args === undefined) return '';
    try {
      const visible = this.stripInternalKeys(args);
      const json = JSON.stringify(visible);
      return json.length > 140 ? `${json.slice(0, 140)}…` : json;
    } catch {
      return String(args);
    }
  });

  /** Pretty-printed args for the expanded view. */
  readonly argsPretty = computed(() => {
    const args = this.pendingApproval().args;
    if (args === null || args === undefined) return '';
    try {
      return JSON.stringify(this.stripInternalKeys(args), null, 2);
    } catch {
      return String(args);
    }
  });

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  constructor() {
    // Defensive: this card should never render for READ / AUTO_WRITE tiers —
    // the orchestrator auto-executes those without an approval request. If it
    // somehow happens, log a warning and treat the card as inline-confirm so
    // the user still has a way out.
    effect(() => {
      const t = this.pendingApproval().blastTier;
      if (t === 'READ' || t === 'AUTO_WRITE') {
        console.warn(
          `[AssistantApprovalCard] Unexpected blast tier "${t}" — this tier should auto-execute. Falling back to inline-confirm UX.`,
        );
      }
    });

    // Auto-dismiss 3 seconds after expiry so the card doesn't linger forever.
    effect(() => {
      if (this.isExpired() && !this.settled() && !this.autoDismissed) {
        this.autoDismissed = true;
        setTimeout(() => this.dismissed.emit(), 3000);
      }
    });
  }

  ngOnInit(): void {
    this.tickHandle = setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  // ---------------------------------------------------------------------------
  // User actions
  // ---------------------------------------------------------------------------

  approve(): void {
    if (this.approveDisabled()) return;
    this.settled.set(true);
    const payload: AssistantApprovalDecision = { decision: 'approve' };
    if (this.isTypedConfirm()) {
      payload.typedConfirmation = this.typedConfirmation().trim();
    }
    this.decided.emit(payload);
  }

  deny(): void {
    if (this.denyDisabled()) return;
    this.settled.set(true);
    this.decided.emit({ decision: 'deny' });
  }

  dismiss(): void {
    if (this.settled()) return;
    this.dismissed.emit();
  }

  toggleArgs(): void {
    this.argsExpanded.update((v) => !v);
  }

  onTypedInput(value: string): void {
    this.typedConfirmation.set(value);
  }

  onTypedKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.approveDisabled()) {
      event.preventDefault();
      this.approve();
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Hide internal `_*` keys (e.g. `_expectedConfirmation`) from the user-facing preview. */
  private stripInternalKeys(value: unknown): unknown {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith('_')) continue;
      out[k] = v;
    }
    return out;
  }
}
