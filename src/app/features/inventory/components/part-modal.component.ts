import { Component, Input, Output, EventEmitter, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { PartService } from '../../../core/services/part.service';
import { Part, PartWithStock, Supplier, PartCategory, PartUnit } from '../../../core/models/part.model';

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
            <h2 class="modal-title">{{ isEditMode() ? ('inventory.parts.editPart' | translate) : ('inventory.parts.addNewPart' | translate) }}</h2>
            <p class="modal-subtitle">{{ 'inventory.parts.managePartInventory' | translate }}</p>
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
            <h3 class="section-title">{{ 'inventory.parts.basicInformation' | translate }}</h3>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ 'inventory.parts.partName' | translate }} *</label>
                <input type="text" 
                       formControlName="name"
                       class="form-input"
                       [placeholder]="'inventory.parts.enterPartName' | translate">
              </div>
              <div class="form-group flex-1">
                <label class="form-label">{{ 'inventory.parts.partNumber' | translate }} *</label>
                <input type="text" 
                       formControlName="partNumber"
                       class="form-input"
                       [placeholder]="'inventory.parts.enterPartNumber' | translate">
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">{{ 'inventory.parts.description' | translate }}</label>
              <textarea formControlName="description"
                        class="form-textarea"
                        [placeholder]="'inventory.parts.enterDescription' | translate"
                        rows="3">
              </textarea>
            </div>
          </div>

          <!-- Category and Classification -->
          <div class="form-section">
            <h3 class="section-title">{{ 'inventory.parts.categoryAndClassification' | translate }}</h3>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ 'inventory.parts.category' | translate }} *</label>
                <select formControlName="category" class="form-select">
                  <option value="">{{ 'inventory.parts.selectCategory' | translate }}</option>
                  <option *ngFor="let category of availableCategories" [value]="category">
                    {{ getCategoryLabel(category) }}
                  </option>
                </select>
              </div>
              <div class="form-group flex-1">
                <label class="form-label">{{ 'inventory.parts.brand' | translate }} *</label>
                <input type="text" 
                       formControlName="brand"
                       class="form-input"
                       [placeholder]="'inventory.parts.enterBrand' | translate">
              </div>
            </div>
          </div>

          <!-- Supplier and Pricing -->
          <div class="form-section">
            <h3 class="section-title">{{ 'inventory.parts.supplierAndPricing' | translate }}</h3>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ 'inventory.parts.supplier' | translate }} *</label>
                <select formControlName="supplierId" class="form-select">
                  <option value="">{{ 'inventory.parts.selectSupplier' | translate }}</option>
                  <option *ngFor="let supplier of suppliers()" [value]="supplier.id">
                    {{ supplier.name }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">{{ 'inventory.parts.unit' | translate }} *</label>
                <select formControlName="unit" class="form-select">
                  <option value="">{{ 'inventory.parts.selectUnit' | translate }}</option>
                  <option *ngFor="let unit of availableUnits" [value]="unit">
                    {{ getUnitLabel(unit) }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">{{ 'inventory.parts.price' | translate }} (TND) *</label>
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
            <h3 class="section-title">{{ 'inventory.parts.stockManagement' | translate }}</h3>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ 'inventory.parts.currentStock' | translate }} *</label>
                <input type="number" 
                       formControlName="stockLevel"
                       class="form-input"
                       placeholder="0"
                       min="0">
              </div>
              <div class="form-group">
                <label class="form-label">{{ 'inventory.parts.minStockLevel' | translate }} *</label>
                <input type="number" 
                       formControlName="minStockLevel"
                       class="form-input"
                       placeholder="0"
                       min="0">
              </div>
              <div class="form-group">
                <label class="form-label">{{ 'inventory.parts.maxStockLevel' | translate }}</label>
                <input type="number" 
                       formControlName="maxStockLevel"
                       class="form-input"
                       [placeholder]="'inventory.parts.optional' | translate"
                       min="0">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">{{ 'inventory.parts.storageLocation' | translate }}</label>
                <input type="text" 
                       formControlName="location"
                       class="form-input"
                       [placeholder]="'inventory.parts.locationPlaceholder' | translate">
              </div>
              <div class="form-group">
                <label class="form-label">{{ 'inventory.parts.status' | translate }}</label>
                <div class="flex items-center gap-3 mt-2">
                  <input type="checkbox" 
                         id="isActive"
                         formControlName="isActive"
                         class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded">
                  <label for="isActive" class="text-sm font-medium text-white">
                    {{ 'inventory.parts.activePart' | translate }}
                  </label>
                </div>
              </div>
            </div>
          </div>

        </form>

        <!-- Modal Footer -->
        <footer class="modal-footer">
          <button type="button" class="modal-btn secondary" (click)="onClose()">
            {{ 'common.cancel' | translate }}
          </button>
          <button type="button" class="modal-btn primary" 
                  [disabled]="!partForm.valid || isSubmitting()"
                  (click)="onSubmit()">
            <span *ngIf="!isSubmitting()">{{ isEditMode() ? ('inventory.parts.updatePart' | translate) : ('inventory.parts.createPart' | translate) }}</span>
            <span *ngIf="isSubmitting()" class="flex items-center gap-2">
              <div class="submit-spinner"></div>
              {{ isEditMode() ? ('inventory.parts.updating' | translate) : ('inventory.parts.creating' | translate) }}
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
export class PartModalComponent implements OnInit {
  @Input() part: PartWithStock | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Part>();

  private fb = inject(FormBuilder);
  private partService = inject(PartService);
  private translationService = inject(TranslationService);

  suppliers = signal<Supplier[]>([]);
  isSubmitting = signal(false);
  
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
    this.loadSuppliers();
    
    if (this.part) {
      this.populateForm();
    }
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