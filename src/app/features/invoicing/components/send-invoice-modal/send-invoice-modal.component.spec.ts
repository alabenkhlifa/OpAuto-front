import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { TranslationService } from '../../../../core/services/translation.service';
import {
  SendInvoiceModalComponent,
  SendInvoicePayload,
  tunisianPhoneValidator,
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
            // Mirror the real ParamReplacement → consumers do their own
            // `{{number}}` interpolation; for tests we just echo the key.
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

  // ─────────────────────────────────────────────────────────────
  // S-DEL-009 — Recipient input swaps validators (email ↔ phone)
  // ─────────────────────────────────────────────────────────────
  describe('S-DEL-009 — recipient validator swap', () => {
    it('EMAIL channel: rejects "not-an-email"', () => {
      component.selectChannel('EMAIL');
      component.form.controls.to.setValue('not-an-email');
      expect(component.form.controls.to.valid).toBe(false);
      expect(component.form.controls.to.errors?.['email']).toBe(true);
    });

    it('EMAIL channel: accepts a well-formed address', () => {
      component.selectChannel('EMAIL');
      component.form.controls.to.setValue('ala@maibornwolff.de');
      expect(component.form.controls.to.valid).toBe(true);
    });

    it('WHATSAPP channel: rejects "not-an-email"', () => {
      component.selectChannel('WHATSAPP');
      component.form.controls.to.setValue('not-an-email');
      expect(component.form.controls.to.valid).toBe(false);
      expect(component.form.controls.to.errors?.['tunisianPhone']).toBe(true);
    });

    it('WHATSAPP channel: accepts "+216 22 333 444" (with country code + spaces)', () => {
      component.selectChannel('WHATSAPP');
      component.form.controls.to.setValue('+216 22 333 444');
      expect(component.form.controls.to.valid).toBe(true);
    });

    it('WHATSAPP channel: accepts bare 8-digit local form "22 333 444"', () => {
      component.selectChannel('WHATSAPP');
      component.form.controls.to.setValue('22 333 444');
      expect(component.form.controls.to.valid).toBe(true);
    });

    it('WHATSAPP channel: accepts leading-zero "022 333 444"', () => {
      component.selectChannel('WHATSAPP');
      component.form.controls.to.setValue('022 333 444');
      expect(component.form.controls.to.valid).toBe(true);
    });

    it('WHATSAPP channel: rejects 7-digit short number', () => {
      component.selectChannel('WHATSAPP');
      component.form.controls.to.setValue('1234567');
      expect(component.form.controls.to.valid).toBe(false);
    });

    it('BOTH channel: validates as email (recipientMode === "email")', () => {
      component.selectChannel('BOTH');
      expect(component.recipientMode()).toBe('email');
      component.form.controls.to.setValue('not-an-email');
      expect(component.form.controls.to.valid).toBe(false);
      component.form.controls.to.setValue('valid@opauto.tn');
      expect(component.form.controls.to.valid).toBe(true);
    });

    it('tunisianPhoneValidator unit — empty string yields no error (let `required` decide)', () => {
      const v = tunisianPhoneValidator();
      expect(v(new FormControl(''))).toBeNull();
    });

    it('tunisianPhoneValidator unit — "0021622333444" canonicalises to 8 digits', () => {
      const v = tunisianPhoneValidator();
      expect(v(new FormControl('0021622333444'))).toBeNull();
    });

    it('tunisianPhoneValidator unit — "abc" returns { tunisianPhone: true }', () => {
      const v = tunisianPhoneValidator();
      expect(v(new FormControl('abc'))).toEqual({ tunisianPhone: true });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // S-DEL-010 — Preview pane shows subject + body
  // ─────────────────────────────────────────────────────────────
  describe('S-DEL-010 — preview pane', () => {
    it('falls back to the translated subject template when context.previewSubject is unset', () => {
      // Translation mock echoes keys → `previewSubject` template stays
      // literal but gets `{{number}}` interpolation. Replace yields the
      // raw key when the placeholder is missing.
      const subject = component.previewSubject();
      expect(subject).toContain('invoicing.sendModal.preview.subject');
    });

    it('falls back to the translated body template when context.previewBody is unset', () => {
      const body = component.previewBody();
      expect(body).toContain('invoicing.sendModal.preview.body');
    });

    it('uses parent-provided previewSubject when present', () => {
      component.context = {
        ...component.context!,
        previewSubject: 'Invoice INV-2026-0001',
      };
      component.contextSignal.set(component.context);
      expect(component.previewSubject()).toBe('Invoice INV-2026-0001');
    });

    it('uses parent-provided previewBody when present', () => {
      component.context = {
        ...component.context!,
        previewBody: 'Hello, your invoice INV-2026-0001 is attached.',
      };
      component.contextSignal.set(component.context);
      expect(component.previewBody()).toBe(
        'Hello, your invoice INV-2026-0001 is attached.',
      );
    });

    it('subject + body return empty string when context is null', () => {
      component.contextSignal.set(null);
      expect(component.previewSubject()).toBe('');
      expect(component.previewBody()).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // S-DEL-011 — Submit emits payload { channel, to }
  // ─────────────────────────────────────────────────────────────
  describe('S-DEL-011 — submit payload shape', () => {
    it('EMAIL: emits { channel: "EMAIL", to: <trimmed-email> }', () => {
      let emitted: SendInvoicePayload | undefined;
      component.send.subscribe((p) => (emitted = p));

      component.selectChannel('EMAIL');
      component.form.controls.to.setValue('ala@opauto.tn');
      component.onSubmit();

      expect(emitted).toEqual({ channel: 'EMAIL', to: 'ala@opauto.tn' });
      expect(Object.keys(emitted!).sort()).toEqual(['channel', 'to']);
    });

    it('WHATSAPP: emits { channel: "WHATSAPP", to: <raw-phone> }', () => {
      let emitted: SendInvoicePayload | undefined;
      component.send.subscribe((p) => (emitted = p));

      component.selectChannel('WHATSAPP');
      component.form.controls.to.setValue('+216 22 333 444');
      component.onSubmit();

      expect(emitted?.channel).toBe('WHATSAPP');
      // FE does NOT canonicalise — the BE `normalizeTunisiaPhone` does that.
      expect(emitted?.to).toBe('+216 22 333 444');
    });

    it('BOTH: emits { channel: "BOTH", to: <email> }', () => {
      let emitted: SendInvoicePayload | undefined;
      component.send.subscribe((p) => (emitted = p));

      component.selectChannel('BOTH');
      component.form.controls.to.setValue('ala@opauto.tn');
      component.onSubmit();

      expect(emitted).toEqual({ channel: 'BOTH', to: 'ala@opauto.tn' });
    });

    it('payload object contains exactly two keys', () => {
      let emitted: SendInvoicePayload | undefined;
      component.send.subscribe((p) => (emitted = p));

      component.form.controls.to.setValue('ala@opauto.tn');
      component.onSubmit();

      expect(emitted).toBeDefined();
      expect(Object.keys(emitted!).sort()).toEqual(['channel', 'to']);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // S-DEL-012 — Re-send affordance contract
  //   The Send button visibility lives on InvoiceDetailsComponent;
  //   here we pin the modal-level guarantee that re-opening + re-
  //   submitting works exactly the same as the first submit.
  // ─────────────────────────────────────────────────────────────
  describe('S-DEL-012 — re-send through the modal', () => {
    it('re-opening with isOpen=true re-applies the channel + re-seeds recipient', () => {
      component.selectChannel('WHATSAPP');
      // Simulate the parent closing the modal …
      component.isOpen = false;
      component.ngOnChanges({
        isOpen: {
          previousValue: true,
          currentValue: false,
          firstChange: false,
          isFirstChange: () => false,
        },
      });
      // … and re-opening it. The signal mirror should re-fire the
      // applyChannel side-effect so the recipient is freshly seeded.
      component.isOpen = true;
      component.ngOnChanges({
        isOpen: {
          previousValue: false,
          currentValue: true,
          firstChange: false,
          isFirstChange: () => false,
        },
      });
      expect(component.channel()).toBe('WHATSAPP');
      expect(component.form.controls.to.value).toBe('+216 23 456 789');
    });

    it('emits a fresh payload on every onSubmit() call (no internal de-dupe)', () => {
      const emitted: SendInvoicePayload[] = [];
      component.send.subscribe((p) => emitted.push(p));

      component.form.controls.to.setValue('ala@opauto.tn');
      component.onSubmit();
      component.onSubmit();
      component.onSubmit();

      expect(emitted.length).toBe(3);
      emitted.forEach((p) => expect(p).toEqual({ channel: 'EMAIL', to: 'ala@opauto.tn' }));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // S-EDGE-010 — Customer with no phone + WHATSAPP channel.
  //
  //   The FE pre-flags the missing contact: `missingContactKey()`
  //   returns the translated hint key so the template surfaces a
  //   "no phone on file" message under the recipient input. The
  //   `Validators.required` on the recipient still gates submit
  //   (so the user can't ship an empty payload), and they always
  //   have the option to type a number directly into the input.
  //
  //   Same hint applies in mirror to a no-email customer + EMAIL.
  // ─────────────────────────────────────────────────────────────
  describe('S-EDGE-010 — missing-contact hint', () => {
    function reopenWithCtx(ctx: any) {
      component.context = ctx;
      component.isOpen = false;
      component.ngOnChanges({
        isOpen: {
          previousValue: true,
          currentValue: false,
          firstChange: false,
          isFirstChange: () => false,
        },
      });
      component.isOpen = true;
      component.ngOnChanges({
        context: {
          previousValue: null,
          currentValue: ctx,
          firstChange: false,
          isFirstChange: () => false,
        },
        isOpen: {
          previousValue: false,
          currentValue: true,
          firstChange: false,
          isFirstChange: () => false,
        },
      });
    }

    it('returns the phone hint key when WHATSAPP + no customerPhone', () => {
      reopenWithCtx({
        documentId: 'inv-1',
        documentNumber: 'INV-2026-0001',
        documentKindLabelKey: 'invoicing.send.kindInvoice',
        customerEmail: 'aly@example.tn',
        customerPhone: null,
      });
      component.selectChannel('WHATSAPP');
      expect(component.missingContactKey()).toBe(
        'invoicing.send.missingContact.phone',
      );
    });

    it('returns the email hint key when EMAIL + no customerEmail', () => {
      reopenWithCtx({
        documentId: 'inv-1',
        documentNumber: 'INV-2026-0001',
        documentKindLabelKey: 'invoicing.send.kindInvoice',
        customerEmail: null,
        customerPhone: '+216 23 456 789',
      });
      // Default channel is EMAIL.
      expect(component.missingContactKey()).toBe(
        'invoicing.send.missingContact.email',
      );
    });

    it('returns the email hint key when BOTH + no customerEmail (BOTH still needs the email leg)', () => {
      reopenWithCtx({
        documentId: 'inv-1',
        documentNumber: 'INV-2026-0001',
        documentKindLabelKey: 'invoicing.send.kindInvoice',
        customerEmail: null,
        customerPhone: '+216 23 456 789',
      });
      component.selectChannel('BOTH');
      expect(component.missingContactKey()).toBe(
        'invoicing.send.missingContact.email',
      );
    });

    it('returns null (no hint) when contact is on file for the picked channel', () => {
      reopenWithCtx({
        documentId: 'inv-1',
        documentNumber: 'INV-2026-0001',
        documentKindLabelKey: 'invoicing.send.kindInvoice',
        customerEmail: 'aly@example.tn',
        customerPhone: '+216 23 456 789',
      });
      // EMAIL → has email, no hint.
      expect(component.missingContactKey()).toBeNull();
      component.selectChannel('WHATSAPP');
      // WHATSAPP → has phone, no hint.
      expect(component.missingContactKey()).toBeNull();
    });

    it('blank-string customerPhone (whitespace only) is treated as missing for WHATSAPP', () => {
      reopenWithCtx({
        documentId: 'inv-1',
        documentNumber: 'INV-2026-0001',
        documentKindLabelKey: 'invoicing.send.kindInvoice',
        customerEmail: 'aly@example.tn',
        customerPhone: '   ',
      });
      component.selectChannel('WHATSAPP');
      expect(component.missingContactKey()).toBe(
        'invoicing.send.missingContact.phone',
      );
    });

    it('Validators.required still blocks submit when the user does not type a phone', () => {
      reopenWithCtx({
        documentId: 'inv-1',
        documentNumber: 'INV-2026-0001',
        documentKindLabelKey: 'invoicing.send.kindInvoice',
        customerEmail: 'aly@example.tn',
        customerPhone: null,
      });
      component.selectChannel('WHATSAPP');
      // Recipient was seeded empty by applyChannel → required fails.
      expect(component.form.controls.to.value).toBe('');
      expect(component.canSubmit()).toBeFalse();

      const emitted: SendInvoicePayload[] = [];
      component.send.subscribe((p) => emitted.push(p));
      component.onSubmit();
      expect(emitted.length).toBe(0);
    });
  });
});
