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

describe('MaintenanceAlertsCardComponent', () => {
  let fixture: ComponentFixture<MaintenanceAlertsCardComponent>;
  let component: MaintenanceAlertsCardComponent;
  let aiService: jasmine.SpyObj<AiService>;
  let router: jasmine.SpyObj<Router>;
  let languageService: jasmine.SpyObj<LanguageService>;
  let translationService: jasmine.SpyObj<TranslationService>;

  beforeEach(async () => {
    aiService = jasmine.createSpyObj('AiService', ['predictMaintenance']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    languageService = jasmine.createSpyObj('LanguageService', ['getCurrentLanguage']);
    languageService.getCurrentLanguage.and.returnValue('en');
    translationService = jasmine.createSpyObj('TranslationService', ['instant']);
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
});
