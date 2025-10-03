import { Component, Input, Output, EventEmitter, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { PartService } from '../../../core/services/part.service';
import { Part, PartWithStock, Supplier, PartCategory, PartUnit } from '../../../core/models/part.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-part-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <!-- Modal Overlay -->
    <div class="modal-overlay" (click)="onBackdropClick($event)">
      <!-- Modal Content -->
      <div class="modal-content" (click)="$event.stopPropagation()">
        
        <!-- Modal Header -->
        <header class="modal-header">
          <div class="modal-title-section">
            <h2 class="modal-title">{{ isEditMode() ? editPartText() : addNewPartText() }}</h2>
            <p class="modal-subtitle">{{ managePartInventoryText() }}</p>
          </div>
          <button class="modal-close-btn" (click)="onClose()">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <!-- Modal Body -->
        <form [formGroup]="partForm" class="modal-form">
          
          <!-- Basic Information -->
          <div class="form-section">
            <h3 class="section-title">{{ basicInformationText() }}</h3>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ partNameText() }} *</label>
                <input type="text" 
                       formControlName="name"
                       class="form-input"
                       [placeholder]="enterPartNameText()">
              </div>
              <div class="form-group flex-1">
                <label class="form-label">{{ partNumberText() }} *</label>
                <input type="text" 
                       formControlName="partNumber"
                       class="form-input"
                       [placeholder]="enterPartNumberText()">
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">{{ descriptionText() }}</label>
              <textarea formControlName="description"
                        class="form-textarea"
                        [placeholder]="enterDescriptionText()"
                        rows="3">
              </textarea>
            </div>
          </div>

          <!-- Category and Classification -->
          <div class="form-section">
            <h3 class="section-title">{{ categoryAndClassificationText() }}</h3>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ categoryText() }} *</label>
                <select formControlName="category" class="form-select">
                  <option value="">{{ selectCategoryText() }}</option>
                  <option *ngFor="let category of availableCategories" [value]="category">
                    {{ getCategoryLabel(category) }}
                  </option>
                </select>
              </div>
              <div class="form-group flex-1">
                <label class="form-label">{{ brandText() }} *</label>
                <input type="text" 
                       formControlName="brand"
                       class="form-input"
                       [placeholder]="enterBrandText()">
              </div>
            </div>
          </div>

          <!-- Supplier and Pricing -->
          <div class="form-section">
            <h3 class="section-title">{{ supplierAndPricingText() }}</h3>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ supplierText() }} *</label>
                <select formControlName="supplierId" class="form-select">
                  <option value="">{{ selectSupplierText() }}</option>
                  <option *ngFor="let supplier of suppliers()" [value]="supplier.id">
                    {{ supplier.name }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">{{ unitText() }} *</label>
                <select formControlName="unit" class="form-select">
                  <option value="">{{ selectUnitText() }}</option>
                  <option *ngFor="let unit of availableUnits" [value]="unit">
                    {{ getUnitLabel(unit) }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">{{ priceText() }} (TND) *</label>
                <input type="number" 
                       formControlName="price"
                       class="form-input"
                       placeholder="0.00"
                       step="0.01"
                       min="0">
              </div>
            </div>
          </div>

          <!-- Stock Management -->
          <div class="form-section">
            <h3 class="section-title">{{ stockManagementText() }}</h3>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ currentStockText() }} *</label>
                <input type="number" 
                       formControlName="stockLevel"
                       class="form-input"
                       placeholder="0"
                       min="0">
              </div>
              <div class="form-group">
                <label class="form-label">{{ minStockLevelText() }} *</label>
                <input type="number" 
                       formControlName="minStockLevel"
                       class="form-input"
                       placeholder="0"
                       min="0">
              </div>
              <div class="form-group">
                <label class="form-label">{{ maxStockLevelText() }}</label>
                <input type="number" 
                       formControlName="maxStockLevel"
                       class="form-input"
                       [placeholder]="optionalText()"
                       min="0">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ storageLocationText() }}</label>
                <input type="text" 
                       formControlName="location"
                       class="form-input"
                       [placeholder]="locationPlaceholderText()">
              </div>
              <div class="form-group">
                <label class="form-label">{{ statusText() }}</label>
                <div class="flex items-center gap-3 mt-2">
                  <input type="checkbox" 
                         id="isActive"
                         formControlName="isActive"
                         class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded">
                  <label for="isActive" class="text-sm font-medium text-white">
                    {{ activePartText() }}
                  </label>
                </div>
              </div>
            </div>
          </div>

        </form>

        <!-- Modal Footer -->
        <footer class="modal-footer">
          <button type="button" class="modal-btn secondary" (click)="onClose()">
            {{ cancelText() }}
          </button>
          <button type="button" class="modal-btn primary" 
                  [disabled]="!partForm.valid || isSubmitting()"
                  (click)="onSubmit()">
            <span *ngIf="!isSubmitting()">{{ isEditMode() ? updatePartText() : createPartText() }}</span>
            <span *ngIf="isSubmitting()" class="flex items-center gap-2">
              <div class="submit-spinner"></div>
              {{ isEditMode() ? updatingText() : creatingText() }}
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
  `]
})
export class PartModalComponent implements OnInit, OnDestroy {
  @Input() part: PartWithStock | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Part>();

  private fb = inject(FormBuilder);
  private partService = inject(PartService);
  private translationService = inject(TranslationService);

  suppliers = signal<Supplier[]>([]);
  isSubmitting = signal(false);
  translationsReady = signal(false);
  
  // Translation signals for ultra-fast UI
  addNewPartText = signal('Add New Part');
  editPartText = signal('Edit Part');
  managePartInventoryText = signal('Manage part inventory');
  basicInformationText = signal('Basic Information');
  partNameText = signal('Part Name');
  enterPartNameText = signal('Enter part name');
  partNumberText = signal('Part Number');
  enterPartNumberText = signal('Enter part number');
  descriptionText = signal('Description');
  enterDescriptionText = signal('Enter description');
  categoryAndClassificationText = signal('Category and Classification');
  categoryText = signal('Category');
  selectCategoryText = signal('Select category');
  brandText = signal('Brand');
  enterBrandText = signal('Enter brand');
  supplierAndPricingText = signal('Supplier and Pricing');
  supplierText = signal('Supplier');
  selectSupplierText = signal('Select supplier');
  unitText = signal('Unit');
  selectUnitText = signal('Select unit');
  priceText = signal('Price');
  stockManagementText = signal('Stock Management');
  currentStockText = signal('Current Stock');
  minStockLevelText = signal('Min Stock Level');
  maxStockLevelText = signal('Max Stock Level');
  optionalText = signal('Optional');
  storageLocationText = signal('Storage Location');
  locationPlaceholderText = signal('e.g., Shelf A-1, Row B, etc.');
  statusText = signal('Status');
  activePartText = signal('Active part');
  cancelText = signal('Cancel');
  createPartText = signal('Create Part');
  updatePartText = signal('Update Part');
  creatingText = signal('Creating...');
  updatingText = signal('Updating...');
  
  private translationSubscription?: Subscription;
  
  partForm: FormGroup;

  availableCategories: PartCategory[] = [
    'engine', 'transmission', 'brakes', 'suspension', 'electrical', 
    'filters', 'fluids', 'tires', 'body', 'accessories', 'consumables'
  ];

  availableUnits: PartUnit[] = [
    'piece', 'liter', 'kg', 'meter', 'pair', 'set', 'bottle', 'box'
  ];

  constructor() {
    this.partForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      partNumber: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      category: ['', Validators.required],
      brand: ['', [Validators.required, Validators.minLength(2)]],
      supplierId: ['', Validators.required],
      unit: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      stockLevel: [0, [Validators.required, Validators.min(0)]],
      minStockLevel: [0, [Validators.required, Validators.min(0)]],
      maxStockLevel: [null, Validators.min(0)],
      location: [''],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.initializeTranslations();
    this.loadSuppliers();
    
    if (this.part) {
      this.populateForm();
    }
  }

  ngOnDestroy(): void {
    this.translationSubscription?.unsubscribe();
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
    return translations && 
           translations.inventory &&
           translations.inventory.parts &&
           translations.common &&
           translations.inventory.categories &&
           translations.inventory.units;
  }

  private setFallbackTranslations(): void {
    // Set English fallbacks for instant display
    this.addNewPartText.set('Add New Part');
    this.editPartText.set('Edit Part');
    this.managePartInventoryText.set('Manage part inventory');
    this.basicInformationText.set('Basic Information');
    this.partNameText.set('Part Name');
    this.enterPartNameText.set('Enter part name');
    this.partNumberText.set('Part Number');
    this.enterPartNumberText.set('Enter part number');
    this.descriptionText.set('Description');
    this.enterDescriptionText.set('Enter description');
    this.categoryAndClassificationText.set('Category and Classification');
    this.categoryText.set('Category');
    this.selectCategoryText.set('Select category');
    this.brandText.set('Brand');
    this.enterBrandText.set('Enter brand');
    this.supplierAndPricingText.set('Supplier and Pricing');
    this.supplierText.set('Supplier');
    this.selectSupplierText.set('Select supplier');
    this.unitText.set('Unit');
    this.selectUnitText.set('Select unit');
    this.priceText.set('Price');
    this.stockManagementText.set('Stock Management');
    this.currentStockText.set('Current Stock');
    this.minStockLevelText.set('Min Stock Level');
    this.maxStockLevelText.set('Max Stock Level');
    this.optionalText.set('Optional');
    this.storageLocationText.set('Storage Location');
    this.locationPlaceholderText.set('e.g., Shelf A-1, Row B, etc.');
    this.statusText.set('Status');
    this.activePartText.set('Active part');
    this.cancelText.set('Cancel');
    this.createPartText.set('Create Part');
    this.updatePartText.set('Update Part');
    this.creatingText.set('Creating...');
    this.updatingText.set('Updating...');
  }

  private updateTranslationSignals(): void {
    // Update all translation signals with proper translations
    this.addNewPartText.set(this.translationService.instant('inventory.parts.addNewPart'));
    this.editPartText.set(this.translationService.instant('inventory.parts.editPart'));
    this.managePartInventoryText.set(this.translationService.instant('inventory.parts.managePartInventory'));
    this.basicInformationText.set(this.translationService.instant('inventory.parts.basicInformation'));
    this.partNameText.set(this.translationService.instant('inventory.parts.partName'));
    this.enterPartNameText.set(this.translationService.instant('inventory.parts.enterPartName'));
    this.partNumberText.set(this.translationService.instant('inventory.parts.partNumber'));
    this.enterPartNumberText.set(this.translationService.instant('inventory.parts.enterPartNumber'));
    this.descriptionText.set(this.translationService.instant('inventory.parts.description'));
    this.enterDescriptionText.set(this.translationService.instant('inventory.parts.enterDescription'));
    this.categoryAndClassificationText.set(this.translationService.instant('inventory.parts.categoryAndClassification'));
    this.categoryText.set(this.translationService.instant('inventory.parts.category'));
    this.selectCategoryText.set(this.translationService.instant('inventory.parts.selectCategory'));
    this.brandText.set(this.translationService.instant('inventory.parts.brand'));
    this.enterBrandText.set(this.translationService.instant('inventory.parts.enterBrand'));
    this.supplierAndPricingText.set(this.translationService.instant('inventory.parts.supplierAndPricing'));
    this.supplierText.set(this.translationService.instant('inventory.parts.supplier'));
    this.selectSupplierText.set(this.translationService.instant('inventory.parts.selectSupplier'));
    this.unitText.set(this.translationService.instant('inventory.parts.unit'));
    this.selectUnitText.set(this.translationService.instant('inventory.parts.selectUnit'));
    this.priceText.set(this.translationService.instant('inventory.parts.price'));
    this.stockManagementText.set(this.translationService.instant('inventory.parts.stockManagement'));
    this.currentStockText.set(this.translationService.instant('inventory.parts.currentStock'));
    this.minStockLevelText.set(this.translationService.instant('inventory.parts.minStockLevel'));
    this.maxStockLevelText.set(this.translationService.instant('inventory.parts.maxStockLevel'));
    this.optionalText.set(this.translationService.instant('inventory.parts.optional'));
    this.storageLocationText.set(this.translationService.instant('inventory.parts.storageLocation'));
    this.locationPlaceholderText.set(this.translationService.instant('inventory.parts.locationPlaceholder'));
    this.statusText.set(this.translationService.instant('inventory.parts.status'));
    this.activePartText.set(this.translationService.instant('inventory.parts.activePart'));
    this.cancelText.set(this.translationService.instant('common.cancel'));
    this.createPartText.set(this.translationService.instant('inventory.parts.createPart'));
    this.updatePartText.set(this.translationService.instant('inventory.parts.updatePart'));
    this.creatingText.set(this.translationService.instant('inventory.parts.creating'));
    this.updatingText.set(this.translationService.instant('inventory.parts.updating'));
  }

  isEditMode(): boolean {
    return this.part !== null;
  }

  getCategoryLabel(category: string): string {
    return this.translationService.instant(`inventory.categories.${category}`);
  }

  getUnitLabel(unit: string): string {
    return this.translationService.instant(`inventory.units.${unit}`);
  }

  private loadSuppliers(): void {
    this.partService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.suppliers.set(suppliers.filter(s => s.isActive));
      },
      error: (error) => console.error('Failed to load suppliers:', error)
    });
  }

  private populateForm(): void {
    if (this.part) {
      this.partForm.patchValue({
        name: this.part.name,
        partNumber: this.part.partNumber,
        description: this.part.description || '',
        category: this.part.category,
        brand: this.part.brand,
        supplierId: this.part.supplierId,
        unit: this.part.unit,
        price: this.part.price,
        stockLevel: this.part.stockLevel,
        minStockLevel: this.part.minStockLevel,
        maxStockLevel: this.part.maxStockLevel,
        location: this.part.location || '',
        isActive: this.part.isActive
      });
    }
  }

  onSubmit(): void {
    if (this.partForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);
      
      const formValue = this.partForm.value;
      const partData: Omit<Part, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formValue.name,
        partNumber: formValue.partNumber,
        description: formValue.description || undefined,
        category: formValue.category,
        brand: formValue.brand,
        supplierId: formValue.supplierId,
        unit: formValue.unit,
        price: parseFloat(formValue.price),
        currency: 'TND',
        stockLevel: parseInt(formValue.stockLevel),
        minStockLevel: parseInt(formValue.minStockLevel),
        maxStockLevel: formValue.maxStockLevel ? parseInt(formValue.maxStockLevel) : undefined,
        location: formValue.location || undefined,
        isActive: formValue.isActive
      };

      if (this.isEditMode() && this.part) {
        this.partService.updatePart(this.part.id, partData).subscribe({
          next: (updatedPart) => {
            this.save.emit(updatedPart);
            this.isSubmitting.set(false);
            this.onClose();
          },
          error: (error) => {
            console.error('Failed to update part:', error);
            this.isSubmitting.set(false);
          }
        });
      } else {
        this.partService.createPart(partData).subscribe({
          next: (newPart) => {
            this.save.emit(newPart);
            this.isSubmitting.set(false);
            this.onClose();
          },
          error: (error) => {
            console.error('Failed to create part:', error);
            this.isSubmitting.set(false);
          }
        });
      }
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.partForm.controls).forEach(key => {
        this.partForm.get(key)?.markAsTouched();
      });
    }
  }

  onClose(): void {
    this.close.emit();
    this.partForm.reset();
    this.isSubmitting.set(false);
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}