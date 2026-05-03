import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-assistant-sms-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="action-preview">
      <div class="action-preview__icon" aria-hidden="true">📱</div>
      <div class="action-preview__head">
        <span class="action-preview__title">
          {{ 'assistant.preview.sms.title' | translate }}
        </span>
        @if (to(); as recipient) {
          <span class="action-preview__subtitle">{{ recipient }}</span>
        }
      </div>

      <div class="action-preview__bubble">
        @if (body()) {
          <p class="action-preview__bubble-body">{{ body() }}</p>
        } @else {
          <p class="action-preview__bubble-empty">
            {{ 'assistant.preview.sms.empty' | translate }}
          </p>
        }
        @if (charCount() > 0) {
          <span class="action-preview__char-count">
            {{ 'assistant.preview.sms.charCount' | translate: { count: charCount() } }}
          </span>
        }
      </div>
    </div>
  `,
  styleUrl: './action-preview.shared.css',
})
export class SmsPreviewComponent {
  readonly to = input<string | undefined>();
  readonly body = input<string | undefined>();

  readonly charCount = computed(() => (this.body() ?? '').length);
}
