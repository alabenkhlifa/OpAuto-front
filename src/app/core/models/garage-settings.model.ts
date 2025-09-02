export interface GarageSettings {
  garageInfo: GarageInfo;
  operationalSettings: OperationalSettings;
  businessSettings: BusinessSettings;
  systemSettings: SystemSettings;
  integrationSettings: IntegrationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface GarageInfo {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  website?: string;
  taxId: string;
  registrationNumber: string;
  description?: string;
  bankDetails?: BankDetails;
  logo?: string;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  iban?: string;
  bic?: string;
  accountHolderName: string;
}

export interface OperationalSettings {
  capacity: GarageCapacity;
  workingHours: WorkingHours;
  serviceSettings: ServiceSettings;
  appointments: AppointmentSettings;
  holidays: Holiday[];
}

export interface GarageCapacity {
  totalLifts: number;
  availableLifts: number;
  totalMechanics: number;
  availableMechanics: number;
  maxDailyAppointments: number;
  avgServiceDuration: number; // minutes
}

export interface WorkingHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
  timezone: string;
}

export interface DaySchedule {
  isWorkingDay: boolean;
  openTime: string; // "08:00"
  closeTime: string; // "18:00"
  lunchBreak?: {
    startTime: string; // "12:00"
    endTime: string;   // "13:00"
  };
}

export interface ServiceSettings {
  defaultServiceDuration: number; // minutes
  bufferTimeBetweenServices: number; // minutes
  allowOverlappingAppointments: boolean;
  requireCustomerApproval: boolean;
  defaultWarrantyPeriod: number; // days
  serviceCategories: ServiceCategory[];
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  averageDuration: number; // minutes
  averageCost: number;
  requiresSpecialist: boolean;
  color: string;
  isActive: boolean;
}

export interface AppointmentSettings {
  allowOnlineBooking: boolean;
  maxAdvanceBookingDays: number;
  minAdvanceBookingHours: number;
  allowSameDayBooking: boolean;
  requireDepositForBooking: boolean;
  depositPercentage: number;
  cancellationPolicy: string;
  reminderSettings: ReminderSettings;
}

export interface ReminderSettings {
  emailReminders: boolean;
  smsReminders: boolean;
  reminderTimings: number[]; // hours before appointment [24, 2]
  followUpEnabled: boolean;
  followUpDelayDays: number;
}

export interface Holiday {
  id: string;
  name: string;
  date: Date;
  isRecurring: boolean;
  description?: string;
}

export interface BusinessSettings {
  currency: string;
  taxSettings: TaxSettings;
  paymentSettings: PaymentSettings;
  invoiceSettings: InvoiceSettings;
  pricingRules: PricingRules;
}

export interface TaxSettings {
  defaultTaxRate: number; // percentage
  taxIncluded: boolean;
  taxLabel: string; // "TVA", "VAT", etc.
  taxId: string;
  applyTaxToLabor: boolean;
  applyTaxToParts: boolean;
}

export interface PaymentSettings {
  acceptedMethods: PaymentMethod[];
  defaultPaymentTerms: string;
  lateFeePercentage: number;
  lateFeeGracePeriodDays: number;
  allowPartialPayments: boolean;
  requireDepositPercentage: number;
}

export type PaymentMethod = 'cash' | 'card' | 'bank-transfer' | 'check' | 'credit';

export interface InvoiceSettings {
  invoicePrefix: string;
  invoiceNumberFormat: string; // "INV-{YYYY}-{000001}"
  nextInvoiceNumber: number;
  defaultPaymentTerms: string;
  showItemCodes: boolean;
  showMechanicNames: boolean;
  includeTermsAndConditions: boolean;
  termsAndConditions: string;
  footerText: string;
}

export interface PricingRules {
  laborRatePerHour: number;
  weekendSurcharge: number; // percentage
  urgentJobSurcharge: number; // percentage
  bulkDiscountThreshold: number; // amount
  bulkDiscountPercentage: number;
  loyalCustomerDiscountPercentage: number;
  autoApplyDiscounts: boolean;
}

export interface SystemSettings {
  notifications: NotificationSettings;
  security: SecuritySettings;
  dataRetention: DataRetentionSettings;
  backup: BackupSettings;
  appearance: AppearanceSettings;
}

export interface NotificationSettings {
  enableBrowserNotifications: boolean;
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
  notificationChannels: NotificationChannel[];
  quietHours: {
    enabled: boolean;
    startTime: string; // "22:00"
    endTime: string;   // "08:00"
  };
}

export interface NotificationChannel {
  type: 'email' | 'sms' | 'browser' | 'webhook';
  events: NotificationEvent[];
  isEnabled: boolean;
  configuration: Record<string, any>;
}

export type NotificationEvent = 
  | 'appointment-created'
  | 'appointment-cancelled'
  | 'job-completed'
  | 'approval-required'
  | 'payment-received'
  | 'invoice-overdue'
  | 'low-inventory'
  | 'employee-absent';

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  requirePasswordReset: boolean;
  passwordResetIntervalDays: number;
  enableTwoFactor: boolean;
  allowMultipleSessions: boolean;
  ipWhitelist: string[];
  auditLogRetentionDays: number;
}

export interface DataRetentionSettings {
  customerDataRetentionYears: number;
  invoiceRetentionYears: number;
  maintenanceLogRetentionYears: number;
  deleteInactiveCustomersAfterYears: number;
  autoArchiveCompletedJobs: boolean;
  archiveAfterMonths: number;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupRetentionDays: number;
  includeImages: boolean;
  cloudBackupEnabled: boolean;
  lastBackupDate?: Date;
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyLogo?: string;
  dashboardLayout: 'standard' | 'compact' | 'detailed';
  showWelcomeMessage: boolean;
  language: 'en' | 'fr' | 'tn';
}

export interface IntegrationSettings {
  smsProvider: SmsProviderSettings;
  emailProvider: EmailProviderSettings;
  paymentGateway: PaymentGatewaySettings;
  inventoryIntegration: InventoryIntegrationSettings;
  accountingIntegration: AccountingIntegrationSettings;
}

export interface SmsProviderSettings {
  provider: 'twilio' | 'vonage' | 'local-sms' | 'none';
  isEnabled: boolean;
  configuration: {
    apiKey?: string;
    phoneNumber?: string;
    endpoint?: string;
  };
}

export interface EmailProviderSettings {
  provider: 'smtp' | 'sendgrid' | 'mailgun' | 'local' | 'none';
  isEnabled: boolean;
  configuration: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    fromEmail?: string;
    fromName?: string;
  };
}

export interface PaymentGatewaySettings {
  provider: 'stripe' | 'paypal' | 'local-bank' | 'none';
  isEnabled: boolean;
  configuration: {
    apiKey?: string;
    merchantId?: string;
    endpoint?: string;
  };
}

export interface InventoryIntegrationSettings {
  provider: 'parts-api' | 'local-supplier' | 'manual' | 'none';
  isEnabled: boolean;
  autoOrderThreshold: number;
  preferredSuppliers: string[];
  configuration: Record<string, any>;
}

export interface AccountingIntegrationSettings {
  provider: 'quickbooks' | 'xero' | 'sage' | 'local' | 'none';
  isEnabled: boolean;
  syncFrequency: 'real-time' | 'daily' | 'weekly' | 'manual';
  configuration: Record<string, any>;
}

// Form-specific interfaces for settings management
export interface GarageSettingsForm {
  garageInfo: Partial<GarageInfo>;
  operationalSettings: Partial<OperationalSettings>;
  businessSettings: Partial<BusinessSettings>;
  systemSettings: Partial<SystemSettings>;
  integrationSettings: Partial<IntegrationSettings>;
}

export interface SettingsValidationResult {
  isValid: boolean;
  errors: SettingsValidationError[];
  warnings: SettingsValidationWarning[];
}

export interface SettingsValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface SettingsValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}