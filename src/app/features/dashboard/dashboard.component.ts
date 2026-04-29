import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { forkJoin, of, Subscription } from 'rxjs';

import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle.component';
import { MaintenanceAlertsCardComponent } from '../../shared/components/maintenance-alerts-card/maintenance-alerts-card.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TranslationService } from '../../core/services/translation.service';
import { LanguageService } from '../../core/services/language.service';
import { AuthService } from '../../core/services/auth.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OnboardingTourComponent } from '../../shared/components/onboarding-tour/onboarding-tour.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { AppointmentService } from '../appointments/services/appointment.service';
import { CustomerService } from '../../core/services/customer.service';
import { EmployeeService } from '../../core/services/employee.service';
import { PartService } from '../../core/services/part.service';
import { InvoiceService } from '../../core/services/invoice.service';
import { MaintenanceService } from '../../core/services/maintenance.service';

Chart.register(...registerables);

interface TodayAppointment {
  id: string;
  time: string;
  customerName: string;
  carModel: string;
  licensePlate: string;
  serviceType: string;
  status: string;
  estimatedDuration: number;
  mechanic?: string;
}

interface ActiveJob {
  id: string;
  customerName: string;
  carModel: string;
  licensePlate: string;
  services: string[];
  startedAt: string;
  estimatedCompletion: string;
  mechanic: string;
  progress: number;
  status: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, LanguageToggleComponent, MaintenanceAlertsCardComponent, TranslatePipe, OnboardingTourComponent, TooltipDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private translationService = inject(TranslationService);
  private languageService = inject(LanguageService);
  private authService = inject(AuthService);
  private onboardingService = inject(OnboardingService);
  private appointmentService = inject(AppointmentService);
  private customerService = inject(CustomerService);
  private employeeService = inject(EmployeeService);
  private partService = inject(PartService);
  private invoiceService = inject(InvoiceService);
  private maintenanceService = inject(MaintenanceService);

  private languageSub?: Subscription;
  private cachedInvoices: any[] = [];
  private cachedAppointments: any[] = [];
  private cachedEmployees: any[] = [];

  isOwner = signal(false);

  tooltipQuickActions = computed(() => this.getTooltip('quick_actions'));
  tooltipMetrics = computed(() => this.getTooltip('metrics'));
  tooltipSchedule = computed(() => this.getTooltip('schedule'));
  tooltipActiveJobs = computed(() => this.getTooltip('active_jobs'));

  metrics = {
    totalCarsToday: 0,
    carsInProgress: 0,
    carsCompleted: 0,
    carsWaitingApproval: 0,
    todayRevenue: 0,
    availableSlots: 0,
    totalSlots: 8,
    activeMechanics: 0
  };

  todayAppointments: TodayAppointment[] = [];
  activeJobs: ActiveJob[] = [];

  kpiCards: { labelKey: string; value: string; trend: string; trendDirection: 'up' | 'down'; trendLabelKey: string; icon: string }[] = [];

  // Charts
  revenueChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  revenueChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', callback: (v) => v + ' TND' } }
    },
    plugins: { legend: { display: false } }
  };

  jobTypeChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  jobTypeChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'right', labels: { color: '#94a3b8', padding: 12, font: { size: 12 } } } },
    cutout: '65%',
  };

  mechanicChartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  mechanicChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8' }, stacked: true },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' }, stacked: true }
    },
    plugins: { legend: { labels: { color: '#94a3b8' } } }
  };

  ngOnInit(): void {
    this.isOwner.set(this.authService.isOwner());
    this.loadDashboardData();
    setTimeout(() => this.onboardingService.startTourForCurrentUser(), 1000);

    // Rebuild after translations finish loading (translations$ fires AFTER the
    // new language file is fetched; currentLanguage$ fires before, which would
    // pick up stale cached translations on language switch).
    this.languageSub = this.translationService.translations$.subscribe(() => {
      this.rebuildLocalizedViews();
    });
  }

  ngOnDestroy(): void {
    this.languageSub?.unsubscribe();
  }

  getCurrentDate(): string {
    const lang = this.languageService.getCurrentLanguage();
    const locale = lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-FR' : 'en-US';
    return new Date().toLocaleDateString(locale, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  private rebuildLocalizedViews(): void {
    if (!this.cachedAppointments.length && !this.cachedInvoices.length) return;
    this.rebuildKpiCards();
    this.buildRevenueChart(this.cachedInvoices);
    this.buildJobTypeChart(this.cachedAppointments);
    this.buildMechanicChart(this.cachedAppointments, this.cachedEmployees);
  }

  private rebuildKpiCards(): void {
    const occupiedBays = this.metrics.totalSlots - this.metrics.availableSlots;
    const todayLabel = this.translationService.instant('dashboard.kpi.today');
    this.kpiCards = [
      { labelKey: 'dashboard.kpi.revenue', value: this.formatCurrency(this.metrics.todayRevenue), trend: '', trendDirection: 'up', trendLabelKey: 'dashboard.kpi.today', icon: 'revenue' },
      { labelKey: 'dashboard.kpi.appointments', value: `${this.metrics.totalCarsToday} ${todayLabel}`, trend: '', trendDirection: 'up', trendLabelKey: '', icon: 'appointments' },
      { labelKey: 'dashboard.kpi.utilization', value: `${Math.round(this.getCapacityPercentage())}%`, trend: `${occupiedBays}/${this.metrics.totalSlots}`, trendDirection: 'up', trendLabelKey: 'dashboard.kpi.baysOccupied', icon: 'utilization' },
      { labelKey: 'dashboard.kpi.activeJobs', value: `${this.activeJobs.length}`, trend: '', trendDirection: 'up', trendLabelKey: '', icon: 'jobs' },
    ];
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  getCapacityPercentage(): number {
    return this.metrics.totalSlots > 0 ? ((this.metrics.totalSlots - this.metrics.availableSlots) / this.metrics.totalSlots) * 100 : 0;
  }

  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'scheduled': 'badge badge-pending', 'in-progress': 'badge badge-active', 'in_progress': 'badge badge-active',
      'completed': 'badge badge-completed', 'delayed': 'badge badge-cancelled', 'cancelled': 'badge badge-cancelled',
      'diagnosis': 'badge badge-active', 'waiting-parts': 'badge badge-pending', 'waiting_parts': 'badge badge-pending',
      'in-repair': 'badge badge-active', 'in_repair': 'badge badge-active',
      'quality-check': 'badge badge-completed', 'quality_check': 'badge badge-completed',
      'waiting-approval': 'badge badge-pending', 'waiting_approval': 'badge badge-pending'
    };
    return classes[status] || 'badge badge-pending';
  }

  getProgressBarClass(progress: number): string {
    if (progress < 30) return 'bg-error-500';
    if (progress < 70) return 'bg-warning-500';
    return 'bg-success-500';
  }

  getTimelineItemClass(status: string): string {
    return `timeline-item-${status.replace('_', '-')}`;
  }

  getTimelineDotClass(status: string): string {
    const map: Record<string, string> = {
      'scheduled': 'scheduled', 'in-progress': 'in-progress', 'in_progress': 'in-progress',
      'completed': 'completed', 'delayed': 'delayed'
    };
    return map[status] || 'scheduled';
  }

  getTooltip(key: string): string {
    const fullKey = `dashboard.tooltips.${key}`;
    const translated = this.translationService.instant(fullKey);
    return translated === fullKey ? '' : translated;
  }

  navigateToNewCar(): void { this.router.navigate(['/cars'], { queryParams: { action: 'add' } }); }
  navigateToAppointments(): void { this.router.navigate(['/calendar']); }
  navigateToInvoicing(): void { this.router.navigate(['/invoices/create']); }
  navigateToQualityCheck(): void { this.router.navigate(['/maintenance/active']); }

  onTimelineItemClick(appointment: TodayAppointment): void {
    this.router.navigate(['/calendar'], { queryParams: { appointmentId: appointment.id } });
  }

  onJobCardClick(job: ActiveJob): void {
    this.router.navigate(['/maintenance/details', job.id]);
  }

  private loadDashboardData(): void {
    const isOwner = this.authService.isOwner();
    forkJoin({
      appointments: this.appointmentService.getAppointments(),
      customers: this.customerService.getCustomers(),
      employees: this.employeeService.getEmployees(),
      parts: isOwner ? this.partService.getParts() : of([]),
      invoices: isOwner ? this.invoiceService.getInvoices() : of([]),
      cars: this.appointmentService.getCars(),
      maintenanceJobs: this.maintenanceService.getMaintenanceJobs()
    }).subscribe({
      next: ({ appointments, customers, employees, parts, invoices, cars, maintenanceJobs }) => {
        this.cachedAppointments = appointments;
        this.cachedInvoices = invoices;
        this.cachedEmployees = employees;
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        // Filter today's appointments
        const todayAppts = appointments.filter(a => {
          const d = new Date(a.scheduledDate);
          return d >= startOfToday && d <= endOfToday;
        });

        const completed = todayAppts.filter(a => a.status === 'completed').length;
        const inProgress = todayAppts.filter(a => a.status === 'in-progress').length;
        const waitingApproval = appointments.filter(a => (a.status as string) === 'waiting-approval').length;

        this.metrics = {
          totalCarsToday: todayAppts.length,
          carsInProgress: inProgress,
          carsCompleted: completed,
          carsWaitingApproval: waitingApproval,
          todayRevenue: invoices.filter(i => {
            const d = new Date(i.issueDate);
            return d >= startOfToday && d <= endOfToday && i.status === 'paid';
          }).reduce((sum, i) => sum + i.paidAmount, 0),
          availableSlots: Math.max(0, 8 - todayAppts.length),
          totalSlots: 8,
          activeMechanics: employees.filter(e => e.availability?.isAvailable).length
        };

        // Today's schedule
        this.todayAppointments = todayAppts.map(a => {
          const d = new Date(a.scheduledDate);
          const mechanic = employees.find(e => e.id === a.mechanicId);
          const customer = customers.find(c => c.id === a.customerId);
          const car = cars.find(c => c.id === a.carId);
          return {
            id: a.id,
            time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            customerName: customer?.name || a.customerId,
            carModel: car ? `${car.make} ${car.model}` : '',
            licensePlate: car?.licensePlate || '',
            serviceType: a.serviceName,
            status: a.status.replace(/-/g, '_'),
            estimatedDuration: a.estimatedDuration / 60,
            mechanic: mechanic?.personalInfo?.fullName || ''
          };
        }).sort((a, b) => a.time.localeCompare(b.time));

        // Active jobs come from maintenance jobs being worked on, not appointments —
        // appointments only flag the visit; the actual work tracked in /maintenance/active.
        const activeStatuses = new Set(['in-progress', 'quality-check', 'waiting-parts', 'waiting-approval']);
        this.activeJobs = maintenanceJobs.filter(j => activeStatuses.has(j.status)).map(j => {
          const start = j.startDate ? new Date(j.startDate) : new Date(j.createdAt);
          const end = new Date(start.getTime() + j.estimatedDuration * 60000);
          const now = Date.now();
          const totalMs = end.getTime() - start.getTime();
          const elapsedMs = now - start.getTime();
          const progress = totalMs > 0
            ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)))
            : 0;

          return {
            id: j.id,
            customerName: j.customerName || '',
            carModel: j.carDetails || '',
            licensePlate: j.licensePlate || '',
            services: [j.jobTitle],
            startedAt: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            estimatedCompletion: end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            mechanic: j.mechanicName || '',
            progress,
            status: j.status.replace(/-/g, '_')
          };
        });

        // KPI cards
        this.rebuildKpiCards();

        // Revenue chart — group invoices by month
        this.buildRevenueChart(invoices);

        // Job type chart — group appointments by serviceType
        this.buildJobTypeChart(appointments);

        // Mechanic chart — group appointments by mechanic
        this.buildMechanicChart(appointments, employees);
      },
      error: () => {
        // If API fails, leave defaults (empty)
      }
    });
  }

  private buildRevenueChart(invoices: any[]): void {
    // Sum revenue by year-month key, then render the last 12 months chronologically
    // (oldest on the left, newest on the right).
    const totals = new Map<string, number>();
    invoices.forEach(inv => {
      const d = new Date(inv.issueDate || inv.createdAt || inv.date);
      if (isNaN(d.getTime())) return;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      totals.set(ym, (totals.get(ym) || 0) + (inv.totalAmount || inv.total || 0));
    });

    const lang = this.languageService.getCurrentLanguage();
    const locale = lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-FR' : 'en-US';
    const months: { ym: string; label: string }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
      });
    }

    const labels = months.map(m => m.label);
    const data = months.map(m => totals.get(m.ym) || 0);
    const hasData = data.some(v => v > 0);

    this.revenueChartData = {
      labels,
      datasets: [{
        data: hasData ? data : labels.map(() => 0),
        label: this.translationService.instant('dashboard.kpi.revenue'),
        fill: true, tension: 0.4,
        borderColor: '#FF8400', backgroundColor: 'rgba(255, 132, 0, 0.1)',
        pointBackgroundColor: '#FF8400', pointBorderColor: '#FF8400',
        pointHoverBackgroundColor: '#fff', pointHoverBorderColor: '#FF8400',
      }]
    };
  }

  private buildJobTypeChart(appointments: any[]): void {
    const typeCounts: Record<string, number> = {};
    appointments.forEach(a => {
      const type = a.serviceType || a.serviceName || 'Other';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const labels = Object.keys(typeCounts);
    const data = Object.values(typeCounts);
    const colors = ['#FF8400', '#8FA0D8', '#F9DFC6', '#22c55e', '#a855f7', '#06b6d4', '#f97316', '#ec4899'];

    this.jobTypeChartData = {
      labels: labels.length ? labels : ['No data'],
      datasets: [{
        data: data.length ? data : [1],
        backgroundColor: colors.slice(0, Math.max(labels.length, 1)),
        borderColor: '#ffffff', borderWidth: 2,
      }]
    };
  }

  private buildMechanicChart(appointments: any[], employees: any[]): void {
    const mechanicStats: Record<string, { completed: number; inProgress: number; name: string }> = {};

    appointments.forEach(a => {
      const empId = a.mechanicId;
      if (!empId) return;
      if (!mechanicStats[empId]) {
        const emp = employees.find(e => e.id === empId);
        mechanicStats[empId] = { completed: 0, inProgress: 0, name: emp?.personalInfo?.fullName || emp?.personalInfo?.firstName || empId };
      }
      if (a.status === 'completed') mechanicStats[empId].completed++;
      else if (a.status === 'in-progress') mechanicStats[empId].inProgress++;
    });

    const entries = Object.values(mechanicStats);
    const labels = entries.map(e => e.name);

    this.mechanicChartData = {
      labels: labels.length ? labels : ['No data'],
      datasets: [
        { data: entries.map(e => e.completed), label: this.translationService.instant('dashboard.charts.completed'), backgroundColor: '#FF8400', borderRadius: 6 },
        { data: entries.map(e => e.inProgress), label: this.translationService.instant('dashboard.charts.inProgress'), backgroundColor: '#8FA0D8', borderRadius: 6 },
      ]
    };
  }
}
