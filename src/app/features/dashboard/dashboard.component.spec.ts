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
  // We call ngOnInit and inspect the chart data afterward.
  // ---------------------------------------------------------------
  describe('revenue chart (last 12 months chronologically)', () => {
    const now = new Date();
    const ymKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const expected12MonthKeys = (): string[] => {
      const keys: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(ymKey(d));
      }
      return keys;
    };

    it('renders 12 chronological labels ending with the current month', () => {
      mockInvoice.getInvoices.and.returnValue(of([]));
      component.ngOnInit();

      const labels = component.revenueChartData.labels as string[];
      expect(labels.length).toBe(12);

      // Build the expected localized labels and compare positionally.
      const expectedLabels: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        expectedLabels.push(
          d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        );
      }
      expect(labels).toEqual(expectedLabels);
      // Last label = current month (oldest left → newest right).
      expect(labels[11]).toBe(expectedLabels[11]);
    });

    it('with NO invoices, all 12 data points are 0 (no "No data" placeholder)', () => {
      mockInvoice.getInvoices.and.returnValue(of([]));
      component.ngOnInit();

      const datasets = component.revenueChartData.datasets;
      expect(datasets.length).toBe(1);
      const data = datasets[0].data as number[];
      expect(data.length).toBe(12);
      expect(data.every((v) => v === 0)).toBe(true);

      const labels = component.revenueChartData.labels as string[];
      expect(labels.includes('No data')).toBe(false);
    });

    it('aggregates invoices by YYYY-MM and places totals in the correct slot', () => {
      // Pick an invoice that lands in the current month and one in 2 months ago.
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 15);
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 10);

      mockInvoice.getInvoices.and.returnValue(of([
        { issueDate: currentMonth.toISOString(), totalAmount: 100 } as any,
        { issueDate: currentMonth.toISOString(), totalAmount: 50 } as any,
        { issueDate: twoMonthsAgo.toISOString(), totalAmount: 200 } as any,
      ]));

      component.ngOnInit();

      const data = component.revenueChartData.datasets[0].data as number[];
      // Newest is at index 11 (current month) → 100 + 50 = 150
      expect(data[11]).toBe(150);
      // Two months ago → index 9 (since 11 = current, 10 = last month, 9 = two months ago)
      expect(data[9]).toBe(200);
      // All other slots should be 0.
      data.forEach((v, idx) => {
        if (idx !== 11 && idx !== 9) expect(v).toBe(0);
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

    it('uses French month labels when language is fr', () => {
      mockLanguage.getCurrentLanguage.and.returnValue('fr');
      mockInvoice.getInvoices.and.returnValue(of([]));

      component.ngOnInit();

      const labels = component.revenueChartData.labels as string[];
      expect(labels.length).toBe(12);
      // Build expected with the same locale used in the component.
      const expected: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        expected.push(d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }));
      }
      expect(labels).toEqual(expected);
    });
  });

  // ---------------------------------------------------------------
  // KPI rebuild on language change
  // ---------------------------------------------------------------
  describe('language change rebuilds localized views', () => {
    it('rebuilds kpiCards when TranslationService.translations$ emits — appointments KPI uses new translation', () => {
      // Seed cached state by running ngOnInit with one appointment so
      // rebuildLocalizedViews short-circuit (which checks cachedAppointments
      // length) doesn't bail.
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

      // First emission → "today"
      mockTranslation.instant.and.callFake((k: string) =>
        k === 'dashboard.kpi.today' ? 'today' : k
      );

      component.ngOnInit();

      const beforeCards = component.kpiCards;
      const apptCardBefore = beforeCards.find((c) => c.icon === 'appointments');
      expect(apptCardBefore).toBeTruthy();
      expect(apptCardBefore!.value).toContain('today');

      // Now flip the translation map and emit new translations (simulating
      // the new language file finishing its HTTP load).
      mockTranslation.instant.and.callFake((k: string) =>
        k === 'dashboard.kpi.today' ? "aujourd'hui" : k
      );
      translations$.next({ dashboard: { kpi: { today: "aujourd'hui" } } });

      const apptCardAfter = component.kpiCards.find((c) => c.icon === 'appointments');
      expect(apptCardAfter).toBeTruthy();
      expect(apptCardAfter!.value).toContain("aujourd'hui");
      expect(apptCardAfter!.value).not.toContain('today');
    });

    it('does NOT rebuild after ngOnDestroy unsubscribes', () => {
      // Seed so rebuildLocalizedViews would normally fire.
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

      mockTranslation.instant.and.callFake((k: string) =>
        k === 'dashboard.kpi.today' ? 'today' : k
      );

      component.ngOnInit();
      const cardsRef = component.kpiCards;

      component.ngOnDestroy();

      // Change translation + emit a new language. Subscription is gone, so
      // kpiCards should NOT change.
      mockTranslation.instant.and.callFake((k: string) =>
        k === 'dashboard.kpi.today' ? 'CHANGED' : k
      );
      translations$.next({ dashboard: { kpi: { today: 'CHANGED' } } });

      // Reference equality is the strongest signal that no rebuild happened.
      expect(component.kpiCards).toBe(cardsRef);
      const apptCard = component.kpiCards.find((c) => c.icon === 'appointments');
      expect(apptCard!.value).not.toContain('CHANGED');
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
});
