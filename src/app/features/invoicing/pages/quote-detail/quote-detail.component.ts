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
      },
      error: () => {
        this.isLoading.set(false);
        this.toast.error(this.translationService.instant('invoicing.quotes.detail.loadFailed'));
      },
    });
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
      next: ({ invoiceId }) => {
        this.busy.set(false);
        this.toast.success(this.translationService.instant('invoicing.quotes.detail.approved'));
        this.router.navigate(['/invoices', invoiceId]);
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
