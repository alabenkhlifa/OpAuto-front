import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  AssistantApprovalDecision,
  AssistantPendingApproval,
} from '../../../../core/models/assistant.model';
import { AssistantToolPresenterService } from '../../services/assistant-tool-presenter.service';

/**
 * Friendly approval card. Renders an action preview (per-tool component)
 * instead of raw JSON args. Header copy / approve verb / timer phrasing
 * all come from the per-tool presenter so non-technical users see
 * "Yes, send SMS" rather than "Approve communications.send_sms".
 */
@Component({
  selector: 'app-assistant-approval-card',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet, TranslatePipe],
  templateUrl: './assistant-approval-card.component.html',
  styleUrl: './assistant-approval-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantApprovalCardComponent implements OnInit, OnDestroy {
  private readonly presenter = inject(AssistantToolPresenterService);

  readonly pendingApproval = input.required<AssistantPendingApproval>();

  readonly decided = output<AssistantApprovalDecision>();
  readonly dismissed = output<void>();

  /** Reactive "now" — ticks every second so the countdown re-evaluates. */
  private readonly now = signal(Date.now());
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  readonly settled = signal(false);
  private autoDismissed = false;

  readonly typedConfirmation = signal('');

  // ── Derived ─────────────────────────────────────────────────────────────

  readonly summary = computed(() => this.presenter.approvalSummary(this.pendingApproval()));

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

  readonly minutesPart = computed(() => Math.floor(this.secondsRemaining() / 60).toString());
  readonly secondsPart = computed(() =>
    (this.secondsRemaining() % 60).toString().padStart(2, '0'),
  );

  readonly tier = computed(() => this.pendingApproval().blastTier);
  readonly isTypedConfirm = computed(() => this.tier() === 'TYPED_CONFIRM_WRITE');

  readonly expectedConfirmation = computed(() => {
    const args = this.pendingApproval().args;
    if (args && typeof args === 'object' && '_expectedConfirmation' in args) {
      const value = (args as Record<string, unknown>)['_expectedConfirmation'];
      return typeof value === 'string' ? value : '';
    }
    return '';
  });

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

  // ── Lifecycle ───────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      const t = this.pendingApproval().blastTier;
      if (t === 'READ' || t === 'AUTO_WRITE') {
        console.warn(
          `[AssistantApprovalCard] Unexpected blast tier "${t}" — this tier should auto-execute. Falling back to inline-confirm UX.`,
        );
      }
    });

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

  // ── Actions ─────────────────────────────────────────────────────────────

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

  onTypedInput(value: string): void {
    this.typedConfirmation.set(value);
  }

  onTypedKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.approveDisabled()) {
      event.preventDefault();
      this.approve();
    }
  }
}
