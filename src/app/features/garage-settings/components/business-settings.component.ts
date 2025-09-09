import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BusinessSettings, PaymentMethod } from '../../../core/models/garage-settings.model';

@Component({
  selector: 'app-business-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      
      <!-- Tax Settings -->
      <div class="glass-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">Tax Settings</h3>
          <button 
            type="button"
            class="btn-primary text-sm"
            [disabled]="taxForm.invalid"
            (click)="saveTaxSettings()">
            Save Tax Settings
          </button>
        </div>

        <form [formGroup]="taxForm" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="form-label">Default Tax Rate (%)</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="defaultTaxRate"
                min="0"
                max="100"
                step="0.1"
                [class.border-red-500]="isTaxFieldInvalid('defaultTaxRate')">
              @if (isTaxFieldInvalid('defaultTaxRate')) {
                <p class="mt-1 text-sm text-red-400">Tax rate must be between 0 and 100</p>
              }
            </div>

            <div>
              <label class="form-label">Tax Label</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="taxLabel"
                placeholder="TVA, VAT, GST">
            </div>

            <div>
              <label class="form-label">Tax ID</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="taxId"
                placeholder="TN123456789">
            </div>
          </div>

          <div class="space-y-3">
            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="taxIncluded">
              <span class="text-sm font-medium text-gray-300">Tax included in prices</span>
            </label>

            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="applyTaxToLabor">
              <span class="text-sm font-medium text-gray-300">Apply tax to labor charges</span>
            </label>

            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="applyTaxToParts">
              <span class="text-sm font-medium text-gray-300">Apply tax to parts</span>
            </label>
          </div>
        </form>
      </div>

      <!-- Payment Settings -->
      <div class="glass-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">Payment Settings</h3>
          <button 
            type="button"
            class="btn-primary text-sm"
            (click)="savePaymentSettings()">
            Save Payment Settings
          </button>
        </div>

        <form [formGroup]="paymentForm" class="space-y-4">
          <div>
            <label class="form-label">Accepted Payment Methods</label>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              @for (method of paymentMethods; track method.value) {
                <label class="flex items-center p-3 border border-gray-600 rounded-lg hover:bg-gray-700/50 cursor-pointer">
                  <input 
                    type="checkbox" 
                    class="form-checkbox mr-3"
                    [value]="method.value"
                    [checked]="isPaymentMethodSelected(method.value)"
                    (change)="onPaymentMethodChange(method.value, $event)">
                  <div>
                    <div class="font-medium text-white">{{ method.label }}</div>
                    <div class="text-sm text-gray-400">{{ method.description }}</div>
                  </div>
                </label>
              }
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="form-label">Late Fee (%)</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="lateFeePercentage"
                min="0"
                max="25"
                step="0.5">
            </div>

            <div>
              <label class="form-label">Late Fee Grace Period (days)</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="lateFeeGracePeriodDays"
                min="0"
                max="30">
            </div>
          </div>

          <div>
            <label class="form-label">Default Payment Terms</label>
            <textarea 
              class="form-textarea"
              formControlName="defaultPaymentTerms"
              rows="2"
              placeholder="Payment due upon completion of service">
            </textarea>
          </div>

          <div class="space-y-3">
            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="allowPartialPayments">
              <span class="text-sm font-medium text-gray-300">Allow partial payments</span>
            </label>
          </div>
        </form>
      </div>

      <!-- Pricing Rules -->
      <div class="glass-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">Pricing Rules</h3>
          <button 
            type="button"
            class="btn-primary text-sm"
            (click)="savePricingRules()">
            Save Pricing Rules
          </button>
        </div>

        <form [formGroup]="pricingForm" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="form-label">Labor Rate per Hour ({{ settings.currency || 'TND' }})</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="laborRatePerHour"
                min="0"
                step="5">
            </div>

            <div>
              <label class="form-label">Weekend Surcharge (%)</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="weekendSurcharge"
                min="0"
                max="100"
                step="5">
            </div>

            <div>
              <label class="form-label">Urgent Job Surcharge (%)</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="urgentJobSurcharge"
                min="0"
                max="200"
                step="10">
            </div>

            <div>
              <label class="form-label">Loyal Customer Discount (%)</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="loyalCustomerDiscountPercentage"
                min="0"
                max="50"
                step="1">
            </div>

            <div>
              <label class="form-label">Bulk Discount Threshold ({{ settings.currency || 'TND' }})</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="bulkDiscountThreshold"
                min="0"
                step="100">
            </div>

            <div>
              <label class="form-label">Bulk Discount Percentage (%)</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="bulkDiscountPercentage"
                min="0"
                max="50"
                step="1">
            </div>
          </div>

          <div>
            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="autoApplyDiscounts">
              <span class="text-sm font-medium text-gray-300">Automatically apply discounts when applicable</span>
            </label>
          </div>
        </form>
      </div>

      <!-- Invoice Settings -->
      <div class="glass-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">Invoice Settings</h3>
          <button 
            type="button"
            class="btn-primary text-sm"
            (click)="saveInvoiceSettings()">
            Save Invoice Settings
          </button>
        </div>

        <form [formGroup]="invoiceForm" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="form-label">Invoice Prefix</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="invoicePrefix"
                placeholder="INV">
            </div>

            <div>
              <label class="form-label">Number Format</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="invoiceNumberFormat"
                placeholder="INV-{YYYY}-{000001}">
            </div>

            <div>
              <label class="form-label">Next Invoice Number</label>
              <input 
                type="number" 
                class="form-input"
                formControlName="nextInvoiceNumber"
                min="1">
            </div>
          </div>

          <div>
            <label class="form-label">Default Payment Terms</label>
            <textarea 
              class="form-textarea"
              formControlName="defaultPaymentTerms"
              rows="2"
              placeholder="Payment terms and conditions">
            </textarea>
          </div>

          <div class="space-y-3">
            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="showItemCodes">
              <span class="text-sm font-medium text-gray-300">Show item codes on invoices</span>
            </label>

            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="showMechanicNames">
              <span class="text-sm font-medium text-gray-300">Show mechanic names on invoices</span>
            </label>

            <label class="flex items-center">
              <input 
                type="checkbox" 
                class="form-checkbox mr-2"
                formControlName="includeTermsAndConditions">
              <span class="text-sm font-medium text-gray-300">Include terms and conditions</span>
            </label>
          </div>

          @if (includeTermsAndConditions()) {
            <div>
              <label class="form-label">Terms and Conditions</label>
              <textarea 
                class="form-textarea"
                formControlName="termsAndConditions"
                rows="4"
                placeholder="Enter your terms and conditions">
              </textarea>
            </div>
          }

          <div>
            <label class="form-label">Invoice Footer Text</label>
            <input 
              type="text" 
              class="form-input"
              formControlName="footerText"
              placeholder="Thank you for choosing our garage!">
          </div>
        </form>
      </div>

    </div>
  `,
  styles: [`
    /* Component uses global form classes from /src/styles/forms.css */
    /* Component uses global button classes from /src/styles/buttons.css */
  `]
})
export class BusinessSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);

  @Input() settings!: BusinessSettings;
  @Output() save = new EventEmitter<Partial<BusinessSettings>>();

  taxForm!: FormGroup;
  paymentForm!: FormGroup;
  pricingForm!: FormGroup;
  invoiceForm!: FormGroup;

  selectedPaymentMethods: PaymentMethod[] = [];

  paymentMethods = [
    { value: 'cash' as PaymentMethod, label: 'Cash', description: 'Cash payments' },
    { value: 'card' as PaymentMethod, label: 'Credit/Debit Card', description: 'Card payments' },
    { value: 'bank-transfer' as PaymentMethod, label: 'Bank Transfer', description: 'Wire transfers' },
    { value: 'check' as PaymentMethod, label: 'Check', description: 'Bank checks' },
    { value: 'credit' as PaymentMethod, label: 'Credit Terms', description: 'Payment on account' }
  ];

  ngOnInit() {
    this.initializeForms();
    this.populateForms();
  }

  ngOnChanges() {
    if (this.taxForm && this.settings) {
      this.populateForms();
    }
  }

  private initializeForms() {
    this.taxForm = this.fb.group({
      defaultTaxRate: [19, [Validators.required, Validators.min(0), Validators.max(100)]],
      taxIncluded: [false],
      taxLabel: ['TVA'],
      taxId: [''],
      applyTaxToLabor: [true],
      applyTaxToParts: [true]
    });

    this.paymentForm = this.fb.group({
      defaultPaymentTerms: ['Payment due upon completion'],
      lateFeePercentage: [0, [Validators.min(0), Validators.max(25)]],
      lateFeeGracePeriodDays: [0, [Validators.min(0)]],
      allowPartialPayments: [false],
      requireDepositPercentage: [0, [Validators.min(0), Validators.max(100)]]
    });

    this.pricingForm = this.fb.group({
      laborRatePerHour: [30, [Validators.min(0)]],
      weekendSurcharge: [0, [Validators.min(0), Validators.max(100)]],
      urgentJobSurcharge: [0, [Validators.min(0), Validators.max(200)]],
      bulkDiscountThreshold: [0, [Validators.min(0)]],
      bulkDiscountPercentage: [0, [Validators.min(0), Validators.max(50)]],
      loyalCustomerDiscountPercentage: [0, [Validators.min(0), Validators.max(50)]],
      autoApplyDiscounts: [false]
    });

    this.invoiceForm = this.fb.group({
      invoicePrefix: ['INV'],
      invoiceNumberFormat: ['INV-{000001}'],
      nextInvoiceNumber: [1, [Validators.min(1)]],
      defaultPaymentTerms: ['Payment due upon completion'],
      showItemCodes: [false],
      showMechanicNames: [false],
      includeTermsAndConditions: [false],
      termsAndConditions: [''],
      footerText: ['']
    });
  }

  private populateForms() {
    if (this.settings) {
      this.taxForm.patchValue(this.settings.taxSettings);
      this.paymentForm.patchValue(this.settings.paymentSettings);
      this.pricingForm.patchValue(this.settings.pricingRules);
      this.invoiceForm.patchValue(this.settings.invoiceSettings);
      this.selectedPaymentMethods = [...this.settings.paymentSettings.acceptedMethods];
    }
  }

  isTaxFieldInvalid(fieldName: string): boolean {
    const field = this.taxForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  isPaymentMethodSelected(method: PaymentMethod): boolean {
    return this.selectedPaymentMethods.includes(method);
  }

  onPaymentMethodChange(method: PaymentMethod, event: any) {
    const isChecked = event.target.checked;
    
    if (isChecked) {
      this.selectedPaymentMethods.push(method);
    } else {
      this.selectedPaymentMethods = this.selectedPaymentMethods.filter(m => m !== method);
    }
  }

  includeTermsAndConditions(): boolean {
    return this.invoiceForm.get('includeTermsAndConditions')?.value || false;
  }

  saveTaxSettings() {
    if (this.taxForm.valid) {
      this.save.emit({
        taxSettings: this.taxForm.value
      });
    }
  }

  savePaymentSettings() {
    const paymentData = {
      ...this.paymentForm.value,
      acceptedMethods: this.selectedPaymentMethods
    };
    
    this.save.emit({
      paymentSettings: paymentData
    });
  }

  savePricingRules() {
    if (this.pricingForm.valid) {
      this.save.emit({
        pricingRules: this.pricingForm.value
      });
    }
  }

  saveInvoiceSettings() {
    if (this.invoiceForm.valid) {
      this.save.emit({
        invoiceSettings: this.invoiceForm.value
      });
    }
  }
}