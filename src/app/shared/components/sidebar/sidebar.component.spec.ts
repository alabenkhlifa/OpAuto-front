import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router, NavigationEnd } from '@angular/router';
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';

import { SidebarComponent } from './sidebar.component';
import { SidebarService } from '../../../core/services/sidebar.service';
import { TranslationService } from '../../../core/services/translation.service';
import { AuthService } from '../../../core/services/auth.service';
import { ModuleService } from '../../../core/services/module.service';
import { NotificationService } from '../../../core/services/notification.service';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  let mockSidebarService: any;
  let mockTranslation: jasmine.SpyObj<TranslationService>;
  let mockAuth: jasmine.SpyObj<AuthService>;
  let mockModule: jasmine.SpyObj<ModuleService>;
  let mockNotification: any;
  let mockRouter: jasmine.SpyObj<Router>;
  let routerEvents$: Subject<any>;

  beforeEach(async () => {
    mockSidebarService = {
      isCollapsed: signal(false),
      isMobileMenuOpen: signal(false),
      toggleSidebar: jasmine.createSpy('toggleSidebar'),
      toggleMobileMenu: jasmine.createSpy('toggleMobileMenu'),
      closeMobileMenu: jasmine.createSpy('closeMobileMenu'),
    };

    mockTranslation = jasmine.createSpyObj('TranslationService', ['instant'], {
      translations$: of({}),
    });
    mockTranslation.instant.and.callFake((k: string) => k);

    mockAuth = jasmine.createSpyObj('AuthService', ['isOwner']);
    mockAuth.isOwner.and.returnValue(true);

    mockModule = jasmine.createSpyObj('ModuleService', ['hasModuleAccess']);
    mockModule.hasModuleAccess.and.returnValue(true);

    mockNotification = {
      unreadCount: signal(0),
    };

    routerEvents$ = new Subject<any>();
    mockRouter = jasmine.createSpyObj('Router', ['navigate'], {
      events: routerEvents$.asObservable(),
      url: '/dashboard',
    });

    await TestBed.configureTestingModule({
      imports: [SidebarComponent, HttpClientTestingModule],
      providers: [
        { provide: SidebarService, useValue: mockSidebarService },
        { provide: TranslationService, useValue: mockTranslation },
        { provide: AuthService, useValue: mockAuth },
        { provide: ModuleService, useValue: mockModule },
        { provide: NotificationService, useValue: mockNotification },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
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
  // onNavItemClick: parent items with children toggle isExpanded.
  // The HTML binds [attr.aria-expanded]="item.children ? !!item.isExpanded : null".
  // ---------------------------------------------------------------
  describe('onNavItemClick — parent items with children toggle isExpanded and update aria-expanded', () => {
    it('toggles isExpanded from false → true on first click', () => {
      const maintenance = component.navItems.find((n) => n.id === 'maintenance')!;
      expect(maintenance).toBeTruthy();
      expect(!!maintenance.isExpanded).toBe(false);

      const event = new MouseEvent('click');
      spyOn(event, 'stopPropagation');
      component.onNavItemClick(maintenance, event);

      expect(maintenance.isExpanded).toBe(true);
      expect(event.stopPropagation).toHaveBeenCalled();
      // navigate should NOT be called for parent items.
      expect(mockRouter.navigate).not.toHaveBeenCalledWith(['/maintenance']);
    });

    it('toggles isExpanded from true → false on second click', () => {
      const maintenance = component.navItems.find((n) => n.id === 'maintenance')!;
      maintenance.isExpanded = true;

      component.onNavItemClick(maintenance, new MouseEvent('click'));
      expect(maintenance.isExpanded).toBe(false);
    });

    it('renders the parent button with [attr.aria-expanded] reflecting the new state', () => {
      fixture.detectChanges();

      const maintenance = component.navItems.find((n) => n.id === 'maintenance')!;
      expect(!!maintenance.isExpanded).toBe(false);

      // Click the parent button: locate it by data-tour attribute on the <li>.
      const findParentButton = (id: string): HTMLButtonElement | null => {
        const li = fixture.nativeElement.querySelector(`li[data-tour="${id}"]`);
        return li ? li.querySelector('button.nav-link') as HTMLButtonElement : null;
      };

      const btn = findParentButton('maintenance');
      expect(btn).toBeTruthy();
      // Initial aria-expanded for a parent with children should be "false" (not null/absent).
      expect(btn!.getAttribute('aria-expanded')).toBe('false');

      // Click toggles isExpanded.
      btn!.click();
      fixture.detectChanges();

      expect(maintenance.isExpanded).toBe(true);
      expect(btn!.getAttribute('aria-expanded')).toBe('true');

      // Click again toggles back.
      btn!.click();
      fixture.detectChanges();

      expect(maintenance.isExpanded).toBe(false);
      expect(btn!.getAttribute('aria-expanded')).toBe('false');
    });

    it('leaf items (no children) do NOT render an aria-expanded attribute', () => {
      fixture.detectChanges();

      // "dashboard" has no children — its button's aria-expanded should be absent (null binding).
      const li = fixture.nativeElement.querySelector('li[data-tour="dashboard"]');
      const btn = li?.querySelector('button.nav-link') as HTMLButtonElement | null;
      expect(btn).toBeTruthy();
      expect(btn!.hasAttribute('aria-expanded')).toBe(false);
    });

    it('leaf items navigate to their route instead of toggling', () => {
      const cars = component.navItems.find((n) => n.id === 'cars')!;
      expect(cars.children).toBeUndefined();

      component.onNavItemClick(cars, new MouseEvent('click'));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/cars']);
      // closeMobileMenu fires via navigateTo
      expect(mockSidebarService.closeMobileMenu).toHaveBeenCalled();
    });

    it('locked-module items navigate to /modules and do NOT toggle children', () => {
      mockModule.hasModuleAccess.and.callFake((id: any) => id !== 'maintenance');
      const maintenance = component.navItems.find((n) => n.id === 'maintenance')!;
      const before = !!maintenance.isExpanded;

      component.onNavItemClick(maintenance, new MouseEvent('click'));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/modules']);
      // Since the module is locked, isExpanded must NOT have flipped.
      expect(!!maintenance.isExpanded).toBe(before);
    });
  });

  // ---------------------------------------------------------------
  // Badge counter for "Pending Payment" sidebar item.
  //
  // Bug history: the sidebar previously counted PENDING + OVERDUE,
  // which mismatched the destination /invoices/pending page (whose
  // "Pending" tab counts SENT/VIEWED only — OVERDUE has its own tab).
  // The badge MUST equal exactly the number the user sees on the page.
  // ---------------------------------------------------------------
  describe('invoices-pending badge counter', () => {
    function flushAllPendingHttp(httpMock: HttpTestingController) {
      // The component fires multiple GETs (/appointments, /maintenance,
      // /invoices, /quotes, /approvals). We only care about /invoices for
      // this assertion but must drain the others so the test exits cleanly.
      const drain = (url: string, body: any[]) => {
        const reqs = httpMock.match(url);
        reqs.forEach((r) => r.flush(body));
      };
      drain('/appointments', []);
      drain('/maintenance', []);
      drain('/quotes', []);
      drain('/approvals', []);
    }

    it('counts only SENT/VIEWED invoices (not OVERDUE, not PAID)', () => {
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges(); // triggers ngOnInit -> loadBadgeCounts

      const invoiceReq = httpMock.expectOne('/invoices');
      expect(invoiceReq.request.method).toBe('GET');

      // Mix mirroring real-world data: 3 SENT, 1 VIEWED (=4 pending),
      // 5 OVERDUE (must be EXCLUDED), 2 PAID, 1 DRAFT, 1 CANCELLED.
      invoiceReq.flush([
        { id: '1', status: 'SENT' },
        { id: '2', status: 'SENT' },
        { id: '3', status: 'SENT' },
        { id: '4', status: 'VIEWED' },
        { id: '5', status: 'OVERDUE' },
        { id: '6', status: 'OVERDUE' },
        { id: '7', status: 'OVERDUE' },
        { id: '8', status: 'OVERDUE' },
        { id: '9', status: 'OVERDUE' },
        { id: '10', status: 'PAID' },
        { id: '11', status: 'PAID' },
        { id: '12', status: 'DRAFT' },
        { id: '13', status: 'CANCELLED' },
      ]);

      flushAllPendingHttp(httpMock);

      // SENT(3) + VIEWED(1) = 4. NOT 9 (which would include OVERDUE).
      expect(component.getBadge('invoices-pending')).toBe(4);
      httpMock.verify();
    });

    it('returns null badge when there are zero SENT/VIEWED invoices, even with OVERDUE present', () => {
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();

      const invoiceReq = httpMock.expectOne('/invoices');
      invoiceReq.flush([
        { id: '1', status: 'OVERDUE' },
        { id: '2', status: 'OVERDUE' },
        { id: '3', status: 'PAID' },
      ]);

      flushAllPendingHttp(httpMock);

      // getBadge returns null for zero counts (so the badge isn't rendered).
      expect(component.getBadge('invoices-pending')).toBeNull();
      httpMock.verify();
    });

    it('does not load invoice badge for non-owners', () => {
      mockAuth.isOwner.and.returnValue(false);
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();

      // Owner-only endpoints must not be hit.
      httpMock.expectNone('/invoices');
      httpMock.expectNone('/approvals');

      // Non-owner endpoints still drain.
      httpMock.match('/appointments').forEach((r) => r.flush([]));
      httpMock.match('/maintenance').forEach((r) => r.flush([]));

      expect(component.getBadge('invoices-pending')).toBeNull();
      httpMock.verify();
    });
  });
});
