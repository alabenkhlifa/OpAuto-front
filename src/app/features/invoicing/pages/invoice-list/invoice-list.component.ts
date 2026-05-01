import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { TranslationService } from '../../../../core/services/translation.service';
import {
  InvoiceStatus,
  InvoiceWithDetails,
  PaymentMethod,
} from '../../../../core/models/invoice.model';

/**
 * InvoiceListPage — searchable, filterable list of all invoices.
 * Extracted from the legacy invoicing.component.html "list" view so
 * the parent shell can host it under `/invoices/list`.
 *
 * Sweep B-4 (S-INV-029): adds minimal client-side pagination.
 *  - PAGE_SIZE rows per page (25), prev/next + 1-indexed counter.
 *  - Filter handlers (`onSearchChange` / `onStatusChange` /
 *    `onPaymentMethodChange` / `clearFilters`) reset `currentPage` to 1.
 *  - The `effectivePage` computed clamps to `[1, totalPages]` so the slice
 *    is always in-bounds even if the dataset shrinks asynchronously.
 *  - Server-side pagination is tracked under S-PERF-001 (P3) — not needed
 *    until the dataset grows past a few thousand rows; the BE list endpoint
 *    is currently `GET /api/invoices` (returns all rows) and would need
 *    `?page=` / `?limit=` / `?status=` / `?search=` query params before
 *    the FE can switch to pagination on the wire.
 */
@Component({
  selector: 'app-invoice-list-page',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './invoice-list.component.html',
  styleUrl: './invoice-list.component.css',
})
export class InvoiceListPageComponent implements OnInit {
  private invoiceService = inject(InvoiceService);
  private translationService = inject(TranslationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Pagination — page size is intentionally fixed (no UI knob) at 25. */
  static readonly PAGE_SIZE = 25;

  invoices = signal<InvoiceWithDetails[]>([]);
  isLoading = signal(false);

  searchQuery = signal('');
  selectedStatus = signal<string>('all');
  selectedPaymentMethod = signal<string>('all');
  showMobileFilters = signal(false);
  currentPage = signal(1);

  filteredInvoices = computed(() => {
    let filtered = [...this.invoices()];
    const query = this.searchQuery().toLowerCase();
    if (query) {
      filtered = filtered.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(query) ||
          inv.customerName.toLowerCase().includes(query) ||
          inv.licensePlate.toLowerCase().includes(query) ||
          (inv.serviceName ?? '').toLowerCase().includes(query),
      );
    }
    const status = this.selectedStatus();
    if (status !== 'all') {
      filtered = filtered.filter((inv) => inv.status === status);
    }
    const method = this.selectedPaymentMethod();
    if (method !== 'all') {
      filtered = filtered.filter((inv) => inv.paymentMethod === method);
    }
    return filtered.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
  });

  totalPages = computed(() => {
    const total = this.filteredInvoices().length;
    return Math.max(1, Math.ceil(total / InvoiceListPageComponent.PAGE_SIZE));
  });

  /**
   * Effective page number — always clamped to the available range so the
   * computeds below never produce an out-of-bounds slice. The signal can
   * legitimately hold a "stale" value mid-flight (e.g. if the dataset
   * shrinks between render frames); this computed is the source of truth
   * for everything that renders.
   */
  effectivePage = computed(() => {
    const total = this.totalPages();
    return Math.min(Math.max(1, this.currentPage()), total);
  });

  pageStart = computed(() => {
    const total = this.filteredInvoices().length;
    if (total === 0) return 0;
    return (this.effectivePage() - 1) * InvoiceListPageComponent.PAGE_SIZE + 1;
  });

  pageEnd = computed(() => {
    const total = this.filteredInvoices().length;
    return Math.min(total, this.effectivePage() * InvoiceListPageComponent.PAGE_SIZE);
  });

  pagedInvoices = computed(() => {
    const all = this.filteredInvoices();
    const size = InvoiceListPageComponent.PAGE_SIZE;
    const start = (this.effectivePage() - 1) * size;
    return all.slice(start, start + size);
  });


  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const status = params.get('status');
      if (status) {
        this.selectedStatus.set(status);
        this.currentPage.set(1);
      }
    });
    this.loadInvoices();
  }

  private loadInvoices(): void {
    this.isLoading.set(true);
    this.invoiceService.getInvoices().subscribe({
      next: (rows) => {
        this.invoices.set(rows);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  onSearchChange(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }
  onStatusChange(event: Event): void {
    this.selectedStatus.set((event.target as HTMLSelectElement).value);
    this.currentPage.set(1);
  }
  onPaymentMethodChange(event: Event): void {
    this.selectedPaymentMethod.set((event.target as HTMLSelectElement).value);
    this.currentPage.set(1);
  }
  toggleMobileFilters(): void {
    this.showMobileFilters.update((v) => !v);
  }
  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedStatus.set('all');
    this.selectedPaymentMethod.set('all');
    this.currentPage.set(1);
  }

  /** Pagination handlers — guarded so they never overshoot. */
  goToNextPage(): void {
    const next = this.effectivePage() + 1;
    if (next <= this.totalPages()) {
      this.currentPage.set(next);
    }
  }
  goToPreviousPage(): void {
    const prev = this.effectivePage() - 1;
    if (prev >= 1) {
      this.currentPage.set(prev);
    }
  }

  onInvoiceSelect(invoice: InvoiceWithDetails): void {
    this.router.navigate(['/invoices', invoice.id]);
  }

  navigateToCreate(): void {
    this.router.navigate(['/invoices/create']);
  }

  formatCurrency(amount: number, currency: string = 'TND'): string {
    return this.invoiceService.formatCurrency(amount, currency);
  }
  formatDate(date: Date): string {
    return this.invoiceService.formatDate(date);
  }
  getStatusBadgeClass(status: InvoiceStatus): string {
    return this.invoiceService.getStatusBadgeClass(status);
  }

  getStatusLabel(status: InvoiceStatus): string {
    const map: Record<InvoiceStatus, string> = {
      'draft': 'draft',
      'sent': 'sent',
      'viewed': 'viewed',
      'paid': 'paid',
      'partially-paid': 'partiallyPaid',
      'overdue': 'overdue',
      'cancelled': 'cancelled',
      'refunded': 'refunded',
    };
    return this.translationService.instant(`invoicing.status.${map[status]}`);
  }

  getAvailableStatuses(): InvoiceStatus[] {
    return [
      'draft',
      'sent',
      'viewed',
      'paid',
      'partially-paid',
      'overdue',
      'cancelled',
      'refunded',
    ];
  }

  getAvailablePaymentMethods(): PaymentMethod[] {
    return ['cash', 'card', 'bank-transfer', 'check', 'credit'];
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    const map: Record<PaymentMethod, string> = {
      'cash': 'cash',
      'card': 'card',
      'bank-transfer': 'bankTransfer',
      'check': 'check',
      'credit': 'credit',
    };
    return this.translationService.instant(`invoicing.paymentMethods.${map[method]}`);
  }

  isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  getDaysOverdue(dueDate: Date): number {
    const diff = Date.now() - dueDate.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  isOverdue(invoice: InvoiceWithDetails): boolean {
    return invoice.status !== 'paid' && new Date() > invoice.dueDate;
  }

  getPaymentProgress(invoice: InvoiceWithDetails): number {
    return invoice.totalAmount > 0
      ? (invoice.paidAmount / invoice.totalAmount) * 100
      : 0;
  }
}
