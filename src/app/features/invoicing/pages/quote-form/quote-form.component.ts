import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ToastService } from '../../../../shared/services/toast.service';
import { QuoteService } from '../../../../core/services/quote.service';
import { CustomerService } from '../../../../core/services/customer.service';
import { AppointmentService } from '../../../appointments/services/appointment.service';
import { Customer, Car } from '../../../../core/models/appointment.model';

/**
 * QuoteFormPage — minimal new-quote form. Renders inside the
 * invoicing shell at `/invoices/quotes/new`.
 *
 * Full sectioned rebuild parity with the new invoice form lives in a
 * follow-up task; this initial cut covers the must-have fields so the
 * route is wired end-to-end and downstream tasks (send/approve) can
 * be exercised.
 */
@Component({
  selector: 'app-quote-form-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslatePipe],
  templateUrl: './quote-form.component.html',
  styleUrl: './quote-form.component.css',
})
export class QuoteFormPageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private quoteService = inject(QuoteService);
  private customerService = inject(CustomerService);
  private appointmentService = inject(AppointmentService);
  private router = inject(Router);
  private toast = inject(ToastService);

  customers = signal<Customer[]>([]);
  allCars = signal<Car[]>([]);
  cars = signal<Car[]>([]);
  isSubmitting = signal(false);

  form = this.fb.group({
    customerId: ['', Validators.required],
    carId: ['', Validators.required],
    validUntil: [
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      Validators.required,
    ],
    notes: [''],
    description: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.customerService.getCustomers().subscribe({
      next: (rows: any[]) =>
        this.customers.set(
          rows.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
          })) as Customer[],
        ),
    });
    this.appointmentService.getCars().subscribe({
      next: (rows) => this.allCars.set(rows),
    });
  }

  onCustomerChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.form.patchValue({ customerId: id, carId: '' });
    if (!id) {
      this.cars.set([]);
      return;
    }
    this.cars.set(this.allCars().filter((c) => c.customerId === id));
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.value;
    const lineItems = [
      {
        type: 'service' as const,
        description: v.description ?? '',
        quantity: v.quantity ?? 1,
        unit: 'service',
        unitPrice: v.unitPrice ?? 0,
        totalPrice: (v.quantity ?? 1) * (v.unitPrice ?? 0),
        taxable: true,
      },
    ];
    this.isSubmitting.set(true);
    this.quoteService
      .create({
        customerId: v.customerId ?? '',
        carId: v.carId ?? '',
        status: 'DRAFT',
        issueDate: new Date(),
        validUntil: new Date(v.validUntil ?? new Date()),
        currency: 'TND',
        discountPercentage: 0,
        notes: v.notes ?? '',
        lineItems: lineItems as any,
        createdBy: 'current-user',
      })
      .subscribe({
        next: (quote) => {
          this.isSubmitting.set(false);
          this.toast.success('invoicing.quotes.form.created');
          this.router.navigate(['/invoices/quotes', quote.id]);
        },
        error: () => {
          this.isSubmitting.set(false);
          this.toast.error('invoicing.quotes.form.createFailed');
        },
      });
  }

  cancel(): void {
    this.router.navigate(['/invoices/quotes']);
  }
}
