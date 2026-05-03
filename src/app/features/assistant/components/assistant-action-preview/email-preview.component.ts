import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-assistant-email-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="action-preview">
      <div class="action-preview__icon" aria-hidden="true">📧</div>
      <div class="action-preview__head">
        <span class="action-preview__title">
          {{ 'assistant.preview.email.title' | translate }}
        </span>
        <span class="action-preview__subtitle">
          {{ 'assistant.preview.email.toMe' | translate }}
        </span>
      </div>

      <div class="action-preview__panel">
        <div class="action-preview__row">
          <span class="action-preview__row-label">
            {{ 'assistant.preview.email.subject' | translate }}
          </span>
          <span class="action-preview__row-value">{{ subject() || '—' }}</span>
        </div>

        @if (preview(); as p) {
          <div class="action-preview__divider"></div>
          <p class="action-preview__email-body">{{ p }}</p>
        }

        @if (attachmentLabel(); as label) {
          <div class="action-preview__attachments">
            <span aria-hidden="true">📎</span>
            <span>{{ label }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './action-preview.shared.css',
})
export class EmailPreviewComponent {
  readonly subject = input<string | undefined>();
  readonly text = input<string | undefined>();
  readonly html = input<string | undefined>();
  readonly attachInvoiceCount = input<number>(0);
  readonly attachInvoiceFormat = input<'csv' | 'pdf' | undefined>();

  readonly preview = computed(() => {
    const t = this.text();
    if (t && t.trim().length > 0) {
      return this.truncate(t.trim(), 240);
    }
    const h = this.html();
    if (h && h.trim().length > 0) {
      const stripped = h
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return this.truncate(stripped, 240);
    }
    return '';
  });

  readonly attachmentLabel = computed(() => {
    const n = this.attachInvoiceCount();
    if (!n) return '';
    const fmt = this.attachInvoiceFormat() === 'pdf' ? 'PDF' : 'CSV';
    return `${n} invoice${n === 1 ? '' : 's'} · ${fmt}`;
  });

  private truncate(s: string, max: number): string {
    if (s.length <= max) return s;
    return `${s.slice(0, max)}…`;
  }
}
