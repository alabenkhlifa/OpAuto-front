import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CustomerService } from '../../../core/services/customer.service';
import { TranslationService } from '../../../core/services/translation.service';
import { AssistantContextService } from '../../../features/assistant/services/assistant-context.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { Customer, CustomerHistory, CustomerStatus, ContactMethod } from '../../../core/models/customer.model';

@Component({
  selector: 'app-customer-details',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './customer-details.component.html',
  styleUrl: './customer-details.component.css'
})
export class CustomerDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private customerService = inject(CustomerService);
  private translationService = inject(TranslationService);
  private assistantContext = inject(AssistantContextService);

  customer = signal<Customer | null>(null);
  history = signal<CustomerHistory | null>(null);
  metrics = signal<any>(null);
  isLoading = signal(false);
  customerId = signal<string>('');
  activeTab = signal<'cars' | 'appointments' | 'invoices'>('cars');

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
          this.assistantContext.setSelectedEntity('customer', customer.id, customer.name);
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

  onBack() {
    this.router.navigate(['/customers']);
  }

  onEdit() {
    this.router.navigate(['/customers', this.customerId(), 'edit']);
  }

  onDelete() {
    const confirmMsg = this.translationService.instant('customers.actions.confirmDelete');
    if (confirm(confirmMsg)) {
      this.customerService.deleteCustomer(this.customerId()).subscribe({
        next: () => {
          this.router.navigate(['/customers']);
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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