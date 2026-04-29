import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MaintenanceAlertsCardComponent } from './maintenance-alerts-card.component';
import { AiService } from '../../../core/services/ai.service';
import { LanguageService } from '../../../core/services/language.service';
import { TranslationService } from '../../../core/services/translation.service';
import { AiMaintenancePrediction } from '../../../core/models/ai.model';

const mk = (over: Partial<AiMaintenancePrediction> = {}): AiMaintenancePrediction => ({
  carId: over.carId ?? 'car-1',
  carLabel: over.carLabel ?? 'Peugeot 308 · 123-TUN-4567',
  service: over.service ?? 'oil-change',
  predictedDate: over.predictedDate ?? new Date().toISOString(),
  confidence: over.confidence ?? 0.85,
  urgency: over.urgency ?? 'medium',
  reason: over.reason ?? 'Due soon',
});

const PREDICTIONS_CACHE_PREFIX = 'opauto.maintenance_predictions.';

describe('MaintenanceAlertsCardComponent', () => {
  let fixture: ComponentFixture<MaintenanceAlertsCardComponent>;
  let component: MaintenanceAlertsCardComponent;
  let aiService: jasmine.SpyObj<AiService>;
  let router: jasmine.SpyObj<Router>;
  let languageService: jasmine.SpyObj<LanguageService>;
  let translationService: jasmine.SpyObj<TranslationService>;

  beforeEach(async () => {
    // Clear localStorage between tests so cache state is isolated.
    localStorage.clear();

    aiService = jasmine.createSpyObj('AiService', ['predictMaintenance']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    languageService = jasmine.createSpyObj('LanguageService', ['getCurrentLanguage']);
    languageService.getCurrentLanguage.and.returnValue('en');
    translationService = jasmine.createSpyObj('TranslationService', ['instant'], {
      translations$: of({}),
    });
    translationService.instant.and.callFake((k: string) => k);

    await TestBed.configureTestingModule({
      imports: [MaintenanceAlertsCardComponent],
      providers: [
        { provide: AiService, useValue: aiService },
        { provide: Router, useValue: router },
        { provide: LanguageService, useValue: languageService },
        { provide: TranslationService, useValue: translationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MaintenanceAlertsCardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with empty state and has not run yet', () => {
    expect(component.hasRun()).toBe(false);
    expect(component.alerts().length).toBe(0);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('calls predictMaintenance with just language in fleet mode', () => {
    languageService.getCurrentLanguage.and.returnValue('fr');
    aiService.predictMaintenance.and.returnValue(of({ predictions: [], provider: 'template' }));

    component.refresh();

    expect(aiService.predictMaintenance).toHaveBeenCalledWith({ language: 'fr' });
  });

  it('calls predictMaintenance with carId + language in per-car mode', () => {
    component.carId = 'car-xyz';
    aiService.predictMaintenance.and.returnValue(of({ predictions: [], provider: 'template' }));

    component.refresh();

    expect(aiService.predictMaintenance).toHaveBeenCalledWith({
      carId: 'car-xyz',
      language: 'en',
    });
  });

  it('in fleet mode: filters out low urgency and caps at 5', () => {
    const predictions = [
      mk({ carId: 'h1', urgency: 'high' }),
      mk({ carId: 'h2', urgency: 'high' }),
      mk({ carId: 'h3', urgency: 'high' }),
      mk({ carId: 'm1', urgency: 'medium' }),
      mk({ carId: 'm2', urgency: 'medium' }),
      mk({ carId: 'm3', urgency: 'medium' }),
      mk({ carId: 'l1', urgency: 'low' }),
    ];
    aiService.predictMaintenance.and.returnValue(of({ predictions, provider: 'template' }));

    component.refresh();

    const visible = component.visibleAlerts();
    expect(visible.length).toBe(5);
    expect(visible.every((v) => v.urgency !== 'low')).toBe(true);
  });

  it('in per-car mode: keeps all urgency levels, no cap', () => {
    component.carId = 'car-xyz';
    const predictions = [
      mk({ carId: 'car-xyz', service: 'oil-change', urgency: 'high' }),
      mk({ carId: 'car-xyz', service: 'brake-service', urgency: 'medium' }),
      mk({ carId: 'car-xyz', service: 'tire-rotation', urgency: 'low' }),
    ];
    aiService.predictMaintenance.and.returnValue(of({ predictions, provider: 'template' }));

    component.refresh();

    const visible = component.visibleAlerts();
    expect(visible.length).toBe(3);
    expect(visible.map((v) => v.urgency)).toContain('low');
  });

  it('sets error when the service fails', () => {
    aiService.predictMaintenance.and.returnValue(
      throwError(() => ({ message: 'network down' })),
    );

    component.refresh();

    expect(component.error()).toBe('network down');
    expect(component.loading()).toBe(false);
    expect(component.hasRun()).toBe(true);
  });

  it('navigates to the car detail page on openCar', () => {
    component.openCar('car-abc');
    expect(router.navigate).toHaveBeenCalledWith(['/cars', 'car-abc']);
  });

  it('navigates to /appointments with carId + serviceType + scheduledDate on schedule', () => {
    component.schedule(mk({
      carId: 'car-abc',
      service: 'brake-service',
      predictedDate: '2026-05-15T12:00:00.000Z',
    }));
    expect(router.navigate).toHaveBeenCalledWith(
      ['/appointments'],
      {
        queryParams: {
          carId: 'car-abc',
          serviceType: 'brake-service',
          scheduledDate: '2026-05-15',
        },
      },
    );
  });

  // -------------------------------------------------------------------
  // Predictions cache (localStorage, 24h TTL, language-keyed)
  // -------------------------------------------------------------------
  describe('predictions cache', () => {
    it('ngOnInit with no cache leaves the card in idle state', () => {
      fixture.detectChanges(); // triggers ngOnInit

      expect(component.hasRun()).toBe(false);
      expect(component.alerts().length).toBe(0);
      expect(aiService.predictMaintenance).not.toHaveBeenCalled();
    });

    it('ngOnInit with a fresh same-language cache restores alerts without an API call (fleet)', () => {
      const predictions = [
        mk({ carId: 'fleet-1', urgency: 'high', service: 'oil-change' }),
        mk({ carId: 'fleet-2', urgency: 'medium', service: 'brake-service' }),
      ];
      localStorage.setItem(`${PREDICTIONS_CACHE_PREFIX}fleet`, JSON.stringify({
        savedAt: Date.now() - 60_000, // 1 minute old — fresh
        language: 'en',
        predictions,
      }));

      fixture.detectChanges(); // ngOnInit

      expect(component.hasRun()).toBe(true);
      expect(component.alerts().length).toBe(2);
      expect(component.visibleAlerts().length).toBe(2);
      expect(aiService.predictMaintenance).not.toHaveBeenCalled();
    });

    it('ngOnInit with a fresh same-language cache restores alerts in per-car mode', () => {
      component.carId = 'car-xyz';
      const predictions = [
        mk({ carId: 'car-xyz', urgency: 'high', service: 'oil-change' }),
        mk({ carId: 'car-xyz', urgency: 'low', service: 'tire-rotation' }),
      ];
      localStorage.setItem(`${PREDICTIONS_CACHE_PREFIX}car-xyz`, JSON.stringify({
        savedAt: Date.now() - 1000,
        language: 'en',
        predictions,
      }));

      fixture.detectChanges();

      expect(component.hasRun()).toBe(true);
      // Per-car mode keeps low urgency, no cap.
      expect(component.visibleAlerts().length).toBe(2);
    });

    it('ngOnInit with a stale (>24h) cache clears the entry and stays idle', () => {
      const stale = Date.now() - 25 * 60 * 60 * 1000; // 25h ago
      localStorage.setItem(`${PREDICTIONS_CACHE_PREFIX}fleet`, JSON.stringify({
        savedAt: stale,
        language: 'en',
        predictions: [mk({ urgency: 'high' })],
      }));

      fixture.detectChanges();

      expect(component.hasRun()).toBe(false);
      expect(component.alerts().length).toBe(0);
      expect(localStorage.getItem(`${PREDICTIONS_CACHE_PREFIX}fleet`)).toBeNull();
    });

    it('ngOnInit with a different-language cache clears the entry and stays idle', () => {
      languageService.getCurrentLanguage.and.returnValue('en');
      localStorage.setItem(`${PREDICTIONS_CACHE_PREFIX}fleet`, JSON.stringify({
        savedAt: Date.now() - 1000,
        language: 'fr', // different lang
        predictions: [mk({ urgency: 'high' })],
      }));

      fixture.detectChanges();

      expect(component.hasRun()).toBe(false);
      expect(component.alerts().length).toBe(0);
      expect(localStorage.getItem(`${PREDICTIONS_CACHE_PREFIX}fleet`)).toBeNull();
    });

    it('ngOnInit with malformed JSON cache clears the entry and stays idle', () => {
      localStorage.setItem(`${PREDICTIONS_CACHE_PREFIX}fleet`, '{not valid json}');

      fixture.detectChanges();

      expect(component.hasRun()).toBe(false);
      expect(localStorage.getItem(`${PREDICTIONS_CACHE_PREFIX}fleet`)).toBeNull();
    });

    it('refresh() success writes a cache entry under the fleet key', () => {
      const predictions = [mk({ carId: 'h1', urgency: 'high' })];
      aiService.predictMaintenance.and.returnValue(of({ predictions, provider: 'template' }));

      fixture.detectChanges();
      component.refresh();

      const raw = localStorage.getItem(`${PREDICTIONS_CACHE_PREFIX}fleet`);
      expect(raw).not.toBeNull();
      const entry = JSON.parse(raw!);
      expect(entry.language).toBe('en');
      expect(entry.predictions.length).toBe(1);
      expect(entry.predictions[0].carId).toBe('h1');
      expect(typeof entry.savedAt).toBe('number');
      expect(Date.now() - entry.savedAt).toBeLessThan(5_000);
    });

    it('refresh() success writes a cache entry under the per-car key', () => {
      component.carId = 'car-xyz';
      languageService.getCurrentLanguage.and.returnValue('fr');
      const predictions = [mk({ carId: 'car-xyz', urgency: 'medium' })];
      aiService.predictMaintenance.and.returnValue(of({ predictions, provider: 'template' }));

      fixture.detectChanges();
      component.refresh();

      const raw = localStorage.getItem(`${PREDICTIONS_CACHE_PREFIX}car-xyz`);
      expect(raw).not.toBeNull();
      const entry = JSON.parse(raw!);
      expect(entry.language).toBe('fr');
      expect(entry.predictions[0].carId).toBe('car-xyz');
      // Fleet key MUST NOT have been written.
      expect(localStorage.getItem(`${PREDICTIONS_CACHE_PREFIX}fleet`)).toBeNull();
    });

    it('refresh() failure does NOT overwrite an existing cache entry', () => {
      // Seed an existing fresh cache.
      const seeded = {
        savedAt: Date.now() - 1000,
        language: 'en',
        predictions: [mk({ carId: 'old', urgency: 'high' })],
      };
      localStorage.setItem(`${PREDICTIONS_CACHE_PREFIX}fleet`, JSON.stringify(seeded));

      aiService.predictMaintenance.and.returnValue(
        throwError(() => ({ message: 'network down' }))
      );

      fixture.detectChanges(); // restore from cache via ngOnInit
      component.refresh();

      const raw = localStorage.getItem(`${PREDICTIONS_CACHE_PREFIX}fleet`);
      expect(raw).not.toBeNull();
      const entry = JSON.parse(raw!);
      // Still the seeded entry — refresh failure shouldn't blow it away.
      expect(entry.predictions[0].carId).toBe('old');
      expect(component.error()).toBe('network down');
    });
  });
});
