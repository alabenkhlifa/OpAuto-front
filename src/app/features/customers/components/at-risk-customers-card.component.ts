import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AiService } from '../../../core/services/ai.service';
import { AiChurnPrediction } from '../../../core/models/ai.model';
import { LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AiActionsService } from '../../../core/services/ai-actions.service';
import {
  AiAction,
  ApproveActionRequest,
  DiscountKind,
} from '../../../core/models/ai-action.model';

type DraftMode = 'idle' | 'loading' | 'editing' | 'sending' | 'sent' | 'failed';

interface DraftState {
  mode: DraftMode;
  action?: AiAction;
  error?: string;
  editMessage?: string;
  editDiscountEnabled?: boolean;
  editDiscountKind?: DiscountKind;
  editDiscountValue?: number;
  editExpiresAt?: string;
  bodyAutoPilot?: boolean;
}

@Component({
  selector: 'app-at-risk-customers-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="glass-card">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">
            {{ 'customers.atRisk.title' | translate }}
          </h3>
          <p class="text-sm text-gray-500 mt-1">
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

      <div *ngIf="!loading() && !error() && hasRun() && atRisk().length === 0" class="text-sm text-gray-500 py-6 text-center">
        {{ 'customers.atRisk.noneAtRisk' | translate }}
      </div>

      <div *ngIf="!hasRun() && !loading()" class="text-sm text-gray-500 py-6 text-center">
        {{ 'customers.atRisk.hint' | translate }}
      </div>

      <div class="space-y-3" *ngIf="atRisk().length > 0">
        <div
          *ngFor="let pred of atRisk()"
          class="rounded-lg p-4 bg-white border border-gray-200 border-l-4 shadow-sm"
          [class.border-l-red-500]="pred.riskLevel === 'high'"
          [class.border-l-yellow-500]="pred.riskLevel === 'medium'">

          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-gray-900">{{ pred.customerName }}</span>
              <span
                class="badge"
                [class.badge-overdue]="pred.riskLevel === 'high'"
                [class.badge-pending]="pred.riskLevel === 'medium'">
                {{ ('customers.atRisk.level.' + pred.riskLevel) | translate }}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-900 font-semibold">{{ (pred.churnRisk * 100).toFixed(0) }}%</span>
              <button
                type="button"
                class="btn-tertiary btn-sm"
                (click)="openCustomer(pred.customerId)">
                {{ 'customers.atRisk.viewProfile' | translate }}
              </button>
            </div>
          </div>

          <ul class="text-xs text-gray-600 space-y-0.5 mb-2">
            <li *ngFor="let f of pred.factors">• {{ f }}</li>
          </ul>

          <div class="text-sm text-blue-700 italic mb-3">
            💡 {{ pred.suggestedAction }}
          </div>

          <div class="flex items-center gap-2" *ngIf="!drafts()[pred.customerId]">
            <button
              type="button"
              class="btn-ai btn-sm"
              (click)="draftAction(pred.customerId)">
              {{ 'customers.atRisk.action.draft' | translate }}
            </button>
          </div>

          <ng-container *ngIf="drafts()[pred.customerId] as draft">
            <div class="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3" data-testid="draft-panel">

              <div *ngIf="draft.mode === 'loading'" class="text-sm text-gray-600">
                {{ 'customers.atRisk.action.drafting' | translate }}
              </div>

              <div *ngIf="draft.error" class="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                {{ draft.error }}
              </div>

              <ng-container *ngIf="draft.action as action">

                <div class="flex">
                  <span class="badge"
                    [class.badge-success]="action.customer.smsOptIn"
                    [class.badge-cancelled]="!action.customer.smsOptIn">
                    <ng-container *ngIf="action.customer.smsOptIn">
                      ✓ {{ 'customers.atRisk.action.optIn.ok' | translate }} · {{ action.customer.phone }}
                    </ng-container>
                    <ng-container *ngIf="!action.customer.smsOptIn">
                      ✕ {{ 'customers.atRisk.action.optIn.blocked' | translate }}
                    </ng-container>
                  </span>
                </div>

                <ng-container *ngIf="draft.mode === 'editing' || draft.mode === 'sending' || draft.mode === 'failed'">
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <label class="block text-sm text-gray-700 font-medium">
                        {{ 'customers.atRisk.action.smsBody' | translate }}
                      </label>
                      <button
                        *ngIf="!draft.bodyAutoPilot"
                        type="button"
                        class="text-xs text-blue-700 hover:text-blue-900 underline"
                        [disabled]="draft.mode === 'sending'"
                        (click)="resetBody(action.customerId)">
                        ↻ {{ 'customers.atRisk.action.resetBody' | translate }}
                      </button>
                    </div>
                    <textarea
                      rows="4"
                      class="form-input w-full text-sm"
                      [disabled]="draft.mode === 'sending'"
                      [ngModel]="draft.editMessage"
                      (ngModelChange)="onBodyInput(action.customerId, $event)">
                    </textarea>
                    <p *ngIf="draft.bodyAutoPilot" class="text-xs text-gray-500 mt-1">
                      {{ 'customers.atRisk.action.bodyAutoHint' | translate }}
                    </p>
                  </div>

                  <div class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      [id]="'discount-' + action.id"
                      class="h-4 w-4 accent-orange-400"
                      [disabled]="draft.mode === 'sending'"
                      [ngModel]="draft.editDiscountEnabled"
                      (ngModelChange)="patchDraft(action.customerId, { editDiscountEnabled: $event })" />
                    <label [for]="'discount-' + action.id" class="text-sm text-gray-700 cursor-pointer">
                      {{ 'customers.atRisk.action.includeDiscount' | translate }}
                    </label>
                  </div>

                  <div class="grid grid-cols-3 gap-2" *ngIf="draft.editDiscountEnabled">
                    <select
                      class="form-select text-sm"
                      [disabled]="draft.mode === 'sending'"
                      [ngModel]="draft.editDiscountKind"
                      (ngModelChange)="patchDraft(action.customerId, { editDiscountKind: $event })">
                      <option value="PERCENT">%</option>
                      <option value="AMOUNT">TND</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      class="form-input text-sm"
                      [disabled]="draft.mode === 'sending'"
                      [ngModel]="draft.editDiscountValue"
                      (ngModelChange)="patchDraft(action.customerId, { editDiscountValue: $event })" />
                    <input
                      type="date"
                      class="form-input text-sm"
                      [disabled]="draft.mode === 'sending'"
                      [ngModel]="draft.editExpiresAt"
                      (ngModelChange)="patchDraft(action.customerId, { editExpiresAt: $event })" />
                  </div>

                  <div class="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      class="btn-success btn-sm"
                      [disabled]="draft.mode === 'sending' || !action.customer.smsOptIn"
                      (click)="approve(action)">
                      <span *ngIf="draft.mode !== 'sending'">{{ 'customers.atRisk.action.approveSend' | translate }}</span>
                      <span *ngIf="draft.mode === 'sending'">{{ 'customers.atRisk.action.sending' | translate }}</span>
                    </button>
                    <button
                      type="button"
                      class="btn-tertiary btn-sm"
                      [disabled]="draft.mode === 'sending'"
                      (click)="skip(action)">
                      {{ 'customers.atRisk.action.skip' | translate }}
                    </button>
                    <button
                      type="button"
                      class="btn-tertiary btn-sm"
                      [disabled]="draft.mode === 'sending'"
                      (click)="closeDraft(action.customerId)">
                      {{ 'customers.atRisk.action.cancel' | translate }}
                    </button>
                  </div>
                </ng-container>

                <ng-container *ngIf="draft.mode === 'sent'">
                  <div class="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                    <span class="font-semibold">✓ {{ 'customers.atRisk.action.sentOk' | translate }}</span>
                    <span *ngIf="action.sentAt" class="text-emerald-700"> · {{ action.sentAt | date:'short' }}</span>
                    <span *ngIf="action.providerMessageId" class="text-emerald-600 font-mono"> · {{ action.providerMessageId }}</span>
                  </div>
                  <p class="text-xs text-gray-500">
                    {{ 'customers.atRisk.action.redeemHint' | translate }}
                  </p>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="btn-tertiary btn-sm"
                      (click)="closeDraft(action.customerId)">
                      {{ 'customers.atRisk.action.close' | translate }}
                    </button>
                  </div>
                </ng-container>

              </ng-container>
            </div>
          </ng-container>

        </div>
      </div>
    </div>
  `,
})
export class AtRiskCustomersCardComponent {
  private aiService = inject(AiService);
  private aiActionsService = inject(AiActionsService);
  private router = inject(Router);
  private languageService = inject(LanguageService);

  loading = signal(false);
  hasRun = signal(false);
  error = signal<string | null>(null);
  atRisk = signal<AiChurnPrediction[]>([]);
  drafts = signal<Record<string, DraftState>>({});

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.drafts.set({});

    const lang = this.languageService.getCurrentLanguage();

    this.aiService.predictChurn({ language: lang }).subscribe({
      next: (response) => {
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

  draftAction(customerId: string): void {
    this.setDraft(customerId, { mode: 'loading' });
    this.aiActionsService.draft(customerId).subscribe({
      next: (action) => {
        const next: DraftState = {
          mode: 'editing',
          action,
          editDiscountEnabled: action.kind === 'DISCOUNT_SMS',
          editDiscountKind: action.discountKind ?? 'PERCENT',
          editDiscountValue: action.discountValue ?? 10,
          editExpiresAt: action.expiresAt ? action.expiresAt.slice(0, 10) : this.defaultExpiry(),
          bodyAutoPilot: true,
        };
        next.editMessage = this.composeBody(action.customer.firstName, next);
        this.setDraft(customerId, next);
      },
      error: (err) => {
        this.setDraft(customerId, {
          mode: 'failed',
          error: err?.error?.message || 'Failed to draft action',
        });
      },
    });
  }

  patchDraft(customerId: string, patch: Partial<DraftState>): void {
    const cur = this.drafts()[customerId];
    if (!cur) return;
    const next: DraftState = { ...cur, ...patch };
    const discountFieldsChanged =
      'editDiscountEnabled' in patch ||
      'editDiscountKind' in patch ||
      'editDiscountValue' in patch ||
      'editExpiresAt' in patch;
    if (discountFieldsChanged && next.bodyAutoPilot && next.action) {
      next.editMessage = this.composeBody(next.action.customer.firstName, next);
    }
    this.setDraft(customerId, next);
  }

  onBodyInput(customerId: string, value: string): void {
    const cur = this.drafts()[customerId];
    if (!cur) return;
    this.setDraft(customerId, { ...cur, editMessage: value, bodyAutoPilot: false });
  }

  resetBody(customerId: string): void {
    const cur = this.drafts()[customerId];
    if (!cur || !cur.action) return;
    this.setDraft(customerId, {
      ...cur,
      bodyAutoPilot: true,
      editMessage: this.composeBody(cur.action.customer.firstName, cur),
    });
  }

  private composeBody(firstName: string, d: DraftState): string {
    const name = (firstName || '').trim();
    if (!d.editDiscountEnabled) {
      return `Bonjour ${name}, il est temps de penser à l'entretien de votre véhicule. Nous serions ravis de vous revoir à l'atelier. À bientôt !`;
    }
    const raw = d.editDiscountValue ?? 0;
    const value = Number.isFinite(Number(raw)) ? Number(raw) : 0;
    const unit = d.editDiscountKind === 'AMOUNT' ? ' TND' : '%';
    const expiryLabel = d.editExpiresAt ? this.formatExpiry(d.editExpiresAt) : '';
    const validity = expiryLabel ? ` valable jusqu'au ${expiryLabel}` : '';
    return `Bonjour ${name}, profitez de ${value}${unit} de réduction sur votre prochaine visite${validity}. Présentez ce SMS à l'atelier.`;
  }

  private formatExpiry(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }

  approve(action: AiAction): void {
    const cur = this.drafts()[action.customerId];
    if (!cur) return;

    const body: ApproveActionRequest = { messageBody: cur.editMessage };
    if (cur.editDiscountEnabled && cur.editDiscountValue != null) {
      body.discountKind = cur.editDiscountKind ?? 'PERCENT';
      body.discountValue = Number(cur.editDiscountValue);
      if (cur.editExpiresAt) {
        body.expiresAt = new Date(cur.editExpiresAt).toISOString();
      }
    }

    this.setDraft(action.customerId, { ...cur, mode: 'sending', error: undefined });

    this.aiActionsService.approve(action.id, body).subscribe({
      next: (updated) => {
        const mode: DraftMode = updated.status === 'SENT' ? 'sent' : 'failed';
        this.setDraft(action.customerId, {
          mode,
          action: updated,
          error: updated.status === 'FAILED' ? (updated.errorMessage ?? 'SMS failed') : undefined,
          editMessage: updated.messageBody,
        });
      },
      error: (err) => {
        this.setDraft(action.customerId, {
          ...cur,
          mode: 'failed',
          error: err?.error?.message || 'Failed to send SMS',
        });
      },
    });
  }

  skip(action: AiAction): void {
    this.aiActionsService.skip(action.id).subscribe({
      next: () => this.closeDraft(action.customerId),
      error: (err) => {
        const cur = this.drafts()[action.customerId];
        if (!cur) return;
        this.setDraft(action.customerId, {
          ...cur,
          error: err?.error?.message || 'Failed to skip',
        });
      },
    });
  }

  closeDraft(customerId: string): void {
    const next = { ...this.drafts() };
    delete next[customerId];
    this.drafts.set(next);
  }

  private setDraft(customerId: string, state: DraftState): void {
    this.drafts.set({ ...this.drafts(), [customerId]: state });
  }

  private defaultExpiry(): string {
    const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }
}
