import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { CarService, CarWithHistory } from './services/car.service';
import { Customer } from '../../core/models/appointment.model';
import { CarCardComponent } from './components/car-card.component';
import { CarRegistrationFormComponent } from './components/car-registration-form.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { SubscriptionService } from '../../core/services/subscription.service';
import { UpgradePromptComponent } from '../../shared/components/upgrade-prompt/upgrade-prompt.component';
import { SubscriptionTierId, SubscriptionStatus } from '../../core/models/subscription.model';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-cars',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CarCardComponent, CarRegistrationFormComponent, TranslatePipe, UpgradePromptComponent],
  templateUrl: './cars.component.html',
  styleUrl: './cars.component.css'
})
export class CarsComponent implements OnInit {
  private carService = inject(CarService);
  private subscriptionService = inject(SubscriptionService);
  private languageService = inject(LanguageService);
  private router = inject(Router);
  
  cars = signal<CarWithHistory[]>([]);
  subscriptionStatus = signal<SubscriptionStatus | null>(null);
  isLoading = signal(false);
  showRegistrationForm = signal(false);
  showUpgradePrompt = signal(false);
  
  searchQuery = signal('');
  selectedMake = signal('all');
  selectedStatus = signal('all');
  showMobileFilters = signal(false);
  
  availableMakes = computed(() => this.carService.getAvailableMakes());
  
  // Car limit computations
  currentCarCount = computed(() => this.cars().length);
  carLimit = computed(() => {
    const status = this.subscriptionStatus();
    return status?.currentTier.limits.cars;
  });
  currentTier = computed(() => this.subscriptionStatus()?.currentTier.name || '');
  
  isAtCarLimit = computed(() => {
    const limit = this.carLimit();
    const count = this.currentCarCount();
    return typeof limit === 'number' && count >= limit;
  });
  
  isNearLimit = computed(() => {
    const limit = this.carLimit();
    const count = this.currentCarCount();
    return typeof limit === 'number' && count >= (limit * 0.9); // 90% threshold
  });
  
  remainingCars = computed(() => {
    const limit = this.carLimit();
    const count = this.currentCarCount();
    return limit ? Math.max(0, limit - count) : null;
  });
  
  carLimitDisplay = computed(() => {
    const count = this.formatNumber(this.currentCarCount());
    const limit = this.carLimit();
    const formattedLimit = limit ? this.formatNumber(limit) : '∞';
    return `${count}/${formattedLimit}`;
  });

  getUsagePercentage = computed(() => {
    const count = this.currentCarCount();
    const limit = this.carLimit();
    if (!limit) return 0;
    return Math.round((count / limit) * 100);
  });
  
  // Check if any filters are active
  hasActiveFilters = computed(() => {
    return this.searchQuery() !== '' || 
           this.selectedMake() !== 'all' || 
           this.selectedStatus() !== 'all';
  });
  
  filteredCars = computed(() => {
    let filtered = [...this.cars()];
    
    // Filter by search query
    const query = this.searchQuery().toLowerCase();
    if (query) {
      filtered = filtered.filter(car =>
        car.licensePlate.toLowerCase().includes(query) ||
        car.make.toLowerCase().includes(query) ||
        car.model.toLowerCase().includes(query) ||
        this.getCustomerName(car.customerId).toLowerCase().includes(query)
      );
    }
    
    // Filter by make
    if (this.selectedMake() !== 'all') {
      filtered = filtered.filter(car => car.make === this.selectedMake());
    }
    
    // Filter by service status
    if (this.selectedStatus() !== 'all') {
      filtered = filtered.filter(car => car.serviceStatus === this.selectedStatus());
    }
    
    return filtered;
  });
  
  statusCounts = computed(() => ({
    total: this.cars().length,
    upToDate: this.cars().filter(car => car.serviceStatus === 'up-to-date').length,
    dueSoon: this.cars().filter(car => car.serviceStatus === 'due-soon').length,
    overdue: this.cars().filter(car => car.serviceStatus === 'overdue').length
  }));

  ngOnInit(): void {
    this.loadCars();
    this.loadSubscriptionStatus();
  }

  private loadCars(): void {
    this.isLoading.set(true);
    this.carService.getCars().subscribe({
      next: (cars) => {
        this.cars.set(cars);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load cars:', error);
        this.isLoading.set(false);
      }
    });
  }

  private loadSubscriptionStatus(): void {
    this.subscriptionService.getCurrentSubscriptionStatus().subscribe({
      next: (status) => {
        this.subscriptionStatus.set(status);
      },
      error: (error) => {
        console.error('Failed to load subscription status:', error);
      }
    });
  }

  getCustomerName(customerId: string): string {
    const customer = this.carService.getCustomerById(customerId);
    return customer ? customer.name : 'Unknown Customer';
  }

  getStatusColor(status: string): string {
    const colors = {
      'up-to-date': 'text-green-600',
      'due-soon': 'text-amber-600',
      'overdue': 'text-red-600'
    };
    return colors[status as keyof typeof colors] || 'text-gray-600';
  }

  getStatusBadgeClass(status: string): string {
    const classes = {
      'up-to-date': 'badge badge-up-to-date',
      'due-soon': 'badge badge-due-soon',
      'overdue': 'badge badge-overdue'
    };
    return classes[status as keyof typeof classes] || 'badge badge-unknown';
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  onMakeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedMake.set(target.value);
  }

  onStatusChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedStatus.set(target.value);
  }

  setStatusFilter(status: string): void {
    this.selectedStatus.set(status);
  }

  onStatKeyDown(event: KeyboardEvent, status: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.setStatusFilter(status);
    }
  }

  toggleMobileFilters(): void {
    const currentState = this.showMobileFilters();
    this.showMobileFilters.set(!currentState);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedMake.set('all');
    this.selectedStatus.set('all');
  }

  onCarSelect(car: CarWithHistory): void {
    console.log('Selected car:', car);
    // TODO: Navigate to car details or open modal
  }

  onScheduleService(car: CarWithHistory): void {
    this.router.navigate(['/appointments'], { 
      queryParams: { 
        carId: car.id,
        licensePlate: car.licensePlate,
        make: car.make,
        model: car.model,
        customerId: car.customerId
      }
    });
  }

  onViewHistory(car: CarWithHistory): void {
    this.router.navigate(['/maintenance'], { 
      queryParams: { 
        carId: car.id,
        filter: 'history'
      }
    });
  }

  openRegistrationForm(): void {
    if (this.isAtCarLimit()) {
      this.showUpgradePrompt.set(true);
      return;
    }
    this.showRegistrationForm.set(true);
  }

  closeRegistrationForm(): void {
    this.showRegistrationForm.set(false);
  }

  onCarRegistered(car: CarWithHistory): void {
    this.loadCars();
    this.showRegistrationForm.set(false);
  }

  closeUpgradePrompt(): void {
    this.showUpgradePrompt.set(false);
  }

  onUpgradeRequested(event?: { tier: SubscriptionTierId; feature?: string }): void {
    this.router.navigate(['/subscription']);
    this.showUpgradePrompt.set(false);
  }

  getUpgradeMessage(): string {
    const tier = this.subscriptionStatus()?.currentTier;
    const count = this.currentCarCount();
    const limit = this.carLimit();
    
    if (!tier || !limit) return '';
    
    if (tier.id === 'solo') {
      return `Your Solo plan allows up to ${limit} vehicles. You currently have ${count}. Upgrade to Starter to manage up to 200 vehicles.`;
    } else if (tier.id === 'starter') {
      return `Your Starter plan allows up to ${limit} vehicles. You currently have ${count}. Upgrade to Professional for unlimited vehicles.`;
    }
    
    return 'Upgrade your plan to add more vehicles.';
  }

  getNextTier(): SubscriptionTierId | null {
    const currentTierId = this.subscriptionStatus()?.currentTier.id;
    if (currentTierId === 'solo') return 'starter';
    if (currentTierId === 'starter') return 'professional';
    return null;
  }

  getTierBadgeClass(): string {
    const tierId = this.subscriptionStatus()?.currentTier.id;
    switch (tierId) {
      case 'solo':
        return 'badge badge-tier-solo';
      case 'starter':
        return 'badge badge-tier-starter';
      case 'professional':
        return 'badge badge-tier-professional';
      default:
        return 'badge badge-info';
    }
  }

  onCarKeyDown(event: KeyboardEvent, car: CarWithHistory): void {
    switch(event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.onCarSelect(car);
        break;
      case 's':
      case 'S':
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          this.onScheduleService(car);
        }
        break;
      case 'h':
      case 'H':
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          this.onViewHistory(car);
        }
        break;
      case 'ArrowDown':
      case 'ArrowUp':
      case 'ArrowLeft':
      case 'ArrowRight':
        this.handleArrowNavigation(event);
        break;
    }
  }

  private handleArrowNavigation(event: KeyboardEvent): void {
    event.preventDefault();
    const gridItems = document.querySelectorAll('.car-grid-item[tabindex="0"]');
    const currentIndex = Array.from(gridItems).findIndex(item => item === document.activeElement);
    
    if (currentIndex === -1) return;
    
    let newIndex = currentIndex;
    const itemsPerRow = this.getItemsPerRow();
    
    switch(event.key) {
      case 'ArrowRight':
        newIndex = Math.min(currentIndex + 1, gridItems.length - 1);
        break;
      case 'ArrowLeft':
        newIndex = Math.max(currentIndex - 1, 0);
        break;
      case 'ArrowDown':
        newIndex = Math.min(currentIndex + itemsPerRow, gridItems.length - 1);
        break;
      case 'ArrowUp':
        newIndex = Math.max(currentIndex - itemsPerRow, 0);
        break;
    }
    
    (gridItems[newIndex] as HTMLElement).focus();
  }

  private getItemsPerRow(): number {
    const width = window.innerWidth;
    if (width < 768) return 1; // Mobile
    if (width < 1024) return 2; // Tablet
    if (width < 1280) return 2; // Small desktop
    return 3; // Large desktop
  }

  formatNumber(num: number): string {
    // Get current language locale
    const currentLang = this.languageService.getCurrentLanguage();
    
    // Map language codes to locales
    // For Arabic, use 'ar-TN' (Tunisia) or 'en-US' to ensure Western numerals
    const localeMap: Record<string, string> = {
      'en': 'en-US',
      'fr': 'fr-FR', 
      'ar': 'en-US' // Use English locale for Arabic to get Western numerals
    };
    
    const locale = localeMap[currentLang] || 'en-US';
    
    try {
      return new Intl.NumberFormat(locale).format(num);
    } catch (error) {
      // Fallback to basic formatting if locale is not supported
      return num.toLocaleString();
    }
  }

  formatNumbersInStatusCounts() {
    const counts = this.statusCounts();
    return {
      total: this.formatNumber(counts.total),
      upToDate: this.formatNumber(counts.upToDate),
      dueSoon: this.formatNumber(counts.dueSoon),
      overdue: this.formatNumber(counts.overdue)
    };
  }
}