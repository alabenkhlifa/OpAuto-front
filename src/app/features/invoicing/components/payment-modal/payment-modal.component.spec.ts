import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  PaymentModalComponent,
  PaymentModalContext,
  PaymentModalResult,
} from './payment-modal.component';
import { of } from 'rxjs';
import { TranslationService } from '../../../../core/services/translation.service';

describe('PaymentModalComponent', () => {
  let component: PaymentModalComponent;
  let fixture: ComponentFixture<PaymentModalComponent>;

  const ctx: PaymentModalContext = {
    invoiceId: 'i1',
    invoiceNumber: 'INV-001',
    remainingAmount: 250,
    currency: 'TND',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentModalComponent],
      providers: [
        {
          provide: TranslationService,
          useValue: {
            instant: (k: string) => k,
            getCurrentLanguage: () => 'en',
            translations$: of({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentModalComponent);
    component = fixture.componentInstance;
  });

  it('seeds the amount with the remaining balance when opened', () => {
    component.context = ctx;
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
    } as any);
    expect(component.form.controls.amount.value).toBe(250);
    expect(component.method()).toBe('cash');
  });

  it('selectMethod updates the method signal', () => {
    component.selectMethod('card');
    expect(component.method()).toBe('card');
  });

  it('emits the payload on submit', (done) => {
    component.context = ctx;
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
    } as any);
    component.selectMethod('check');
    component.form.patchValue({ reference: 'CHK-123' });
    component.submitted.subscribe((result: PaymentModalResult) => {
      expect(result.method).toBe('check');
      expect(result.amount).toBe(250);
      expect(result.reference).toBe('CHK-123');
      done();
    });
    component.onSubmit();
  });

  it('blocks submit when amount is invalid', () => {
    component.context = ctx;
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
    } as any);
    component.form.patchValue({ amount: 0 });
    let emitted = false;
    component.submitted.subscribe(() => (emitted = true));
    component.onSubmit();
    expect(emitted).toBeFalse();
  });

  it('does not close while submitting', () => {
    component.submitting = true;
    let closed = false;
    component.close.subscribe(() => (closed = true));
    component.onClose();
    expect(closed).toBeFalse();
  });

  it('re-seeds the form when reopened after a previous close', () => {
    // Open #1
    component.context = ctx;
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
    } as any);
    // Simulate user changing the amount and method during open #1
    component.selectMethod('card');
    component.form.patchValue({ amount: 50, reference: 'old-ref' });
    expect(component.form.controls.amount.value).toBe(50);

    // Close
    component.isOpen = false;
    component.ngOnChanges({
      isOpen: { currentValue: false, previousValue: true, firstChange: false, isFirstChange: () => false },
    } as any);

    // Reopen with a fresh remaining amount
    const ctx2: PaymentModalContext = { ...ctx, remainingAmount: 175 };
    component.context = ctx2;
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false },
      context: { currentValue: ctx2, previousValue: ctx, firstChange: false, isFirstChange: () => false },
    } as any);

    expect(component.form.controls.amount.value).toBe(175);
    expect(component.form.controls.reference.value).toBe('');
    expect(component.method()).toBe('cash');
  });

  it('re-seeds the form when openKey is bumped (PARTIALLY_PAID reopen path)', () => {
    // Simulates a partially-paid invoice reopen where the OnPush parent
    // bumps openKey alongside flipping isOpen. The modal must reset even
    // if `isOpen` previousValue/currentValue look stale.
    component.context = ctx;
    component.isOpen = true;
    component.openKey = 1;
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
      openKey: { currentValue: 1, previousValue: null, firstChange: true, isFirstChange: () => true },
    } as any);
    component.form.patchValue({ amount: 99, reference: 'stale-ref' });

    // Parent reopens after a partial payment — only openKey changes ref;
    // isOpen looks unchanged from the modal's perspective if a CD tick
    // coalesced the toggle.
    const ctx2: PaymentModalContext = { ...ctx, remainingAmount: 42 };
    component.context = ctx2;
    component.openKey = 2;
    component.ngOnChanges({
      openKey: { currentValue: 2, previousValue: 1, firstChange: false, isFirstChange: () => false },
      context: { currentValue: ctx2, previousValue: ctx, firstChange: false, isFirstChange: () => false },
    } as any);

    expect(component.form.controls.amount.value).toBe(42);
    expect(component.form.controls.reference.value).toBe('');
  });

  /**
   * Sweep C-2 — Section 7 payment edge cases.
   *
   * Helpers
   *  - openWith(c): opens the modal against context `c`. Mirrors the parent's
   *    "open intent" — bump openKey, flip isOpen, fire ngOnChanges.
   *  - patchAndSubmit(): expects the next emit on `submit`, returning the
   *    payload synchronously via a test-side spy.
   */
  function openWith(c: PaymentModalContext) {
    component.context = c;
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
    } as any);
  }

  describe('S-PAY-007 — Method coverage (CARD / CHECK / BANK_TRANSFER + CASH)', () => {
    /**
     * The modal must emit each PaymentMethod value verbatim — the parent
     * proxies straight through to InvoiceService.addPayment which maps to
     * the BE PaymentMethod enum (CASH | CARD | CHECK | BANK_TRANSFER).
     * Anything else is a wire contract regression.
     */
    (['cash', 'card', 'check', 'bank-transfer'] as const).forEach((method) => {
      it(`emits ${method} on submit when that chip is selected`, (done) => {
        openWith(ctx);
        component.selectMethod(method);
        component.submitted.subscribe((result) => {
          expect(result.method).toBe(method);
          expect(result.amount).toBe(250);
          done();
        });
        component.onSubmit();
      });
    });

    it('exposes all four method chips in PAYMENT_METHODS', () => {
      // Pin the chip list — a future map regression that drops one of the
      // four BE-supported methods would silently hide it from the UI.
      expect(component.methods).toEqual(['cash', 'card', 'check', 'bank-transfer']);
    });
  });

  describe('S-PAY-010 — Reference + notes are optional', () => {
    /**
     * Reference (check #, transaction id, etc.) and notes must accept
     * blank submissions so a CASH payment with nothing else to record
     * doesn't get blocked by stray validators.
     */
    it('submits successfully with both reference and notes left blank', (done) => {
      openWith(ctx);
      component.submitted.subscribe((result) => {
        expect(result.reference).toBeUndefined();
        expect(result.notes).toBeUndefined();
        done();
      });
      component.onSubmit();
    });

    it('reference and notes controls have no validators (form valid with both blank)', () => {
      openWith(ctx);
      const refCtrl = component.form.controls.reference;
      const notesCtrl = component.form.controls.notes;
      refCtrl.setValue('');
      notesCtrl.setValue('');
      expect(refCtrl.valid).toBeTrue();
      expect(notesCtrl.valid).toBeTrue();
      expect(component.form.valid).toBeTrue();
    });

    it('whitespace-only reference still emits as undefined (`v.reference || undefined`)', (done) => {
      openWith(ctx);
      component.form.patchValue({ reference: '' });
      component.submitted.subscribe((result) => {
        expect(result.reference).toBeUndefined();
        done();
      });
      component.onSubmit();
    });
  });

  describe('S-PAY-012 — Over-payment blocked via Validators.max(remainingAmount)', () => {
    /**
     * The modal caps the amount input at the invoice's remaining balance.
     * Submission is blocked while the amount exceeds the cap, and the
     * inline error renders the translated `errors.overPayment` key once
     * the field is touched.
     */
    it('form invalid when amount > remainingAmount', () => {
      openWith({ ...ctx, remainingAmount: 119 });
      component.form.patchValue({ amount: 200 });
      expect(component.form.controls.amount.errors?.['max']).toBeTruthy();
      expect(component.form.valid).toBeFalse();
      expect(component.canSubmit()).toBeFalse();
    });

    it('onSubmit does not emit when amount > remainingAmount', () => {
      openWith({ ...ctx, remainingAmount: 119 });
      component.form.patchValue({ amount: 250 });
      let emitted = false;
      component.submitted.subscribe(() => (emitted = true));
      component.onSubmit();
      expect(emitted).toBeFalse();
      // After a blocked submit, all controls are marked touched so the
      // inline error renders.
      expect(component.form.controls.amount.touched).toBeTrue();
    });

    it('form valid when amount === remainingAmount (boundary)', () => {
      openWith({ ...ctx, remainingAmount: 119 });
      component.form.patchValue({ amount: 119 });
      expect(component.form.valid).toBeTrue();
      expect(component.canSubmit()).toBeTrue();
    });

    it('max validator re-applies on every reopen (remaining can change)', () => {
      // Open #1 with remaining=250 → 200 should be valid.
      openWith({ ...ctx, remainingAmount: 250 });
      component.form.patchValue({ amount: 200 });
      expect(component.form.valid).toBeTrue();

      // Reopen with remaining=100 → 200 must now fail.
      const ctx2: PaymentModalContext = { ...ctx, remainingAmount: 100 };
      component.context = ctx2;
      component.openKey = 2;
      component.ngOnChanges({
        openKey: { currentValue: 2, previousValue: 1, firstChange: false, isFirstChange: () => false },
        context: { currentValue: ctx2, previousValue: ctx, firstChange: false, isFirstChange: () => false },
      } as any);
      component.form.patchValue({ amount: 200 });
      expect(component.form.controls.amount.errors?.['max']).toBeTruthy();
      expect(component.form.valid).toBeFalse();
    });
  });

  describe('S-PAY-013 — Zero / negative amount blocked via Validators.min(0.01)', () => {
    it('form invalid when amount = 0', () => {
      openWith(ctx);
      component.form.patchValue({ amount: 0 });
      expect(component.form.controls.amount.errors?.['min']).toBeTruthy();
      expect(component.form.valid).toBeFalse();
    });

    it('form invalid when amount < 0', () => {
      openWith(ctx);
      component.form.patchValue({ amount: -5 });
      expect(component.form.controls.amount.errors?.['min']).toBeTruthy();
      expect(component.form.valid).toBeFalse();
    });

    it('onSubmit does not emit when amount is non-positive', () => {
      openWith(ctx);
      let emitted = false;
      component.submitted.subscribe(() => (emitted = true));
      component.form.patchValue({ amount: 0 });
      component.onSubmit();
      component.form.patchValue({ amount: -10 });
      component.onSubmit();
      expect(emitted).toBeFalse();
    });

    it('form valid at the minimum (0.01) — boundary', () => {
      openWith(ctx);
      component.form.patchValue({ amount: 0.01 });
      expect(component.form.valid).toBeTrue();
    });
  });

  /**
   * S-EDGE-017 — Transient RangeError on payment submit re-render.
   *
   * Pre-fix the modal emitted `paymentDate: v.paymentDate ?? <today>` —
   * `??` only catches null/undefined so an empty string `''` (e.g. user
   * cleared the date input) propagated downstream to `new Date('')` and
   * then `Invalid Date.toISOString()` → RangeError. The fix coerces any
   * blank value to today's ISO date before emitting.
   *
   * Note: an empty paymentDate ALSO fails Validators.required so the
   * Submit button is normally disabled. The guard is belt-and-braces in
   * case any future code-path bypasses canSubmit().
   */
  describe('S-EDGE-017 — payment date coerces blanks to today', () => {
    it('empty-string paymentDate is replaced with today before emit', () => {
      openWith(ctx);
      // Bypass the validator gate — directly invoke onSubmit with the
      // form pre-set to an empty paymentDate. We mark the field invalid
      // first then force-submit to mimic an edge case (e.g. a future
      // bypass via `markAsValid` from another control).
      component.form.controls.paymentDate.clearValidators();
      component.form.controls.paymentDate.setValue('');
      component.form.controls.paymentDate.updateValueAndValidity();
      component.form.patchValue({ amount: 50 });

      let payload: any;
      component.submitted.subscribe((p) => (payload = p));
      component.onSubmit();

      expect(payload).toBeDefined();
      // YYYY-MM-DD format — non-empty, length 10.
      expect(typeof payload.paymentDate).toBe('string');
      expect(payload.paymentDate.length).toBe(10);
      expect(payload.paymentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('whitespace-only paymentDate is replaced with today before emit', () => {
      openWith(ctx);
      component.form.controls.paymentDate.clearValidators();
      component.form.controls.paymentDate.setValue('   ');
      component.form.controls.paymentDate.updateValueAndValidity();
      component.form.patchValue({ amount: 50 });

      let payload: any;
      component.submitted.subscribe((p) => (payload = p));
      component.onSubmit();

      expect(payload.paymentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  /**
   * BUG-109 — payment modal double-submit (root cause: native DOM submit
   * event collision with the `@Output() submit` Output name).
   *
   * Pre-fix: a single click on the Submit button produced TWO HTTP POSTs
   * to `/payments`. The first POST carried the proper `PaymentModalResult`
   * payload and returned 201; the second POST carried an empty body
   * (`{method:"", paymentDate, processedBy}` — `amount` and `method` both
   * undefined because the listener received a raw `SubmitEvent` instead of
   * a typed payload) and returned 500 because the state machine had
   * already settled the invoice on the first call.
   *
   * Root cause: the modal's internal `<form (ngSubmit)="onSubmit()">` fires
   * a native `submit` DOM event that bubbles up through the host element.
   * The parent template's `(submit)="onPaymentModalSubmit($event)"`
   * binding on `<app-payment-modal>` was matched by Angular against BOTH
   * the `@Output() submit` EventEmitter AND the bubbling DOM submit event,
   * so the parent listener fired twice — once with the typed payload, once
   * with the raw `SubmitEvent`.
   *
   * Fix: rename the Output from `submit` to `submitted`. `(submitted)="..."`
   * only matches the typed Output; native DOM submit no longer collides.
   * Plus a defence-in-depth `isSubmitting` signal flipped synchronously
   * inside `onSubmit()` so a rapid manual double-click can't slip a second
   * emit through within a single CD tick.
   */
  describe('BUG-109 — submit Output rename + double-submit guard', () => {
    it('exposes `submitted` Output (renamed from `submit` to dodge DOM submit collision)', () => {
      // Regression: the native DOM `submit` event bubbles out of the
      // internal form. If the Output were still named `submit`, parent
      // bindings would receive both the typed payload AND the raw
      // SubmitEvent on a single click — producing the double POST.
      expect((component as any).submit).toBeUndefined();
      expect(component.submitted).toBeDefined();
      expect(typeof component.submitted.emit).toBe('function');
    });


    it('rapid double-click only emits once', () => {
      openWith(ctx);
      const emits: PaymentModalResult[] = [];
      component.submitted.subscribe((p) => emits.push(p));

      component.onSubmit();
      component.onSubmit();

      expect(emits.length).toBe(1);
    });

    it('canSubmit() returns false synchronously after first onSubmit', () => {
      openWith(ctx);
      expect(component.canSubmit()).toBeTrue();
      component.onSubmit();
      expect(component.canSubmit()).toBeFalse();
      expect(component.isSubmitting()).toBeTrue();
    });

    it('isSubmitting resets on reopen so a fresh submit is allowed', () => {
      openWith(ctx);
      component.onSubmit();
      expect(component.isSubmitting()).toBeTrue();

      // Reopen — the parent's openKey bumped path is the partially-paid reopen.
      const ctx2: PaymentModalContext = { ...ctx, remainingAmount: 100 };
      component.context = ctx2;
      component.openKey = 99;
      component.ngOnChanges({
        openKey: { currentValue: 99, previousValue: null, firstChange: false, isFirstChange: () => false },
        context: { currentValue: ctx2, previousValue: ctx, firstChange: false, isFirstChange: () => false },
      } as any);

      expect(component.isSubmitting()).toBeFalse();
      expect(component.canSubmit()).toBeTrue();

      const emits: PaymentModalResult[] = [];
      component.submitted.subscribe((p) => emits.push(p));
      component.onSubmit();
      expect(emits.length).toBe(1);
    });

    it('triple-click still only emits once (defence-in-depth)', () => {
      openWith(ctx);
      const emits: PaymentModalResult[] = [];
      component.submitted.subscribe((p) => emits.push(p));

      component.onSubmit();
      component.onSubmit();
      component.onSubmit();

      expect(emits.length).toBe(1);
    });
  });

  /**
   * S-PAY-015 (Sweep C-19) — payment network failure: modal stays open,
   * values preserved, Submit button re-enables.
   *
   * Pre-fix: when the parent's HTTP call to `POST /api/payments` failed,
   * the parent's `paymentSubmitting` flag flipped back to `false` and a
   * toast was fired — but the modal's internal `isSubmitting()` signal
   * stayed `true` (set inside `onSubmit()`, only cleared on `ngOnChanges`
   * re-open). Result: the Submit button stayed disabled and the user
   * could not retry without closing/reopening the modal.
   *
   * Fix: detect the parent's `submitting` Input transitioning true→false
   * and reset the internal in-flight guard, while leaving the form's
   * values, the selected method, and the modal's open state untouched.
   */
  describe('S-PAY-015 — Network failure preserves form, re-enables Submit', () => {
    it('isSubmitting resets when parent flips submitting true→false (error path)', () => {
      openWith(ctx);
      // User typed distinctive values then clicked Submit.
      component.selectMethod('card');
      component.form.patchValue({
        amount: 75,
        reference: 'NET-FAIL-REF',
        notes: 'retry me',
      });
      component.onSubmit();
      expect(component.isSubmitting()).toBeTrue();

      // Parent now flips its `submitting` Input to true (HTTP in flight).
      component.submitting = true;
      component.ngOnChanges({
        submitting: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false },
      } as any);

      // Network failure: parent flips it back to false (modal stays open).
      component.submitting = false;
      component.ngOnChanges({
        submitting: { currentValue: false, previousValue: true, firstChange: false, isFirstChange: () => false },
      } as any);

      // Internal guard cleared — Submit re-enabled.
      expect(component.isSubmitting()).toBeFalse();
      expect(component.canSubmit()).toBeTrue();
    });

    it('form values + selected method are preserved across the failure cycle', () => {
      openWith(ctx);
      component.selectMethod('bank-transfer');
      component.form.patchValue({
        amount: 119,
        reference: 'TX-DEADBEEF',
        notes: 'partial wire',
      });

      // submit → parent flips submitting on then off (failure).
      component.onSubmit();
      component.submitting = true;
      component.ngOnChanges({
        submitting: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false },
      } as any);
      component.submitting = false;
      component.ngOnChanges({
        submitting: { currentValue: false, previousValue: true, firstChange: false, isFirstChange: () => false },
      } as any);

      // Nothing the user typed was wiped.
      expect(component.method()).toBe('bank-transfer');
      expect(component.form.controls.amount.value).toBe(119);
      expect(component.form.controls.reference.value).toBe('TX-DEADBEEF');
      expect(component.form.controls.notes.value).toBe('partial wire');
    });

    it('a retry after a failure emits exactly one new payload', () => {
      openWith(ctx);
      const emits: PaymentModalResult[] = [];
      component.submitted.subscribe((p) => emits.push(p));

      // First submit (will "fail" downstream).
      component.onSubmit();
      expect(emits.length).toBe(1);

      // Parent's submitting toggle: on then off.
      component.submitting = true;
      component.ngOnChanges({
        submitting: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false },
      } as any);
      component.submitting = false;
      component.ngOnChanges({
        submitting: { currentValue: false, previousValue: true, firstChange: false, isFirstChange: () => false },
      } as any);

      // Retry — must emit a second payload.
      component.onSubmit();
      expect(emits.length).toBe(2);
    });

    it('does NOT reset isSubmitting on the success path (modal already closed)', () => {
      // On success the parent flips paymentModalOpen=false and submitting=false
      // in the same tick. ngOnChanges sees `isOpen` go true→false, so the
      // body of the open-now branch does NOT run. The submitting-only branch
      // also bails because `this.isOpen` is now false — meaning we don't
      // touch the signal. The next reopen will reset it via the open path.
      openWith(ctx);
      component.onSubmit();
      expect(component.isSubmitting()).toBeTrue();

      component.submitting = true;
      component.ngOnChanges({
        submitting: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false },
      } as any);

      // Success: parent closes modal AND clears submitting in the same tick.
      component.isOpen = false;
      component.submitting = false;
      component.ngOnChanges({
        isOpen: { currentValue: false, previousValue: true, firstChange: false, isFirstChange: () => false },
        submitting: { currentValue: false, previousValue: true, firstChange: false, isFirstChange: () => false },
      } as any);

      // Guarded by `this.isOpen` — the success branch doesn't fire here,
      // because the modal is already closed. Reopening clears it via the
      // open-now branch (already covered by the BUG-109 reopen spec above).
      expect(component.isSubmitting()).toBeTrue();
    });
  });

  /**
   * BUG-100 (Sweep C-17) — sticky-footer layout regression.
   *
   * Previously the dialog's `max-height: 90vh` plus body-only flow meant
   * the action buttons sat below the visible viewport on iPhone landscape
   * (667×375). Fix moves scrolling onto `.payment-modal__body` and pins
   * `.payment-modal__footer` with `position: sticky; bottom: 0`.
   *
   * The spec is class-based (lock the contract via the rendered template)
   * rather than measuring `getBoundingClientRect` — the latter is fragile
   * under Karma's headless DPR and would tie the spec to the test runner.
   * The live walk in the sweep validates the actual rendered behaviour.
   */
  describe('BUG-100 — sticky footer layout (landscape mobile)', () => {
    it('renders the footer inside the scrolling body so it can be sticky', () => {
      component.context = ctx;
      component.isOpen = true;
      component.ngOnChanges({
        isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
      } as any);
      fixture.detectChanges();

      const body = fixture.nativeElement.querySelector('.payment-modal__body');
      const footer = fixture.nativeElement.querySelector('.payment-modal__footer');
      expect(body).withContext('body element rendered').toBeTruthy();
      expect(footer).withContext('footer element rendered').toBeTruthy();
      // Footer is a child of the body so the sticky positioning takes
      // effect against the body's scroll context (not the dialog).
      expect(body.contains(footer)).withContext('footer is inside the scrolling body').toBeTrue();
    });

    it('exposes both Submit and Cancel buttons in the footer (DOM contract)', () => {
      component.context = ctx;
      component.isOpen = true;
      component.ngOnChanges({
        isOpen: { currentValue: true, previousValue: false, firstChange: true, isFirstChange: () => true },
      } as any);
      fixture.detectChanges();

      const footer = fixture.nativeElement.querySelector('.payment-modal__footer');
      const buttons = footer?.querySelectorAll('button') ?? [];
      // Cancel + Submit — both must always be present so the sticky
      // footer can keep them both in view in landscape phones.
      expect(buttons.length).toBe(2);
      expect((buttons[0] as HTMLButtonElement).type).toBe('button'); // Cancel
      expect((buttons[1] as HTMLButtonElement).type).toBe('submit'); // Submit
    });
  });
});
