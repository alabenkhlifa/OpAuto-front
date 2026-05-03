import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AssistantApprovalCardComponent } from './assistant-approval-card.component';
import { TranslationService } from '../../../../core/services/translation.service';
import { AssistantPendingApproval } from '../../../../core/models/assistant.model';

describe('AssistantApprovalCardComponent', () => {
  let fixture: ComponentFixture<AssistantApprovalCardComponent>;
  let component: AssistantApprovalCardComponent;
  let translationService: jasmine.SpyObj<TranslationService>;

  const buildPending = (
    overrides: Partial<AssistantPendingApproval> = {},
  ): AssistantPendingApproval => ({
    toolCallId: 'tc-1',
    toolName: 'send_sms',
    args: { to: '+216 20 123 456', body: 'Hi Ali, your service is ready.' },
    blastTier: 'CONFIRM_WRITE',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // +5 min
    receivedAt: Date.now(),
    ...overrides,
  });

  const setPending = async (
    pending: AssistantPendingApproval,
  ): Promise<void> => {
    fixture.componentRef.setInput('pendingApproval', pending);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    translationService = jasmine.createSpyObj('TranslationService', ['instant'], {
      translations$: { subscribe: () => ({ unsubscribe: () => {} }) },
    });
    translationService.instant.and.callFake((k: string) => k);

    await TestBed.configureTestingModule({
      imports: [AssistantApprovalCardComponent],
      providers: [{ provide: TranslationService, useValue: translationService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AssistantApprovalCardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  // ---------------------------------------------------------------------------
  // CONFIRM_WRITE variant
  // ---------------------------------------------------------------------------

  describe('CONFIRM_WRITE', () => {
    beforeEach(async () => {
      await setPending(buildPending({ blastTier: 'CONFIRM_WRITE' }));
    });

    it('renders both Approve and Deny enabled', () => {
      const approveBtn = fixture.debugElement.query(
        By.css('.approval-card__approve'),
      ).nativeElement as HTMLButtonElement;
      const denyBtn = fixture.debugElement.query(By.css('.approval-card__deny'))
        .nativeElement as HTMLButtonElement;

      expect(approveBtn.disabled).toBe(false);
      expect(denyBtn.disabled).toBe(false);
    });

    it('does NOT render the typed-confirm input', () => {
      const input = fixture.debugElement.query(By.css('.approval-card__typed-input'));
      expect(input).toBeNull();
    });

    it('Approve emits decided with decision="approve" (no typedConfirmation)', () => {
      const events: { decision: string; typedConfirmation?: string }[] = [];
      component.decided.subscribe((e) => events.push(e));

      component.approve();

      expect(events.length).toBe(1);
      expect(events[0].decision).toBe('approve');
      expect(events[0].typedConfirmation).toBeUndefined();
    });

    it('Deny emits decided with decision="deny"', () => {
      const events: { decision: string }[] = [];
      component.decided.subscribe((e) => events.push(e));

      component.deny();

      expect(events.length).toBe(1);
      expect(events[0].decision).toBe('deny');
    });

    it('locks out further decisions once one is emitted (idempotency)', () => {
      const events: { decision: string }[] = [];
      component.decided.subscribe((e) => events.push(e));

      component.approve();
      component.approve();
      component.deny();

      expect(events.length).toBe(1);
    });

    it('dismiss emits dismissed when user closes without deciding', () => {
      let dismissed = 0;
      component.dismissed.subscribe(() => dismissed++);

      component.dismiss();

      expect(dismissed).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // TYPED_CONFIRM_WRITE variant
  // ---------------------------------------------------------------------------

  describe('TYPED_CONFIRM_WRITE', () => {
    beforeEach(async () => {
      await setPending(
        buildPending({
          blastTier: 'TYPED_CONFIRM_WRITE',
          toolName: 'record_payment',
          args: {
            invoiceId: 'inv-7',
            amount: 250,
            method: 'cash',
            _expectedConfirmation: 'INV-007',
          },
        }),
      );
    });

    it('extracts expectedConfirmation from args._expectedConfirmation', () => {
      expect(component.expectedConfirmation()).toBe('INV-007');
    });

    it('renders the typed-confirm input', () => {
      const input = fixture.debugElement.query(By.css('.approval-card__typed-input'));
      expect(input).not.toBeNull();
    });

    it('Approve is disabled until typed value matches expectedConfirmation', () => {
      expect(component.approveDisabled()).toBe(true);

      component.onTypedInput('INV-00');
      expect(component.approveDisabled()).toBe(true);

      component.onTypedInput('INV-007');
      expect(component.approveDisabled()).toBe(false);
    });

    it('match is case-sensitive but trims whitespace', () => {
      component.onTypedInput('inv-007');
      expect(component.approveDisabled()).toBe(true);

      component.onTypedInput('  INV-007  ');
      expect(component.approveDisabled()).toBe(false);
    });

    it('Approve emits decided with the typedConfirmation payload', () => {
      const events: { decision: string; typedConfirmation?: string }[] = [];
      component.decided.subscribe((e) => events.push(e));

      component.onTypedInput('INV-007');
      component.approve();

      expect(events.length).toBe(1);
      expect(events[0]).toEqual({ decision: 'approve', typedConfirmation: 'INV-007' });
    });

    it('approve() is a no-op when typed value does not match (defensive)', () => {
      const events: unknown[] = [];
      component.decided.subscribe((e) => events.push(e));

      component.onTypedInput('wrong');
      component.approve();

      expect(events.length).toBe(0);
    });

    it('Deny still works regardless of typed value', () => {
      const events: { decision: string }[] = [];
      component.decided.subscribe((e) => events.push(e));

      component.deny();

      expect(events.length).toBe(1);
      expect(events[0].decision).toBe('deny');
    });

    it('returns approveDisabled=true when args._expectedConfirmation is missing (defensive)', async () => {
      await setPending(
        buildPending({
          blastTier: 'TYPED_CONFIRM_WRITE',
          args: { invoiceId: 'inv-7' }, // no _expectedConfirmation
        }),
      );
      expect(component.expectedConfirmation()).toBe('');
      component.onTypedInput('anything');
      expect(component.approveDisabled()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Countdown
  // ---------------------------------------------------------------------------

  describe('countdown', () => {
    const baseNow = new Date('2026-04-26T10:00:00Z').getTime();

    beforeEach(() => {
      // Mock the clock BEFORE rebuilding the fixture so the component's `now`
      // signal (initialized at construction with `Date.now()`) is anchored to
      // the same fake clock the test ticks. The outer beforeEach already
      // created a fixture, but its `now` reflects the real wall clock — which
      // makes secondsRemaining clamp to 0 against any test-relative expiresAt.
      fixture.destroy();
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(baseNow));

      fixture = TestBed.createComponent(AssistantApprovalCardComponent);
      component = fixture.componentInstance;
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('ticks every second and re-evaluates secondsRemaining', () => {
      fixture.componentRef.setInput(
        'pendingApproval',
        buildPending({
          expiresAt: new Date(baseNow + 4 * 60 * 1000 + 32 * 1000).toISOString(),
        }),
      );
      fixture.detectChanges();

      expect(component.secondsRemaining()).toBe(4 * 60 + 32);
      expect(component.minutesPart()).toBe('4');
      expect(component.secondsPart()).toBe('32');

      jasmine.clock().tick(1000);
      // The interval fires; signal updates.
      expect(component.secondsRemaining()).toBe(4 * 60 + 31);

      jasmine.clock().tick(31_000);
      expect(component.secondsRemaining()).toBe(4 * 60);
      expect(component.secondsPart()).toBe('00');
    });
  });

  // ---------------------------------------------------------------------------
  // Expired state
  // ---------------------------------------------------------------------------

  describe('expired state', () => {
    it('disables Approve and Deny once expired', fakeAsync(() => {
      const baseNow = Date.now();
      fixture.componentRef.setInput(
        'pendingApproval',
        buildPending({ expiresAt: new Date(baseNow - 1000).toISOString() }),
      );
      fixture.detectChanges();

      expect(component.isExpired()).toBe(true);
      expect(component.approveDisabled()).toBe(true);
      expect(component.denyDisabled()).toBe(true);

      // Drain the 3s auto-dismiss timer so fakeAsync doesn't complain.
      tick(3000);
    }));

    it('emits dismissed exactly once, 3 seconds after expiry', fakeAsync(() => {
      const baseNow = Date.now();
      let dismissedCount = 0;
      fixture.componentRef.setInput(
        'pendingApproval',
        buildPending({ expiresAt: new Date(baseNow - 1000).toISOString() }),
      );
      fixture.detectChanges();
      component.dismissed.subscribe(() => dismissedCount++);

      tick(2999);
      expect(dismissedCount).toBe(0);

      tick(1);
      expect(dismissedCount).toBe(1);

      // Confirm it doesn't fire a second time.
      tick(5000);
      expect(dismissedCount).toBe(1);
    }));
  });

  // ---------------------------------------------------------------------------
  // Defensive: tier shouldn't be READ / AUTO_WRITE, but if it is...
  // ---------------------------------------------------------------------------

  describe('unexpected tiers (defensive)', () => {
    it('logs a warning when rendered with READ tier', async () => {
      const warn = spyOn(console, 'warn');
      await setPending(buildPending({ blastTier: 'READ' }));
      expect(warn).toHaveBeenCalled();
    });

    it('logs a warning when rendered with AUTO_WRITE tier', async () => {
      const warn = spyOn(console, 'warn');
      await setPending(buildPending({ blastTier: 'AUTO_WRITE' }));
      expect(warn).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Action preview (replaces JSON args display)
  // ---------------------------------------------------------------------------

  describe('action preview', () => {
    it('exposes a presenter summary keyed by tool name', async () => {
      await setPending(buildPending({ toolName: 'send_sms', args: { to: '+216123', body: 'Hello' } }));
      const s = component.summary();
      expect(s.toolName).toBe('send_sms');
      // approve verb resolves through the per-tool key
      expect(s.approveVerbKey).toContain('send_sms');
    });

    it('falls back to the default approve verb when tool is unknown', async () => {
      await setPending(buildPending({ toolName: 'unknown_tool', args: { foo: 1 } }));
      const s = component.summary();
      expect(s.previewComponent).toBeUndefined();
      expect(s.approveVerbKey).toBe('assistant.approval.approveDefault');
    });
  });
});
