import { Pipe, PipeTransform, inject, ChangeDetectorRef } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform {
  private translationService = inject(TranslationService);
  private cdr = inject(ChangeDetectorRef);
  
  private lastKey: string = '';
  private lastParams: Record<string, any> = {};
  private lastValue: string = '';

  transform(key: string, params?: Record<string, any>): string {
    if (!key) return '';
    
    // Check if we need to update
    if (key !== this.lastKey || JSON.stringify(params) !== JSON.stringify(this.lastParams)) {
      this.lastKey = key;
      this.lastParams = params || {};
      this.lastValue = this.translationService.instant(key, params);
      
      // Subscribe to translation changes for this key
      this.translationService.translations$.subscribe(() => {
        const newValue = this.translationService.instant(key, params);
        if (newValue !== this.lastValue) {
          this.lastValue = newValue;
          this.cdr.markForCheck();
        }
      });
    }
    
    return this.lastValue;
  }
}