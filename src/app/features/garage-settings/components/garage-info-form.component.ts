import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GarageInfo } from '../../../core/models/garage-settings.model';

@Component({
  selector: 'app-garage-info-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Garage Information</h2>
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
            [disabled]="garageForm.invalid || isSaving"
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

      <form [formGroup]="garageForm" class="space-y-6">
        
        <!-- Basic Information -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="form-label">Garage Name *</label>
            <input 
              type="text" 
              class="form-input"
              formControlName="name"
              [class.border-red-500]="isFieldInvalid('name')">
            @if (isFieldInvalid('name')) {
              <p class="mt-1 text-sm text-red-600 dark:text-red-400">Garage name is required</p>
            }
          </div>

          <div>
            <label class="form-label">Registration Number *</label>
            <input 
              type="text" 
              class="form-input"
              formControlName="registrationNumber"
              placeholder="RC-A-12345"
              [class.border-red-500]="isFieldInvalid('registrationNumber')">
            @if (isFieldInvalid('registrationNumber')) {
              <p class="mt-1 text-sm text-red-600 dark:text-red-400">Registration number is required</p>
            }
          </div>

          <div class="md:col-span-2">
            <label class="form-label">Description</label>
            <textarea 
              class="form-textarea"
              formControlName="description"
              rows="3"
              placeholder="Brief description of your garage services">
            </textarea>
          </div>
        </div>

        <!-- Contact Information -->
        <div>
          <h3 class="text-md font-medium text-gray-900 dark:text-white mb-4">Contact Information</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="form-label">Phone Number *</label>
              <input 
                type="tel" 
                class="form-input"
                formControlName="phone"
                placeholder="+216 71 123 456"
                [class.border-red-500]="isFieldInvalid('phone')">
              @if (isFieldInvalid('phone')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">Valid phone number is required</p>
              }
            </div>

            <div>
              <label class="form-label">Email Address *</label>
              <input 
                type="email" 
                class="form-input"
                formControlName="email"
                placeholder="contact@garage.tn"
                [class.border-red-500]="isFieldInvalid('email')">
              @if (isFieldInvalid('email')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">Valid email address is required</p>
              }
            </div>

            <div>
              <label class="form-label">Website</label>
              <input 
                type="url" 
                class="form-input"
                formControlName="website"
                placeholder="https://garage.tn">
            </div>

            <div>
              <label class="form-label">Tax ID *</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="taxId"
                placeholder="TN123456789"
                [class.border-red-500]="isFieldInvalid('taxId')">
              @if (isFieldInvalid('taxId')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">Tax ID is required</p>
              }
            </div>
          </div>
        </div>

        <!-- Address -->
        <div>
          <h3 class="text-md font-medium text-gray-900 dark:text-white mb-4">Address</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="form-label">Street Address *</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="address"
                placeholder="123 Avenue Habib Bourguiba"
                [class.border-red-500]="isFieldInvalid('address')">
              @if (isFieldInvalid('address')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">Address is required</p>
              }
            </div>

            <div>
              <label class="form-label">City *</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="city"
                placeholder="Tunis"
                [class.border-red-500]="isFieldInvalid('city')">
              @if (isFieldInvalid('city')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">City is required</p>
              }
            </div>

            <div>
              <label class="form-label">Postal Code *</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="postalCode"
                placeholder="1000"
                [class.border-red-500]="isFieldInvalid('postalCode')">
              @if (isFieldInvalid('postalCode')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">Postal code is required</p>
              }
            </div>

            <div>
              <label class="form-label">Country *</label>
              <select 
                class="form-select"
                formControlName="country"
                [class.border-red-500]="isFieldInvalid('country')">
                <option value="Tunisia">Tunisia</option>
                <option value="Algeria">Algeria</option>
                <option value="Morocco">Morocco</option>
                <option value="Libya">Libya</option>
                <option value="Egypt">Egypt</option>
              </select>
              @if (isFieldInvalid('country')) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">Country is required</p>
              }
            </div>
          </div>
        </div>

        <!-- Bank Details -->
        <div>
          <h3 class="text-md font-medium text-gray-900 dark:text-white mb-4">Bank Details (Optional)</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4" formGroupName="bankDetails">
            <div>
              <label class="form-label">Bank Name</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="bankName"
                placeholder="Banque de Tunisie">
            </div>

            <div>
              <label class="form-label">Account Holder Name</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="accountHolderName"
                placeholder="Garage SARL">
            </div>

            <div>
              <label class="form-label">Account Number</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="accountNumber"
                placeholder="12345678901234567890">
            </div>

            <div>
              <label class="form-label">IBAN</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="iban"
                placeholder="TN5912345678901234567890">
            </div>

            <div>
              <label class="form-label">BIC/SWIFT Code</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="bic"
                placeholder="BTUNTNTT">
            </div>
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
export class GarageInfoFormComponent implements OnInit {
  private fb = inject(FormBuilder);

  @Input() garageInfo!: GarageInfo;
  @Output() save = new EventEmitter<Partial<GarageInfo>>();

  garageForm!: FormGroup;
  isSaving = false;

  ngOnInit() {
    this.initializeForm();
    this.populateForm();
  }

  ngOnChanges() {
    if (this.garageForm && this.garageInfo) {
      this.populateForm();
    }
  }

  private initializeForm() {
    this.garageForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      registrationNumber: ['', Validators.required],
      description: [''],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s-()]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      website: ['', Validators.pattern(/^https?:\/\/.+/)],
      taxId: ['', Validators.required],
      address: ['', Validators.required],
      city: ['', Validators.required],
      postalCode: ['', Validators.required],
      country: ['Tunisia', Validators.required],
      bankDetails: this.fb.group({
        bankName: [''],
        accountHolderName: [''],
        accountNumber: [''],
        iban: [''],
        bic: ['']
      })
    });
  }

  private populateForm() {
    if (this.garageInfo) {
      this.garageForm.patchValue({
        name: this.garageInfo.name,
        registrationNumber: this.garageInfo.registrationNumber,
        description: this.garageInfo.description || '',
        phone: this.garageInfo.phone,
        email: this.garageInfo.email,
        website: this.garageInfo.website || '',
        taxId: this.garageInfo.taxId,
        address: this.garageInfo.address,
        city: this.garageInfo.city,
        postalCode: this.garageInfo.postalCode,
        country: this.garageInfo.country,
        bankDetails: {
          bankName: this.garageInfo.bankDetails?.bankName || '',
          accountHolderName: this.garageInfo.bankDetails?.accountHolderName || '',
          accountNumber: this.garageInfo.bankDetails?.accountNumber || '',
          iban: this.garageInfo.bankDetails?.iban || '',
          bic: this.garageInfo.bankDetails?.bic || ''
        }
      });
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.garageForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSave() {
    if (this.garageForm.valid) {
      this.isSaving = true;
      const formValue = this.garageForm.value;
      
      const updatedGarageInfo: Partial<GarageInfo> = {
        name: formValue.name,
        registrationNumber: formValue.registrationNumber,
        description: formValue.description,
        phone: formValue.phone,
        email: formValue.email,
        website: formValue.website,
        taxId: formValue.taxId,
        address: formValue.address,
        city: formValue.city,
        postalCode: formValue.postalCode,
        country: formValue.country,
        bankDetails: formValue.bankDetails.bankName ? {
          bankName: formValue.bankDetails.bankName,
          accountHolderName: formValue.bankDetails.accountHolderName,
          accountNumber: formValue.bankDetails.accountNumber,
          iban: formValue.bankDetails.iban,
          bic: formValue.bankDetails.bic
        } : undefined
      };

      this.save.emit(updatedGarageInfo);
      
      // Reset saving state after a delay
      setTimeout(() => {
        this.isSaving = false;
      }, 1000);
    }
  }

  resetForm() {
    this.populateForm();
    this.garageForm.markAsPristine();
    this.garageForm.markAsUntouched();
  }
}