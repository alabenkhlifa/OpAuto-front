import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  public readonly isCollapsed = signal(false);
  public readonly isMobileMenuOpen = signal(false);

  toggleSidebar(): void {
    this.isCollapsed.set(!this.isCollapsed());
  }

  setSidebarState(collapsed: boolean): void {
    this.isCollapsed.set(collapsed);
  }

  expandSidebar(): void {
    this.isCollapsed.set(false);
  }

  collapseSidebar(): void {
    this.isCollapsed.set(true);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.set(!this.isMobileMenuOpen());
  }

  openMobileMenu(): void {
    this.isMobileMenuOpen.set(true);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }
}