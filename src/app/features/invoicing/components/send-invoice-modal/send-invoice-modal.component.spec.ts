import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslationService } from '../../../../core/services/translation.service';
import {
  SendInvoiceModalComponent,
  SendInvoicePayload,
} from './send-invoice-modal.component';

/**
 * Unit spec for SendInvoiceModalComponent.
 *
 * Follows the same convention as `ar-aging.component.spec.ts` — the
 * Karma `.html` loader has a known pre-existing limitation on deep
 * `components/` folders, but the spec compiles under tsc and serves
 * as the regression contract for the modal's logic.
 *
 * Covers:
 *   - default channel is EMAIL, recipient seeded from customerEmail
 *   - selecting WHATSAPP swaps validators + reseeds from customerPhone
 *   - submit blocked while invalid; emits `send` with channel + to
 *   - close emits `close` and respects `submitting` lock
 */
describe('SendInvoiceModalComponent', () => {
  let fixture: ComponentFixture<SendInvoiceModalComponent>;
  let component: SendInvoiceModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendInvoiceModalComponent],
      providers: [
        {
          provide: TranslationService,
          useValue: {
            instant: (k: string) => k,
            translations$: of({}),
            currentLanguage: () => 'en',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendInvoiceModalComponent);
    component = fixture.componentInstance;
    component.isOpen = true;
    component.context = {
      documentId: 'inv-1',
      documentNumber: 'INV-2026-0001',
      documentKindLabelKey: 'invoicing.send.kindInvoice',
      customerEmail: 'aly@example.tn',
      customerPhone: '+216 23 456 789',
    };
    component.ngOnChanges({
      isOpen: {
        previousValue: false,
        currentValue: true,
        firstChange: true,
        isFirstChange: () => true,
      },
    });
  });

  it('seeds recipient with customerEmail and defaults to EMAIL channel', () => {
    expect(component.channel()).toBe('EMAIL');
    expect(component.form.controls.to.value).toBe('aly@example.tn');
    expect(component.recipientMode()).toBe('email');
  });

  it('switching to WHATSAPP reseeds from customerPhone and changes mode', () => {
    component.selectChannel('WHATSAPP');
    expect(component.channel()).toBe('WHATSAPP');
    expect(component.form.controls.to.value).toBe('+216 23 456 789');
    expect(component.recipientMode()).toBe('phone');
  });

  it('switching back to EMAIL restores email validators', () => {
    component.selectChannel('WHATSAPP');
    component.selectChannel('EMAIL');
    component.form.controls.to.setValue('not-an-email');
    expect(component.form.controls.to.valid).toBe(false);
  });

  it('does not emit send when recipient is empty', () => {
    let emitted: SendInvoicePayload | undefined;
    component.send.subscribe((p) => (emitted = p));

    component.form.controls.to.setValue('');
    component.onSubmit();

    expect(emitted).toBeUndefined();
    expect(component.form.controls.to.touched).toBe(true);
  });

  it('does not emit send for invalid email', () => {
    let emitted: SendInvoicePayload | undefined;
    component.send.subscribe((p) => (emitted = p));

    component.form.controls.to.setValue('not-an-email');
    component.onSubmit();

    expect(emitted).toBeUndefined();
  });

  it('emits send with channel + to when valid', () => {
    let emitted: SendInvoicePayload | undefined;
    component.send.subscribe((p) => (emitted = p));

    component.form.controls.to.setValue('valid@opauto.tn');
    component.onSubmit();

    expect(emitted).toEqual({
      channel: 'EMAIL',
      to: 'valid@opauto.tn',
    });
  });

  it('emits send with WHATSAPP channel when selected', () => {
    let emitted: SendInvoicePayload | undefined;
    component.send.subscribe((p) => (emitted = p));

    component.selectChannel('WHATSAPP');
    component.form.controls.to.setValue('21623456789');
    component.onSubmit();

    expect(emitted?.channel).toBe('WHATSAPP');
    expect(emitted?.to).toBe('21623456789');
  });

  it('does not emit send while submitting', () => {
    let emitted: SendInvoicePayload | undefined;
    component.send.subscribe((p) => (emitted = p));

    component.submitting = true;
    component.form.controls.to.setValue('valid@opauto.tn');
    component.onSubmit();

    expect(emitted).toBeUndefined();
  });

  it('close emits close event', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));

    component.onClose();
    expect(closed).toBe(true);
  });

  it('close is suppressed while submitting', () => {
    let closed = false;
    component.close.subscribe(() => (closed = true));

    component.submitting = true;
    component.onClose();

    expect(closed).toBe(false);
  });

  it('seeds with empty string when customer has no email', () => {
    component.context = {
      documentId: 'inv-2',
      documentNumber: 'INV-2026-0002',
      documentKindLabelKey: 'invoicing.send.kindInvoice',
      customerEmail: null,
      customerPhone: null,
    };
    component.ngOnChanges({
      isOpen: {
        previousValue: false,
        currentValue: true,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    expect(component.form.controls.to.value).toBe('');
  });

  it('trims whitespace from recipient before emitting', () => {
    let emitted: SendInvoicePayload | undefined;
    component.send.subscribe((p) => (emitted = p));

    component.form.controls.to.setValue('  valid@opauto.tn  ');
    component.onSubmit();

    expect(emitted?.to).toBe('valid@opauto.tn');
  });
});
