import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-assistant-create-appointment-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, TranslatePipe],
  template: `
    <div class="action-preview">
      <div class="action-preview__icon" aria-hidden="true">📅</div>
      <div class="action-preview__head">
        <span class="action-preview__title">
          {{ 'assistant.preview.createAppointment.title' | translate }}
        </span>
        @if (title(); as t) {
          <span class="action-preview__subtitle">{{ t }}</span>
        }
      </div>

      <div class="action-preview__panel">
        <div class="action-preview__row">
          <span class="action-preview__row-label">
            {{ 'assistant.preview.createAppointment.when' | translate }}
          </span>
          <span class="action-preview__row-value">{{ whenLabel() }}</span>
        </div>

        @if (durationMinutes() != null) {
          <div class="action-preview__row">
            <span class="action-preview__row-label">
              {{ 'assistant.preview.createAppointment.duration' | translate }}
            </span>
            <span class="action-preview__row-value">
              {{ 'assistant.preview.createAppointment.minutes' | translate: { n: durationMinutes() } }}
            </span>
          </div>
        }

        @if (type(); as t) {
          <div class="action-preview__row">
            <span class="action-preview__row-label">
              {{ 'assistant.preview.createAppointment.serviceType' | translate }}
            </span>
            <span class="action-preview__row-value">{{ t }}</span>
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
export class CreateAppointmentPreviewComponent {
  readonly scheduledAt = input<string | undefined>();
  readonly durationMinutes = input<number | undefined>();
  readonly type = input<string | undefined>();
  readonly title = input<string | undefined>();
  readonly notes = input<string | undefined>();

  readonly whenLabel = computed(() => {
    const raw = this.scheduledAt();
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    const date = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  });
}
