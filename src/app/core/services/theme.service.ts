import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  
  // Always dark mode - simplified service
  public readonly isDarkMode = signal<boolean>(true);

  constructor() {
    this.initializeDarkMode();
  }

  private initializeDarkMode(): void {
    if (!this.isBrowser) return;
    
    // Always set dark mode
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  }

  // Legacy methods kept for compatibility but always return dark mode values
  public setTheme(): void {
    // No-op - always dark mode
  }

  public toggleTheme(): void {
    // No-op - always dark mode
  }

  public getThemeIcon(): string {
    return 'moon';
  }

  public getNextThemeLabel(): string {
    return 'Dark mode (permanent)';
  }
}