import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { forkJoin, of, Subscription } from 'rxjs';

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

type GlanceColor = 'orange' | 'blue' | 'green' | 'gray';

interface GlanceDelta {
  kind: 'change' | 'detail';
  text?: string;
  direction?: 'up' | 'down';
  textKey?: string;
  params?: Record<string, unknown>;
}

interface GlanceCard {
  labelKey: string;
  value: string;
  unit?: string;
  delta: GlanceDelta | null;
  comparisonKey?: string;
  sparkline: number[];
  color: GlanceColor;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, MaintenanceAlertsCardComponent, TranslatePipe, OnboardingTourComponent, TooltipDirective],
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
  cachedMaintenanceJobs: any[] = [];

  glanceCards: GlanceCard[] = [];
  asOfTime = '';

  // Charts
  revenueRange = signal<7 | 30 | 90>(30);
  revenueChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  revenueChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: '#9ca3af',
          font: { size: 12 },
          maxRotation: 0,
          autoSkip: true,
          autoSkipPadding: 16,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(17, 24, 39, 0.06)' },
        border: { display: false },
        ticks: {
          color: '#9ca3af',
          font: { size: 12 },
          callback: (v) => this.formatRevenueTick(Number(v)),
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (ctx) => `${this.formatNumber(Number(ctx.parsed.y), this.numberLocale())} TND`,
        },
      },
    },
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
      this.updateAsOfTime();
      this.rebuildLocalizedViews();
    });
    this.updateAsOfTime();
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
    this.rebuildGlanceCards();
    this.buildRevenueChart(this.cachedInvoices);
    this.buildJobTypeChart(this.cachedAppointments);
    this.buildMechanicChart(this.cachedAppointments, this.cachedEmployees);
  }

  setRevenueRange(days: 7 | 30 | 90): void {
    if (this.revenueRange() === days) return;
    this.revenueRange.set(days);
    this.buildRevenueChart(this.cachedInvoices);
  }

  revenueRangeSubtitleParams = computed(() => ({ days: this.revenueRange() }));

  private numberLocale(): string {
    const lang = this.languageService.getCurrentLanguage();
    return lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-FR' : 'en-US';
  }

  private formatRevenueTick(value: number): string {
    const locale = this.numberLocale();
    if (Math.abs(value) >= 1000) {
      const k = value / 1000;
      const formatted = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(k);
      return `${formatted}k`;
    }
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  }

  private rebuildGlanceCards(): void {
    const lang = this.languageService.getCurrentLanguage();
    const numLocale = lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-FR' : 'en-US';

    // 8-day window: index 0 = 7 days ago (same day last week), index 7 = today.
    const WINDOW = 8;
    const revenueSeries = this.dailyRevenueSeries(this.cachedInvoices, WINDOW);
    const apptSeries = this.dailyAppointmentSeries(this.cachedAppointments, WINDOW);
    const utilizationSeries = apptSeries.map(c => Math.min(100, (c / this.metrics.totalSlots) * 100));
    const activeJobsSeries = this.dailyActiveJobsSeries(this.cachedMaintenanceJobs, WINDOW);

    const lastIdx = WINDOW - 1;
    const occupiedBays = this.metrics.totalSlots - this.metrics.availableSlots;
    const revenueDelta = this.percentDelta(revenueSeries[lastIdx], revenueSeries[0]);
    const apptDelta = this.absoluteDelta(apptSeries[lastIdx], apptSeries[0]);
    const activeJobsToday = this.activeJobs.length;
    const activeJobsYesterday = activeJobsSeries[lastIdx - 1] ?? activeJobsToday;
    const activeJobsDelta = this.absoluteDelta(activeJobsToday, activeJobsYesterday);

    this.glanceCards = [
      {
        labelKey: 'dashboard.kpi.revenueToday',
        value: this.formatNumber(this.metrics.todayRevenue, numLocale),
        unit: 'TND',
        delta: revenueDelta !== null
          ? { kind: 'change', text: this.formatSignedPercent(revenueDelta, numLocale), direction: revenueDelta >= 0 ? 'up' : 'down' }
          : null,
        comparisonKey: 'dashboard.kpi.vsLastWeek',
        sparkline: revenueSeries,
        color: 'orange',
      },
      {
        labelKey: 'dashboard.kpi.appointmentsToday',
        value: this.formatNumber(this.metrics.totalCarsToday, numLocale),
        delta: apptDelta !== null
          ? { kind: 'change', text: this.formatSignedNumber(apptDelta, numLocale), direction: apptDelta >= 0 ? 'up' : 'down' }
          : null,
        comparisonKey: 'dashboard.kpi.vsLastWeek',
        sparkline: apptSeries,
        color: 'blue',
      },
      {
        labelKey: 'dashboard.kpi.bayUtilization',
        value: this.formatNumber(Math.round(this.getCapacityPercentage()), numLocale),
        unit: '%',
        delta: {
          kind: 'detail',
          textKey: 'dashboard.kpi.baysOf',
          params: { occupied: occupiedBays, total: this.metrics.totalSlots },
        },
        sparkline: utilizationSeries,
        color: 'green',
      },
      {
        labelKey: 'dashboard.kpi.activeJobs',
        value: this.formatNumber(activeJobsToday, numLocale),
        delta: activeJobsDelta !== null && activeJobsDelta !== 0
          ? { kind: 'change', text: this.formatSignedNumber(activeJobsDelta, numLocale), direction: activeJobsDelta >= 0 ? 'up' : 'down' }
          : null,
        comparisonKey: 'dashboard.kpi.vsYesterday',
        sparkline: activeJobsSeries,
        color: 'gray',
      },
    ];
  }

  private dailyRevenueSeries(invoices: any[], days: number): number[] {
    const buckets: number[] = new Array(days).fill(0);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    invoices.forEach(inv => {
      if (inv.status !== 'paid') return;
      const d = new Date(inv.issueDate || inv.createdAt || inv.date);
      if (isNaN(d.getTime())) return;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.floor((startOfToday.getTime() - dayStart.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < days) {
        const idx = days - 1 - diffDays;
        buckets[idx] += inv.paidAmount || inv.totalAmount || inv.total || 0;
      }
    });
    return buckets;
  }

  private dailyAppointmentSeries(appointments: any[], days: number): number[] {
    const buckets: number[] = new Array(days).fill(0);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    appointments.forEach(a => {
      const d = new Date(a.scheduledDate);
      if (isNaN(d.getTime())) return;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.floor((startOfToday.getTime() - dayStart.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < days) {
        buckets[days - 1 - diffDays]++;
      }
    });
    return buckets;
  }

  private dailyActiveJobsSeries(jobs: any[], days: number): number[] {
    // End-of-day snapshot: a job counts on day i if it had started by the end
    // of that day AND was not yet completed by the end of that day. Currently
    // active jobs (no completedAt, status in activeStatuses) are treated as
    // open-ended; jobs with neither completedAt nor an active status have an
    // unknown end time and are skipped.
    const activeStatuses = new Set(['in-progress', 'quality-check', 'waiting-parts', 'waiting-approval']);
    const buckets: number[] = new Array(days).fill(0);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startOfToday.getTime() - (days - 1 - i) * 86400000);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      buckets[i] = jobs.filter(j => {
        const startSrc = j.startDate || j.createdAt;
        if (!startSrc) return false;
        const start = new Date(startSrc);
        if (isNaN(start.getTime())) return false;
        if (start.getTime() > dayEnd.getTime()) return false;

        let endTime: number;
        if (j.completedAt) {
          const c = new Date(j.completedAt);
          if (isNaN(c.getTime())) return false;
          endTime = c.getTime();
        } else if (activeStatuses.has(j.status)) {
          endTime = Number.POSITIVE_INFINITY;
        } else {
          return false;
        }
        return endTime > dayEnd.getTime();
      }).length;
    }
    return buckets;
  }

  private percentDelta(curr: number, prev: number): number | null {
    if (!isFinite(curr) || !isFinite(prev)) return null;
    if (prev === 0) return curr === 0 ? 0 : null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  }

  private absoluteDelta(curr: number, prev: number): number | null {
    if (!isFinite(curr) || !isFinite(prev)) return null;
    return curr - prev;
  }

  private formatSignedPercent(value: number, locale: string): string {
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    const abs = Math.abs(Math.round(value));
    return `${sign}${new Intl.NumberFormat(locale).format(abs)}%`;
  }

  private formatSignedNumber(value: number, locale: string): string {
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    const abs = Math.abs(Math.round(value));
    return `${sign}${new Intl.NumberFormat(locale).format(abs)}`;
  }

  private formatNumber(value: number, locale: string): string {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(value));
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  buildSparklinePath(values: number[], width = 100, height = 36, padding = 2): { line: string; area: string } {
    const empty = { line: '', area: '' };
    if (!values || values.length < 2) return empty;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const innerH = height - padding * 2;
    const stepX = width / (values.length - 1);
    const pts: [number, number][] = values.map((v, i) => [
      i * stepX,
      padding + innerH - ((v - min) / range) * innerH,
    ]);

    let line = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      line += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }
    const area = `${line} L${width.toFixed(2)},${height} L0,${height} Z`;
    return { line, area };
  }

  private updateAsOfTime(): void {
    const lang = this.languageService.getCurrentLanguage();
    const locale = lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-FR' : 'en-US';
    this.asOfTime = new Date().toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
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
        this.cachedMaintenanceJobs = maintenanceJobs;
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

        // Glance cards
        this.updateAsOfTime();
        this.rebuildGlanceCards();

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
    const days = this.revenueRange();
    const locale = this.numberLocale();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const totals: number[] = new Array(days).fill(0);
    invoices.forEach(inv => {
      const d = new Date(inv.issueDate || inv.createdAt || inv.date);
      if (isNaN(d.getTime())) return;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.floor((startOfToday.getTime() - dayStart.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < days) {
        totals[days - 1 - diffDays] += inv.totalAmount || inv.total || 0;
      }
    });

    const labels: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(startOfToday.getTime() - i * 86400000);
      labels.push(d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }));
    }

    this.revenueChartData = {
      labels,
      datasets: [{
        data: totals,
        label: this.translationService.instant('dashboard.kpi.revenue'),
        fill: true,
        tension: 0.45,
        cubicInterpolationMode: 'monotone',
        borderColor: '#FF8400',
        borderWidth: 2.5,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return 'rgba(255, 132, 0, 0.18)';
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(255, 132, 0, 0.32)');
          gradient.addColorStop(1, 'rgba(255, 132, 0, 0.04)');
          return gradient;
        },
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: '#FF8400',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: '#FF8400',
        pointHoverBorderColor: '#ffffff',
      }],
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
