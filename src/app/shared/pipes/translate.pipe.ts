import { Pipe, PipeTransform, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';
import { Subscription } from 'rxjs';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private translationService = inject(TranslationService);
  private cdr = inject(ChangeDetectorRef);
  private subscription?: Subscription;
  private lastValue: string = '';

  transform(key: string, params?: Record<string, any>): string {
    if (!key) return '';

    // Subscribe to translation changes if not already subscribed
    if (!this.subscription) {
      this.subscription = this.translationService.translations$.subscribe(() => {
        this.cdr.markForCheck();
      });
    }

    // Get the translation directly from the service
    const translation = this.translationService.instant(key, params);
    this.lastValue = translation;
    return translation;
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}