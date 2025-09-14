import { Component, Input, Output, EventEmitter, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { PartService } from '../../../core/services/part.service';
import { Part, PartWithStock, Supplier, PartCategory, PartUnit } from '../../../core/models/part.model';

@Component({
  selector: 'app-part-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
         (click)="onBackdropClick($event)">
      <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
           (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            {{ isEditMode() ? ('inventory.parts.editPart' | translate) : ('inventory.parts.addNewPart' | translate) }}
          </h2>
          <button (click)="onClose()" 
                  class="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors">
            <span class="text-gray-500 dark:text-gray-400">✕</span>
          </button>
        </div>

        <!-- Form -->
        <form [formGroup]="partForm" (ngSubmit)="onSubmit()" class="p-6 space-y-6">
          <!-- Basic Information -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'inventory.parts.partName' | translate }} *
              </label>
              <input type="text" 
                     formControlName="name"
                     [placeholder]="'inventory.parts.enterPartName' | translate"
                     class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm">
              <div *ngIf="partForm.get('name')?.errors && partForm.get('name')?.touched" 
                   class="text-red-500 text-xs mt-1">
                {{ 'inventory.parts.partNameRequired' | translate }}
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'inventory.parts.partNumber' | translate }} *
              </label>
              <input type="text" 
                     formControlName="partNumber"
                     [placeholder]="'inventory.parts.enterPartNumber' | translate"
                     class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm">
              <div *ngIf="partForm.get('partNumber')?.errors && partForm.get('partNumber')?.touched" 
                   class="text-red-500 text-xs mt-1">
                {{ 'inventory.parts.partNumberRequired' | translate }}
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ 'inventory.parts.description' | translate }}
            </label>
            <textarea formControlName="description"
                      [placeholder]="'inventory.parts.enterDescription' | translate"
                      rows="3"
                      class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm resize-none">
            </textarea>
          </div>

          <!-- Category and Brand -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'inventory.parts.category' | translate }} *
              </label>
              <select formControlName="category"
                      class="form-select">
                <option value="">{{ 'inventory.parts.selectCategory' | translate }}</option>
                <option *ngFor="let category of availableCategories" [value]="category">
                  {{ category | titlecase }}
                </option>
              </select>
              <div *ngIf="partForm.get('category')?.errors && partForm.get('category')?.touched" 
                   class="text-red-500 text-xs mt-1">
                {{ 'inventory.parts.categoryRequired' | translate }}
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'inventory.parts.brand' | translate }} *
              </label>
              <input type="text" 
                     formControlName="brand"
                     [placeholder]="'inventory.parts.enterBrand' | translate"
                     class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm">
              <div *ngIf="partForm.get('brand')?.errors && partForm.get('brand')?.touched" 
                   class="text-red-500 text-xs mt-1">
                {{ 'inventory.parts.brandRequired' | translate }}
              </div>
            </div>
          </div>

          <!-- Supplier and Unit -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'inventory.parts.supplier' | translate }} *
              </label>
              <select formControlName="supplierId"
                      class="form-select">
                <option value="">{{ 'inventory.parts.selectSupplier' | translate }}</option>
                <option *ngFor="let supplier of suppliers()" [value]="supplier.id">
                  {{ supplier.name }}
                </option>
              </select>
              <div *ngIf="partForm.get('supplierId')?.errors && partForm.get('supplierId')?.touched" 
                   class="text-red-500 text-xs mt-1">
                {{ 'inventory.parts.supplierRequired' | translate }}
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'inventory.parts.unit' | translate }} *
              </label>
              <select formControlName="unit"
                      class="form-select">
                <option value="">{{ 'inventory.parts.selectUnit' | translate }}</option>
                <option *ngFor="let unit of availableUnits" [value]="unit">
                  {{ unit | titlecase }}
                </option>
              </select>
              <div *ngIf="partForm.get('unit')?.errors && partForm.get('unit')?.touched" 
                   class="text-red-500 text-xs mt-1">
                {{ 'inventory.parts.unitRequired' | translate }}
              </div>
            </div>
          </div>

          <!-- Price and Currency -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'inventory.parts.price' | translate }} *
              </label>
              <input type="number" 
                     formControlName="price"
                     placeholder="0.00"
                     step="0.01"
                     min="0"
                     class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm">
              <div *ngIf="partForm.get('price')?.errors && partForm.get('price')?.touched" 
                   class="text-red-500 text-xs mt-1">
                {{ 'inventory.parts.priceRequired' | translate }}
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'inventory.parts.currency' | translate }}
              </label>
              <select formControlName="currency"
                      class="form-select">
                <option value="TND">TND (Tunisian Dinar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="USD">USD (US Dollar)</option>
              </select>
            </div>
          </div>

          <!-- Stock Information -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'inventory.parts.currentStock' | translate }} *
              </label>
              <input type="number" 
                     formControlName="stockLevel"
                     placeholder="0"
                     min="0"
                     class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm">
              <div *ngIf="partForm.get('stockLevel')?.errors && partForm.get('stockLevel')?.touched" 
                   class="text-red-500 text-xs mt-1">
                {{ 'inventory.parts.stockLevelRequired' | translate }}
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'inventory.parts.minStockLevel' | translate }} *
              </label>
              <input type="number" 
                     formControlName="minStockLevel"
                     placeholder="0"
                     min="0"
                     class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm">
              <div *ngIf="partForm.get('minStockLevel')?.errors && partForm.get('minStockLevel')?.touched" 
                   class="text-red-500 text-xs mt-1">
                {{ 'inventory.parts.minStockLevelRequired' | translate }}
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ 'inventory.parts.maxStockLevel' | translate }}
              </label>
              <input type="number" 
                     formControlName="maxStockLevel"
                     [placeholder]="'inventory.parts.optional' | translate"
                     min="0"
                     class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm">
            </div>
          </div>

          <!-- Location -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ 'inventory.parts.storageLocation' | translate }}
            </label>
            <input type="text" 
                   formControlName="location"
                   [placeholder]="'inventory.parts.locationPlaceholder' | translate"
                   class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm">
          </div>

          <!-- Active Status -->
          <div class="flex items-center gap-3">
            <input type="checkbox" 
                   id="isActive"
                   formControlName="isActive"
                   class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded">
            <label for="isActive" class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ 'inventory.parts.activePart' | translate }}
            </label>
          </div>
        </form>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button type="button" 
                  (click)="onClose()"
                  class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            {{ 'common.cancel' | translate }}
          </button>
          <button type="button"
                  (click)="onSubmit()"
                  [disabled]="!partForm.valid || isSubmitting()"
                  class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2">
            <div *ngIf="isSubmitting()" class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            {{ isEditMode() ? ('inventory.parts.updatePart' | translate) : ('inventory.parts.createPart' | translate) }}
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './part-modal.component.css'
})
export class PartModalComponent implements OnInit {
  @Input() part: PartWithStock | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Part>();

  private fb = inject(FormBuilder);
  private partService = inject(PartService);

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
      currency: ['TND', Validators.required],
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
        currency: this.part.currency,
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
        currency: formValue.currency,
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