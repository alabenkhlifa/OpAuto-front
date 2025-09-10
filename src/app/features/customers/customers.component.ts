import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CustomerService } from '../../core/services/customer.service';
import { Customer, CustomerStats, CustomerSummary, CustomerStatus } from '../../core/models/customer.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslatePipe],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.css'
})
export class CustomersComponent implements OnInit {
  private customerService = inject(CustomerService);
  private router = inject(Router);
  private translationService = inject(TranslationService);

  customers = signal<Customer[]>([]);
  stats = signal<CustomerStats | null>(null);
  filteredCustomers = computed(() => {
    const customers = this.customers();
    const query = this.searchQuery().toLowerCase();
    const status = this.selectedStatus();
    const city = this.selectedCity();

    let filtered = customers;

    if (query) {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(query) ||
        customer.phone.includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.address?.city.toLowerCase().includes(query)
      );
    }

    if (status !== 'all') {
      filtered = filtered.filter(customer => customer.status === status);
    }

    if (city !== 'all') {
      filtered = filtered.filter(customer => customer.address?.city === city);
    }

    return filtered;
  });

  availableCities = signal<string[]>([]);
  isLoading = signal(false);
  searchQuery = signal('');
  selectedStatus = signal<string>('all');
  selectedCity = signal<string>('all');
  currentView = signal<'dashboard' | 'list' | 'analytics'>('dashboard');

  ngOnInit() {
    this.loadCustomers();
    this.loadStats();
    this.loadCities();
  }

  private loadCustomers() {
    this.isLoading.set(true);
    this.customerService.getCustomers().subscribe({
      next: (customers) => {
        this.customers.set(customers);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading customers:', error);
        this.isLoading.set(false);
      }
    });
  }

  private loadStats() {
    this.customerService.getCustomerStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
      },
      error: (error) => {
        console.error('Error loading customer stats:', error);
      }
    });
  }

  private loadCities() {
    this.customerService.getAvailableCities().subscribe({
      next: (cities) => {
        this.availableCities.set(cities);
      }
    });
  }

  onViewChange(view: 'dashboard' | 'list' | 'analytics') {
    this.currentView.set(view);
  }

  onAddCustomer() {
    this.router.navigate(['/customers/add']);
  }

  onEditCustomer(customerId: string) {
    this.router.navigate(['/customers/edit', customerId]);
  }

  onViewCustomer(customerId: string) {
    this.router.navigate(['/customers', customerId]);
  }

  onDeleteCustomer(customerId: string) {
    const confirmMessage = this.translationService.instant('customers.actions.confirmDelete');
    if (confirm(confirmMessage)) {
      this.customerService.deleteCustomer(customerId).subscribe({
        next: (success) => {
          if (success) {
            this.loadCustomers();
            this.loadStats();
          }
        },
        error: (error) => {
          console.error('Error deleting customer:', error);
        }
      });
    }
  }

  clearFilters() {
    this.searchQuery.set('');
    this.selectedStatus.set('all');
    this.selectedCity.set('all');
  }

  getStatusBadgeClass(status: CustomerStatus): string {
    switch (status) {
      case 'active':
        return 'badge-active';
      case 'vip':
        return 'badge-vip';
      case 'inactive':
        return 'badge-inactive';
      case 'blocked':
        return 'badge-blocked';
      default:
        return 'badge-inactive';
    }
  }

  getLoyaltyTier(points: number): string {
    if (points >= 500) return this.translationService.instant('customers.loyaltyTiers.platinum');
    if (points >= 250) return this.translationService.instant('customers.loyaltyTiers.gold');
    if (points >= 100) return this.translationService.instant('customers.loyaltyTiers.silver');
    return this.translationService.instant('customers.loyaltyTiers.bronze');
  }

  getLoyaltyTierClass(points: number): string {
    const tier = this.getLoyaltyTier(points);
    
    switch (tier) {
      case 'Platinum':
        return 'badge-platinum';
      case 'Gold':
        return 'badge-gold';
      case 'Silver':
        return 'badge-silver';
      case 'Bronze':
        return 'badge-bronze';
      default:
        return 'badge-silver';
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

  getDaysSinceLastVisit(lastVisitDate?: Date): number | null {
    if (!lastVisitDate) return null;
    return Math.floor((new Date().getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  getCustomerInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('');
  }

  getStatusLabel(status: CustomerStatus): string {
    const statusKeys = {
      'active': 'active',
      'vip': 'vip',
      'inactive': 'inactive',
      'blocked': 'blocked'
    };
    const key = statusKeys[status] || 'inactive';
    return this.translationService.instant(`customers.status.${key}`);
  }

  hasActiveFilters = computed(() => {
    return this.searchQuery() !== '' || 
           this.selectedStatus() !== 'all' || 
           this.selectedCity() !== 'all';
  });
}