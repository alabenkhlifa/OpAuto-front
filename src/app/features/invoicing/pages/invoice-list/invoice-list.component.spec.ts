import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';

import { InvoiceListPageComponent } from './invoice-list.component';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { TranslationService } from '../../../../core/services/translation.service';
import {
  InvoiceStatus,
  InvoiceWithDetails,
  PaymentMethod,
} from '../../../../core/models/invoice.model';

/**
 * Sweep B-4 — pins S-INV-028 (status / search filters) and S-INV-029
 * (pagination) on the rebuilt invoice list page.
 *
 * Sweep C-20 (S-PERF-001) — pagination flipped from client-side slice
 * to server-driven `getInvoicesPaginated()` envelopes. Specs were
 * rewritten to assert:
 *   - the BE call carries the right `{ search, page, limit }` opts,
 *   - `totalCount` is server-authoritative,
 *   - rapid Next clicks switchMap-collapse to the latest page,
 *   - search resets `currentPage` to 1.
 *
 * Sweep C-24 — status / paymentMethod filtering moved to the server
 * via `?status=` / `?paymentMethod=`. Specs rewritten to assert:
 *   - filter selection triggers a fresh BE fetch with the param,
 *   - "All" sentinel omits the param from the call,
 *   - `totalCount` reflects the filtered total (no more "1-25 of 240"
 *     while showing 0 OVERDUE rows),
 *   - changing a filter resets `currentPage` to 1.
 *
 * Karma `.html` loader hits subfolder specs in this repo (project
 * memory: pre-existing). Tests stay template-agnostic — they read
 * the public signals + computeds directly.
 */
describe('InvoiceListPageComponent', () => {
  function makeInvoice(overrides: Partial<InvoiceWithDetails> = {}): InvoiceWithDetails {
    return {
      id: 'i1',
      invoiceNumber: 'INV-2026-0001',
      customerId: 'c1',
      carId: 'car1',
      issueDate: new Date('2026-04-15'),
      dueDate: new Date('2026-05-15'),
      status: 'sent' as InvoiceStatus,
      currency: 'TND',
      subtotal: 100,
      taxRate: 19,
      taxAmount: 19,
      discountPercentage: 0,
      discountAmount: 0,
      totalAmount: 119,
      paidAmount: 0,
      remainingAmount: 119,
      lineItems: [],
      paymentTerms: 'Net 30',
      createdBy: 'u1',
      createdAt: new Date('2026-04-15'),
      updatedAt: new Date('2026-04-15'),
      customerName: 'Hela Mahmoud',
      customerPhone: '+216-71',
      customerEmail: 'h@b.tn',
      carMake: 'Toyota',
      carModel: 'Corolla',
      carYear: 2020,
      licensePlate: '111TUN1',
      paymentHistory: [],
      paymentMethod: 'cash' as PaymentMethod,
      ...overrides,
    } as InvoiceWithDetails;
  }

  /**
   * Stub helper — server-driven pagination needs a stub that responds
   * to `getInvoicesPaginated(opts)` with a paginated envelope. Tests
   * either pass a fixed `total` (legacy behavior) or feed responses
   * through a Subject so they can assert switchMap-cancellation.
   */
  function configure(
    pageRows: InvoiceWithDetails[],
    total = pageRows.length,
    queryParams: Record<string, string> = {},
  ) {
    const invoiceServiceStub = {
      getInvoicesPaginated: jasmine
        .createSpy('getInvoicesPaginated')
        .and.callFake((opts: { search?: string; page?: number; limit?: number }) =>
          of({
            items: pageRows,
            total,
            page: opts.page ?? 1,
            limit: opts.limit ?? 25,
          }),
        ),
      // Legacy back-compat — kept so any incidental caller doesn't crash.
      getInvoices: jasmine
        .createSpy('getInvoices')
        .and.returnValue(of(pageRows)),
      formatCurrency: (n: number) => `${n.toFixed(2)} TND`,
      formatDate: (d: Date) => d.toISOString().split('T')[0],
      getStatusBadgeClass: () => 'badge badge-active',
    };
    const translationServiceStub = {
      instant: (k: string) => k,
      getCurrentLanguage: () => 'en',
      translations$: of({}),
    };
    const queryParamMap = {
      get: (key: string) => queryParams[key] ?? null,
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: InvoiceService, useValue: invoiceServiceStub },
        { provide: TranslationService, useValue: translationServiceStub },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(queryParamMap) },
        },
      ],
    });
    return invoiceServiceStub;
  }

  // ── S-INV-028 — filter by status, search by invoice number / customer ──

  describe('S-INV-028 — list-view filters (status + search)', () => {
    it('hydrates filter from ?status=draft query param', () => {
      configure([makeInvoice()], 1, { status: 'draft' });
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      fixture.componentInstance.ngOnInit();
      expect(fixture.componentInstance.selectedStatus()).toBe('draft');
    });

    it('exposes the full InvoiceStatus enum (8 statuses)', () => {
      configure([]);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      const statuses = cmp.getAvailableStatuses();
      expect(statuses).toEqual([
        'draft',
        'sent',
        'viewed',
        'paid',
        'partially-paid',
        'overdue',
        'cancelled',
        'refunded',
      ]);
    });

    it('filteredInvoices is a pass-through to invoices() (Sweep C-24 moved status filter to BE)', () => {
      // Sweep C-24: BE returns the page already filtered; the FE no
      // longer narrows in-memory. The pass-through keeps the existing
      // template binding stable.
      const a = makeInvoice({ id: 'a1', status: 'draft' });
      const b = makeInvoice({ id: 'b1', status: 'sent' });
      const c = makeInvoice({ id: 'c1', status: 'paid' });
      configure([a, b, c], 3);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      expect(cmp.filteredInvoices().length).toBe(3);

      // Setting selectedStatus alone (without calling onStatusChange)
      // does NOT narrow the rendered list — that's the whole point of
      // the BE-driven contract.
      cmp.selectedStatus.set('draft');
      expect(cmp.filteredInvoices().length).toBe(3);
    });

    it('clearFilters resets searchQuery, status, and paymentMethod', () => {
      configure([makeInvoice()]);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.searchQuery.set('foo');
      cmp.selectedStatus.set('draft');
      cmp.selectedPaymentMethod.set('cash');
      cmp.clearFilters();

      expect(cmp.searchQuery()).toBe('');
      expect(cmp.selectedStatus()).toBe('all');
      expect(cmp.selectedPaymentMethod()).toBe('all');
    });
  });

  // ── S-INV-029 — pagination (server-driven post Sweep C-20) ──

  describe('S-INV-029 — server-driven pagination', () => {
    it('PAGE_SIZE constant is 25', () => {
      expect(InvoiceListPageComponent.PAGE_SIZE).toBe(25);
    });

    it('initial fetch calls getInvoicesPaginated with page=1, limit=25, search="" and "all" filters omitted', () => {
      const stub = configure([makeInvoice()], 1);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      expect(stub.getInvoicesPaginated).toHaveBeenCalled();
      const lastCall = stub.getInvoicesPaginated.calls.mostRecent().args[0];
      // Sweep C-24: 'all' sentinel collapses to undefined for both
      // filter params so the BE never sees a literal `?status=all`.
      expect(lastCall).toEqual({
        search: '',
        page: 1,
        limit: 25,
        status: undefined,
        paymentMethod: undefined,
      });
    });

    it('totalPages computes from server-authoritative totalCount', () => {
      configure(Array.from({ length: 25 }, (_, i) => makeInvoice({ id: `i${i}` })), 237);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      expect(cmp.totalCount()).toBe(237);
      expect(cmp.totalPages()).toBe(10); // ⌈237/25⌉ = 10
      expect(cmp.pageStart()).toBe(1);
      expect(cmp.pageEnd()).toBe(25);
    });

    it('Next page emits a new BE fetch with page=2, search preserved', () => {
      const stub = configure(
        Array.from({ length: 25 }, (_, i) => makeInvoice({ id: `i${i}` })),
        100,
      );
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      expect(stub.getInvoicesPaginated).toHaveBeenCalledTimes(1);

      cmp.goToNextPage();
      expect(cmp.currentPage()).toBe(2);
      expect(stub.getInvoicesPaginated).toHaveBeenCalledTimes(2);
      const secondCall = stub.getInvoicesPaginated.calls.mostRecent().args[0];
      expect(secondCall).toEqual({
        search: '',
        page: 2,
        limit: 25,
        status: undefined,
        paymentMethod: undefined,
      });
    });

    it('Previous page emits a fetch with page-1 and is guarded at page 1', () => {
      const stub = configure(
        Array.from({ length: 25 }, (_, i) => makeInvoice({ id: `i${i}` })),
        100,
      );
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.goToNextPage();
      cmp.goToNextPage();
      expect(cmp.currentPage()).toBe(3);

      cmp.goToPreviousPage();
      expect(cmp.currentPage()).toBe(2);

      // Already at boundary — Previous from 1 stays put.
      cmp.currentPage.set(1);
      stub.getInvoicesPaginated.calls.reset();
      cmp.goToPreviousPage();
      expect(cmp.currentPage()).toBe(1);
      expect(stub.getInvoicesPaginated).not.toHaveBeenCalled();
    });

    it('Next is guarded at the last page', () => {
      const stub = configure(
        [makeInvoice({ id: 'last' })],
        50, // 2 pages total
      );
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.goToNextPage(); // → 2
      expect(cmp.currentPage()).toBe(2);
      stub.getInvoicesPaginated.calls.reset();
      cmp.goToNextPage(); // boundary: 2 of 2 → stays at 2
      expect(cmp.currentPage()).toBe(2);
      expect(stub.getInvoicesPaginated).not.toHaveBeenCalled();
    });

    it('handles an empty dataset (totalCount=0 → empty state, no pagination)', () => {
      configure([], 0);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      expect(cmp.totalCount()).toBe(0);
      expect(cmp.totalPages()).toBe(1);
      expect(cmp.pageStart()).toBe(0);
      expect(cmp.pageEnd()).toBe(0);
      expect(cmp.pagedInvoices()).toEqual([]);
    });

    it('renders an empty page coherently when the BE returns out-of-range page', () => {
      // BE returns items=[] but total stays 50 (e.g. user navigated to page 999).
      configure([], 50);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      // totalPages clamps via Math.ceil(50/25) = 2. effectivePage clamps the
      // user's 999 to 2.
      cmp.currentPage.set(999);
      expect(cmp.totalPages()).toBe(2);
      expect(cmp.effectivePage()).toBe(2);
    });

    it('search input resets currentPage to 1 (regression — Sweep B-4 contract)', () => {
      configure([makeInvoice()], 60);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.goToNextPage();
      cmp.goToNextPage();
      expect(cmp.currentPage()).toBe(3);

      cmp.onSearchChange({ target: { value: 'Karoui' } } as unknown as Event);
      expect(cmp.currentPage()).toBe(1);
    });

    it('clearFilters resets to page 1 and re-fetches with empty search', () => {
      const stub = configure([makeInvoice()], 60);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.goToNextPage();
      cmp.goToNextPage();
      expect(cmp.currentPage()).toBe(3);
      stub.getInvoicesPaginated.calls.reset();

      cmp.clearFilters();
      expect(cmp.currentPage()).toBe(1);
      expect(cmp.searchQuery()).toBe('');
      expect(cmp.selectedStatus()).toBe('all');
      expect(cmp.selectedPaymentMethod()).toBe('all');
      const lastCall = stub.getInvoicesPaginated.calls.mostRecent().args[0];
      expect(lastCall).toEqual({
        search: '',
        page: 1,
        limit: 25,
        status: undefined,
        paymentMethod: undefined,
      });
    });

    it('debounced search waits 300ms then emits a single BE call with the latest term', fakeAsync(() => {
      const stub = configure([makeInvoice()], 1);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      stub.getInvoicesPaginated.calls.reset();

      // Three rapid keystrokes — only the latest term should fire.
      cmp.onSearchChange({ target: { value: 'K' } } as unknown as Event);
      cmp.onSearchChange({ target: { value: 'Ka' } } as unknown as Event);
      cmp.onSearchChange({ target: { value: 'Karoui' } } as unknown as Event);

      tick(299);
      expect(stub.getInvoicesPaginated).not.toHaveBeenCalled();

      tick(2);
      expect(stub.getInvoicesPaginated).toHaveBeenCalledTimes(1);
      expect(stub.getInvoicesPaginated.calls.mostRecent().args[0]).toEqual({
        search: 'Karoui',
        page: 1,
        limit: 25,
        status: undefined,
        paymentMethod: undefined,
      });
    }));

    it('rapid Next clicks switchMap-collapse to the latest page (no race)', fakeAsync(() => {
      // Drive responses through a Subject so we can sequence them.
      const responses$ = new Subject<{
        items: InvoiceWithDetails[];
        total: number;
        page: number;
        limit: number;
      }>();
      const stub = {
        getInvoicesPaginated: jasmine
          .createSpy('getInvoicesPaginated')
          .and.callFake(() => responses$.asObservable()),
        getInvoices: jasmine.createSpy().and.returnValue(of([])),
        formatCurrency: (n: number) => `${n} TND`,
        formatDate: (d: Date) => d.toISOString().split('T')[0],
        getStatusBadgeClass: () => 'badge',
      };
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: InvoiceService, useValue: stub },
          {
            provide: TranslationService,
            useValue: {
              instant: (k: string) => k,
              getCurrentLanguage: () => 'en',
              translations$: of({}),
            },
          },
          {
            provide: ActivatedRoute,
            useValue: { queryParamMap: of({ get: () => null }) },
          },
        ],
      });
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      // Settle the initial fetch.
      responses$.next({
        items: [makeInvoice({ id: 'p1' })],
        total: 100,
        page: 1,
        limit: 25,
      });
      tick();

      // Three rapid Next clicks before any settle.
      cmp.goToNextPage(); // page 2
      cmp.goToNextPage(); // page 3
      cmp.goToNextPage(); // page 4
      expect(cmp.currentPage()).toBe(4);

      // The BE responds to the latest fetch — only that envelope settles
      // (switchMap cancelled the prior two). The component reads page 4.
      responses$.next({
        items: [makeInvoice({ id: 'page4-row' })],
        total: 100,
        page: 4,
        limit: 25,
      });
      tick();

      expect(cmp.invoices().length).toBe(1);
      expect(cmp.invoices()[0].id).toBe('page4-row');
    }));

    it('isLoading toggles true → false across a fetch cycle', fakeAsync(() => {
      const responses$ = new Subject<{
        items: InvoiceWithDetails[];
        total: number;
        page: number;
        limit: number;
      }>();
      const stub = {
        getInvoicesPaginated: jasmine
          .createSpy()
          .and.callFake(() => responses$.asObservable()),
        getInvoices: jasmine.createSpy().and.returnValue(of([])),
        formatCurrency: (n: number) => `${n} TND`,
        formatDate: (d: Date) => d.toISOString().split('T')[0],
        getStatusBadgeClass: () => 'badge',
      };
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: InvoiceService, useValue: stub },
          {
            provide: TranslationService,
            useValue: {
              instant: (k: string) => k,
              getCurrentLanguage: () => 'en',
              translations$: of({}),
            },
          },
          {
            provide: ActivatedRoute,
            useValue: { queryParamMap: of({ get: () => null }) },
          },
        ],
      });
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      // Initial fetch — isLoading should be true while in-flight.
      tick();
      expect(cmp.isLoading()).toBe(true);

      responses$.next({ items: [], total: 0, page: 1, limit: 25 });
      tick();
      expect(cmp.isLoading()).toBe(false);
    }));
  });

  // ── Sweep C-24 — server-side status / paymentMethod filter ──

  describe('Sweep C-24 — server-side status / paymentMethod filter', () => {
    it('onStatusChange("overdue") fires fetch with status="overdue" + page=1', () => {
      const stub = configure([makeInvoice()], 240);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      stub.getInvoicesPaginated.calls.reset();

      cmp.onStatusChange({
        target: { value: 'overdue' },
      } as unknown as Event);

      expect(stub.getInvoicesPaginated).toHaveBeenCalledTimes(1);
      const call = stub.getInvoicesPaginated.calls.mostRecent().args[0];
      expect(call).toEqual({
        search: '',
        page: 1,
        limit: 25,
        status: 'overdue',
        paymentMethod: undefined,
      });
    });

    it('onStatusChange resets currentPage to 1 (page=3 → 1) when filter narrows', () => {
      const stub = configure([makeInvoice()], 240);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.goToNextPage();
      cmp.goToNextPage();
      expect(cmp.currentPage()).toBe(3);
      stub.getInvoicesPaginated.calls.reset();

      cmp.onStatusChange({
        target: { value: 'overdue' },
      } as unknown as Event);

      expect(cmp.currentPage()).toBe(1);
      const call = stub.getInvoicesPaginated.calls.mostRecent().args[0];
      expect(call.page).toBe(1);
    });

    it('"All Statuses" → status: undefined (param omitted)', () => {
      const stub = configure([makeInvoice()], 240);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      // Set to overdue first then back to "all"
      cmp.onStatusChange({
        target: { value: 'overdue' },
      } as unknown as Event);
      stub.getInvoicesPaginated.calls.reset();

      cmp.onStatusChange({ target: { value: 'all' } } as unknown as Event);

      const call = stub.getInvoicesPaginated.calls.mostRecent().args[0];
      expect(call.status).toBeUndefined();
    });

    it('onPaymentMethodChange("cash") fires fetch with paymentMethod="cash" + page=1', () => {
      const stub = configure([makeInvoice()], 240);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      stub.getInvoicesPaginated.calls.reset();

      cmp.onPaymentMethodChange({
        target: { value: 'cash' },
      } as unknown as Event);

      const call = stub.getInvoicesPaginated.calls.mostRecent().args[0];
      expect(call).toEqual({
        search: '',
        page: 1,
        limit: 25,
        status: undefined,
        paymentMethod: 'cash',
      });
    });

    it('totalCount reflects the filtered total returned by the BE (not the unfiltered global)', () => {
      // Reproduces the exact bug C-24 fixes: pre-fix, the BE returned
      // `total: 240` (unfiltered) and the FE showed "Showing 1-25 of 240"
      // even when the OVERDUE list was empty. Now the BE narrows count
      // and the FE mirrors it.
      const stub = configure([makeInvoice({ status: 'overdue' })], 8);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.onStatusChange({
        target: { value: 'overdue' },
      } as unknown as Event);

      // Stub is wired to ALWAYS return the same envelope, so the
      // filtered fetch settles with total=8.
      expect(cmp.totalCount()).toBe(8);
      expect(cmp.totalPages()).toBe(1);
      // Footer hidden (single page) — the contract from C-20 stays.
      expect(cmp.pageStart()).toBe(1);
    });

    it('combines status + paymentMethod + search in the BE call', () => {
      const stub = configure([makeInvoice()], 3);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      // Type a search term, then pick a status, then a payment method.
      cmp.searchQuery.set('Karoui');
      cmp.onStatusChange({ target: { value: 'sent' } } as unknown as Event);
      stub.getInvoicesPaginated.calls.reset();

      cmp.onPaymentMethodChange({
        target: { value: 'cash' },
      } as unknown as Event);

      const call = stub.getInvoicesPaginated.calls.mostRecent().args[0];
      expect(call).toEqual({
        search: 'Karoui',
        page: 1,
        limit: 25,
        status: 'sent',
        paymentMethod: 'cash',
      });
    });

    it('clearFilters() omits status + paymentMethod from the BE call', () => {
      const stub = configure([makeInvoice()], 240);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.onStatusChange({
        target: { value: 'overdue' },
      } as unknown as Event);
      cmp.onPaymentMethodChange({
        target: { value: 'cash' },
      } as unknown as Event);
      stub.getInvoicesPaginated.calls.reset();

      cmp.clearFilters();

      const call = stub.getInvoicesPaginated.calls.mostRecent().args[0];
      expect(call.status).toBeUndefined();
      expect(call.paymentMethod).toBeUndefined();
      expect(call.search).toBe('');
    });

    it('Next page preserves status + paymentMethod filters across navigation', () => {
      const stub = configure(
        Array.from({ length: 25 }, (_, i) => makeInvoice({ id: `i${i}` })),
        50,
      );
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.onStatusChange({
        target: { value: 'overdue' },
      } as unknown as Event);
      cmp.onPaymentMethodChange({
        target: { value: 'cash' },
      } as unknown as Event);
      stub.getInvoicesPaginated.calls.reset();

      cmp.goToNextPage();

      const call = stub.getInvoicesPaginated.calls.mostRecent().args[0];
      expect(call.page).toBe(2);
      expect(call.status).toBe('overdue');
      expect(call.paymentMethod).toBe('cash');
    });
  });
});
