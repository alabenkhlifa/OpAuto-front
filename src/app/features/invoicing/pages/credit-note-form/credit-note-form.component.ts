import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ToastService } from '../../../../shared/services/toast.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { CreditNoteService } from '../../../../core/services/credit-note.service';
import { InvoiceService } from '../../../../core/services/invoice.service';
import {
  InvoiceLineItem,
  InvoiceWithDetails,
} from '../../../../core/models/invoice.model';

interface SelectableLine extends InvoiceLineItem {
  selected: boolean;
  selectedQty: number;
}

/**
 * CreditNoteFormPage — issues a credit note against a source invoice.
 *
 * Opens with `?invoiceId=X` query param; pulls that invoice's line items
 * and lets the user pick which (and how many) to credit. The actual
 * tax recomputation is done backend-side; the UI shows a quick preview
 * sum as a sanity check.
 */
@Component({
  selector: 'app-credit-note-form-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslatePipe],
  templateUrl: './credit-note-form.component.html',
  styleUrl: './credit-note-form.component.css',
})
export class CreditNoteFormPageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private invoiceService = inject(InvoiceService);
  private creditNoteService = inject(CreditNoteService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private translation = inject(TranslationService);

  invoice = signal<InvoiceWithDetails | null>(null);
  lines = signal<SelectableLine[]>([]);
  isSubmitting = signal(false);

  form = this.fb.group({
    reason: ['', [Validators.required, Validators.minLength(3)]],
    restockParts: [true],
  });

  selectedTotal = computed(() =>
    this.lines()
      .filter((l) => l.selected && l.selectedQty > 0)
      .reduce((sum, l) => sum + l.unitPrice * l.selectedQty, 0),
  );

  ngOnInit(): void {
    const invoiceId = this.route.snapshot.queryParamMap.get('invoiceId');
    if (!invoiceId) {
      this.router.navigate(['/invoices/list']);
      return;
    }
    this.invoiceService.fetchInvoiceById(invoiceId).subscribe({
      next: (inv) => {
        this.invoice.set(inv);
        this.lines.set(
          inv.lineItems.map((li) => ({
            ...li,
            selected: false,
            selectedQty: li.quantity,
          })),
        );
      },
      error: () =>
        this.toast.error(
          this.translation.instant('invoicing.creditNotes.form.loadFailed'),
        ),
    });
  }

  toggle(idx: number, selected: boolean): void {
    const next = [...this.lines()];
    next[idx] = { ...next[idx], selected };
    this.lines.set(next);
  }

  setQty(idx: number, qty: number): void {
    const next = [...this.lines()];
    const line = next[idx];
    const clamped = Math.max(0, Math.min(qty, line.quantity));
    next[idx] = { ...line, selectedQty: clamped };
    this.lines.set(next);
  }

  formatCurrency(amount: number): string {
    return this.invoiceService.formatCurrency(amount);
  }

  cancel(): void {
    this.router.navigate(['/invoices/credit-notes']);
  }

  onSubmit(): void {
    const inv = this.invoice();
    if (!inv) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const selectedLines = this.lines().filter(
      (l) => l.selected && l.selectedQty > 0,
    );
    if (selectedLines.length === 0) {
      this.toast.warning(
        this.translation.instant('invoicing.creditNotes.form.selectAtLeastOne'),
      );
      return;
    }

    this.isSubmitting.set(true);
    this.creditNoteService
      .create({
        invoiceId: inv.id,
        reason: this.form.value.reason ?? '',
        restockParts: !!this.form.value.restockParts,
        lineItems: selectedLines.map((l) => {
          const lAny = l as any;
          // Carry through the source invoice's per-line tvaRate so the
          // credit note recomputes against the same VAT slice.
          const tvaRate =
            typeof lAny.tvaRate === 'number'
              ? lAny.tvaRate
              : l.taxable === false
              ? 0
              : (inv as any).taxRate ?? 19;
          return {
            type: l.type,
            description: l.description,
            quantity: l.selectedQty,
            unit: l.unit,
            unitPrice: l.unitPrice,
            totalPrice: l.unitPrice * l.selectedQty,
            partId: l.partId,
            serviceCode: l.serviceCode,
            mechanicId: l.mechanicId,
            laborHours: l.laborHours,
            discountPercentage: l.discountPercentage,
            taxable: l.taxable,
            tvaRate,
          };
        }),
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.toast.success(
            this.translation.instant('invoicing.creditNotes.form.created'),
          );
          this.router.navigate(['/invoices/credit-notes']);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.toast.error(
            this.translation.instant('invoicing.creditNotes.form.createFailed'),
          );
        },
      });
  }
}
