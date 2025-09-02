import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomerService } from '../../../core/services/customer.service';
import { Customer, CustomerHistory, UpdateCustomerRequest, CustomerStatus, ContactMethod } from '../../../core/models/customer.model';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-customer-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './customer-details.component.html',
  styleUrl: './customer-details.component.css'
})
export class CustomerDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private customerService = inject(CustomerService);
  private fb = inject(FormBuilder);
  public themeService = inject(ThemeService);

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
    const baseClasses = 'px-3 py-1 rounded-full text-sm font-medium border';
    
    switch (status) {
      case 'active':
        return `${baseClasses} bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700`;
      case 'vip':
        return `${baseClasses} bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700`;
      case 'inactive':
        return `${baseClasses} bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600`;
      case 'blocked':
        return `${baseClasses} bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700`;
      default:
        return `${baseClasses} bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600`;
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
    const baseClasses = 'px-3 py-1 rounded-lg text-sm font-medium';
    
    switch (tier) {
      case 'Platinum':
        return `${baseClasses} bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200`;
      case 'Gold':
        return `${baseClasses} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200`;
      case 'Silver':
        return `${baseClasses} bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200`;
      case 'Bronze':
        return `${baseClasses} bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200`;
      default:
        return `${baseClasses} bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200`;
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
}