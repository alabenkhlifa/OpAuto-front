import { Component, inject, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CarService, CarWithHistory } from '../services/car.service';
import { Customer } from '../../../core/models/customer.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-car-registration-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="modal-overlay" (click)="onClose()">
      <div class="modal-container glass-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">{{ 'cars.registerNewCar' | translate }}</h2>
          <button type="button" class="close-btn" (click)="onClose()">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <form [formGroup]="carForm" (ngSubmit)="onSubmit()">
          <div class="form-grid">
            <!-- License Plate -->
            <div class="form-group">
              <label for="licensePlate" class="form-label">{{ 'cars.licensePlateRequired' | translate }}</label>
              <input
                id="licensePlate"
                type="text"
                formControlName="licensePlate"
                class="form-input"
                placeholder="{{ 'cars.licensePlatePlaceholder' | translate }}"
                [class.error]="licensePlate?.invalid && (licensePlate?.dirty || licensePlate?.touched)"
              />
              @if (licensePlate?.invalid && (licensePlate?.dirty || licensePlate?.touched)) {
                <div class="error-message">
                  @if (licensePlate?.errors?.['required']) {
                    {{ 'cars.licensePlate' | translate }} is required
                  }
                  @if (licensePlate?.errors?.['minlength']) {
                    {{ 'cars.licensePlate' | translate }} must be at least 3 characters
                  }
                </div>
              }
            </div>

            <!-- Make -->
            <div class="form-group">
              <label for="make" class="form-label">{{ 'cars.makeRequired' | translate }}</label>
              <input
                id="make"
                type="text"
                formControlName="make"
                class="form-input"
                placeholder="{{ 'cars.makePlaceholder' | translate }}"
                [class.error]="make?.invalid && (make?.dirty || make?.touched)"
              />
              @if (make?.invalid && (make?.dirty || make?.touched)) {
                <div class="error-message">{{ 'cars.make' | translate }} is required</div>
              }
            </div>

            <!-- Model -->
            <div class="form-group">
              <label for="model" class="form-label">{{ 'cars.modelRequired' | translate }}</label>
              <input
                id="model"
                type="text"
                formControlName="model"
                class="form-input"
                placeholder="{{ 'cars.modelPlaceholder' | translate }}"
                [class.error]="model?.invalid && (model?.dirty || model?.touched)"
              />
              @if (model?.invalid && (model?.dirty || model?.touched)) {
                <div class="error-message">{{ 'cars.model' | translate }} is required</div>
              }
            </div>

            <!-- Year -->
            <div class="form-group">
              <label for="year" class="form-label">{{ 'cars.yearRequired' | translate }}</label>
              <input
                id="year"
                type="number"
                formControlName="year"
                class="form-input"
                [min]="1990"
                [max]="currentYear + 1"
                placeholder="e.g., 2020"
                [class.error]="year?.invalid && (year?.dirty || year?.touched)"
              />
              @if (year?.invalid && (year?.dirty || year?.touched)) {
                <div class="error-message">
                  @if (year?.errors?.['required']) {
                    {{ 'cars.year' | translate }} is required
                  }
                  @if (year?.errors?.['min'] || year?.errors?.['max']) {
                    {{ 'cars.year' | translate }} must be between 1990 and {{ currentYear + 1 }}
                  }
                </div>
              }
            </div>

            <!-- Current Mileage -->
            <div class="form-group">
              <label for="currentMileage" class="form-label">{{ 'cars.currentMileageRequired' | translate }}</label>
              <input
                id="currentMileage"
                type="number"
                formControlName="currentMileage"
                class="form-input"
                placeholder="e.g., 45000"
                min="0"
                [class.error]="currentMileage?.invalid && (currentMileage?.dirty || currentMileage?.touched)"
              />
              @if (currentMileage?.invalid && (currentMileage?.dirty || currentMileage?.touched)) {
                <div class="error-message">
                  @if (currentMileage?.errors?.['required']) {
                    {{ 'cars.currentMileage' | translate }} is required
                  }
                  @if (currentMileage?.errors?.['min']) {
                    {{ 'cars.mileage' | translate }} cannot be negative
                  }
                </div>
              }
            </div>
          </div>

          <!-- Customer Selection Section -->
          <div class="customer-section">
            <h3 class="section-title">{{ 'cars.customerInformation' | translate }}</h3>
            
            <div class="customer-toggle">
              <div class="toggle-group">
                <label class="toggle-option">
                  <input
                    type="radio"
                    value="existing"
                    formControlName="customerType"
                    class="toggle-input"
                  />
                  <span class="toggle-label">{{ 'cars.existingCustomer' | translate }}</span>
                </label>
                <label class="toggle-option">
                  <input
                    type="radio"
                    value="new"
                    formControlName="customerType"
                    class="toggle-input"
                  />
                  <span class="toggle-label">{{ 'cars.newCustomer' | translate }}</span>
                </label>
              </div>
            </div>

            @if (customerType?.value === 'existing') {
              <div class="form-group">
                <label for="customerId" class="form-label">{{ 'cars.selectCustomerRequired' | translate }}</label>
                <select
                  id="customerId"
                  formControlName="customerId"
                  class="form-select"
                  [class.error]="customerId?.invalid && (customerId?.dirty || customerId?.touched)"
                >
                  <option value="">{{ 'cars.chooseCustomer' | translate }}</option>
                  @for (customer of customers(); track customer.id) {
                    <option [value]="customer.id">{{ customer.name }} - {{ customer.phone }}</option>
                  }
                </select>
                @if (customerId?.invalid && (customerId?.dirty || customerId?.touched)) {
                  <div class="error-message">Please select a {{ 'common.customer' | translate }}</div>
                }
              </div>
            }

            @if (customerType?.value === 'new') {
              <div class="new-customer-form">
                <div class="form-group">
                  <label for="customerName" class="form-label">{{ 'cars.customerName' | translate }} *</label>
                  <input
                    id="customerName"
                    type="text"
                    formControlName="customerName"
                    class="form-input"
                    placeholder="e.g., Ahmed Ben Ali"
                    [class.error]="customerName?.invalid && (customerName?.dirty || customerName?.touched)"
                  />
                  @if (customerName?.invalid && (customerName?.dirty || customerName?.touched)) {
                    <div class="error-message">{{ 'cars.customerName' | translate }} is required</div>
                  }
                </div>

                <div class="form-group">
                  <label for="customerPhone" class="form-label">{{ 'cars.phoneNumber' | translate }} *</label>
                  <input
                    id="customerPhone"
                    type="tel"
                    formControlName="customerPhone"
                    class="form-input"
                    placeholder="e.g., +216-20-123-456"
                    [class.error]="customerPhone?.invalid && (customerPhone?.dirty || customerPhone?.touched)"
                  />
                  @if (customerPhone?.invalid && (customerPhone?.dirty || customerPhone?.touched)) {
                    <div class="error-message">
                      @if (customerPhone?.errors?.['required']) {
                        {{ 'cars.phoneNumber' | translate }} is required
                      }
                      @if (customerPhone?.errors?.['pattern']) {
                        Please enter a valid {{ 'cars.phoneNumber' | translate }}
                      }
                    </div>
                  }
                </div>

                <div class="form-group">
                  <label for="customerEmail" class="form-label">{{ 'cars.email' | translate }} (Optional)</label>
                  <input
                    id="customerEmail"
                    type="email"
                    formControlName="customerEmail"
                    class="form-input"
                    placeholder="e.g., ahmed.benali@email.tn"
                    [class.error]="customerEmail?.invalid && (customerEmail?.dirty || customerEmail?.touched)"
                  />
                  @if (customerEmail?.invalid && (customerEmail?.dirty || customerEmail?.touched)) {
                    <div class="error-message">Please enter a valid {{ 'cars.email' | translate }}</div>
                  }
                </div>
              </div>
            }
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" (click)="onClose()">
              {{ 'common.cancel' | translate }}
            </button>
            <button 
              type="submit" 
              class="btn btn-primary"
              [disabled]="carForm.invalid || isSubmitting()"
            >
              @if (isSubmitting()) {
                <svg class="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ 'cars.registering' | translate }}...
              } @else {
                {{ 'cars.registerCar' | translate }}
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50;
      padding: 1rem;
    }

    .modal-container {
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      overflow-x: hidden;
      /* Permanent dark glassmorphism theme */
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      border: 1px solid rgba(75, 85, 99, 0.6);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2rem 2rem 1rem;
      border-bottom: 1px solid rgba(75, 85, 99, 0.3);
      margin-bottom: 1.5rem;
    }

    .modal-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }

    .close-btn {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 8px;
      transition: all 0.2s ease;
    }

    .close-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }

    form {
      padding: 0 2rem 2rem;
      width: 100%;
      box-sizing: border-box;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
      margin-bottom: 2rem;
      width: 100%;
      box-sizing: border-box;
    }

    @media (max-width: 640px) {
      .form-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #d1d5db;
    }

    .form-input {
      padding: 0.75rem 1rem;
      border: 2px solid rgba(75, 85, 99, 0.4);
      border-radius: 12px;
      background: rgba(31, 41, 55, 0.8);
      color: #ffffff;
      font-size: 1rem;
      transition: all 0.2s ease;
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
      backdrop-filter: blur(10px);
    }

    .form-input::placeholder {
      color: #9ca3af;
    }

    .form-input:focus {
      outline: none;
      border-color: #3b82f6;
      background: rgba(31, 41, 55, 0.95);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .form-input.error {
      border-color: #ef4444;
      background: rgba(127, 29, 29, 0.3);
    }

    .error-message {
      font-size: 0.75rem;
      color: #ef4444;
      margin-top: 0.25rem;
    }

    .customer-section {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: rgba(31, 41, 55, 0.6);
      border: 1px solid rgba(75, 85, 99, 0.6);
      border-radius: 12px;
      backdrop-filter: blur(10px);
    }

    .section-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 1rem;
    }

    .customer-toggle {
      margin-bottom: 1.5rem;
    }

    .toggle-group {
      display: flex;
      background: rgba(55, 65, 81, 0.5);
      border-radius: 12px;
      padding: 0.25rem;
      backdrop-filter: blur(5px);
    }

    .toggle-option {
      flex: 1;
      display: block;
      cursor: pointer;
    }

    .toggle-input {
      display: none;
    }

    .toggle-label {
      display: block;
      padding: 0.75rem 1rem;
      text-align: center;
      border-radius: 8px;
      font-weight: 500;
      color: #9ca3af;
      transition: all 0.2s ease;
    }

    .toggle-input:checked + .toggle-label {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8));
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      backdrop-filter: blur(10px);
    }

    .new-customer-form {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }

    @media (max-width: 640px) {
      .new-customer-form {
        grid-template-columns: 1fr;
        gap: 1rem;
      }
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(75, 85, 99, 0.3);
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 12px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 120px;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: rgba(75, 85, 99, 0.6);
      color: #d1d5db;
      border: 1px solid rgba(75, 85, 99, 0.4);
      backdrop-filter: blur(10px);
    }

    .btn-secondary:hover:not(:disabled) {
      background: rgba(107, 114, 128, 0.6);
      border-color: rgba(107, 114, 128, 0.6);
      color: #ffffff;
    }

    .btn-primary {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.8));
      color: white;
      border: 1px solid rgba(59, 130, 246, 0.6);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      backdrop-filter: blur(10px);
    }

    .btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.9), rgba(29, 78, 216, 0.9));
      border-color: rgba(37, 99, 235, 0.7);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
      transform: translateY(-1px);
    }

    .animate-spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 640px) {
      .modal-container {
        margin: 1rem;
        max-height: calc(100vh - 2rem);
      }

      .modal-header {
        padding: 1.5rem 1.5rem 1rem;
      }

      form {
        padding: 0 1.5rem 1.5rem;
      }

      .form-actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
      }
    }
  `]
})
export class CarRegistrationFormComponent {
  private formBuilder = inject(FormBuilder);
  private carService = inject(CarService);
  private translationService = inject(TranslationService);

  @Output() close = new EventEmitter<void>();
  @Output() carRegistered = new EventEmitter<CarWithHistory>();

  customers = signal<Customer[]>([]);
  isSubmitting = signal(false);
  currentYear = new Date().getFullYear();

  carForm: FormGroup;

  constructor() {
    this.carForm = this.formBuilder.group({
      licensePlate: ['', [Validators.required, Validators.minLength(3)]],
      make: ['', [Validators.required]],
      model: ['', [Validators.required]],
      year: [this.currentYear, [Validators.required, Validators.min(1990), Validators.max(this.currentYear + 1)]],
      currentMileage: [0, [Validators.required, Validators.min(0)]],
      customerType: ['existing', [Validators.required]],
      customerId: [''],
      customerName: [''],
      customerPhone: ['', [Validators.pattern(/^\+?[0-9\-\s\(\)]+$/)]],
      customerEmail: ['', [Validators.email]]
    });

    this.loadCustomers();
    this.setupValidationRules();
  }

  get licensePlate() { return this.carForm.get('licensePlate'); }
  get make() { return this.carForm.get('make'); }
  get model() { return this.carForm.get('model'); }
  get year() { return this.carForm.get('year'); }
  get currentMileage() { return this.carForm.get('currentMileage'); }
  get customerType() { return this.carForm.get('customerType'); }
  get customerId() { return this.carForm.get('customerId'); }
  get customerName() { return this.carForm.get('customerName'); }
  get customerPhone() { return this.carForm.get('customerPhone'); }
  get customerEmail() { return this.carForm.get('customerEmail'); }

  private setupValidationRules(): void {
    this.customerType?.valueChanges.subscribe(type => {
      if (type === 'existing') {
        this.customerId?.setValidators([Validators.required]);
        this.customerName?.clearValidators();
        this.customerPhone?.clearValidators();
      } else {
        this.customerId?.clearValidators();
        this.customerName?.setValidators([Validators.required]);
        this.customerPhone?.setValidators([Validators.required, Validators.pattern(/^\+?[0-9\-\s\(\)]+$/)]);
      }
      
      this.customerId?.updateValueAndValidity();
      this.customerName?.updateValueAndValidity();
      this.customerPhone?.updateValueAndValidity();
    });
  }

  private loadCustomers(): void {
    // TODO: Replace with actual customer service call
    // For now, using mock customers from car service
    const mockCustomers: Customer[] = [
      { id: 'customer1', name: 'Ahmed Ben Ali', phone: '+216-20-123-456', email: 'ahmed.benali@email.tn', registrationDate: new Date(), totalCars: 2, totalAppointments: 5, totalInvoices: 3, totalSpent: 1200, averageSpending: 400, status: 'active', preferredContactMethod: 'phone', loyaltyPoints: 50, createdAt: new Date(), updatedAt: new Date() },
      { id: 'customer2', name: 'Fatma Trabelsi', phone: '+216-25-789-123', email: 'fatma.trabelsi@email.tn', registrationDate: new Date(), totalCars: 1, totalAppointments: 3, totalInvoices: 2, totalSpent: 800, averageSpending: 400, status: 'active', preferredContactMethod: 'email', loyaltyPoints: 30, createdAt: new Date(), updatedAt: new Date() },
      { id: 'customer3', name: 'Mohamed Khemir', phone: '+216-22-456-789', email: 'mohamed.khemir@email.tn', registrationDate: new Date(), totalCars: 1, totalAppointments: 2, totalInvoices: 1, totalSpent: 500, averageSpending: 500, status: 'vip', preferredContactMethod: 'phone', loyaltyPoints: 75, createdAt: new Date(), updatedAt: new Date() },
      { id: 'customer4', name: 'Leila Mansouri', phone: '+216-28-654-321', email: 'leila.mansouri@email.tn', registrationDate: new Date(), totalCars: 3, totalAppointments: 8, totalInvoices: 6, totalSpent: 2100, averageSpending: 350, status: 'vip', preferredContactMethod: 'whatsapp', loyaltyPoints: 120, createdAt: new Date(), updatedAt: new Date() }
    ];
    this.customers.set(mockCustomers);
  }

  onSubmit(): void {
    if (this.carForm.valid) {
      this.isSubmitting.set(true);
      
      const formValue = this.carForm.value;
      let customerId = formValue.customerId;

      // If new customer, create customer first
      if (formValue.customerType === 'new') {
        // TODO: Call customer service to create new customer
        // For now, generate a mock ID
        customerId = 'customer_' + Date.now();
      }

      const newCar: Omit<CarWithHistory, 'id'> = {
        licensePlate: formValue.licensePlate,
        make: formValue.make,
        model: formValue.model,
        year: formValue.year,
        customerId: customerId,
        currentMileage: formValue.currentMileage,
        totalServices: 0,
        serviceStatus: 'up-to-date'
      };

      this.carService.createCar(newCar).subscribe({
        next: (car) => {
          this.isSubmitting.set(false);
          this.carRegistered.emit(car);
          this.onClose();
        },
        error: (error) => {
          console.error('Failed to register car:', error);
          this.isSubmitting.set(false);
          
          if (error.error === 'CAR_LIMIT_EXCEEDED') {
            // Show limit exceeded error
            alert(`Vehicle limit reached: ${error.message}`);
          } else {
            // Show generic error
            alert('Failed to register vehicle. Please try again.');
          }
        }
      });
    }
  }

  onClose(): void {
    this.close.emit();
  }
}