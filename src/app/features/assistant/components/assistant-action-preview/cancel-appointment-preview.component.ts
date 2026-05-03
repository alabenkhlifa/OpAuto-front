import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-assistant-cancel-appointment-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="action-preview action-preview--warning">
      <div class="action-preview__icon" aria-hidden="true">🚫</div>
      <div class="action-preview__head">
        <span class="action-preview__title">
          {{ 'assistant.preview.cancelAppointment.title' | translate }}
        </span>
        <span class="action-preview__subtitle">
          {{ 'assistant.preview.cancelAppointment.subtitle' | translate }}
        </span>
      </div>

      <div class="action-preview__panel">
        <p class="action-preview__warning-text">
          {{ 'assistant.preview.cancelAppointment.body' | translate }}
        </p>

        @if (reason(); as r) {
          <div class="action-preview__divider"></div>
          <div class="action-preview__row">
            <span class="action-preview__row-label">
              {{ 'assistant.preview.cancelAppointment.reason' | translate }}
            </span>
            <span class="action-preview__row-value">{{ r }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './action-preview.shared.css',
})
export class CancelAppointmentPreviewComponent {
  readonly appointmentId = input<string | undefined>();
  readonly reason = input<string | undefined>();
}
