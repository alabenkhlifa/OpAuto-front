import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { QuoteService } from '../../../../core/services/quote.service';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { TranslationService } from '../../../../core/services/translation.service';
import {
  QuoteStatus,
  QuoteWithDetails,
} from '../../../../core/models/quote.model';

@Component({
  selector: 'app-quote-list-page',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './quote-list.component.html',
  styleUrl: './quote-list.component.css',
})
export class QuoteListPageComponent implements OnInit {
  private quoteService = inject(QuoteService);
  private invoiceService = inject(InvoiceService);
  private translationService = inject(TranslationService);
  private router = inject(Router);

  quotes = signal<QuoteWithDetails[]>([]);
  isLoading = signal(false);
  selectedStatus = signal<string>('all');

  filteredQuotes = computed(() => {
    const status = this.selectedStatus();
    const all = this.quotes();
    return status === 'all'
      ? all
      : all.filter((q) => q.status === status);
  });

  ngOnInit(): void {
    this.isLoading.set(true);
    this.quoteService.list().subscribe({
      next: (rows) => {
        this.quotes.set(rows);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  navigateNew(): void {
    this.router.navigate(['/invoices/quotes/new']);
  }

  navigateDetail(id: string): void {
    this.router.navigate(['/invoices/quotes', id]);
  }

  onStatusChange(event: Event): void {
    this.selectedStatus.set((event.target as HTMLSelectElement).value);
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

  getAvailableStatuses(): QuoteStatus[] {
    return ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED'];
  }

  isExpired(quote: QuoteWithDetails): boolean {
    return this.quoteService.isExpired(quote);
  }
}
