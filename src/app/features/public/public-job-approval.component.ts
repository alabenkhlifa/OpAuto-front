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
    <div class="approval-page">
      <main class="approval-card">
        @if (loading()) {
          <section class="approval-state" aria-live="polite">
            <span class="approval-spinner" aria-hidden="true"></span>
            <p>{{ 'maintenance.publicApproval.loading' | translate }}</p>
          </section>
        } @else if (error()) {
          <section class="approval-alert approval-alert--error">
            {{ error() }}
          </section>
        } @else if (summary()) {
          <header class="approval-header">
            <div>
              <p class="approval-kicker">{{ 'maintenance.publicApproval.title' | translate }}</p>
              <h1>{{ summary()!.jobTitle }}</h1>
              <div class="approval-vehicle">
                @if (summary()!.licensePlate) {
                  <span>{{ summary()!.licensePlate }}</span>
                }
                @if (summary()!.carDetails) {
                  <span>{{ summary()!.carDetails }}</span>
                }
              </div>
            </div>
            <span class="approval-status" [ngClass]="statusClass(summary()!.status)">
              {{ getStatusLabel(summary()!.status) }}
            </span>
          </header>

          <section class="approval-metrics" aria-label="Approval summary">
            <div>
              <span>{{ 'maintenance.details.estimatedPrice' | translate }}</span>
              <strong>{{ formatCurrency(summary()!.request.estimatedPrice) }}</strong>
            </div>
            <div>
              <span>{{ 'maintenance.publicApproval.type' | translate }}</span>
              <strong>{{ getRequestTypeLabel(summary()!.request.type) }}</strong>
            </div>
            <div>
              <span>{{ 'maintenance.publicApproval.responseLabel' | translate }}</span>
              <strong>{{ summary()!.request.customerResponse ? getStatusLabel(summary()!.request.customerResponse!) : '-' }}</strong>
            </div>
          </section>

          <section class="approval-section">
            <div class="section-heading">
              <h2>{{ 'maintenance.publicApproval.requestSummary' | translate }}</h2>
            </div>
            <dl class="approval-details">
              <div>
                <dt>{{ 'maintenance.publicApproval.jobTitle' | translate }}</dt>
                <dd>{{ summary()!.jobTitle }}</dd>
              </div>
              <div>
                <dt>{{ 'maintenance.publicApproval.car' | translate }}</dt>
                <dd>{{ vehicleLabel() }}</dd>
              </div>
              <div>
                <dt>{{ 'maintenance.publicApproval.description' | translate }}</dt>
                <dd>{{ summary()!.request.description }}</dd>
              </div>
            </dl>
          </section>

          @if (isAlreadyResponded()) {
            <section class="approval-alert approval-alert--success">
              {{ 'maintenance.publicApproval.alreadyResponded' | translate }}
            </section>
          } @else {
            <section class="approval-actions">
              <button class="approval-button approval-button--approve" type="button" (click)="submitResponse('approved')" [disabled]="submitting()">
                {{ 'maintenance.publicApproval.approveButton' | translate }}
              </button>
              <button class="approval-button approval-button--reject" type="button" (click)="openRejectForm()" [disabled]="submitting()">
                {{ 'maintenance.publicApproval.rejectButton' | translate }}
              </button>
            </section>

            @if (showRejectReasonInput()) {
              <section class="approval-reject-form">
                <label for="rejectReason">{{ 'maintenance.publicApproval.reasonLabel' | translate }}</label>
                <textarea
                  id="rejectReason"
                  rows="4"
                  [(ngModel)]="rejectReason"
                  [placeholder]="'maintenance.publicApproval.reasonLabel' | translate"
                ></textarea>
                <div class="approval-form-actions">
                  <button class="approval-button approval-button--reject" type="button" (click)="submitResponse('rejected')" [disabled]="!rejectReason.trim() || submitting()">
                    {{ 'maintenance.publicApproval.rejectButton' | translate }}
                  </button>
                  <button class="approval-button approval-button--secondary" type="button" (click)="cancelReject()">
                    {{ 'maintenance.details.cancel' | translate }}
                  </button>
                </div>
              </section>
            }
          }

          @if (actionMessage()) {
            <p class="approval-message" [class.approval-message--success]="successMessage" [class.approval-message--error]="!successMessage">
              {{ actionMessage() }}
            </p>
          }

          @if (summary()!.timeline?.length) {
            <section class="approval-section">
              <div class="section-heading">
                <h2>{{ 'maintenance.details.timeline' | translate }}</h2>
              </div>
              <ol class="approval-timeline">
                @for (event of summary()!.timeline; track event.id) {
                  <li>
                    <span class="timeline-dot" aria-hidden="true"></span>
                    <div>
                      <p>{{ formatTimelineLabel(event.type, event.label) }}</p>
                      @if (event.description) {
                        <small>{{ event.description }}</small>
                      }
                      <time>{{ event.occurredAt | date:'medium' }}</time>
                    </div>
                  </li>
                }
              </ol>
            </section>
          }
        }
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #0f172a;
      color: #111827;
    }

    .approval-page {
      min-height: 100vh;
      padding: 32px 16px;
      background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.9)),
        #0f172a;
    }

    .approval-card {
      width: min(100%, 920px);
      margin: 0 auto;
      padding: 32px;
      background: #ffffff;
      border: 1px solid #d9e2ef;
      border-radius: 8px;
      box-shadow: 0 22px 60px rgba(2, 6, 23, 0.26);
    }

    .approval-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e5e7eb;
    }

    .approval-kicker {
      margin: 0 0 8px;
      color: #f97316;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      color: #0f172a;
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      line-height: 1.1;
      font-weight: 800;
      letter-spacing: 0;
    }

    .approval-vehicle {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
      color: #475569;
      font-size: 0.98rem;
    }

    .approval-vehicle span {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 5px 10px;
      border: 1px solid #d8dee9;
      border-radius: 8px;
      background: #f8fafc;
    }

    .approval-status {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      white-space: nowrap;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.84rem;
      font-weight: 800;
    }

    .approval-status--pending {
      color: #92400e;
      background: #fffbeb;
      border: 1px solid #facc15;
    }

    .approval-status--approved {
      color: #166534;
      background: #f0fdf4;
      border: 1px solid #86efac;
    }

    .approval-status--rejected {
      color: #991b1b;
      background: #fef2f2;
      border: 1px solid #fecaca;
    }

    .approval-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin: 24px 0;
    }

    .approval-metrics div {
      min-width: 0;
      padding: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
    }

    .approval-metrics span,
    .approval-details dt {
      display: block;
      color: #64748b;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .approval-metrics strong {
      display: block;
      margin-top: 8px;
      color: #0f172a;
      font-size: 1rem;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .approval-section,
    .approval-reject-form {
      margin-top: 20px;
      padding: 20px;
      border: 1px solid #d8dee9;
      border-radius: 8px;
      background: #ffffff;
    }

    .section-heading {
      margin-bottom: 16px;
    }

    .section-heading h2 {
      margin: 0;
      color: #111827;
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: 0;
    }

    .approval-details {
      display: grid;
      gap: 16px;
      margin: 0;
    }

    .approval-details div {
      min-width: 0;
    }

    .approval-details dd {
      margin: 6px 0 0;
      color: #1f2937;
      font-size: 1rem;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }

    .approval-actions,
    .approval-form-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 24px;
    }

    .approval-button {
      min-height: 48px;
      padding: 0 20px;
      border: 0;
      border-radius: 8px;
      color: #ffffff;
      font-size: 1rem;
      font-weight: 800;
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
    }

    .approval-button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
    }

    .approval-button:disabled {
      cursor: not-allowed;
      opacity: 0.58;
    }

    .approval-button--approve {
      background: #15803d;
    }

    .approval-button--reject {
      background: #b91c1c;
    }

    .approval-button--secondary {
      color: #334155;
      background: #e2e8f0;
    }

    .approval-reject-form label {
      display: block;
      margin-bottom: 8px;
      color: #334155;
      font-size: 0.92rem;
      font-weight: 800;
    }

    .approval-reject-form textarea {
      width: 100%;
      min-height: 112px;
      padding: 12px;
      color: #111827;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      resize: vertical;
    }

    .approval-alert,
    .approval-message {
      margin-top: 20px;
      padding: 14px 16px;
      border-radius: 8px;
      font-weight: 700;
    }

    .approval-alert--success,
    .approval-message--success {
      color: #14532d;
      background: #f0fdf4;
      border: 1px solid #86efac;
    }

    .approval-alert--error,
    .approval-message--error {
      color: #7f1d1d;
      background: #fef2f2;
      border: 1px solid #fecaca;
    }

    .approval-state {
      display: grid;
      place-items: center;
      gap: 14px;
      min-height: 260px;
      color: #334155;
      text-align: center;
    }

    .approval-spinner {
      width: 34px;
      height: 34px;
      border: 3px solid #dbeafe;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: approval-spin 800ms linear infinite;
    }

    .approval-timeline {
      display: grid;
      gap: 0;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .approval-timeline li {
      position: relative;
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      gap: 12px;
      padding: 0 0 18px;
    }

    .approval-timeline li:not(:last-child)::before {
      content: '';
      position: absolute;
      top: 18px;
      bottom: 0;
      left: 6px;
      width: 2px;
      background: #e2e8f0;
    }

    .timeline-dot {
      z-index: 1;
      width: 14px;
      height: 14px;
      margin-top: 4px;
      border: 3px solid #ffffff;
      border-radius: 50%;
      background: #f97316;
      box-shadow: 0 0 0 1px #fdba74;
    }

    .approval-timeline p {
      margin: 0;
      color: #1f2937;
      font-weight: 800;
      line-height: 1.35;
    }

    .approval-timeline small,
    .approval-timeline time {
      display: block;
      margin-top: 4px;
      color: #64748b;
      font-size: 0.9rem;
      line-height: 1.4;
    }

    @keyframes approval-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 720px) {
      .approval-page {
        padding: 16px 10px;
      }

      .approval-card {
        padding: 20px;
      }

      .approval-header {
        display: grid;
      }

      .approval-status {
        width: fit-content;
      }

      .approval-metrics {
        grid-template-columns: 1fr;
      }

      .approval-actions,
      .approval-form-actions {
        display: grid;
      }

      .approval-button {
        width: 100%;
      }
    }
  `],
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

  statusClass(status: 'pending' | 'approved' | 'rejected'): string {
    return `approval-status--${status}`;
  }

  vehicleLabel(): string {
    const s = this.summary();
    if (!s) return '-';
    return [s.licensePlate, s.carDetails].filter(Boolean).join(' - ') || '-';
  }

  formatTimelineLabel(type: string, label?: string): string {
    const raw = label || type || 'job-event';
    return raw
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
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
