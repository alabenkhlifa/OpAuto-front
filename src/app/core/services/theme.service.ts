import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  
  private readonly STORAGE_KEY = 'opAuto-theme';
  private readonly mediaQuery = this.isBrowser 
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  public readonly currentTheme = signal<Theme>('system');
  public readonly isDarkMode = signal<boolean>(false);

  constructor() {
    this.initializeTheme();
    this.setupThemeEffect();
    this.setupSystemThemeListener();
  }

  private initializeTheme(): void {
    if (!this.isBrowser) return;

    const savedTheme = localStorage.getItem(this.STORAGE_KEY) as Theme || 'system';
    this.currentTheme.set(savedTheme);
    this.updateDarkModeState(savedTheme);
  }

  private setupThemeEffect(): void {
    effect(() => {
      if (!this.isBrowser) return;
      
      const theme = this.currentTheme();
      const isDark = this.isDarkMode();
      
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(isDark ? 'dark' : 'light');
      
      localStorage.setItem(this.STORAGE_KEY, theme);
    });
  }

  private setupSystemThemeListener(): void {
    if (!this.mediaQuery) return;

    this.mediaQuery.addEventListener('change', (e) => {
      if (this.currentTheme() === 'system') {
        this.isDarkMode.set(e.matches);
      }
    });
  }

  private updateDarkModeState(theme: Theme): void {
    switch (theme) {
      case 'dark':
        this.isDarkMode.set(true);
        break;
      case 'light':
        this.isDarkMode.set(false);
        break;
      case 'system':
        this.isDarkMode.set(this.mediaQuery?.matches ?? false);
        break;
    }
  }

  public setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
    this.updateDarkModeState(theme);
  }

  public toggleTheme(): void {
    const current = this.currentTheme();
    if (current === 'system') {
      this.setTheme(this.isDarkMode() ? 'light' : 'dark');
    } else {
      this.setTheme(current === 'light' ? 'dark' : 'light');
    }
  }

  public getThemeIcon(): string {
    const current = this.currentTheme();
    if (current === 'system') {
      return this.isDarkMode() ? 'moon' : 'sun';
    }
    return current === 'light' ? 'sun' : 'moon';
  }

  public getNextThemeLabel(): string {
    const current = this.currentTheme();
    if (current === 'system') {
      return this.isDarkMode() ? 'Light mode' : 'Dark mode';
    }
    return current === 'light' ? 'Dark mode' : 'Light mode';
  }
}