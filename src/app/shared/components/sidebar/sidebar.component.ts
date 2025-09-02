import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ThemeService } from '../../../core/services/theme.service';
import { SidebarService } from '../../../core/services/sidebar.service';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  badge?: number;
  children?: NavItem[];
  isActive?: boolean;
  isExpanded?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  private router = inject(Router);
  public themeService = inject(ThemeService);
  private sidebarService = inject(SidebarService);
  
  isCollapsed = this.sidebarService.isCollapsed;
  isMobileMenuOpen = signal(false);
  isHovered = signal(false);

  navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      route: '/dashboard',
      isActive: true
    },
    {
      id: 'appointments',
      label: 'Appointments',
      icon: 'calendar',
      route: '/appointments',
      badge: 3
    },
    {
      id: 'cars',
      label: 'Car Management',
      icon: 'car',
      isExpanded: false,
      children: [
        { id: 'cars-list', label: 'All Cars', icon: 'list', route: '/cars' },
        { id: 'cars-add', label: 'Register Car', icon: 'plus', route: '/cars/add' }
      ]
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      icon: 'wrench',
      isExpanded: false,
      children: [
        { id: 'maintenance-active', label: 'Active Jobs', icon: 'play', route: '/maintenance/active', badge: 5 },
        { id: 'maintenance-history', label: 'History', icon: 'history', route: '/maintenance/history' },
        { id: 'maintenance-schedule', label: 'Schedule', icon: 'calendar', route: '/maintenance/schedule' }
      ]
    },
    {
      id: 'inventory',
      label: 'Parts & Inventory',
      icon: 'package',
      route: '/inventory'
    },
    {
      id: 'invoices',
      label: 'Invoicing',
      icon: 'receipt',
      isExpanded: false,
      children: [
        { id: 'invoices-list', label: 'All Invoices', icon: 'list', route: '/invoices' },
        { id: 'invoices-create', label: 'Create Invoice', icon: 'plus', route: '/invoices/create' },
        { id: 'invoices-pending', label: 'Pending Payment', icon: 'clock', route: '/invoices/pending', badge: 2 }
      ]
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: 'users',
      route: '/customers'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: 'chart',
      route: '/reports'
    },
    {
      id: 'approvals',
      label: 'Approvals',
      icon: 'check-circle',
      route: '/approvals',
      badge: 3
    }
  ];

  settingsItems: NavItem[] = [
    {
      id: 'garage-settings',
      label: 'Garage Settings',
      icon: 'settings',
      route: '/settings'
    },
    {
      id: 'employees',
      label: 'Employees',
      icon: 'team',
      route: '/employees'
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: 'user',
      route: '/profile'
    }
  ];

  toggleSidebar() {
    this.sidebarService.toggleSidebar();
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.set(!this.isMobileMenuOpen());
  }

  navigateTo(route: string) {
    if (route) {
      // Update active state
      this.updateActiveStates(route);
      this.router.navigate([route]);
      // Close mobile menu if open
      this.isMobileMenuOpen.set(false);
    }
  }

  private updateActiveStates(activeRoute: string) {
    // Reset all active states
    this.resetActiveStates(this.navItems);
    this.resetActiveStates(this.settingsItems);
    
    // Set new active state
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
    return this.themeService.isDarkMode() ? 'white' : '#64748b';
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