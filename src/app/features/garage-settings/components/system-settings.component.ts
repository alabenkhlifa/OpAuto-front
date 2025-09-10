import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { SystemSettings } from '../../../core/models/garage-settings.model';

@Component({
  selector: 'app-system-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="glass-card">
      
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold text-white">{{ 'settings.system.title' | translate }}</h2>
        <div class="flex space-x-2">
          <button 
            type="button"
            class="btn-secondary text-sm"
            (click)="resetForm()">
            {{ 'settings.system.resetButton' | translate }}
          </button>
          <button 
            type="button"
            class="btn-primary text-sm"
            [disabled]="systemForm.invalid || isSaving"
            (click)="onSave()">
            @if (isSaving) {
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ 'settings.system.saving' | translate }}
            } @else {
              {{ 'settings.system.saveChanges' | translate }}
            }
          </button>
        </div>
      </div>

      <form [formGroup]="systemForm" class="space-y-8">
        
        <!-- Notifications Settings -->
        <div>
          <h3 class="text-md font-medium text-white mb-4">{{ 'settings.system.notifications.title' | translate }}</h3>
          <div formGroupName="notifications" class="space-y-4">
            <!-- Browser Notifications -->
            <div class="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="browserNotifications"
                class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                formControlName="enableBrowserNotifications">
              <div class="flex-1">
                <label for="browserNotifications" class="form-label mb-1">{{ 'settings.system.notifications.browserNotifications' | translate }}</label>
                <p class="text-sm text-gray-400">{{ 'settings.system.notifications.browserDescription' | translate }}</p>
              </div>
            </div>

            <!-- SMS Notifications -->
            <div class="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="smsNotifications"
                class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                formControlName="enableSmsNotifications">
              <div class="flex-1">
                <label for="smsNotifications" class="form-label mb-1">{{ 'settings.system.notifications.smsNotifications' | translate }}</label>
                <p class="text-sm text-gray-400">{{ 'settings.system.notifications.smsDescription' | translate }}</p>
              </div>
            </div>

            <!-- Email Notifications -->
            <div class="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="emailNotifications"
                class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                formControlName="enableEmailNotifications">
              <div class="flex-1">
                <label for="emailNotifications" class="form-label mb-1">{{ 'settings.system.notifications.emailNotifications' | translate }}</label>
                <p class="text-sm text-gray-400">{{ 'settings.system.notifications.emailDescription' | translate }}</p>
              </div>
            </div>

          </div>
        </div>

        <!-- Security Settings -->
        <div>
          <h3 class="text-md font-medium text-white mb-4">{{ 'settings.system.security.title' | translate }}</h3>
          <div formGroupName="security" class="space-y-4">
            <!-- Session Timeout -->
            <div>
              <label class="form-label">{{ 'settings.system.security.sessionTimeout' | translate }}</label>
              <select 
                class="form-select"
                formControlName="sessionTimeoutMinutes"
                [class.border-red-500]="isFieldInvalid('security.sessionTimeoutMinutes')">
                <option value="15">{{ 'settings.system.security.timeouts.15min' | translate }}</option>
                <option value="30">{{ 'settings.system.security.timeouts.30min' | translate }}</option>
                <option value="60">{{ 'settings.system.security.timeouts.1hour' | translate }}</option>
                <option value="120">{{ 'settings.system.security.timeouts.2hours' | translate }}</option>
                <option value="240">{{ 'settings.system.security.timeouts.4hours' | translate }}</option>
                <option value="480">{{ 'settings.system.security.timeouts.8hours' | translate }}</option>
              </select>
              @if (isFieldInvalid('security.sessionTimeoutMinutes')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ 'settings.system.security.sessionTimeoutRequired' | translate }}</p>
              }
            </div>

            <!-- Two-Factor Authentication -->
            <div class="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="twoFactorAuth"
                class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                formControlName="enableTwoFactor">
              <div class="flex-1">
                <label for="twoFactorAuth" class="form-label mb-1">{{ 'settings.system.security.twoFactorAuth' | translate }}</label>
                <p class="text-sm text-gray-400">{{ 'settings.system.security.twoFactorDescription' | translate }}</p>
              </div>
            </div>

            <!-- Multiple Sessions -->
            <div class="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="multipleSessions"
                class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                formControlName="allowMultipleSessions">
              <div class="flex-1">
                <label for="multipleSessions" class="form-label mb-1">{{ 'settings.system.security.multipleSessions' | translate }}</label>
                <p class="text-sm text-gray-400">{{ 'settings.system.security.multipleSessionsDescription' | translate }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Data Retention Settings -->
        <div>
          <h3 class="text-md font-medium text-white mb-4">{{ 'settings.system.dataRetention.title' | translate }}</h3>
          <div formGroupName="dataRetention" class="space-y-4">
            <!-- Customer Data -->
            <div>
              <label class="form-label">{{ 'settings.system.dataRetention.customerData' | translate }}</label>
              <select 
                class="form-select"
                formControlName="customerDataRetentionYears"
                [class.border-red-500]="isFieldInvalid('dataRetention.customerDataRetentionYears')">
                <option value="3">{{ 'settings.system.dataRetention.periods.3years' | translate }}</option>
                <option value="5">{{ 'settings.system.dataRetention.periods.5years' | translate }}</option>
                <option value="7">{{ 'settings.system.dataRetention.periods.7years' | translate }}</option>
                <option value="10">{{ 'settings.system.dataRetention.periods.10years' | translate }}</option>
                <option value="0">{{ 'settings.system.dataRetention.periods.neverDelete' | translate }}</option>
              </select>
              @if (isFieldInvalid('dataRetention.customerDataRetentionYears')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ 'settings.system.dataRetention.customerDataRequired' | translate }}</p>
              }
            </div>

            <!-- Maintenance Records -->
            <div>
              <label class="form-label">{{ 'settings.system.dataRetention.maintenanceRecords' | translate }}</label>
              <select 
                class="form-select"
                formControlName="maintenanceLogRetentionYears"
                [class.border-red-500]="isFieldInvalid('dataRetention.maintenanceLogRetentionYears')">
                <option value="3">{{ 'settings.system.dataRetention.periods.3years' | translate }}</option>
                <option value="5">{{ 'settings.system.dataRetention.periods.5years' | translate }}</option>
                <option value="7">{{ 'settings.system.dataRetention.periods.7years' | translate }}</option>
                <option value="10">{{ 'settings.system.dataRetention.periods.10years' | translate }}</option>
                <option value="0">{{ 'settings.system.dataRetention.periods.neverDelete' | translate }}</option>
              </select>
              @if (isFieldInvalid('dataRetention.maintenanceLogRetentionYears')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ 'settings.system.dataRetention.maintenanceRecordsRequired' | translate }}</p>
              }
            </div>

            <!-- Invoice Data -->
            <div>
              <label class="form-label">{{ 'settings.system.dataRetention.invoiceData' | translate }}</label>
              <select 
                class="form-select"
                formControlName="invoiceRetentionYears"
                [class.border-red-500]="isFieldInvalid('dataRetention.invoiceRetentionYears')">
                <option value="5">{{ 'settings.system.dataRetention.periods.5years' | translate }}</option>
                <option value="7">{{ 'settings.system.dataRetention.periods.7years' | translate }}</option>
                <option value="10">{{ 'settings.system.dataRetention.periods.10years' | translate }}</option>
                <option value="0">{{ 'settings.system.dataRetention.periods.neverDelete' | translate }}</option>
              </select>
              @if (isFieldInvalid('dataRetention.invoiceRetentionYears')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ 'settings.system.dataRetention.invoiceDataRequired' | translate }}</p>
              }
            </div>

            <!-- Auto-archive -->
            <div class="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="autoArchive"
                class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                formControlName="autoArchiveCompletedJobs">
              <div class="flex-1">
                <label for="autoArchive" class="form-label mb-1">{{ 'settings.system.dataRetention.autoArchive' | translate }}</label>
                <p class="text-sm text-gray-400">{{ 'settings.system.dataRetention.autoArchiveDescription' | translate }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Backup Settings -->
        <div>
          <h3 class="text-md font-medium text-white mb-4">{{ 'settings.system.backup.title' | translate }}</h3>
          <div formGroupName="backup" class="space-y-4">
            <!-- Auto Backup -->
            <div class="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="autoBackup"
                class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                formControlName="autoBackupEnabled">
              <div class="flex-1">
                <label for="autoBackup" class="form-label mb-1">{{ 'settings.system.backup.automaticBackup' | translate }}</label>
                <p class="text-sm text-gray-400">{{ 'settings.system.backup.automaticBackupDescription' | translate }}</p>
              </div>
            </div>

            <!-- Backup Frequency -->
            <div>
              <label class="form-label">{{ 'settings.system.backup.frequency' | translate }}</label>
              <select 
                class="form-select"
                formControlName="backupFrequency"
                [disabled]="!systemForm.get('backup.autoBackupEnabled')?.value">
                <option value="daily">{{ 'settings.system.backup.frequencies.daily' | translate }}</option>
                <option value="weekly">{{ 'settings.system.backup.frequencies.weekly' | translate }}</option>
                <option value="monthly">{{ 'settings.system.backup.frequencies.monthly' | translate }}</option>
              </select>
            </div>

            <!-- Retention Period -->
            <div>
              <label class="form-label">{{ 'settings.system.backup.retention' | translate }}</label>
              <select 
                class="form-select"
                formControlName="backupRetentionDays"
                [disabled]="!systemForm.get('backup.autoBackupEnabled')?.value">
                <option value="7">{{ 'settings.system.backup.retentionPeriods.7days' | translate }}</option>
                <option value="30">{{ 'settings.system.backup.retentionPeriods.30days' | translate }}</option>
                <option value="90">{{ 'settings.system.backup.retentionPeriods.90days' | translate }}</option>
                <option value="365">{{ 'settings.system.backup.retentionPeriods.1year' | translate }}</option>
              </select>
            </div>

            <!-- Last Backup Info -->
            @if (lastBackupDate) {
              <div class="bg-gray-800/30 p-4 rounded-lg">
                <p class="text-sm text-gray-300">
                  <strong>{{ 'settings.system.backup.lastBackup' | translate }}:</strong> {{ lastBackupDate | date:'medium' }}
                </p>
              </div>
            }

            <!-- Manual Backup Button -->
            <div>
              <button 
                type="button"
                class="btn-secondary"
                (click)="createManualBackup()"
                [disabled]="isCreatingBackup">
                @if (isCreatingBackup) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ 'settings.system.backup.creatingBackup' | translate }}
                } @else {
                  {{ 'settings.system.backup.createManualBackup' | translate }}
                }
              </button>
            </div>
          </div>
        </div>

        <!-- Appearance Settings -->
        <div>
          <h3 class="text-md font-medium text-white mb-4">{{ 'settings.system.appearance.title' | translate }}</h3>
          <div formGroupName="appearance" class="space-y-4">
            <!-- Theme -->
            <div>
              <label class="form-label">{{ 'settings.system.appearance.theme' | translate }}</label>
              <select 
                class="form-select"
                formControlName="theme"
                [class.border-red-500]="isFieldInvalid('appearance.theme')">
                <option value="light">{{ 'settings.system.appearance.themes.light' | translate }}</option>
                <option value="dark">{{ 'settings.system.appearance.themes.dark' | translate }}</option>
                <option value="system">{{ 'settings.system.appearance.themes.system' | translate }}</option>
              </select>
              @if (isFieldInvalid('appearance.theme')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ 'settings.system.appearance.themeRequired' | translate }}</p>
              }
            </div>

            <!-- Color Scheme -->
            <div>
              <label class="form-label">{{ 'settings.system.appearance.primaryColor' | translate }}</label>
              <div class="grid grid-cols-4 gap-3">
                @for (color of colorOptions; track color.value) {
                  <div class="flex items-center space-x-2">
                    <input 
                      type="radio" 
                      [id]="'color-' + color.value"
                      [value]="color.hex"
                      formControlName="primaryColor"
                      class="w-4 h-4">
                    <label [for]="'color-' + color.value" class="flex items-center space-x-2 text-sm">
                      <div class="w-4 h-4 rounded-full border border-gray-300" [style.background-color]="color.hex"></div>
                      <span>{{ 'settings.system.appearance.colors.' + color.value | translate }}</span>
                    </label>
                  </div>
                }
              </div>
            </div>

            <!-- Language -->
            <div>
              <label class="form-label">{{ 'settings.system.appearance.language' | translate }}</label>
              <select 
                class="form-select"
                formControlName="language"
                [class.border-red-500]="isFieldInvalid('appearance.language')">
                <option value="en">{{ 'settings.system.appearance.languages.en' | translate }}</option>
                <option value="fr">{{ 'settings.system.appearance.languages.fr' | translate }}</option>
                <option value="ar">{{ 'settings.system.appearance.languages.ar' | translate }}</option>
              </select>
              @if (isFieldInvalid('appearance.language')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ 'settings.system.appearance.languageRequired' | translate }}</p>
              }
            </div>
          </div>
        </div>

        <!-- System Information -->
        <div>
          <h3 class="text-md font-medium text-white mb-4">{{ 'settings.system.systemInfo.title' | translate }}</h3>
          <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-2">
            <div class="flex justify-between">
              <span class="text-sm text-gray-300">{{ 'settings.system.systemInfo.appVersion' | translate }}:</span>
              <span class="text-sm font-medium text-white">{{ systemInfo.version }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-300">{{ 'settings.system.systemInfo.lastUpdate' | translate }}:</span>
              <span class="text-sm font-medium text-white">{{ systemInfo.lastUpdate | date:'medium' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-300">{{ 'settings.system.systemInfo.databaseSize' | translate }}:</span>
              <span class="text-sm font-medium text-white">{{ systemInfo.databaseSize }}</span>
            </div>
          </div>
        </div>

      </form>

    </div>
  `,
  styles: [`
    /* Component uses global form classes from /src/styles/forms.css */
    /* Component uses global button classes from /src/styles/buttons.css */
  `]
})
export class SystemSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);

  @Input() settings!: SystemSettings;
  @Output() save = new EventEmitter<Partial<SystemSettings>>();

  systemForm!: FormGroup;
  isSaving = false;
  isCreatingBackup = false;
  lastBackupDate: Date | null = null;

  systemInfo = {
    version: '1.0.0',
    lastUpdate: new Date('2024-01-15'),
    databaseSize: '45.2 MB'
  };

  colorOptions = [
    { value: 'blue', name: 'Blue', hex: '#2563eb' },
    { value: 'green', name: 'Green', hex: '#059669' },
    { value: 'purple', name: 'Purple', hex: '#7c3aed' },
    { value: 'red', name: 'Red', hex: '#dc2626' }
  ];

  ngOnInit() {
    this.initializeForm();
    this.populateForm();
    this.loadBackupInfo();
  }

  ngOnChanges() {
    if (this.systemForm && this.settings) {
      this.populateForm();
    }
  }

  private initializeForm() {
    this.systemForm = this.fb.group({
      notifications: this.fb.group({
        enableBrowserNotifications: [true],
        enableSmsNotifications: [false],
        enableEmailNotifications: [true]
      }),
      security: this.fb.group({
        sessionTimeoutMinutes: [480, Validators.required],
        enableTwoFactor: [false],
        allowMultipleSessions: [true]
      }),
      dataRetention: this.fb.group({
        customerDataRetentionYears: [7, Validators.required],
        maintenanceLogRetentionYears: [5, Validators.required],
        invoiceRetentionYears: [10, Validators.required],
        autoArchiveCompletedJobs: [true]
      }),
      backup: this.fb.group({
        autoBackupEnabled: [false],
        backupFrequency: ['weekly'],
        backupRetentionDays: [30]
      }),
      appearance: this.fb.group({
        theme: ['system', Validators.required],
        primaryColor: ['#2563eb'],
        language: ['en']
      })
    });
  }

  private populateForm() {
    if (this.settings) {
      this.systemForm.patchValue({
        notifications: {
          enableBrowserNotifications: this.settings.notifications?.enableBrowserNotifications ?? true,
          enableSmsNotifications: this.settings.notifications?.enableSmsNotifications ?? false,
          enableEmailNotifications: this.settings.notifications?.enableEmailNotifications ?? true
        },
        security: {
          sessionTimeoutMinutes: this.settings.security?.sessionTimeoutMinutes ?? 480,
          enableTwoFactor: this.settings.security?.enableTwoFactor ?? false,
          allowMultipleSessions: this.settings.security?.allowMultipleSessions ?? true
        },
        dataRetention: {
          customerDataRetentionYears: this.settings.dataRetention?.customerDataRetentionYears ?? 7,
          maintenanceLogRetentionYears: this.settings.dataRetention?.maintenanceLogRetentionYears ?? 5,
          invoiceRetentionYears: this.settings.dataRetention?.invoiceRetentionYears ?? 10,
          autoArchiveCompletedJobs: this.settings.dataRetention?.autoArchiveCompletedJobs ?? true
        },
        backup: {
          autoBackupEnabled: this.settings.backup?.autoBackupEnabled ?? false,
          backupFrequency: this.settings.backup?.backupFrequency ?? 'weekly',
          backupRetentionDays: this.settings.backup?.backupRetentionDays ?? 30
        },
        appearance: {
          theme: this.settings.appearance?.theme ?? 'system',
          primaryColor: this.settings.appearance?.primaryColor ?? '#2563eb',
          language: this.settings.appearance?.language ?? 'en'
        }
      });
    }
  }

  private loadBackupInfo() {
    this.lastBackupDate = new Date('2024-01-20T10:30:00');
  }

  isFieldInvalid(fieldPath: string): boolean {
    const field = this.systemForm.get(fieldPath);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSave() {
    if (this.systemForm.valid) {
      this.isSaving = true;
      const formValue = this.systemForm.value;
      
      const updatedSystemSettings: Partial<SystemSettings> = {
        notifications: {
          enableBrowserNotifications: formValue.notifications.enableBrowserNotifications,
          enableEmailNotifications: formValue.notifications.enableEmailNotifications,
          enableSmsNotifications: formValue.notifications.enableSmsNotifications,
          notificationChannels: this.settings?.notifications?.notificationChannels || [],
          quietHours: this.settings?.notifications?.quietHours || { enabled: false, startTime: '22:00', endTime: '08:00' }
        },
        security: {
          sessionTimeoutMinutes: formValue.security.sessionTimeoutMinutes,
          requirePasswordReset: this.settings?.security?.requirePasswordReset || false,
          passwordResetIntervalDays: this.settings?.security?.passwordResetIntervalDays || 90,
          enableTwoFactor: formValue.security.enableTwoFactor,
          allowMultipleSessions: formValue.security.allowMultipleSessions,
          ipWhitelist: this.settings?.security?.ipWhitelist || [],
          auditLogRetentionDays: this.settings?.security?.auditLogRetentionDays || 365
        },
        dataRetention: {
          customerDataRetentionYears: formValue.dataRetention.customerDataRetentionYears,
          invoiceRetentionYears: formValue.dataRetention.invoiceRetentionYears,
          maintenanceLogRetentionYears: formValue.dataRetention.maintenanceLogRetentionYears,
          deleteInactiveCustomersAfterYears: this.settings?.dataRetention?.deleteInactiveCustomersAfterYears || 3,
          autoArchiveCompletedJobs: formValue.dataRetention.autoArchiveCompletedJobs,
          archiveAfterMonths: this.settings?.dataRetention?.archiveAfterMonths || 12
        },
        backup: {
          autoBackupEnabled: formValue.backup.autoBackupEnabled,
          backupFrequency: formValue.backup.backupFrequency,
          backupRetentionDays: formValue.backup.backupRetentionDays,
          includeImages: this.settings?.backup?.includeImages || true,
          cloudBackupEnabled: this.settings?.backup?.cloudBackupEnabled || false,
          lastBackupDate: this.settings?.backup?.lastBackupDate
        },
        appearance: {
          theme: formValue.appearance.theme,
          primaryColor: formValue.appearance.primaryColor,
          secondaryColor: this.settings?.appearance?.secondaryColor || '#64748b',
          accentColor: this.settings?.appearance?.accentColor || '#f59e0b',
          companyLogo: this.settings?.appearance?.companyLogo,
          dashboardLayout: this.settings?.appearance?.dashboardLayout || 'standard',
          showWelcomeMessage: this.settings?.appearance?.showWelcomeMessage ?? true,
          language: formValue.appearance.language
        }
      };

      this.save.emit(updatedSystemSettings);
      
      setTimeout(() => {
        this.isSaving = false;
      }, 1000);
    }
  }

  createManualBackup() {
    this.isCreatingBackup = true;
    
    setTimeout(() => {
      this.isCreatingBackup = false;
      this.lastBackupDate = new Date();
    }, 2000);
  }

  resetForm() {
    this.populateForm();
    this.systemForm.markAsPristine();
    this.systemForm.markAsUntouched();
  }
}