import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomerService } from '../../../core/services/customer.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Customer, CustomerHistory, UpdateCustomerRequest, CustomerStatus, ContactMethod } from '../../../core/models/customer.model';

@Component({
  selector: 'app-customer-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './customer-details.component.html',
  styleUrl: './customer-details.component.css'
})
export class CustomerDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private customerService = inject(CustomerService);
  private translationService = inject(TranslationService);
  private fb = inject(FormBuilder);

  customer = signal<Customer | null>(null);
  history = signal<CustomerHistory | null>(null);
  metrics = signal<any>(null);
  isLoading = signal(false);
  isEditing = signal(false);
  
  editForm: FormGroup;
  customerId = signal<string>('');

  constructor() {
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^\+216-[0-9]{2}-[0-9]{3}-[0-9]{3}$/)]],
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

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.customerId.set(id);
        this.loadCustomer(id);
        this.loadHistory(id);
        this.loadMetrics(id);
      }
    });
  }

  private loadCustomer(customerId: string) {
    this.isLoading.set(true);
    this.customerService.getCustomerById(customerId).subscribe({
      next: (customer) => {
        if (customer) {
          this.customer.set(customer);
          this.populateForm(customer);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading customer:', error);
        this.isLoading.set(false);
      }
    });
  }

  private loadHistory(customerId: string) {
    this.customerService.getCustomerHistory(customerId).subscribe({
      next: (history) => {
        this.history.set(history);
      },
      error: (error) => {
        console.error('Error loading customer history:', error);
      }
    });
  }

  private loadMetrics(customerId: string) {
    this.customerService.getCustomerMetrics(customerId).subscribe({
      next: (metrics) => {
        this.metrics.set(metrics);
      },
      error: (error) => {
        console.error('Error loading customer metrics:', error);
      }
    });
  }

  private populateForm(customer: Customer) {
    this.editForm.patchValue({
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

  onBack() {
    this.router.navigate(['/customers']);
  }

  onEdit() {
    this.isEditing.set(true);
  }

  onCancelEdit() {
    this.isEditing.set(false);
    const customer = this.customer();
    if (customer) {
      this.populateForm(customer);
    }
  }

  onSave() {
    if (this.editForm.valid) {
      const formValue = this.editForm.value;
      const updateData: UpdateCustomerRequest = {
        name: formValue.name,
        phone: formValue.phone,
        email: formValue.email || undefined,
        address: formValue.street || formValue.city ? {
          street: formValue.street,
          city: formValue.city,
          postalCode: formValue.postalCode,
          country: formValue.country
        } : undefined,
        status: formValue.status,
        preferredContactMethod: formValue.preferredContactMethod,
        notes: formValue.notes || undefined
      };

      this.customerService.updateCustomer(this.customerId(), updateData).subscribe({
        next: (updatedCustomer) => {
          this.customer.set(updatedCustomer);
          this.isEditing.set(false);
        },
        error: (error) => {
          console.error('Error updating customer:', error);
        }
      });
    }
  }

  onDelete() {
    if (confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
      this.customerService.deleteCustomer(this.customerId()).subscribe({
        next: (success) => {
          if (success) {
            this.router.navigate(['/customers']);
          }
        },
        error: (error) => {
          console.error('Error deleting customer:', error);
        }
      });
    }
  }

  onCreateAppointment() {
    this.router.navigate(['/appointments/create'], { 
      queryParams: { customerId: this.customerId() } 
    });
  }

  onCreateInvoice() {
    this.router.navigate(['/invoices/create'], { 
      queryParams: { customerId: this.customerId() } 
    });
  }

  onViewCar(carId: string) {
    this.router.navigate(['/cars', carId]);
  }

  onViewAppointment(appointmentId: string) {
    this.router.navigate(['/appointments', appointmentId]);
  }

  onViewInvoice(invoiceId: string) {
    this.router.navigate(['/invoices', invoiceId]);
  }

  getStatusBadgeClass(status: CustomerStatus): string {
    switch (status) {
      case 'active':
        return 'badge badge-active';
      case 'vip':
        return 'badge badge-vip';
      case 'inactive':
        return 'badge badge-inactive';
      case 'blocked':
        return 'badge badge-blocked';
      default:
        return 'badge badge-inactive';
    }
  }

  getLoyaltyTier(points: number): string {
    if (points >= 500) return 'Platinum';
    if (points >= 250) return 'Gold';
    if (points >= 100) return 'Silver';
    return 'Bronze';
  }

  getLoyaltyTierClass(points: number): string {
    const tier = this.getLoyaltyTier(points);
    
    switch (tier) {
      case 'Platinum':
        return 'badge badge-platinum';
      case 'Gold':
        return 'badge badge-gold';
      case 'Silver':
        return 'badge badge-silver';
      case 'Bronze':
        return 'badge badge-bronze';
      default:
        return 'badge badge-silver';
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-TN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('fr-TN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  getContactMethodIcon(method: ContactMethod): string {
    switch (method) {
      case 'phone': return '📞';
      case 'email': return '✉️';
      case 'sms': return '💬';
      case 'whatsapp': return '📱';
      default: return '📞';
    }
  }

  getServiceStatusClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'in-progress':
        return 'text-blue-600 dark:text-blue-400';
      case 'cancelled':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  }

  getPaymentStatusClass(status: string): string {
    switch (status) {
      case 'paid':
        return 'text-green-600 dark:text-green-400';
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'overdue':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  }

  getCustomerInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('');
  }

  getStatusLabel(status: CustomerStatus): string {
    return this.translationService.instant(`customers.status.${status}`);
  }

  getLoyaltyTierLabel(points: number): string {
    const tier = this.getLoyaltyTier(points).toLowerCase();
    const tierMap: {[key: string]: string} = {
      'platinum': 'platinum',
      'gold': 'gold', 
      'silver': 'silver',
      'bronze': 'bronze'
    };
    return this.translationService.instant(`customers.loyaltyTiers.${tierMap[tier]}`);
  }

  getContactMethodLabel(method: ContactMethod): string {
    return this.translationService.instant(`customers.form.contactMethods.${method}`);
  }
}