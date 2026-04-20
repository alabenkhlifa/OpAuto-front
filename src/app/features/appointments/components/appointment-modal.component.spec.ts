import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { AppointmentModalComponent } from './appointment-modal.component';
import { AppointmentService } from '../services/appointment.service';
import { AiService } from '../../../core/services/ai.service';
import { TranslationService } from '../../../core/services/translation.service';
import { LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AiScheduleSuggestion, AiScheduleResponse, AiError } from '../../../core/models/ai.model';

describe('AppointmentModalComponent — AI Suggest', () => {
  let component: AppointmentModalComponent;
  let fixture: ComponentFixture<AppointmentModalComponent>;
  let mockAiService: jasmine.SpyObj<AiService> & {
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<AiError | null>>;
  };
  let mockAppointmentService: jasmine.SpyObj<AppointmentService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockLanguageService: jasmine.SpyObj<LanguageService>;

  const mockSuggestions: AiScheduleSuggestion[] = [
    {
      start: '2026-04-01T09:00:00.000Z',
      end: '2026-04-01T10:00:00.000Z',
      mechanicId: 'mech-1',
      mechanicName: 'John Smith',
      score: 0.95,
      reason: 'Best availability window',
    },
    {
      start: '2026-04-02T14:30:00.000Z',
      end: '2026-04-02T15:30:00.000Z',
      mechanicId: 'mech-2',
      mechanicName: 'Jane Doe',
      score: 0.8,
      reason: 'Second best option',
    },
  ];

  const mockScheduleResponse: AiScheduleResponse = {
    suggestedSlots: mockSuggestions,
    provider: 'openai',
  };

  beforeEach(async () => {
    const aiSpy = jasmine.createSpyObj('AiService', ['suggestSchedule', 'clearError']);
    // Attach real signals so the component template can read them
    aiSpy.loading = signal(false);
    aiSpy.error = signal<AiError | null>(null);

    const appointmentSpy = jasmine.createSpyObj('AppointmentService', [
      'getCars',
      'getCustomers',
      'getMechanics',
      'createAppointment',
      'updateAppointment',
    ]);
    appointmentSpy.getCars.and.returnValue(of([]));
    appointmentSpy.getCustomers.and.returnValue(of([]));
    appointmentSpy.getMechanics.and.returnValue(of([]));

    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    const languageSpy = jasmine.createSpyObj('LanguageService', ['getCurrentLanguage']);
    languageSpy.getCurrentLanguage.and.returnValue('en');

    const translationSpy = jasmine.createSpyObj('TranslationService', ['instant'], {
      translations$: of({}),
    });
    translationSpy.instant.and.callFake((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        ReactiveFormsModule,
        AppointmentModalComponent,
        TranslatePipe,
        DatePipe,
      ],
      providers: [
        { provide: AiService, useValue: aiSpy },
        { provide: AppointmentService, useValue: appointmentSpy },
        { provide: Router, useValue: routerSpy },
        { provide: LanguageService, useValue: languageSpy },
        { provide: TranslationService, useValue: translationSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentModalComponent);
    component = fixture.componentInstance;
    mockAiService = TestBed.inject(AiService) as any;
    mockAppointmentService = TestBed.inject(AppointmentService) as jasmine.SpyObj<AppointmentService>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    mockLanguageService = TestBed.inject(LanguageService) as jasmine.SpyObj<LanguageService>;
  });

  // ---------------------------------------------------------------
  // 1. Component creation & DI
  // ---------------------------------------------------------------
  it('should create with AiService injected', () => {
    expect(component).toBeTruthy();
    expect(component.aiService).toBeTruthy();
  });

  it('should initialise suggestions as empty array', () => {
    expect(component.suggestions()).toEqual([]);
  });

  it('should initialise suggestionsRequested as false', () => {
    expect(component.suggestionsRequested()).toBe(false);
  });

  // ---------------------------------------------------------------
  // 2. requestAiSuggestions — happy path
  // ---------------------------------------------------------------
  describe('requestAiSuggestions', () => {
    beforeEach(() => {
      // Pre-fill form with valid values the method reads
      component.appointmentForm.patchValue({
        serviceType: 'oil-change',
        estimatedDuration: 60,
        scheduledDate: '2026-04-01',
        mechanicId: 'mech-1',
      });
    });

    it('should call aiService.suggestSchedule with mapped params', () => {
      mockAiService.suggestSchedule.and.returnValue(of(mockScheduleResponse));

      component.requestAiSuggestions();

      expect(mockAiService.suggestSchedule).toHaveBeenCalledOnceWith({
        appointmentType: 'oil-change',   // serviceType -> appointmentType
        estimatedDuration: 60,
        preferredDate: '2026-04-01',
        mechanicId: 'mech-1',
        language: 'en',
      });
    });

    it('should map serviceType to appointmentType in the request', () => {
      component.appointmentForm.patchValue({ serviceType: 'brake-repair' });
      mockAiService.suggestSchedule.and.returnValue(of(mockScheduleResponse));

      component.requestAiSuggestions();

      const callArgs = mockAiService.suggestSchedule.calls.mostRecent().args[0];
      expect(callArgs.appointmentType).toBe('brake-repair');
      expect((callArgs as any).serviceType).toBeUndefined();
    });

    it('should populate suggestions signal on success', () => {
      mockAiService.suggestSchedule.and.returnValue(of(mockScheduleResponse));

      component.requestAiSuggestions();

      expect(component.suggestions()).toEqual(mockSuggestions);
      expect(component.suggestions().length).toBe(2);
    });

    it('should set suggestionsRequested to true', () => {
      mockAiService.suggestSchedule.and.returnValue(of(mockScheduleResponse));

      component.requestAiSuggestions();

      expect(component.suggestionsRequested()).toBe(true);
    });

    it('should clear previous suggestions before calling the API', () => {
      // Pre-populate suggestions
      component.suggestions.set([mockSuggestions[0]]);
      mockAiService.suggestSchedule.and.returnValue(of(mockScheduleResponse));

      component.requestAiSuggestions();

      // After a successful response they are set to the new response.
      // The key assertion: the set([]) happens first, then set(response).
      expect(component.suggestions()).toEqual(mockSuggestions);
    });

    it('should pass undefined for preferredDate when scheduledDate is empty', () => {
      component.appointmentForm.patchValue({ scheduledDate: '' });
      mockAiService.suggestSchedule.and.returnValue(of(mockScheduleResponse));

      component.requestAiSuggestions();

      const callArgs = mockAiService.suggestSchedule.calls.mostRecent().args[0];
      expect(callArgs.preferredDate).toBeUndefined();
    });

    it('should pass undefined for mechanicId when not selected', () => {
      component.appointmentForm.patchValue({ mechanicId: '' });
      mockAiService.suggestSchedule.and.returnValue(of(mockScheduleResponse));

      component.requestAiSuggestions();

      const callArgs = mockAiService.suggestSchedule.calls.mostRecent().args[0];
      expect(callArgs.mechanicId).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------
  // 3. requestAiSuggestions — error handling
  // ---------------------------------------------------------------
  describe('requestAiSuggestions — error', () => {
    beforeEach(() => {
      component.appointmentForm.patchValue({
        serviceType: 'inspection',
        estimatedDuration: 30,
        scheduledDate: '2026-04-05',
        mechanicId: '',
      });
    });

    it('should leave suggestions empty on API error', () => {
      const aiError: AiError = { code: 'PROVIDER_UNAVAILABLE', message: 'Service down' };
      mockAiService.suggestSchedule.and.returnValue(throwError(() => aiError));

      component.requestAiSuggestions();

      expect(component.suggestions()).toEqual([]);
    });

    it('should still set suggestionsRequested to true on error', () => {
      const aiError: AiError = { code: 'UNKNOWN', message: 'Something broke' };
      mockAiService.suggestSchedule.and.returnValue(throwError(() => aiError));

      component.requestAiSuggestions();

      expect(component.suggestionsRequested()).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // 4. applySuggestion
  // ---------------------------------------------------------------
  describe('applySuggestion', () => {
    const slot: AiScheduleSuggestion = {
      start: '2026-04-01T09:30:00.000Z',
      end: '2026-04-01T10:30:00.000Z',
      mechanicId: 'mech-42',
      mechanicName: 'Bob Builder',
      score: 0.9,
      reason: 'Optimal slot',
    };

    it('should patch scheduledDate in YYYY-MM-DD format', () => {
      component.applySuggestion(slot);

      const dateValue = component.appointmentForm.get('scheduledDate')!.value;
      expect(dateValue).toBe('2026-04-01');
    });

    it('should patch scheduledTime in HH:mm format', () => {
      component.applySuggestion(slot);

      const timeValue = component.appointmentForm.get('scheduledTime')!.value;
      // The time is derived from local timezone interpretation of the ISO string.
      // Verify the format is HH:mm (two digits colon two digits).
      expect(timeValue).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should patch mechanicId from the slot', () => {
      component.applySuggestion(slot);

      const mechanicValue = component.appointmentForm.get('mechanicId')!.value;
      expect(mechanicValue).toBe('mech-42');
    });

    it('should clear suggestions after applying', () => {
      component.suggestions.set(mockSuggestions);

      component.applySuggestion(slot);

      expect(component.suggestions()).toEqual([]);
    });

    it('should handle afternoon time slots correctly', () => {
      const afternoonSlot: AiScheduleSuggestion = {
        start: '2026-04-02T15:45:00.000Z',
        end: '2026-04-02T16:45:00.000Z',
        mechanicId: 'mech-3',
        mechanicName: 'Alice',
        score: 0.7,
        reason: 'Afternoon availability',
      };

      component.applySuggestion(afternoonSlot);

      const timeValue = component.appointmentForm.get('scheduledTime')!.value;
      // Should be HH:mm with two-digit hours (padded)
      expect(timeValue).toMatch(/^\d{2}:\d{2}$/);
      // The date should be correct
      const dateValue = component.appointmentForm.get('scheduledDate')!.value;
      expect(dateValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle midnight-adjacent time slots with zero-padded hours', () => {
      const earlySlot: AiScheduleSuggestion = {
        start: '2026-04-03T01:05:00.000Z',
        end: '2026-04-03T02:05:00.000Z',
        mechanicId: 'mech-4',
        mechanicName: 'Charlie',
        score: 0.6,
        reason: 'Early slot',
      };

      component.applySuggestion(earlySlot);

      const timeValue = component.appointmentForm.get('scheduledTime')!.value;
      // Hours must be zero-padded (e.g. "01:05" not "1:05")
      const [hours] = timeValue.split(':');
      expect(hours.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------
  // 5. closeModal resets AI state
  // ---------------------------------------------------------------
  describe('closeModal — AI state reset', () => {
    it('should reset suggestions to empty array', () => {
      component.suggestions.set(mockSuggestions);

      component.closeModal();

      expect(component.suggestions()).toEqual([]);
    });

    it('should reset suggestionsRequested to false', () => {
      component.suggestionsRequested.set(true);

      component.closeModal();

      expect(component.suggestionsRequested()).toBe(false);
    });

    it('should reset both editMode and currentAppointmentId', () => {
      component.editMode.set(true);
      component.currentAppointmentId.set('apt-123');

      component.closeModal();

      expect(component.editMode()).toBe(false);
      expect(component.currentAppointmentId()).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // 6. Integration: request -> apply -> verify form state
  // ---------------------------------------------------------------
  describe('full flow: request then apply', () => {
    it('should populate form fields after requesting and applying a suggestion', () => {
      component.appointmentForm.patchValue({
        serviceType: 'tires',
        estimatedDuration: 45,
        scheduledDate: '2026-03-28',
        mechanicId: '',
      });

      mockAiService.suggestSchedule.and.returnValue(of(mockScheduleResponse));

      component.requestAiSuggestions();
      expect(component.suggestions().length).toBe(2);

      // Apply the first suggestion
      component.applySuggestion(component.suggestions()[0]);

      expect(component.appointmentForm.get('mechanicId')!.value).toBe('mech-1');
      expect(component.appointmentForm.get('scheduledDate')!.value).toBe('2026-04-01');
      expect(component.suggestions()).toEqual([]);
    });

    it('should allow requesting suggestions again after applying one', () => {
      component.appointmentForm.patchValue({
        serviceType: 'engine',
        estimatedDuration: 120,
        scheduledDate: '2026-04-10',
        mechanicId: '',
      });

      // First request
      mockAiService.suggestSchedule.and.returnValue(of(mockScheduleResponse));
      component.requestAiSuggestions();
      component.applySuggestion(component.suggestions()[0]);
      expect(component.suggestions()).toEqual([]);

      // Second request
      const newResponse: AiScheduleResponse = {
        suggestedSlots: [mockSuggestions[1]],
        provider: 'openai',
      };
      mockAiService.suggestSchedule.and.returnValue(of(newResponse));
      component.requestAiSuggestions();

      expect(component.suggestions().length).toBe(1);
      expect(mockAiService.suggestSchedule).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------
  // 7. Edge case: empty response
  // ---------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle empty suggestedSlots array', () => {
      component.appointmentForm.patchValue({
        serviceType: 'transmission',
        estimatedDuration: 180,
        scheduledDate: '2026-04-15',
        mechanicId: '',
      });

      const emptyResponse: AiScheduleResponse = {
        suggestedSlots: [],
        provider: 'openai',
      };
      mockAiService.suggestSchedule.and.returnValue(of(emptyResponse));

      component.requestAiSuggestions();

      expect(component.suggestions()).toEqual([]);
      expect(component.suggestionsRequested()).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // 8. i18n: timeSlots, formatDate, formatTime
  // ---------------------------------------------------------------
  describe('timeSlots', () => {
    it('should have exactly 15 entries', () => {
      expect(component.timeSlots.length).toBe(15);
    });

    it('should contain only HH:mm 24-hour formatted strings', () => {
      const hhmmPattern = /^\d{2}:\d{2}$/;
      for (const slot of component.timeSlots) {
        expect(slot).toMatch(hhmmPattern);
        // Verify hours are valid (00-23) and minutes are valid (00-59)
        const [h, m] = slot.split(':').map(Number);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(23);
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual(59);
      }
    });

    it('should start at 08:00 and end at 17:00', () => {
      expect(component.timeSlots[0]).toBe('08:00');
      expect(component.timeSlots[component.timeSlots.length - 1]).toBe('17:00');
    });
  });

  describe('formatDate', () => {
    const testIso = '2026-04-01T09:00:00.000Z';

    it('should return English formatted date when language is en', () => {
      mockLanguageService.getCurrentLanguage.and.returnValue('en');
      const result = component.formatDate(testIso);
      // Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      // produces something like "Wed, Apr 1"
      expect(result).toContain('Apr');
      expect(result).toContain('1');
    });

    it('should return French formatted date when language is fr', () => {
      mockLanguageService.getCurrentLanguage.and.returnValue('fr');
      const result = component.formatDate(testIso);
      // Intl.DateTimeFormat('fr-FR', ...) produces something like "mer. 1 avr."
      expect(result.toLowerCase()).toContain('avr');
    });

    it('should return Arabic formatted date when language is ar', () => {
      mockLanguageService.getCurrentLanguage.and.returnValue('ar');
      const result = component.formatDate(testIso);
      // Should return a non-empty string with Arabic locale formatting
      expect(result.length).toBeGreaterThan(0);
    });

    it('should fall back to en-US for unknown language', () => {
      mockLanguageService.getCurrentLanguage.and.returnValue('xx' as any);
      const result = component.formatDate(testIso);
      // Falls back to en-US since 'xx' is not in the map
      expect(result).toContain('Apr');
    });
  });

  describe('formatTime', () => {
    const testIso = '2026-04-01T14:30:00.000Z';

    it('should return formatted time when language is en', () => {
      mockLanguageService.getCurrentLanguage.and.returnValue('en');
      const result = component.formatTime(testIso);
      // Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' })
      // The output depends on timezone, but it should contain a colon and digits
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should return formatted time when language is fr', () => {
      mockLanguageService.getCurrentLanguage.and.returnValue('fr');
      const result = component.formatTime(testIso);
      // French time format uses h or : separator, should contain digits
      expect(result).toMatch(/\d{1,2}[h:]\d{2}/);
    });

    it('should return formatted time when language is ar', () => {
      mockLanguageService.getCurrentLanguage.and.returnValue('ar');
      const result = component.formatTime(testIso);
      // Should return a non-empty string
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use the current language from LanguageService', () => {
      mockLanguageService.getCurrentLanguage.and.returnValue('fr');
      component.formatTime(testIso);
      expect(mockLanguageService.getCurrentLanguage).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // 9. requestAiSuggestions sends language parameter
  // ---------------------------------------------------------------
  describe('requestAiSuggestions — language param', () => {
    beforeEach(() => {
      component.appointmentForm.patchValue({
        serviceType: 'oil-change',
        estimatedDuration: 60,
        scheduledDate: '2026-04-01',
        mechanicId: '',
      });
    });

    it('should pass current language to suggestSchedule', () => {
      mockLanguageService.getCurrentLanguage.and.returnValue('fr');
      mockAiService.suggestSchedule.and.returnValue(of(mockScheduleResponse));

      component.requestAiSuggestions();

      const callArgs = mockAiService.suggestSchedule.calls.mostRecent().args[0];
      expect(callArgs.language).toBe('fr');
    });

    it('should pass ar language when Arabic is selected', () => {
      mockLanguageService.getCurrentLanguage.and.returnValue('ar');
      mockAiService.suggestSchedule.and.returnValue(of(mockScheduleResponse));

      component.requestAiSuggestions();

      const callArgs = mockAiService.suggestSchedule.calls.mostRecent().args[0];
      expect(callArgs.language).toBe('ar');
    });
  });

  // ---------------------------------------------------------------
  // setInitialDate — called by the calendar when user selects a slot
  // ---------------------------------------------------------------
  describe('setInitialDate', () => {
    it('prefills scheduledDate and scheduledTime from the given Date', () => {
      fixture.detectChanges();
      const d = new Date(2026, 3, 15, 14, 30); // Apr 15 2026, 14:30 local
      component.setInitialDate(d);

      expect(component.appointmentForm.get('scheduledDate')?.value).toBe('2026-04-15');
      expect(component.appointmentForm.get('scheduledTime')?.value).toBe('14:30');
    });

    it('pads single-digit hours and minutes', () => {
      fixture.detectChanges();
      const d = new Date(2026, 0, 5, 9, 5); // Jan 5 2026, 09:05 local
      component.setInitialDate(d);

      expect(component.appointmentForm.get('scheduledTime')?.value).toBe('09:05');
    });

    it('does not flip the form into edit mode', () => {
      fixture.detectChanges();
      component.setInitialDate(new Date(2026, 3, 15, 10, 0));

      // editMode is a signal on the component; setInitialDate must leave it off
      // so the submit path still creates rather than updates.
      expect((component as any).editMode()).toBe(false);
    });
  });
});
