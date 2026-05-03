import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

interface HelpItem {
  readonly key: string;
}

interface HelpSection {
  readonly id: 'tools' | 'skills' | 'agents';
  readonly titleKey: string;
  readonly items: HelpItem[];
}

const TOOL_KEYS: string[] = [
  'active_jobs',
  'customer_count',
  'dashboard_kpis',
  'invoices_summary',
  'revenue_summary',
  'list_appointments',
  'find_available_slot',
  'create_appointment',
  'cancel_appointment',
  'send_email',
  'send_sms',
  'propose_retention_action',
  'find_customer',
  'get_customer',
  'find_car',
  'get_car',
  'list_top_customers',
  'list_returning_customers',
  'list_at_risk_customers',
  'list_maintenance_due',
  'list_invoices',
  'list_overdue_invoices',
  'get_invoice',
  'record_payment',
  'list_low_stock_parts',
  'get_inventory_value',
  'generate_period_report',
  'generate_invoices_pdf',
];

const SKILL_KEYS: string[] = [
  'customer_360',
  'daily_briefing',
  'email_composition',
  'growth_advisor',
  'inventory_restocking',
  'invoice_collections',
  'maintenance_due_followup',
  'monthly_financial_report',
  'retention_suggestions',
];

const AGENT_KEYS: string[] = [
  'analytics_agent',
  'communications_agent',
  'growth_agent',
  'inventory_agent',
  'scheduling_agent',
  'finance_agent',
];

/**
 * In-app help / catalogue modal listing every tool, skill, and agent the
 * assistant offers, with one example prompt per item written for
 * non-technical garage owners.
 *
 * Sibling overlay (NOT projected into the panel's drawer slot) so it can
 * cover the entire viewport on mobile and stack above the assistant panel.
 * Backdrop click → close. ESC → close. Three collapsible sections with the
 * first (Tools) open by default.
 */
@Component({
  selector: 'app-assistant-help-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './assistant-help-modal.component.html',
  styleUrl: './assistant-help-modal.component.css',
})
export class AssistantHelpModalComponent {
  readonly open = input<boolean>(false);
  readonly closed = output<void>();

  /** Which section is currently expanded ('tools' by default; null = all collapsed). */
  readonly expanded = signal<'tools' | 'skills' | 'agents' | null>('tools');

  readonly sections = computed<HelpSection[]>(() => [
    {
      id: 'tools',
      titleKey: 'assistant.help.sections.tools',
      items: TOOL_KEYS.map((k) => ({ key: k })),
    },
    {
      id: 'skills',
      titleKey: 'assistant.help.sections.skills',
      items: SKILL_KEYS.map((k) => ({ key: k })),
    },
    {
      id: 'agents',
      titleKey: 'assistant.help.sections.agents',
      items: AGENT_KEYS.map((k) => ({ key: k })),
    },
  ]);

  constructor() {
    // Reset to default-open Tools section every time the modal opens.
    effect(() => {
      if (this.open()) {
        this.expanded.set('tools');
        // Defer focus to next tick so the close button is in the DOM.
        queueMicrotask(() => {
          const btn = document.querySelector<HTMLButtonElement>(
            '.assistant-help-modal__close',
          );
          btn?.focus();
        });
      }
    });
  }

  toggleSection(id: 'tools' | 'skills' | 'agents'): void {
    this.expanded.update((cur) => (cur === id ? null : id));
  }

  isExpanded(id: 'tools' | 'skills' | 'agents'): boolean {
    return this.expanded() === id;
  }

  itemNameKey(section: HelpSection['id'], key: string): string {
    return `assistant.help.${section}.${key}.name`;
  }

  itemDescKey(section: HelpSection['id'], key: string): string {
    return `assistant.help.${section}.${key}.description`;
  }

  itemExampleKey(section: HelpSection['id'], key: string): string {
    return `assistant.help.${section}.${key}.example`;
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    // Only close if click is on the backdrop itself, not bubbling from inside.
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close();
  }
}
