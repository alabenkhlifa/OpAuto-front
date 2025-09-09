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
      <!-- Language Toggle Button - Glassmorphism Style -->
      <button 
        class="flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-sm border transition-all duration-200 bg-slate-800 bg-opacity-50 border-slate-700 hover:bg-opacity-70 hover:border-slate-600 hover:transform hover:scale-105"
        (click)="toggleDropdown()"
        [attr.aria-label]="'Change language. Current: ' + getCurrentLanguageOption()?.nativeName">
        
        <!-- Flag Icon -->
        <span class="text-lg leading-none">{{ getCurrentLanguageOption()?.flag }}</span>
        
        <!-- Language Code -->
        <span class="text-xs font-medium uppercase text-white">
          {{ currentLanguage() }}
        </span>
        
        <!-- Dropdown Arrow -->
        <svg class="w-3 h-3 transition-transform duration-200 text-gray-300"
             [class.rotate-180]="isDropdownOpen()" 
             fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Dropdown Menu - Glassmorphism Style -->
      @if (isDropdownOpen()) {
        <div class="absolute top-full right-0 mt-2 w-48 backdrop-blur-lg rounded-xl border shadow-lg z-50 bg-slate-900 bg-opacity-95 border-slate-700">
          
          <!-- Dropdown Header -->
          <div class="px-4 py-3 border-b border-slate-600 border-opacity-60">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-300">
              Select Language
            </p>
          </div>

          <!-- Language Options -->
          <div class="py-2">
            @for (language of languageOptions; track language.code) {
              <button 
                class="w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-blue-600 hover:bg-opacity-30 hover:backdrop-blur-sm"
                [class.bg-blue-600]="language.code === currentLanguage()"
                [class.bg-opacity-40]="language.code === currentLanguage()"
                [class.backdrop-blur-sm]="language.code === currentLanguage()"
                (click)="selectLanguage(language.code)">
                
                <!-- Flag -->
                <span class="text-xl leading-none">{{ language.flag }}</span>
                
                <!-- Language Info -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium"
                     [class.text-gray-100]="language.code !== currentLanguage()"
                     [class.text-white]="language.code === currentLanguage()">
                    {{ language.nativeName }}
                  </p>
                  <p class="text-xs"
                     [class.text-gray-400]="language.code !== currentLanguage()"
                     [class.text-gray-200]="language.code === currentLanguage()">
                    {{ language.name }}
                  </p>
                </div>
                
                <!-- Selected Indicator -->
                @if (language.code === currentLanguage()) {
                  <svg class="w-4 h-4 text-white" 
                       fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                }
              </button>
            }
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
    
    /* Enhanced glassmorphism effects */
    .backdrop-blur-lg {
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }

    .backdrop-blur-sm {
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    /* Smooth transitions for glassmorphism */
    * {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Enhanced hover effects for glassmorphism */
    button:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    /* Dropdown shadow enhancement */
    .shadow-lg {
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
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