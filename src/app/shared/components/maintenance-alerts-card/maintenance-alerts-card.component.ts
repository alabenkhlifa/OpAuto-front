import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AiService } from '../../../core/services/ai.service';
import { AiMaintenancePrediction } from '../../../core/models/ai.model';
import { LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

const PREDICTIONS_CACHE_PREFIX = 'opauto.maintenance_predictions.';
const PREDICTIONS_TTL_MS = 24 * 60 * 60 * 1000;

interface PredictionsCacheEntry {
  savedAt: number;
  language: string;
  predictions: AiMaintenancePrediction[];
}

@Component({
  selector: 'app-maintenance-alerts-card',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="glass-card">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold">
            {{ 'maintenance.predictions.title' | translate }}
          </h3>
          <p class="text-sm text-gray-500 mt-1">
            {{ 'maintenance.predictions.subtitle' | translate }}
          </p>
        </div>
        <button
          type="button"
          class="btn-ai"
          [disabled]="loading()"
          (click)="refresh()">
          <ng-container *ngIf="loading(); else idleBtn">
            <span class="btn-ai__spinner"></span>
            {{ 'maintenance.predictions.loading' | translate }}
          </ng-container>
          <ng-template #idleBtn>
            <svg style="width:1rem;height:1rem;flex-shrink:0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            {{ 'maintenance.predictions.refresh' | translate }}
          </ng-template>
        </button>
      </div>

      <div *ngIf="error()" class="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm mb-3">
        {{ error() }}
      </div>

      <div *ngIf="!loading() && !error() && hasRun() && visibleAlerts().length === 0"
           class="text-sm text-gray-500 py-6 text-center">
        {{ 'maintenance.predictions.none' | translate }}
      </div>

      <div *ngIf="!hasRun() && !loading()"
           class="text-sm text-gray-500 py-6 text-center">
        {{ 'maintenance.predictions.hint' | translate }}
      </div>

      <div class="space-y-3" *ngIf="visibleAlerts().length > 0">
        <div
          *ngFor="let alert of visibleAlerts()"
          class="rounded-lg p-4 border transition-colors"
          [ngClass]="rowClass(alert.urgency)">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-2">
                <span
                  class="text-xs px-2 py-0.5 rounded-full font-medium"
                  [ngClass]="badgeClass(alert.urgency)">
                  {{ ('maintenance.predictions.urgency.' + alert.urgency) | translate }}
                </span>
                <span class="font-semibold text-sm">
                  {{ ('maintenance.predictions.service.' + alert.service) | translate }}
                </span>
              </div>
              <p class="text-sm text-gray-800 leading-snug">
                {{ alert.reason }}
              </p>
              <button
                *ngIf="!carId"
                type="button"
                class="mt-2 text-xs text-blue-600 hover:text-blue-700 hover:underline truncate max-w-full text-left block"
                (click)="openCar(alert.carId)">
                {{ alert.carLabel }}
              </button>
            </div>
            <button
              type="button"
              class="btn-primary btn-sm flex-shrink-0"
              (click)="schedule(alert)">
              {{ 'maintenance.predictions.scheduleCta' | translate }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class MaintenanceAlertsCardComponent implements OnInit {
  /**
   * If set, the card runs in per-car mode: shows all urgency levels for that car,
   * no row click-through. If omitted, the card runs in fleet mode: shows only
   * medium + high urgency across the whole garage, capped at 5.
   */
  @Input() carId?: string;

  private aiService = inject(AiService);
  private router = inject(Router);
  private languageService = inject(LanguageService);

  loading = signal(false);
  hasRun = signal(false);
  error = signal<string | null>(null);
  alerts = signal<AiMaintenancePrediction[]>([]);

  visibleAlerts = computed(() => {
    const all = this.alerts();
    if (this.carId) {
      return all;
    }
    return all.filter((a) => a.urgency !== 'low').slice(0, 5);
  });

  ngOnInit(): void {
    this.restoreCachedPredictions();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);

    const lang = this.languageService.getCurrentLanguage();
    const request = this.carId
      ? { carId: this.carId, language: lang }
      : { language: lang };

    this.aiService.predictMaintenance(request).subscribe({
      next: (response) => {
        const predictions = response.predictions || [];
        this.alerts.set(predictions);
        this.loading.set(false);
        this.hasRun.set(true);
        this.savePredictions(predictions, lang);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load maintenance predictions');
        this.loading.set(false);
        this.hasRun.set(true);
      },
    });
  }

  private getCacheKey(): string {
    return `${PREDICTIONS_CACHE_PREFIX}${this.carId ?? 'fleet'}`;
  }

  private restoreCachedPredictions(): void {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(this.getCacheKey());
    if (!raw) return;

    try {
      const entry = JSON.parse(raw) as PredictionsCacheEntry;
      const fresh = Date.now() - entry.savedAt < PREDICTIONS_TTL_MS;
      const sameLang = entry.language === this.languageService.getCurrentLanguage();
      if (!fresh || !sameLang) {
        localStorage.removeItem(this.getCacheKey());
        return;
      }
      this.alerts.set(entry.predictions);
      this.hasRun.set(true);
    } catch {
      localStorage.removeItem(this.getCacheKey());
    }
  }

  private savePredictions(predictions: AiMaintenancePrediction[], language: string): void {
    if (typeof localStorage === 'undefined') return;
    const entry: PredictionsCacheEntry = { savedAt: Date.now(), language, predictions };
    try {
      localStorage.setItem(this.getCacheKey(), JSON.stringify(entry));
    } catch {
      // Ignore quota errors — predictions just won't persist this session.
    }
  }

  openCar(id: string): void {
    this.router.navigate(['/cars', id]);
  }

  schedule(alert: AiMaintenancePrediction): void {
    const scheduledDate = alert.predictedDate
      ? alert.predictedDate.split('T')[0]
      : undefined;
    this.router.navigate(['/appointments'], {
      queryParams: {
        carId: alert.carId,
        serviceType: alert.service,
        ...(scheduledDate ? { scheduledDate } : {}),
      },
    });
  }

  rowClass(urgency: 'low' | 'medium' | 'high'): string {
    switch (urgency) {
      case 'high':
        return 'bg-red-50 border-red-200 hover:border-red-300';
      case 'medium':
        return 'bg-amber-50 border-amber-200 hover:border-amber-300';
      default:
        return 'bg-gray-50 border-gray-200 hover:border-gray-300';
    }
  }

  badgeClass(urgency: 'low' | 'medium' | 'high'): string {
    switch (urgency) {
      case 'high':
        return 'bg-red-500 text-white';
      case 'medium':
        return 'bg-amber-500 text-amber-950';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  }
}
