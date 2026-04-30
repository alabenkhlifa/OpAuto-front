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
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

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
  /** Optional preview pane snippet (HTML or plain text). */
  previewHtml?: string;
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

  channel = signal<DeliveryChannel>('EMAIL');
  form = this.fb.group({
    to: ['', [Validators.required, Validators.maxLength(255)]],
  });

  /** Whether the recipient field should validate as email (EMAIL/BOTH) or phone (WHATSAPP). */
  recipientMode = computed<'email' | 'phone'>(() =>
    this.channel() === 'WHATSAPP' ? 'phone' : 'email',
  );

  /** True when the form is valid AND we're not already submitting. */
  canSubmit = computed(() => this.form.valid && !this.submitting);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
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
    const validators =
      c === 'WHATSAPP'
        ? [Validators.required, Validators.minLength(8), Validators.maxLength(20)]
        : [Validators.required, Validators.email, Validators.maxLength(255)];
    this.form.controls.to.setValidators(validators);
    this.form.controls.to.updateValueAndValidity();
  }

  onSubmit(): void {
    if (!this.canSubmit()) {
      this.form.controls.to.markAsTouched();
      return;
    }
    this.send.emit({
      channel: this.channel(),
      to: (this.form.controls.to.value ?? '').trim(),
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
