import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CarService, CarWithHistory } from './services/car.service';
import { Customer } from '../../core/models/appointment.model';
import { CarCardComponent } from './components/car-card.component';
import { CarRegistrationFormComponent } from './components/car-registration-form.component';

@Component({
  selector: 'app-cars',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CarCardComponent, CarRegistrationFormComponent],
  templateUrl: './cars.component.html',
  styleUrl: './cars.component.css'
})
export class CarsComponent implements OnInit {
  private carService = inject(CarService);
  
  cars = signal<CarWithHistory[]>([]);
  isLoading = signal(false);
  showRegistrationForm = signal(false);
  
  searchQuery = signal('');
  selectedMake = signal('all');
  selectedStatus = signal('all');
  showMobileFilters = signal(false);
  
  availableMakes = computed(() => this.carService.getAvailableMakes());
  
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
      'up-to-date': 'bg-green-100 text-green-700 border-green-200',
      'due-soon': 'bg-amber-100 text-amber-700 border-amber-200',
      'overdue': 'bg-red-100 text-red-700 border-red-200'
    };
    return classes[status as keyof typeof classes] || 'bg-gray-100 text-gray-700 border-gray-200';
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

  toggleMobileFilters(): void {
    this.showMobileFilters.set(!this.showMobileFilters());
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
    console.log('Schedule service for car:', car);
    // TODO: Navigate to appointment booking with pre-filled car
  }

  onViewHistory(car: CarWithHistory): void {
    console.log('View history for car:', car);
    // TODO: Navigate to car service history
  }

  openRegistrationForm(): void {
    this.showRegistrationForm.set(true);
  }

  closeRegistrationForm(): void {
    this.showRegistrationForm.set(false);
  }

  onCarRegistered(car: CarWithHistory): void {
    this.loadCars();
    this.showRegistrationForm.set(false);
  }
}