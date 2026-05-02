import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
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

  function configure(opts?: {
    invoiceId?: string | null;
    createOk?: boolean;
    /** When set, `creditNoteService.create()` throws an HttpErrorResponse
     *  with this status (used by S-EDGE-016 — 423 lock specs). */
    createErrorStatus?: number;
  }) {
    const navigateSpy = jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true));
    const invoiceServiceStub = {
      fetchInvoiceById: jasmine
        .createSpy('fetchInvoiceById')
        .and.returnValue(of(makeInvoice({ id: opts?.invoiceId ?? 'inv-123' }))),
      formatCurrency: (n: number) => `${n.toFixed(2)} TND`,
    };
    const creditNoteServiceStub = {
      create: jasmine.createSpy('create').and.callFake(() => {
        if (typeof opts?.createErrorStatus === 'number') {
          return throwError(
            () => new HttpErrorResponse({ status: opts.createErrorStatus! }),
          );
        }
        return opts?.createOk === false
          ? throwError(() => new HttpErrorResponse({ status: 0 }))
          : of({ id: 'cn-1', creditNoteNumber: 'AVO-001' } as any);
      }),
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

  /**
   * S-CN-016 — Reason field is required (Validators.required + minLength 3).
   *
   * The form must be invalid until the user types a meaningful reason; the
   * Issue button stays disabled, and clicking submit is a no-op (no
   * `creditNoteService.create()` call). We pin the validator config + the
   * submit short-circuit + the disabled-button binding directly off the
   * reactive form — template-agnostic so the suite survives DOM tweaks.
   */
  describe('S-CN-016 — reason field required', () => {
    it('marks the reason FormControl as invalid when empty', async () => {
      configure({ invoiceId: 'inv-123' });
      const fixture = TestBed.createComponent(CreditNoteFormPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      const reasonCtl = cmp.form.get('reason')!;
      expect(reasonCtl.value).toBe('');
      expect(reasonCtl.valid).toBeFalse();
      expect(reasonCtl.errors?.['required']).toBeTrue();
      // Whole form is invalid → submit button [disabled] in the template.
      expect(cmp.form.invalid).toBeTrue();
    });

    it('flags reasons shorter than the minLength as invalid', async () => {
      configure({ invoiceId: 'inv-123' });
      const fixture = TestBed.createComponent(CreditNoteFormPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      cmp.form.patchValue({ reason: 'ab' });
      const reasonCtl = cmp.form.get('reason')!;
      expect(reasonCtl.valid).toBeFalse();
      expect(reasonCtl.errors?.['minlength']).toBeTruthy();
    });

    it('clears the reason error once the user types a valid value', async () => {
      configure({ invoiceId: 'inv-123' });
      const fixture = TestBed.createComponent(CreditNoteFormPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      cmp.form.patchValue({ reason: 'Customer return — wrong item' });
      const reasonCtl = cmp.form.get('reason')!;
      expect(reasonCtl.valid).toBeTrue();
      expect(reasonCtl.errors).toBeNull();
    });

    it('onSubmit short-circuits when the form is invalid (no BE call)', async () => {
      const { creditNoteServiceStub } = configure({ invoiceId: 'inv-123' });
      const fixture = TestBed.createComponent(CreditNoteFormPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      // Pick a line but leave reason blank — submit must NOT call create.
      cmp.toggle(0, true);
      cmp.onSubmit();
      await fixture.whenStable();

      expect(creditNoteServiceStub.create).not.toHaveBeenCalled();
      // The form is now markAllAsTouched — the reason control surfaces as touched.
      expect(cmp.form.get('reason')!.touched).toBeTrue();
    });

    it('renders the disabled state on the submit button when the form is invalid', async () => {
      configure({ invoiceId: 'inv-123' });
      const fixture = TestBed.createComponent(CreditNoteFormPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const submitBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        'button[type="submit"]',
      );
      expect(submitBtn).withContext('submit button rendered').not.toBeNull();
      expect(submitBtn!.disabled).withContext('submit disabled while form invalid').toBeTrue();
    });
  });

  /**
   * S-MOB-006 — credit-note line picker stays usable on a 375 px viewport.
   *
   * The CSS @media (max-width: 767px) block re-flows the 4-column grid
   * (`auto 1fr 100px 100px`) to a 2-column layout where the qty input
   * + total stack under the description. Verifying the markup contract
   * here pins the contract: every line row must surface checkbox / main
   * / qty / total nodes so the mobile CSS can reach them.
   */
  describe('S-MOB-006 — mobile stacked line markup contract', () => {
    it('renders the four sub-elements per credit-note line so mobile CSS can reflow', async () => {
      configure({ invoiceId: 'inv-123' });
      const fixture = TestBed.createComponent(CreditNoteFormPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const lines = (fixture.nativeElement as HTMLElement).querySelectorAll(
        'ul.credit-note-lines li.credit-note-line',
      );
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach((li) => {
        expect(li.querySelector('.credit-note-line__select')).withContext('checkbox cell').not.toBeNull();
        expect(li.querySelector('.credit-note-line__main')).withContext('main cell').not.toBeNull();
        expect(li.querySelector('.credit-note-line__qty')).withContext('qty input').not.toBeNull();
        expect(li.querySelector('.credit-note-line__total')).withContext('total cell').not.toBeNull();
      });
    });
  });

  /**
   * Sweep C-13 — Section 18 closure for the credit-note form.
   *
   *   S-EDGE-003 — network failure: form data preserved, isSubmitting
   *                flips back, toast surfaces translated key, NO navigate.
   *   S-EDGE-004 — empty selection: onSubmit short-circuits before BE.
   *   S-EDGE-016 — 423 from BE → translated `lockedFailed` key (not the
   *                generic createFailed).
   */
  describe('S-EDGE-003 / S-EDGE-004 / S-EDGE-016 — credit-note-form resilience', () => {
    it('S-EDGE-003 — preserves reason / line selection on network failure', async () => {
      const { creditNoteServiceStub, navigateSpy, toastStub } = configure({
        invoiceId: 'inv-123',
        createOk: false,
      });
      const fixture = TestBed.createComponent(CreditNoteFormPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      cmp.toggle(0, true);
      cmp.form.patchValue({ reason: 'Customer return', restockParts: false });
      cmp.onSubmit();
      await fixture.whenStable();

      expect(creditNoteServiceStub.create).toHaveBeenCalledTimes(1);
      expect(cmp.isSubmitting()).toBeFalse();
      // Form intact.
      expect(cmp.form.value.reason).toBe('Customer return');
      expect(cmp.form.value.restockParts).toBeFalse();
      // Selection intact.
      expect(cmp.lines()[0].selected).toBeTrue();
      // Generic-failure toast key, NOT the lock key.
      expect(toastStub.error).toHaveBeenCalledWith(
        'invoicing.creditNotes.form.createFailed',
      );
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('S-EDGE-004 — onSubmit short-circuits when no lines are selected', async () => {
      const { creditNoteServiceStub, toastStub } = configure({ invoiceId: 'inv-123' });
      const fixture = TestBed.createComponent(CreditNoteFormPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      cmp.form.patchValue({ reason: 'Customer return', restockParts: true });
      // No toggle() call — every line is unselected.

      cmp.onSubmit();
      await fixture.whenStable();

      expect(creditNoteServiceStub.create).not.toHaveBeenCalled();
      expect(toastStub.warning).toHaveBeenCalledWith(
        'invoicing.creditNotes.form.selectAtLeastOne',
      );
    });

    it('S-EDGE-016 — 423 on create emits the locked-specific toast key', async () => {
      const { toastStub } = configure({
        invoiceId: 'inv-123',
        createErrorStatus: 423,
      });
      const fixture = TestBed.createComponent(CreditNoteFormPageComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      cmp.toggle(0, true);
      cmp.form.patchValue({ reason: 'Customer return', restockParts: true });
      cmp.onSubmit();
      await fixture.whenStable();

      expect(toastStub.error).toHaveBeenCalledWith(
        'invoicing.creditNotes.form.lockedFailed',
      );
      expect(toastStub.error).not.toHaveBeenCalledWith(
        'invoicing.creditNotes.form.createFailed',
      );
      expect(cmp.isSubmitting()).toBeFalse();
    });
  });
});
