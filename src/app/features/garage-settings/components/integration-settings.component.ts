import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IntegrationSettings } from '../../../core/models/garage-settings.model';

@Component({
  selector: 'app-integration-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Integration Settings</h2>
        <div class="flex space-x-2">
          <button 
            type="button"
            class="btn-secondary text-sm"
            (click)="resetForm()">
            Reset
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
              Saving...
            } @else {
              Save Changes
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
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              formControlName="smsEnabled">
            <h3 class="text-md font-medium text-gray-900 dark:text-white">SMS Integration</h3>
          </div>
          
          <div formGroupName="sms" class="grid grid-cols-1 md:grid-cols-2 gap-4" [class.opacity-50]="!integrationForm.get('smsEnabled')?.value">
            <div>
              <label class="form-label">Provider</label>
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
              <label class="form-label">API Key</label>
              <input 
                type="password" 
                class="form-input"
                formControlName="apiKey"
                placeholder="Enter your SMS API key"
                [disabled]="!integrationForm.get('smsEnabled')?.value">
            </div>

            <div>
              <label class="form-label">Sender ID</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="senderId"
                placeholder="OpAuto"
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
                  Testing...
                } @else {
                  Test Connection
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
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              formControlName="emailEnabled">
            <h3 class="text-md font-medium text-gray-900 dark:text-white">Email Integration</h3>
          </div>
          
          <div formGroupName="email" class="grid grid-cols-1 md:grid-cols-2 gap-4" [class.opacity-50]="!integrationForm.get('emailEnabled')?.value">
            <div>
              <label class="form-label">Provider</label>
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
              <label class="form-label">SMTP Host</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="smtpHost"
                placeholder="smtp.gmail.com"
                [disabled]="!integrationForm.get('emailEnabled')?.value">
            </div>

            <div>
              <label class="form-label">SMTP Port</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="smtpPort"
                placeholder="587"
                [disabled]="!integrationForm.get('emailEnabled')?.value">
            </div>

            <div>
              <label class="form-label">Username</label>
              <input 
                type="email" 
                class="form-input"
                formControlName="username"
                placeholder="your-email@gmail.com"
                [disabled]="!integrationForm.get('emailEnabled')?.value">
            </div>

            <div>
              <label class="form-label">Password</label>
              <input 
                type="password" 
                class="form-input"
                formControlName="password"
                placeholder="Enter your email password"
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
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Testing...
                } @else {
                  Test Connection
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
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              formControlName="paymentEnabled">
            <h3 class="text-md font-medium text-gray-900 dark:text-white">Payment Gateway</h3>
          </div>
          
          <div formGroupName="paymentGateway" class="grid grid-cols-1 md:grid-cols-2 gap-4" [class.opacity-50]="!integrationForm.get('paymentEnabled')?.value">
            <div>
              <label class="form-label">Provider</label>
              <select 
                class="form-select"
                formControlName="provider"
                [disabled]="!integrationForm.get('paymentEnabled')?.value">
                @for (provider of paymentProviders; track provider.value) {
                  <option [value]="provider.value">{{ provider.label }}</option>
                }
              </select>
            </div>

            <div>
              <label class="form-label">Merchant ID</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="merchantId"
                placeholder="Enter merchant ID"
                [disabled]="!integrationForm.get('paymentEnabled')?.value">
            </div>

            <div>
              <label class="form-label">API Key</label>
              <input 
                type="password" 
                class="form-input"
                formControlName="apiKey"
                placeholder="Enter payment gateway API key"
                [disabled]="!integrationForm.get('paymentEnabled')?.value">
            </div>

            <div>
              <label class="form-label">Webhook URL</label>
              <input 
                type="url" 
                class="form-input"
                formControlName="webhookUrl"
                placeholder="https://yourdomain.com/webhook"
                [disabled]="!integrationForm.get('paymentEnabled')?.value">
            </div>

            <div class="md:col-span-2">
              <div class="flex items-center space-x-3">
                <input 
                  type="checkbox" 
                  id="testMode"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  formControlName="testMode"
                  [disabled]="!integrationForm.get('paymentEnabled')?.value">
                <label for="testMode" class="form-label">Test Mode</label>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Use sandbox environment for testing payments</p>
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
                  Testing...
                } @else {
                  Test Connection
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
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              formControlName="inventoryEnabled">
            <h3 class="text-md font-medium text-gray-900 dark:text-white">Inventory Management</h3>
          </div>
          
          <div formGroupName="inventory" class="grid grid-cols-1 md:grid-cols-2 gap-4" [class.opacity-50]="!integrationForm.get('inventoryEnabled')?.value">
            <div>
              <label class="form-label">Provider</label>
              <select 
                class="form-select"
                formControlName="provider"
                [disabled]="!integrationForm.get('inventoryEnabled')?.value">
                @for (provider of inventoryProviders; track provider.value) {
                  <option [value]="provider.value">{{ provider.label }}</option>
                }
              </select>
            </div>

            <div>
              <label class="form-label">API Endpoint</label>
              <input 
                type="url" 
                class="form-input"
                formControlName="apiEndpoint"
                placeholder="https://api.parts-supplier.com/v1"
                [disabled]="!integrationForm.get('inventoryEnabled')?.value">
            </div>

            <div>
              <label class="form-label">API Key</label>
              <input 
                type="password" 
                class="form-input"
                formControlName="apiKey"
                placeholder="Enter inventory API key"
                [disabled]="!integrationForm.get('inventoryEnabled')?.value">
            </div>

            <div>
              <label class="form-label">Sync Frequency</label>
              <select 
                class="form-select"
                formControlName="syncFrequency"
                [disabled]="!integrationForm.get('inventoryEnabled')?.value">
                <option value="realtime">Real-time</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <div class="md:col-span-2">
              <div class="flex items-center space-x-3">
                <input 
                  type="checkbox" 
                  id="autoOrder"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  formControlName="autoOrderEnabled"
                  [disabled]="!integrationForm.get('inventoryEnabled')?.value">
                <label for="autoOrder" class="form-label">Auto-order when stock is low</label>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Automatically create purchase orders when parts reach minimum stock levels</p>
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
                  Testing...
                } @else {
                  Test Connection
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
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              formControlName="accountingEnabled">
            <h3 class="text-md font-medium text-gray-900 dark:text-white">Accounting Software</h3>
          </div>
          
          <div formGroupName="accounting" class="grid grid-cols-1 md:grid-cols-2 gap-4" [class.opacity-50]="!integrationForm.get('accountingEnabled')?.value">
            <div>
              <label class="form-label">Software</label>
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
              <label class="form-label">API Endpoint</label>
              <input 
                type="url" 
                class="form-input"
                formControlName="apiEndpoint"
                placeholder="https://api.accounting-software.com/v1"
                [disabled]="!integrationForm.get('accountingEnabled')?.value">
            </div>

            <div>
              <label class="form-label">Client ID</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="clientId"
                placeholder="Enter client ID"
                [disabled]="!integrationForm.get('accountingEnabled')?.value">
            </div>

            <div>
              <label class="form-label">Client Secret</label>
              <input 
                type="password" 
                class="form-input"
                formControlName="clientSecret"
                placeholder="Enter client secret"
                [disabled]="!integrationForm.get('accountingEnabled')?.value">
            </div>

            <div>
              <label class="form-label">Sync Frequency</label>
              <select 
                class="form-select"
                formControlName="syncFrequency"
                [disabled]="!integrationForm.get('accountingEnabled')?.value">
                <option value="realtime">Real-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div class="md:col-span-2">
              <div class="flex items-center space-x-3">
                <input 
                  type="checkbox" 
                  id="autoSync"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  formControlName="autoSyncEnabled"
                  [disabled]="!integrationForm.get('accountingEnabled')?.value">
                <label for="autoSync" class="form-label">Auto-sync invoices and expenses</label>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Automatically synchronize financial data with your accounting software</p>
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
                  Testing...
                } @else {
                  Test Connection
                }
              </button>
            </div>
          </div>
        </div>

        <!-- Integration Status -->
        <div>
          <h3 class="text-md font-medium text-gray-900 dark:text-white mb-4">Integration Status</h3>
          <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-3">
            @for (status of integrationStatuses; track status.name) {
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ status.name }}</span>
                <div class="flex items-center space-x-2">
                  <div class="w-2 h-2 rounded-full" [class]="status.connected ? 'bg-green-500' : 'bg-red-500'"></div>
                  <span class="text-sm" [class]="status.connected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                    {{ status.connected ? 'Connected' : 'Disconnected' }}
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
    .form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.25rem;
    }
    
    .dark .form-label {
      color: #d1d5db;
    }
    
    .form-input, .form-select, .form-textarea {
      display: block;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      background-color: white;
      color: #111827;
      font-size: 0.875rem;
    }
    
    .form-input:focus, .form-select:focus, .form-textarea:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    
    .dark .form-input, .dark .form-select, .dark .form-textarea {
      background-color: #1f2937;
      border-color: #4b5563;
      color: #f9fafb;
    }
    
    .dark .form-input:focus, .dark .form-select:focus, .dark .form-textarea:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .btn-primary {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border: 1px solid transparent;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.375rem;
      color: white;
      background-color: #2563eb;
      gap: 0.5rem;
    }
    
    .btn-primary:hover:not(:disabled) {
      background-color: #1d4ed8;
    }
    
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border: 1px solid #d1d5db;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.375rem;
      color: #374151;
      background-color: white;
      gap: 0.5rem;
    }
    
    .btn-secondary:hover {
      background-color: #f9fafb;
    }
    
    .dark .btn-secondary {
      border-color: #4b5563;
      color: #d1d5db;
      background-color: #1f2937;
    }
    
    .dark .btn-secondary:hover {
      background-color: #374151;
    }
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