import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../core/services/theme.service';
import { AppointmentService } from './services/appointment.service';
import { AppointmentModalComponent } from './components/appointment-modal.component';
import { SwipeDirective, SwipeEvent } from '../../shared/directives/swipe.directive';
import { Appointment, AppointmentStatus } from '../../core/models/appointment.model';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule, AppointmentModalComponent, SwipeDirective],
  templateUrl: './appointments.component.html',
  styleUrl: './appointments.component.css'
})
export class AppointmentsComponent {
  private appointmentService = inject(AppointmentService);
  public themeService = inject(ThemeService);
  
  // Signals for reactive state
  selectedDate = this.appointmentService.selectedDate;
  viewMode = this.appointmentService.viewMode;
  appointments = signal<Appointment[]>([]);
  filteredAppointments = signal<Appointment[]>([]);
  
  // UI state
  isLoading = signal(false);
  showAddModal = signal(false);
  selectedAppointment = signal<Appointment | null>(null);
  
  // Filters
  selectedMechanic = signal<string>('all');
  selectedStatus = signal<AppointmentStatus | 'all'>('all');
  searchQuery = signal<string>('');
  
  // Mobile optimizations
  isMobileView = signal(false);
  showMobileFilters = signal(false);
  
  // Computed values
  todayAppointments = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.appointments().filter(apt => {
      const aptDate = new Date(apt.scheduledDate);
      return aptDate >= today && aptDate < tomorrow;
    });
  });

  completedToday = computed(() => 
    this.todayAppointments().filter(apt => apt.status === 'completed').length
  );

  inProgressCount = computed(() =>
    this.appointments().filter(apt => apt.status === 'in-progress').length
  );

  constructor() {
    this.checkMobileView();
    this.loadAppointments();
    this.setupFilters();
    
    // Listen for window resize
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.checkMobileView());
    }
  }

  private checkMobileView(): void {
    if (typeof window !== 'undefined') {
      this.isMobileView.set(window.innerWidth < 1024);
    }
  }

  loadAppointments(): void {
    this.isLoading.set(true);
    this.appointmentService.getAppointments().subscribe({
      next: (appointments) => {
        this.appointments.set(appointments);
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load appointments:', error);
        this.isLoading.set(false);
      }
    });
  }

  private setupFilters(): void {
    // Auto-apply filters when any filter value changes
    // This would use effect() in a real implementation
  }

  applyFilters(): void {
    let filtered = [...this.appointments()];
    
    // Filter by mechanic
    if (this.selectedMechanic() !== 'all') {
      filtered = filtered.filter(apt => apt.mechanicId === this.selectedMechanic());
    }
    
    // Filter by status
    if (this.selectedStatus() !== 'all') {
      filtered = filtered.filter(apt => apt.status === this.selectedStatus());
    }
    
    // Filter by search query
    const query = this.searchQuery().toLowerCase();
    if (query) {
      filtered = filtered.filter(apt => 
        apt.serviceName.toLowerCase().includes(query) ||
        apt.notes?.toLowerCase().includes(query)
      );
    }
    
    // Filter by selected date
    const selectedDay = this.selectedDate();
    const dayStart = new Date(selectedDay);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDay);
    dayEnd.setHours(23, 59, 59, 999);
    
    filtered = filtered.filter(apt => {
      const aptDate = new Date(apt.scheduledDate);
      return aptDate >= dayStart && aptDate <= dayEnd;
    });

    this.filteredAppointments.set(filtered);
  }

  // Date navigation
  goToPreviousDay(): void {
    const currentDate = new Date(this.selectedDate());
    currentDate.setDate(currentDate.getDate() - 1);
    this.selectedDate.set(currentDate);
    this.applyFilters();
  }

  goToNextDay(): void {
    const currentDate = new Date(this.selectedDate());
    currentDate.setDate(currentDate.getDate() + 1);
    this.selectedDate.set(currentDate);
    this.applyFilters();
  }

  goToToday(): void {
    this.selectedDate.set(new Date());
    this.applyFilters();
  }

  selectDate(date: Date): void {
    this.selectedDate.set(date);
    this.applyFilters();
  }

  // View mode switching
  setViewMode(mode: 'day' | 'week' | 'month'): void {
    this.viewMode.set(mode);
  }

  // Appointment actions
  selectAppointment(appointment: Appointment): void {
    this.selectedAppointment.set(appointment);
  }

  updateAppointmentStatus(appointmentId: string, status: AppointmentStatus): void {
    this.appointmentService.updateAppointment(appointmentId, { status }).subscribe({
      next: () => {
        this.loadAppointments();
      },
      error: (error) => {
        console.error('Failed to update appointment:', error);
      }
    });
  }

  deleteAppointment(appointmentId: string): void {
    if (confirm('Are you sure you want to delete this appointment?')) {
      this.appointmentService.deleteAppointment(appointmentId).subscribe({
        next: () => {
          this.loadAppointments();
        },
        error: (error) => {
          console.error('Failed to delete appointment:', error);
        }
      });
    }
  }

  // Modal management
  openAddModal(): void {
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  closeAppointmentDetails(): void {
    this.selectedAppointment.set(null);
  }

  // Mobile specific methods
  toggleMobileFilters(): void {
    this.showMobileFilters.set(!this.showMobileFilters());
  }

  // Swipe gesture handlers
  onSwipeLeft(event: SwipeEvent): void {
    if (this.isMobileView()) {
      this.goToNextDay();
    }
  }

  onSwipeRight(event: SwipeEvent): void {
    if (this.isMobileView()) {
      this.goToPreviousDay();
    }
  }

  onAppointmentSwipeRight(appointment: Appointment, event: SwipeEvent): void {
    // Swipe right to complete appointment
    if (appointment.status !== 'completed') {
      this.updateAppointmentStatus(appointment.id, 'completed');
    }
  }

  onAppointmentSwipeLeft(appointment: Appointment, event: SwipeEvent): void {
    // Swipe left to edit appointment
    this.selectedAppointment.set(appointment);
  }

  // Utility methods
  formatTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }

  getStatusColor(status: AppointmentStatus): string {
    const colors = {
      'scheduled': '#3b82f6', // blue
      'in-progress': '#f59e0b', // amber  
      'completed': '#10b981', // green
      'cancelled': '#ef4444' // red
    };
    return colors[status];
  }

  getPriorityColor(priority: string): string {
    const colors = {
      'low': '#6b7280',    // gray
      'medium': '#f59e0b', // amber
      'high': '#ef4444'    // red
    };
    return colors[priority as keyof typeof colors] || colors.low;
  }

  // Helper methods for template
  getCarInfo(carId: string): string {
    const car = this.appointmentService.getCarById(carId);
    return car ? `${car.make} ${car.model} - ${car.licensePlate}` : 'Unknown Car';
  }

  getCustomerName(customerId: string): string {
    const customer = this.appointmentService.getCustomerById(customerId);
    return customer ? customer.name : 'Unknown Customer';
  }

  getMechanicName(mechanicId: string): string {
    const mechanic = this.appointmentService.getMechanicById(mechanicId);
    return mechanic ? mechanic.name : 'Unassigned';
  }

  isToday(): boolean {
    const today = new Date();
    const selected = this.selectedDate();
    return today.toDateString() === selected.toDateString();
  }

  getSelectedDateString(): string {
    return this.selectedDate().toISOString().split('T')[0];
  }

  onDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectDate(new Date(target.value));
  }

  onMechanicChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedMechanic.set(target.value);
    this.applyFilters();
  }

  onStatusChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedStatus.set(target.value as any);
    this.applyFilters();
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
    this.applyFilters();
  }

  setStatusFilter(status: any): void {
    this.selectedStatus.set(status);
    this.applyFilters();
  }
}