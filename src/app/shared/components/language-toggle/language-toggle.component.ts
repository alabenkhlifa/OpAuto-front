import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { LanguageService, LanguageOption, SupportedLanguage } from '../../../core/services/language.service';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative">
      <!-- Language Toggle Pill -->
      <button
        type="button"
        class="lang-pill"
        (click)="toggleDropdown()"
        [attr.aria-label]="'Change language. Current: ' + getCurrentLanguageOption()?.nativeName">

        <!-- Flag Icon -->
        <span class="lang-pill__flag">{{ getCurrentLanguageOption()?.flag }}</span>

        <!-- Language Code -->
        <span class="lang-pill__code">{{ currentLanguage() }}</span>

        <!-- Dropdown Arrow -->
        <svg class="lang-pill__arrow"
             [class.lang-pill__arrow--open]="isDropdownOpen()"
             fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Dropdown Menu - Glassmorphism Style -->
      @if (isDropdownOpen()) {
        <div class="absolute top-full right-0 mt-2 w-48 rounded-xl border shadow-lg z-50 bg-white border-gray-200">

          <!-- Dropdown Header -->
          <div class="px-4 py-3 border-b border-gray-200">
            <p class="text-xs font-medium uppercase tracking-wider text-gray-500">
              {{ getTranslatedText('settings.language', 'Select Language') }}
            </p>
          </div>

          <!-- Language Options -->
          <div class="py-2">
            @for (language of languageOptions; track language.code) {
              <button
                class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-gray-50"
                [class.bg-orange-50]="language.code === currentLanguage()"
                (click)="selectLanguage(language.code)">

                <!-- Flag -->
                <span class="text-xl leading-none">{{ language.flag }}</span>

                <!-- Language Info -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900">
                    {{ language.nativeName }}
                  </p>
                  <p class="text-xs text-gray-500">
                    {{ language.name }}
                  </p>
                </div>

                <!-- Selected Indicator -->
                @if (language.code === currentLanguage()) {
                  <svg class="w-4 h-4 text-orange-500"
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
    .lang-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.875rem;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 9999px;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04);
      transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
      font: inherit;
      color: #111827;
      height: 44px;
    }

    .lang-pill:hover {
      border-color: #d1d5db;
      box-shadow: 0 2px 6px rgba(17, 24, 39, 0.06);
      transform: translateY(-1px);
    }

    .lang-pill:focus-visible {
      outline: 2px solid #FF8400;
      outline-offset: 2px;
    }

    .lang-pill__flag {
      font-size: 1.125rem;
      line-height: 1;
    }

    .lang-pill__code {
      font-size: 0.8125rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #111827;
      letter-spacing: 0.02em;
    }

    .lang-pill__arrow {
      width: 0.875rem;
      height: 0.875rem;
      color: #6b7280;
      transition: transform 200ms ease;
    }

    .lang-pill__arrow--open {
      transform: rotate(180deg);
    }

    .shadow-lg {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
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
  private translationService = inject(TranslationService);
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

  getTranslatedText(key: string, fallback: string): string {
    return this.translationService.instant(key) || fallback;
  }

  isDarkMode(): boolean {
    return document.documentElement.classList.contains('dark') || 
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}