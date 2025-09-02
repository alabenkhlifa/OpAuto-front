import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { LanguageService, LanguageOption, SupportedLanguage } from '../../../core/services/language.service';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative">
      <!-- Language Toggle Button -->
      <button 
        class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 hover:bg-opacity-90 dark:hover:bg-opacity-90"
        (click)="toggleDropdown()"
        [attr.aria-label]="'Change language. Current: ' + getCurrentLanguageOption()?.nativeName">
        
        <!-- Flag Icon -->
        <span class="text-lg leading-none">{{ getCurrentLanguageOption()?.flag }}</span>
        
        <!-- Language Code -->
        <span class="text-xs font-medium uppercase"
              [class.text-gray-700]="!isDarkMode()"
              [class.text-white]="isDarkMode()">
          {{ currentLanguage() }}
        </span>
        
        <!-- Dropdown Arrow -->
        <svg class="w-3 h-3 transition-transform duration-200"
             [class.text-gray-500]="!isDarkMode()"
             [class.text-gray-300]="isDarkMode()"
             [class.rotate-180]="isDropdownOpen()" 
             fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Dropdown Menu -->
      @if (isDropdownOpen()) {
        <div class="absolute top-full right-0 mt-2 w-48 backdrop-blur-lg rounded-xl border shadow-lg z-50"
             [class.bg-white]="!isDarkMode()"
             [class.bg-opacity-95]="!isDarkMode()" 
             [class.bg-gray-800]="isDarkMode()"
             [class.bg-opacity-95]="isDarkMode()"
             [class.border-gray-200]="!isDarkMode()"
             [class.border-gray-700]="isDarkMode()">
          
          <!-- Dropdown Header -->
          <div class="px-4 py-3 border-b"
               [class.border-gray-200]="!isDarkMode()"
               [class.border-gray-700]="isDarkMode()">
            <p class="text-xs font-medium uppercase tracking-wider"
               [class.text-gray-600]="!isDarkMode()"
               [class.text-gray-200]="isDarkMode()">
              Select Language
            </p>
          </div>

          <!-- Language Options -->
          <div class="py-2">
            @for (language of languageOptions; track language.code) {
              <button 
                class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150"
                [class.hover:bg-blue-50]="!isDarkMode()"
                [class.hover:bg-blue-900]="isDarkMode()"
                [class.hover:bg-opacity-50]="isDarkMode()"
                [class.bg-blue-50]="language.code === currentLanguage() && !isDarkMode()"
                [class.bg-blue-900]="language.code === currentLanguage() && isDarkMode()"
                [class.bg-opacity-50]="language.code === currentLanguage() && isDarkMode()"
                (click)="selectLanguage(language.code)">
                
                <!-- Flag -->
                <span class="text-xl leading-none">{{ language.flag }}</span>
                
                <!-- Language Info -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium"
                     [class.text-gray-900]="!isDarkMode() && language.code !== currentLanguage()"
                     [class.text-blue-900]="!isDarkMode() && language.code === currentLanguage()"
                     [class.text-white]="isDarkMode() && language.code !== currentLanguage()"
                     [class.text-blue-100]="isDarkMode() && language.code === currentLanguage()">
                    {{ language.nativeName }}
                  </p>
                  <p class="text-xs"
                     [class.text-gray-600]="!isDarkMode() && language.code !== currentLanguage()"
                     [class.text-blue-700]="!isDarkMode() && language.code === currentLanguage()"
                     [class.text-gray-300]="isDarkMode() && language.code !== currentLanguage()"
                     [class.text-blue-200]="isDarkMode() && language.code === currentLanguage()">
                    {{ language.name }}
                  </p>
                </div>
                
                <!-- Selected Indicator -->
                @if (language.code === currentLanguage()) {
                  <svg class="w-4 h-4" 
                       [class.text-blue-600]="!isDarkMode()"
                       [class.text-blue-200]="isDarkMode()"
                       fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                }
              </button>
            }
          </div>

          <!-- Quick Toggle Info -->
          <div class="px-4 py-3 border-t rounded-b-xl"
               [class.border-gray-200]="!isDarkMode()"
               [class.border-gray-700]="isDarkMode()"
               [class.bg-gray-50]="!isDarkMode()"
               [class.bg-gray-700]="isDarkMode()"
               [class.bg-opacity-50]="isDarkMode()">
            <p class="text-xs"
               [class.text-gray-600]="!isDarkMode()"
               [class.text-gray-200]="isDarkMode()">
              💡 Tip: Click the flag to cycle through languages quickly
            </p>
          </div>
        </div>
      }

      <!-- Backdrop for closing dropdown -->
      @if (isDropdownOpen()) {
        <div 
          class="fixed inset-0 z-40"
          (click)="closeDropdown()">
        </div>
      }
    </div>
  `,
  styles: [`
    .rotate-180 {
      transform: rotate(180deg);
    }
    
    /* Enhanced backdrop blur for better glass effect */
    .backdrop-blur-lg {
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    /* Smooth transitions */
    * {
      transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease, transform 0.2s ease;
    }

    /* Hover effects for better UX */
    button:hover {
      transform: translateY(-1px);
    }

    /* RTL Support */
    [dir="rtl"] .absolute.right-0 {
      left: 0;
      right: auto;
    }

    [dir="rtl"] .text-left {
      text-align: right;
    }
  `]
})
export class LanguageToggleComponent implements OnInit, OnDestroy {
  private languageService = inject(LanguageService);
  private destroy$ = new Subject<void>();

  currentLanguage = signal<SupportedLanguage>('en');
  isDropdownOpen = signal(false);
  languageOptions = this.languageService.supportedLanguages;

  ngOnInit() {
    // Subscribe to language changes
    this.languageService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(language => {
        this.currentLanguage.set(language);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleDropdown() {
    if (this.isDropdownOpen()) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    this.isDropdownOpen.set(true);
  }

  closeDropdown() {
    this.isDropdownOpen.set(false);
  }

  selectLanguage(language: SupportedLanguage) {
    this.languageService.setLanguage(language);
    this.closeDropdown();
  }

  getCurrentLanguageOption(): LanguageOption | undefined {
    return this.languageService.getLanguageOption(this.currentLanguage());
  }

  isDarkMode(): boolean {
    return document.documentElement.classList.contains('dark') || 
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}