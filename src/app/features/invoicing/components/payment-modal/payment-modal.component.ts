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

  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<PaymentModalResult>();

  private fb = inject(FormBuilder);

  readonly methods = PAYMENT_METHODS;
  readonly method = signal<PaymentMethod>('cash');

  form = this.fb.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    paymentDate: [new Date().toISOString().split('T')[0], Validators.required],
    reference: [''],
    notes: [''],
  });

  readonly canSubmit = computed(
    () => this.form.valid && !this.submitting,
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue && this.context) {
      this.method.set('cash');
      this.form.reset({
        amount: this.context.remainingAmount,
        paymentDate: new Date().toISOString().split('T')[0],
        reference: '',
        notes: '',
      });
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
    const v = this.form.value;
    this.submit.emit({
      amount: v.amount ?? 0,
      method: this.method(),
      paymentDate: v.paymentDate ?? new Date().toISOString().split('T')[0],
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
