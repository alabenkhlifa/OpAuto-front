import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-invoicing-templates-page',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="glass-card invoicing-templates">
      <h2 class="invoicing-templates__title">{{ 'invoicing.templates.title' | translate }}</h2>
      <p class="invoicing-templates__hint">{{ 'invoicing.templates.comingSoon' | translate }}</p>
    </div>
  `,
  styles: [
    `
      .invoicing-templates__title {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-text-primary, #111827);
        margin: 0 0 0.5rem;
      }
      .invoicing-templates__hint {
        margin: 0;
        color: var(--color-text-secondary, #4b5563);
      }
    `,
  ],
})
export class InvoicingTemplatesPageComponent {}
