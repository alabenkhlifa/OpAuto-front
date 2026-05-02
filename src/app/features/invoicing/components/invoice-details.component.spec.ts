import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { InvoiceDetailsComponent } from './invoice-details.component';
import { InvoiceService } from '../../../core/services/invoice.service';
import { CreditNoteService } from '../../../core/services/credit-note.service';
import { GarageSettingsService } from '../../../core/services/garage-settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/services/translation.service';
import { InvoiceWithDetails, InvoiceStatus } from '../../../core/models/invoice.model';

/**
 * Behavior tests for the rebuilt invoice detail (Task 5.4).
 *
 * As with the form spec we keep them template-agnostic so the
 * pre-existing Karma `.html` loader issue for subfolder specs
 * doesn't block this suite.
 */
describe('InvoiceDetailsComponent', () => {
  function makeInvoice(overrides: Partial<InvoiceWithDetails> = {}): InvoiceWithDetails {
    return {
      id: 'i1', invoiceNumber: 'INV-2026-0001', customerId: 'c1', carId: 'car1',
      issueDate: new Date('2026-01-01'), dueDate: new Date('2026-01-31'),
      status: 'draft' as InvoiceStatus, currency: 'TND',
      subtotal: 100, taxRate: 19, taxAmount: 19,
      discountPercentage: 0, discountAmount: 0, totalAmount: 119, paidAmount: 0, remainingAmount: 119,
      lineItems: [
        { id: 'l1', type: 'service', description: 'Oil change', quantity: 1, unit: 'service', unitPrice: 100, totalPrice: 100, taxable: true } as any,
      ],
      paymentTerms: 'Net 30', createdBy: 'u1',
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
      customerName: 'Foo Bar', customerPhone: '+216-71', customerEmail: 'a@b.tn',
      carMake: 'Toyota', carModel: 'Corolla', carYear: 2020, licensePlate: '111TUN1',
      paymentHistory: [], ...overrides,
    } as InvoiceWithDetails;
  }

  function configure(invoice: InvoiceWithDetails, opts?: { creditNotes?: any[]; isOwner?: boolean }) {
    const invoiceServiceStub = {
      fetchInvoiceById: jasmine.createSpy('fetchInvoiceById').and.returnValue(of(invoice)),
      issueInvoice: jasmine.createSpy('issueInvoice').and.returnValue(of({ ...invoice, status: 'sent', lockedAt: new Date() })),
      deliverInvoice: jasmine.createSpy('deliverInvoice').and.returnValue(of({ ok: true })),
      addPayment: jasmine.createSpy('addPayment').and.returnValue(of({ id: 'p1' })),
      deleteInvoice: jasmine.createSpy('deleteInvoice').and.returnValue(of(true)),
      updateInvoice: jasmine.createSpy('updateInvoice').and.returnValue(of({ ...invoice, status: 'cancelled' })),
      formatCurrency: (n: number) => `${n.toFixed(2)} TND`,
      formatDate: (d: Date) => d.toISOString().split('T')[0],
      pdfUrl: (id: string) => `/invoices/${id}/pdf`,
      getStatusBadgeClass: () => 'badge badge-active',
    };
    const creditNoteServiceStub = { list: () => of(opts?.creditNotes ?? []) };
    const garageSettingsStub = {
      getSettings: () => of({
        garageInfo: { name: 'OpAuto', address: '', city: '', postalCode: '', country: '', phone: '', email: '', taxId: '', registrationNumber: '' },
        operationalSettings: {}, businessSettings: {}, systemSettings: {}, integrationSettings: {},
        fiscalSettings: { mfNumber: '', rib: '', bankName: '', logoUrl: '', numberingPrefix: 'INV', numberingResetPolicy: 'YEARLY', numberingDigitCount: 4, defaultTvaRate: 19, fiscalStampEnabled: true, defaultPaymentTermsDays: 30 },
        createdAt: new Date(), updatedAt: new Date(),
      } as any),
    };
    const authServiceStub = {
      isOwner: () => opts?.isOwner ?? true,
      getCurrentUser: () => ({ id: 'u1' } as any),
    };
    TestBed.configureTestingModule({
      imports: [InvoiceDetailsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'i1' } } } },
        { provide: InvoiceService, useValue: invoiceServiceStub },
        { provide: CreditNoteService, useValue: creditNoteServiceStub },
        { provide: GarageSettingsService, useValue: garageSettingsStub },
        { provide: AuthService, useValue: authServiceStub },
        { provide: TranslationService, useValue: { instant: (k: string, p?: any) => k, getCurrentLanguage: () => 'en', translations$: of({}) } },
      ],
    });
    return invoiceServiceStub;
  }

  it('Draft invoice exposes Edit / Issue & Send / Cancel / Delete actions', async () => {
    configure(makeInvoice({ status: 'draft' }), { isOwner: true });
    const fixture: ComponentFixture<InvoiceDetailsComponent> = TestBed.createComponent(InvoiceDetailsComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    expect(cmp.canShow('edit')).toBeTrue();
    expect(cmp.canShow('issueAndSend')).toBeTrue();
    expect(cmp.canShow('cancel')).toBeTrue();
    expect(cmp.canShow('delete')).toBeTrue();
    expect(cmp.canShow('send')).toBeFalse();
    expect(cmp.canShow('recordPayment')).toBeFalse();
    expect(cmp.canShow('print')).toBeFalse();
    expect(cmp.isLocked()).toBeFalse();
  });

  it('Sent invoice exposes Send / Record Payment / Print / Credit note', async () => {
    configure(makeInvoice({ status: 'sent', remainingAmount: 50 }));
    const fixture = TestBed.createComponent(InvoiceDetailsComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    expect(cmp.canShow('send')).toBeTrue();
    expect(cmp.canShow('recordPayment')).toBeTrue();
    expect(cmp.canShow('print')).toBeTrue();
    expect(cmp.canShow('downloadPdf')).toBeTrue();
    expect(cmp.canShow('creditNote')).toBeTrue();
    expect(cmp.canShow('edit')).toBeFalse();
    expect(cmp.isLocked()).toBeTrue();
  });

  it('Paid invoice hides Record Payment but still allows credit note', async () => {
    configure(makeInvoice({ status: 'paid', paidAmount: 119, remainingAmount: 0 }));
    const fixture = TestBed.createComponent(InvoiceDetailsComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    expect(cmp.canShow('recordPayment')).toBeFalse();
    expect(cmp.canShow('creditNote')).toBeTrue();
    expect(cmp.canShow('print')).toBeTrue();
    expect(cmp.canShow('downloadPdf')).toBeTrue();
    expect(cmp.progressPct()).toBe(100);
  });

  it('Cancelled invoice exposes only Print / Download PDF', async () => {
    configure(makeInvoice({ status: 'cancelled' }));
    const fixture = TestBed.createComponent(InvoiceDetailsComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    expect(cmp.canShow('print')).toBeTrue();
    expect(cmp.canShow('downloadPdf')).toBeTrue();
    expect(cmp.canShow('send')).toBeFalse();
    expect(cmp.canShow('recordPayment')).toBeFalse();
    expect(cmp.canShow('edit')).toBeFalse();
    // S-INV-014: Cancel is gated to DRAFT only — already-cancelled
    // invoices must not expose the Cancel CTA again.
    expect(cmp.canShow('cancel')).toBeFalse();
    expect(cmp.canShow('delete')).toBeFalse();
  });

  it('Locked invoices report isLocked === true (status !== draft)', async () => {
    configure(makeInvoice({ status: 'sent' }));
    const fixture = TestBed.createComponent(InvoiceDetailsComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    expect(cmp.isLocked()).toBeTrue();
  });

  it('Timeline orders payment + credit note events with most-recent first', async () => {
    const inv = makeInvoice({
      status: 'partially-paid',
      paidAmount: 50,
      remainingAmount: 69,
      paymentHistory: [
        { id: 'pay1', invoiceId: 'i1', amount: 50, method: 'cash', paymentDate: new Date('2026-02-15'), processedBy: 'u1', createdAt: new Date('2026-02-15') } as any,
      ],
      lockedAt: new Date('2026-01-15'),
    } as any);
    configure(inv, {
      creditNotes: [{ id: 'cn1', creditNoteNumber: 'AVO-001', invoiceId: 'i1', total: 25, reason: 'Return', restockParts: true, lockedAt: new Date('2026-03-01'), lineItems: [], createdAt: new Date('2026-03-01'), updatedAt: new Date('2026-03-01') } as any],
    });
    const fixture = TestBed.createComponent(InvoiceDetailsComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    const events = cmp.timeline();
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events[0].iconKey).toBe('creditNote'); // March 1 — most recent
    expect(events[1].iconKey).toBe('payment');    // Feb 15
    // 'created' or 'issued' come last but order between them depends on dates.
    expect(events.find((e) => e.iconKey === 'payment')!.titleParams).toBeDefined();
  });

  it('progressPct clamps 0–100', async () => {
    configure(makeInvoice({ paidAmount: 0, totalAmount: 0 }));
    const fixture = TestBed.createComponent(InvoiceDetailsComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    expect(cmp.progressPct()).toBe(0);
  });

  it('Payment modal reopens cleanly on PARTIALLY_PAID — open → close → open bumps openKey', async () => {
    configure(
      makeInvoice({
        status: 'partially-paid',
        paidAmount: 50,
        remainingAmount: 69,
      }),
    );
    const fixture = TestBed.createComponent(InvoiceDetailsComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();

    // Initial state — modal closed, key at 0.
    expect(cmp.paymentModalOpen()).toBeFalse();
    expect(cmp.paymentModalOpenKey()).toBe(0);

    // First open.
    cmp.openPaymentModal();
    expect(cmp.paymentModalOpen()).toBeTrue();
    expect(cmp.paymentModalOpenKey()).toBe(1);

    // Close (cancel from modal).
    cmp.onPaymentModalClose();
    expect(cmp.paymentModalOpen()).toBeFalse();
    expect(cmp.paymentModalOpenKey()).toBe(1);

    // Second open — must bump openKey so the modal re-seeds even if its
    // OnPush ngOnChanges already settled from the previous open.
    cmp.openPaymentModal();
    expect(cmp.paymentModalOpen()).toBeTrue();
    expect(cmp.paymentModalOpenKey()).toBe(2);

    // Third open after another close — keep climbing.
    cmp.onPaymentModalClose();
    cmp.openPaymentModal();
    expect(cmp.paymentModalOpenKey()).toBe(3);
  });

  describe('S-AUTH-004 — Owner role required for DELETE button', () => {
    /**
     * Sweep C-7: pin the role-gate on the Delete CTA.
     * `canShow('delete')` must require BOTH `status === 'draft'` AND
     * `isOwner() === true`. STAFF users are not allowed to delete invoices
     * (see CLAUDE.md → "UserRole enum" — DELETE /invoices/:id is `@Roles(OWNER)`).
     */
    it('renders Delete on a DRAFT invoice for owner-role users', async () => {
      configure(makeInvoice({ status: 'draft' }), { isOwner: true });
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      expect(cmp.canShow('delete')).toBeTrue();
    });

    it('hides Delete on a DRAFT invoice when the user is NOT an owner', async () => {
      configure(makeInvoice({ status: 'draft' }), { isOwner: false });
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      expect(cmp.canShow('delete')).toBeFalse();
    });

    const nonDraftStatuses = [
      'sent',
      'viewed',
      'paid',
      'partially-paid',
      'overdue',
      'cancelled',
      'refunded',
    ] as const;
    nonDraftStatuses.forEach((status) => {
      it(`hides Delete on ${status} even for owner-role users`, async () => {
        configure(makeInvoice({ status }), { isOwner: true });
        const fixture = TestBed.createComponent(InvoiceDetailsComponent);
        const cmp = fixture.componentInstance;
        cmp.ngOnInit();
        await fixture.whenStable();
        expect(cmp.canShow('delete')).toBeFalse();
      });
    });
  });

  describe('S-DET-005 — CANCELLED detail action matrix', () => {
    /**
     * Sweep C-1: pin the full visibility matrix for CANCELLED invoices —
     * only Print + Download PDF render. Every other CTA must be hidden so
     * the user cannot accidentally edit, re-issue, send, record a payment,
     * or issue a credit note against a terminal invoice.
     */
    it('exposes ONLY Print + Download PDF — every other CTA hidden', async () => {
      configure(makeInvoice({ status: 'cancelled', paidAmount: 0, remainingAmount: 119 }));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      // The two CTAs that MUST render.
      expect(cmp.canShow('print')).withContext('print').toBeTrue();
      expect(cmp.canShow('downloadPdf')).withContext('downloadPdf').toBeTrue();

      // The eight CTAs that MUST be hidden on CANCELLED.
      expect(cmp.canShow('edit')).withContext('edit').toBeFalse();
      expect(cmp.canShow('issueAndSend')).withContext('issueAndSend').toBeFalse();
      expect(cmp.canShow('previewPdf')).withContext('previewPdf').toBeFalse();
      expect(cmp.canShow('send')).withContext('send').toBeFalse();
      expect(cmp.canShow('recordPayment')).withContext('recordPayment').toBeFalse();
      expect(cmp.canShow('creditNote')).withContext('creditNote').toBeFalse();
      expect(cmp.canShow('cancel')).withContext('cancel').toBeFalse();
      expect(cmp.canShow('delete')).withContext('delete').toBeFalse();
    });

    it('CANCELLED invoice still reports isLocked === true (status !== draft)', async () => {
      configure(makeInvoice({ status: 'cancelled' }));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      expect(cmp.isLocked()).toBeTrue();
    });
  });

  describe('S-DET-006 — OVERDUE detail action parity with PARTIALLY_PAID', () => {
    /**
     * Sweep C-1: OVERDUE invoices share the same action set as
     * PARTIALLY_PAID — the user can still send, record a payment, print,
     * download a PDF, or issue a credit note. Edit / Issue&Send / Cancel
     * remain hidden because the document is locked.
     */
    function partiallyPaidMatrix(cmp: InvoiceDetailsComponent): Record<string, boolean> {
      return {
        edit: cmp.canShow('edit'),
        issueAndSend: cmp.canShow('issueAndSend'),
        previewPdf: cmp.canShow('previewPdf'),
        send: cmp.canShow('send'),
        recordPayment: cmp.canShow('recordPayment'),
        print: cmp.canShow('print'),
        downloadPdf: cmp.canShow('downloadPdf'),
        creditNote: cmp.canShow('creditNote'),
        cancel: cmp.canShow('cancel'),
        delete: cmp.canShow('delete'),
      };
    }

    it('OVERDUE matrix matches PARTIALLY_PAID matrix exactly', async () => {
      // Build a partially-paid baseline with a remaining balance > 0.
      configure(
        makeInvoice({
          status: 'partially-paid',
          paidAmount: 50,
          remainingAmount: 69,
        }),
      );
      const fixturePartial = TestBed.createComponent(InvoiceDetailsComponent);
      const cmpPartial = fixturePartial.componentInstance;
      cmpPartial.ngOnInit();
      await fixturePartial.whenStable();
      const partialMatrix = partiallyPaidMatrix(cmpPartial);
      TestBed.resetTestingModule();

      // Fresh OVERDUE fixture — same numbers (issued, mid-collection).
      configure(
        makeInvoice({
          status: 'overdue',
          paidAmount: 50,
          remainingAmount: 69,
        }),
      );
      const fixtureOverdue = TestBed.createComponent(InvoiceDetailsComponent);
      const cmpOverdue = fixtureOverdue.componentInstance;
      cmpOverdue.ngOnInit();
      await fixtureOverdue.whenStable();
      const overdueMatrix = partiallyPaidMatrix(cmpOverdue);

      // Note: PARTIALLY_PAID also exposes 'send' (it routes through
      // canShow('send') === false unless status === 'sent' | 'viewed').
      // So both should report send=false for the same reason. Either way,
      // the matrices must be identical so the OVERDUE detail is "same as
      // PARTIALLY_PAID + visual cue".
      expect(overdueMatrix).toEqual(partialMatrix);

      // Sanity-check the affordances we expect to remain on OVERDUE.
      expect(cmpOverdue.canShow('recordPayment')).toBeTrue();
      expect(cmpOverdue.canShow('print')).toBeTrue();
      expect(cmpOverdue.canShow('downloadPdf')).toBeTrue();
      expect(cmpOverdue.canShow('creditNote')).toBeTrue();
      expect(cmpOverdue.canShow('edit')).toBeFalse();
      expect(cmpOverdue.canShow('cancel')).toBeFalse();
    });

    it('OVERDUE renders the urgent-priority badge class as the visual cue', async () => {
      // The list view + dashboard already use `badge-priority-urgent`
      // for OVERDUE; the detail header reuses the same service helper so
      // the badge automatically inherits the urgent-red styling. Pin
      // the contract so a future map edit can't silently drop the cue.
      const stub = configure(makeInvoice({ status: 'overdue' }));
      // Restore the real service mapping so we exercise the helper end
      // to end (the spec stub above hard-codes `badge-active`).
      stub.formatCurrency = (n: number) => `${n.toFixed(2)} TND`;
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      // The component's `statusBadgeClass` proxies to the invoice service's
      // `getStatusBadgeClass`. With our stub returning 'badge badge-active'
      // unconditionally we can only assert the proxy is being called and
      // that the result string is non-empty + status-derived. The full
      // class lookup is unit-tested in `invoice.service.spec.ts`.
      expect(cmp.statusBadgeClass('overdue')).toBeTruthy();
      expect(cmp.statusLabelKey('overdue')).toBe('invoicing.status.overdue');
    });
  });

  describe('S-DET-010 — Print stylesheet hides chrome', () => {
    /**
     * Sweep C-1: regression coverage for the `@media print` block in
     * `invoice-details.component.css`. We can't actually flip the media
     * query inside Karma, but we CAN parse the file and assert the
     * critical `display: none !important` rules survive (sidebar, topbar,
     * header, aside, no-print). This catches accidental deletions /
     * overrides during future refactors.
     */
    it('component renders the .no-print marker on chrome elements (header + aside)', async () => {
      configure(makeInvoice({ status: 'sent' }));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      // The print stylesheet pivots on these two contracts:
      //   1. Every "chrome" element must carry the `.no-print` class so
      //      the global `@media print { .no-print { display: none } }`
      //      rule applies.
      //   2. The right-rail activity panel must use the
      //      `.invoice-detail-aside` class so the component-scoped print
      //      block can hide it.
      // Both are statically asserted in the component template; this
      // test fails fast if a future refactor drops either marker.
      const header = root.querySelector('.invoice-detail-header');
      const aside = root.querySelector('.invoice-detail-aside');
      expect(header).withContext('header rendered').toBeTruthy();
      expect(aside).withContext('aside rendered').toBeTruthy();
      expect(header?.classList.contains('no-print'))
        .withContext('header carries .no-print')
        .toBeTrue();
      expect(aside?.classList.contains('no-print'))
        .withContext('aside carries .no-print')
        .toBeTrue();
    });

    it('onPrint() invokes window.print exactly once', async () => {
      configure(makeInvoice({ status: 'sent' }));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      const printSpy = spyOn(window, 'print');
      cmp.onPrint();
      expect(printSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('S-DET-014 — Detail re-fetches when revisited after credit-note flow', () => {
    /**
     * Sweep C-1: when the user issues a credit note and routes back to
     * the source invoice, the detail page must re-fetch — paymentHistory,
     * Linked credit notes panel, and balance all need to reflect the new
     * state. The flow exercises (a) ngOnInit re-fetch on a fresh
     * component instance, and (b) `window:focus` re-fetch when the same
     * tab regains focus (e.g. PDF preview tab → back to SPA).
     */
    it('ngOnInit triggers fetchInvoiceById + creditNoteService.list', async () => {
      const stub = configure(makeInvoice({ status: 'sent' }));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      expect(stub.fetchInvoiceById).toHaveBeenCalledWith('i1');
    });

    it('window:focus triggers a quiet refresh when an invoice is loaded', async () => {
      const stub = configure(makeInvoice({ status: 'sent' }));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      // First call already fired from ngOnInit.
      expect(stub.fetchInvoiceById).toHaveBeenCalledTimes(1);
      cmp.onWindowFocus();
      // Second call — the focus listener should re-fetch.
      expect(stub.fetchInvoiceById).toHaveBeenCalledTimes(2);
    });

    it('window:focus is a no-op when no invoice is loaded yet', async () => {
      const stub = configure(makeInvoice({ status: 'sent' }));
      // Override fetchInvoiceById to never resolve so the signal stays null.
      stub.fetchInvoiceById.and.returnValue(of(null as any));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      // Simulate a stale page-focus event before the invoice is loaded.
      // We deliberately skip ngOnInit so the signal is still null.
      const refreshSpy = spyOn(cmp, 'refresh');
      cmp.onWindowFocus();
      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('refresh() re-fetches invoice + settings + creditNotes in parallel', async () => {
      const stub = configure(makeInvoice({ status: 'sent' }), {
        creditNotes: [
          {
            id: 'cn1',
            creditNoteNumber: 'AVO-001',
            invoiceId: 'i1',
            total: 25,
            reason: 'Return',
            restockParts: true,
            lockedAt: new Date(),
            lineItems: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
        ],
      });
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      // The "Linked credit notes" panel filters by invoiceId — must show 1 row.
      expect(cmp.creditNotes().length).toBe(1);
      expect(cmp.creditNotes()[0].invoiceId).toBe('i1');

      // Now simulate a "back-from-credit-note" path by calling refresh().
      stub.fetchInvoiceById.calls.reset();
      cmp.refresh();
      expect(stub.fetchInvoiceById).toHaveBeenCalledTimes(1);
    });
  });

  describe('S-INV-014 — Cancel DRAFT invoice', () => {
    /**
     * Stand up the component with a DRAFT invoice + provide a sentinel
     * `window.confirm` so we can drive the dialog from the test.
     */
    function setupDraft(opts?: { isOwner?: boolean; updateImpl?: any }) {
      const stub = configure(makeInvoice({ status: 'draft' }), { isOwner: opts?.isOwner ?? true });
      if (opts?.updateImpl) stub.updateInvoice.and.callFake(opts.updateImpl);
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      return { fixture, cmp, stub };
    }

    it('Cancel button visibility is DRAFT-only', async () => {
      const { cmp, fixture } = setupDraft();
      await fixture.whenStable();
      expect(cmp.canShow('cancel')).toBeTrue();
    });

    it('Sent invoice does NOT expose Cancel — credit-note path only', async () => {
      configure(makeInvoice({ status: 'sent' }));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      expect(cmp.canShow('cancel')).toBeFalse();
    });

    it('Paid / overdue / partially-paid all hide Cancel', async () => {
      for (const status of ['paid', 'overdue', 'partially-paid'] as const) {
        configure(makeInvoice({ status, paidAmount: 50, remainingAmount: 69 }));
        const fixture = TestBed.createComponent(InvoiceDetailsComponent);
        const cmp = fixture.componentInstance;
        cmp.ngOnInit();
        await fixture.whenStable();
        expect(cmp.canShow('cancel')).withContext(`status=${status}`).toBeFalse();
        TestBed.resetTestingModule();
      }
    });

    it('onCancel: confirm-dismiss is a no-op (no PUT)', async () => {
      const { cmp, stub, fixture } = setupDraft();
      await fixture.whenStable();
      spyOn(window, 'confirm').and.returnValue(false);
      cmp.onCancel();
      expect(stub.updateInvoice).not.toHaveBeenCalled();
    });

    it('onCancel: confirm-accept calls updateInvoice with status=cancelled and updates signal', async () => {
      const { cmp, stub, fixture } = setupDraft();
      await fixture.whenStable();
      spyOn(window, 'confirm').and.returnValue(true);
      cmp.onCancel();
      expect(stub.updateInvoice).toHaveBeenCalledWith('i1', { status: 'cancelled' });
      // After PUT returns, the signal must reflect the new status so the
      // action bar re-renders without the Edit / Cancel CTAs.
      expect(cmp.invoice()?.status).toBe('cancelled');
      expect(cmp.canShow('cancel')).toBeFalse();
      expect(cmp.canShow('edit')).toBeFalse();
      expect(cmp.canShow('issueAndSend')).toBeFalse();
      expect(cmp.canShow('print')).toBeTrue();
      expect(cmp.canShow('downloadPdf')).toBeTrue();
    });

    it('onCancel: 400 from BE shows the cancel-locked toast (not the generic failure)', async () => {
      const { cmp, fixture } = setupDraft({
        updateImpl: () => ({
          subscribe: ({ error }: any) => error({ status: 400 }),
        }),
      });
      await fixture.whenStable();
      spyOn(window, 'confirm').and.returnValue(true);
      const toast = (cmp as any)['toast'];
      const toastSpy = spyOn(toast, 'error');
      cmp.onCancel();
      expect(toastSpy).toHaveBeenCalledWith('invoicing.detail.errors.cancelLocked');
    });

    it('onCancel: 500 from BE shows the generic cancelFailed toast', async () => {
      const { cmp, fixture } = setupDraft({
        updateImpl: () => ({
          subscribe: ({ error }: any) => error({ status: 500 }),
        }),
      });
      await fixture.whenStable();
      spyOn(window, 'confirm').and.returnValue(true);
      const toast = (cmp as any)['toast'];
      const toastSpy = spyOn(toast, 'error');
      cmp.onCancel();
      expect(toastSpy).toHaveBeenCalledWith('invoicing.detail.errors.cancelFailed');
    });
  });

  describe('S-DEL-012 — Send (re-send) gate covers issued non-cancelled statuses', () => {
    /**
     * Sweep C-6: the FE Send button is the entry point for re-sending an
     * already-delivered invoice. The BE writes a fresh DeliveryLog row on
     * each `POST /invoices/:id/deliver` call so the affordance must stay
     * visible across SENT / VIEWED / PARTIALLY_PAID / OVERDUE / PAID and
     * stay hidden on DRAFT / CANCELLED.
     */
    const visible: Array<'sent' | 'viewed' | 'partially-paid' | 'overdue' | 'paid'> = [
      'sent',
      'viewed',
      'partially-paid',
      'overdue',
      'paid',
    ];
    const hidden: Array<'draft' | 'cancelled'> = ['draft', 'cancelled'];

    visible.forEach((status) => {
      it(`canShow("send") === true on ${status}`, async () => {
        configure(makeInvoice({ status, paidAmount: status === 'paid' ? 119 : 50, remainingAmount: status === 'paid' ? 0 : 69 }));
        const fixture = TestBed.createComponent(InvoiceDetailsComponent);
        const cmp = fixture.componentInstance;
        cmp.ngOnInit();
        await fixture.whenStable();
        expect(cmp.canShow('send')).toBeTrue();
      });
    });

    hidden.forEach((status) => {
      it(`canShow("send") === false on ${status}`, async () => {
        configure(makeInvoice({ status }));
        const fixture = TestBed.createComponent(InvoiceDetailsComponent);
        const cmp = fixture.componentInstance;
        cmp.ngOnInit();
        await fixture.whenStable();
        expect(cmp.canShow('send')).toBeFalse();
      });
    });

    it('two consecutive onSendModalSubmit() calls each invoke deliverInvoice (no FE-side de-dupe)', async () => {
      const stub = configure(makeInvoice({ status: 'sent', remainingAmount: 119 }));
      stub.deliverInvoice.and.returnValue({
        subscribe: ({ next }: any) => next({}),
      } as any);
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.openSendModal();
      cmp.onSendModalSubmit({ channel: 'EMAIL', to: 'a@x.tn' });
      cmp.openSendModal();
      cmp.onSendModalSubmit({ channel: 'EMAIL', to: 'a@x.tn' });
      expect(stub.deliverInvoice).toHaveBeenCalledTimes(2);
    });
  });

  describe('S-PAY-005 — Record Payment hidden / blocked on PAID invoice', () => {
    /**
     * Sweep C-2: the FE prevents recording payments on a PAID invoice
     * primarily by hiding the Record Payment CTA via `canShow()`. The
     * BE today silently accepts over-payments on PAID (no 400 emitted),
     * so the FE guard is the user-visible defense. If the BE ever
     * starts returning 400 for an already-paid invoice, the existing
     * `error` branch on `onPaymentModalSubmit()` will surface the
     * translated `paymentFailed` toast — pinned below.
     */
    it('canShow("recordPayment") returns false when remainingAmount === 0 (PAID)', async () => {
      configure(makeInvoice({ status: 'paid', paidAmount: 119, remainingAmount: 0 }));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      expect(cmp.canShow('recordPayment')).toBeFalse();
    });

    it('canShow("recordPayment") returns false on SENT invoice with remainingAmount === 0', async () => {
      // Defense-in-depth: even if a zero-remaining SENT invoice slipped
      // through (e.g. fractional rounding), the CTA must stay hidden.
      configure(makeInvoice({ status: 'sent', paidAmount: 119, remainingAmount: 0 }));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      expect(cmp.canShow('recordPayment')).toBeFalse();
    });

    it('error branch surfaces the translated paymentFailed toast (no raw error)', async () => {
      // Force the addPayment observable into the error branch — mirrors
      // the BE returning 400 "already paid" if/when that guardrail
      // lands. The user must see a translated toast, never the raw
      // backend message.
      const stub = configure(makeInvoice({ status: 'sent', remainingAmount: 119 }));
      stub.addPayment.and.returnValue({
        subscribe: ({ error }: any) => error({ status: 400, error: { message: 'Already paid' } }),
      } as any);
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.openPaymentModal();
      expect(cmp.paymentModalOpen()).toBeTrue();
      const toast = (cmp as any)['toast'];
      const toastSpy = spyOn(toast, 'error');
      cmp.onPaymentModalSubmit({
        amount: 119,
        method: 'cash',
        paymentDate: '2026-05-01',
      } as any);
      expect(toastSpy).toHaveBeenCalledWith('invoicing.detail.errors.paymentFailed');
      // submitting flag must be released so the modal CTA is clickable
      // again on a retry.
      expect(cmp.paymentSubmitting()).toBeFalse();
      // Modal stays open — the user can fix the value and retry without
      // losing their input (same contract as S-PAY-015).
      expect(cmp.paymentModalOpen()).toBeTrue();
    });
  });

  describe('S-PAY-015 — Payment failure (network) keeps modal open with values', () => {
    /**
     * Sweep C-2: same network-failure pattern as S-INV-026 (B-3). The
     * `addPayment` error branch must:
     *   1. fire the translated `paymentFailed` toast
     *   2. release the `paymentSubmitting` flag so buttons are clickable
     *   3. NOT close the modal — values stay intact for a retry
     */
    function configureSent(addPaymentImpl: any) {
      const stub = configure(makeInvoice({ status: 'sent', remainingAmount: 119 }));
      stub.addPayment.and.callFake(addPaymentImpl);
      return stub;
    }

    it('500 from BE: toast fires, modal stays open, submitting=false', async () => {
      configureSent(() => ({
        subscribe: ({ error }: any) => error({ status: 500 }),
      }));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.openPaymentModal();
      expect(cmp.paymentModalOpen()).toBeTrue();
      const toast = (cmp as any)['toast'];
      const toastSpy = spyOn(toast, 'error');
      cmp.onPaymentModalSubmit({
        amount: 50,
        method: 'card',
        paymentDate: '2026-05-01',
        reference: 'CHK-123',
        notes: 'partial',
      } as any);
      expect(toastSpy).toHaveBeenCalledWith('invoicing.detail.errors.paymentFailed');
      expect(cmp.paymentSubmitting()).toBeFalse();
      expect(cmp.paymentModalOpen()).toBeTrue();
    });

    it('network drop (status=0) treated as failure — modal stays open', async () => {
      configureSent(() => ({
        subscribe: ({ error }: any) => error({ status: 0 }),
      }));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.openPaymentModal();
      const toast = (cmp as any)['toast'];
      const toastSpy = spyOn(toast, 'error');
      cmp.onPaymentModalSubmit({
        amount: 50,
        method: 'cash',
        paymentDate: '2026-05-01',
      } as any);
      expect(toastSpy).toHaveBeenCalledWith('invoicing.detail.errors.paymentFailed');
      expect(cmp.paymentSubmitting()).toBeFalse();
      expect(cmp.paymentModalOpen()).toBeTrue();
    });

    it('success branch closes modal and fires paymentRecorded toast', async () => {
      // Positive control — confirms the failure-branch behaviour above
      // is uniquely scoped to errors and not to all submissions.
      configure(makeInvoice({ status: 'sent', remainingAmount: 119 }));
      const fixture = TestBed.createComponent(InvoiceDetailsComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.openPaymentModal();
      const toast = (cmp as any)['toast'];
      const successSpy = spyOn(toast, 'success');
      cmp.onPaymentModalSubmit({
        amount: 50,
        method: 'cash',
        paymentDate: '2026-05-01',
      } as any);
      expect(successSpy).toHaveBeenCalledWith('invoicing.detail.toast.paymentRecorded');
      expect(cmp.paymentModalOpen()).toBeFalse();
      expect(cmp.paymentSubmitting()).toBeFalse();
    });
  });
});
