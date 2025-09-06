import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type SupportedLanguage = 'en' | 'fr' | 'ar';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly STORAGE_KEY = 'opauth_language';
  
  public readonly supportedLanguages: LanguageOption[] = [
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      flag: '🇺🇸'
    },
    {
      code: 'fr',
      name: 'French',
      nativeName: 'Français',
      flag: '🇫🇷'
    },
    {
      code: 'ar',
      name: 'Arabic',
      nativeName: 'العربية',
      flag: '🇸🇦'
    }
  ];

  private currentLanguageSubject = new BehaviorSubject<SupportedLanguage>('en');
  public currentLanguage$ = this.currentLanguageSubject.asObservable();
  
  public currentLanguage = signal<SupportedLanguage>('en');

  constructor() {
    // Initialize with stored language
    const storedLang = this.getStoredLanguage();
    this.currentLanguage.set(storedLang);
    this.currentLanguageSubject.next(storedLang);
    
    // Set initial language
    this.setLanguage(storedLang, false);
  }

  setLanguage(language: SupportedLanguage, persist: boolean = true): void {
    this.currentLanguage.set(language);
    this.currentLanguageSubject.next(language);
    
    if (persist) {
      localStorage.setItem(this.STORAGE_KEY, language);
    }

    // Apply RTL direction for Arabic
    this.updateDocumentDirection(language);
    
    // Update HTML lang attribute
    document.documentElement.lang = language;
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage();
  }

  getLanguageOption(code: SupportedLanguage): LanguageOption | undefined {
    return this.supportedLanguages.find(lang => lang.code === code);
  }

  getNextLanguage(): SupportedLanguage {
    const currentIndex = this.supportedLanguages.findIndex(
      lang => lang.code === this.currentLanguage()
    );
    const nextIndex = (currentIndex + 1) % this.supportedLanguages.length;
    return this.supportedLanguages[nextIndex].code;
  }

  cycleLanguage(): void {
    const nextLanguage = this.getNextLanguage();
    this.setLanguage(nextLanguage);
  }

  private getStoredLanguage(): SupportedLanguage {
    if (typeof window === 'undefined') return 'en';
    
    const stored = localStorage.getItem(this.STORAGE_KEY) as SupportedLanguage;
    const validLanguages: SupportedLanguage[] = ['en', 'fr', 'ar'];
    
    if (stored && validLanguages.includes(stored)) {
      return stored;
    }

    // Fallback to browser language or default
    const browserLang = navigator.language.substr(0, 2) as SupportedLanguage;
    return validLanguages.includes(browserLang) ? browserLang : 'en';
  }

  private updateDocumentDirection(language: SupportedLanguage): void {
    // Keep LTR layout for all languages (including Arabic)
    document.documentElement.dir = 'ltr';
    document.documentElement.setAttribute('data-direction', 'ltr');
  }

  isRTL(): boolean {
    // RTL is disabled - always return false to maintain LTR layout
    return false;
  }

  // Helper method to format text based on current language
  formatText(key: string, fallback: string = key): string {
    // In a real app, this would use a translation service
    // For now, return the fallback
    return fallback;
  }
}