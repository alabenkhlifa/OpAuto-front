import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { PublicJobApprovalSummary } from '../../core/models/maintenance.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-public-job-approval',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div class="max-w-3xl mx-auto">
        <div class="glass-card p-6">
          <h1 class="text-2xl font-bold text-white">{{ 'maintenance.publicApproval.title' | translate }}</h1>

          @if (loading()) {
            <div class="py-10 flex flex-col items-center text-center gap-3">
              <svg class="animate-spin h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0114.95 0"></path>
              </svg>
              <p class="text-slate-300">{{ 'maintenance.publicApproval.loading' | translate }}</p>
            </div>
          } @else if (error()) {
            <p class="mt-4 text-rose-300">{{ error() }}</p>
          } @else if (summary()) {
            <div class="mt-6 space-y-4">
              <div>
                <h2 class="text-lg font-semibold">{{ summary()!.jobTitle }}</h2>
                <p class="text-sm text-slate-300">{{ summary()!.licensePlate }}</p>
                <p class="text-sm text-slate-300">{{ summary()!.carDetails }}</p>
              </div>

              <div class="border border-slate-700 rounded-lg p-4 space-y-2">
                <p class="text-slate-200">{{ 'maintenance.publicApproval.requestSummary' | translate }}</p>
                <p class="text-sm text-slate-300">{{ 'maintenance.publicApproval.type' | translate }}: {{ getRequestTypeLabel(summary()!.request.type) }}</p>
                <p class="text-sm text-slate-300">{{ 'maintenance.publicApproval.status' | translate }}: {{ getStatusLabel(summary()!.status) }}</p>
                <p class="text-sm text-slate-300">{{ 'maintenance.publicApproval.jobTitle' | translate }}: {{ summary()!.jobTitle }}</p>
                <p class="text-sm text-slate-300">{{ 'maintenance.publicApproval.description' | translate }}: {{ summary()!.request.description }}</p>
                <p class="text-sm text-slate-300">{{ 'maintenance.details.estimatedPrice' | translate }}: {{ formatCurrency(summary()!.request.estimatedPrice) }}</p>
                <p class="text-sm text-slate-300">{{ 'maintenance.details.customerApproved' | translate }}: {{ summary()!.request.customerResponse || '-' }}</p>
              </div>

              @if (isAlreadyResponded()) {
                <div class="p-4 rounded-lg border border-emerald-700 bg-emerald-950 text-emerald-100">
                  {{ 'maintenance.publicApproval.alreadyResponded' | translate }}
                </div>
              } @else {
                <div class="flex flex-wrap gap-3">
                  <button class="btn-success" (click)="submitResponse('approved')" [disabled]="submitting()">
                    {{ 'maintenance.publicApproval.approveButton' | translate }}
                  </button>
                  <button class="btn-danger" (click)="openRejectForm()" [disabled]="submitting()">
                    {{ 'maintenance.publicApproval.rejectButton' | translate }}
                  </button>
                </div>

                @if (showRejectReasonInput()) {
                  <div class="border border-slate-700 rounded-lg p-3 space-y-3">
                    <label class="form-label text-sm text-slate-300">{{ 'maintenance.publicApproval.reasonLabel' | translate }}</label>
                    <textarea
                      class="form-textarea"
                      rows="3"
                      [(ngModel)]="rejectReason"
                      [placeholder]="'maintenance.publicApproval.reasonLabel' | translate"
                    ></textarea>
                    <div class="flex gap-3">
                      <button class="btn-danger" (click)="submitResponse('rejected')" [disabled]="!rejectReason.trim() || submitting()">
                        {{ 'maintenance.publicApproval.rejectButton' | translate }}
                      </button>
                      <button class="btn-secondary" (click)="cancelReject()">{{ 'maintenance.details.cancel' | translate }}</button>
                    </div>
                  </div>
                }
              }

              @if (actionMessage()) {
                <p class="text-sm" [class.text-emerald-300]="successMessage" [class.text-rose-300]="!successMessage">{{ actionMessage() }}</p>
              }

              @if (summary()!.timeline?.length) {
                <div class="border border-slate-700 rounded-lg p-4">
                  <p class="font-medium mb-2">{{ 'maintenance.details.timeline' | translate }}</p>
                  <div class="space-y-3">
                    @for (event of summary()!.timeline; track event.id) {
                      <div class="text-sm text-slate-300">
                        <p>{{ event.label || event.type }}</p>
                        <p class="text-xs text-slate-400">{{ event.occurredAt | date:'short' }}</p>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class PublicJobApprovalComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private maintenanceService = inject(MaintenanceService);
  private translationService = inject(TranslationService);

  summary = signal<PublicJobApprovalSummary | null>(null);
  loading = signal(true);
  submitting = signal(false);
  error = signal('');
  actionMessage = signal('');
  rejectReason = '';
  showRejectReasonInput = signal(false);

  isAlreadyResponded = computed(() => {
    const s = this.summary();
    return !s ? false : !!(s.alreadyResponded || s.status === 'approved' || s.status === 'rejected');
  });

  successMessage = false;

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.loading.set(false);
      this.error.set(this.translationService.instant('maintenance.publicApproval.invalidToken'));
      return;
    }

    this.loadSummary(token);
  }

  private loadSummary(token: string) {
    this.loading.set(true);
    this.error.set('');
    this.maintenanceService.getPublicApprovalSummary(token).subscribe({
      next: (nextSummary) => {
        this.summary.set(nextSummary);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.translationService.instant('maintenance.publicApproval.notFound'));
      }
    });
  }

  openRejectForm(): void {
    this.actionMessage.set('');
    this.showRejectReasonInput.set(true);
  }

  cancelReject(): void {
    this.showRejectReasonInput.set(false);
    this.rejectReason = '';
  }

  submitResponse(decision: 'approved' | 'rejected') {
    const s = this.summary();
    if (!s) return;
    if (decision === 'rejected' && !this.rejectReason.trim()) return;

    this.actionMessage.set('');
    this.successMessage = false;
    this.submitting.set(true);

    const payload = {
      decision,
      reason: decision === 'rejected' ? this.rejectReason.trim() : undefined,
    };

    this.maintenanceService.respondToPublicApproval(s.token, payload).subscribe({
      next: (nextSummary) => {
        this.summary.set(nextSummary);
        this.submitting.set(false);
        this.showRejectReasonInput.set(false);
        this.rejectReason = '';
        this.successMessage = true;
        this.actionMessage.set(
          decision === 'approved'
            ? this.getStatusLabel('approved')
            : this.getStatusLabel('rejected'),
        );
      },
      error: () => {
        this.submitting.set(false);
        this.successMessage = false;
        this.actionMessage.set(this.translationService.instant('maintenance.publicApproval.notFound'));
      },
    });
  }

  getStatusLabel(status: 'pending' | 'approved' | 'rejected'): string {
    if (status === 'approved') return this.translationService.instant('maintenance.details.approved');
    if (status === 'rejected') return this.translationService.instant('maintenance.details.rejected');
    return this.translationService.instant('maintenance.publicApproval.pending');
  }

  getRequestTypeLabel(type: PublicJobApprovalSummary['request']['type']): string {
    const requestTypeMap: Record<PublicJobApprovalSummary['request']['type'], string> = {
      'part-purchase': this.translationService.instant('maintenance.details.requestType.partPurchase'),
      'additional-work': this.translationService.instant('maintenance.details.requestType.additionalWork'),
      'cost-estimate': this.translationService.instant('maintenance.details.requestType.costEstimate'),
      'price-change': this.translationService.instant('maintenance.details.requestType.priceChange'),
      'parts-request': this.translationService.instant('maintenance.details.requestType.partsRequest'),
    };

    return requestTypeMap[type] || type;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0,
    }).format(amount);
  }
}
