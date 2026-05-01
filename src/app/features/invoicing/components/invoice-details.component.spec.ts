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
});
