import { Component, inject, signal, OnInit, OnDestroy, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SidebarService } from '../../../core/services/sidebar.service';
import { TranslationService } from '../../../core/services/translation.service';
import { AuthService } from '../../../core/services/auth.service';
import { ModuleService } from '../../../core/services/module.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ModuleId } from '../../../core/models/module.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { filter, Subscription } from 'rxjs';

interface NavItem {
  id: string;
  label: string;
  translationKey: string;
  icon: string;
  route?: string;
  badge?: number;
  children?: NavItem[];
  isActive?: boolean;
  isExpanded?: boolean;
  ownerOnly?: boolean;
  requiresModule?: ModuleId;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private http = inject(HttpClient);
  private sidebarService = inject(SidebarService);
  private translationService = inject(TranslationService);
  private authService = inject(AuthService);
  private moduleService = inject(ModuleService);
  private notificationService = inject(NotificationService);
  private routerSubscription?: Subscription;
  private badgeCounts = signal<Record<string, number>>({});

  isCollapsed = this.sidebarService.isCollapsed;
  isMobileMenuOpen = this.sidebarService.isMobileMenuOpen;
  isHovered = signal(false);

  navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      translationKey: 'navigation.dashboard',
      icon: 'dashboard',
      route: '/dashboard',
      isActive: true
    },
    {
      id: 'calendar',
      label: 'Calendar & Appointments',
      translationKey: 'navigation.calendarAndAppointments',
      icon: 'calendar-view',
      route: '/calendar',
      requiresModule: 'calendar'
    },
    {
      id: 'cars',
      label: 'Cars',
      translationKey: 'navigation.cars',
      icon: 'car',
      route: '/cars'
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      translationKey: 'navigation.maintenance',
      icon: 'wrench',
      isExpanded: false,
      requiresModule: 'maintenance',
      children: [
        { id: 'maintenance-active', label: 'Active Jobs', translationKey: 'maintenance.activeJobs', icon: 'play', route: '/maintenance/active' },
        { id: 'maintenance-history', label: 'Completed Jobs', translationKey: 'maintenance.completedJobs', icon: 'history', route: '/maintenance/history' },
        { id: 'maintenance-schedule', label: 'Schedule', translationKey: 'maintenance.schedule', icon: 'calendar', route: '/maintenance/schedule' }
      ]
    },
    {
      id: 'inventory',
      label: 'Parts & Inventory',
      translationKey: 'navigation.inventory',
      icon: 'package',
      route: '/inventory',
      ownerOnly: true,
      requiresModule: 'inventory'
    },
    {
      id: 'invoices',
      label: 'Invoicing',
      translationKey: 'navigation.invoicing',
      icon: 'receipt',
      isExpanded: false,
      // Sweep C-15 — invoicing surface is OWNER + STAFF (BE: @Roles(OWNER, STAFF));
      // owner-only destructive actions live in the component layer (canShow('delete')).
      requiresModule: 'invoicing',
      children: [
        { id: 'invoices-dashboard', label: 'Dashboard', translationKey: 'invoicing.subnav.dashboard', icon: 'dashboard', route: '/invoices' },
        { id: 'invoices-quotes', label: 'Quotes', translationKey: 'invoicing.subnav.quotes', icon: 'list', route: '/invoices/quotes' },
        { id: 'invoices-list', label: 'All Invoices', translationKey: 'invoicing.subnav.invoices', icon: 'list', route: '/invoices/list' },
        { id: 'invoices-credit-notes', label: 'Credit Notes', translationKey: 'invoicing.subnav.creditNotes', icon: 'list', route: '/invoices/credit-notes' },
        { id: 'invoices-pending', label: 'Pending Payment', translationKey: 'invoicing.subnav.pending', icon: 'clock', route: '/invoices/pending' },
        { id: 'invoices-reports', label: 'Reports', translationKey: 'invoicing.subnav.reports', icon: 'chart', route: '/invoices/reports' }
      ]
    },
    {
      id: 'customers',
      label: 'Customers',
      translationKey: 'navigation.customers',
      icon: 'users',
      route: '/customers'
    },
    {
      id: 'reports',
      label: 'Reports',
      translationKey: 'navigation.reports',
      icon: 'chart',
      route: '/reports',
      ownerOnly: true,
      requiresModule: 'reports'
    },
    {
      id: 'approvals',
      label: 'Approvals',
      translationKey: 'maintenance.pendingApproval',
      icon: 'check-circle',
      route: '/approvals',
      ownerOnly: true,
      requiresModule: 'approvals'
    },
    {
      id: 'notifications',
      label: 'Notifications',
      translationKey: 'navigation.notifications',
      icon: 'bell',
      route: '/notifications',
      requiresModule: 'notifications'
    }
  ];

  settingsItems: NavItem[] = [
    {
      id: 'garage-settings',
      label: 'Settings',
      translationKey: 'navigation.settings',
      icon: 'settings',
      route: '/settings',
      ownerOnly: true,
      requiresModule: 'settings'
    },
    {
      id: 'employees',
      label: 'Employees',
      translationKey: 'navigation.employees',
      icon: 'team',
      route: '/employees',
      ownerOnly: true,
      requiresModule: 'employees'
    },
    {
      id: 'modules',
      label: 'Modules',
      translationKey: 'navigation.modules',
      icon: 'grid',
      route: '/modules',
      ownerOnly: true
    },
    {
      id: 'profile',
      label: 'Profile',
      translationKey: 'navigation.profile',
      icon: 'user',
      route: '/profile'
    }
  ];

  filteredNavItems = computed(() => {
    const isOwner = this.authService.isOwner();
    return this.filterItemsByRole(this.navItems, isOwner);
  });

  filteredSettingsItems = computed(() => {
    const isOwner = this.authService.isOwner();
    return this.filterItemsByRole(this.settingsItems, isOwner);
  });

  private filterItemsByRole(items: NavItem[], isOwner: boolean): NavItem[] {
    return items.filter(item => {
      if (item.ownerOnly && !isOwner) return false;
      return true;
    });
  }

  isModuleLocked(item: NavItem): boolean {
    if (!item.requiresModule) return false;
    return !this.moduleService.hasModuleAccess(item.requiresModule);
  }

  getTranslatedLabel(translationKey: string, fallback: string): string {
    return this.translationService.instant(translationKey) || fallback;
  }

  ngOnInit() {
    this.updateActiveStates(this.router.url);
    this.loadBadgeCounts();

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateActiveStates(event.url);
        this.loadBadgeCounts();
      });
  }

  private loadBadgeCounts() {
    const isOwner = this.authService.isOwner();
    this.http.get<any>('/appointments').subscribe({
      next: (appts) => {
        const today = new Date().toDateString();
        const todayCount = Array.isArray(appts) ? appts.filter((a: any) => {
          const d = new Date(a.startTime || a.date);
          return d.toDateString() === today;
        }).length : 0;
        this.badgeCounts.update(c => ({ ...c, appointments: todayCount }));
      },
      error: () => {}
    });
    this.http.get<any[]>('/maintenance').subscribe({
      next: (jobs) => {
        const active = Array.isArray(jobs) ? jobs.filter((j: any) => j.status === 'IN_PROGRESS').length : 0;
        this.badgeCounts.update(c => ({ ...c, 'maintenance-active': active }));
      },
      error: () => {}
    });
    // Sweep C-15 — invoicing badges are visible to OWNER + STAFF (BE policy
    // is `@Roles(OWNER, STAFF)` on the list endpoints). Approvals badge
    // stays owner-gated (discount-approval is owner-only per BE).
    // Sweep C-20 (S-PERF-001): the BE list endpoint now returns the
    // paginated envelope `{ items, total, page, limit }`. Request
    // `limit=100` (the BE-clamped maximum) so the badge counts the
    // first page's worth of unpaid invoices — for any garage with more
    // than ~100 unpaid invoices the badge undercounts, which is fine
    // for an at-a-glance affordance (the user clicks through to the
    // /invoices/pending page for the authoritative list).
    this.http
      .get<{ items: any[]; total: number } | any[]>(
        '/invoices?page=1&limit=100',
      )
      .subscribe({
        next: (resp) => {
          // Pending Payment badge (S-SB-003): all unpaid issued invoices.
          // Per the Section-16 spec the count is SENT + PARTIALLY_PAID +
          // OVERDUE. We also include VIEWED — it's just SENT after the
          // customer opened the delivery email, still unpaid; treating it
          // separately would split the same logical bucket. The destination
          // /invoices/pending page filters to the same set so the badge
          // equals the row count the user sees.
          const items = Array.isArray(resp) ? resp : resp?.items ?? [];
          const pending = items.filter(
            (i: any) =>
              i.status === 'SENT' ||
              i.status === 'VIEWED' ||
              i.status === 'PARTIALLY_PAID' ||
              i.status === 'OVERDUE',
          ).length;
          this.badgeCounts.update((c) => ({ ...c, 'invoices-pending': pending }));
        },
        error: () => {},
      });
    // Quotes badge: number of SENT (awaiting customer reply) quotes.
    this.http.get<any[]>('/quotes').subscribe({
      next: (quotes) => {
        const pending = Array.isArray(quotes)
          ? quotes.filter((q: any) => q.status === 'SENT').length
          : 0;
        this.badgeCounts.update(c => ({ ...c, 'invoices-quotes': pending }));
      },
      error: () => {}
    });
    if (isOwner) {
      this.http.get<any[]>('/approvals').subscribe({
        next: (aprs) => {
          const pending = Array.isArray(aprs) ? aprs.filter((a: any) => a.status === 'PENDING').length : 0;
          this.badgeCounts.update(c => ({ ...c, approvals: pending }));
        },
        error: () => {}
      });
    }
  }

  getBadge(itemId: string): number | null {
    if (itemId === 'notifications') {
      const count = this.notificationService.unreadCount();
      return count > 0 ? count : null;
    }
    const count = this.badgeCounts()[itemId];
    return count && count > 0 ? count : null;
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  toggleSidebar() {
    this.sidebarService.toggleSidebar();
  }

  toggleMobileMenu() {
    this.sidebarService.toggleMobileMenu();
  }

  navigateTo(route: string) {
    if (route) {
      this.updateActiveStates(route);
      this.router.navigate([route]);
      this.sidebarService.closeMobileMenu();
    }
  }

  onNavItemClick(item: NavItem, event: Event) {
    event.stopPropagation();
    if (this.isModuleLocked(item)) {
      this.router.navigate(['/modules']);
      this.sidebarService.closeMobileMenu();
      return;
    }
    if (item.children) {
      this.toggleSubmenu(item, event);
    } else {
      this.navigateTo(item.route!);
    }
  }

  private updateActiveStates(activeRoute: string) {
    this.resetActiveStates(this.navItems);
    this.resetActiveStates(this.settingsItems);
    this.setActiveState(this.navItems, activeRoute);
    this.setActiveState(this.settingsItems, activeRoute);
  }

  private resetActiveStates(items: NavItem[]) {
    items.forEach(item => {
      item.isActive = false;
      if (item.children) {
        this.resetActiveStates(item.children);
      }
    });
  }

  private setActiveState(items: NavItem[], activeRoute: string) {
    items.forEach(item => {
      if (item.route === activeRoute) {
        item.isActive = true;
      }

      if (item.children) {
        this.setActiveState(item.children, activeRoute);
        const hasActiveChild = item.children.some(child => child.isActive);
        if (hasActiveChild) {
          item.isExpanded = true;
        }
        if (item.route && activeRoute.startsWith(item.route + '/')) {
          item.isExpanded = true;
        }
      }
    });
  }

  toggleSubmenu(item: NavItem, event: Event) {
    event.stopPropagation();
    if (item.children) {
      item.isExpanded = !item.isExpanded;
    }
  }

  getTextColor(): string {
    return '#64748b';
  }

  onMouseEnter() {
    if (this.isDesktop()) {
      this.isHovered.set(true);
    }
  }

  onMouseLeave() {
    if (this.isDesktop()) {
      this.isHovered.set(false);
    }
  }

  shouldShowExpanded(): boolean {
    if (this.isMobile()) {
      return this.isMobileMenuOpen();
    }
    return !this.isCollapsed() || this.isHovered();
  }

  onSidebarClick() {
    // Rail mode (S-SB-006 / BUG-107): collapsed sidebar stays as a 64px
    // icon strip with hover-flyout — clicking blank rail space no longer
    // auto-expands. Nav-item clicks are routed via onNavItemClick and
    // stopPropagation, so this handler intentionally only no-ops on
    // rail-mode clicks. Users expand permanently via the collapse-btn
    // (visible once the rail flyout is open) or via the hamburger on
    // mobile. Kept as a hook so future rail interactions can attach.
  }

  isDesktop(): boolean {
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
  }

  isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }
}
