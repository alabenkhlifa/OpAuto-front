import { Component, inject, signal, Output, EventEmitter, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CarService, CarWithHistory } from '../services/car.service';
import { Customer } from '../../../core/models/customer.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-car-registration-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <!-- Modal Overlay -->
    <div class="modal-overlay" (click)="onClose()">
      <!-- Modal Content -->
      <div class="modal-content" (click)="$event.stopPropagation()">
        
        <!-- Modal Header -->
        <header class="modal-header">
          <div class="modal-title-section">
            <h2 class="modal-title">{{ 'cars.registerNewCar' | translate }}</h2>
            <p class="modal-subtitle">{{ addVehicleToGarageLabel() || ('cars.addVehicleToGarage' | translate) }}</p>
          </div>
          <button class="modal-close-btn" (click)="onClose()">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <!-- Modal Body -->
        @if (translationsReady()) {
          <form [formGroup]="carForm" class="modal-form">
          
          <!-- Vehicle Information -->
          <div class="form-section">
            <h3 class="section-title">{{ 'cars.vehicleInformation' | translate }}</h3>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ 'cars.licensePlateRequired' | translate }}</label>
                <input
                  type="text"
                  formControlName="licensePlate"
                  class="form-input"
                  placeholder="{{ 'cars.licensePlatePlaceholder' | translate }}"
                />
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ 'cars.makeRequired' | translate }}</label>
                <input
                  type="text"
                  formControlName="make"
                  class="form-input"
                  placeholder="{{ 'cars.makePlaceholder' | translate }}"
                />
              </div>
              <div class="form-group flex-1">
                <label class="form-label">{{ 'cars.modelRequired' | translate }}</label>
                <input
                  type="text"
                  formControlName="model"
                  class="form-input"
                  placeholder="{{ 'cars.modelPlaceholder' | translate }}"
                />
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ 'cars.yearRequired' | translate }}</label>
                <input
                  type="number"
                  formControlName="year"
                  class="form-input"
                  [min]="1990"
                  [max]="currentYear + 1"
                  placeholder="e.g., 2025"
                />
              </div>
              <div class="form-group">
                <label class="form-label">{{ currentMileageLabel() }}</label>
                <input
                  type="number"
                  formControlName="currentMileage"
                  class="form-input"
                  placeholder="e.g., 45000"
                  min="0"
                />
              </div>
            </div>
          </div>


          <!-- Customer Information -->
          <div class="form-section">
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
                <label class="form-label">{{ 'cars.selectCustomerRequired' | translate }}</label>
                <select formControlName="customerId" class="form-select">
                  <option value="">{{ chooseCustomerLabel() }}</option>
                  @for (customer of customers(); track customer.id) {
                    <option [value]="customer.id">{{ customer.name }} - {{ customer.phone }}</option>
                  }
                </select>
              </div>
            }

            @if (customerType?.value === 'new') {
              <div class="form-row">
                <div class="form-group flex-1">
                  <label class="form-label">{{ 'cars.customerName' | translate }} *</label>
                  <input
                    type="text"
                    formControlName="customerName"
                    class="form-input"
                    placeholder="e.g., Ahmed Ben Ali"
                  />
                </div>
                <div class="form-group flex-1">
                  <label class="form-label">{{ 'cars.phoneNumber' | translate }} *</label>
                  <input
                    type="tel"
                    formControlName="customerPhone"
                    class="form-input"
                    placeholder="e.g., +216-20-123-456"
                  />
                </div>
              </div>
              
              <div class="form-group">
                <label class="form-label">{{ 'cars.email' | translate }} (Optional)</label>
                <input
                  type="email"
                  formControlName="customerEmail"
                  class="form-input"
                  placeholder="e.g., ahmed.benali@email.tn"
                />
              </div>
            }
          </div>

        </form>
        } @else {
          <!-- Loading state while translations are being initialized -->
          <div class="modal-form">
            <div class="loading-container">
              <div class="loading-spinner"></div>
              <p class="loading-text">Loading...</p>
            </div>
          </div>
        }

        <!-- Modal Footer -->
        <footer class="modal-footer">
          <button type="button" class="modal-btn secondary" (click)="onClose()">
            {{ 'common.cancel' | translate }}
          </button>
          <button type="button" class="modal-btn primary" 
                  [disabled]="!carForm.valid || isSubmitting()"
                  (click)="onSubmit()">
            <span *ngIf="!isSubmitting()">{{ 'cars.registerCar' | translate }}</span>
            <span *ngIf="isSubmitting()" class="flex items-center gap-2">
              <div class="submit-spinner"></div>
              {{ 'cars.registering' | translate }}
            </span>
          </button>
        </footer>

      </div>
    </div>
  `,
  styles: [`
    /* Dark Glassmorphism Modal Styles - Permanent Theme */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: overlayFadeIn 0.2s ease-out;
    }

    @keyframes overlayFadeIn {
      from { opacity: 0; backdrop-filter: blur(0px); }
      to { opacity: 1; backdrop-filter: blur(8px); }
    }

    .modal-content {
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
      animation: modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes modalSlideIn {
      from { 
        opacity: 0; 
        transform: translateY(20px) scale(0.95); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0) scale(1); 
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 2rem 2rem 1rem 2rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .modal-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 0.25rem 0;
    }

    .modal-subtitle {
      color: #d1d5db;
      font-size: 0.875rem;
      margin: 0;
    }

    .modal-close-btn {
      width: 2.5rem;
      height: 2.5rem;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #d1d5db;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .modal-close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.05);
      color: #ffffff;
    }

    /* Form Styles */
    .modal-form {
      padding: 2rem;
    }

    .form-section {
      margin-bottom: 2rem;
    }

    .section-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #ffffff;
      margin: 0 0 1rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .section-title:before {
      content: '';
      width: 4px;
      height: 1.5rem;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      border-radius: 2px;
    }

    .form-row {
      display: flex;
      gap: 1rem;
      align-items: flex-end;
    }

    @media (max-width: 767px) {
      .form-row {
        flex-direction: column;
        align-items: stretch;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #d1d5db;
    }

    .form-input,
    .form-select,
    .form-textarea {
      padding: 0.875rem 1rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      color: #ffffff;
      font-size: 0.875rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .form-input::placeholder,
    .form-textarea::placeholder {
      color: #9ca3af;
    }

    .form-input:focus,
    .form-select:focus,
    .form-textarea:focus {
      outline: none;
      border-color: #3b82f6;
      background: rgba(255, 255, 255, 0.1);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
      transform: translateY(-1px);
    }

    .form-input:hover:not(:focus),
    .form-select:hover:not(:focus),
    .form-textarea:hover:not(:focus) {
      border-color: rgba(255, 255, 255, 0.3);
      background-color: rgba(255, 255, 255, 0.08);
    }

    .form-select {
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 0.75rem center;
      background-repeat: no-repeat;
      background-size: 1.5em 1.5em;
      padding-right: 2.5rem;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
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

    /* Modal Footer */
    .modal-footer {
      display: flex;
      gap: 1rem;
      padding: 1.5rem 2rem 2rem 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    @media (max-width: 767px) {
      .modal-footer {
        flex-direction: column;
      }
    }

    .modal-btn {
      flex: 1;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      backdrop-filter: blur(10px);
    }

    .modal-btn.secondary {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #d1d5db;
    }

    .modal-btn.secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .modal-btn.primary {
      background: linear-gradient(135deg, #059669, #047857);
      border: 1px solid #059669;
      color: white;
      box-shadow: 0 4px 15px rgba(5, 150, 105, 0.3);
    }

    .modal-btn.primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #047857, #065f46);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4);
    }

    .modal-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
    }

    .submit-spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Custom scrollbar for modal */
    .modal-content::-webkit-scrollbar {
      width: 6px;
    }

    .modal-content::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }

    .modal-content::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
    }

    .modal-content::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    /* Loading state styles */
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      min-height: 200px;
    }

    .loading-spinner {
      width: 2rem;
      height: 2rem;
      border: 3px solid rgba(255, 255, 255, 0.2);
      border-top: 3px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }

    .loading-text {
      color: #d1d5db;
      font-size: 0.875rem;
      margin: 0;
    }
  `]
})
export class CarRegistrationFormComponent implements OnInit, OnDestroy {
  private formBuilder = inject(FormBuilder);
  private carService = inject(CarService);
  private translationService = inject(TranslationService);
  private cdr = inject(ChangeDetectorRef);

  @Output() close = new EventEmitter<void>();
  @Output() carRegistered = new EventEmitter<CarWithHistory>();

  customers = signal<Customer[]>([]);
  isSubmitting = signal(false);
  currentYear = new Date().getFullYear();
  
  // Translation signals for reactive updates
  currentMileageLabel = signal<string>('');
  chooseCustomerLabel = signal<string>('');
  addVehicleToGarageLabel = signal<string>('');
  
  // Translation readiness tracking
  translationsReady = signal<boolean>(false);
  
  private translationSubscription?: Subscription;

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

  ngOnInit(): void {
    this.initializeTranslations();
  }
  
  ngOnDestroy(): void {
    if (this.translationSubscription) {
      this.translationSubscription.unsubscribe();
    }
  }
  
  private initializeTranslations(): void {
    // First, do an immediate check - translations might already be available
    const currentTranslations = this.translationService.getCurrentTranslations();
    if (this.hasRequiredTranslations(currentTranslations)) {
      // Translations are already loaded! Use them immediately
      this.updateTranslationSignals();
      this.translationsReady.set(true);
      return;
    }
    
    // If specific translations aren't available, show fallbacks immediately
    // This eliminates any loading delay
    this.setFallbackTranslations();
    this.translationsReady.set(true);
    
    // In the background, try to load proper translations for next time
    // Only reload if we have no translations at all
    if (!currentTranslations || Object.keys(currentTranslations).length === 0) {
      this.translationService.forceReloadTranslations();
    }
    
    // Listen for translation updates to replace fallbacks with real translations
    this.translationSubscription = this.translationService.translations$.subscribe(translations => {
      if (this.hasRequiredTranslations(translations)) {
        this.updateTranslationSignals();
      }
    });
  }
  
  private hasRequiredTranslations(translations: any): boolean {
    if (!translations || typeof translations !== 'object') return false;
    
    // Check for the specific nested structure we need
    return translations.cars && 
           typeof translations.cars === 'object' &&
           translations.cars.currentMileageRequired &&
           translations.cars.chooseCustomer &&
           translations.cars.addVehicleToGarage;
  }
  
  private updateTranslationSignals(): void {
    const currentMileage = this.translationService.instant('cars.currentMileageRequired');
    const chooseCustomer = this.translationService.instant('cars.chooseCustomer');
    const addVehicleToGarage = this.translationService.instant('cars.addVehicleToGarage');
    
    // Only update if we get actual translations (not the keys back)
    if (currentMileage !== 'cars.currentMileageRequired') {
      this.currentMileageLabel.set(currentMileage);
    }
    
    if (chooseCustomer !== 'cars.chooseCustomer') {
      this.chooseCustomerLabel.set(chooseCustomer);
    }
    
    if (addVehicleToGarage !== 'cars.addVehicleToGarage') {
      this.addVehicleToGarageLabel.set(addVehicleToGarage);
    }
  }
  
  private setFallbackTranslations(): void {
    // Set English fallbacks if translations fail to load
    this.currentMileageLabel.set('Current Mileage Required *');
    this.chooseCustomerLabel.set('Choose Customer');
    this.addVehicleToGarageLabel.set('Add Vehicle to Garage and Create Customer Profile');
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