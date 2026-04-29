import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { TranslationService } from '../../core/services/translation.service';
import { LanguageService } from '../../core/services/language.service';
import { AuthService } from '../../core/services/auth.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { AppointmentService } from '../appointments/services/appointment.service';
import { CustomerService } from '../../core/services/customer.service';
import { EmployeeService } from '../../core/services/employee.service';
import { PartService } from '../../core/services/part.service';
import { InvoiceService } from '../../core/services/invoice.service';
import { MaintenanceService } from '../../core/services/maintenance.service';

/**
 * Tests for DashboardComponent. We do NOT call fixture.detectChanges() so the
 * (very heavy) template — with ng2-charts, FullCalendar children, etc. — is
 * never rendered. We exercise component methods directly. Where ngOnInit-like
 * behavior is needed, we call `component.ngOnInit()` explicitly.
 */
describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  let mockRouter: jasmine.SpyObj<Router>;
  let mockTranslation: jasmine.SpyObj<TranslationService>;
  let mockLanguage: jasmine.SpyObj<LanguageService>;
  let mockAuth: jasmine.SpyObj<AuthService>;
  let mockOnboarding: jasmine.SpyObj<OnboardingService>;
  let mockAppointment: jasmine.SpyObj<AppointmentService>;
  let mockCustomer: jasmine.SpyObj<CustomerService>;
  let mockEmployee: jasmine.SpyObj<EmployeeService>;
  let mockPart: jasmine.SpyObj<PartService>;
  let mockInvoice: jasmine.SpyObj<InvoiceService>;
  let mockMaintenance: jasmine.SpyObj<MaintenanceService>;
  let currentLanguage$: BehaviorSubject<'en' | 'fr' | 'ar'>;
  let translations$: BehaviorSubject<Record<string, unknown>>;

  beforeEach(async () => {
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    translations$ = new BehaviorSubject<Record<string, unknown>>({});
    mockTranslation = jasmine.createSpyObj('TranslationService', ['instant'], {
      translations$: translations$.asObservable(),
    });
    // Default — return the key. Specific tests will override the .and.returnValue(...) for specific keys.
    mockTranslation.instant.and.callFake((key: string) => key);

    currentLanguage$ = new BehaviorSubject<'en' | 'fr' | 'ar'>('en');
    mockLanguage = jasmine.createSpyObj('LanguageService', ['getCurrentLanguage'], {
      currentLanguage$: currentLanguage$.asObservable(),
    });
    mockLanguage.getCurrentLanguage.and.returnValue('en');

    mockAuth = jasmine.createSpyObj('AuthService', ['isOwner']);
    mockAuth.isOwner.and.returnValue(true);

    mockOnboarding = jasmine.createSpyObj('OnboardingService', ['startTourForCurrentUser']);

    mockAppointment = jasmine.createSpyObj('AppointmentService', ['getAppointments', 'getCars']);
    mockAppointment.getAppointments.and.returnValue(of([]));
    mockAppointment.getCars.and.returnValue(of([]));

    mockCustomer = jasmine.createSpyObj('CustomerService', ['getCustomers']);
    mockCustomer.getCustomers.and.returnValue(of([]));

    mockEmployee = jasmine.createSpyObj('EmployeeService', ['getEmployees']);
    mockEmployee.getEmployees.and.returnValue(of([]));

    mockPart = jasmine.createSpyObj('PartService', ['getParts']);
    mockPart.getParts.and.returnValue(of([]));

    mockInvoice = jasmine.createSpyObj('InvoiceService', ['getInvoices']);
    mockInvoice.getInvoices.and.returnValue(of([]));

    mockMaintenance = jasmine.createSpyObj('MaintenanceService', ['getMaintenanceJobs']);
    mockMaintenance.getMaintenanceJobs.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: TranslationService, useValue: mockTranslation },
        { provide: LanguageService, useValue: mockLanguage },
        { provide: AuthService, useValue: mockAuth },
        { provide: OnboardingService, useValue: mockOnboarding },
        { provide: AppointmentService, useValue: mockAppointment },
        { provide: CustomerService, useValue: mockCustomer },
        { provide: EmployeeService, useValue: mockEmployee },
        { provide: PartService, useValue: mockPart },
        { provide: InvoiceService, useValue: mockInvoice },
        { provide: MaintenanceService, useValue: mockMaintenance },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    component?.ngOnDestroy?.();
  });

  // ---------------------------------------------------------------
  // Creation
  // ---------------------------------------------------------------
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------
  // getCurrentDate(): localized via LanguageService
  // ---------------------------------------------------------------
  describe('getCurrentDate()', () => {
    it('returns an English long date when language is en', () => {
      mockLanguage.getCurrentLanguage.and.returnValue('en');
      const out = component.getCurrentDate();
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
      // "long" weekday + "long" month + numeric year/day. We can't assert the
      // current date but we CAN assert it's not the French/Arabic shape.
      expect(out).toMatch(/[A-Za-z]/);
    });

    it('returns a French long date with a French month name when language is fr', () => {
      mockLanguage.getCurrentLanguage.and.returnValue('fr');
      const out = component.getCurrentDate();
      // French month names — at least one must appear regardless of when the
      // test runs, since we can't pin the system date.
      const frenchMonths = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
      ];
      const matched = frenchMonths.some((m) => out.toLowerCase().includes(m));
      expect(matched).toBe(true, `expected a French month name in "${out}"`);
    });

    it('returns an Arabic long date with Arabic characters when language is ar', () => {
      mockLanguage.getCurrentLanguage.and.returnValue('ar');
      const out = component.getCurrentDate();
      // Arabic Unicode block U+0600–U+06FF.
      expect(out).toMatch(/[؀-ۿ]/);
    });
  });

  // ---------------------------------------------------------------
  // navigation methods
  // ---------------------------------------------------------------
  describe('navigation methods', () => {
    it('navigateToNewCar() routes to /cars with action=add', () => {
      component.navigateToNewCar();
      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/cars'],
        { queryParams: { action: 'add' } }
      );
    });

    it('navigateToAppointments() routes to /calendar', () => {
      component.navigateToAppointments();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/calendar']);
    });

    it('navigateToInvoicing() routes to /invoices/create', () => {
      component.navigateToInvoicing();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/invoices/create']);
    });

    it('navigateToQualityCheck() routes to /maintenance/active', () => {
      component.navigateToQualityCheck();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/maintenance/active']);
    });

    it('onTimelineItemClick() routes to /calendar with appointmentId', () => {
      component.onTimelineItemClick({
        id: 'a1',
        time: '09:00',
        customerName: 'Ali',
        carModel: 'Peugeot 308',
        licensePlate: '123-TUN',
        serviceType: 'Oil change',
        status: 'scheduled',
        estimatedDuration: 1,
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/calendar'],
        { queryParams: { appointmentId: 'a1' } }
      );
    });

    it('onJobCardClick() routes to /maintenance/details/:id', () => {
      component.onJobCardClick({
        id: 'j1',
        customerName: 'Ali',
        carModel: 'Peugeot 308',
        licensePlate: '123-TUN',
        services: ['Oil change'],
        startedAt: '09:00',
        estimatedCompletion: '11:00',
        mechanic: 'Sami',
        progress: 40,
        status: 'in_progress',
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/maintenance/details', 'j1']);
    });
  });

  // ---------------------------------------------------------------
  // buildRevenueChart — exercised via loadDashboardData (private)
  // Daily aggregation over a selectable range (default: 30 days).
  // ---------------------------------------------------------------
  describe('revenue chart (daily aggregation)', () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    it('defaults to 30 daily buckets ending today', () => {
      mockInvoice.getInvoices.and.returnValue(of([]));
      component.ngOnInit();

      expect(component.revenueRange()).toBe(30);
      const labels = component.revenueChartData.labels as string[];
      expect(labels.length).toBe(30);

      const expected: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(startOfToday.getTime() - i * 86400000);
        expected.push(d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }));
      }
      expect(labels).toEqual(expected);
    });

    it('with NO invoices, all 30 data points are 0', () => {
      mockInvoice.getInvoices.and.returnValue(of([]));
      component.ngOnInit();

      const data = component.revenueChartData.datasets[0].data as number[];
      expect(data.length).toBe(30);
      expect(data.every((v) => v === 0)).toBe(true);
    });

    it('places invoice totals in the correct daily slot', () => {
      const today = new Date(startOfToday);
      const fiveDaysAgo = new Date(startOfToday.getTime() - 5 * 86400000);

      mockInvoice.getInvoices.and.returnValue(of([
        { issueDate: today.toISOString(), totalAmount: 100 } as any,
        { issueDate: today.toISOString(), totalAmount: 50 } as any,
        { issueDate: fiveDaysAgo.toISOString(), totalAmount: 200 } as any,
      ]));

      component.ngOnInit();

      const data = component.revenueChartData.datasets[0].data as number[];
      expect(data[29]).toBe(150);
      expect(data[24]).toBe(200);
      data.forEach((v, idx) => {
        if (idx !== 29 && idx !== 24) expect(v).toBe(0);
      });
    });

    it('ignores invoices with unparseable dates without crashing', () => {
      mockInvoice.getInvoices.and.returnValue(of([
        { issueDate: 'not a date', totalAmount: 999 } as any,
      ]));

      expect(() => component.ngOnInit()).not.toThrow();
      const data = component.revenueChartData.datasets[0].data as number[];
      expect(data.every((v) => v === 0)).toBe(true);
    });

    it('uses French day-month labels when language is fr', () => {
      mockLanguage.getCurrentLanguage.and.returnValue('fr');
      mockInvoice.getInvoices.and.returnValue(of([]));

      component.ngOnInit();

      const labels = component.revenueChartData.labels as string[];
      expect(labels.length).toBe(30);
      const expected: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(startOfToday.getTime() - i * 86400000);
        expected.push(d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
      }
      expect(labels).toEqual(expected);
    });

    it('setRevenueRange(7) rebuilds chart with 7 daily buckets', () => {
      mockInvoice.getInvoices.and.returnValue(of([]));
      component.ngOnInit();

      component.setRevenueRange(7);

      expect(component.revenueRange()).toBe(7);
      const labels = component.revenueChartData.labels as string[];
      expect(labels.length).toBe(7);
      const data = component.revenueChartData.datasets[0].data as number[];
      expect(data.length).toBe(7);
    });

    it('setRevenueRange(90) rebuilds chart with 90 daily buckets', () => {
      mockInvoice.getInvoices.and.returnValue(of([]));
      component.ngOnInit();

      component.setRevenueRange(90);

      expect(component.revenueRange()).toBe(90);
      expect((component.revenueChartData.labels as string[]).length).toBe(90);
      expect((component.revenueChartData.datasets[0].data as number[]).length).toBe(90);
    });

    it('setRevenueRange is a no-op when range matches current value', () => {
      mockInvoice.getInvoices.and.returnValue(of([]));
      component.ngOnInit();

      const prevData = component.revenueChartData;
      component.setRevenueRange(30);
      expect(component.revenueChartData).toBe(prevData);
    });

    it('revenueRangeSubtitleParams reflects current range', () => {
      mockInvoice.getInvoices.and.returnValue(of([]));
      component.ngOnInit();

      expect(component.revenueRangeSubtitleParams()).toEqual({ days: 30 });
      component.setRevenueRange(7);
      expect(component.revenueRangeSubtitleParams()).toEqual({ days: 7 });
    });
  });

  // ---------------------------------------------------------------
  // Glance cards — structure + rebuild on language change
  // ---------------------------------------------------------------
  describe('glance cards', () => {
    const seedAppointment = () => {
      const today = new Date();
      mockAppointment.getAppointments.and.returnValue(of([
        {
          id: 'a1',
          scheduledDate: today.toISOString(),
          customerId: 'c1',
          carId: 'car1',
          serviceName: 'Oil change',
          status: 'scheduled',
          estimatedDuration: 60,
          mechanicId: 'm1',
        } as any,
      ]));
    };

    it('builds 4 glance cards (revenue, appointments, utilization, active jobs) after data load', () => {
      seedAppointment();
      component.ngOnInit();

      expect(component.glanceCards.length).toBe(4);
      const labels = component.glanceCards.map((c) => c.labelKey);
      expect(labels).toEqual([
        'dashboard.kpi.revenueToday',
        'dashboard.kpi.appointmentsToday',
        'dashboard.kpi.bayUtilization',
        'dashboard.kpi.activeJobs',
      ]);
    });

    it('utilization card carries a detail delta with occupied/total params', () => {
      seedAppointment();
      component.ngOnInit();

      const utilization = component.glanceCards.find((c) => c.labelKey === 'dashboard.kpi.bayUtilization');
      expect(utilization?.delta?.kind).toBe('detail');
      if (utilization?.delta?.kind === 'detail') {
        expect(utilization.delta.params).toEqual(jasmine.objectContaining({ total: 8 }));
      }
    });

    it('rebuilds glance cards when TranslationService.translations$ emits', () => {
      seedAppointment();
      component.ngOnInit();

      const beforeRef = component.glanceCards;
      translations$.next({ dashboard: { kpi: { vsLastWeek: 'vs sem.' } } });
      expect(component.glanceCards).not.toBe(beforeRef);
    });

    it('does NOT rebuild after ngOnDestroy unsubscribes', () => {
      seedAppointment();
      component.ngOnInit();
      const cardsRef = component.glanceCards;

      component.ngOnDestroy();
      translations$.next({ dashboard: { kpi: { vsLastWeek: 'CHANGED' } } });

      expect(component.glanceCards).toBe(cardsRef);
    });
  });

  // ---------------------------------------------------------------
  // Sparkline path generator
  // ---------------------------------------------------------------
  describe('buildSparklinePath()', () => {
    it('returns empty paths for fewer than 2 points', () => {
      expect(component.buildSparklinePath([])).toEqual({ line: '', area: '' });
      expect(component.buildSparklinePath([5])).toEqual({ line: '', area: '' });
    });

    it('returns a Move + Cubic line and a closed area path for valid input', () => {
      const out = component.buildSparklinePath([1, 2, 3, 4]);
      expect(out.line).toMatch(/^M[\d.,\- ]+/);
      expect(out.line).toContain('C');
      expect(out.area.endsWith('Z')).toBeTrue();
      expect(out.area).toContain(out.line);
    });
  });

  // ---------------------------------------------------------------
  // Helpers — quick sanity checks
  // ---------------------------------------------------------------
  describe('helper methods', () => {
    it('getCapacityPercentage returns 0 when totalSlots is 0', () => {
      component.metrics.totalSlots = 0;
      expect(component.getCapacityPercentage()).toBe(0);
    });

    it('getCapacityPercentage handles fully-occupied bays', () => {
      component.metrics.totalSlots = 8;
      component.metrics.availableSlots = 0;
      expect(component.getCapacityPercentage()).toBe(100);
    });

    it('getProgressBarClass thresholds', () => {
      expect(component.getProgressBarClass(10)).toBe('bg-error-500');
      expect(component.getProgressBarClass(50)).toBe('bg-warning-500');
      expect(component.getProgressBarClass(80)).toBe('bg-success-500');
    });

    it('getStatusBadgeClass falls back to badge-pending for unknown status', () => {
      expect(component.getStatusBadgeClass('mystery-status')).toBe('badge badge-pending');
    });

    it('getStatusBadgeClass maps known underscored statuses', () => {
      expect(component.getStatusBadgeClass('in_progress')).toBe('badge badge-active');
      expect(component.getStatusBadgeClass('waiting_parts')).toBe('badge badge-pending');
    });
  });

  // ---------------------------------------------------------------
  // setMechanicPeriod / setJobTypePeriod — signal flips + rebuilds
  // ---------------------------------------------------------------
  describe('setMechanicPeriod()', () => {
    it('flips the signal and rebuilds with subtitleKey for "day"', () => {
      (component as any).cachedEmployees = [];
      component.cachedMaintenanceJobs = [];

      component.setMechanicPeriod('day');

      expect(component.mechanicPeriod()).toBe('day');
      expect(component.mechanicVM().subtitleKey).toBe('dashboard.mechanicPerformance.subtitle.day');
    });

    it('flips the signal and rebuilds with subtitleKey for "month"', () => {
      (component as any).cachedEmployees = [];
      component.cachedMaintenanceJobs = [];

      component.setMechanicPeriod('month');

      expect(component.mechanicPeriod()).toBe('month');
      expect(component.mechanicVM().subtitleKey).toBe('dashboard.mechanicPerformance.subtitle.month');
    });

    it('is a no-op when period matches current value', () => {
      (component as any).cachedEmployees = [];
      component.cachedMaintenanceJobs = [];
      component.setMechanicPeriod('week'); // same as default
      const vmRef = component.mechanicVM();

      component.setMechanicPeriod('week');

      expect(component.mechanicVM()).toBe(vmRef);
    });
  });

  describe('setJobTypePeriod()', () => {
    it('flips the signal and rebuilds with subtitleKey for "7d"', () => {
      (component as any).cachedAppointments = [];

      component.setJobTypePeriod('7d');

      expect(component.jobTypePeriod()).toBe('7d');
      expect(component.jobTypeVM().subtitleKey).toBe('dashboard.jobTypes.subtitle.7d');
    });

    it('flips the signal and rebuilds with subtitleKey for "30d"', () => {
      (component as any).cachedAppointments = [];

      component.setJobTypePeriod('30d');

      expect(component.jobTypePeriod()).toBe('30d');
      expect(component.jobTypeVM().subtitleKey).toBe('dashboard.jobTypes.subtitle.30d');
    });

    it('is a no-op when period matches current value', () => {
      (component as any).cachedAppointments = [];
      const vmRef = component.jobTypeVM();

      component.setJobTypePeriod('all');

      expect(component.jobTypeVM()).toBe(vmRef);
    });
  });

  // ---------------------------------------------------------------
  // buildMechanicPerformance() — integration of seeded employees + jobs
  // ---------------------------------------------------------------
  describe('buildMechanicPerformance()', () => {
    const seedTwoMechanics = () => {
      (component as any).cachedEmployees = [
        {
          id: 'm1',
          personalInfo: { fullName: 'Sami Ben Ali', firstName: 'Sami', lastName: 'Ben Ali' },
          employment: { role: 'mechanic', department: 'workshop' },
          performance: { customerRating: 4.8 },
        },
        {
          id: 'm2',
          personalInfo: { fullName: 'Karim Nasri', firstName: 'Karim', lastName: 'Nasri' },
          employment: { role: 'mechanic', department: 'workshop' },
          performance: { customerRating: 4.2 },
        },
      ];
    };

    // Helper: build a date inside the current "week" window (last 7 days).
    const dateWithinWeek = (daysAgo: number): string => {
      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12, 0, 0);
      return d.toISOString();
    };

    // Helper: build a date inside the previous week window.
    const dateInPrevWeek = (daysAgo: number): string => {
      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12, 0, 0);
      return d.toISOString();
    };

    it('builds rows sorted by jobs desc with proportional jobsBarPct', () => {
      seedTwoMechanics();
      // m1 = 3 completed jobs in week, m2 = 1 completed job in week.
      component.cachedMaintenanceJobs = [
        { id: 'j1', mechanicId: 'm1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 120 },
        { id: 'j2', mechanicId: 'm1', status: 'completed', completionDate: dateWithinWeek(2), actualDuration: 60 },
        { id: 'j3', mechanicId: 'm1', status: 'completed', completionDate: dateWithinWeek(3), actualDuration: 60 },
        { id: 'j4', mechanicId: 'm2', status: 'completed', completionDate: dateWithinWeek(0), actualDuration: 90 },
      ];

      (component as any).buildMechanicPerformance();

      const vm = component.mechanicVM();
      expect(vm.rows.length).toBe(2);
      expect(vm.rows[0].id).toBe('m1');
      expect(vm.rows[0].jobs).toBe(3);
      expect(vm.rows[1].id).toBe('m2');
      expect(vm.rows[1].jobs).toBe(1);
      // m1 = max => 100, m2 = round(1/3 * 100) = 33
      expect(vm.rows[0].jobsBarPct).toBe(100);
      expect(vm.rows[1].jobsBarPct).toBe(33);
    });

    it('computes hours from actualDuration (minutes) and utilization vs (workdays * 8h)', () => {
      seedTwoMechanics();
      // m1 only — 240 min completed in week => 4 hours. workdays(week) = round(7*6/7) = 6 => available = 48h.
      // utilization = round(4/48 * 100) = 8
      component.cachedMaintenanceJobs = [
        { id: 'j1', mechanicId: 'm1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 240 },
      ];

      (component as any).buildMechanicPerformance();

      const vm = component.mechanicVM();
      const m1 = vm.rows.find(r => r.id === 'm1');
      expect(m1?.hours).toBe(4);
      expect(m1?.utilization).toBe(8);
    });

    it('caps utilization at 100 when hours exceed available', () => {
      seedTwoMechanics();
      // 100h logged in week => clearly over the 48h cap.
      component.cachedMaintenanceJobs = [
        { id: 'j1', mechanicId: 'm1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 100 * 60 },
      ];

      (component as any).buildMechanicPerformance();

      const m1 = component.mechanicVM().rows.find(r => r.id === 'm1');
      expect(m1?.utilization).toBe(100);
    });

    it('falls back to estimatedDuration when actualDuration is missing', () => {
      seedTwoMechanics();
      component.cachedMaintenanceJobs = [
        { id: 'j1', mechanicId: 'm1', status: 'completed', completionDate: dateWithinWeek(1), estimatedDuration: 180 },
      ];

      (component as any).buildMechanicPerformance();

      const m1 = component.mechanicVM().rows.find(r => r.id === 'm1');
      expect(m1?.hours).toBe(3);
    });

    it('trend is current period count minus previous period count', () => {
      seedTwoMechanics();
      // m1: 2 in current week (1 + 2 days ago), 1 in previous week (10 days ago) => trend 1
      // m2: 0 current, 0 previous (1 in current week => trend = 1 - 0 = 1)
      component.cachedMaintenanceJobs = [
        { id: 'j1', mechanicId: 'm1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 60 },
        { id: 'j2', mechanicId: 'm1', status: 'completed', completionDate: dateWithinWeek(2), actualDuration: 60 },
        { id: 'j3', mechanicId: 'm1', status: 'completed', completionDate: dateInPrevWeek(10), actualDuration: 60 },
        { id: 'j4', mechanicId: 'm2', status: 'completed', completionDate: dateWithinWeek(0), actualDuration: 60 },
      ];

      (component as any).buildMechanicPerformance();

      const vm = component.mechanicVM();
      const m1 = vm.rows.find(r => r.id === 'm1');
      const m2 = vm.rows.find(r => r.id === 'm2');
      expect(m1?.trend).toBe(1);
      expect(m2?.trend).toBe(1);
    });

    it('excludes mechanics with zero jobs and zero hours', () => {
      seedTwoMechanics();
      // Only m1 has activity.
      component.cachedMaintenanceJobs = [
        { id: 'j1', mechanicId: 'm1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 60 },
      ];

      (component as any).buildMechanicPerformance();

      const vm = component.mechanicVM();
      expect(vm.rows.length).toBe(1);
      expect(vm.rows[0].id).toBe('m1');
    });

    it('ignores jobs whose completionDate falls outside the window', () => {
      seedTwoMechanics();
      // Both jobs are 60 days ago — well outside week, week-prev, and even month windows.
      component.cachedMaintenanceJobs = [
        { id: 'j1', mechanicId: 'm1', status: 'completed', completionDate: dateInPrevWeek(60), actualDuration: 60 },
      ];

      (component as any).buildMechanicPerformance();

      expect(component.mechanicVM().rows.length).toBe(0);
    });

    it('ignores jobs that are not completed', () => {
      seedTwoMechanics();
      component.cachedMaintenanceJobs = [
        { id: 'j1', mechanicId: 'm1', status: 'in-progress', completionDate: dateWithinWeek(1), actualDuration: 60 },
      ];

      (component as any).buildMechanicPerformance();

      expect(component.mechanicVM().rows.length).toBe(0);
    });

    it('aggregates totals (totalJobs, totalHours, avgUtilization) and sets subtitleKey', () => {
      seedTwoMechanics();
      // m1: 2 jobs, 120 minutes => 2h, util = round(2/48*100)=4
      // m2: 1 job, 60 minutes => 1h, util = round(1/48*100)=2
      component.cachedMaintenanceJobs = [
        { id: 'j1', mechanicId: 'm1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 60 },
        { id: 'j2', mechanicId: 'm1', status: 'completed', completionDate: dateWithinWeek(2), actualDuration: 60 },
        { id: 'j3', mechanicId: 'm2', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 60 },
      ];

      (component as any).buildMechanicPerformance();

      const vm = component.mechanicVM();
      expect(vm.totalJobs).toBe(3);
      expect(vm.totalHours).toBe(3);
      // round((4 + 2) / 2) = 3
      expect(vm.avgUtilization).toBe(3);
      expect(vm.subtitleKey).toBe('dashboard.mechanicPerformance.subtitle.week');
    });

    it('preserves the customerRating from performance on each row', () => {
      seedTwoMechanics();
      component.cachedMaintenanceJobs = [
        { id: 'j1', mechanicId: 'm1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 60 },
        { id: 'j2', mechanicId: 'm2', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 60 },
      ];

      (component as any).buildMechanicPerformance();

      const vm = component.mechanicVM();
      const m1 = vm.rows.find(r => r.id === 'm1');
      const m2 = vm.rows.find(r => r.id === 'm2');
      expect(m1?.rating).toBe(4.8);
      expect(m2?.rating).toBe(4.2);
    });

    it('excludes admin/manager/receptionist/service-advisor and management dept', () => {
      (component as any).cachedEmployees = [
        { id: 'mech1', personalInfo: { fullName: 'A B' }, employment: { role: 'mechanic', department: 'workshop' }, performance: { customerRating: 4 } },
        { id: 'recep1', personalInfo: { fullName: 'C D' }, employment: { role: 'receptionist', department: 'frontdesk' }, performance: { customerRating: 4 } },
        { id: 'admin1', personalInfo: { fullName: 'E F' }, employment: { role: 'admin', department: 'office' }, performance: { customerRating: 4 } },
        { id: 'mgr1', personalInfo: { fullName: 'G H' }, employment: { role: 'manager', department: 'management' }, performance: { customerRating: 4 } },
        { id: 'svc1', personalInfo: { fullName: 'I J' }, employment: { role: 'service-advisor', department: 'workshop' }, performance: { customerRating: 4 } },
        { id: 'tech1', personalInfo: { fullName: 'K L' }, employment: { role: 'technician', department: 'management' }, performance: { customerRating: 4 } },
      ];
      component.cachedMaintenanceJobs = [
        { id: 'j1', mechanicId: 'mech1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 60 },
        { id: 'j2', mechanicId: 'recep1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 60 },
        { id: 'j3', mechanicId: 'admin1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 60 },
        { id: 'j4', mechanicId: 'mgr1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 60 },
        { id: 'j5', mechanicId: 'svc1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 60 },
        { id: 'j6', mechanicId: 'tech1', status: 'completed', completionDate: dateWithinWeek(1), actualDuration: 60 },
      ];

      (component as any).buildMechanicPerformance();

      const vm = component.mechanicVM();
      const ids = vm.rows.map(r => r.id).sort();
      expect(ids).toEqual(['mech1']);
    });
  });

  // ---------------------------------------------------------------
  // buildJobTypeDistribution() — grouping, sorting, top-6 + Other
  // ---------------------------------------------------------------
  describe('buildJobTypeDistribution()', () => {
    // Helper: keep dates safely inside any of 7d/30d/all windows.
    const recentDate = (daysAgo = 1): string => {
      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12, 0, 0);
      return d.toISOString();
    };

    it('groups by serviceType with counts and percentages summing close to 100', () => {
      (component as any).cachedAppointments = [
        { id: 'a1', serviceType: 'oil-change', scheduledDate: recentDate(0) },
        { id: 'a2', serviceType: 'oil-change', scheduledDate: recentDate(1) },
        { id: 'a3', serviceType: 'oil-change', scheduledDate: recentDate(1) },
        { id: 'a4', serviceType: 'brakes', scheduledDate: recentDate(2) },
      ];

      (component as any).buildJobTypeDistribution();

      const vm = component.jobTypeVM();
      expect(vm.totalJobs).toBe(4);
      const sum = vm.slices.reduce((s, sl) => s + sl.percent, 0);
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(2);
    });

    it('sorts slices by count descending and reports topLabel + topPercent', () => {
      (component as any).cachedAppointments = [
        { id: 'a1', serviceType: 'oil-change', scheduledDate: recentDate(0) },
        { id: 'a2', serviceType: 'oil-change', scheduledDate: recentDate(1) },
        { id: 'a3', serviceType: 'oil-change', scheduledDate: recentDate(2) },
        { id: 'a4', serviceType: 'brakes', scheduledDate: recentDate(2) },
      ];

      (component as any).buildJobTypeDistribution();

      const vm = component.jobTypeVM();
      // First slice should be the dominant category (oil-change, 3 of 4 = 75%).
      expect(vm.slices[0].count).toBe(3);
      expect(vm.slices[1].count).toBe(1);
      expect(vm.topLabel).toBe(vm.slices[0].label);
      expect(vm.topPercent).toBe(75);
    });

    it('rolls everything beyond top 6 into an "Other" bucket', () => {
      // 7 distinct categories; the 7th gets folded into "Other".
      const types = ['oil', 'brakes', 'tires', 'battery', 'belt', 'filter', 'wiper'];
      (component as any).cachedAppointments = types.flatMap((t, i) =>
        // give each type a unique count (i+1) so sorting order is deterministic.
        Array.from({ length: i + 1 }, (_, k) => ({
          id: `${t}-${k}`,
          serviceType: t,
          scheduledDate: recentDate(1),
        }))
      );

      (component as any).buildJobTypeDistribution();

      const vm = component.jobTypeVM();
      expect(vm.slices.length).toBe(7); // 6 top + 1 Other
      const lastSlice = vm.slices[vm.slices.length - 1];
      expect(lastSlice.key).toBe('other');
      // The smallest type (oil = count 1) gets rolled into Other.
      expect(lastSlice.count).toBe(1);
    });

    it('does NOT add an Other slice when total categories <= 6', () => {
      const types = ['oil', 'brakes', 'tires'];
      (component as any).cachedAppointments = types.map((t, i) => ({
        id: `${t}-${i}`,
        serviceType: t,
        scheduledDate: recentDate(1),
      }));

      (component as any).buildJobTypeDistribution();

      const vm = component.jobTypeVM();
      expect(vm.slices.length).toBe(3);
      expect(vm.slices.find(s => s.key === 'other')).toBeUndefined();
    });

    it('sets subtitleKey + subtitleParams for the active period', () => {
      (component as any).cachedAppointments = [
        { id: 'a1', serviceType: 'oil-change', scheduledDate: recentDate(0) },
        { id: 'a2', serviceType: 'brakes', scheduledDate: recentDate(0) },
      ];

      (component as any).buildJobTypeDistribution();

      const vm = component.jobTypeVM();
      expect(vm.subtitleKey).toBe('dashboard.jobTypes.subtitle.all');
      expect(vm.subtitleParams).toEqual({ jobs: 2 });
    });

    it('handles empty appointment lists gracefully', () => {
      (component as any).cachedAppointments = [];

      (component as any).buildJobTypeDistribution();

      const vm = component.jobTypeVM();
      expect(vm.slices).toEqual([]);
      expect(vm.totalJobs).toBe(0);
      expect(vm.topLabel).toBe('');
      expect(vm.topPercent).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // formatRatingDisplay / formatTrendDisplay — locale-aware helpers
  // ---------------------------------------------------------------
  describe('formatRatingDisplay()', () => {
    it('returns em-dash for 0', () => {
      expect(component.formatRatingDisplay(0)).toBe('—');
    });

    it('returns one-decimal formatted rating for non-zero (en or fr)', () => {
      mockLanguage.getCurrentLanguage.and.returnValue('en');
      const en = component.formatRatingDisplay(4.9);
      expect(['4.9', '4,9']).toContain(en);

      mockLanguage.getCurrentLanguage.and.returnValue('fr');
      const fr = component.formatRatingDisplay(4.9);
      expect(['4.9', '4,9']).toContain(fr);
    });
  });

  describe('formatTrendDisplay()', () => {
    it('returns em-dash for 0', () => {
      expect(component.formatTrendDisplay(0)).toBe('—');
    });

    it('returns absolute formatted value for positive numbers', () => {
      mockLanguage.getCurrentLanguage.and.returnValue('en');
      expect(component.formatTrendDisplay(3)).toBe('3');
    });

    it('returns absolute formatted value for negative numbers', () => {
      mockLanguage.getCurrentLanguage.and.returnValue('en');
      // The sign is rendered separately by the template; the helper only
      // formats the magnitude.
      expect(component.formatTrendDisplay(-5)).toBe('5');
    });
  });
});
