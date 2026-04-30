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
    component.submit.subscribe((result: PaymentModalResult) => {
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
    component.submit.subscribe(() => (emitted = true));
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
});
