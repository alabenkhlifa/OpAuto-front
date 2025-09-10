import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { OperationalSettings } from '../../../core/models/garage-settings.model';

@Component({
  selector: 'app-operational-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="space-y-6">
      
      <!-- Garage Capacity -->
      <div class="glass-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">{{ 'settings.operations.garageCapacity' | translate }}</h3>
          <button 
            type="button"
            class="btn-primary text-sm"
            [disabled]="capacityForm.invalid"
            (click)="saveCapacity()">
            {{ 'settings.operations.saveCapacity' | translate }}
          </button>
        </div>

        <form [formGroup]="capacityForm" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="form-label">{{ 'settings.operations.totalLifts' | translate }} *</label>
            <input 
              type="number" 
              class="form-input"
              formControlName="totalLifts"
              min="1"
              max="20"
              [class.border-red-500]="isCapacityFieldInvalid('totalLifts')">
            @if (isCapacityFieldInvalid('totalLifts')) {
              <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ 'settings.operations.errors.atLeastOneLift' | translate }}</p>
            }
          </div>

          <div>
            <label class="form-label">{{ 'settings.operations.totalMechanics' | translate }} *</label>
            <input 
              type="number" 
              class="form-input"
              formControlName="totalMechanics"
              min="1"
              max="50"
              [class.border-red-500]="isCapacityFieldInvalid('totalMechanics')">
            @if (isCapacityFieldInvalid('totalMechanics')) {
              <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ 'settings.operations.errors.atLeastOneMechanic' | translate }}</p>
            }
          </div>

          <div>
            <label class="form-label">{{ 'settings.operations.maxDailyAppointments' | translate }} *</label>
            <input 
              type="number" 
              class="form-input"
              formControlName="maxDailyAppointments"
              min="1"
              max="100"
              [class.border-red-500]="isCapacityFieldInvalid('maxDailyAppointments')">
          </div>

          <div>
            <label class="form-label">{{ 'settings.operations.avgServiceDuration' | translate }}</label>
            <input 
              type="number" 
              class="form-input"
              formControlName="avgServiceDuration"
              min="15"
              max="480"
              step="15">
          </div>
        </form>
      </div>

      <!-- Working Hours -->
      <div class="glass-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">{{ 'settings.operations.workingHours' | translate }}</h3>
          <button 
            type="button"
            class="btn-primary text-sm"
            (click)="saveWorkingHours()">
            {{ 'settings.operations.saveHours' | translate }}
          </button>
        </div>

        <form [formGroup]="workingHoursForm">
          <div class="space-y-4">
            @for (day of weekDays; track day.key) {
              <div class="flex items-center space-x-4 p-3 bg-gray-800/30 rounded-lg" [formGroupName]="day.key">
                <div class="w-24">
                  <label class="flex items-center">
                    <input 
                      type="checkbox" 
                      class="form-checkbox mr-2"
                      formControlName="isWorkingDay">
                    <span class="text-sm font-medium text-white">{{ 'settings.operations.days.' + day.key | translate }}</span>
                  </label>
                </div>

                <div class="flex items-center space-x-2" *ngIf="isWorkingDay(day.key)">
                  <input 
                    type="time" 
                    class="form-input w-20"
                    formControlName="openTime">
                  <span class="text-gray-400">{{ 'settings.operations.to' | translate }}</span>
                  <input 
                    type="time" 
                    class="form-input w-20"
                    formControlName="closeTime">
                </div>

                <div class="flex items-center space-x-2 ml-4" *ngIf="isWorkingDay(day.key)" formGroupName="lunchBreak">
                  <span class="text-sm text-gray-400">{{ 'settings.operations.lunch' | translate }}:</span>
                  <input 
                    type="time" 
                    class="form-input w-20"
                    formControlName="startTime">
                  <span class="text-gray-400">-</span>
                  <input 
                    type="time" 
                    class="form-input w-20"
                    formControlName="endTime">
                </div>
              </div>
            }
          </div>

          <div class="mt-4">
            <label class="form-label">{{ 'settings.operations.timezone' | translate }}</label>
            <select class="form-select w-48" formControlName="timezone">
              <option value="Africa/Tunis">Africa/Tunis (GMT+1)</option>
              <option value="Africa/Algiers">Africa/Algiers (GMT+1)</option>
              <option value="Africa/Casablanca">Africa/Casablanca (GMT+1)</option>
              <option value="Europe/Paris">Europe/Paris (GMT+1)</option>
            </select>
          </div>
        </form>
      </div>

      <!-- Service Settings -->
      <div class="glass-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">{{ 'settings.operations.serviceSettings' | translate }}</h3>
          <button 
            type="button"
            class="btn-primary text-sm"
            (click)="saveServiceSettings()">
            {{ 'settings.operations.saveSettings' | translate }}
          </button>
        </div>

        <form [formGroup]="serviceForm" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="form-label">{{ 'settings.operations.defaultServiceDuration' | translate }}</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="defaultServiceDuration"
                min="15"
                max="480"
                step="15">
            </div>

            <div>
              <label class="form-label">{{ 'settings.operations.bufferTime' | translate }}</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="bufferTimeBetweenServices"
                min="0"
                max="60"
                step="5">
            </div>

            <div>
              <label class="form-label">{{ 'settings.operations.warrantyPeriod' | translate }}</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="defaultWarrantyPeriod"
                min="0"
                max="365">
            </div>
          </div>

          <div class="space-y-3">
            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="allowOverlappingAppointments">
              <span class="text-sm font-medium text-gray-300">{{ 'settings.operations.allowOverlapping' | translate }}</span>
            </label>

            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="requireCustomerApproval">
              <span class="text-sm font-medium text-gray-300">{{ 'settings.operations.requireApproval' | translate }}</span>
            </label>
          </div>
        </form>
      </div>

      <!-- Appointment Settings -->
      <div class="glass-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">{{ 'settings.operations.appointmentSettings' | translate }}</h3>
          <button 
            type="button"
            class="btn-primary text-sm"
            (click)="saveAppointmentSettings()">
            {{ 'settings.operations.saveAppointmentSettings' | translate }}
          </button>
        </div>

        <form [formGroup]="appointmentForm" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="form-label">{{ 'settings.operations.maxAdvanceBooking' | translate }}</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="maxAdvanceBookingDays"
                min="1"
                max="365">
            </div>

            <div>
              <label class="form-label">{{ 'settings.operations.minAdvanceBooking' | translate }}</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="minAdvanceBookingHours"
                min="0"
                max="72">
            </div>

            <div>
              <label class="form-label">{{ 'settings.operations.depositPercentage' | translate }}</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="depositPercentage"
                min="0"
                max="100"
                step="5">
            </div>
          </div>

          <div class="space-y-3">
            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="allowOnlineBooking">
              <span class="text-sm font-medium text-gray-300">{{ 'settings.operations.allowOnlineBooking' | translate }}</span>
            </label>

            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="allowSameDayBooking">
              <span class="text-sm font-medium text-gray-300">{{ 'settings.operations.allowSameDayBooking' | translate }}</span>
            </label>

            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="requireDepositForBooking">
              <span class="text-sm font-medium text-gray-300">{{ 'settings.operations.requireDeposit' | translate }}</span>
            </label>
          </div>

          <div>
            <label class="form-label">{{ 'settings.operations.cancellationPolicy' | translate }}</label>
            <textarea 
              class="form-textarea"
              formControlName="cancellationPolicy"
              rows="3"
              [placeholder]="'settings.operations.cancellationPlaceholder' | translate">
            </textarea>
          </div>
        </form>
      </div>

    </div>
  `,
  styles: [`
    /* Time input icons - make them white */
    input[type="time"] {
      color-scheme: dark;
    }
    
    input[type="time"]::-webkit-calendar-picker-indicator {
      filter: invert(1);
      cursor: pointer;
    }
    
    /* Component uses global form classes from /src/styles/forms.css */
    /* Component uses global button classes from /src/styles/buttons.css */
  `]
})
export class OperationalSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);

  @Input() settings!: OperationalSettings;
  @Output() save = new EventEmitter<Partial<OperationalSettings>>();

  capacityForm!: FormGroup;
  workingHoursForm!: FormGroup;
  serviceForm!: FormGroup;
  appointmentForm!: FormGroup;

  weekDays = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
  ];

  ngOnInit() {
    this.initializeForms();
    this.populateForms();
  }

  ngOnChanges() {
    if (this.capacityForm && this.settings) {
      this.populateForms();
    }
  }

  private initializeForms() {
    // Capacity Form
    this.capacityForm = this.fb.group({
      totalLifts: [1, [Validators.required, Validators.min(1)]],
      totalMechanics: [1, [Validators.required, Validators.min(1)]],
      maxDailyAppointments: [8, [Validators.required, Validators.min(1)]],
      avgServiceDuration: [90, [Validators.min(15)]]
    });

    // Working Hours Form
    this.workingHoursForm = this.fb.group({
      timezone: ['Africa/Tunis'],
      monday: this.createDayScheduleGroup(),
      tuesday: this.createDayScheduleGroup(),
      wednesday: this.createDayScheduleGroup(),
      thursday: this.createDayScheduleGroup(),
      friday: this.createDayScheduleGroup(),
      saturday: this.createDayScheduleGroup(),
      sunday: this.createDayScheduleGroup()
    });

    // Service Settings Form
    this.serviceForm = this.fb.group({
      defaultServiceDuration: [90, [Validators.min(15)]],
      bufferTimeBetweenServices: [15, [Validators.min(0)]],
      allowOverlappingAppointments: [false],
      requireCustomerApproval: [true],
      defaultWarrantyPeriod: [30, [Validators.min(0)]]
    });

    // Appointment Settings Form
    this.appointmentForm = this.fb.group({
      allowOnlineBooking: [false],
      maxAdvanceBookingDays: [30, [Validators.min(1)]],
      minAdvanceBookingHours: [2, [Validators.min(0)]],
      allowSameDayBooking: [true],
      requireDepositForBooking: [false],
      depositPercentage: [0, [Validators.min(0), Validators.max(100)]],
      cancellationPolicy: ['']
    });
  }

  private createDayScheduleGroup() {
    return this.fb.group({
      isWorkingDay: [false],
      openTime: ['08:00'],
      closeTime: ['17:00'],
      lunchBreak: this.fb.group({
        startTime: ['12:00'],
        endTime: ['13:00']
      })
    });
  }

  private populateForms() {
    if (this.settings) {
      // Populate capacity form
      this.capacityForm.patchValue(this.settings.capacity);

      // Populate working hours form
      this.workingHoursForm.patchValue(this.settings.workingHours);

      // Populate service form
      this.serviceForm.patchValue(this.settings.serviceSettings);

      // Populate appointment form
      this.appointmentForm.patchValue(this.settings.appointments);
    }
  }

  isCapacityFieldInvalid(fieldName: string): boolean {
    const field = this.capacityForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  isWorkingDay(dayKey: string): boolean {
    const dayGroup = this.workingHoursForm.get(dayKey);
    return dayGroup?.get('isWorkingDay')?.value || false;
  }

  saveCapacity() {
    if (this.capacityForm.valid) {
      const capacityData = this.capacityForm.value;
      this.save.emit({
        capacity: {
          ...capacityData,
          availableLifts: capacityData.totalLifts,
          availableMechanics: capacityData.totalMechanics
        }
      });
    }
  }

  saveWorkingHours() {
    const workingHoursData = this.workingHoursForm.value;
    this.save.emit({
      workingHours: workingHoursData
    });
  }

  saveServiceSettings() {
    if (this.serviceForm.valid) {
      const serviceData = this.serviceForm.value;
      this.save.emit({
        serviceSettings: {
          ...serviceData,
          serviceCategories: this.settings.serviceSettings.serviceCategories || []
        }
      });
    }
  }

  saveAppointmentSettings() {
    if (this.appointmentForm.valid) {
      const appointmentData = this.appointmentForm.value;
      this.save.emit({
        appointments: {
          ...appointmentData,
          reminderSettings: this.settings.appointments.reminderSettings || {
            emailReminders: false,
            smsReminders: false,
            reminderTimings: [24],
            followUpEnabled: false,
            followUpDelayDays: 7
          }
        }
      });
    }
  }

  copyHoursToAllDays() {
    const mondaySchedule = this.workingHoursForm.get('monday')?.value;
    if (mondaySchedule) {
      this.weekDays.slice(1, 6).forEach(day => { // Tuesday to Saturday
        this.workingHoursForm.get(day.key)?.patchValue(mondaySchedule);
      });
    }
  }
}