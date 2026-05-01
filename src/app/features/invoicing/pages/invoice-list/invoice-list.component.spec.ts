import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

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
 * (client-side pagination) on the rebuilt invoice list page.
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

  function configure(invoices: InvoiceWithDetails[], queryParams: Record<string, string> = {}) {
    const invoiceServiceStub = {
      getInvoices: jasmine.createSpy('getInvoices').and.returnValue(of(invoices)),
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
      configure([makeInvoice()], { status: 'draft' });
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

    it('status filter narrows rows to the chosen status only', () => {
      const draft = makeInvoice({ id: 'd1', invoiceNumber: 'DRAFT-aaaa', status: 'draft' });
      const sent = makeInvoice({ id: 's1', invoiceNumber: 'INV-2026-0001', status: 'sent' });
      const paid = makeInvoice({ id: 'p1', invoiceNumber: 'INV-2026-0002', status: 'paid' });
      configure([draft, sent, paid]);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      expect(cmp.filteredInvoices().length).toBe(3);

      cmp.selectedStatus.set('draft');
      expect(cmp.filteredInvoices().length).toBe(1);
      expect(cmp.filteredInvoices()[0].id).toBe('d1');

      cmp.selectedStatus.set('paid');
      expect(cmp.filteredInvoices().length).toBe(1);
      expect(cmp.filteredInvoices()[0].id).toBe('p1');

      cmp.selectedStatus.set('all');
      expect(cmp.filteredInvoices().length).toBe(3);
    });

    it('search matches invoice number (case-insensitive substring)', () => {
      const a = makeInvoice({ id: 'a', invoiceNumber: 'INV-2026-0001' });
      const b = makeInvoice({ id: 'b', invoiceNumber: 'INV-2026-0099' });
      const c = makeInvoice({ id: 'c', invoiceNumber: 'DRAFT-abc12345' });
      configure([a, b, c]);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.searchQuery.set('0099');
      expect(cmp.filteredInvoices().length).toBe(1);
      expect(cmp.filteredInvoices()[0].id).toBe('b');

      // Case insensitive
      cmp.searchQuery.set('draft-');
      expect(cmp.filteredInvoices().length).toBe(1);
      expect(cmp.filteredInvoices()[0].id).toBe('c');

      cmp.searchQuery.set('');
      expect(cmp.filteredInvoices().length).toBe(3);
    });

    it('search matches customer name (case-insensitive substring)', () => {
      const a = makeInvoice({ id: 'a', customerName: 'Hela Mahmoud' });
      const b = makeInvoice({ id: 'b', customerName: 'Aymen Mansouri' });
      const c = makeInvoice({ id: 'c', customerName: 'Nizar Jebali' });
      configure([a, b, c]);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.searchQuery.set('hela');
      expect(cmp.filteredInvoices().length).toBe(1);
      expect(cmp.filteredInvoices()[0].id).toBe('a');

      cmp.searchQuery.set('MAN');
      // Only "Mansouri" contains "man" (case-insensitive).
      expect(cmp.filteredInvoices().length).toBe(1);
      expect(cmp.filteredInvoices()[0].id).toBe('b');

      // Pure substring (no fuzzy) — "Hela" matches only Hela.
      cmp.searchQuery.set('hela');
      expect(cmp.filteredInvoices().length).toBe(1);
      expect(cmp.filteredInvoices()[0].id).toBe('a');
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

    it('combines status + search predicates (AND semantics)', () => {
      const a = makeInvoice({ id: 'a', invoiceNumber: 'INV-2026-0001', status: 'paid', customerName: 'Hela' });
      const b = makeInvoice({ id: 'b', invoiceNumber: 'INV-2026-0002', status: 'draft', customerName: 'Hela' });
      const c = makeInvoice({ id: 'c', invoiceNumber: 'INV-2026-0003', status: 'paid', customerName: 'Other' });
      configure([a, b, c]);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.selectedStatus.set('paid');
      cmp.searchQuery.set('hela');
      const result = cmp.filteredInvoices();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('a');
    });
  });

  // ── S-INV-029 — pagination ──

  describe('S-INV-029 — client-side pagination', () => {
    function makeMany(n: number): InvoiceWithDetails[] {
      return Array.from({ length: n }, (_, i) =>
        makeInvoice({
          id: `i${i + 1}`,
          invoiceNumber: `INV-2026-${String(i + 1).padStart(4, '0')}`,
          // Stagger issue dates so ordering is stable: i=0 newest.
          issueDate: new Date(2026, 0, 31 - (i % 30)),
        }),
      );
    }

    it('PAGE_SIZE constant is 25', () => {
      expect(InvoiceListPageComponent.PAGE_SIZE).toBe(25);
    });

    it('shows the full first page when dataset > PAGE_SIZE and renders the rest behind Next', () => {
      configure(makeMany(60));
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      expect(cmp.filteredInvoices().length).toBe(60);
      expect(cmp.totalPages()).toBe(3);
      expect(cmp.effectivePage()).toBe(1);
      expect(cmp.pagedInvoices().length).toBe(25);
      expect(cmp.pageStart()).toBe(1);
      expect(cmp.pageEnd()).toBe(25);

      cmp.goToNextPage();
      expect(cmp.effectivePage()).toBe(2);
      expect(cmp.pagedInvoices().length).toBe(25);
      expect(cmp.pageStart()).toBe(26);
      expect(cmp.pageEnd()).toBe(50);

      cmp.goToNextPage();
      expect(cmp.effectivePage()).toBe(3);
      expect(cmp.pagedInvoices().length).toBe(10);
      expect(cmp.pageStart()).toBe(51);
      expect(cmp.pageEnd()).toBe(60);

      // Guarded — does not overshoot.
      cmp.goToNextPage();
      expect(cmp.effectivePage()).toBe(3);

      cmp.goToPreviousPage();
      expect(cmp.effectivePage()).toBe(2);

      cmp.goToPreviousPage();
      cmp.goToPreviousPage();
      expect(cmp.effectivePage()).toBe(1);
      // Guarded at page 1.
      cmp.goToPreviousPage();
      expect(cmp.effectivePage()).toBe(1);
    });

    it('renders all rows on page 1 when dataset <= PAGE_SIZE', () => {
      configure(makeMany(10));
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      expect(cmp.totalPages()).toBe(1);
      expect(cmp.pagedInvoices().length).toBe(10);
      expect(cmp.pageStart()).toBe(1);
      expect(cmp.pageEnd()).toBe(10);
    });

    it('handles an empty dataset without throwing (totalPages=1, pageStart=0, pageEnd=0)', () => {
      configure([]);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      expect(cmp.filteredInvoices().length).toBe(0);
      expect(cmp.totalPages()).toBe(1);
      expect(cmp.pageStart()).toBe(0);
      expect(cmp.pageEnd()).toBe(0);
      expect(cmp.pagedInvoices()).toEqual([]);
    });

    it('resets to page 1 whenever a filter handler is invoked', () => {
      const data = makeMany(60);
      // Make 5 of them DRAFT for the filter test, scattered throughout.
      data[10].status = 'draft' as InvoiceStatus;
      data[20].status = 'draft' as InvoiceStatus;
      data[30].status = 'draft' as InvoiceStatus;
      data[40].status = 'draft' as InvoiceStatus;
      data[50].status = 'draft' as InvoiceStatus;
      configure(data);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.goToNextPage();
      cmp.goToNextPage();
      expect(cmp.effectivePage()).toBe(3);

      // Status filter via the template handler resets to page 1.
      cmp.onStatusChange({ target: { value: 'draft' } } as unknown as Event);
      expect(cmp.effectivePage()).toBe(1);
      // 5 drafts fit on a single page.
      expect(cmp.totalPages()).toBe(1);
      expect(cmp.pagedInvoices().length).toBe(5);

      // Search via the template handler also resets.
      cmp.onStatusChange({ target: { value: 'all' } } as unknown as Event);
      cmp.goToNextPage();
      expect(cmp.effectivePage()).toBe(2);
      cmp.onSearchChange({ target: { value: '0001' } } as unknown as Event);
      expect(cmp.effectivePage()).toBe(1);
    });

    it('clearFilters resets to page 1', () => {
      configure(makeMany(60));
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.goToNextPage();
      cmp.goToNextPage();
      expect(cmp.effectivePage()).toBe(3);

      cmp.clearFilters();
      expect(cmp.effectivePage()).toBe(1);
      expect(cmp.searchQuery()).toBe('');
      expect(cmp.selectedStatus()).toBe('all');
      expect(cmp.selectedPaymentMethod()).toBe('all');
    });

    it('clamps effectivePage when filtering shrinks the result set below the active page', () => {
      const data = makeMany(60);
      data[55].customerName = 'UniqueCustomer';
      configure(data);
      const fixture = TestBed.createComponent(InvoiceListPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();

      cmp.goToNextPage();
      cmp.goToNextPage();
      expect(cmp.effectivePage()).toBe(3);

      // Search via the handler resets to page 1 (and the clamp is
      // defence-in-depth for any future direct-signal mutation).
      cmp.onSearchChange({ target: { value: 'UniqueCustomer' } } as unknown as Event);
      expect(cmp.totalPages()).toBe(1);
      expect(cmp.effectivePage()).toBe(1);
      expect(cmp.pagedInvoices().length).toBe(1);

      // Pure-signal write of a stale page number is still clamped by the
      // computed (no template handler involved).
      cmp.currentPage.set(99);
      expect(cmp.effectivePage()).toBe(1);
    });
  });
});
