import { Component, inject, signal, computed, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AppointmentService } from './services/appointment.service';
import { AppointmentModalComponent } from './components/appointment-modal.component';
import { SwipeDirective, SwipeEvent } from '../../shared/directives/swipe.directive';
import { Appointment, AppointmentStatus } from '../../core/models/appointment.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { LanguageService } from '../../core/services/language.service';
import { TranslationService } from '../../core/services/translation.service';
import { forkJoin } from 'rxjs';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule, AppointmentModalComponent, SwipeDirective, TranslatePipe, TooltipDirective],
  templateUrl: './appointments.component.html',
  styleUrl: './appointments.component.css'
})
export class AppointmentsComponent implements AfterViewInit {
  private appointmentService = inject(AppointmentService);
  private languageService = inject(LanguageService);
  public translationService = inject(TranslationService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  
  @ViewChild(AppointmentModalComponent) appointmentModal!: AppointmentModalComponent;
  
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
  
  // Navigation state
  currentView = signal<'calendar' | 'list' | 'today'>('list');

  // Computed tooltip texts that reactively update with translations
  tooltipFilters = computed(() => this.getTooltip('filters'));
  tooltipViewMode = computed(() => this.getTooltip('view_mode'));
  tooltipAddAppointment = computed(() => this.getTooltip('add_appointment'));

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

  // Tooltip translation methods - defined before constructor
  getTooltip(key: string): string {
    const fullKey = `appointments.tooltips.${key}`;
    const translated = this.translationService.instant(fullKey);
    // Return empty string if translation not found (returns key when not found)
    return translated === fullKey ? '' : translated;
  }

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
    forkJoin({
      customers: this.appointmentService.getCustomers(),
      cars: this.appointmentService.getCars(),
      mechanics: this.appointmentService.getMechanics(),
      appointments: this.appointmentService.getAppointments()
    }).subscribe({
      next: ({ appointments }) => {
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

  ngAfterViewInit(): void {
    this.consumeSchedulingQueryParams();
  }

  /**
   * Map predictive-maintenance service slugs to the modal's form values,
   * then open the modal pre-filled. Used when an external surface
   * (dashboard card / car detail) links here with scheduling context.
   */
  private consumeSchedulingQueryParams(): void {
    const qp = this.route.snapshot.queryParamMap;
    const carId = qp.get('carId');
    const serviceType = qp.get('serviceType');
    const scheduledDate = qp.get('scheduledDate');

    if (!carId && !serviceType) return;

    const serviceTypeMap: Record<string, string> = {
      'oil-change': 'oil-change',
      'brake-service': 'brake-repair',
      'tire-rotation': 'tires',
      'transmission-service': 'transmission',
      'timing-belt': 'engine',
      'air-filter': 'inspection',
      'coolant-flush': 'inspection',
      'general-inspection': 'inspection',
    };
    const mappedType = serviceType ? serviceTypeMap[serviceType] || serviceType : undefined;
    const serviceNameKey = serviceType
      ? `maintenance.predictions.service.${serviceType}`
      : undefined;
    const serviceName = serviceNameKey
      ? this.translationService.instant(serviceNameKey)
      : undefined;

    this.showAddModal.set(true);
    setTimeout(() => {
      this.appointmentModal?.setInitialContext({
        carId: carId || undefined,
        serviceType: mappedType,
        serviceName: serviceName && serviceName !== serviceNameKey ? serviceName : undefined,
        scheduledDate: scheduledDate || undefined,
      });
      // Strip the query params so reopening the page doesn't re-trigger the modal.
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
    }, 0);
  }

  // Appointment actions
  selectAppointment(appointment: Appointment): void {
    this.selectedAppointment.set(appointment);
    this.showAddModal.set(true); // Open the modal for editing
    
    // Set the appointment for editing after a brief delay to ensure modal is rendered
    setTimeout(() => {
      if (this.appointmentModal) {
        this.appointmentModal.setEditAppointment(appointment);
      }
    }, 0);
  }

  updateAppointmentStatus(appointmentId: string, status: AppointmentStatus): void {
    this.appointmentService.updateAppointment(appointmentId, { status }).subscribe({
      next: () => {
        this.toast.success(`Appointment marked as ${status}`);
        this.loadAppointments();
      },
      error: (error) => {
        console.error('Failed to update appointment:', error);
        this.toast.error('Failed to update appointment status');
      }
    });
  }

  deleteAppointment(appointmentId: string): void {
    if (confirm('Are you sure you want to delete this appointment?')) {
      this.appointmentService.deleteAppointment(appointmentId).subscribe({
        next: () => {
          this.toast.success('Appointment deleted successfully');
          this.loadAppointments();
        },
        error: (error) => {
          console.error('Failed to delete appointment:', error);
          this.toast.error('Failed to delete appointment');
        }
      });
    }
  }

  // Modal management
  openAddModal(): void {
    this.selectedAppointment.set(null); // Clear any selected appointment
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.selectedAppointment.set(null); // Clear selected appointment
  }

  closeAppointmentDetails(): void {
    this.selectedAppointment.set(null);
  }

  // Mobile specific methods
  toggleMobileFilters(): void {
    this.showMobileFilters.set(!this.showMobileFilters());
  }

  // Navigation methods
  setView(view: 'calendar' | 'list' | 'today'): void {
    this.currentView.set(view);
    if (view === 'today') {
      this.goToToday();
    }
    this.applyFilters();
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
  private getLocaleCode = computed(() => {
    const currentLang = this.languageService.currentLanguage();
    const localeMap = {
      'en': 'en-US',
      'fr': 'fr-FR',
      'ar': 'ar-SA'
    };
    return localeMap[currentLang] || 'en-US';
  });

  formatTime(date: Date): string {
    const locale = this.getLocaleCode();
    const currentLang = this.languageService.currentLanguage();
    
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: currentLang !== 'fr', // French uses 24h format typically
      numberingSystem: currentLang === 'ar' ? 'latn' : undefined // Use Western numerals for Arabic
    };
    
    return new Intl.DateTimeFormat(locale, options).format(date);
  }

  formatDate(date: Date): string {
    const locale = this.getLocaleCode();
    const currentLang = this.languageService.currentLanguage();
    
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      calendar: 'gregory', // Force Georgian calendar for all languages
      numberingSystem: currentLang === 'ar' ? 'latn' : undefined // Use Western numerals for Arabic
    };
    
    return new Intl.DateTimeFormat(locale, options).format(date);
  }

  getStatusColor(status: AppointmentStatus): string {
    const colors: Record<AppointmentStatus, string> = {
      'scheduled': '#FF8400',
      'confirmed': '#0ea5e9',
      'pending': '#f59e0b',
      'in-progress': '#7B8CC4',
      'completed': '#10b981',
      'cancelled': '#ef4444'
    };
    return colors[status] || '#6b7280';
  }

  getPriorityColor(priority: string): string {
    const colors = {
      'low': '#6b7280',    // gray
      'medium': '#7B8CC4', // amber
      'high': '#ef4444'    // red
    };
    return colors[priority as keyof typeof colors] || colors.low;
  }

  // Helper methods for template
  getCarInfo(carId: string): string {
    const car = this.appointmentService.getCarById(carId);
    return car ? `${car.make} ${car.model} - ${car.licensePlate}` : this.translationService.instant('appointments.unknownCar');
  }

  getCustomerName(customerId: string): string {
    const customer = this.appointmentService.getCustomerById(customerId);
    return customer ? customer.name : this.translationService.instant('appointments.unknownCustomer');
  }

  getMechanicName(mechanicId: string): string {
    const mechanic = this.appointmentService.getMechanicById(mechanicId);
    return mechanic ? mechanic.name : this.translationService.instant('appointments.unassigned');
  }

  getServiceName(serviceName: string): string {
    // Try to get translation first, if not found return original name
    const translationKey = `serviceNames.${serviceName}`;
    const translatedName = this.translationService.instant(translationKey);
    return translatedName === translationKey ? serviceName : translatedName;
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