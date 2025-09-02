import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { map, delay, catchError } from 'rxjs/operators';
import { GarageSettings, GarageSettingsForm, SettingsValidationResult } from '../models/garage-settings.model';

@Injectable({
  providedIn: 'root'
})
export class GarageSettingsService {
  private mockSettings: GarageSettings = {
    garageInfo: {
      name: 'OpAuto Garage',
      address: '123 Avenue Habib Bourguiba',
      city: 'Tunis',
      postalCode: '1000',
      country: 'Tunisia',
      phone: '+216 71 123 456',
      email: 'contact@opauto.tn',
      website: 'https://opauto.tn',
      taxId: 'TN123456789',
      registrationNumber: 'RC-A-12345',
      description: 'Professional automotive repair and maintenance services',
      bankDetails: {
        bankName: 'Banque de Tunisie',
        accountNumber: '12345678901234567890',
        iban: 'TN5912345678901234567890',
        bic: 'BTUNTNTT',
        accountHolderName: 'OpAuto Garage SARL'
      }
    },
    operationalSettings: {
      capacity: {
        totalLifts: 4,
        availableLifts: 4,
        totalMechanics: 3,
        availableMechanics: 3,
        maxDailyAppointments: 16,
        avgServiceDuration: 90
      },
      workingHours: {
        monday: { isWorkingDay: true, openTime: '08:00', closeTime: '18:00', lunchBreak: { startTime: '12:00', endTime: '13:00' } },
        tuesday: { isWorkingDay: true, openTime: '08:00', closeTime: '18:00', lunchBreak: { startTime: '12:00', endTime: '13:00' } },
        wednesday: { isWorkingDay: true, openTime: '08:00', closeTime: '18:00', lunchBreak: { startTime: '12:00', endTime: '13:00' } },
        thursday: { isWorkingDay: true, openTime: '08:00', closeTime: '18:00', lunchBreak: { startTime: '12:00', endTime: '13:00' } },
        friday: { isWorkingDay: true, openTime: '08:00', closeTime: '18:00', lunchBreak: { startTime: '12:00', endTime: '13:00' } },
        saturday: { isWorkingDay: true, openTime: '08:00', closeTime: '14:00' },
        sunday: { isWorkingDay: false, openTime: '', closeTime: '' },
        timezone: 'Africa/Tunis'
      },
      serviceSettings: {
        defaultServiceDuration: 90,
        bufferTimeBetweenServices: 15,
        allowOverlappingAppointments: false,
        requireCustomerApproval: true,
        defaultWarrantyPeriod: 30,
        serviceCategories: [
          { id: 'maintenance', name: 'Maintenance', description: 'Regular vehicle maintenance', averageDuration: 60, averageCost: 150, requiresSpecialist: false, color: '#3b82f6', isActive: true },
          { id: 'repair', name: 'Repair', description: 'Vehicle repairs', averageDuration: 120, averageCost: 300, requiresSpecialist: true, color: '#ef4444', isActive: true },
          { id: 'diagnostic', name: 'Diagnostic', description: 'Vehicle diagnostics', averageDuration: 45, averageCost: 80, requiresSpecialist: true, color: '#f59e0b', isActive: true },
          { id: 'bodywork', name: 'Bodywork', description: 'Body and paint work', averageDuration: 240, averageCost: 800, requiresSpecialist: true, color: '#10b981', isActive: true }
        ]
      },
      appointments: {
        allowOnlineBooking: false,
        maxAdvanceBookingDays: 30,
        minAdvanceBookingHours: 2,
        allowSameDayBooking: true,
        requireDepositForBooking: false,
        depositPercentage: 20,
        cancellationPolicy: 'Cancellations must be made at least 2 hours in advance',
        reminderSettings: {
          emailReminders: true,
          smsReminders: false,
          reminderTimings: [24, 2],
          followUpEnabled: true,
          followUpDelayDays: 7
        }
      },
      holidays: [
        { id: 'new-year', name: 'New Year\'s Day', date: new Date('2024-01-01'), isRecurring: true },
        { id: 'independence', name: 'Independence Day', date: new Date('2024-03-20'), isRecurring: true },
        { id: 'eid-fitr', name: 'Eid al-Fitr', date: new Date('2024-04-10'), isRecurring: false, description: 'Dates vary each year' }
      ]
    },
    businessSettings: {
      currency: 'TND',
      taxSettings: {
        defaultTaxRate: 19,
        taxIncluded: false,
        taxLabel: 'TVA',
        taxId: 'TN123456789',
        applyTaxToLabor: true,
        applyTaxToParts: true
      },
      paymentSettings: {
        acceptedMethods: ['cash', 'card', 'bank-transfer'],
        defaultPaymentTerms: 'Payment due upon completion',
        lateFeePercentage: 1.5,
        lateFeeGracePeriodDays: 7,
        allowPartialPayments: true,
        requireDepositPercentage: 0
      },
      invoiceSettings: {
        invoicePrefix: 'INV',
        invoiceNumberFormat: 'INV-{YYYY}-{000001}',
        nextInvoiceNumber: 1001,
        defaultPaymentTerms: 'Payment due upon completion of service',
        showItemCodes: true,
        showMechanicNames: true,
        includeTermsAndConditions: true,
        termsAndConditions: 'All work is guaranteed for 30 days. Customer is responsible for any parts not covered under warranty.',
        footerText: 'Thank you for choosing OpAuto Garage!'
      },
      pricingRules: {
        laborRatePerHour: 45,
        weekendSurcharge: 25,
        urgentJobSurcharge: 50,
        bulkDiscountThreshold: 1000,
        bulkDiscountPercentage: 10,
        loyalCustomerDiscountPercentage: 5,
        autoApplyDiscounts: true
      }
    },
    systemSettings: {
      notifications: {
        enableBrowserNotifications: true,
        enableEmailNotifications: false,
        enableSmsNotifications: false,
        notificationChannels: [
          {
            type: 'browser',
            events: ['appointment-created', 'job-completed', 'approval-required'],
            isEnabled: true,
            configuration: {}
          }
        ],
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00'
        }
      },
      security: {
        sessionTimeoutMinutes: 480,
        requirePasswordReset: false,
        passwordResetIntervalDays: 90,
        enableTwoFactor: false,
        allowMultipleSessions: true,
        ipWhitelist: [],
        auditLogRetentionDays: 365
      },
      dataRetention: {
        customerDataRetentionYears: 7,
        invoiceRetentionYears: 10,
        maintenanceLogRetentionYears: 5,
        deleteInactiveCustomersAfterYears: 3,
        autoArchiveCompletedJobs: true,
        archiveAfterMonths: 12
      },
      backup: {
        autoBackupEnabled: false,
        backupFrequency: 'weekly',
        backupRetentionDays: 30,
        includeImages: true,
        cloudBackupEnabled: false
      },
      appearance: {
        theme: 'system',
        primaryColor: '#2563eb',
        secondaryColor: '#64748b',
        accentColor: '#f59e0b',
        dashboardLayout: 'standard',
        showWelcomeMessage: true,
        language: 'en'
      }
    },
    integrationSettings: {
      smsProvider: {
        provider: 'none',
        isEnabled: false,
        configuration: {}
      },
      emailProvider: {
        provider: 'none',
        isEnabled: false,
        configuration: {}
      },
      paymentGateway: {
        provider: 'none',
        isEnabled: false,
        configuration: {}
      },
      inventoryIntegration: {
        provider: 'manual',
        isEnabled: true,
        autoOrderThreshold: 5,
        preferredSuppliers: ['Local Parts Store', 'Auto Parts Direct'],
        configuration: {}
      },
      accountingIntegration: {
        provider: 'none',
        isEnabled: false,
        syncFrequency: 'manual',
        configuration: {}
      }
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  };

  private settingsSubject = new BehaviorSubject<GarageSettings>(this.mockSettings);
  public settings$ = this.settingsSubject.asObservable();

  getSettings(): Observable<GarageSettings> {
    return this.settings$.pipe(delay(100));
  }

  updateSettings(updates: Partial<GarageSettings>): Observable<GarageSettings> {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings: GarageSettings = {
      ...currentSettings,
      ...updates,
      updatedAt: new Date()
    };

    this.settingsSubject.next(updatedSettings);
    return of(updatedSettings).pipe(delay(300));
  }

  updateGarageInfo(garageInfo: Partial<GarageSettings['garageInfo']>): Observable<GarageSettings> {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings: GarageSettings = {
      ...currentSettings,
      garageInfo: {
        ...currentSettings.garageInfo,
        ...garageInfo
      },
      updatedAt: new Date()
    };

    this.settingsSubject.next(updatedSettings);
    return of(updatedSettings).pipe(delay(200));
  }

  updateOperationalSettings(operationalSettings: Partial<GarageSettings['operationalSettings']>): Observable<GarageSettings> {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings: GarageSettings = {
      ...currentSettings,
      operationalSettings: {
        ...currentSettings.operationalSettings,
        ...operationalSettings
      },
      updatedAt: new Date()
    };

    this.settingsSubject.next(updatedSettings);
    return of(updatedSettings).pipe(delay(200));
  }

  updateBusinessSettings(businessSettings: Partial<GarageSettings['businessSettings']>): Observable<GarageSettings> {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings: GarageSettings = {
      ...currentSettings,
      businessSettings: {
        ...currentSettings.businessSettings,
        ...businessSettings
      },
      updatedAt: new Date()
    };

    this.settingsSubject.next(updatedSettings);
    return of(updatedSettings).pipe(delay(200));
  }

  updateSystemSettings(systemSettings: Partial<GarageSettings['systemSettings']>): Observable<GarageSettings> {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings: GarageSettings = {
      ...currentSettings,
      systemSettings: {
        ...currentSettings.systemSettings,
        ...systemSettings
      },
      updatedAt: new Date()
    };

    this.settingsSubject.next(updatedSettings);
    return of(updatedSettings).pipe(delay(200));
  }

  updateIntegrationSettings(integrationSettings: Partial<GarageSettings['integrationSettings']>): Observable<GarageSettings> {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings: GarageSettings = {
      ...currentSettings,
      integrationSettings: {
        ...currentSettings.integrationSettings,
        ...integrationSettings
      },
      updatedAt: new Date()
    };

    this.settingsSubject.next(updatedSettings);
    return of(updatedSettings).pipe(delay(200));
  }

  validateSettings(settings: Partial<GarageSettings>): Observable<SettingsValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Validate garage info
    if (settings.garageInfo) {
      if (!settings.garageInfo.name || settings.garageInfo.name.trim().length < 2) {
        errors.push({ field: 'garageInfo.name', message: 'Garage name is required and must be at least 2 characters', severity: 'error' });
      }
      if (!settings.garageInfo.phone || !/^\+?[0-9\s-()]+$/.test(settings.garageInfo.phone)) {
        errors.push({ field: 'garageInfo.phone', message: 'Valid phone number is required', severity: 'error' });
      }
      if (!settings.garageInfo.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.garageInfo.email)) {
        errors.push({ field: 'garageInfo.email', message: 'Valid email address is required', severity: 'error' });
      }
    }

    // Validate operational settings
    if (settings.operationalSettings?.capacity) {
      const capacity = settings.operationalSettings.capacity;
      if (capacity.totalLifts < 1) {
        errors.push({ field: 'capacity.totalLifts', message: 'At least 1 lift is required', severity: 'error' });
      }
      if (capacity.totalMechanics < 1) {
        errors.push({ field: 'capacity.totalMechanics', message: 'At least 1 mechanic is required', severity: 'error' });
      }
      if (capacity.maxDailyAppointments < 1) {
        warnings.push({ field: 'capacity.maxDailyAppointments', message: 'Very low daily appointment limit may impact business', suggestion: 'Consider increasing to at least 4 appointments per day' });
      }
    }

    // Validate business settings
    if (settings.businessSettings?.taxSettings) {
      const tax = settings.businessSettings.taxSettings;
      if (tax.defaultTaxRate < 0 || tax.defaultTaxRate > 100) {
        errors.push({ field: 'taxSettings.defaultTaxRate', message: 'Tax rate must be between 0 and 100', severity: 'error' });
      }
    }

    const result: SettingsValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings
    };

    return of(result).pipe(delay(100));
  }

  resetToDefaults(section: keyof GarageSettings): Observable<GarageSettings> {
    const defaultSettings = this.getDefaultSettings();
    const currentSettings = this.settingsSubject.value;

    const updatedSettings: GarageSettings = {
      ...currentSettings,
      [section]: defaultSettings[section],
      updatedAt: new Date()
    };

    this.settingsSubject.next(updatedSettings);
    return of(updatedSettings).pipe(delay(200));
  }

  exportSettings(): Observable<Blob> {
    const settings = this.settingsSubject.value;
    const exportData = {
      ...settings,
      exportedAt: new Date(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    return of(blob).pipe(delay(100));
  }

  importSettings(file: File): Observable<GarageSettings> {
    return new Observable<GarageSettings>(observer => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string);
          
          // Basic validation
          if (!importedData.garageInfo || !importedData.operationalSettings) {
            throw new Error('Invalid settings file format');
          }

          const newSettings: GarageSettings = {
            ...importedData,
            updatedAt: new Date()
          };

          this.settingsSubject.next(newSettings);
          observer.next(newSettings);
          observer.complete();
        } catch (error) {
          observer.error(new Error('Failed to parse settings file'));
        }
      };

      reader.onerror = () => {
        observer.error(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    }).pipe(delay(300)) as Observable<GarageSettings>;
  }

  testIntegration(integrationType: string): Observable<{ success: boolean; message: string }> {
    // Simulate integration testing
    const integrations: Record<string, { success: boolean; message: string }> = {
      sms: { success: true, message: 'SMS service connection successful' },
      email: { success: true, message: 'Email service connection successful' },
      payment: { success: false, message: 'Payment gateway configuration invalid' },
      inventory: { success: true, message: 'Inventory system connected' },
      accounting: { success: false, message: 'Accounting integration not configured' }
    };

    const result = integrations[integrationType] || { success: false, message: 'Unknown integration type' };
    return of(result).pipe(delay(1000));
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
        capacity: {
          totalLifts: 2,
          availableLifts: 2,
          totalMechanics: 2,
          availableMechanics: 2,
          maxDailyAppointments: 8,
          avgServiceDuration: 90
        },
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
          reminderSettings: {
            emailReminders: false,
            smsReminders: false,
            reminderTimings: [24],
            followUpEnabled: false,
            followUpDelayDays: 7
          }
        },
        holidays: []
      },
      businessSettings: {
        currency: 'TND',
        taxSettings: {
          defaultTaxRate: 19,
          taxIncluded: false,
          taxLabel: 'TVA',
          taxId: '',
          applyTaxToLabor: true,
          applyTaxToParts: true
        },
        paymentSettings: {
          acceptedMethods: ['cash'],
          defaultPaymentTerms: 'Payment due upon completion',
          lateFeePercentage: 0,
          lateFeeGracePeriodDays: 0,
          allowPartialPayments: false,
          requireDepositPercentage: 0
        },
        invoiceSettings: {
          invoicePrefix: 'INV',
          invoiceNumberFormat: 'INV-{000001}',
          nextInvoiceNumber: 1,
          defaultPaymentTerms: 'Payment due upon completion',
          showItemCodes: false,
          showMechanicNames: false,
          includeTermsAndConditions: false,
          termsAndConditions: '',
          footerText: ''
        },
        pricingRules: {
          laborRatePerHour: 30,
          weekendSurcharge: 0,
          urgentJobSurcharge: 0,
          bulkDiscountThreshold: 0,
          bulkDiscountPercentage: 0,
          loyalCustomerDiscountPercentage: 0,
          autoApplyDiscounts: false
        }
      },
      systemSettings: {
        notifications: {
          enableBrowserNotifications: true,
          enableEmailNotifications: false,
          enableSmsNotifications: false,
          notificationChannels: [],
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00'
          }
        },
        security: {
          sessionTimeoutMinutes: 240,
          requirePasswordReset: false,
          passwordResetIntervalDays: 90,
          enableTwoFactor: false,
          allowMultipleSessions: false,
          ipWhitelist: [],
          auditLogRetentionDays: 90
        },
        dataRetention: {
          customerDataRetentionYears: 5,
          invoiceRetentionYears: 7,
          maintenanceLogRetentionYears: 3,
          deleteInactiveCustomersAfterYears: 2,
          autoArchiveCompletedJobs: false,
          archiveAfterMonths: 6
        },
        backup: {
          autoBackupEnabled: false,
          backupFrequency: 'weekly',
          backupRetentionDays: 7,
          includeImages: false,
          cloudBackupEnabled: false
        },
        appearance: {
          theme: 'light',
          primaryColor: '#2563eb',
          secondaryColor: '#64748b',
          accentColor: '#f59e0b',
          dashboardLayout: 'standard',
          showWelcomeMessage: true,
          language: 'en'
        }
      },
      integrationSettings: {
        smsProvider: {
          provider: 'none',
          isEnabled: false,
          configuration: {}
        },
        emailProvider: {
          provider: 'none',
          isEnabled: false,
          configuration: {}
        },
        paymentGateway: {
          provider: 'none',
          isEnabled: false,
          configuration: {}
        },
        inventoryIntegration: {
          provider: 'manual',
          isEnabled: true,
          autoOrderThreshold: 10,
          preferredSuppliers: [],
          configuration: {}
        },
        accountingIntegration: {
          provider: 'none',
          isEnabled: false,
          syncFrequency: 'manual',
          configuration: {}
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Compatibility methods for existing invoice service
  getGarageInfo(): Observable<any> {
    return this.settings$.pipe(
      map((settings: GarageSettings) => settings.garageInfo),
      delay(50)
    );
  }

  getInvoiceSettings(): Observable<any> {
    return this.settings$.pipe(
      map((settings: GarageSettings) => ({
        garageInfo: settings.garageInfo,
        ...settings.businessSettings.invoiceSettings
      })),
      delay(50)
    );
  }
}