import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { LanguageService, SupportedLanguage } from './language.service';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private http = inject(HttpClient);
  private languageService = inject(LanguageService);
  
  private translationsSubject = new BehaviorSubject<any>({});
  public translations$ = this.translationsSubject.asObservable();
  
  private loadedLanguages = new Set<SupportedLanguage>();
  private translationsCache = new Map<SupportedLanguage, any>();

  constructor() {
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

    this.http.get(`/assets/i18n/${language}.json`).pipe(
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