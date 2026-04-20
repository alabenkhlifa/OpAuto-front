import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AiService } from '../../../core/services/ai.service';
import { AiChurnPrediction } from '../../../core/models/ai.model';
import { LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-at-risk-customers-card',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="glass-card">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold text-white">
            {{ 'customers.atRisk.title' | translate }}
          </h3>
          <p class="text-sm text-gray-400 mt-1">
            {{ 'customers.atRisk.subtitle' | translate }}
          </p>
        </div>
        <button
          type="button"
          class="btn-ai"
          [disabled]="loading()"
          (click)="refresh()">
          <ng-container *ngIf="loading(); else idleBtn">
            <span class="btn-ai__spinner"></span>
            {{ 'customers.atRisk.loading' | translate }}
          </ng-container>
          <ng-template #idleBtn>
            <svg style="width:1rem;height:1rem;flex-shrink:0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            {{ 'customers.atRisk.refresh' | translate }}
          </ng-template>
        </button>
      </div>

      <div *ngIf="error()" class="p-3 rounded bg-red-900/30 border border-red-500/40 text-red-300 text-sm mb-3">
        {{ error() }}
      </div>

      <div *ngIf="!loading() && !error() && hasRun() && atRisk().length === 0" class="text-sm text-gray-400 py-6 text-center">
        {{ 'customers.atRisk.noneAtRisk' | translate }}
      </div>

      <div *ngIf="!hasRun() && !loading()" class="text-sm text-gray-400 py-6 text-center">
        {{ 'customers.atRisk.hint' | translate }}
      </div>

      <div class="space-y-3" *ngIf="atRisk().length > 0">
        <button
          *ngFor="let pred of atRisk()"
          type="button"
          class="w-full text-left rounded-lg p-4 border border-white/10 hover:border-white/30 transition-colors"
          [class.bg-red-900]="pred.riskLevel === 'high'"
          [class.bg-opacity-20]="pred.riskLevel === 'high'"
          [class.bg-yellow-900]="pred.riskLevel === 'medium'"
          [class.bg-opacity-10]="pred.riskLevel === 'medium'"
          (click)="openCustomer(pred.customerId)">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-white">{{ pred.customerName }}</span>
              <span
                class="text-xs px-2 py-0.5 rounded-full font-medium"
                [class.bg-red-500]="pred.riskLevel === 'high'"
                [class.text-white]="pred.riskLevel === 'high'"
                [class.bg-yellow-500]="pred.riskLevel === 'medium'"
                [class.text-yellow-900]="pred.riskLevel === 'medium'">
                {{ ('customers.atRisk.level.' + pred.riskLevel) | translate }}
              </span>
            </div>
            <span class="text-sm text-gray-400">{{ (pred.churnRisk * 100).toFixed(0) }}%</span>
          </div>
          <ul class="text-xs text-gray-300 space-y-0.5 mb-2">
            <li *ngFor="let f of pred.factors">• {{ f }}</li>
          </ul>
          <div class="text-sm text-blue-300 italic">
            💡 {{ pred.suggestedAction }}
          </div>
        </button>
      </div>
    </div>
  `,
})
export class AtRiskCustomersCardComponent {
  private aiService = inject(AiService);
  private router = inject(Router);
  private languageService = inject(LanguageService);

  loading = signal(false);
  hasRun = signal(false);
  error = signal<string | null>(null);
  atRisk = signal<AiChurnPrediction[]>([]);

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);

    const lang = this.languageService.getCurrentLanguage();

    this.aiService.predictChurn({ language: lang }).subscribe({
      next: (response) => {
        // Only surface medium + high risk on the card
        const filtered = (response.predictions || [])
          .filter((p) => p.riskLevel !== 'low')
          .slice(0, 5);
        this.atRisk.set(filtered);
        this.loading.set(false);
        this.hasRun.set(true);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to load churn predictions');
        this.loading.set(false);
        this.hasRun.set(true);
      },
    });
  }

  openCustomer(id: string): void {
    this.router.navigate(['/customers', id]);
  }
}
