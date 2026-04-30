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
});
