import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { SidebarService } from '../../../core/services/sidebar.service';
import { TranslationService } from '../../../core/services/translation.service';
import { AuthService } from '../../../core/services/auth.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
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
  requiresFeature?: string;
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
  private sidebarService = inject(SidebarService);
  private translationService = inject(TranslationService);
  private authService = inject(AuthService);
  private subscriptionService = inject(SubscriptionService);
  private routerSubscription?: Subscription;
  private featureSubscription = new Subscription();
  
  hasInventoryAccess = signal(false);
  hasAdvancedReports = signal(false);
  hasMultiUserAccess = signal(false);
  hasInternalApprovals = signal(false);
  
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
      id: 'appointments',
      label: 'Appointments',
      translationKey: 'navigation.appointments',
      icon: 'calendar',
      route: '/appointments',
      badge: 3
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
      children: [
        { id: 'maintenance-active', label: 'Active Jobs', translationKey: 'maintenance.activeJobs', icon: 'play', route: '/maintenance/active', badge: 5 },
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
      requiresFeature: 'inventory_management'
    },
    {
      id: 'invoices',
      label: 'Invoicing',
      translationKey: 'navigation.invoicing',
      icon: 'receipt',
      isExpanded: false,
      ownerOnly: true,
      children: [
        { id: 'invoices-list', label: 'All Invoices', translationKey: 'invoicing.navigation.allInvoices', icon: 'list', route: '/invoices' },
        { id: 'invoices-create', label: 'Create Invoice', translationKey: 'invoicing.navigation.createInvoice', icon: 'plus', route: '/invoices/create' },
        { id: 'invoices-pending', label: 'Pending Payment', translationKey: 'invoicing.navigation.pendingPayment', icon: 'clock', route: '/invoices/pending', badge: 2 }
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
      requiresFeature: 'basic_reports'
    },
    {
      id: 'approvals',
      label: 'Approvals',
      translationKey: 'maintenance.pendingApproval',
      icon: 'check-circle',
      route: '/approvals',
      badge: 3,
      ownerOnly: true,
      requiresFeature: 'internal_approvals'
    }
  ];

  settingsItems: NavItem[] = [
    {
      id: 'garage-settings',
      label: 'Settings',
      translationKey: 'navigation.settings',
      icon: 'settings',
      route: '/settings',
      ownerOnly: true
    },
    {
      id: 'employees',
      label: 'Employees',
      translationKey: 'navigation.employees',
      icon: 'team',
      route: '/employees',
      ownerOnly: true,
      requiresFeature: 'multi_user'
    },
    {
      id: 'subscription',
      label: 'Subscription',
      translationKey: 'navigation.subscription',
      icon: 'credit-card',
      route: '/subscription',
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
    return this.filterItemsByRoleAndFeature(this.navItems, isOwner);
  });

  filteredSettingsItems = computed(() => {
    const isOwner = this.authService.isOwner();
    return this.filterItemsByRoleAndFeature(this.settingsItems, isOwner);
  });

  private filterItemsByRoleAndFeature(items: NavItem[], isOwner: boolean): NavItem[] {
    return items.filter(item => {
      if (item.ownerOnly && !isOwner) {
        return false;
      }
      if (item.requiresFeature) {
        if (item.requiresFeature === 'inventory_management') {
          return this.hasInventoryAccess();
        }
        if (item.requiresFeature === 'multi_user') {
          return this.hasMultiUserAccess();
        }
        if (item.requiresFeature === 'internal_approvals') {
          return this.hasInternalApprovals();
        }
        if (item.requiresFeature === 'advanced_reports' && !this.hasAdvancedReports()) {
          return false;
        }
      }
      return true;
    });
  }

  getTranslatedLabel(translationKey: string, fallback: string): string {
    return this.translationService.instant(translationKey) || fallback;
  }

  ngOnInit() {
    this.updateActiveStates(this.router.url);
    
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateActiveStates(event.url);
      });
    
    this.loadFeatureAccess();
    
    this.featureSubscription.add(
      this.subscriptionService.currentTier$.subscribe(() => {
        this.loadFeatureAccess();
      })
    );
  }
  
  private loadFeatureAccess(): void {
    this.featureSubscription.add(
      this.subscriptionService.isFeatureEnabled('inventory_management').subscribe(enabled => {
        this.hasInventoryAccess.set(enabled);
      })
    );
    
    this.featureSubscription.add(
      this.subscriptionService.isFeatureEnabled('advanced_reports').subscribe(enabled => {
        this.hasAdvancedReports.set(enabled);
      })
    );
    
    this.featureSubscription.add(
      this.subscriptionService.isFeatureEnabled('multi_user').subscribe(enabled => {
        this.hasMultiUserAccess.set(enabled);
      })
    );
    
    this.featureSubscription.add(
      this.subscriptionService.isFeatureEnabled('internal_approvals').subscribe(enabled => {
        this.hasInternalApprovals.set(enabled);
      })
    );
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    this.featureSubscription.unsubscribe();
  }

  toggleSidebar() {
    this.sidebarService.toggleSidebar();
  }

  toggleMobileMenu() {
    this.sidebarService.toggleMobileMenu();
  }

  navigateTo(route: string) {
    if (route) {
      // Update active state
      this.updateActiveStates(route);
      this.router.navigate([route]);
      // Close mobile menu if open
      this.sidebarService.closeMobileMenu();
    }
  }

  private updateActiveStates(activeRoute: string) {
    // Reset all active states (work on original arrays)
    this.resetActiveStates(this.navItems);
    this.resetActiveStates(this.settingsItems);
    
    // Set new active state (work on original arrays)
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
      
      // Check children and set parent as active if child is active
      if (item.children) {
        this.setActiveState(item.children, activeRoute);
        
        // If any child is active, expand the parent and mark it as having an active child
        const hasActiveChild = item.children.some(child => child.isActive);
        if (hasActiveChild) {
          item.isExpanded = true;
        }
        
        // For partial matches (like /maintenance/active matching /maintenance parent)
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
    // Only allow hover on desktop (lg and up)
    if (this.isDesktop()) {
      this.isHovered.set(true);
    }
  }

  onMouseLeave() {
    // Only allow hover on desktop (lg and up)
    if (this.isDesktop()) {
      this.isHovered.set(false);
    }
  }

  shouldShowExpanded(): boolean {
    // On mobile, show expanded content when menu is open
    if (this.isMobile()) {
      return this.isMobileMenuOpen();
    }
    return !this.isCollapsed() || this.isHovered();
  }

  onSidebarClick() {
    // Only allow click expansion on desktop
    if (this.isDesktop() && this.isCollapsed()) {
      this.toggleSidebar();
    }
  }

  isDesktop(): boolean {
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
  }

  isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }
}