import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ToastService } from '../../../../shared/services/toast.service';
import { QuoteService } from '../../../../core/services/quote.service';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { TranslationService } from '../../../../core/services/translation.service';
import {
  QuoteStatus,
  QuoteWithDetails,
} from '../../../../core/models/quote.model';

@Component({
  selector: 'app-quote-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './quote-detail.component.html',
  styleUrl: './quote-detail.component.css',
})
export class QuoteDetailPageComponent implements OnInit {
  private quoteService = inject(QuoteService);
  private invoiceService = inject(InvoiceService);
  private translationService = inject(TranslationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  quote = signal<QuoteWithDetails | null>(null);
  isLoading = signal(false);
  busy = signal(false);
  /**
   * S-QUO-020 — when the quote is APPROVED, hydrate the linked invoice's
   * fiscal number so the "Converted to INV-..." link can render with the
   * customer-friendly number rather than a bare UUID.
   */
  linkedInvoiceNumber = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/invoices/quotes']);
      return;
    }
    this.load(id);
  }

  private load(id: string): void {
    this.isLoading.set(true);
    this.quoteService.get(id).subscribe({
      next: (q) => {
        this.quote.set(q);
        this.isLoading.set(false);
        this.hydrateLinkedInvoice(q);
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.error(this.translationService.instant('invoicing.quotes.detail.loadFailed'));
      },
    });
  }

  private hydrateLinkedInvoice(q: QuoteWithDetails): void {
    const linkedId = q.convertedToInvoiceId;
    if (!linkedId || q.status !== 'APPROVED') {
      this.linkedInvoiceNumber.set(null);
      return;
    }
    this.invoiceService.fetchInvoiceById(linkedId).subscribe({
      next: (inv) => this.linkedInvoiceNumber.set(inv.invoiceNumber ?? null),
      // Non-fatal — fall back to a generic label if the lookup fails.
      error: () => this.linkedInvoiceNumber.set(null),
    });
  }

  edit(): void {
    const q = this.quote();
    if (!q || q.status !== 'DRAFT') return;
    this.router.navigate(['/invoices/quotes/edit', q.id]);
  }

  send(): void {
    const q = this.quote();
    if (!q || this.busy()) return;
    this.busy.set(true);
    this.quoteService.send(q.id).subscribe({
      next: (updated) => {
        this.quote.set(updated);
        this.busy.set(false);
        this.toast.success(this.translationService.instant('invoicing.quotes.detail.sent'));
      },
      error: () => {
        this.busy.set(false);
        this.toast.error(this.translationService.instant('invoicing.quotes.detail.sendFailed'));
      },
    });
  }

  approve(): void {
    const q = this.quote();
    if (!q || this.busy()) return;
    this.busy.set(true);
    this.quoteService.approve(q.id).subscribe({
      next: ({ quote, invoiceId }) => {
        this.busy.set(false);
        this.toast.success(this.translationService.instant('invoicing.quotes.detail.approved'));
        // BUG-105 — only navigate when we have a real invoice id. The BE
        // returns `{ quote, invoice: { id } }`; if for any reason the
        // invoice payload is missing, hydrate the local quote signal so
        // the "Converted to INV-..." link still surfaces from the
        // updated state instead of routing to /invoices/undefined.
        if (invoiceId) {
          this.router.navigate(['/invoices', invoiceId]);
        } else {
          this.quote.set(quote);
          this.hydrateLinkedInvoice(quote);
        }
      },
      error: () => {
        this.busy.set(false);
        this.toast.error(this.translationService.instant('invoicing.quotes.detail.approveFailed'));
      },
    });
  }

  reject(): void {
    const q = this.quote();
    if (!q || this.busy()) return;
    this.busy.set(true);
    this.quoteService.reject(q.id).subscribe({
      next: (updated) => {
        this.quote.set(updated);
        this.busy.set(false);
        this.toast.success(this.translationService.instant('invoicing.quotes.detail.rejected'));
      },
      error: () => {
        this.busy.set(false);
        this.toast.error(this.translationService.instant('invoicing.quotes.detail.rejectFailed'));
      },
    });
  }

  formatCurrency(amount: number): string {
    return this.invoiceService.formatCurrency(amount);
  }

  formatDate(date: Date): string {
    return this.invoiceService.formatDate(date);
  }

  getStatusBadgeClass(status: QuoteStatus): string {
    return this.quoteService.getStatusBadgeClass(status);
  }

  getStatusLabel(status: QuoteStatus): string {
    return this.translationService.instant(
      `invoicing.quotes.status.${status.toLowerCase()}`,
    );
  }

  isExpired(): boolean {
    const q = this.quote();
    return q ? this.quoteService.isExpired(q) : false;
  }
}
