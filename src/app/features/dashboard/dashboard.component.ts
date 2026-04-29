import { Component, OnInit, OnDestroy, DestroyRef, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { forkJoin, of, Subscription, interval } from 'rxjs';

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
  year?: number;
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

type MechanicPeriod = 'day' | 'week' | 'month';
type JobTypePeriod = '7d' | '30d' | 'all';

interface MechanicRow {
  id: string;
  initials: string;
  fullName: string;
  rating: number;
  hours: number;
  jobs: number;
  jobsBarPct: number;
  utilization: number;
  trend: number;
  color: string;
}

interface MechanicPerformanceVM {
  rows: MechanicRow[];
  totalJobs: number;
  totalHours: number;
  avgUtilization: number;
  subtitleKey: string;
}

interface JobTypeSlice {
  key: string;
  label: string;
  count: number;
  percent: number;
  color: string;
}

interface JobTypeDistributionVM {
  slices: JobTypeSlice[];
  totalJobs: number;
  topLabel: string;
  topPercent: number;
  subtitleKey: string;
  subtitleParams: { jobs: number };
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
  private destroyRef = inject(DestroyRef);

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

  // Mechanic Performance
  mechanicPeriod = signal<MechanicPeriod>('week');
  mechanicVM = signal<MechanicPerformanceVM>({ rows: [], totalJobs: 0, totalHours: 0, avgUtilization: 0, subtitleKey: 'dashboard.mechanicPerformance.subtitle.week' });

  // Job Type Distribution
  jobTypePeriod = signal<JobTypePeriod>('all');
  jobTypeVM = signal<JobTypeDistributionVM>({ slices: [], totalJobs: 0, topLabel: '', topPercent: 0, subtitleKey: 'dashboard.jobTypes.subtitle.all', subtitleParams: { jobs: 0 } });

  private readonly mechanicColors = ['#FF8400', '#3b5bdb', '#16a34a', '#a855f7', '#0ea5e9', '#f59e0b', '#ec4899', '#6b7280'];
  private readonly jobTypeColors = ['#FF8400', '#3b5bdb', '#16a34a', '#a855f7', '#f59e0b', '#0ea5e9', '#9ca3af'];

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

    // NOTE: This is a wall-clock tick, not a data-freshness indicator. The
    // underlying dashboard data is loaded once in ngOnInit and is NOT
    // re-fetched on this interval. If/when a real refresh mechanism is
    // added, move this call inside the data-load callback instead.
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateAsOfTime());
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
    this.buildJobTypeDistribution();
    this.buildMechanicPerformance();
  }

  setRevenueRange(days: 7 | 30 | 90): void {
    if (this.revenueRange() === days) return;
    this.revenueRange.set(days);
    this.buildRevenueChart(this.cachedInvoices);
  }

  setMechanicPeriod(p: MechanicPeriod): void {
    if (this.mechanicPeriod() === p) return;
    this.mechanicPeriod.set(p);
    this.buildMechanicPerformance();
  }

  setJobTypePeriod(p: JobTypePeriod): void {
    if (this.jobTypePeriod() === p) return;
    this.jobTypePeriod.set(p);
    this.buildJobTypeDistribution();
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

  formatDuration(minutes: number): string {
    if (!minutes || minutes < 0) return '';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  parsePlate(plate: string | null | undefined): { left: string; right: string } {
    if (!plate) return { left: '', right: '' };
    const groups = plate.match(/\d+/g) ?? [];
    if (groups.length >= 2) {
      return { left: groups[0]!, right: groups[groups.length - 1]! };
    }
    if (groups.length === 1) {
      const d = groups[0]!;
      if (d.length > 4) return { left: d.slice(0, -4), right: d.slice(-4) };
      return { left: '', right: d };
    }
    return { left: '', right: plate };
  }

  getRemainingAppointmentsCount(): number {
    const closed = new Set(['completed', 'cancelled', 'no_show', 'delayed']);
    return this.todayAppointments.filter(a => !closed.has(a.status)).length;
  }

  getScheduleRowVariant(status: string): string {
    const map: Record<string, string> = {
      'completed': 'is-completed',
      'in_progress': 'is-in-progress', 'in-progress': 'is-in-progress',
      'scheduled': 'is-scheduled', 'confirmed': 'is-scheduled', 'pending': 'is-scheduled',
      'no_show': 'is-no-show', 'no-show': 'is-no-show',
      'cancelled': 'is-cancelled', 'delayed': 'is-cancelled'
    };
    return map[status] || 'is-scheduled';
  }

  getJobStatusVariant(status: string): string {
    const map: Record<string, string> = {
      'completed': 'is-completed', 'quality_check': 'is-completed', 'quality-check': 'is-completed',
      'in_progress': 'is-in-progress', 'in-progress': 'is-in-progress',
      'in_repair': 'is-in-progress', 'in-repair': 'is-in-progress',
      'diagnosis': 'is-in-progress',
      'waiting_parts': 'is-pending', 'waiting-parts': 'is-pending',
      'waiting_approval': 'is-pending', 'waiting-approval': 'is-pending',
      'scheduled': 'is-scheduled', 'confirmed': 'is-scheduled', 'pending': 'is-scheduled',
      'cancelled': 'is-cancelled', 'delayed': 'is-cancelled'
    };
    return map[status] || 'is-in-progress';
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
            year: car?.year,
            licensePlate: car?.licensePlate || '',
            serviceType: a.serviceName,
            status: a.status.replace(/-/g, '_'),
            estimatedDuration: a.estimatedDuration,
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

        // Job type distribution — group appointments by serviceType, period-filtered
        this.buildJobTypeDistribution();

        // Mechanic performance — per-mechanic jobs/hours/utilization, period-filtered
        this.buildMechanicPerformance();
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

  private mechanicPeriodWindow(p: MechanicPeriod): { start: Date; end: Date; prevStart: Date; prevEnd: Date; workdays: number } {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date;
    if (p === 'day') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (p === 'week') {
      // Last 7 days, including today
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    } else {
      // Last 30 days, including today
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    }
    const lengthMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - lengthMs);
    const days = p === 'day' ? 1 : p === 'week' ? 7 : 30;
    // Workdays: Mon–Sat (6 days/week). For day=1 if today is Sunday => 0 else 1.
    const workdays = p === 'day'
      ? (now.getDay() === 0 ? 0 : 1)
      : Math.round(days * 6 / 7);
    return { start, end, prevStart, prevEnd, workdays };
  }

  private jobTypePeriodWindow(p: JobTypePeriod): { start: Date; end: Date; days: number } {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date;
    let days: number;
    if (p === '7d') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      days = 7;
    } else if (p === '30d') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      days = 30;
    } else {
      // All: include every appointment we have, so anchor start at the epoch
      start = new Date(0);
      days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    }
    return { start, end, days };
  }

  private buildMechanicPerformance(): void {
    const period = this.mechanicPeriod();
    const { start, end, prevStart, prevEnd, workdays } = this.mechanicPeriodWindow(period);
    const completedStatuses = new Set(['completed', 'COMPLETED']);
    const dailyHours = 8;

    const inWindow = (d: Date | undefined, s: Date, e: Date) =>
      !!d && !isNaN(d.getTime()) && d.getTime() >= s.getTime() && d.getTime() <= e.getTime();

    const employees = this.cachedEmployees.filter(e => {
      const role = e.employment?.role || '';
      const dept = e.employment?.department || '';
      return role && role !== 'receptionist' && role !== 'service-advisor' && role !== 'admin' && role !== 'manager' && dept !== 'management';
    });

    const rows: MechanicRow[] = employees.map((emp, idx) => {
      const empJobs = this.cachedMaintenanceJobs.filter(j => j.mechanicId === emp.id);
      const currJobs = empJobs.filter(j => completedStatuses.has(j.status) && inWindow(j.completionDate ? new Date(j.completionDate) : undefined, start, end));
      const prevJobs = empJobs.filter(j => completedStatuses.has(j.status) && inWindow(j.completionDate ? new Date(j.completionDate) : undefined, prevStart, prevEnd));

      const hours = currJobs.reduce((sum, j) => {
        const minutes = j.actualDuration ?? j.estimatedDuration ?? 0;
        return sum + minutes / 60;
      }, 0);

      const availableHours = workdays * dailyHours;
      const utilization = availableHours > 0 ? Math.min(100, Math.round((hours / availableHours) * 100)) : 0;

      const initials = this.computeInitials(emp.personalInfo?.firstName, emp.personalInfo?.lastName, emp.personalInfo?.fullName);

      return {
        id: emp.id,
        initials,
        fullName: emp.personalInfo?.fullName || initials,
        rating: emp.performance?.customerRating || 0,
        hours,
        jobs: currJobs.length,
        jobsBarPct: 0,
        utilization,
        trend: currJobs.length - prevJobs.length,
        color: this.mechanicColors[idx % this.mechanicColors.length],
      };
    }).filter(r => r.jobs > 0 || r.hours > 0);

    rows.sort((a, b) => b.jobs - a.jobs || b.hours - a.hours);

    const maxJobs = rows.reduce((m, r) => Math.max(m, r.jobs), 0);
    rows.forEach(r => { r.jobsBarPct = maxJobs > 0 ? Math.round((r.jobs / maxJobs) * 100) : 0; });

    const totalJobs = rows.reduce((s, r) => s + r.jobs, 0);
    const totalHours = rows.reduce((s, r) => s + r.hours, 0);
    const avgUtilization = rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.utilization, 0) / rows.length)
      : 0;

    this.mechanicVM.set({
      rows,
      totalJobs,
      totalHours,
      avgUtilization,
      subtitleKey: `dashboard.mechanicPerformance.subtitle.${period}`,
    });
  }

  private computeInitials(first?: string, last?: string, full?: string): string {
    if (first && last) return (first[0] + last[0]).toUpperCase();
    if (full) {
      const parts = full.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return parts[0]?.slice(0, 2).toUpperCase() || '??';
    }
    return '??';
  }

  private buildJobTypeDistribution(): void {
    const period = this.jobTypePeriod();
    const { start, end } = this.jobTypePeriodWindow(period);

    const inWindow = this.cachedAppointments.filter(a => {
      const d = new Date(a.scheduledDate);
      return !isNaN(d.getTime()) && d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
    });

    const counts: Record<string, { count: number; label: string }> = {};
    inWindow.forEach(a => {
      const raw: string = (a.serviceType || a.serviceName || 'other').toString();
      const key = raw.toLowerCase().trim();
      const labelKey = `dashboard.jobTypes.categories.${key}`;
      const translated = this.translationService.instant(labelKey);
      const label = translated && translated !== labelKey
        ? translated
        : (a.serviceName || raw.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
      if (!counts[key]) counts[key] = { count: 0, label };
      counts[key].count++;
    });

    const totalJobs = Object.values(counts).reduce((s, v) => s + v.count, 0);
    const sorted = Object.entries(counts)
      .map(([key, v]) => ({ key, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count);

    // Cap to top 6, group rest as "Other"
    const TOP_N = 6;
    let slices: JobTypeSlice[] = [];
    if (sorted.length > TOP_N) {
      const top = sorted.slice(0, TOP_N);
      const rest = sorted.slice(TOP_N).reduce((s, v) => s + v.count, 0);
      const otherLabel = this.translationService.instant('dashboard.jobTypes.other');
      slices = top.map((t, i) => ({
        key: t.key,
        label: t.label,
        count: t.count,
        percent: totalJobs > 0 ? Math.round((t.count / totalJobs) * 100) : 0,
        color: this.jobTypeColors[i % this.jobTypeColors.length],
      }));
      if (rest > 0) {
        slices.push({
          key: 'other',
          label: otherLabel === 'dashboard.jobTypes.other' ? 'Other' : otherLabel,
          count: rest,
          percent: totalJobs > 0 ? Math.round((rest / totalJobs) * 100) : 0,
          color: this.jobTypeColors[this.jobTypeColors.length - 1],
        });
      }
    } else {
      slices = sorted.map((t, i) => ({
        key: t.key,
        label: t.label,
        count: t.count,
        percent: totalJobs > 0 ? Math.round((t.count / totalJobs) * 100) : 0,
        color: this.jobTypeColors[i % this.jobTypeColors.length],
      }));
    }

    const top = slices[0];
    this.jobTypeVM.set({
      slices,
      totalJobs,
      topLabel: top?.label || '',
      topPercent: top?.percent || 0,
      subtitleKey: `dashboard.jobTypes.subtitle.${period}`,
      subtitleParams: { jobs: totalJobs },
    });
  }

  formatHoursDisplay(hours: number): string {
    return new Intl.NumberFormat(this.numberLocale(), { maximumFractionDigits: 0 }).format(Math.round(hours));
  }

  formatRatingDisplay(rating: number): string {
    if (!rating) return '—';
    return new Intl.NumberFormat(this.numberLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating);
  }

  formatTrendDisplay(trend: number): string {
    if (trend === 0) return '—';
    const abs = Math.abs(trend);
    return new Intl.NumberFormat(this.numberLocale(), { maximumFractionDigits: 0 }).format(abs);
  }
}
