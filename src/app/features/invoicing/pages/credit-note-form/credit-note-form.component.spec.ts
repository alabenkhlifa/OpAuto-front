import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CreditNoteFormPageComponent } from './credit-note-form.component';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { CreditNoteService } from '../../../../core/services/credit-note.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { InvoiceWithDetails, InvoiceStatus } from '../../../../core/models/invoice.model';

/**
 * Behavior tests for the CreditNoteFormPage focused on S-DET-014 — the
 * post-create routing behaviour. After the user submits a credit note
 * we route back to the source invoice (`/invoices/:id`) so the detail
 * page re-fetches its activity timeline + Linked credit notes panel
 * via ngOnInit. We keep these tests template-agnostic so the suite is
 * resilient to future HTML/CSS changes.
 */
describe('CreditNoteFormPageComponent', () => {
  function makeInvoice(overrides: Partial<InvoiceWithDetails> = {}): InvoiceWithDetails {
    return {
      id: 'inv-123',
      invoiceNumber: 'INV-2026-0001',
      customerId: 'c1',
      carId: 'car1',
      issueDate: new Date('2026-01-01'),
      dueDate: new Date('2026-01-31'),
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
      lineItems: [
        {
          id: 'l1',
          type: 'service',
          description: 'Oil change',
          quantity: 1,
          unit: 'service',
          unitPrice: 100,
          totalPrice: 100,
          taxable: true,
        } as any,
      ],
      paymentTerms: 'Net 30',
      createdBy: 'u1',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      customerName: 'Foo Bar',
      customerPhone: '+216-71',
      customerEmail: 'a@b.tn',
      carMake: 'Toyota',
      carModel: 'Corolla',
      carYear: 2020,
      licensePlate: '111TUN1',
      paymentHistory: [],
      ...overrides,
    } as InvoiceWithDetails;
  }

  function configure(opts?: { invoiceId?: string | null; createOk?: boolean }) {
    const navigateSpy = jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true));
    const invoiceServiceStub = {
      fetchInvoiceById: jasmine
        .createSpy('fetchInvoiceById')
        .and.returnValue(of(makeInvoice({ id: opts?.invoiceId ?? 'inv-123' }))),
      formatCurrency: (n: number) => `${n.toFixed(2)} TND`,
    };
    const creditNoteServiceStub = {
      create: jasmine.createSpy('create').and.callFake(() =>
        opts?.createOk === false
          ? throwError(() => new Error('boom'))
          : of({ id: 'cn-1', creditNoteNumber: 'AVO-001' } as any),
      ),
    };
    const toastStub = {
      success: jasmine.createSpy('success'),
      error: jasmine.createSpy('error'),
      warning: jasmine.createSpy('warning'),
    };
    const routerStub = { navigate: navigateSpy };
    TestBed.configureTestingModule({
      imports: [CreditNoteFormPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: { get: (k: string) => (k === 'invoiceId' ? opts?.invoiceId ?? 'inv-123' : null) },
            },
          },
        },
        { provide: InvoiceService, useValue: invoiceServiceStub },
        { provide: CreditNoteService, useValue: creditNoteServiceStub },
        { provide: ToastService, useValue: toastStub },
        {
          provide: TranslationService,
          useValue: { instant: (k: string) => k, getCurrentLanguage: () => 'en', translations$: of({}) },
        },
        { provide: Router, useValue: routerStub },
      ],
    });
    return { invoiceServiceStub, creditNoteServiceStub, toastStub, navigateSpy };
  }

  describe('S-DET-014 — post-create navigates back to source invoice', () => {
    it('navigates to /invoices/:id after a successful create so the detail re-fetches', async () => {
      const { creditNoteServiceStub, navigateSpy, toastStub } = configure({ invoiceId: 'inv-123' });
      const fixture: ComponentFixture<CreditNoteFormPageComponent> = TestBed.createComponent(
        CreditNoteFormPageComponent,
      );
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      // Pick the only line and set a valid reason — minimum needed to submit.
      cmp.toggle(0, true);
      cmp.form.patchValue({ reason: 'Customer return', restockParts: true });

      cmp.onSubmit();
      await fixture.whenStable();

      expect(creditNoteServiceStub.create).toHaveBeenCalledTimes(1);
      expect(toastStub.success).toHaveBeenCalledWith('invoicing.creditNotes.form.created');
      // The KEY assertion for S-DET-014 — we route back to the source
      // invoice detail (NOT the credit-notes list) so ngOnInit re-runs
      // forkJoin and refreshes paymentHistory + Linked credit notes.
      expect(navigateSpy).toHaveBeenCalledWith(['/invoices', 'inv-123']);
    });

    it('does NOT navigate when the BE rejects the create', async () => {
      const { creditNoteServiceStub, navigateSpy, toastStub } = configure({ createOk: false });
      const fixture = TestBed.createComponent(CreditNoteFormPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      cmp.toggle(0, true);
      cmp.form.patchValue({ reason: 'Customer return', restockParts: true });
      cmp.onSubmit();
      await fixture.whenStable();

      expect(creditNoteServiceStub.create).toHaveBeenCalledTimes(1);
      expect(toastStub.error).toHaveBeenCalledWith('invoicing.creditNotes.form.createFailed');
      // navigateSpy was NOT called for the success case (only the
      // ngOnInit-time navigations might fire if invoiceId is missing —
      // we provided one, so it should be exactly zero calls).
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('cancel button routes to the credit-notes list (not the source invoice)', async () => {
      const { navigateSpy } = configure({ invoiceId: 'inv-123' });
      const fixture = TestBed.createComponent(CreditNoteFormPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.cancel();
      expect(navigateSpy).toHaveBeenCalledWith(['/invoices/credit-notes']);
    });
  });
});
