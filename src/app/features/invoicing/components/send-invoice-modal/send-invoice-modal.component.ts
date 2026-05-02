import {
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
import {
  AbstractControl,
  ReactiveFormsModule,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../../core/services/translation.service';

export type DeliveryChannel = 'EMAIL' | 'WHATSAPP' | 'BOTH';

export interface SendInvoiceContext {
  /** Document UUID — invoice / quote / credit note id. */
  documentId: string;
  /** Display label, e.g. "INV-2026-0001". */
  documentNumber: string;
  /** Translation-key prefix for "Facture / Devis / Avoir" header. */
  documentKindLabelKey: string;
  /** Customer's stored email — used to seed the recipient field for EMAIL/BOTH. */
  customerEmail?: string | null;
  /** Customer's stored phone — used to seed the recipient field for WHATSAPP. */
  customerPhone?: string | null;
  /** Optional preview pane HTML snippet. If unset, the modal falls back
   *  to the translated subject/body templates seeded from `documentNumber`. */
  previewHtml?: string;
  /** Optional preview subject — when omitted, defaults to the
   *  translated `invoicing.sendModal.preview.subject` template. */
  previewSubject?: string;
  /** Optional preview body — when omitted, defaults to the translated
   *  `invoicing.sendModal.preview.body` template. */
  previewBody?: string;
}

/**
 * Tunisian phone validator (S-DEL-009).
 *
 * Accepts the same shapes the BE `normalizeTunisiaPhone()` collapses to
 * `216XXXXXXXX`:
 *   - bare 8 digits (e.g. `22 333 444`)
 *   - leading-zero prefix (`0XXXXXXXX`)
 *   - country-code prefix `216XXXXXXXX` (with optional `+` and spaces)
 *   - international `00216XXXXXXXX`
 *
 * Tolerates whitespace, dashes, parentheses — the BE strips them too.
 */
export function tunisianPhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = (control.value ?? '').toString().trim();
    if (!raw) return null; // `required` covers empty values
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00216')) digits = digits.slice(5);
    else if (digits.startsWith('216')) digits = digits.slice(3);
    else if (digits.startsWith('0')) digits = digits.slice(1);
    return /^\d{8}$/.test(digits) ? null : { tunisianPhone: true };
  };
}

export interface SendInvoicePayload {
  channel: DeliveryChannel;
  /** Recipient — email for EMAIL/BOTH, phone for WHATSAPP. Empty if customer
   *  default is used (parent decides whether to send `to` to the API or omit). */
  to: string;
}

/**
 * Phase 4 — Send Invoice modal.
 *
 * Opens with the document's stored channel preference (defaults to EMAIL),
 * lets the user toggle channel chips, override the recipient, and review
 * a preview snippet before submitting. Emits a `send` event with the
 * payload — parent wires it into `InvoiceService.deliver(...)`.
 *
 * No backend calls happen here directly: the parent owns the HTTP call,
 * loading state, success/error toasts, and modal close.
 */
@Component({
  selector: 'app-send-invoice-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './send-invoice-modal.component.html',
  styleUrl: './send-invoice-modal.component.css',
})
export class SendInvoiceModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() context: SendInvoiceContext | null = null;
  @Input() submitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() send = new EventEmitter<SendInvoicePayload>();

  private fb = inject(FormBuilder);
  private translation = inject(TranslationService);

  channel = signal<DeliveryChannel>('EMAIL');
  /** Internal mirror of `context` so signal-based computeds (preview pane,
   *  recipient placeholders) react when the parent re-binds the modal. */
  contextSignal = signal<SendInvoiceContext | null>(null);
  form = this.fb.group({
    to: ['', [Validators.required, Validators.maxLength(255)]],
  });
  /** Mirror of `form.valid` exposed as a signal so the `canSubmit`
   *  computed re-fires when the user types or the validators swap.
   *  Reactive forms' `.valid` flag is NOT signal-aware on its own. */
  private formValidSignal = signal<boolean>(false);

  /** Whether the recipient field should validate as email (EMAIL/BOTH) or phone (WHATSAPP). */
  recipientMode = computed<'email' | 'phone'>(() =>
    this.channel() === 'WHATSAPP' ? 'phone' : 'email',
  );

  /**
   * S-EDGE-010 — i18n key for a translated hint when the customer has no
   * stored contact for the picked channel:
   *   - WHATSAPP, no `customerPhone` → `invoicing.send.missingContact.phone`
   *   - EMAIL / BOTH, no `customerEmail` → `invoicing.send.missingContact.email`
   *   - otherwise → `null` (no hint).
   *
   * Returns the *raw* translation key so the template binds it via
   * `| translate` and language switches stay reactive.
   */
  missingContactKey = computed<string | null>(() => {
    const ctx = this.contextSignal();
    if (!ctx) return null;
    const c = this.channel();
    if (c === 'WHATSAPP') {
      const phone = ctx.customerPhone?.trim();
      return phone ? null : 'invoicing.send.missingContact.phone';
    }
    // EMAIL or BOTH — both legs need the email
    const email = ctx.customerEmail?.trim();
    return email ? null : 'invoicing.send.missingContact.email';
  });

  /** True when the form is valid AND we're not already submitting. */
  canSubmit = computed(() => this.formValidSignal() && !this.submitting);

  constructor() {
    // Bridge `statusChanges` → signal so signal-driven computeds reflect
    // the live validity. `emitEvent: false` updates from `applyChannel`
    // also propagate because we manually push the new state below.
    this.form.statusChanges.subscribe(() => {
      this.formValidSignal.set(this.form.valid);
    });
  }

  /**
   * Preview subject (S-DEL-010) — uses the parent-provided override when
   * available, otherwise falls back to the translated template
   * `invoicing.sendModal.preview.subject` with `{{number}}` interpolation.
   */
  previewSubject = computed<string>(() => {
    const ctx = this.contextSignal();
    if (ctx?.previewSubject) return ctx.previewSubject;
    if (!ctx) return '';
    const tpl = this.translation.instant('invoicing.sendModal.preview.subject');
    return tpl.replace('{{number}}', ctx.documentNumber);
  });

  /**
   * Preview body snippet (S-DEL-010) — same fallback contract as
   * `previewSubject`, keyed off `invoicing.sendModal.preview.body`.
   */
  previewBody = computed<string>(() => {
    const ctx = this.contextSignal();
    if (ctx?.previewBody) return ctx.previewBody;
    if (!ctx) return '';
    const tpl = this.translation.instant('invoicing.sendModal.preview.body');
    return tpl.replace('{{number}}', ctx.documentNumber);
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['context']) {
      this.contextSignal.set(this.context);
    }
    if (changes['isOpen']?.currentValue === true) {
      // Mirror the @Input into the signal so computed previews update on
      // re-open even when the parent re-binds the same context object.
      this.contextSignal.set(this.context);
      // Re-seed the recipient whenever the modal is (re-)opened.
      this.applyChannel(this.channel());
    }
  }

  selectChannel(c: DeliveryChannel): void {
    this.channel.set(c);
    this.applyChannel(c);
  }

  private applyChannel(c: DeliveryChannel): void {
    const ctx = this.context;
    const seeded =
      c === 'WHATSAPP' ? ctx?.customerPhone ?? '' : ctx?.customerEmail ?? '';
    this.form.controls.to.setValue(seeded);

    // Validators depend on the channel.
    //   EMAIL / BOTH → standard email validator (BOTH uses the same email
    //                  override; the BE pulls the customer's stored phone
    //                  for the WhatsApp leg).
    //   WHATSAPP    → Tunisian phone validator that mirrors the BE
    //                 `normalizeTunisiaPhone()` shape.
    const validators =
      c === 'WHATSAPP'
        ? [Validators.required, tunisianPhoneValidator(), Validators.maxLength(20)]
        : [Validators.required, Validators.email, Validators.maxLength(255)];
    this.form.controls.to.setValidators(validators);
    this.form.controls.to.updateValueAndValidity();
    // Belt-and-braces: even when statusChanges already fired, push a
    // fresh value into the signal so any computed picks up the swap on
    // the same CD tick (some channel switches don't change validity).
    this.formValidSignal.set(this.form.valid);
  }

  onSubmit(): void {
    // Trim whitespace BEFORE re-checking validity so leading/trailing
    // spaces don't fail `Validators.email` (e.g. user pastes "  ala@x.tn ").
    const raw = this.form.controls.to.value ?? '';
    const trimmed = raw.trim();
    if (trimmed !== raw) {
      this.form.controls.to.setValue(trimmed, { emitEvent: false });
      this.form.controls.to.updateValueAndValidity({ emitEvent: false });
      // Push the post-trim validity into the signal — `emitEvent: false`
      // skipped statusChanges, so canSubmit() would otherwise be stale.
      this.formValidSignal.set(this.form.valid);
    }
    if (!this.canSubmit()) {
      this.form.controls.to.markAsTouched();
      return;
    }
    this.send.emit({
      channel: this.channel(),
      to: trimmed,
    });
  }

  onBackdrop(event: Event): void {
    if (event.target === event.currentTarget) this.onClose();
  }

  onClose(): void {
    if (this.submitting) return;
    this.close.emit();
  }
}
