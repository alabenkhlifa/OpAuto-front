import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CustomerService } from '../../core/services/customer.service';
import { Customer, CustomerStats, CustomerSummary, CustomerStatus } from '../../core/models/customer.model';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.css'
})
export class CustomersComponent implements OnInit {
  private customerService = inject(CustomerService);
  private router = inject(Router);

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
    if (confirm('Are you sure you want to delete this customer?')) {
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
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium border';
    
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
    const baseClasses = 'px-2 py-1 rounded text-xs font-medium';
    
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

  getDaysSinceLastVisit(lastVisitDate?: Date): number | null {
    if (!lastVisitDate) return null;
    return Math.floor((new Date().getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  getCustomerInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('');
  }
}