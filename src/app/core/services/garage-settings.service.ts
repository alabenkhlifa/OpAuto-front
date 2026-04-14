import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { GarageSettings, SettingsValidationResult } from '../models/garage-settings.model';

@Injectable({
  providedIn: 'root'
})
export class GarageSettingsService {
  private http = inject(HttpClient);

  private settingsSubject = new BehaviorSubject<GarageSettings>(this.getDefaultSettings());
  public settings$ = this.settingsSubject.asObservable();

  getSettings(): Observable<GarageSettings> {
    return this.http.get<any>('/garage-settings').pipe(
      map(b => this.mapFromBackend(b)),
      tap(settings => this.settingsSubject.next(settings))
    );
  }

  updateSettings(updates: Partial<GarageSettings>): Observable<GarageSettings> {
    return this.http.put<any>('/garage-settings', this.mapToBackend(updates)).pipe(
      map(b => this.mapFromBackend(b)),
      tap(settings => this.settingsSubject.next(settings))
    );
  }

  updateGarageInfo(garageInfo: Partial<GarageSettings['garageInfo']>): Observable<GarageSettings> {
    const currentSettings = this.settingsSubject.value;
    const merged = {
      ...currentSettings,
      garageInfo: { ...currentSettings.garageInfo, ...garageInfo },
      updatedAt: new Date()
    };
    return this.updateSettings(merged);
  }

  updateOperationalSettings(operationalSettings: Partial<GarageSettings['operationalSettings']>): Observable<GarageSettings> {
    const currentSettings = this.settingsSubject.value;
    const merged = {
      ...currentSettings,
      operationalSettings: { ...currentSettings.operationalSettings, ...operationalSettings },
      updatedAt: new Date()
    };
    return this.updateSettings(merged);
  }

  updateBusinessSettings(businessSettings: Partial<GarageSettings['businessSettings']>): Observable<GarageSettings> {
    const currentSettings = this.settingsSubject.value;
    const merged = {
      ...currentSettings,
      businessSettings: { ...currentSettings.businessSettings, ...businessSettings },
      updatedAt: new Date()
    };
    return this.updateSettings(merged);
  }

  updateSystemSettings(systemSettings: Partial<GarageSettings['systemSettings']>): Observable<GarageSettings> {
    const currentSettings = this.settingsSubject.value;
    const merged = {
      ...currentSettings,
      systemSettings: { ...currentSettings.systemSettings, ...systemSettings },
      updatedAt: new Date()
    };
    return this.updateSettings(merged);
  }

  updateIntegrationSettings(integrationSettings: Partial<GarageSettings['integrationSettings']>): Observable<GarageSettings> {
    const currentSettings = this.settingsSubject.value;
    const merged = {
      ...currentSettings,
      integrationSettings: { ...currentSettings.integrationSettings, ...integrationSettings },
      updatedAt: new Date()
    };
    return this.updateSettings(merged);
  }

  validateSettings(settings: Partial<GarageSettings>): Observable<SettingsValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (settings.garageInfo) {
      if (!settings.garageInfo.name || settings.garageInfo.name.trim().length < 2) {
        errors.push({ field: 'garageInfo.name', message: 'Garage name is required and must be at least 2 characters', severity: 'error' });
      }
      if (!settings.garageInfo.phone || !/^\+?[0-9\s\-()]+$/.test(settings.garageInfo.phone)) {
        errors.push({ field: 'garageInfo.phone', message: 'Valid phone number is required', severity: 'error' });
      }
      if (!settings.garageInfo.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.garageInfo.email)) {
        errors.push({ field: 'garageInfo.email', message: 'Valid email address is required', severity: 'error' });
      }
    }

    if (settings.operationalSettings?.capacity) {
      const capacity = settings.operationalSettings.capacity;
      if (capacity.totalLifts < 1) {
        errors.push({ field: 'capacity.totalLifts', message: 'At least 1 lift is required', severity: 'error' });
      }
      if (capacity.totalMechanics < 1) {
        errors.push({ field: 'capacity.totalMechanics', message: 'At least 1 mechanic is required', severity: 'error' });
      }
    }

    if (settings.businessSettings?.taxSettings) {
      const tax = settings.businessSettings.taxSettings;
      if (tax.defaultTaxRate < 0 || tax.defaultTaxRate > 100) {
        errors.push({ field: 'taxSettings.defaultTaxRate', message: 'Tax rate must be between 0 and 100', severity: 'error' });
      }
    }

    return of({ isValid: errors.length === 0, errors, warnings });
  }

  resetToDefaults(section: keyof GarageSettings): Observable<GarageSettings> {
    const defaultSettings = this.getDefaultSettings();
    const currentSettings = this.settingsSubject.value;
    const updatedSettings: GarageSettings = {
      ...currentSettings,
      [section]: defaultSettings[section],
      updatedAt: new Date()
    };
    return this.updateSettings(updatedSettings);
  }

  exportSettings(): Observable<Blob> {
    const settings = this.settingsSubject.value;
    const exportData = { ...settings, exportedAt: new Date(), version: '1.0' };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    return of(blob);
  }

  importSettings(file: File): Observable<GarageSettings> {
    return new Observable<GarageSettings>(observer => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string);
          if (!importedData.garageInfo || !importedData.operationalSettings) {
            throw new Error('Invalid settings file format');
          }
          const newSettings: GarageSettings = { ...importedData, updatedAt: new Date() };
          this.settingsSubject.next(newSettings);
          observer.next(newSettings);
          observer.complete();
        } catch (error) {
          observer.error(new Error('Failed to parse settings file'));
        }
      };
      reader.onerror = () => observer.error(new Error('Failed to read file'));
      reader.readAsText(file);
    }) as Observable<GarageSettings>;
  }

  testIntegration(integrationType: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`/garage-settings/test-integration`, { type: integrationType }).pipe(
      catchError(() => of({ success: false, message: `${integrationType} integration test failed` }))
    );
  }

  getGarageInfo(): Observable<any> {
    return this.settings$.pipe(
      map((settings: GarageSettings) => settings.garageInfo)
    );
  }

  getInvoiceSettings(): Observable<any> {
    return this.settings$.pipe(
      map((settings: GarageSettings) => ({
        garageInfo: settings.garageInfo,
        ...settings.businessSettings.invoiceSettings
      }))
    );
  }

  private mapFromBackend(b: any): GarageSettings {
    const defaults = this.getDefaultSettings();
    return {
      garageInfo: {
        name: b.name || defaults.garageInfo.name,
        address: b.address || defaults.garageInfo.address,
        city: b.city || defaults.garageInfo.city,
        postalCode: b.postalCode || defaults.garageInfo.postalCode,
        country: b.country || defaults.garageInfo.country,
        phone: b.phone || defaults.garageInfo.phone,
        email: b.email || defaults.garageInfo.email,
        website: b.website || defaults.garageInfo.website,
        taxId: b.taxId || defaults.garageInfo.taxId,
        registrationNumber: b.registrationNumber || defaults.garageInfo.registrationNumber,
        description: b.description || defaults.garageInfo.description,
        bankDetails: b.bankDetails || defaults.garageInfo.bankDetails
      },
      operationalSettings: {
        capacity: b.capacity || defaults.operationalSettings.capacity,
        workingHours: b.businessHours || b.workingHours || defaults.operationalSettings.workingHours,
        serviceSettings: b.serviceSettings || defaults.operationalSettings.serviceSettings,
        appointments: b.appointments || defaults.operationalSettings.appointments,
        holidays: b.holidays || defaults.operationalSettings.holidays
      },
      businessSettings: {
        currency: b.currency || defaults.businessSettings.currency,
        taxSettings: b.taxSettings || {
          ...defaults.businessSettings.taxSettings,
          defaultTaxRate: b.taxRate ?? defaults.businessSettings.taxSettings.defaultTaxRate
        },
        paymentSettings: b.paymentSettings || defaults.businessSettings.paymentSettings,
        invoiceSettings: b.invoiceSettings || defaults.businessSettings.invoiceSettings,
        pricingRules: b.pricingRules || defaults.businessSettings.pricingRules
      },
      systemSettings: b.systemSettings || defaults.systemSettings,
      integrationSettings: b.integrationSettings || defaults.integrationSettings,
      createdAt: b.createdAt ? new Date(b.createdAt) : defaults.createdAt,
      updatedAt: b.updatedAt ? new Date(b.updatedAt) : defaults.updatedAt
    };
  }

  private mapToBackend(settings: Partial<GarageSettings>): any {
    const result: any = {};
    if (settings.garageInfo) {
      if (settings.garageInfo.name) result.name = settings.garageInfo.name;
      if (settings.garageInfo.address) result.address = settings.garageInfo.address;
      if (settings.garageInfo.phone) result.phone = settings.garageInfo.phone;
      if (settings.garageInfo.email) result.email = settings.garageInfo.email;
    }
    if (settings.operationalSettings?.workingHours) {
      result.businessHours = settings.operationalSettings.workingHours;
    }
    if (settings.businessSettings) {
      if (settings.businessSettings.currency) result.currency = settings.businessSettings.currency;
      if (settings.businessSettings.taxSettings?.defaultTaxRate !== undefined) {
        result.taxRate = settings.businessSettings.taxSettings.defaultTaxRate;
      }
    }
    return result;
  }

  private getDefaultSettings(): GarageSettings {
    return {
      garageInfo: {
        name: '',
        address: '',
        city: '',
        postalCode: '',
        country: 'Tunisia',
        phone: '',
        email: '',
        taxId: '',
        registrationNumber: ''
      },
      operationalSettings: {
        capacity: { totalLifts: 2, availableLifts: 2, totalMechanics: 2, availableMechanics: 2, maxDailyAppointments: 8, avgServiceDuration: 90 },
        workingHours: {
          monday: { isWorkingDay: true, openTime: '08:00', closeTime: '17:00' },
          tuesday: { isWorkingDay: true, openTime: '08:00', closeTime: '17:00' },
          wednesday: { isWorkingDay: true, openTime: '08:00', closeTime: '17:00' },
          thursday: { isWorkingDay: true, openTime: '08:00', closeTime: '17:00' },
          friday: { isWorkingDay: true, openTime: '08:00', closeTime: '17:00' },
          saturday: { isWorkingDay: false, openTime: '', closeTime: '' },
          sunday: { isWorkingDay: false, openTime: '', closeTime: '' },
          timezone: 'Africa/Tunis'
        },
        serviceSettings: {
          defaultServiceDuration: 90,
          bufferTimeBetweenServices: 15,
          allowOverlappingAppointments: false,
          requireCustomerApproval: true,
          defaultWarrantyPeriod: 30,
          serviceCategories: []
        },
        appointments: {
          allowOnlineBooking: false,
          maxAdvanceBookingDays: 30,
          minAdvanceBookingHours: 2,
          allowSameDayBooking: true,
          requireDepositForBooking: false,
          depositPercentage: 0,
          cancellationPolicy: '',
          reminderSettings: { emailReminders: false, smsReminders: false, reminderTimings: [24], followUpEnabled: false, followUpDelayDays: 7 }
        },
        holidays: []
      },
      businessSettings: {
        currency: 'TND',
        taxSettings: { defaultTaxRate: 19, taxIncluded: false, taxLabel: 'TVA', taxId: '', applyTaxToLabor: true, applyTaxToParts: true },
        paymentSettings: { acceptedMethods: ['cash'], defaultPaymentTerms: 'Payment due upon completion', lateFeePercentage: 0, lateFeeGracePeriodDays: 0, allowPartialPayments: false, requireDepositPercentage: 0 },
        invoiceSettings: { invoicePrefix: 'INV', invoiceNumberFormat: 'INV-{000001}', nextInvoiceNumber: 1, defaultPaymentTerms: 'Payment due upon completion', showItemCodes: false, showMechanicNames: false, includeTermsAndConditions: false, termsAndConditions: '', footerText: '' },
        pricingRules: { laborRatePerHour: 30, weekendSurcharge: 0, urgentJobSurcharge: 0, bulkDiscountThreshold: 0, bulkDiscountPercentage: 0, loyalCustomerDiscountPercentage: 0, autoApplyDiscounts: false }
      },
      systemSettings: {
        notifications: { enableBrowserNotifications: true, enableEmailNotifications: false, enableSmsNotifications: false, notificationChannels: [], quietHours: { enabled: false, startTime: '22:00', endTime: '08:00' } },
        security: { sessionTimeoutMinutes: 240, requirePasswordReset: false, passwordResetIntervalDays: 90, enableTwoFactor: false, allowMultipleSessions: false, ipWhitelist: [], auditLogRetentionDays: 90 },
        dataRetention: { customerDataRetentionYears: 5, invoiceRetentionYears: 7, maintenanceLogRetentionYears: 3, deleteInactiveCustomersAfterYears: 2, autoArchiveCompletedJobs: false, archiveAfterMonths: 6 },
        backup: { autoBackupEnabled: false, backupFrequency: 'weekly', backupRetentionDays: 7, includeImages: false, cloudBackupEnabled: false },
        appearance: { theme: 'light', primaryColor: '#E67700', secondaryColor: '#64748b', accentColor: '#7B8CC4', dashboardLayout: 'standard', showWelcomeMessage: true, language: 'en' }
      },
      integrationSettings: {
        smsProvider: { provider: 'none', isEnabled: false, configuration: {} },
        emailProvider: { provider: 'none', isEnabled: false, configuration: {} },
        paymentGateway: { provider: 'none', isEnabled: false, configuration: {} },
        inventoryIntegration: { provider: 'manual', isEnabled: true, autoOrderThreshold: 10, preferredSuppliers: [], configuration: {} },
        accountingIntegration: { provider: 'none', isEnabled: false, syncFrequency: 'manual', configuration: {} }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}
