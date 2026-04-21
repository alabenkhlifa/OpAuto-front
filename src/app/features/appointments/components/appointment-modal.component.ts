import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AppointmentService } from '../services/appointment.service';
import { Appointment, Car, Customer, Mechanic } from '../../../core/models/appointment.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AiService } from '../../../core/services/ai.service';
import { AiScheduleSuggestion } from '../../../core/models/ai.model';
import { CarRegistrationFormComponent } from '../../cars/components/car-registration-form.component';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../shared/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-appointment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe, CarRegistrationFormComponent],
  template: `
    <!-- Modal Overlay -->
    <div class="modal-overlay" (click)="closeModal()">
      <!-- Modal Content -->
      <div class="modal-content" (click)="$event.stopPropagation()">
        
        <!-- Modal Header -->
        <header class="modal-header">
          <div class="modal-title-section">
            <h2 class="modal-title">{{ editMode() ? ('appointments.edit' | translate) : ('appointments.new' | translate) }} {{ 'appointments.title' | translate }}</h2>
            <p class="modal-subtitle">{{ 'appointments.scheduleServiceAppointment' | translate }}</p>
          </div>
          <button class="modal-close-btn" (click)="closeModal()">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <!-- Modal Body -->
        <form [formGroup]="appointmentForm" class="modal-form">
          
          <!-- Car Selection -->
          <div class="form-section">
            <h3 class="section-title">{{ 'appointments.vehicleInformation' | translate }}</h3>
            <div class="form-row car-selection-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ 'appointments.car' | translate }}</label>
                <select class="form-select" formControlName="carId">
                  <option value="">{{ 'appointments.selectCar' | translate }}</option>
                  @for (car of cars(); track car.id) {
                    <option [value]="car.id">{{ car.make }} {{ car.model }} - {{ car.licensePlate }}</option>
                  }
                </select>
              </div>
              <button type="button" class="quick-add-btn" [title]="'appointments.quickAddCar' | translate" (click)="openQuickAddCar()">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Service Details -->
          <div class="form-section">
            <h3 class="section-title">{{ 'appointments.serviceDetails' | translate }}</h3>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ 'appointments.serviceType' | translate }}</label>
                <select class="form-select" formControlName="serviceType">
                  <option value="">{{ 'appointments.selectService' | translate }}</option>
                  <option value="oil-change">{{ 'appointments.oilChange' | translate }}</option>
                  <option value="brake-repair">{{ 'appointments.brakeRepair' | translate }}</option>
                  <option value="inspection">{{ 'appointments.inspection' | translate }}</option>
                  <option value="transmission">{{ 'appointments.transmission' | translate }}</option>
                  <option value="engine">{{ 'appointments.engineWork' | translate }}</option>
                  <option value="tires">{{ 'appointments.tireService' | translate }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">{{ 'appointments.durationMin' | translate }}</label>
                <input type="number" class="form-input" formControlName="estimatedDuration" min="15" max="480" step="15">
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">{{ 'appointments.serviceName' | translate }}</label>
              <input type="text" class="form-input" formControlName="serviceName" [placeholder]="'appointments.serviceNamePlaceholder' | translate">
            </div>
          </div>

          <!-- Schedule Details -->
          <div class="form-section">
            <h3 class="section-title">{{ 'appointments.schedule' | translate }}</h3>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ 'appointments.date' | translate }}</label>
                <input type="date" class="form-input" formControlName="scheduledDate">
              </div>
              <div class="form-group">
                <label class="form-label">{{ 'appointments.time' | translate }}</label>
                <select class="form-select" formControlName="scheduledTime">
                  <option value="">{{ 'appointments.selectTime' | translate }}</option>
                  @for (slot of timeSlots; track slot) {
                    <option [value]="slot">{{ slot }}</option>
                  }
                </select>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ 'appointments.assignedMechanic' | translate }}</label>
                <select class="form-select" formControlName="mechanicId">
                  <option value="">{{ 'appointments.autoAssign' | translate }}</option>
                  @for (mechanic of mechanics(); track mechanic.id) {
                    <option [value]="mechanic.id">{{ mechanic.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">{{ 'appointments.priority' | translate }}</label>
                <select class="form-select" formControlName="priority">
                  <option value="low">{{ 'appointments.low' | translate }}</option>
                  <option value="medium">{{ 'appointments.medium' | translate }}</option>
                  <option value="high">{{ 'appointments.high' | translate }}</option>
                </select>
              </div>
            </div>

            <!-- AI Suggest -->
            <div class="ai-suggest-section">
              <button type="button" class="btn-ai btn-ai--block"
                      [disabled]="!appointmentForm.get('serviceType')?.value || !appointmentForm.get('estimatedDuration')?.value || aiService.loading()"
                      (click)="requestAiSuggestions()">
                @if (aiService.loading()) {
                  <span class="btn-ai__spinner"></span>
                  {{ 'appointments.aiSuggest.loading' | translate }}
                } @else {
                  <svg style="width:1rem;height:1rem;flex-shrink:0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  {{ 'appointments.aiSuggest.button' | translate }}
                }
              </button>

              @if (aiService.error(); as error) {
                <p class="ai-error">
                  @if (error.code === 'PROVIDER_UNAVAILABLE') {
                    {{ 'appointments.aiSuggest.errorUnavailable' | translate }}
                  } @else {
                    {{ 'appointments.aiSuggest.errorGeneric' | translate }}
                  }
                </p>
              }

              @if (suggestions().length > 0) {
                <div class="ai-suggestions">
                  @for (slot of suggestions(); track slot.start) {
                    <button type="button" class="suggestion-card" [class.has-warning]="slot.warning" (click)="onSuggestionClick(slot)">
                      @if (slot.warning) {
                        <span class="suggestion-warning">⚠ {{ translationService.instant('calendar.toast.duringLunchBreak') }}</span>
                      }
                      <div class="suggestion-header">
                        <span class="suggestion-date">{{ formatDate(slot.start) }}</span>
                        <span class="suggestion-score" [style.opacity]="slot.score">●</span>
                      </div>
                      <span class="suggestion-time">{{ formatTime(slot.start) }} – {{ formatTime(slot.end) }}</span>
                      <span class="suggestion-mechanic">{{ slot.mechanicName }}</span>
                      <span class="suggestion-reason">{{ slot.reason }}</span>
                    </button>
                  }
                </div>
              }

              @if (suggestions().length === 0 && !aiService.loading() && !aiService.error() && suggestionsRequested()) {
                <p class="ai-no-slots">{{ 'appointments.aiSuggest.noSlots' | translate }}</p>
              }
            </div>
          </div>

          <!-- Notes -->
          <div class="form-section">
            <div class="form-group">
              <label class="form-label">{{ 'appointments.notesOptional' | translate }}</label>
              <textarea class="form-textarea" formControlName="notes" 
                       [placeholder]="'appointments.additionalNotes' | translate"
                       rows="3"></textarea>
            </div>
          </div>

        </form>

        <!-- Modal Footer -->
        <footer class="modal-footer">
          <button type="button" class="modal-btn secondary" (click)="closeModal()">
            {{ 'appointments.cancel' | translate }}
          </button>
          <button type="button" class="modal-btn primary" 
                  [disabled]="!appointmentForm.valid || isSubmitting()"
                  (click)="saveAppointment()">
            <span *ngIf="!isSubmitting()">{{ editMode() ? ('appointments.update' | translate) : ('appointments.schedule' | translate) }} {{ 'appointments.title' | translate }}</span>
            <span *ngIf="isSubmitting()" class="flex items-center gap-2">
              <div class="submit-spinner"></div>
              {{ 'appointments.saving' | translate }}
            </span>
          </button>
        </footer>

      </div>
    </div>

    <!-- Car Registration Modal -->
    <app-car-registration-form
      *ngIf="showCarModal()"
      (close)="showCarModal.set(false)"
      (carRegistered)="onCarRegistered($event)">
    </app-car-registration-form>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: overlayFadeIn 0.2s ease-out;
    }
    @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }

    .modal-content {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.15);
      animation: modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes modalSlideIn {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 2rem 2rem 1rem 2rem;
      border-bottom: 1px solid #e2e8f0;
    }
    .modal-title { font-size: 1.5rem; font-weight: 700; color: #111827; margin: 0 0 0.25rem 0; }
    .modal-subtitle { color: #6b7280; font-size: 0.875rem; margin: 0; }

    .modal-close-btn {
      width: 2.5rem; height: 2.5rem; border: none;
      background: #f3f4f6; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #6b7280; transition: all 0.2s ease;
    }
    .modal-close-btn:hover { background: #e5e7eb; color: #111827; }

    .modal-form { padding: 2rem; }
    .form-section { margin-bottom: 2rem; }

    .section-title {
      font-size: 1.125rem; font-weight: 600; color: #111827;
      margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;
    }
    .section-title:before {
      content: ''; width: 4px; height: 1.5rem;
      background: linear-gradient(135deg, #FF8400, #CC6A00); border-radius: 2px;
    }

    .form-row { display: flex; gap: 1rem; align-items: flex-end; }
    .car-selection-row { align-items: flex-end; }
    .car-selection-row .form-group { margin-bottom: 0; }
    .car-selection-row .quick-add-btn { width: 3.125rem; height: 3.125rem; margin-bottom: 0; flex-shrink: 0; align-self: flex-end; }

    @media (max-width: 767px) {
      .form-row { flex-direction: column; align-items: stretch; }
      .car-selection-row { flex-direction: row !important; align-items: end !important; }
    }

    .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
    .form-label { font-size: 0.875rem; font-weight: 500; color: #374151; }

    .form-input, .form-select, .form-textarea {
      padding: 0.875rem 1rem; border: 1px solid #d1d5db; border-radius: 12px;
      background: #ffffff; color: #111827; font-size: 0.875rem; transition: all 0.2s ease;
    }
    .form-input::placeholder, .form-textarea::placeholder { color: #9ca3af; }
    .form-input:focus, .form-select:focus, .form-textarea:focus {
      outline: none; border-color: #FF8400; box-shadow: 0 0 0 3px rgba(255, 132, 0, 0.15);
    }
    .form-input:hover:not(:focus), .form-select:hover:not(:focus), .form-textarea:hover:not(:focus) {
      border-color: #9ca3af;
    }

    .form-select {
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 0.75rem center; background-repeat: no-repeat;
      background-size: 1.5em 1.5em; padding-right: 2.5rem;
      -webkit-appearance: none; -moz-appearance: none; appearance: none;
    }

    .form-input[type="date"] {
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.5'%3e%3cpath d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'/%3e%3c/svg%3e");
      background-position: right 0.75rem center; background-repeat: no-repeat;
      background-size: 1.25em 1.25em; padding-right: 2.5rem;
    }
    .form-input[type="date"]::-webkit-calendar-picker-indicator {
      opacity: 0; position: absolute; left: 0; top: 0; width: 100%; height: 100%; cursor: pointer; margin: 0; padding: 0;
    }

    .quick-add-btn {
      width: 3.125rem; height: 3.125rem;
      border: 1px dashed #d1d5db; background: transparent; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: #6b7280; transition: all 0.2s ease; flex-shrink: 0;
    }
    .quick-add-btn:hover { border-color: #FF8400; border-style: solid; color: #FF8400; background: rgba(255, 132, 0, 0.08); }

    .modal-footer {
      display: flex; gap: 1rem; padding: 1.5rem 2rem 2rem 2rem; border-top: 1px solid #e2e8f0;
    }
    @media (max-width: 767px) { .modal-footer { flex-direction: column; } }

    .modal-btn {
      flex: 1; padding: 1rem 1.5rem; border-radius: 12px; font-weight: 600;
      cursor: pointer; transition: all 0.2s ease;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    }
    .modal-btn.secondary { background: #f3f4f6; border: 1px solid #d1d5db; color: #374151; }
    .modal-btn.secondary:hover { background: #e5e7eb; border-color: #9ca3af; }
    .modal-btn.primary {
      background: linear-gradient(135deg, #FF8400, #E67700); border: 1px solid #FF8400;
      color: white; box-shadow: 0 4px 15px rgba(255, 132, 0, 0.3);
    }
    .modal-btn.primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #E67700, #CC6A00); box-shadow: 0 6px 20px rgba(255, 132, 0, 0.4);
    }
    .modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .submit-spinner {
      width: 1rem; height: 1rem;
      border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid white;
      border-radius: 50%; animation: spin 1s linear infinite;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    .modal-content::-webkit-scrollbar { width: 6px; }
    .modal-content::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
    .modal-content::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .modal-content::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

    .ai-suggest-section { margin-top: 1rem; }
    /* AI button + spinner styles moved to global /src/styles/buttons.css
       (.btn-ai / .btn-ai--block / .btn-ai__spinner) for reuse across every
       AI-triggered button in the app. */
    .ai-error {
      margin-top: 0.5rem; padding: 0.5rem 0.75rem;
      background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 8px; color: #dc2626; font-size: 0.8rem;
    }
    .ai-no-slots { margin-top: 0.5rem; padding: 0.5rem 0.75rem; color: #6b7280; font-size: 0.8rem; text-align: center; }

    .ai-suggestions { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem; }
    .suggestion-card {
      display: flex; flex-direction: column; gap: 0.25rem;
      padding: 0.75rem 1rem; background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 12px; cursor: pointer; transition: all 0.2s ease; text-align: left; color: #111827;
    }
    .suggestion-card:hover { background: rgba(139, 92, 246, 0.06); border-color: rgba(139, 92, 246, 0.3); }
    .suggestion-card.has-warning { background: #fffbeb; border-color: #fde68a; }
    .suggestion-card.has-warning:hover { background: #fef3c7; border-color: #fbbf24; }
    .suggestion-warning {
      font-size: 0.65rem; font-weight: 600; color: #b45309; background: #fef3c7;
      padding: 0.1rem 0.4rem; border-radius: 4px; display: inline-block;
    }
    .suggestion-header { display: flex; justify-content: space-between; align-items: center; }
    .suggestion-date { font-weight: 600; font-size: 0.875rem; }
    .suggestion-score { color: #8b5cf6; font-size: 1.25rem; }
    .suggestion-time { color: #6b7280; font-size: 0.8rem; }
    .suggestion-mechanic { color: #7c3aed; font-size: 0.8rem; font-weight: 500; }
    .suggestion-reason { color: #6b7280; font-size: 0.75rem; font-style: italic; }
  `]
})
export class AppointmentModalComponent {
  private fb = inject(FormBuilder);
  private appointmentService = inject(AppointmentService);
  private router = inject(Router);
  aiService = inject(AiService);
  private languageService = inject(LanguageService);
  private toast = inject(ToastService);
  translationService = inject(TranslationService);
  suggestions = signal<AiScheduleSuggestion[]>([]);
  suggestionsRequested = signal(false);

  // Outputs
  closed = output<void>();
  saved = output<Appointment>();

  // Signals
  editMode = signal(false);
  isSubmitting = signal(false);
  showCarModal = signal(false);
  cars = signal<Car[]>([]);
  customers = signal<Customer[]>([]);
  mechanics = signal<Mechanic[]>([]);
  currentAppointmentId = signal<string | null>(null);

  // Time slots in 24h format (locale-neutral)
  timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00',
  ];

  // Form
  appointmentForm: FormGroup = this.fb.group({
    carId: ['', Validators.required],
    serviceType: ['', Validators.required],
    serviceName: ['', Validators.required],
    scheduledDate: [new Date().toISOString().split('T')[0], Validators.required],
    scheduledTime: ['', Validators.required],
    estimatedDuration: [60, [Validators.required, Validators.min(15)]],
    mechanicId: [''],
    priority: ['medium', Validators.required],
    notes: ['']
  });

  constructor() {
    this.loadFormData();
  }

  private loadFormData(): void {
    // Load cars
    this.appointmentService.getCars().subscribe(cars => {
      this.cars.set(cars);
    });

    // Load customers  
    this.appointmentService.getCustomers().subscribe(customers => {
      this.customers.set(customers);
    });

    // Load mechanics
    this.appointmentService.getMechanics().subscribe(mechanics => {
      this.mechanics.set(mechanics);
    });
  }

  saveAppointment(): void {
    if (this.appointmentForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);
      
      const formValue = this.appointmentForm.value;
      
      // Combine date and time
      const scheduledDateTime = new Date(formValue.scheduledDate);
      const [hours, minutes] = formValue.scheduledTime.split(':').map(Number);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      const appointmentData: any = {
        carId: formValue.carId,
        serviceType: formValue.serviceType,
        serviceName: formValue.serviceName,
        scheduledDate: scheduledDateTime,
        estimatedDuration: formValue.estimatedDuration,
        priority: formValue.priority,
        notes: formValue.notes || undefined
      };

      if (formValue.mechanicId) {
        appointmentData.mechanicId = formValue.mechanicId;
      }

      // Choose create or update based on edit mode
      let operation;
      if (this.editMode() && this.currentAppointmentId()) {
        operation = this.appointmentService.updateAppointment(this.currentAppointmentId()!, appointmentData);
      } else {
        appointmentData.status = 'scheduled';
        // Derive customerId from car selection
        const car = this.cars().find(c => c.id === formValue.carId);
        if (car?.customerId) {
          appointmentData.customerId = car.customerId;
        }
        operation = this.appointmentService.createAppointment(appointmentData);
      }

      operation.subscribe({
        next: (appointment) => {
          const key = this.editMode() ? 'calendar.toast.rescheduled' : 'appointments.toast.created';
          this.toast.success(this.translationService.instant(key));
          this.saved.emit(appointment);
          this.closeModal();
          this.isSubmitting.set(false);
        },
        error: () => {
          const key = this.editMode() ? 'calendar.toast.rescheduleFailed' : 'appointments.toast.createFailed';
          this.toast.error(this.translationService.instant(key));
          this.isSubmitting.set(false);
        }
      });
    }
  }

  closeModal(): void {
    this.editMode.set(false);
    this.currentAppointmentId.set(null);
    this.suggestionsRequested.set(false);
    this.suggestions.set([]);
    this.appointmentForm.reset();
    this.closed.emit();
  }

  requestAiSuggestions(): void {
    const form = this.appointmentForm.value;
    this.suggestions.set([]);
    this.suggestionsRequested.set(true);
    this.aiService.suggestSchedule({
      appointmentType: form.serviceType,
      estimatedDuration: form.estimatedDuration,
      preferredDate: form.scheduledDate || undefined,
      mechanicId: form.mechanicId || undefined,
      language: this.languageService.getCurrentLanguage(),
    }).subscribe({
      next: (response) => {
        this.suggestions.set(response.suggestedSlots);
      },
      error: () => {
        // Error is captured in aiService.error signal
      }
    });
  }

  onSuggestionClick(slot: AiScheduleSuggestion): void {
    if (slot.warning) {
      const msg = this.translationService.instant('calendar.toast.lunchBreakConfirm').replace('{{name}}', slot.mechanicName);
      if (!confirm(msg)) return;
    }
    this.applySuggestion(slot);
  }

  applySuggestion(slot: AiScheduleSuggestion): void {
    const startDate = new Date(slot.start);
    const dateStr = startDate.toISOString().split('T')[0];
    const hours = startDate.getHours().toString().padStart(2, '0');
    const minutes = startDate.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    this.appointmentForm.patchValue({
      scheduledDate: dateStr,
      scheduledTime: timeStr,
      mechanicId: slot.mechanicId,
    });
    this.suggestions.set([]);
    this.suggestionsRequested.set(false);
  }

  formatDate(iso: string): string {
    const langToLocale: Record<string, string> = { en: 'en-US', fr: 'fr-FR', ar: 'ar-TN' };
    const locale = langToLocale[this.languageService.getCurrentLanguage()] || 'en-US';
    return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
  }

  formatTime(iso: string): string {
    const langToLocale: Record<string, string> = { en: 'en-US', fr: 'fr-FR', ar: 'ar-TN' };
    const locale = langToLocale[this.languageService.getCurrentLanguage()] || 'en-US';
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  /**
   * Prefill the form with a starting date/time — used when the calendar user
   * selects a time slot via drag or click. Leaves edit mode off so submit
   * still creates a new appointment.
   */
  setInitialDate(date: Date): void {
    const dateStr = date.toISOString().split('T')[0];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    this.appointmentForm.patchValue({
      scheduledDate: dateStr,
      scheduledTime: `${hours}:${minutes}`,
    });
  }

  /**
   * Prefill the form with a car + service type (and optional predicted date)
   * so the user can confirm or tweak before submitting. Used by the
   * "Schedule" CTA on predictive-maintenance alerts.
   */
  setInitialContext(context: {
    carId?: string;
    serviceType?: string;
    serviceName?: string;
    scheduledDate?: string;
  }): void {
    const patch: Record<string, any> = {};
    if (context.carId) patch['carId'] = context.carId;
    if (context.serviceType) patch['serviceType'] = context.serviceType;
    if (context.serviceName) patch['serviceName'] = context.serviceName;
    if (context.scheduledDate) patch['scheduledDate'] = context.scheduledDate;
    if (Object.keys(patch).length > 0) {
      this.appointmentForm.patchValue(patch);
    }
  }

  // Method to set appointment for editing
  setEditAppointment(appointment: Appointment): void {
    this.editMode.set(true);
    this.currentAppointmentId.set(appointment.id);
    
    // Convert scheduled date to form format
    const scheduledDate = new Date(appointment.scheduledDate);
    const dateStr = scheduledDate.toISOString().split('T')[0];
    const timeStr = scheduledDate.toTimeString().slice(0, 5);

    this.appointmentForm.patchValue({
      carId: appointment.carId,
      serviceType: appointment.serviceType,
      serviceName: appointment.serviceName,
      scheduledDate: dateStr,
      scheduledTime: timeStr,
      estimatedDuration: appointment.estimatedDuration,
      mechanicId: appointment.mechanicId,
      priority: appointment.priority,
      notes: appointment.notes || ''
    });
  }

  openQuickAddCar(): void {
    this.showCarModal.set(true);
  }

  onCarRegistered(car: any): void {
    this.showCarModal.set(false);
    this.appointmentService.getCars().subscribe(cars => {
      this.cars.set(cars);
      this.appointmentForm.patchValue({ carId: car.id });
    });
  }
}