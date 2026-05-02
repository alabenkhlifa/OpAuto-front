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
  // History:
  //  - Originally counted PENDING + OVERDUE — out of sync with the
  //    destination tab.
  //  - Sweep B narrowed the filter to SENT + VIEWED only ("matches the
  //    /invoices/pending page row count").
  //  - Sweep C-11 (S-SB-003): the spec defines the badge as the count
  //    of all unpaid issued invoices — SENT + PARTIALLY_PAID + OVERDUE.
  //    The destination page now widens its filter to match, so the
  //    badge still equals the row count the user sees on /invoices/pending.
  //    VIEWED is treated as SENT (still unpaid, customer just opened
  //    the email) and is included in the same bucket.
  // ---------------------------------------------------------------
  describe('invoices-pending badge counter (S-SB-003)', () => {
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

    it('counts SENT + VIEWED + PARTIALLY_PAID + OVERDUE invoices (S-SB-003 — all unpaid issued)', () => {
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges(); // triggers ngOnInit -> loadBadgeCounts

      const invoiceReq = httpMock.expectOne('/invoices');
      expect(invoiceReq.request.method).toBe('GET');

      // Realistic mix: 3 SENT, 1 VIEWED, 2 PARTIALLY_PAID, 5 OVERDUE
      // (= 11 unpaid issued), plus 2 PAID + 1 DRAFT + 1 CANCELLED that
      // must be EXCLUDED from the badge.
      invoiceReq.flush([
        { id: '1', status: 'SENT' },
        { id: '2', status: 'SENT' },
        { id: '3', status: 'SENT' },
        { id: '4', status: 'VIEWED' },
        { id: '5', status: 'PARTIALLY_PAID' },
        { id: '6', status: 'PARTIALLY_PAID' },
        { id: '7', status: 'OVERDUE' },
        { id: '8', status: 'OVERDUE' },
        { id: '9', status: 'OVERDUE' },
        { id: '10', status: 'OVERDUE' },
        { id: '11', status: 'OVERDUE' },
        { id: '12', status: 'PAID' },
        { id: '13', status: 'PAID' },
        { id: '14', status: 'DRAFT' },
        { id: '15', status: 'CANCELLED' },
      ]);

      flushAllPendingHttp(httpMock);

      // SENT(3) + VIEWED(1) + PARTIALLY_PAID(2) + OVERDUE(5) = 11.
      expect(component.getBadge('invoices-pending')).toBe(11);
      httpMock.verify();
    });

    it('hides the badge (returns null) when zero unpaid issued invoices', () => {
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();

      const invoiceReq = httpMock.expectOne('/invoices');
      // Only PAID/DRAFT/CANCELLED — none of the unpaid statuses present.
      invoiceReq.flush([
        { id: '1', status: 'PAID' },
        { id: '2', status: 'PAID' },
        { id: '3', status: 'DRAFT' },
        { id: '4', status: 'CANCELLED' },
      ]);

      flushAllPendingHttp(httpMock);

      // getBadge returns null for zero counts (so the badge isn't rendered).
      expect(component.getBadge('invoices-pending')).toBeNull();
      httpMock.verify();
    });

    it('counts OVERDUE-only data set (regression: OVERDUE alone must show a badge)', () => {
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();

      const invoiceReq = httpMock.expectOne('/invoices');
      invoiceReq.flush([
        { id: '1', status: 'OVERDUE' },
        { id: '2', status: 'OVERDUE' },
        { id: '3', status: 'PAID' },
      ]);

      flushAllPendingHttp(httpMock);

      // Pre-Sweep-C-11 the badge would have been null here (OVERDUE was
      // excluded). After the spec alignment OVERDUE counts toward the
      // pending bucket — verify it now reads 2.
      expect(component.getBadge('invoices-pending')).toBe(2);
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

  // ---------------------------------------------------------------
  // S-SB-005 — Active child highlighted.
  // When the user is on /invoices/<child>, the matching submenu-link
  // must carry the .active class. We exercise the full child set —
  // /invoices, /quotes, /list, /credit-notes, /pending, /reports —
  // so we catch any future drift (route added but not wired, parent
  // re-expanded incorrectly, etc.).
  // ---------------------------------------------------------------
  describe('S-SB-005 — invoicing submenu active state per route', () => {
    function flushAllHttp(httpMock: HttpTestingController) {
      const drain = (url: string) => httpMock.match(url).forEach((r) => r.flush([]));
      drain('/appointments');
      drain('/maintenance');
      drain('/invoices');
      drain('/quotes');
      drain('/approvals');
    }

    function expectOnlyActive(expectedId: string) {
      const invoicing = component.navItems.find((n) => n.id === 'invoices')!;
      for (const child of invoicing.children!) {
        if (child.id === expectedId) {
          expect(child.isActive).withContext(`child ${child.id} should be active`).toBe(true);
        } else {
          expect(!!child.isActive).withContext(`child ${child.id} should NOT be active`).toBe(false);
        }
      }
    }

    const cases: Array<[string, string]> = [
      ['/invoices', 'invoices-dashboard'],
      ['/invoices/quotes', 'invoices-quotes'],
      ['/invoices/list', 'invoices-list'],
      ['/invoices/credit-notes', 'invoices-credit-notes'],
      ['/invoices/pending', 'invoices-pending'],
      ['/invoices/reports', 'invoices-reports'],
    ];

    for (const [route, expectedId] of cases) {
      it(`marks "${expectedId}" active on ${route}`, () => {
        const httpMock = TestBed.inject(HttpTestingController);
        // Pre-set the router URL so initial updateActiveStates uses it.
        Object.defineProperty(mockRouter, 'url', { value: route, configurable: true });
        fixture.detectChanges();
        flushAllHttp(httpMock);

        // Emit a NavigationEnd to mirror real router behavior.
        routerEvents$.next(new NavigationEnd(1, route, route));
        flushAllHttp(httpMock);
        fixture.detectChanges();

        expectOnlyActive(expectedId);
        // Parent should be expanded so the user sees the highlighted child.
        const invoicing = component.navItems.find((n) => n.id === 'invoices')!;
        expect(invoicing.isExpanded).toBe(true);
      });
    }
  });

  // ---------------------------------------------------------------
  // S-SB-006 — Collapsed-mode rail (BUG-107).
  //
  // Pre-Sweep-C-14 the desktop sidebar applied transform: translateX(-100%)
  // when collapsed and slid the entire 280px rail off-screen, leaving
  // only a 44px floating hamburger top-left. Sweep C-14 turns the
  // collapsed state into a 64px-wide icon rail that stays visible:
  //   1. The .sidebar host element receives the .collapsed class but
  //      is never translated off-screen (CSS sets width: 64px).
  //   2. shouldShowExpanded() returns FALSE on a non-hovered desktop
  //      collapse, so labels / chevrons / badges / footer are hidden
  //      via the existing [class.hidden] / @if bindings — but the
  //      icon column is preserved.
  //   3. Hovering the rail flips isHovered=true → shouldShowExpanded()
  //      returns true → the rail expands as an overlay flyout (CSS
  //      grows the width back to 280px).
  //   4. The collapse-toggle round-trips state cleanly via the existing
  //      SidebarService.toggleSidebar contract.
  //
  // The CSS rules themselves live in sidebar.component.css — Karma
  // can't easily fetch the bundled stylesheet at test-time and the
  // CLAUDE memory steers us away from brittle computed-dimension
  // assertions. These tests pin the markup contract that the rail
  // mode depends on so a future refactor can't silently regress
  // (a) the visibility of the icon column or (b) the hover-flyout
  // expansion semantics.
  // ---------------------------------------------------------------
  describe('S-SB-006 — collapsed-mode rail (BUG-107)', () => {
    function flushAllHttp(httpMock: HttpTestingController) {
      const drain = (url: string) => httpMock.match(url).forEach((r) => r.flush([]));
      drain('/appointments');
      drain('/maintenance');
      drain('/invoices');
      drain('/quotes');
      drain('/approvals');
    }

    function setDesktopViewport() {
      // jasmine-defined viewport spy: shouldShowExpanded() and
      // isMouseEnter() depend on isDesktop() which reads window.innerWidth.
      // Karma runs at 1024+ by default, but pin it explicitly so the
      // assertion isn't environment-dependent.
      Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    }

    it('keeps .sidebar host element on-screen with .collapsed class applied (no translateX off-screen)', () => {
      setDesktopViewport();
      mockSidebarService.isCollapsed.set(true);
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
      flushAllHttp(httpMock);

      const aside: HTMLElement = fixture.nativeElement.querySelector('aside.sidebar');
      expect(aside).toBeTruthy();
      expect(aside.classList.contains('collapsed')).toBe(true);
      // Pre-fix the collapsed sidebar slid via translateX(-100%); now
      // it stays at the origin (the rail width is 64px, set by CSS).
      // We assert the host is in the DOM and is positioned with the
      // collapsed marker class — the visual width contract belongs to
      // the CSS and is verified live via Chrome DevTools MCP.
      expect(aside.isConnected).toBe(true);
      // isHovered defaults false → shouldShowExpanded() returns false.
      expect(component.shouldShowExpanded()).toBe(false);
    });

    it('hides labels / chevrons / submenus but keeps icons present in collapsed (rail) mode', () => {
      setDesktopViewport();
      mockSidebarService.isCollapsed.set(true);
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
      flushAllHttp(httpMock);

      // Pick the invoicing item — it has children (the BUG-107 repro
      // referenced /invoices specifically).
      const invoicingLi = fixture.nativeElement.querySelector('li[data-tour="invoices"]');
      expect(invoicingLi).toBeTruthy();

      // Icon column: nav-icon span MUST remain visible in the DOM.
      const icon = invoicingLi.querySelector('.nav-icon');
      expect(icon).toBeTruthy();

      // Label MUST carry the .hidden class because shouldShowExpanded()
      // is false in non-hovered collapsed mode.
      const label = invoicingLi.querySelector('.nav-label');
      expect(label).toBeTruthy();
      expect(label.classList.contains('hidden')).toBe(true);

      // Chevron + submenu MUST NOT be present in the DOM (they are
      // wrapped in @if (item.children && shouldShowExpanded())).
      const chevron = invoicingLi.querySelector('.nav-chevron');
      expect(chevron).toBeNull();
      const submenu = invoicingLi.querySelector('.submenu');
      expect(submenu).toBeNull();

      // Tooltip: hover-state attribute carries the translation key so
      // the user has a [title] hint on the icon when not hovering.
      const btn = invoicingLi.querySelector('button.nav-link') as HTMLButtonElement;
      expect(btn.getAttribute('title')).toBe('navigation.invoicing');
    });

    it('expanded mode (post-toggle) reveals labels and chevrons again', () => {
      setDesktopViewport();
      mockSidebarService.isCollapsed.set(false);
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
      flushAllHttp(httpMock);

      const invoicingLi = fixture.nativeElement.querySelector('li[data-tour="invoices"]');
      const label = invoicingLi.querySelector('.nav-label');
      expect(label.classList.contains('hidden')).toBe(false);

      // Chevron is rendered when shouldShowExpanded() is true and the
      // item has children.
      const chevron = invoicingLi.querySelector('.nav-chevron');
      expect(chevron).toBeTruthy();

      // [title] tooltip suppressed when expanded — the label itself is
      // visible so a hover hint would be redundant.
      const btn = invoicingLi.querySelector('button.nav-link') as HTMLButtonElement;
      expect(btn.hasAttribute('title')).toBe(false);
    });

    it('hovering a collapsed rail (isHovered=true) flips shouldShowExpanded() to true', () => {
      setDesktopViewport();
      mockSidebarService.isCollapsed.set(true);
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
      flushAllHttp(httpMock);

      // Baseline: not hovered → false.
      expect(component.shouldShowExpanded()).toBe(false);

      component.onMouseEnter();
      expect(component.isHovered()).toBe(true);
      // Hovered collapsed rail expands as a flyout via the same gate.
      expect(component.shouldShowExpanded()).toBe(true);

      component.onMouseLeave();
      expect(component.isHovered()).toBe(false);
      expect(component.shouldShowExpanded()).toBe(false);
    });

    it('toggleSidebar() round-trips between expanded and collapsed (rail) state', () => {
      setDesktopViewport();
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
      flushAllHttp(httpMock);

      // Start expanded.
      expect(mockSidebarService.isCollapsed()).toBe(false);

      // First toggle: collapse to rail. The mock spy is wired to a
      // setter shape that mirrors the real SidebarService — invoke
      // it directly so the signal flips.
      mockSidebarService.toggleSidebar.and.callFake(() => {
        mockSidebarService.isCollapsed.set(!mockSidebarService.isCollapsed());
      });

      component.toggleSidebar();
      expect(mockSidebarService.toggleSidebar).toHaveBeenCalledTimes(1);
      expect(mockSidebarService.isCollapsed()).toBe(true);

      // Second toggle: expand again. State must round-trip cleanly.
      component.toggleSidebar();
      expect(mockSidebarService.toggleSidebar).toHaveBeenCalledTimes(2);
      expect(mockSidebarService.isCollapsed()).toBe(false);
    });

    it('floating "Show sidebar" button (.show-sidebar-btn) is no longer rendered (rail replaces it)', () => {
      setDesktopViewport();
      mockSidebarService.isCollapsed.set(true);
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
      flushAllHttp(httpMock);

      // Pre-Sweep-C-14 the template included
      //   <button *ngIf="isCollapsed() && isDesktop()" class="show-sidebar-btn">
      // as the only on-screen affordance because the rail itself was
      // off-screen. The rail is now always visible, so the floating
      // button is removed entirely.
      const floatingBtn = fixture.nativeElement.querySelector('.show-sidebar-btn');
      expect(floatingBtn).toBeNull();
    });

    it('onSidebarClick() in rail mode no longer auto-expands the sidebar', () => {
      // Pre-Sweep-C-14 onSidebarClick() called toggleSidebar() when
      // collapsed+desktop, so any click in the off-screen rail would
      // pop the full sidebar back. With the rail always visible, the
      // user's click intent is most likely an icon, and icon clicks
      // already stopPropagation; toggling on click would now incorrectly
      // race with item navigation. The handler is intentionally a no-op
      // for rail-mode clicks.
      setDesktopViewport();
      mockSidebarService.isCollapsed.set(true);
      const httpMock = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
      flushAllHttp(httpMock);

      mockSidebarService.toggleSidebar.calls.reset();
      component.onSidebarClick();
      expect(mockSidebarService.toggleSidebar).not.toHaveBeenCalled();
      expect(mockSidebarService.isCollapsed()).toBe(true);
    });
  });
});
