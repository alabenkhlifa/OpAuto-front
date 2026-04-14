import { Component, Input, Output, EventEmitter, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PartService } from '../../../core/services/part.service';
import { PartWithStock, StockMovementType } from '../../../core/models/part.model';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-stock-adjustment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="modal-overlay" (click)="onBackdropClick($event)">
      <div class="modal-content" (click)="$event.stopPropagation()">

        <!-- Header -->
        <header class="modal-header">
          <div>
            <h2 class="modal-title">Adjust Stock: {{ part?.name }}</h2>
          </div>
          <button class="modal-close-btn" (click)="onClose()">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <!-- Current Stock Info -->
        <div class="stock-info-section">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Current Stock</p>
              <p class="text-2xl font-bold text-gray-900">
                {{ part?.stockLevel || 0 }} {{ part?.unit }}{{ (part?.stockLevel || 0) !== 1 ? 's' : '' }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-sm text-gray-500">Min Stock</p>
              <p class="text-lg font-medium text-gray-900">{{ part?.minStockLevel || 0 }}</p>
            </div>
          </div>
          <div class="mt-3">
            <span class="px-2 py-1 rounded-full text-xs font-medium border"
                  [class]="getStockStatusBadgeClass(part?.stockStatus || 'in-stock')">
              {{ part?.stockStatus | titlecase }}
            </span>
          </div>
        </div>

        <!-- Form -->
        <form [formGroup]="stockForm" (ngSubmit)="onSubmit()" class="modal-form">
          <div class="form-group">
            <label class="form-label">Adjustment Type *</label>
            <select formControlName="type" (change)="onTypeChange()" class="form-select">
              <option value="">Select adjustment type</option>
              <option value="in">Add Stock (Incoming)</option>
              <option value="out">Remove Stock (Outgoing)</option>
              <option value="adjustment">Stock Correction</option>
              <option value="return">Return to Supplier</option>
            </select>
            <div *ngIf="stockForm.get('type')?.errors && stockForm.get('type')?.touched" class="form-error">
              Adjustment type is required
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Quantity *</label>
            <div class="relative">
              <input type="number" formControlName="quantity" placeholder="Enter quantity" min="1" class="form-input">
              <span class="unit-suffix">
                {{ part?.unit }}{{ (stockForm.get('quantity')?.value || 0) !== 1 ? 's' : '' }}
              </span>
            </div>
            <div *ngIf="stockForm.get('quantity')?.errors && stockForm.get('quantity')?.touched" class="form-error">
              <span *ngIf="stockForm.get('quantity')?.errors?.['required']">Quantity is required</span>
              <span *ngIf="stockForm.get('quantity')?.errors?.['min']">Quantity must be positive</span>
              <span *ngIf="stockForm.get('quantity')?.errors?.['max']">Not enough stock available</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Reason *</label>
            <select formControlName="reason" class="form-select">
              <option value="">Select reason</option>
              <option *ngFor="let reason of getAvailableReasons()" [value]="reason">{{ reason }}</option>
            </select>
            <div *ngIf="stockForm.get('reason')?.errors && stockForm.get('reason')?.touched" class="form-error">
              Reason is required
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Reference</label>
            <input type="text" formControlName="reference" placeholder="e.g., Job #SJ001, Invoice #INV123" class="form-input">
          </div>

          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea formControlName="notes" placeholder="Additional notes or comments" rows="3" class="form-textarea"></textarea>
          </div>

          <!-- Preview -->
          <div *ngIf="stockForm.get('quantity')?.value && stockForm.get('type')?.value" class="preview-box">
            <h4 class="font-medium text-amber-800 mb-2">Preview</h4>
            <div class="text-sm space-y-1">
              <p class="text-amber-700">
                <span class="font-medium">Current stock:</span> {{ part?.stockLevel || 0 }} {{ part?.unit }}s
              </p>
              <p class="text-amber-700">
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
        <footer class="modal-footer">
          <button type="button" class="modal-btn secondary" (click)="onClose()">Cancel</button>
          <button type="button" class="modal-btn primary"
                  [disabled]="!stockForm.valid || isSubmitting()"
                  (click)="onSubmit()">
            <div *ngIf="isSubmitting()" class="submit-spinner"></div>
            Apply Adjustment
          </button>
        </footer>
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
  private toast = inject(ToastService);

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
          this.toast.success('Stock adjusted successfully');
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
          this.toast.error('Failed to adjust stock');
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