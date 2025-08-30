import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  public readonly isCollapsed = signal(false);

  toggleSidebar(): void {
    this.isCollapsed.set(!this.isCollapsed());
  }

  setSidebarState(collapsed: boolean): void {
    this.isCollapsed.set(collapsed);
  }
}