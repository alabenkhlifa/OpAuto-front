import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AtRiskCustomersCardComponent } from './at-risk-customers-card.component';
import { AiService } from '../../../core/services/ai.service';
import { AiActionsService } from '../../../core/services/ai-actions.service';
import { LanguageService } from '../../../core/services/language.service';
import { TranslationService } from '../../../core/services/translation.service';
import { AiAction } from '../../../core/models/ai-action.model';

describe('AtRiskCustomersCardComponent', () => {
  let fixture: ComponentFixture<AtRiskCustomersCardComponent>;
  let component: AtRiskCustomersCardComponent;
  let aiService: jasmine.SpyObj<AiService>;
  let aiActionsService: jasmine.SpyObj<AiActionsService>;
  let router: jasmine.SpyObj<Router>;
  let languageService: jasmine.SpyObj<LanguageService>;
  let translationService: jasmine.SpyObj<TranslationService>;

  const buildAction = (overrides: Partial<AiAction> = {}): AiAction => ({
    id: 'act-1',
    garageId: 'g1',
    customerId: 'h1',
    kind: 'DISCOUNT_SMS',
    status: 'DRAFT',
    messageBody: 'Bonjour Ali, profitez de 10%...',
    discountKind: 'PERCENT',
    discountValue: 10,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    churnRiskSnapshot: 0.8,
    factorsSnapshot: ['120 days since last visit'],
    providerMessageId: null,
    errorMessage: null,
    approvedByUserId: null,
    redeemedInvoiceId: null,
    createdAt: new Date().toISOString(),
    approvedAt: null,
    sentAt: null,
    failedAt: null,
    redeemedAt: null,
    updatedAt: new Date().toISOString(),
    customer: {
      id: 'h1',
      firstName: 'Ali',
      lastName: 'BK',
      phone: '+216 20 123 456',
      smsOptIn: true,
    },
    ...overrides,
  });

  beforeEach(async () => {
    aiService = jasmine.createSpyObj('AiService', ['predictChurn']);
    aiActionsService = jasmine.createSpyObj('AiActionsService', ['draft', 'approve', 'skip']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    languageService = jasmine.createSpyObj('LanguageService', ['getCurrentLanguage']);
    languageService.getCurrentLanguage.and.returnValue('en');
    translationService = jasmine.createSpyObj('TranslationService', ['instant']);
    translationService.instant.and.callFake((k: string) => k);

    await TestBed.configureTestingModule({
      imports: [AtRiskCustomersCardComponent],
      providers: [
        { provide: AiService, useValue: aiService },
        { provide: AiActionsService, useValue: aiActionsService },
        { provide: Router, useValue: router },
        { provide: LanguageService, useValue: languageService },
        { provide: TranslationService, useValue: translationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AtRiskCustomersCardComponent);
    component = fixture.componentInstance;
  });

  it('initializes with empty state and has not run yet', () => {
    expect(component.hasRun()).toBe(false);
    expect(component.atRisk().length).toBe(0);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('calls predictChurn with the current language on refresh', () => {
    languageService.getCurrentLanguage.and.returnValue('fr');
    aiService.predictChurn.and.returnValue(of({ predictions: [], provider: 'template' }));

    component.refresh();

    expect(aiService.predictChurn).toHaveBeenCalledWith({ language: 'fr' });
  });

  it('filters out low-risk predictions and keeps up to 5', () => {
    const predictions = [
      { customerId: 'h1', customerName: 'High One', churnRisk: 0.9, riskLevel: 'high' as const, factors: ['x'], suggestedAction: 'call' },
      { customerId: 'h2', customerName: 'High Two', churnRisk: 0.85, riskLevel: 'high' as const, factors: ['y'], suggestedAction: 'call' },
      { customerId: 'm1', customerName: 'Med One', churnRisk: 0.5, riskLevel: 'medium' as const, factors: ['z'], suggestedAction: 'sms' },
      { customerId: 'l1', customerName: 'Low One', churnRisk: 0.1, riskLevel: 'low' as const, factors: ['fine'], suggestedAction: 'none' },
    ];
    aiService.predictChurn.and.returnValue(of({ predictions, provider: 'template' }));

    component.refresh();

    const atRisk = component.atRisk();
    expect(atRisk.length).toBe(3);
    expect(atRisk.map((p) => p.customerId)).toEqual(['h1', 'h2', 'm1']);
  });

  it('sets error when the service fails', () => {
    aiService.predictChurn.and.returnValue(throwError(() => ({ error: { message: 'boom' } })));

    component.refresh();

    expect(component.error()).toBe('boom');
    expect(component.loading()).toBe(false);
    expect(component.hasRun()).toBe(true);
  });

  it('navigates to the customer detail page on openCustomer', () => {
    component.openCustomer('abc-123');
    expect(router.navigate).toHaveBeenCalledWith(['/customers', 'abc-123']);
  });

  describe('draft action flow', () => {
    it('calls AiActionsService.draft, enters editing mode, and auto-composes the body from fields', () => {
      const action = buildAction();
      aiActionsService.draft.and.returnValue(of(action));

      component.draftAction('h1');

      expect(aiActionsService.draft).toHaveBeenCalledWith('h1');
      const draft = component.drafts()['h1'];
      expect(draft.mode).toBe('editing');
      expect(draft.bodyAutoPilot).toBe(true);
      expect(draft.editMessage).toContain('Ali');
      expect(draft.editMessage).toContain('10%');
      expect(draft.editDiscountEnabled).toBe(true);
      expect(draft.editDiscountValue).toBe(10);
    });

    it('re-composes body when discount value changes while auto-pilot is on', () => {
      const action = buildAction();
      aiActionsService.draft.and.returnValue(of(action));
      component.draftAction('h1');

      component.patchDraft('h1', { editDiscountValue: 20 });

      const draft = component.drafts()['h1'];
      expect(draft.editMessage).toContain('20%');
      expect(draft.editMessage).not.toContain('10%');
    });

    it('manual body edit turns auto-pilot off and discount changes no longer overwrite the body', () => {
      const action = buildAction();
      aiActionsService.draft.and.returnValue(of(action));
      component.draftAction('h1');

      component.onBodyInput('h1', 'Totally custom message');
      expect(component.drafts()['h1'].bodyAutoPilot).toBe(false);

      component.patchDraft('h1', { editDiscountValue: 25 });
      expect(component.drafts()['h1'].editMessage).toBe('Totally custom message');
    });

    it('resetBody re-engages auto-pilot and re-composes the body', () => {
      const action = buildAction();
      aiActionsService.draft.and.returnValue(of(action));
      component.draftAction('h1');

      component.onBodyInput('h1', 'custom');
      component.patchDraft('h1', { editDiscountValue: 30 });
      component.resetBody('h1');

      const draft = component.drafts()['h1'];
      expect(draft.bodyAutoPilot).toBe(true);
      expect(draft.editMessage).toContain('30%');
    });

    it('surfaces the backend error when drafting fails', () => {
      aiActionsService.draft.and.returnValue(
        throwError(() => ({ error: { message: 'no LLM' } })),
      );
      component.draftAction('h1');
      const draft = component.drafts()['h1'];
      expect(draft.mode).toBe('failed');
      expect(draft.error).toBe('no LLM');
    });

    it('approve sends the edited payload with discount fields', () => {
      const action = buildAction();
      aiActionsService.draft.and.returnValue(of(action));
      aiActionsService.approve.and.returnValue(of({ ...action, status: 'SENT', sentAt: new Date().toISOString() }));

      component.draftAction('h1');
      component.onBodyInput('h1', 'edited body');
      component.patchDraft('h1', { editDiscountValue: 15 });
      component.approve(action);

      expect(aiActionsService.approve).toHaveBeenCalled();
      const args = aiActionsService.approve.calls.mostRecent().args;
      expect(args[0]).toBe(action.id);
      expect(args[1]?.messageBody).toBe('edited body');
      expect(args[1]?.discountValue).toBe(15);
      expect(args[1]?.discountKind).toBe('PERCENT');
      expect(component.drafts()['h1'].mode).toBe('sent');
    });

    it('approve without discount omits discount fields', () => {
      const action = buildAction({ kind: 'REMINDER_SMS', discountKind: null, discountValue: null, expiresAt: null });
      aiActionsService.draft.and.returnValue(of(action));
      aiActionsService.approve.and.returnValue(of({ ...action, status: 'SENT' }));

      component.draftAction('h1');
      component.patchDraft('h1', { editDiscountEnabled: false });
      component.approve(action);

      const args = aiActionsService.approve.calls.mostRecent().args;
      expect(args[1]?.discountValue).toBeUndefined();
      expect(args[1]?.discountKind).toBeUndefined();
    });

    it('marks sent → failed when backend returns FAILED', () => {
      const action = buildAction();
      aiActionsService.draft.and.returnValue(of(action));
      aiActionsService.approve.and.returnValue(of({ ...action, status: 'FAILED', errorMessage: 'provider down' }));

      component.draftAction('h1');
      component.approve(action);

      const draft = component.drafts()['h1'];
      expect(draft.mode).toBe('failed');
      expect(draft.error).toBe('provider down');
    });

    it('closeDraft removes the panel', () => {
      aiActionsService.draft.and.returnValue(of(buildAction()));
      component.draftAction('h1');
      component.closeDraft('h1');
      expect(component.drafts()['h1']).toBeUndefined();
    });

    it('skip dismisses the draft when service succeeds', () => {
      const action = buildAction();
      aiActionsService.draft.and.returnValue(of(action));
      aiActionsService.skip.and.returnValue(of({ ...action, status: 'SKIPPED' }));

      component.draftAction('h1');
      component.skip(action);

      expect(aiActionsService.skip).toHaveBeenCalledWith(action.id);
      expect(component.drafts()['h1']).toBeUndefined();
    });
  });
});
