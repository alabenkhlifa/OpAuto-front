import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-assistant-record-payment-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="action-preview action-preview--financial">
      <div class="action-preview__icon" aria-hidden="true">💰</div>
      <div class="action-preview__head">
        <span class="action-preview__title">
          {{ 'assistant.preview.recordPayment.title' | translate }}
        </span>
        @if (invoiceLabel(); as label) {
          <span class="action-preview__subtitle">{{ label }}</span>
        }
      </div>

      <div class="action-preview__panel">
        <div class="action-preview__amount">
          {{ amountLabel() }}
        </div>

        @if (method(); as m) {
          <div class="action-preview__row">
            <span class="action-preview__row-label">
              {{ 'assistant.preview.recordPayment.method' | translate }}
            </span>
            <span class="action-preview__row-value">{{ methodLabel() }}</span>
          </div>
        }

        @if (reference(); as r) {
          <div class="action-preview__row">
            <span class="action-preview__row-label">
              {{ 'assistant.preview.recordPayment.reference' | translate }}
            </span>
            <span class="action-preview__row-value">{{ r }}</span>
          </div>
        }

        @if (notes(); as n) {
          <div class="action-preview__divider"></div>
          <p class="action-preview__notes">{{ n }}</p>
        }
      </div>
    </div>
  `,
  styleUrl: './action-preview.shared.css',
})
export class RecordPaymentPreviewComponent {
  readonly amount = input<number | undefined>();
  readonly method = input<string | undefined>();
  readonly reference = input<string | undefined>();
  readonly notes = input<string | undefined>();
  readonly invoiceNumber = input<string | undefined>();

  readonly invoiceLabel = computed(() => this.invoiceNumber() ?? '');

  readonly amountLabel = computed(() => {
    const a = this.amount();
    if (a == null) return '—';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(a);
  });

  readonly methodLabel = computed(() => {
    const m = this.method();
    if (!m) return '';
    return m
      .toLowerCase()
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  });
}
