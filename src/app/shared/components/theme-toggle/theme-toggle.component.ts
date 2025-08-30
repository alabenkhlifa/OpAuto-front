import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      (click)="themeService.toggleTheme()"
      [attr.aria-label]="themeService.getNextThemeLabel()"
      [title]="themeService.getNextThemeLabel()"
      class="relative inline-flex items-center justify-center w-10 h-10 p-2 rounded-lg 
             bg-white/80 hover:bg-white dark:bg-gray-800 dark:hover:bg-gray-700 
             border-2 border-gray-200 hover:border-primary-300 dark:border-gray-600 dark:hover:border-primary-500
             backdrop-blur-sm shadow-sm hover:shadow-md
             transition-all duration-300 ease-in-out
             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 
             dark:focus:ring-offset-gray-900 group">
      
      <!-- Sun Icon -->
      <svg
        *ngIf="themeService.getThemeIcon() === 'sun'"
        class="w-5 h-5 transform transition-all duration-300 group-hover:rotate-12 text-amber-500 group-hover:text-amber-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2.5">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>

      <!-- Moon Icon -->
      <svg
        *ngIf="themeService.getThemeIcon() === 'moon'"
        class="w-5 h-5 transform transition-all duration-300 group-hover:-rotate-12 text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2.5">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>

      <!-- Ripple Effect -->
      <span class="absolute inset-0 rounded-lg bg-primary-500 opacity-0 group-active:opacity-20 transition-opacity duration-150"></span>
    </button>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class ThemeToggleComponent {
  public readonly themeService = inject(ThemeService);
}