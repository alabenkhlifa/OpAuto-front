import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { GarageSettingsComponent } from './garage-settings.component';
import { GarageSettingsService } from '../../core/services/garage-settings.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { ToastService } from '../../shared/services/toast.service';
import { GarageSettings } from '../../core/models/garage-settings.model';

describe('GarageSettingsComponent', () => {
  let component: GarageSettingsComponent;
  let fixture: ComponentFixture<GarageSettingsComponent>;
  let mockSettingsService: jasmine.SpyObj<GarageSettingsService>;
  let mockAuth: jasmine.SpyObj<AuthService>;
  let mockToast: jasmine.SpyObj<ToastService>;

  function buildSettings(): GarageSettings {
    return {
      garageInfo: {
        name: 'Test', address: '', city: '', postalCode: '', country: 'Tunisia',
        phone: '', email: '', taxId: '', registrationNumber: '',
      },
      operationalSettings: {
        capacity: { totalLifts: 1, availableLifts: 1, totalMechanics: 1, availableMechanics: 1, maxDailyAppointments: 1, avgServiceDuration: 60 },
        workingHours: {
          monday: { isWorkingDay: true, openTime: '08:00', closeTime: '17:00' },
          tuesday: { isWorkingDay: true, openTime: '08:00', closeTime: '17:00' },
          wednesday: { isWorkingDay: true, openTime: '08:00', closeTime: '17:00' },
          thursday: { isWorkingDay: true, openTime: '08:00', closeTime: '17:00' },
          friday: { isWorkingDay: true, openTime: '08:00', closeTime: '17:00' },
          saturday: { isWorkingDay: false, openTime: '', closeTime: '' },
          sunday: { isWorkingDay: false, openTime: '', closeTime: '' },
          timezone: 'Africa/Tunis',
        },
        serviceSettings: { defaultServiceDuration: 60, bufferTimeBetweenServices: 0, allowOverlappingAppointments: false, requireCustomerApproval: true, defaultWarrantyPeriod: 30, serviceCategories: [] },
        appointments: { allowOnlineBooking: false, maxAdvanceBookingDays: 30, minAdvanceBookingHours: 2, allowSameDayBooking: true, requireDepositForBooking: false, depositPercentage: 0, cancellationPolicy: '', reminderSettings: { emailReminders: false, smsReminders: false, reminderTimings: [], followUpEnabled: false, followUpDelayDays: 0 } },
        holidays: [],
      },
      businessSettings: {
        currency: 'TND',
        taxSettings: { defaultTaxRate: 19, taxIncluded: false, taxLabel: 'TVA', taxId: '', applyTaxToLabor: true, applyTaxToParts: true },
        paymentSettings: { acceptedMethods: ['cash'], defaultPaymentTerms: '', lateFeePercentage: 0, lateFeeGracePeriodDays: 0, allowPartialPayments: false, requireDepositPercentage: 0 },
        invoiceSettings: { invoicePrefix: 'INV', invoiceNumberFormat: '', nextInvoiceNumber: 1, defaultPaymentTerms: '', showItemCodes: false, showMechanicNames: false, includeTermsAndConditions: false, termsAndConditions: '', footerText: '' },
        pricingRules: { laborRatePerHour: 30, weekendSurcharge: 0, urgentJobSurcharge: 0, bulkDiscountThreshold: 0, bulkDiscountPercentage: 0, loyalCustomerDiscountPercentage: 0, autoApplyDiscounts: false },
      },
      systemSettings: {
        notifications: { enableBrowserNotifications: false, enableEmailNotifications: false, enableSmsNotifications: false, notificationChannels: [], quietHours: { enabled: false, startTime: '', endTime: '' } },
        security: { sessionTimeoutMinutes: 60, requirePasswordReset: false, passwordResetIntervalDays: 90, enableTwoFactor: false, allowMultipleSessions: false, ipWhitelist: [], auditLogRetentionDays: 90 },
        dataRetention: { customerDataRetentionYears: 5, invoiceRetentionYears: 7, maintenanceLogRetentionYears: 3, deleteInactiveCustomersAfterYears: 2, autoArchiveCompletedJobs: false, archiveAfterMonths: 6 },
        backup: { autoBackupEnabled: false, backupFrequency: 'weekly', backupRetentionDays: 7, includeImages: false, cloudBackupEnabled: false },
        appearance: { theme: 'light', primaryColor: '', secondaryColor: '', accentColor: '', dashboardLayout: 'standard', showWelcomeMessage: true, language: 'en' },
      },
      integrationSettings: {
        smsProvider: { provider: 'none', isEnabled: false, configuration: {} },
        emailProvider: { provider: 'none', isEnabled: false, configuration: {} },
        paymentGateway: { provider: 'none', isEnabled: false, configuration: {} },
        inventoryIntegration: { provider: 'manual', isEnabled: true, autoOrderThreshold: 10, preferredSuppliers: [], configuration: {} },
        accountingIntegration: { provider: 'none', isEnabled: false, syncFrequency: 'manual', configuration: {} },
      },
      fiscalSettings: {
        mfNumber: '',
        rib: '',
        bankName: '',
        logoUrl: '',
        numberingPrefix: 'INV',
        numberingResetPolicy: 'YEARLY',
        numberingDigitCount: 4,
        defaultTvaRate: 19,
        fiscalStampEnabled: true,
        defaultPaymentTermsDays: 30,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  beforeEach(async () => {
    mockSettingsService = jasmine.createSpyObj('GarageSettingsService', [
      'getSettings', 'updateGarageInfo', 'updateOperationalSettings',
      'updateBusinessSettings', 'updateSystemSettings', 'updateIntegrationSettings',
      'updateFiscalSettings', 'testIntegration', 'exportSettings', 'importSettings',
    ]);
    mockSettingsService.getSettings.and.returnValue(of(buildSettings()));
    mockSettingsService.updateFiscalSettings.and.returnValue(of(buildSettings()));

    mockAuth = jasmine.createSpyObj('AuthService', ['isOwner']);
    mockAuth.isOwner.and.returnValue(true);

    mockToast = jasmine.createSpyObj('ToastService', ['success', 'error']);

    const translations$ = new BehaviorSubject<Record<string, unknown>>({});
    const mockTranslation = jasmine.createSpyObj('TranslationService', ['instant'], {
      translations$: translations$.asObservable(),
    });
    mockTranslation.instant.and.callFake((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [GarageSettingsComponent, HttpClientTestingModule],
      providers: [
        { provide: GarageSettingsService, useValue: mockSettingsService },
        { provide: AuthService, useValue: mockAuth },
        { provide: ToastService, useValue: mockToast },
        { provide: TranslationService, useValue: mockTranslation },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GarageSettingsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('isOwner()', () => {
    it('returns true when AuthService says owner', () => {
      mockAuth.isOwner.and.returnValue(true);
      expect(component.isOwner()).toBeTrue();
    });

    it('returns false when AuthService says not owner', () => {
      mockAuth.isOwner.and.returnValue(false);
      expect(component.isOwner()).toBeFalse();
    });
  });

  describe('Fiscal section render gating', () => {
    it('shows the Fiscal nav button when isOwner is true', () => {
      mockAuth.isOwner.and.returnValue(true);
      component.ngOnInit();
      fixture.detectChanges();

      const html: string = fixture.nativeElement.innerHTML;
      expect(html).toContain('settings.navigation.fiscal');
    });

    it('hides the Fiscal nav button when isOwner is false', () => {
      mockAuth.isOwner.and.returnValue(false);
      component.ngOnInit();
      fixture.detectChanges();

      const html: string = fixture.nativeElement.innerHTML;
      expect(html).not.toContain('settings.navigation.fiscal');
    });
  });

  describe('onFiscalSettingsSave()', () => {
    it('forwards the payload to GarageSettingsService.updateFiscalSettings', () => {
      const payload = {
        mfNumber: '1234567/A/B/000',
        rib: '12345678901234567890',
        numberingPrefix: 'INV',
        numberingResetPolicy: 'YEARLY' as const,
        numberingDigitCount: 4,
        defaultTvaRate: 19,
        fiscalStampEnabled: true,
        defaultPaymentTermsDays: 30,
      };

      component.onFiscalSettingsSave(payload);

      expect(mockSettingsService.updateFiscalSettings).toHaveBeenCalledWith(payload);
      expect(mockToast.success).toHaveBeenCalled();
    });

    it('shows an error toast when the service rejects', () => {
      mockSettingsService.updateFiscalSettings.and.returnValue(throwError(() => new Error('boom')));
      component.onFiscalSettingsSave({});

      expect(mockToast.error).toHaveBeenCalled();
    });
  });
});
