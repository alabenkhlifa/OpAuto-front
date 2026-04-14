import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CustomerService } from '../../../core/services/customer.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { CreateCustomerRequest, UpdateCustomerRequest, CustomerStatus, ContactMethod } from '../../../core/models/customer.model';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './customer-form.component.html',
  styleUrl: './customer-form.component.css'
})
export class CustomerFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private customerService = inject(CustomerService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private translationService = inject(TranslationService);
  private toast = inject(ToastService);

  customerForm!: FormGroup;
  isSubmitting = signal(false);
  isEditMode = false;
  customerId: string | null = null;

  statusOptions: { value: CustomerStatus; labelKey: string }[] = [
    { value: 'active', labelKey: 'customers.status.active' },
    { value: 'vip', labelKey: 'customers.status.vip' },
    { value: 'inactive', labelKey: 'customers.status.inactive' },
    { value: 'blocked', labelKey: 'customers.status.blocked' }
  ];

  contactMethodOptions: { value: ContactMethod; labelKey: string }[] = [
    { value: 'phone', labelKey: 'customers.form.contactMethods.phone' },
    { value: 'email', labelKey: 'customers.form.contactMethods.email' },
    { value: 'sms', labelKey: 'customers.form.contactMethods.sms' },
    { value: 'whatsapp', labelKey: 'customers.form.contactMethods.whatsapp' }
  ];

  ngOnInit() {
    this.initializeForm();
    this.checkEditMode();
  }

  private initializeForm() {
    this.customerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required]],
      email: ['', [Validators.email]],
      street: [''],
      city: [''],
      postalCode: [''],
      country: ['Tunisia'],
      status: ['active', Validators.required],
      preferredContactMethod: ['phone', Validators.required],
      notes: ['']
    });
  }

  private checkEditMode() {
    this.customerId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.customerId;

    if (this.isEditMode && this.customerId) {
      this.loadCustomer(this.customerId);
    }
  }

  private loadCustomer(id: string) {
    this.customerService.getCustomerById(id).subscribe({
      next: (customer) => {
        if (customer) {
          this.customerForm.patchValue({
            name: customer.name,
            phone: customer.phone,
            email: customer.email || '',
            street: customer.address?.street || '',
            city: customer.address?.city || '',
            postalCode: customer.address?.postalCode || '',
            country: customer.address?.country || 'Tunisia',
            status: customer.status,
            preferredContactMethod: customer.preferredContactMethod,
            notes: customer.notes || ''
          });
        }
      },
      error: (error) => {
        console.error('Error loading customer:', error);
        this.router.navigate(['/customers']);
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.customerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSubmit() {
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.customerForm.value;

    if (this.isEditMode && this.customerId) {
      const updateData: UpdateCustomerRequest = {
        name: formValue.name,
        phone: formValue.phone,
        email: formValue.email || undefined,
        address: (formValue.street || formValue.city) ? {
          street: formValue.street,
          city: formValue.city,
          postalCode: formValue.postalCode,
          country: formValue.country
        } : undefined,
        status: formValue.status,
        preferredContactMethod: formValue.preferredContactMethod,
        notes: formValue.notes || undefined
      };

      this.customerService.updateCustomer(this.customerId, updateData).subscribe({
        next: (updated) => {
          this.toast.success('Customer updated successfully');
          this.isSubmitting.set(false);
          this.router.navigate(['/customers', updated.id]);
        },
        error: (error) => {
          console.error('Error updating customer:', error);
          this.toast.error('Failed to update customer');
          this.isSubmitting.set(false);
        }
      });
    } else {
      const createData: CreateCustomerRequest = {
        name: formValue.name,
        phone: formValue.phone,
        email: formValue.email || undefined,
        address: (formValue.street || formValue.city) ? {
          street: formValue.street,
          city: formValue.city,
          postalCode: formValue.postalCode,
          country: formValue.country
        } : undefined,
        preferredContactMethod: formValue.preferredContactMethod,
        notes: formValue.notes || undefined
      };

      this.customerService.createCustomer(createData).subscribe({
        next: (created) => {
          this.toast.success('Customer created successfully');
          this.isSubmitting.set(false);
          this.router.navigate(['/customers', created.id]);
        },
        error: (error) => {
          console.error('Error creating customer:', error);
          this.toast.error('Failed to create customer');
          this.isSubmitting.set(false);
        }
      });
    }
  }

  goBack() {
    if (this.isEditMode && this.customerId) {
      this.router.navigate(['/customers', this.customerId]);
    } else {
      this.router.navigate(['/customers']);
    }
  }
}
