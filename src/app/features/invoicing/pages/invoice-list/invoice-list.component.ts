import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
 * Sweep B-4 (S-INV-029): client-side pagination.
 *  - PAGE_SIZE rows per page (25), prev/next + 1-indexed counter.
 *  - Filter handlers reset `currentPage` to 1.
 *
 * Sweep C-20 (S-PERF-001): switched to server-driven pagination.
 *  - `currentPage` is the BE page param; navigation triggers a fresh
 *    `getInvoicesPaginated({ page, limit, search })` request.
 *  - `totalCount` mirrors the BE's `total` so `totalPages` = ⌈total/PAGE_SIZE⌉.
 *  - The page returned by the BE is already sliced — the in-memory
 *    `pagedInvoices` slice reduces to a no-op pass-through so we keep
 *    one render path for both shapes.
 *
 * Sweep C-24: status / paymentMethod filters are now SERVER-SIDE.
 *  - The `fetch$` payload carries `status` / `paymentMethod` so the
 *    BE's `where` clause filters and the count reflects the filter.
 *    Pre-C-24 the FE did `.filter()` over the rendered 25 rows and
 *    showed "Showing 1-25 of 240" with an empty list when filtering
 *    "Overdue" — that lie is now fixed.
 *  - "All Statuses" / "All Payment Methods" map to the sentinel
 *    string `'all'` and OMIT the param from the query string. Only
 *    specific values trigger filtering.
 *  - Changing a filter resets `currentPage` to 1 (matches the search
 *    contract — page state is meaningless when the filtered total
 *    changes shape).
 *  - The client-side `.filter()` over the rendered page is REMOVED;
 *    `filteredInvoices` becomes a pass-through to satisfy the existing
 *    template binding.
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
  private destroyRef = inject(DestroyRef);

  /**
   * S-PERF-002 (Sweep C-18) — debounce gate for the search input.
   * `next()` cancels any in-flight `GET /invoices?search=` via switchMap,
   * so rapid keystrokes only result in one settled request.
   *
   * S-PERF-001 (Sweep C-20) — page-change Subject feeds the same
   * switchMap pipeline so a rapid Next-Next-Next click sequence only
   * results in the latest page settling. Both signals (`searchQuery`,
   * `currentPage`) emit through their respective Subjects on user
   * interaction; the consolidated pipeline below routes them to one
   * BE call.
   *
   * Sweep C-24 — payload extended with `status` / `paymentMethod` so
   * filter changes flow through the same switchMap pipeline. The
   * sentinel `'all'` is dropped before forwarding to the service so
   * the BE never sees a literal `?status=all`.
   */
  private readonly fetch$ = new Subject<{
    search: string;
    page: number;
    status: string;
    paymentMethod: string;
  }>();

  /** Pagination — page size is intentionally fixed (no UI knob) at 25. */
  static readonly PAGE_SIZE = 25;

  invoices = signal<InvoiceWithDetails[]>([]);
  totalCount = signal(0);
  isLoading = signal(false);

  searchQuery = signal('');
  selectedStatus = signal<string>('all');
  selectedPaymentMethod = signal<string>('all');
  showMobileFilters = signal(false);
  currentPage = signal(1);

  /**
   * Sweep C-24: status / paymentMethod filtering moved to the server,
   * so `filteredInvoices` is now a pass-through to keep the template
   * binding stable. The page that arrives from the BE is already
   * filtered + paginated; client-side narrowing would only make the
   * footer's "Showing X-Y of Z" math lie again.
   */
  filteredInvoices = computed(() => this.invoices());

  /**
   * Server-authoritative — `totalCount` is the post-search total from
   * the BE envelope. `Math.max(1, ...)` keeps the pagination footer
   * stable when totalCount=0.
   */
  totalPages = computed(() => {
    const total = this.totalCount();
    return Math.max(1, Math.ceil(total / InvoiceListPageComponent.PAGE_SIZE));
  });

  /**
   * Effective page number — clamped to `[1, totalPages]` so the BE's
   * out-of-range pages still render coherently while the next request
   * settles.
   */
  effectivePage = computed(() => {
    const total = this.totalPages();
    return Math.min(Math.max(1, this.currentPage()), total);
  });

  pageStart = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return (this.effectivePage() - 1) * InvoiceListPageComponent.PAGE_SIZE + 1;
  });

  pageEnd = computed(() => {
    const total = this.totalCount();
    return Math.min(
      total,
      this.effectivePage() * InvoiceListPageComponent.PAGE_SIZE,
    );
  });

  /**
   * Sweep C-20: server has already sliced — pass through the server
   * page directly. Status / paymentMethod filters narrow the page in
   * memory; the slice from `[start, end]` no longer applies because
   * `invoices()` IS the page.
   */
  pagedInvoices = computed(() => this.filteredInvoices());


  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const status = params.get('status');
      if (status) {
        this.selectedStatus.set(status);
        this.currentPage.set(1);
      }
    });

    // S-PERF-001 / S-PERF-002 / Sweep C-24 — single fetch pipeline.
    // Search + page-change + status / paymentMethod filter changes
    // all emit through `fetch$`; switchMap cancels any in-flight
    // request when a newer one arrives, so rapid Next clicks or
    // rapid typing collapse to the latest settled response.
    this.fetch$
      .pipe(
        switchMap(({ search, page, status, paymentMethod }) => {
          this.isLoading.set(true);
          return this.invoiceService.getInvoicesPaginated({
            search,
            page,
            limit: InvoiceListPageComponent.PAGE_SIZE,
            // 'all' sentinel → omit from query string. The
            // service's BE serialiser only sets the param when the
            // value is truthy AND non-empty.
            status: status === 'all' ? undefined : status,
            paymentMethod:
              paymentMethod === 'all' ? undefined : paymentMethod,
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (envelope) => {
          this.invoices.set(envelope.items);
          this.totalCount.set(envelope.total);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });

    // Search input gets its own 300ms debounce upstream of the unified
    // pipeline; page-change navigations skip the debounce (immediate).
    this.searchDebounce$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.searchQuery.set(term);
        this.currentPage.set(1);
        this.fetch$.next({
          search: term,
          page: 1,
          status: this.selectedStatus(),
          paymentMethod: this.selectedPaymentMethod(),
        });
      });

    this.loadInvoices();
  }

  /** Search-only debounce gate. Keeps the input responsive while still
   * capping the BE hit-rate at one request per 300ms. */
  private readonly searchDebounce$ = new Subject<string>();

  private loadInvoices(): void {
    this.fetch$.next({
      search: this.searchQuery().trim(),
      page: this.currentPage(),
      status: this.selectedStatus(),
      paymentMethod: this.selectedPaymentMethod(),
    });
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    // Set the visible signal immediately so the input value stays in
    // sync with the controlled input; the BE call is debounced.
    this.searchQuery.set(value);
    this.currentPage.set(1);
    this.searchDebounce$.next(value);
  }
  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedStatus.set(value);
    // Sweep C-24: changing the status filter resets pagination to
    // page 1 (the filtered total has a different shape) AND fires a
    // fresh fetch so the BE narrows the result set.
    this.currentPage.set(1);
    this.fetch$.next({
      search: this.searchQuery().trim(),
      page: 1,
      status: value,
      paymentMethod: this.selectedPaymentMethod(),
    });
  }
  onPaymentMethodChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedPaymentMethod.set(value);
    this.currentPage.set(1);
    this.fetch$.next({
      search: this.searchQuery().trim(),
      page: 1,
      status: this.selectedStatus(),
      paymentMethod: value,
    });
  }
  toggleMobileFilters(): void {
    this.showMobileFilters.update((v) => !v);
  }
  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedStatus.set('all');
    this.selectedPaymentMethod.set('all');
    this.currentPage.set(1);
    // Re-hydrate page 1 of the unfiltered set.
    this.fetch$.next({
      search: '',
      page: 1,
      status: 'all',
      paymentMethod: 'all',
    });
  }

  /** Pagination handlers — server-driven; emit a fetch for the new page. */
  goToNextPage(): void {
    const next = this.effectivePage() + 1;
    if (next <= this.totalPages()) {
      this.currentPage.set(next);
      this.fetch$.next({
        search: this.searchQuery().trim(),
        page: next,
        status: this.selectedStatus(),
        paymentMethod: this.selectedPaymentMethod(),
      });
    }
  }
  goToPreviousPage(): void {
    const prev = this.effectivePage() - 1;
    if (prev >= 1) {
      this.currentPage.set(prev);
      this.fetch$.next({
        search: this.searchQuery().trim(),
        page: prev,
        status: this.selectedStatus(),
        paymentMethod: this.selectedPaymentMethod(),
      });
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
