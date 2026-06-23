import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-assistant-create-invoice-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="action-preview action-preview--financial">
      <div class="action-preview__icon" aria-hidden="true">🧾</div>

      <div class="action-preview__head">
        <span class="action-preview__title">
          {{ 'assistant.preview.createInvoice.title' | translate }}
        </span>
      </div>

      <div class="action-preview__panel">
        <div class="action-preview__row">
          <span class="action-preview__row-label">
            {{ 'assistant.preview.createInvoice.total' | translate }}
          </span>
          <span class="action-preview__row-value">{{ totalLabel() }}</span>
        </div>

        @if (downloadUrl(); as downloadLink) {
          <div class="action-preview__divider"></div>
          <a
            class="action-preview__download action-preview__download-link"
            [href]="downloadLink"
            [title]="'assistant.preview.createInvoice.downloadDraftInvoice' | translate"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ 'assistant.preview.createInvoice.downloadDraftInvoice' | translate }}
          </a>
        }
      </div>
    </div>
  `,
  styleUrl: './action-preview.shared.css',
})
export class CreateInvoicePreviewComponent {
  readonly total = input<string | number | undefined>();
  readonly downloadUrl = input<string | undefined>();

  readonly totalLabel = computed(() => {
    const rawTotal = this.total();
    if (rawTotal == null || rawTotal === '') return '—';

    if (typeof rawTotal === 'number') {
      return this.formatCurrency(rawTotal);
    }

    const parsed = Number(rawTotal);
    if (Number.isFinite(parsed)) {
      return this.formatCurrency(parsed);
    }

    return rawTotal;
  });

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(amount);
  }
}
