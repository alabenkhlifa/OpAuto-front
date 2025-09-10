import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { IntegrationSettings } from '../../../core/models/garage-settings.model';

@Component({
  selector: 'app-integration-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="glass-card">
      
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold text-white">{{ 'settings.integrations.title' | translate }}</h2>
        <div class="flex space-x-2">
          <button 
            type="button"
            class="btn-secondary text-sm"
            (click)="resetForm()">
            {{ 'settings.integrations.resetButton' | translate }}
          </button>
          <button 
            type="button"
            class="btn-primary text-sm"
            [disabled]="integrationForm.invalid || isSaving"
            (click)="onSave()">
            @if (isSaving) {
              <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ 'settings.integrations.saving' | translate }}
            } @else {
              {{ 'settings.integrations.saveChanges' | translate }}
            }
          </button>
        </div>
      </div>

      <form [formGroup]="integrationForm" class="space-y-8">
        
        <!-- SMS Integration -->
        <div>
          <div class="flex items-center space-x-3 mb-4">
            <input 
              type="checkbox" 
              id="smsEnabled"
              class="form-checkbox"
              formControlName="smsEnabled">
            <h3 class="text-md font-medium text-white">{{ 'settings.integrations.sms.title' | translate }}</h3>
          </div>
          
          <div formGroupName="sms" class="grid grid-cols-1 md:grid-cols-2 gap-4" [class.opacity-50]="!integrationForm.get('smsEnabled')?.value">
            <div>
              <label class="form-label">{{ 'settings.integrations.sms.provider' | translate }}</label>
              <select 
                class="form-select"
                formControlName="provider"
                [disabled]="!integrationForm.get('smsEnabled')?.value">
                @for (provider of smsProviders; track provider.value) {
                  <option [value]="provider.value">{{ provider.label }}</option>
                }
              </select>
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.sms.apiKey' | translate }}</label>
              <input 
                type="password" 
                class="form-input"
                formControlName="apiKey"
                placeholder="{{ 'settings.integrations.sms.apiKeyPlaceholder' | translate }}"
                [disabled]="!integrationForm.get('smsEnabled')?.value">
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.sms.senderName' | translate }}</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="senderId"
                placeholder="{{ 'settings.integrations.sms.senderNamePlaceholder' | translate }}"
                [disabled]="!integrationForm.get('smsEnabled')?.value">
            </div>

            <div class="flex items-center mt-6">
              <button 
                type="button"
                class="btn-secondary text-sm"
                (click)="testSmsConnection()"
                [disabled]="!integrationForm.get('smsEnabled')?.value || isTesting.sms">
                @if (isTesting.sms) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ 'settings.integrations.sms.testing' | translate }}
                } @else {
                  {{ 'settings.integrations.sms.testConnection' | translate }}
                }
              </button>
            </div>
          </div>
        </div>

        <!-- Email Integration -->
        <div>
          <div class="flex items-center space-x-3 mb-4">
            <input 
              type="checkbox" 
              id="emailEnabled"
              class="form-checkbox"
              formControlName="emailEnabled">
            <h3 class="text-md font-medium text-white">{{ 'settings.integrations.email.title' | translate }}</h3>
          </div>
          
          <div formGroupName="email" class="grid grid-cols-1 md:grid-cols-2 gap-4" [class.opacity-50]="!integrationForm.get('emailEnabled')?.value">
            <div>
              <label class="form-label">{{ 'settings.integrations.email.provider' | translate }}</label>
              <select 
                class="form-select"
                formControlName="provider"
                [disabled]="!integrationForm.get('emailEnabled')?.value">
                @for (provider of emailProviders; track provider.value) {
                  <option [value]="provider.value">{{ provider.label }}</option>
                }
              </select>
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.email.smtpHost' | translate }}</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="smtpHost"
                placeholder="{{ 'settings.integrations.email.smtpHostPlaceholder' | translate }}"
                [disabled]="!integrationForm.get('emailEnabled')?.value">
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.email.smtpPort' | translate }}</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="smtpPort"
                placeholder="{{ 'settings.integrations.email.smtpPortPlaceholder' | translate }}"
                [disabled]="!integrationForm.get('emailEnabled')?.value">
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.email.username' | translate }}</label>
              <input 
                type="email" 
                class="form-input"
                formControlName="username"
                placeholder="{{ 'settings.integrations.email.usernamePlaceholder' | translate }}"
                [disabled]="!integrationForm.get('emailEnabled')?.value">
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.email.password' | translate }}</label>
              <input 
                type="password" 
                class="form-input"
                formControlName="password"
                placeholder="{{ 'settings.integrations.email.passwordPlaceholder' | translate }}"
                [disabled]="!integrationForm.get('emailEnabled')?.value">
            </div>

            <div class="flex items-center mt-6">
              <button 
                type="button"
                class="btn-secondary text-sm"
                (click)="testEmailConnection()"
                [disabled]="!integrationForm.get('emailEnabled')?.value || isTesting.email">
                @if (isTesting.email) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ 'settings.integrations.email.testing' | translate }}
                } @else {
                  {{ 'settings.integrations.email.testConnection' | translate }}
                }
              </button>
            </div>
          </div>
        </div>

        <!-- Payment Gateway -->
        <div>
          <div class="flex items-center space-x-3 mb-4">
            <input 
              type="checkbox" 
              id="paymentEnabled"
              class="form-checkbox"
              formControlName="paymentEnabled">
            <h3 class="text-md font-medium text-white">{{ 'settings.integrations.payment.title' | translate }}</h3>
          </div>
          
          <div formGroupName="paymentGateway" class="grid grid-cols-1 md:grid-cols-2 gap-4" [class.opacity-50]="!integrationForm.get('paymentEnabled')?.value">
            <div>
              <label class="form-label">{{ 'settings.integrations.payment.provider' | translate }}</label>
              <select 
                class="form-select"
                formControlName="provider"
                [disabled]="!integrationForm.get('paymentEnabled')?.value">
                @for (provider of paymentProviders; track provider.value) {
                  <option [value]="provider.value">{{ 'settings.integrations.payment.providers.' + provider.value | translate }}</option>
                }
              </select>
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.payment.merchantId' | translate }}</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="merchantId"
                placeholder="{{ 'settings.integrations.payment.merchantIdPlaceholder' | translate }}"
                [disabled]="!integrationForm.get('paymentEnabled')?.value">
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.payment.apiKey' | translate }}</label>
              <input 
                type="password" 
                class="form-input"
                formControlName="apiKey"
                placeholder="{{ 'settings.integrations.payment.apiKeyPlaceholder' | translate }}"
                [disabled]="!integrationForm.get('paymentEnabled')?.value">
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.payment.webhookUrl' | translate }}</label>
              <input 
                type="url" 
                class="form-input"
                formControlName="webhookUrl"
                placeholder="{{ 'settings.integrations.payment.webhookUrlPlaceholder' | translate }}"
                [disabled]="!integrationForm.get('paymentEnabled')?.value">
            </div>

            <div class="md:col-span-2">
              <div class="flex items-center space-x-3">
                <input 
                  type="checkbox" 
                  id="testMode"
                  class="form-checkbox"
                  formControlName="testMode"
                  [disabled]="!integrationForm.get('paymentEnabled')?.value">
                <label for="testMode" class="text-sm font-medium text-gray-300">{{ 'settings.integrations.payment.testMode' | translate }}</label>
              </div>
              <p class="text-sm text-gray-400 mt-1">{{ 'settings.integrations.payment.testModeDescription' | translate }}</p>
            </div>

            <div class="flex items-center mt-6">
              <button 
                type="button"
                class="btn-secondary text-sm"
                (click)="testPaymentConnection()"
                [disabled]="!integrationForm.get('paymentEnabled')?.value || isTesting.payment">
                @if (isTesting.payment) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ 'settings.integrations.common.testing' | translate }}
                } @else {
                  {{ 'settings.integrations.common.testConnection' | translate }}
                }
              </button>
            </div>
          </div>
        </div>

        <!-- Inventory Integration -->
        <div>
          <div class="flex items-center space-x-3 mb-4">
            <input 
              type="checkbox" 
              id="inventoryEnabled"
              class="form-checkbox"
              formControlName="inventoryEnabled">
            <h3 class="text-md font-medium text-white">{{ 'settings.integrations.inventory.title' | translate }}</h3>
          </div>
          
          <div formGroupName="inventory" class="grid grid-cols-1 md:grid-cols-2 gap-4" [class.opacity-50]="!integrationForm.get('inventoryEnabled')?.value">
            <div>
              <label class="form-label">{{ 'settings.integrations.inventory.provider' | translate }}</label>
              <select 
                class="form-select"
                formControlName="provider"
                [disabled]="!integrationForm.get('inventoryEnabled')?.value">
                @for (provider of inventoryProviders; track provider.value) {
                  <option [value]="provider.value">{{ 'settings.integrations.inventory.providers.' + provider.value | translate }}</option>
                }
              </select>
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.inventory.apiEndpoint' | translate }}</label>
              <input 
                type="url" 
                class="form-input"
                formControlName="apiEndpoint"
                placeholder="{{ 'settings.integrations.inventory.apiEndpointPlaceholder' | translate }}"
                [disabled]="!integrationForm.get('inventoryEnabled')?.value">
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.inventory.apiKey' | translate }}</label>
              <input 
                type="password" 
                class="form-input"
                formControlName="apiKey"
                placeholder="{{ 'settings.integrations.inventory.apiKeyPlaceholder' | translate }}"
                [disabled]="!integrationForm.get('inventoryEnabled')?.value">
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.inventory.syncFrequency' | translate }}</label>
              <select 
                class="form-select"
                formControlName="syncFrequency"
                [disabled]="!integrationForm.get('inventoryEnabled')?.value">
                <option value="realtime">{{ 'settings.integrations.common.frequencies.realtime' | translate }}</option>
                <option value="hourly">{{ 'settings.integrations.common.frequencies.hourly' | translate }}</option>
                <option value="daily">{{ 'settings.integrations.common.frequencies.daily' | translate }}</option>
                <option value="weekly">{{ 'settings.integrations.common.frequencies.weekly' | translate }}</option>
              </select>
            </div>

            <div class="md:col-span-2">
              <div class="flex items-center space-x-3">
                <input 
                  type="checkbox" 
                  id="autoOrder"
                  class="form-checkbox"
                  formControlName="autoOrderEnabled"
                  [disabled]="!integrationForm.get('inventoryEnabled')?.value">
                <label for="autoOrder" class="text-sm font-medium text-gray-300">{{ 'settings.integrations.inventory.autoOrder' | translate }}</label>
              </div>
              <p class="text-sm text-gray-400 mt-1">{{ 'settings.integrations.inventory.autoOrderDescription' | translate }}</p>
            </div>

            <div class="flex items-center mt-6">
              <button 
                type="button"
                class="btn-secondary text-sm"
                (click)="testInventoryConnection()"
                [disabled]="!integrationForm.get('inventoryEnabled')?.value || isTesting.inventory">
                @if (isTesting.inventory) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ 'settings.integrations.common.testing' | translate }}
                } @else {
                  {{ 'settings.integrations.common.testConnection' | translate }}
                }
              </button>
            </div>
          </div>
        </div>

        <!-- Accounting Integration -->
        <div>
          <div class="flex items-center space-x-3 mb-4">
            <input 
              type="checkbox" 
              id="accountingEnabled"
              class="form-checkbox"
              formControlName="accountingEnabled">
            <h3 class="text-md font-medium text-white">{{ 'settings.integrations.accounting.title' | translate }}</h3>
          </div>
          
          <div formGroupName="accounting" class="grid grid-cols-1 md:grid-cols-2 gap-4" [class.opacity-50]="!integrationForm.get('accountingEnabled')?.value">
            <div>
              <label class="form-label">{{ 'settings.integrations.accounting.software' | translate }}</label>
              <select 
                class="form-select"
                formControlName="software"
                [disabled]="!integrationForm.get('accountingEnabled')?.value">
                @for (software of accountingSoftware; track software.value) {
                  <option [value]="software.value">{{ software.label }}</option>
                }
              </select>
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.accounting.apiEndpoint' | translate }}</label>
              <input 
                type="url" 
                class="form-input"
                formControlName="apiEndpoint"
                placeholder="{{ 'settings.integrations.accounting.apiEndpointPlaceholder' | translate }}"
                [disabled]="!integrationForm.get('accountingEnabled')?.value">
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.accounting.clientId' | translate }}</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="clientId"
                placeholder="{{ 'settings.integrations.accounting.clientIdPlaceholder' | translate }}"
                [disabled]="!integrationForm.get('accountingEnabled')?.value">
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.accounting.clientSecret' | translate }}</label>
              <input 
                type="password" 
                class="form-input"
                formControlName="clientSecret"
                placeholder="{{ 'settings.integrations.accounting.clientSecretPlaceholder' | translate }}"
                [disabled]="!integrationForm.get('accountingEnabled')?.value">
            </div>

            <div>
              <label class="form-label">{{ 'settings.integrations.accounting.syncFrequency' | translate }}</label>
              <select 
                class="form-select"
                formControlName="syncFrequency"
                [disabled]="!integrationForm.get('accountingEnabled')?.value">
                <option value="realtime">{{ 'settings.integrations.common.frequencies.realtime' | translate }}</option>
                <option value="daily">{{ 'settings.integrations.common.frequencies.daily' | translate }}</option>
                <option value="weekly">{{ 'settings.integrations.common.frequencies.weekly' | translate }}</option>
                <option value="monthly">{{ 'settings.integrations.common.frequencies.monthly' | translate }}</option>
              </select>
            </div>

            <div class="md:col-span-2">
              <div class="flex items-center space-x-3">
                <input 
                  type="checkbox" 
                  id="autoSync"
                  class="form-checkbox"
                  formControlName="autoSyncEnabled"
                  [disabled]="!integrationForm.get('accountingEnabled')?.value">
                <label for="autoSync" class="text-sm font-medium text-gray-300">{{ 'settings.integrations.accounting.autoSync' | translate }}</label>
              </div>
              <p class="text-sm text-gray-400 mt-1">{{ 'settings.integrations.accounting.autoSyncDescription' | translate }}</p>
            </div>

            <div class="flex items-center mt-6">
              <button 
                type="button"
                class="btn-secondary text-sm"
                (click)="testAccountingConnection()"
                [disabled]="!integrationForm.get('accountingEnabled')?.value || isTesting.accounting">
                @if (isTesting.accounting) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ 'settings.integrations.common.testing' | translate }}
                } @else {
                  {{ 'settings.integrations.common.testConnection' | translate }}
                }
              </button>
            </div>
          </div>
        </div>

        <!-- Integration Status -->
        <div>
          <h3 class="text-md font-medium text-white mb-4">{{ 'settings.integrations.status.title' | translate }}</h3>
          <div class="bg-gray-800/30 p-4 rounded-lg space-y-3">
            @for (status of integrationStatuses; track status.name) {
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-white">{{ 'settings.integrations.status.services.' + status.name.toLowerCase().replace(' ', '_') | translate }}</span>
                <div class="flex items-center space-x-2">
                  <div class="w-2 h-2 rounded-full" [class]="status.connected ? 'bg-green-500' : 'bg-red-500'"></div>
                  <span class="text-sm" [class]="status.connected ? 'text-green-400' : 'text-red-400'">
                    {{ status.connected ? ('settings.integrations.status.connected' | translate) : ('settings.integrations.status.disconnected' | translate) }}
                  </span>
                </div>
              </div>
            }
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
export class IntegrationSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);

  @Input() settings!: IntegrationSettings;
  @Output() save = new EventEmitter<Partial<IntegrationSettings>>();
  @Output() testIntegration = new EventEmitter<{ type: string; config: any }>();

  integrationForm!: FormGroup;
  isSaving = false;
  
  isTesting = {
    sms: false,
    email: false,
    payment: false,
    inventory: false,
    accounting: false
  };

  smsProviders = [
    { value: 'twilio', label: 'Twilio' },
    { value: 'nexmo', label: 'Vonage (Nexmo)' },
    { value: 'local', label: 'Local SMS Gateway' }
  ];

  emailProviders = [
    { value: 'gmail', label: 'Gmail' },
    { value: 'outlook', label: 'Outlook/Office 365' },
    { value: 'smtp', label: 'Custom SMTP' },
    { value: 'sendgrid', label: 'SendGrid' }
  ];

  paymentProviders = [
    { value: 'monei', label: 'Monei (Tunisia)' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'stripe', label: 'Stripe' },
    { value: 'local_bank', label: 'Local Bank Gateway' }
  ];

  inventoryProviders = [
    { value: 'custom', label: 'Custom Inventory System' },
    { value: 'odoo', label: 'Odoo' },
    { value: 'zoho', label: 'Zoho Inventory' }
  ];

  accountingSoftware = [
    { value: 'custom', label: 'Custom Accounting' },
    { value: 'quickbooks', label: 'QuickBooks' },
    { value: 'sage', label: 'Sage' },
    { value: 'odoo', label: 'Odoo Accounting' }
  ];

  integrationStatuses = [
    { name: 'SMS Service', connected: false },
    { name: 'Email Service', connected: true },
    { name: 'Payment Gateway', connected: false },
    { name: 'Inventory System', connected: false },
    { name: 'Accounting Software', connected: false }
  ];

  ngOnInit() {
    this.initializeForm();
    this.populateForm();
  }

  ngOnChanges() {
    if (this.integrationForm && this.settings) {
      this.populateForm();
    }
  }

  private initializeForm() {
    this.integrationForm = this.fb.group({
      smsEnabled: [false],
      emailEnabled: [false],
      paymentEnabled: [false],
      inventoryEnabled: [false],
      accountingEnabled: [false],
      sms: this.fb.group({
        provider: ['twilio'],
        apiKey: [''],
        senderId: ['OpAuto']
      }),
      email: this.fb.group({
        provider: ['gmail'],
        smtpHost: [''],
        smtpPort: [587],
        username: [''],
        password: ['']
      }),
      paymentGateway: this.fb.group({
        provider: ['monei'],
        merchantId: [''],
        apiKey: [''],
        webhookUrl: [''],
        testMode: [true]
      }),
      inventory: this.fb.group({
        provider: ['custom'],
        apiEndpoint: [''],
        apiKey: [''],
        syncFrequency: ['daily'],
        autoOrderEnabled: [false]
      }),
      accounting: this.fb.group({
        software: ['custom'],
        apiEndpoint: [''],
        clientId: [''],
        clientSecret: [''],
        syncFrequency: ['daily'],
        autoSyncEnabled: [false]
      })
    });
  }

  private populateForm() {
    if (this.settings) {
      this.integrationForm.patchValue({
        smsEnabled: this.settings.smsProvider?.isEnabled ?? false,
        emailEnabled: this.settings.emailProvider?.isEnabled ?? false,
        paymentEnabled: this.settings.paymentGateway?.isEnabled ?? false,
        inventoryEnabled: this.settings.inventoryIntegration?.isEnabled ?? false,
        accountingEnabled: this.settings.accountingIntegration?.isEnabled ?? false,
        sms: {
          provider: this.settings.smsProvider?.provider ?? 'twilio',
          apiKey: this.settings.smsProvider?.configuration?.apiKey ?? '',
          senderId: this.settings.smsProvider?.configuration?.phoneNumber ?? 'OpAuto'
        },
        email: {
          provider: this.settings.emailProvider?.provider ?? 'gmail',
          smtpHost: this.settings.emailProvider?.configuration?.host ?? '',
          smtpPort: this.settings.emailProvider?.configuration?.port ?? 587,
          username: this.settings.emailProvider?.configuration?.username ?? '',
          password: this.settings.emailProvider?.configuration?.password ?? ''
        },
        paymentGateway: {
          provider: this.settings.paymentGateway?.provider ?? 'stripe',
          merchantId: this.settings.paymentGateway?.configuration?.merchantId ?? '',
          apiKey: this.settings.paymentGateway?.configuration?.apiKey ?? '',
          webhookUrl: this.settings.paymentGateway?.configuration?.endpoint ?? '',
          testMode: true
        },
        inventory: {
          provider: this.settings.inventoryIntegration?.provider ?? 'manual',
          apiEndpoint: '',
          apiKey: '',
          syncFrequency: 'daily',
          autoOrderEnabled: this.settings.inventoryIntegration?.autoOrderThreshold ? true : false
        },
        accounting: {
          software: this.settings.accountingIntegration?.provider ?? 'none',
          apiEndpoint: '',
          clientId: '',
          clientSecret: '',
          syncFrequency: this.settings.accountingIntegration?.syncFrequency ?? 'daily',
          autoSyncEnabled: this.settings.accountingIntegration?.isEnabled ?? false
        }
      });
    }
  }

  isFieldInvalid(fieldPath: string): boolean {
    const field = this.integrationForm.get(fieldPath);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSave() {
    if (this.integrationForm.valid) {
      this.isSaving = true;
      const formValue = this.integrationForm.value;
      
      const updatedIntegrationSettings: Partial<IntegrationSettings> = {
        smsProvider: {
          provider: formValue.sms.provider,
          isEnabled: formValue.smsEnabled,
          configuration: {
            apiKey: formValue.sms.apiKey,
            phoneNumber: formValue.sms.senderId
          }
        },
        emailProvider: {
          provider: formValue.email.provider,
          isEnabled: formValue.emailEnabled,
          configuration: {
            host: formValue.email.smtpHost,
            port: formValue.email.smtpPort,
            username: formValue.email.username,
            password: formValue.email.password,
            fromEmail: formValue.email.username,
            fromName: 'OpAuto Garage'
          }
        },
        paymentGateway: {
          provider: formValue.paymentGateway.provider,
          isEnabled: formValue.paymentEnabled,
          configuration: {
            apiKey: formValue.paymentGateway.apiKey,
            merchantId: formValue.paymentGateway.merchantId,
            endpoint: formValue.paymentGateway.webhookUrl
          }
        },
        inventoryIntegration: {
          provider: formValue.inventory.provider,
          isEnabled: formValue.inventoryEnabled,
          autoOrderThreshold: formValue.inventory.autoOrderEnabled ? 5 : 0,
          preferredSuppliers: this.settings?.inventoryIntegration?.preferredSuppliers || [],
          configuration: {}
        },
        accountingIntegration: {
          provider: formValue.accounting.software,
          isEnabled: formValue.accountingEnabled,
          syncFrequency: formValue.accounting.syncFrequency,
          configuration: {
            apiEndpoint: formValue.accounting.apiEndpoint,
            clientId: formValue.accounting.clientId,
            clientSecret: formValue.accounting.clientSecret
          }
        }
      };

      this.save.emit(updatedIntegrationSettings);
      
      setTimeout(() => {
        this.isSaving = false;
      }, 1000);
    }
  }

  async testSmsConnection() {
    this.isTesting.sms = true;
    const smsConfig = this.integrationForm.get('sms')?.value;
    this.testIntegration.emit({ type: 'sms', config: smsConfig });
    
    setTimeout(() => {
      this.isTesting.sms = false;
      this.updateIntegrationStatus('SMS Service', true);
    }, 2000);
  }

  async testEmailConnection() {
    this.isTesting.email = true;
    const emailConfig = this.integrationForm.get('email')?.value;
    this.testIntegration.emit({ type: 'email', config: emailConfig });
    
    setTimeout(() => {
      this.isTesting.email = false;
      this.updateIntegrationStatus('Email Service', true);
    }, 2000);
  }

  async testPaymentConnection() {
    this.isTesting.payment = true;
    const paymentConfig = this.integrationForm.get('paymentGateway')?.value;
    this.testIntegration.emit({ type: 'payment', config: paymentConfig });
    
    setTimeout(() => {
      this.isTesting.payment = false;
      this.updateIntegrationStatus('Payment Gateway', true);
    }, 2000);
  }

  async testInventoryConnection() {
    this.isTesting.inventory = true;
    const inventoryConfig = this.integrationForm.get('inventory')?.value;
    this.testIntegration.emit({ type: 'inventory', config: inventoryConfig });
    
    setTimeout(() => {
      this.isTesting.inventory = false;
      this.updateIntegrationStatus('Inventory System', true);
    }, 2000);
  }

  async testAccountingConnection() {
    this.isTesting.accounting = true;
    const accountingConfig = this.integrationForm.get('accounting')?.value;
    this.testIntegration.emit({ type: 'accounting', config: accountingConfig });
    
    setTimeout(() => {
      this.isTesting.accounting = false;
      this.updateIntegrationStatus('Accounting Software', true);
    }, 2000);
  }

  private updateIntegrationStatus(serviceName: string, connected: boolean) {
    const status = this.integrationStatuses.find(s => s.name === serviceName);
    if (status) {
      status.connected = connected;
    }
  }

  resetForm() {
    this.populateForm();
    this.integrationForm.markAsPristine();
    this.integrationForm.markAsUntouched();
  }
}