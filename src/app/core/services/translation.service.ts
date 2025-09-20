import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { LanguageService, SupportedLanguage } from './language.service';
import { DOCUMENT } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private http = inject(HttpClient);
  private languageService = inject(LanguageService);
  private document = inject(DOCUMENT);
  
  private translationsSubject = new BehaviorSubject<any>({});
  public translations$ = this.translationsSubject.asObservable();
  
  private loadedLanguages = new Set<SupportedLanguage>();
  private translationsCache = new Map<SupportedLanguage, any>();

  constructor() {
    // Clear any cached translations on startup
    this.loadedLanguages.clear();
    this.translationsCache.clear();
    
    // Subscribe to language changes
    this.languageService.currentLanguage$.subscribe(language => {
      this.loadTranslations(language);
    });
    
    // Load initial translations
    this.loadTranslations(this.languageService.getCurrentLanguage());
  }

  private loadTranslations(language: SupportedLanguage): void {
    if (this.loadedLanguages.has(language)) {
      // If already loaded, emit cached translations
      const cachedTranslations = this.translationsCache.get(language) || {};
        this.translationsSubject.next(cachedTranslations);
      return;
    }

    // Get the base href from document
    const baseHref = this.document.getElementsByTagName('base')[0]?.getAttribute('href') || '/';
    const assetsPath = baseHref + 'assets/i18n/' + language + '.json';
    
    
    this.http.get(assetsPath).pipe(
      catchError(error => {
        console.warn(`Failed to load translations for ${language}:`, error);
        return of({});
      })
    ).subscribe(translations => {
      this.loadedLanguages.add(language);
      this.translationsCache.set(language, translations);
      this.translationsSubject.next(translations);
    });
  }

  translate(key: string, params?: Record<string, any>): Observable<string> {
    return this.translations$.pipe(
      map(translations => {
        const keys = key.split('.');
        let value = translations;
        
        for (const k of keys) {
          if (value && typeof value === 'object' && k in value) {
            value = value[k];
          } else {
            return key; // Return key if translation not found
          }
        }
        
        let result = typeof value === 'string' ? value : key;
        
        // Handle parameters
        if (params && typeof result === 'string') {
          Object.keys(params).forEach(param => {
            result = result.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
          });
        }
        
        return result;
      })
    );
  }

  // Force reload translations (useful for development)
  forceReloadTranslations(): void {
    this.loadedLanguages.clear();
    this.translationsCache.clear();
    this.loadTranslations(this.languageService.getCurrentLanguage());
  }

  // Get current translations object
  getCurrentTranslations(): any {
    return this.translationsSubject.value;
  }

  // Synchronous version for templates
  instant(key: string, params?: Record<string, any>): string {
    const translations = this.translationsSubject.value;
    
    
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    let result = typeof value === 'string' ? value : key;
    
    // Handle parameters
    if (params && typeof result === 'string') {
      Object.keys(params).forEach(param => {
        result = result.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
      });
    }
    
    
    return result;
  }
}