import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AtRiskCustomersCardComponent } from './at-risk-customers-card.component';
import { AiService } from '../../../core/services/ai.service';
import { LanguageService } from '../../../core/services/language.service';
import { TranslationService } from '../../../core/services/translation.service';

describe('AtRiskCustomersCardComponent', () => {
  let fixture: ComponentFixture<AtRiskCustomersCardComponent>;
  let component: AtRiskCustomersCardComponent;
  let aiService: jasmine.SpyObj<AiService>;
  let router: jasmine.SpyObj<Router>;
  let languageService: jasmine.SpyObj<LanguageService>;
  let translationService: jasmine.SpyObj<TranslationService>;

  beforeEach(async () => {
    aiService = jasmine.createSpyObj('AiService', ['predictChurn']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    languageService = jasmine.createSpyObj('LanguageService', ['getCurrentLanguage']);
    languageService.getCurrentLanguage.and.returnValue('en');
    translationService = jasmine.createSpyObj('TranslationService', ['instant']);
    translationService.instant.and.callFake((k: string) => k);

    await TestBed.configureTestingModule({
      imports: [AtRiskCustomersCardComponent],
      providers: [
        { provide: AiService, useValue: aiService },
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
});
