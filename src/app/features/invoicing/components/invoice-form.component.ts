import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { InvoiceService } from '../../../core/services/invoice.service';
import { PartService } from '../../../core/services/part.service';
import { 
  InvoiceWithDetails, 
  InvoiceLineItem, 
  ServiceRate, 
  LineItemType,
  CreateInvoiceRequest 
} from '../../../core/models/invoice.model';
import { PartWithStock, Supplier } from '../../../core/models/part.model';
import { Car, Customer } from '../../../core/models/appointment.model';

@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './invoice-form.component.html',
  styleUrl: './invoice-form.component.css'
})
export class InvoiceFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private invoiceService = inject(InvoiceService);
  private partService = inject(PartService);

  invoiceForm: FormGroup;
  isLoading = signal(false);
  isSubmitting = signal(false);
  isEditMode = signal(false);
  currentInvoice = signal<InvoiceWithDetails | null>(null);

  // Reference data
  customers = signal<Customer[]>([]);
  cars = signal<Car[]>([]);
  parts = signal<PartWithStock[]>([]);
  serviceRates = signal<ServiceRate[]>([]);
  suppliers = signal<Supplier[]>([]);

  // Computed values
  subtotal = computed(() => this.calculateSubtotal());
  taxAmount = computed(() => this.calculateTaxAmount());
  discountAmount = computed(() => this.calculateDiscountAmount());
  totalAmount = computed(() => this.calculateTotalAmount());

  lineItemTypes: LineItemType[] = ['service', 'part', 'labor', 'misc'];

  constructor() {
    this.invoiceForm = this.fb.group({
      customerId: ['', Validators.required],
      carId: ['', Validators.required],
      issueDate: [new Date().toISOString().split('T')[0], Validators.required],
      dueDate: [this.getDefaultDueDate(), Validators.required],
      currency: ['TND', Validators.required],
      taxRate: [19, [Validators.required, Validators.min(0), Validators.max(100)]],
      discountPercentage: [0, [Validators.min(0), Validators.max(100)]],
      paymentTerms: ['Payment due within 30 days', Validators.required],
      notes: [''],
      lineItems: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.loadReferenceData();
    
    // Check if editing existing invoice
    const invoiceId = this.route.snapshot.paramMap.get('id');
    if (invoiceId) {
      this.loadInvoiceForEdit(invoiceId);
    } else {
      // Add default line item for new invoice
      this.addLineItem();
    }
  }

  get lineItems(): FormArray {
    return this.invoiceForm.get('lineItems') as FormArray;
  }

  private loadReferenceData(): void {
    this.isLoading.set(true);

    // Load parts
    this.partService.getParts().subscribe({
      next: (parts) => this.parts.set(parts),
      error: (error) => console.error('Failed to load parts:', error)
    });

    // Load suppliers
    this.partService.getSuppliers().subscribe({
      next: (suppliers) => this.suppliers.set(suppliers),
      error: (error) => console.error('Failed to load suppliers:', error)
    });

    // Load service rates
    this.invoiceService.getServiceRates().subscribe({
      next: (rates) => this.serviceRates.set(rates),
      error: (error) => console.error('Failed to load service rates:', error)
    });

    // Mock customers and cars (would typically come from respective services)
    this.customers.set([
      { id: 'customer1', name: 'Ahmed Ben Ali', phone: '+216-20-123-456', email: 'ahmed.benali@email.tn' },
      { id: 'customer2', name: 'Fatma Trabelsi', phone: '+216-25-789-123', email: 'fatma.trabelsi@email.tn' },
      { id: 'customer3', name: 'Mohamed Khemir', phone: '+216-22-456-789', email: 'mohamed.khemir@email.tn' }
    ]);

    this.cars.set([
      { id: 'car1', licensePlate: '123 TUN 2024', make: 'BMW', model: 'X5', year: 2020, customerId: 'customer1' },
      { id: 'car2', licensePlate: '456 TUN 2019', make: 'Honda', model: 'Civic', year: 2019, customerId: 'customer2' },
      { id: 'car4', licensePlate: '321 TUN 2022', make: 'Mercedes', model: 'C-Class', year: 2022, customerId: 'customer3' }
    ]);

    this.isLoading.set(false);
  }

  private loadInvoiceForEdit(invoiceId: string): void {
    const invoice = this.invoiceService.getInvoiceById(invoiceId);
    if (invoice) {
      this.isEditMode.set(true);
      this.currentInvoice.set(invoice);
      this.populateFormWithInvoice(invoice);
    }
  }

  private populateFormWithInvoice(invoice: InvoiceWithDetails): void {
    this.invoiceForm.patchValue({
      customerId: invoice.customerId,
      carId: invoice.carId,
      issueDate: invoice.issueDate.toISOString().split('T')[0],
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      currency: invoice.currency,
      taxRate: invoice.taxRate,
      discountPercentage: invoice.discountPercentage,
      paymentTerms: invoice.paymentTerms,
      notes: invoice.notes
    });

    // Populate line items
    const lineItemsArray = this.lineItems;
    lineItemsArray.clear();
    
    invoice.lineItems.forEach(item => {
      lineItemsArray.push(this.createLineItemGroup(item));
    });
  }

  private createLineItemGroup(item?: InvoiceLineItem): FormGroup {
    return this.fb.group({
      type: [item?.type || 'service', Validators.required],
      description: [item?.description || '', Validators.required],
      quantity: [item?.quantity || 1, [Validators.required, Validators.min(0.01)]],
      unit: [item?.unit || 'piece', Validators.required],
      unitPrice: [item?.unitPrice || 0, [Validators.required, Validators.min(0)]],
      partId: [item?.partId || ''],
      serviceCode: [item?.serviceCode || ''],
      mechanicId: [item?.mechanicId || ''],
      laborHours: [item?.laborHours || 0],
      discountPercentage: [item?.discountPercentage || 0, [Validators.min(0), Validators.max(100)]],
      taxable: [item?.taxable ?? true]
    });
  }

  addLineItem(): void {
    this.lineItems.push(this.createLineItemGroup());
  }

  removeLineItem(index: number): void {
    this.lineItems.removeAt(index);
  }

  onLineItemTypeChange(index: number): void {
    const lineItem = this.lineItems.at(index);
    const type = lineItem.get('type')?.value;
    
    // Reset related fields when type changes
    lineItem.patchValue({
      partId: '',
      serviceCode: '',
      mechanicId: '',
      laborHours: 0
    });

    // Auto-populate based on type
    if (type === 'labor') {
      lineItem.patchValue({
        unit: 'hour',
        unitPrice: 80, // Default hourly rate
        description: 'Mechanic Labor'
      });
    } else if (type === 'service') {
      lineItem.patchValue({
        unit: 'service',
        description: 'Service'
      });
    }
  }

  onPartSelect(index: number, partId: string): void {
    const part = this.parts().find(p => p.id === partId);
    if (part) {
      const lineItem = this.lineItems.at(index);
      lineItem.patchValue({
        description: `${part.name} - ${part.brand}`,
        unit: part.unit,
        unitPrice: part.price
      });
    }
  }

  onServiceSelect(index: number, serviceCode: string): void {
    const service = this.serviceRates().find(s => s.serviceCode === serviceCode);
    if (service) {
      const lineItem = this.lineItems.at(index);
      lineItem.patchValue({
        description: service.serviceName,
        unit: 'service',
        unitPrice: service.basePrice,
        laborHours: service.laborHours
      });
    }
  }

  onCustomerChange(): void {
    const customerId = this.invoiceForm.get('customerId')?.value;
    if (customerId) {
      // Filter cars by customer
      const customerCars = this.cars().filter(car => car.customerId === customerId);
      if (customerCars.length === 1) {
        // Auto-select if customer has only one car
        this.invoiceForm.patchValue({ carId: customerCars[0].id });
      }
    }
  }

  getCustomerCars(): Car[] {
    const customerId = this.invoiceForm.get('customerId')?.value;
    return customerId ? this.cars().filter(car => car.customerId === customerId) : [];
  }

  calculateLineItemTotal(index: number): number {
    const lineItem = this.lineItems.at(index);
    const quantity = lineItem.get('quantity')?.value || 0;
    const unitPrice = lineItem.get('unitPrice')?.value || 0;
    const discountPercentage = lineItem.get('discountPercentage')?.value || 0;
    
    return this.invoiceService.calculateLineItemTotal(quantity, unitPrice, discountPercentage);
  }

  private calculateSubtotal(): number {
    let subtotal = 0;
    for (let i = 0; i < this.lineItems.length; i++) {
      subtotal += this.calculateLineItemTotal(i);
    }
    return subtotal;
  }

  private calculateDiscountAmount(): number {
    const subtotal = this.subtotal();
    const discountPercentage = this.invoiceForm.get('discountPercentage')?.value || 0;
    return (subtotal * discountPercentage) / 100;
  }

  private calculateTaxAmount(): number {
    const subtotal = this.subtotal() - this.discountAmount();
    const taxRate = this.invoiceForm.get('taxRate')?.value || 0;
    return (subtotal * taxRate) / 100;
  }

  private calculateTotalAmount(): number {
    return this.subtotal() - this.discountAmount() + this.taxAmount();
  }

  onSubmit(): void {
    if (this.invoiceForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);
      
      const formValue = this.invoiceForm.value;
      
      // Build line items
      const lineItems: InvoiceLineItem[] = formValue.lineItems.map((item: any, index: number) => ({
        id: `line_${Date.now()}_${index}`,
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: this.calculateLineItemTotal(index),
        partId: item.partId || undefined,
        serviceCode: item.serviceCode || undefined,
        mechanicId: item.mechanicId || undefined,
        laborHours: item.laborHours || undefined,
        discountPercentage: item.discountPercentage || undefined,
        taxable: item.taxable
      }));

      const invoiceData: CreateInvoiceRequest = {
        customerId: formValue.customerId,
        carId: formValue.carId,
        issueDate: new Date(formValue.issueDate),
        dueDate: new Date(formValue.dueDate),
        status: 'draft',
        currency: formValue.currency,
        taxRate: formValue.taxRate,
        discountPercentage: formValue.discountPercentage,
        paidAmount: 0,
        lineItems,
        notes: formValue.notes,
        paymentTerms: formValue.paymentTerms,
        createdBy: 'current-user' // TODO: Get from auth service
      };

      if (this.isEditMode()) {
        // Update existing invoice
        const invoiceId = this.currentInvoice()?.id;
        if (invoiceId) {
          this.invoiceService.updateInvoice(invoiceId, invoiceData).subscribe({
            next: (updatedInvoice) => {
              this.router.navigate(['/invoices', updatedInvoice.id]);
            },
            error: (error) => {
              console.error('Failed to update invoice:', error);
              this.isSubmitting.set(false);
            }
          });
        }
      } else {
        // Create new invoice
        this.invoiceService.createInvoice(invoiceData).subscribe({
          next: (newInvoice) => {
            this.router.navigate(['/invoices', newInvoice.id]);
          },
          error: (error) => {
            console.error('Failed to create invoice:', error);
            this.isSubmitting.set(false);
          }
        });
      }
    } else {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.invoiceForm);
    }
  }

  onSaveAsDraft(): void {
    if (this.invoiceForm.get('customerId')?.valid && this.invoiceForm.get('carId')?.valid) {
      // Save with minimal validation for draft
      this.onSubmit();
    }
  }

  onCancel(): void {
    this.router.navigate(['/invoices']);
  }

  private markFormGroupTouched(formGroup: FormGroup | FormArray): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private getDefaultDueDate(): string {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days from now
    return dueDate.toISOString().split('T')[0];
  }

  formatCurrency(amount: number): string {
    return this.invoiceService.formatCurrency(amount);
  }

  getSelectedCustomer(): Customer | undefined {
    const customerId = this.invoiceForm.get('customerId')?.value;
    return this.customers().find(c => c.id === customerId);
  }

  getSelectedCar(): Car | undefined {
    const carId = this.invoiceForm.get('carId')?.value;
    return this.cars().find(c => c.id === carId);
  }
}