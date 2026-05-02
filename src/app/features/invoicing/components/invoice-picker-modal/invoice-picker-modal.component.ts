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
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { InvoiceWithDetails } from '../../../../core/models/invoice.model';

/**
 * InvoicePickerModalComponent — small list-style picker that lets the user
 * choose an outstanding invoice. Emits the chosen invoice and the parent
 * decides what to do next (typically: open the payment-modal).
 *
 * Used by:
 *   • InvoicingDashboardComponent — Quick action "Record Payment"
 *   • InvoicingComponent (shell)  — "+ New → Payment"
 *
 * Filtering: only invoices with `remainingAmount > 0` AND status in
 * (sent | viewed | partially-paid | overdue) — i.e. those eligible for a
 * payment under `canShow('recordPayment')` semantics.
 */
@Component({
  selector: 'app-invoice-picker-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './invoice-picker-modal.component.html',
  styleUrl: './invoice-picker-modal.component.css',
})
export class InvoicePickerModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() invoices: InvoiceWithDetails[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() pick = new EventEmitter<InvoiceWithDetails>();

  private invoiceService = inject(InvoiceService);

  readonly query = signal('');

  readonly payable = computed(() =>
    this.invoices.filter(
      (i) =>
        i.remainingAmount > 0 &&
        (i.status === 'sent' ||
          i.status === 'viewed' ||
          i.status === 'partially-paid' ||
          i.status === 'overdue'),
    ),
  );

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.payable();
    if (!q) return list;
    return list.filter((i) => {
      const num = (i.invoiceNumber || '').toLowerCase();
      const customer = (i.customerName || '').toLowerCase();
      return num.includes(q) || customer.includes(q);
    });
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue === true) {
      this.query.set('');
    }
  }

  onPick(inv: InvoiceWithDetails): void {
    this.pick.emit(inv);
  }

  onBackdrop(event: Event): void {
    if (event.target === event.currentTarget) this.onClose();
  }

  onClose(): void {
    this.close.emit();
  }

  fmtCurrency(amount: number): string {
    return this.invoiceService.formatCurrency(amount);
  }
}
