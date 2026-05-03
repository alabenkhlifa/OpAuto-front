import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AssistantContextService } from '../../services/assistant-context.service';
import { AssistantPageContext } from '../../../../core/models/assistant.model';

interface EmptyChip {
  icon: string;
  labelKey: string;
  labelParams?: Record<string, string | number>;
  prompt: string;
}

interface PageChipRule {
  match: RegExp;
  chips: (ctx: AssistantPageContext) => EmptyChip[];
}

const ALWAYS_ON: EmptyChip[] = [
  {
    icon: '📅',
    labelKey: 'assistant.empty.chips.todayAppointments',
    prompt: "What's on today's schedule?",
  },
  {
    icon: '💰',
    labelKey: 'assistant.empty.chips.lastWeekRevenue',
    prompt: 'How much revenue did we make last week?',
  },
  {
    icon: '🔧',
    labelKey: 'assistant.empty.chips.carsDueService',
    prompt: 'Which cars are due for service this month?',
  },
];

const PAGE_RULES: PageChipRule[] = [
  {
    match: /^\/customers\/[^/]+/,
    chips: (ctx) => {
      const name = ctx.selectedEntity?.displayName ?? 'this customer';
      return [
        {
          icon: '🧾',
          labelKey: 'assistant.empty.chips.lastInvoicesForCustomer',
          labelParams: { name },
          prompt: `Show ${name}'s last 5 invoices`,
        },
        {
          icon: '📅',
          labelKey: 'assistant.empty.chips.bookForCustomer',
          labelParams: { name },
          prompt: `Book an appointment for ${name}`,
        },
        {
          icon: '🚗',
          labelKey: 'assistant.empty.chips.customerCarsDue',
          labelParams: { name },
          prompt: `Are any of ${name}'s cars due for service?`,
        },
      ];
    },
  },
  {
    match: /^\/appointments/,
    chips: () => [
      {
        icon: '📅',
        labelKey: 'assistant.empty.chips.todayAppointments',
        prompt: "What's on today's schedule?",
      },
      {
        icon: '🔍',
        labelKey: 'assistant.empty.chips.findFreeSlot',
        prompt: 'Find me a free 1-hour slot tomorrow morning',
      },
      {
        icon: '📊',
        labelKey: 'assistant.empty.chips.thisWeekAppointments',
        prompt: "How busy is this week?",
      },
    ],
  },
  {
    match: /^\/invoices/,
    chips: () => [
      {
        icon: '🧾',
        labelKey: 'assistant.empty.chips.overdueInvoices',
        prompt: 'Which invoices are overdue?',
      },
      {
        icon: '💰',
        labelKey: 'assistant.empty.chips.thisMonthRevenue',
        prompt: 'How was revenue this month?',
      },
      {
        icon: '📊',
        labelKey: 'assistant.empty.chips.invoicesSummary',
        prompt: 'Give me a summary of recent invoices',
      },
    ],
  },
  {
    match: /^\/inventory/,
    chips: () => [
      {
        icon: '⚠️',
        labelKey: 'assistant.empty.chips.lowStockParts',
        prompt: 'Which parts are running low?',
      },
      {
        icon: '📦',
        labelKey: 'assistant.empty.chips.inventoryValue',
        prompt: 'How much is my inventory worth?',
      },
    ],
  },
  {
    match: /^\/dashboard/,
    chips: () => [
      {
        icon: '📅',
        labelKey: 'assistant.empty.chips.todayAppointments',
        prompt: "What's on today's schedule?",
      },
      {
        icon: '💰',
        labelKey: 'assistant.empty.chips.lastWeekRevenue',
        prompt: 'How was last week?',
      },
      {
        icon: '⚠️',
        labelKey: 'assistant.empty.chips.atRiskCustomers',
        prompt: 'Show me customers we might be losing',
      },
    ],
  },
];

@Component({
  selector: 'app-assistant-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './assistant-empty-state.component.html',
  styleUrl: './assistant-empty-state.component.css',
})
export class AssistantEmptyStateComponent {
  private readonly contextService = inject(AssistantContextService);

  readonly chipPicked = output<string>();

  readonly context = computed(() => this.contextService.pageContext());

  readonly hasEntity = computed(() => !!this.context().selectedEntity?.displayName);

  readonly entityName = computed(() => this.context().selectedEntity?.displayName ?? '');

  readonly pageChips = computed<EmptyChip[]>(() => {
    const ctx = this.context();
    const route = ctx.route ?? '/';
    const rule = PAGE_RULES.find((r) => r.match.test(route));
    return rule ? rule.chips(ctx) : [];
  });

  readonly fallbackChips = computed<EmptyChip[]>(() => {
    if (this.pageChips().length > 0) return [];
    return ALWAYS_ON;
  });

  pickChip(prompt: string): void {
    this.chipPicked.emit(prompt);
  }
}
