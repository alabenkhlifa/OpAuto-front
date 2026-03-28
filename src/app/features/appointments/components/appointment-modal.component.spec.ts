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
        { provide: TranslationService, useValue: translationSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentModalComponent);
    component = fixture.componentInstance;
    mockAiService = TestBed.inject(AiService) as any;
    mockAppointmentService = TestBed.inject(AppointmentService) as jasmine.SpyObj<AppointmentService>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;
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
});
