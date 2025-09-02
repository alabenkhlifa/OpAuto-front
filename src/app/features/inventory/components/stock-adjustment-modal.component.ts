import { Component, Input, Output, EventEmitter, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PartService } from '../../../core/services/part.service';
import { PartWithStock, StockMovementType } from '../../../core/models/part.model';

@Component({
  selector: 'app-stock-adjustment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
         (click)="onBackdropClick($event)">
      <div class="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg"
           (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            Adjust Stock: {{ part?.name }}
          </h2>
          <button (click)="onClose()" 
                  class="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors">
            <span class="text-gray-500 dark:text-gray-400">✕</span>
          </button>
        </div>

        <!-- Current Stock Info -->
        <div class="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">Current Stock</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ part?.stockLevel || 0 }} {{ part?.unit }}{{ (part?.stockLevel || 0) !== 1 ? 's' : '' }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-sm text-gray-600 dark:text-gray-400">Min Stock</p>
              <p class="text-lg font-medium text-gray-900 dark:text-white">{{ part?.minStockLevel || 0 }}</p>
            </div>
          </div>
          
          <!-- Stock Status Badge -->
          <div class="mt-3">
            <span class="px-2 py-1 rounded-full text-xs font-medium border"
                  [class]="getStockStatusBadgeClass(part?.stockStatus || 'in-stock')">
              {{ part?.stockStatus | titlecase }}
            </span>
          </div>
        </div>

        <!-- Form -->
        <form [formGroup]="stockForm" (ngSubmit)="onSubmit()" class="p-6 space-y-4">
          <!-- Movement Type -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Adjustment Type *
            </label>
            <select formControlName="type"
                    (change)="onTypeChange()"
                    class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white backdrop-blur-sm">
              <option value="">Select adjustment type</option>
              <option value="in">Add Stock (Incoming)</option>
              <option value="out">Remove Stock (Outgoing)</option>
              <option value="adjustment">Stock Correction</option>
              <option value="return">Return to Supplier</option>
            </select>
            <div *ngIf="stockForm.get('type')?.errors && stockForm.get('type')?.touched" 
                 class="text-red-500 text-xs mt-1">
              Adjustment type is required
            </div>
          </div>

          <!-- Quantity -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quantity *
            </label>
            <div class="relative">
              <input type="number" 
                     formControlName="quantity"
                     placeholder="Enter quantity"
                     min="1"
                     class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm">
              <span class="absolute right-3 top-2 text-sm text-gray-500 dark:text-gray-400">
                {{ part?.unit }}{{ (stockForm.get('quantity')?.value || 0) !== 1 ? 's' : '' }}
              </span>
            </div>
            <div *ngIf="stockForm.get('quantity')?.errors && stockForm.get('quantity')?.touched" 
                 class="text-red-500 text-xs mt-1">
              <span *ngIf="stockForm.get('quantity')?.errors?.['required']">Quantity is required</span>
              <span *ngIf="stockForm.get('quantity')?.errors?.['min']">Quantity must be positive</span>
              <span *ngIf="stockForm.get('quantity')?.errors?.['max']">Not enough stock available</span>
            </div>
          </div>

          <!-- Reason -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason *
            </label>
            <select formControlName="reason"
                    class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white backdrop-blur-sm">
              <option value="">Select reason</option>
              <option *ngFor="let reason of getAvailableReasons()" [value]="reason">
                {{ reason }}
              </option>
            </select>
            <div *ngIf="stockForm.get('reason')?.errors && stockForm.get('reason')?.touched" 
                 class="text-red-500 text-xs mt-1">
              Reason is required
            </div>
          </div>

          <!-- Reference -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reference
            </label>
            <input type="text" 
                   formControlName="reference"
                   placeholder="e.g., Job #SJ001, Invoice #INV123"
                   class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm">
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes
            </label>
            <textarea formControlName="notes"
                      placeholder="Additional notes or comments"
                      rows="3"
                      class="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 backdrop-blur-sm resize-none">
            </textarea>
          </div>

          <!-- Preview -->
          <div *ngIf="stockForm.get('quantity')?.value && stockForm.get('type')?.value" 
               class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <h4 class="font-medium text-blue-900 dark:text-blue-300 mb-2">Preview</h4>
            <div class="text-sm space-y-1">
              <p class="text-blue-800 dark:text-blue-400">
                <span class="font-medium">Current stock:</span> {{ part?.stockLevel || 0 }} {{ part?.unit }}s
              </p>
              <p class="text-blue-800 dark:text-blue-400">
                <span class="font-medium">After adjustment:</span> 
                {{ calculateNewStock() }} {{ part?.unit }}s
                <span class="ml-2 px-2 py-1 rounded text-xs"
                      [class]="getPreviewStockStatusClass()">
                  {{ getPreviewStockStatus() }}
                </span>
              </p>
            </div>
          </div>
        </form>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button type="button" 
                  (click)="onClose()"
                  class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            Cancel
          </button>
          <button type="button"
                  (click)="onSubmit()"
                  [disabled]="!stockForm.valid || isSubmitting()"
                  class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2">
            <div *ngIf="isSubmitting()" class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            Apply Adjustment
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './stock-adjustment-modal.component.css'
})
export class StockAdjustmentModalComponent implements OnInit {
  @Input() part: PartWithStock | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() adjust = new EventEmitter<{ partId: string; quantity: number; reason: string; reference?: string; notes?: string }>();

  private fb = inject(FormBuilder);
  private partService = inject(PartService);

  isSubmitting = signal(false);
  stockForm: FormGroup;

  constructor() {
    this.stockForm = this.fb.group({
      type: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      reason: ['', Validators.required],
      reference: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    // Reset form when modal opens
    this.stockForm.reset({
      type: '',
      quantity: 1,
      reason: '',
      reference: '',
      notes: ''
    });
  }

  onTypeChange(): void {
    const type = this.stockForm.get('type')?.value;
    const quantityControl = this.stockForm.get('quantity');
    
    if (type === 'out' || type === 'return') {
      // Set max validation for outgoing movements
      const currentStock = this.part?.stockLevel || 0;
      quantityControl?.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(currentStock)
      ]);
    } else {
      // Remove max validation for incoming movements
      quantityControl?.setValidators([
        Validators.required,
        Validators.min(1)
      ]);
    }
    
    quantityControl?.updateValueAndValidity();
  }

  getAvailableReasons(): string[] {
    const type = this.stockForm.get('type')?.value;
    
    const reasons = {
      'in': [
        'Purchase delivery',
        'Stock replenishment',
        'Return from customer',
        'Transfer from another location',
        'Initial stock entry'
      ],
      'out': [
        'Used in service job',
        'Sold to customer',
        'Transfer to another location',
        'Damaged/Defective',
        'Testing/Quality check'
      ],
      'adjustment': [
        'Stock count correction',
        'System error correction',
        'Damaged inventory write-off',
        'Expired products removal'
      ],
      'return': [
        'Return to supplier',
        'Warranty return',
        'Wrong part received',
        'Quality issue'
      ]
    };

    return reasons[type as keyof typeof reasons] || [];
  }

  calculateNewStock(): number {
    const currentStock = this.part?.stockLevel || 0;
    const quantity = this.stockForm.get('quantity')?.value || 0;
    const type = this.stockForm.get('type')?.value;

    if (type === 'in') {
      return currentStock + quantity;
    } else if (type === 'out' || type === 'return') {
      return Math.max(0, currentStock - quantity);
    } else if (type === 'adjustment') {
      // For adjustments, the quantity is the final amount
      return quantity;
    }

    return currentStock;
  }

  getPreviewStockStatus(): string {
    const newStock = this.calculateNewStock();
    const minStock = this.part?.minStockLevel || 0;

    if (newStock === 0) return 'Out of Stock';
    if (newStock <= minStock) return 'Low Stock';
    return 'In Stock';
  }

  getPreviewStockStatusClass(): string {
    const status = this.getPreviewStockStatus().toLowerCase().replace(' ', '-');
    return this.partService.getStockStatusBadgeClass(status as any);
  }

  getStockStatusBadgeClass(status: string): string {
    return this.partService.getStockStatusBadgeClass(status as any);
  }

  onSubmit(): void {
    if (this.stockForm.valid && !this.isSubmitting() && this.part) {
      this.isSubmitting.set(true);
      
      const formValue = this.stockForm.value;
      const type = formValue.type as StockMovementType;
      let adjustmentQuantity = formValue.quantity;
      
      // Calculate the actual adjustment amount
      if (type === 'out' || type === 'return') {
        adjustmentQuantity = -adjustmentQuantity;
      } else if (type === 'adjustment') {
        // For adjustments, calculate the difference
        adjustmentQuantity = adjustmentQuantity - (this.part.stockLevel || 0);
      }

      this.partService.adjustStock(
        this.part.id,
        adjustmentQuantity,
        formValue.reason,
        'current-user' // TODO: Get from auth service
      ).subscribe({
        next: (movement) => {
          this.adjust.emit({
            partId: this.part!.id,
            quantity: adjustmentQuantity,
            reason: formValue.reason,
            reference: formValue.reference || undefined,
            notes: formValue.notes || undefined
          });
          this.isSubmitting.set(false);
          this.onClose();
        },
        error: (error) => {
          console.error('Failed to adjust stock:', error);
          this.isSubmitting.set(false);
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.stockForm.controls).forEach(key => {
        this.stockForm.get(key)?.markAsTouched();
      });
    }
  }

  onClose(): void {
    this.close.emit();
    this.stockForm.reset();
    this.isSubmitting.set(false);
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}