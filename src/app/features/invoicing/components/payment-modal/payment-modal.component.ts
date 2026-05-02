import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PaymentMethod } from '../../../../core/models/invoice.model';

export interface PaymentModalContext {
  invoiceId: string;
  invoiceNumber: string;
  remainingAmount: number;
  currency: string;
}

export interface PaymentModalResult {
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  reference?: string;
  notes?: string;
}

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'check', 'bank-transfer'];

/**
 * PaymentModalComponent — recorded against an invoice from either the
 * detail page or the dashboard quick-action.
 *
 * The component only emits the payload; the parent owns the HTTP call,
 * the loading state, and toast notifications. Default amount is the
 * remaining balance; user can adjust it.
 */
@Component({
  selector: 'app-payment-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './payment-modal.component.html',
  styleUrl: './payment-modal.component.css',
})
export class PaymentModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() context: PaymentModalContext | null = null;
  @Input() submitting = false;
  /**
   * Optional monotonically-increasing key. When the parent increments this
   * each time it intends to re-open the modal, the modal treats it as a
   * fresh "intent" and re-seeds the form even if `isOpen` didn't transition
   * cleanly (e.g. parent flipped it false→true within a single CD tick, or
   * the OnPush change detector coalesced the toggles).
   */
  @Input() openKey: number | null = null;

  @Output() close = new EventEmitter<void>();
  /**
   * BUG-109 (Sweep C-16) — renamed from `submit` to `submitted` to avoid the
   * native DOM `submit` event collision. The internal `<form (ngSubmit)="...">`
   * fires a native `submit` DOM event that bubbles through the component's
   * host element. Angular's template parser binds `(submit)="..."` on
   * `<app-payment-modal>` to BOTH the `@Output() submit` EventEmitter AND
   * the bubbling DOM submit event — so a single click invoked the parent's
   * `onPaymentModalSubmit` listener TWICE: first with the proper
   * `PaymentModalResult` payload (from the EventEmitter), then again with
   * the raw `SubmitEvent` (from the bubbling DOM submit). The second call
   * produced an empty-body `POST /payments` (`amount=undefined`,
   * `method=""`) that returned 500 on the BE state machine because the
   * first POST had already settled the invoice. Renaming the Output is the
   * cleanest fix — `(submitted)="..."` only matches the typed Output.
   */
  @Output() submitted = new EventEmitter<PaymentModalResult>();

  private fb = inject(FormBuilder);

  readonly methods = PAYMENT_METHODS;
  readonly method = signal<PaymentMethod>('cash');

  /**
   * BUG-109 — in-flight guard for the Submit button (defence-in-depth).
   *
   * Even with the `submit` → `submitted` rename above, a rapid manual
   * double-click on the Submit button could in principle fire `onSubmit()`
   * twice within a single CD tick — before the parent's `submitting` Input
   * has propagated. This signal flips synchronously inside `onSubmit()`
   * BEFORE we emit so `canSubmit()` returns false on the second invocation.
   * Cleared whenever the modal re-seeds (open / reopen / context change).
   */
  readonly isSubmitting = signal(false);

  form = this.fb.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    paymentDate: [new Date().toISOString().split('T')[0], Validators.required],
    reference: [''],
    notes: [''],
  });

  readonly canSubmit = computed(
    () => this.form.valid && !this.submitting && !this.isSubmitting(),
  );

  ngOnChanges(changes: SimpleChanges): void {
    // Reset whenever the modal transitions to open — guarantees a clean
    // state on the second (and Nth) reopen even if the parent reuses the
    // same context reference. Also resets when the context is swapped
    // mid-open (e.g. switching invoices) or when the parent bumps
    // `openKey` to signal a fresh open intent (the partially-paid reopen
    // path uses the latter so it doesn't depend on coalesced OnPush ticks).
    const openedNow =
      changes['isOpen'] &&
      changes['isOpen'].currentValue === true &&
      changes['isOpen'].previousValue !== true;
    const openKeyBumped =
      changes['openKey'] &&
      changes['openKey'].currentValue != null &&
      changes['openKey'].currentValue !== changes['openKey'].previousValue;
    const contextChanged =
      changes['context'] &&
      changes['context'].currentValue !== changes['context'].previousValue;
    if (
      (openedNow || openKeyBumped || contextChanged) &&
      this.isOpen &&
      this.context
    ) {
      this.method.set('cash');
      // S-PAY-012: cap the amount input at the invoice's remaining
      // balance so the submit button stays disabled when the user
      // tries to over-pay. Re-applies on every (re)open because the
      // remaining amount can change between opens (after a partial
      // payment or a credit-note offset). `min(0.01)` enforces
      // S-PAY-013 — zero / negative values can't be submitted.
      this.form.controls.amount.setValidators([
        Validators.required,
        Validators.min(0.01),
        Validators.max(this.context.remainingAmount),
      ]);
      this.form.controls.amount.updateValueAndValidity({ emitEvent: false });
      this.form.reset({
        amount: this.context.remainingAmount,
        paymentDate: new Date().toISOString().split('T')[0],
        reference: '',
        notes: '',
      });
      this.form.markAsPristine();
      this.form.markAsUntouched();
      // BUG-109 — clear the in-flight guard on every (re)open. The parent
      // has already reset its own `submitting` flag at this point.
      this.isSubmitting.set(false);
    }
  }

  selectMethod(m: PaymentMethod): void {
    this.method.set(m);
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    // BUG-109 — flip the in-flight guard SYNCHRONOUSLY before emitting,
    // so a rapid second `(ngSubmit)` (within the same CD tick, before the
    // parent's `submitting` Input has propagated) is rejected by `canSubmit()`
    // above. Without this guard, the parent only flips `submitting=true`
    // after RxJS subscribes to the HTTP observable — too late to block the
    // second click, which produced two POST /api/payments hits (first 201,
    // second 500 because the state machine had already transitioned).
    this.isSubmitting.set(true);
    const v = this.form.value;
    // S-EDGE-017 — paymentDate must be a non-empty YYYY-MM-DD string.
    // The previous guard `v.paymentDate ?? <today>` only caught
    // null/undefined; the date input can also surface an empty string
    // (e.g. user cleared the field), which then propagated downstream
    // to `new Date('')` → Invalid Date → RangeError on toISOString().
    const todayIso = new Date().toISOString().split('T')[0];
    const paymentDate = v.paymentDate && v.paymentDate.trim() ? v.paymentDate : todayIso;
    this.submitted.emit({
      amount: v.amount ?? 0,
      method: this.method(),
      paymentDate,
      reference: v.reference || undefined,
      notes: v.notes || undefined,
    });
  }

  onBackdrop(event: Event): void {
    if (event.target === event.currentTarget) this.onClose();
  }

  onClose(): void {
    if (this.submitting) return;
    this.close.emit();
  }

  /** Translation key used as a label for each payment method chip. */
  methodLabelKey(m: PaymentMethod): string {
    const map: Record<PaymentMethod, string> = {
      cash: 'invoicing.paymentMethods.cash',
      card: 'invoicing.paymentMethods.card',
      check: 'invoicing.paymentMethods.check',
      'bank-transfer': 'invoicing.paymentMethods.bankTransfer',
      credit: 'invoicing.paymentMethods.credit',
    };
    return map[m];
  }
}
