import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, catchError, finalize, map, of, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AdminAiUsageService } from '../../../core/services/admin-ai-usage.service';
import { AuthService } from '../../../core/services/auth.service';
import { User, UserRole } from '../../../core/models/auth.model';
import {
  AdminAiUsageAgentMetric,
  AdminAiUsageDashboard,
  AdminAiUsageGarageMetric,
  AdminAiUsageRange,
  AdminAiUsageSkillMetric,
  AdminAiUsageTaskMetric,
  AdminAiUsageToolMetric,
  AdminAiUsageTopCall,
  AdminAiUsageUserMetric,
} from '../../../core/models/admin-ai-usage.model';

interface RangeOption {
  value: AdminAiUsageRange;
  label: string;
}

interface KpiCard {
  key: string;
  label: string;
  value: string;
  hint: string;
}

interface CostShareSegment {
  key: string;
  label: string;
  cost: number;
  share: number;
  color: string;
}

interface PurposeCopy {
  label: string;
  description: string;
}

const ADMIN_OWNER_EMAIL = 'ala.khliifa@gmail.com';

const PURPOSE_COPY: Record<string, PurposeCopy> = {
  assistant_tool_selection: {
    label: 'Tool selection',
    description: 'Chooses which garage tool should run before the assistant replies.',
  },
  assistant_compose: {
    label: 'Assistant response',
    description: 'Generates the final message shown to the user.',
  },
  intent_classifier: {
    label: 'Intent classification',
    description: 'Classifies the user request before routing it to the assistant flow.',
  },
  conversation_title: {
    label: 'Title generation',
    description: 'Creates short conversation titles for the chat history.',
  },
  'agent_runner:analytics-agent': {
    label: 'Analytics agent',
    description: 'Runs reporting and analysis requests through the LLM brain.',
  },
  'agent_runner:communications-agent': {
    label: 'Communications agent',
    description: 'Drafts or prepares customer communication workflows.',
  },
  'agent_runner:inventory-agent': {
    label: 'Inventory agent',
    description: 'Handles inventory-related reasoning and tool planning.',
  },
  'agent_runner:finance-agent': {
    label: 'Finance agent',
    description: 'Handles invoicing, payment, and financial reasoning tasks.',
  },
  'agent_runner:growth-agent': {
    label: 'Growth agent',
    description: 'Handles customer growth and follow-up reasoning tasks.',
  },
  'agent_runner:scheduling-agent': {
    label: 'Scheduling agent',
    description: 'Handles calendar and booking reasoning tasks.',
  },
  unknown: {
    label: 'Unlabeled AI task',
    description: 'Stored message without a recognized task label.',
  },
};

const SHARE_COLORS = ['#f97316', '#2563eb', '#16a34a', '#9333ea', '#0f766e', '#64748b'];

@Component({
  selector: 'app-ai-usage-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ai-usage-dashboard.component.html',
  styleUrl: './ai-usage-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiUsageDashboardComponent implements OnInit {
  private readonly usageService = inject(AdminAiUsageService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rangeTrigger = new Subject<AdminAiUsageRange>();
  private usageStreamStarted = false;

  readonly adminEmail = ADMIN_OWNER_EMAIL;
  readonly loginForm = this.formBuilder.group({
    email: [ADMIN_OWNER_EMAIL, [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly ranges: readonly RangeOption[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_week', label: 'Last week' },
    { value: 'this_month', label: 'This month' },
    { value: 'last_month', label: 'Last month' },
    { value: 'this_quarter', label: 'This quarter' },
    { value: 'last_quarter', label: 'Last quarter' },
    { value: 'this_year', label: 'This year' },
    { value: 'last_year', label: 'Last year' },
  ];

  readonly selectedRange = signal<AdminAiUsageRange>('today');
  readonly isAuthenticatedOwner = signal(false);
  readonly isLoginLoading = signal(false);
  readonly loginError = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly dashboard = signal<AdminAiUsageDashboard>(this.createEmptyDashboard('today'));

  readonly summary = computed(() => this.dashboard().summary);
  readonly taskUsage = computed(() =>
    [...this.dashboard().taskUsage].sort((a, b) => b.estimatedCost - a.estimatedCost),
  );
  readonly userUsage = computed(() =>
    [...this.dashboard().userUsage].sort((a, b) => b.estimatedCost - a.estimatedCost),
  );
  readonly garageUsage = computed(() =>
    [...this.dashboard().garageUsage].sort((a, b) => b.estimatedCost - a.estimatedCost),
  );
  readonly toolUsage = computed(() =>
    [...this.dashboard().toolUsage].sort((a, b) => b.calls - a.calls),
  );
  readonly agentUsage = computed(() =>
    [...this.dashboard().agentUsage].sort((a, b) => b.estimatedCost - a.estimatedCost),
  );
  readonly skillUsage = computed(() =>
    [...this.dashboard().skillUsage].sort((a, b) => b.estimatedCost - a.estimatedCost),
  );
  readonly topExpensiveCalls = computed(() => this.dashboard().topExpensiveCalls.slice(0, 8));

  readonly hasUsage = computed(
    () => this.summary().assistantMessages > 0 || this.summary().toolCalls > 0,
  );

  readonly kpiCards = computed<KpiCard[]>(() => {
    const summary = this.summary();
    return [
      {
        key: 'spend',
        label: 'AI spend',
        value: this.formatCost(summary.estimatedCost),
        hint: 'Estimated OVH cost for the selected range',
      },
      {
        key: 'calls',
        label: 'OVH calls',
        value: this.formatInteger(summary.assistantMessages),
        hint: 'Completed assistant message records',
      },
      {
        key: 'tokens',
        label: 'Input / output tokens',
        value: `${this.formatCompact(summary.tokensIn)} / ${this.formatCompact(summary.tokensOut)}`,
        hint: `${this.formatCompact(summary.tokensIn + summary.tokensOut)} total tokens`,
      },
      {
        key: 'approvals',
        label: 'Approvals requested',
        value: this.formatInteger(this.dashboard().approvalRefusal.approvalRequired),
        hint: 'Tool calls that required user confirmation',
      },
    ];
  });

  readonly costShare = computed<CostShareSegment[]>(() => {
    const total = this.summary().estimatedCost;
    if (total <= 0) {
      return [];
    }

    const top = this.taskUsage().slice(0, 5).map((row, index) => ({
      key: `${row.purpose}:${row.model ?? 'unknown'}`,
      label: this.purposeLabel(row.purpose),
      cost: row.estimatedCost,
      share: (row.estimatedCost / total) * 100,
      color: SHARE_COLORS[index],
    }));
    const used = top.reduce((sum, item) => sum + item.cost, 0);
    const remaining = Math.max(0, total - used);
    if (remaining > 0.000001) {
      top.push({
        key: 'other',
        label: 'Other AI tasks',
        cost: remaining,
        share: (remaining / total) * 100,
        color: SHARE_COLORS[5],
      });
    }
    return top;
  });

  readonly costShareGradient = computed(() => {
    const segments = this.costShare();
    if (segments.length === 0) {
      return 'conic-gradient(#e5e7eb 0deg 360deg)';
    }

    let cursor = 0;
    const stops = segments.map((segment) => {
      const start = cursor;
      const end = cursor + segment.share * 3.6;
      cursor = end;
      return `${segment.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    });
    return `conic-gradient(${stops.join(', ')}, #e5e7eb ${cursor.toFixed(2)}deg 360deg)`;
  });

  readonly maxTaskCost = computed(() =>
    Math.max(0, ...this.taskUsage().map((row) => row.estimatedCost)),
  );
  readonly maxToolCalls = computed(() =>
    Math.max(0, ...this.toolUsage().map((row) => row.calls)),
  );
  readonly updatedAt = computed(() => this.formatDateTime(this.dashboard().generatedAt));

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    if (this.isAllowedOwner(currentUser)) {
      this.isAuthenticatedOwner.set(true);
      this.startUsageStream();
    }
  }

  submitLogin(): void {
    this.loginError.set(null);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const email = (this.loginForm.value.email ?? '').trim();
    const password = this.loginForm.value.password ?? '';

    this.isLoginLoading.set(true);
    this.authService
      .login({ emailOrUsername: email, password })
      .pipe(
        finalize(() => this.isLoginLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (!this.isAllowedOwner(response.user)) {
            this.authService.logout().subscribe();
            this.isAuthenticatedOwner.set(false);
            this.loginError.set('This dashboard is restricted to the configured owner account.');
            return;
          }

          this.isAuthenticatedOwner.set(true);
          this.startUsageStream();
          this.rangeTrigger.next(this.selectedRange());
        },
        error: () => {
          this.loginError.set('Invalid admin email or password.');
        },
      });
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.isAuthenticatedOwner.set(false);
      this.dashboard.set(this.createEmptyDashboard(this.selectedRange()));
      this.loginForm.patchValue({ password: '' });
    });
  }

  selectRange(range: AdminAiUsageRange): void {
    if (this.selectedRange() === range) {
      return;
    }

    this.selectedRange.set(range);
    this.rangeTrigger.next(range);
  }

  reloadCurrentRange(): void {
    this.rangeTrigger.next(this.selectedRange());
  }

  onRangeChange(event: Event): void {
    const select = event.target as HTMLSelectElement | null;
    if (!select) {
      return;
    }

    this.selectRange(select.value as AdminAiUsageRange);
  }

  purposeLabel(purpose: string): string {
    return PURPOSE_COPY[purpose]?.label ?? this.humanizeIdentifier(purpose);
  }

  purposeDescription(purpose: string): string {
    return PURPOSE_COPY[purpose]?.description ?? `Stored AI call for ${this.humanizeIdentifier(purpose)}.`;
  }

  modelBadgeClass(model: string | null): string {
    const value = model?.toLowerCase() ?? '';
    if (value.includes('llama')) {
      return 'model-badge model-badge--llama';
    }
    if (value.includes('mistral')) {
      return 'model-badge model-badge--mistral';
    }
    return 'model-badge model-badge--unknown';
  }

  modelLabel(model: string | null): string {
    return model?.trim() || 'Unknown model';
  }

  agentLabel(agent: string): string {
    return this.humanizeIdentifier(agent.replace(/-agent$/i, ' agent'));
  }

  toolLabel(tool: string): string {
    return this.humanizeIdentifier(tool);
  }

  toolOutcomeLabel(tool: AdminAiUsageToolMetric): string {
    return `${this.formatInteger(tool.approved)} approved, ${this.formatInteger(tool.denied)} refused, ${this.formatInteger(tool.failed)} failed`;
  }

  skillLabel(skill: string): string {
    if (skill === 'direct_assistant') {
      return 'Direct assistant';
    }
    return this.humanizeIdentifier(skill);
  }

  statusLabel(status: string): string {
    const normalized = status.toUpperCase();
    const labels: Record<string, string> = {
      APPROVED: 'Approved',
      DENIED: 'Refused',
      EXPIRED: 'Expired',
      PENDING_APPROVAL: 'Waiting for approval',
      EXECUTED: 'Executed',
      FAILED: 'Failed',
    };
    return labels[normalized] ?? this.humanizeIdentifier(status);
  }

  rowWidth(value: number, max: number): string {
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
      return '0%';
    }
    return `${Math.max(4, Math.min(100, (value / max) * 100)).toFixed(2)}%`;
  }

  formatInteger(value: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
      Math.max(0, value || 0),
    );
  }

  formatCompact(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return '0';
    }

    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumSignificantDigits: 3,
      compactDisplay: 'short',
    })
      .format(Math.max(0, value))
      .replace(/K/g, 'k')
      .replace(/M/g, 'm')
      .replace(/B/g, 'b');
  }

  formatTokens(input: number, output?: number): string {
    if (typeof output === 'number') {
      return `${this.formatCompact(input)} / ${this.formatCompact(output)}`;
    }
    return this.formatCompact(input);
  }

  formatCost(value: number): string {
    const amount = Number.isFinite(value) ? Math.max(0, value) : 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: amount < 1 ? 4 : 2,
      maximumFractionDigits: amount < 1 ? 4 : 2,
    }).format(amount);
  }

  formatPercent(value: number): string {
    return `${Math.max(0, value || 0).toFixed(1)}%`;
  }

  formatDuration(milliseconds: number | null): string {
    if (milliseconds === null || !Number.isFinite(milliseconds)) {
      return '-';
    }
    if (milliseconds < 1000) {
      return `${milliseconds.toFixed(0)} ms`;
    }
    return `${(milliseconds / 1000).toFixed(1)} s`;
  }

  formatSeconds(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return '-';
    }
    return `${seconds.toFixed(1)} s`;
  }

  formatDateTime(raw: string): string {
    if (!raw) {
      return '-';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  trackTask = (_: number, row: AdminAiUsageTaskMetric) =>
    `${row.purpose}:${row.model ?? 'unknown'}`;
  trackUser = (_: number, row: AdminAiUsageUserMetric) => row.userId;
  trackGarage = (_: number, row: AdminAiUsageGarageMetric) => row.garageId;
  trackTool = (_: number, row: AdminAiUsageToolMetric) => row.toolName;
  trackAgent = (_: number, row: AdminAiUsageAgentMetric) => row.agent;
  trackSkill = (_: number, row: AdminAiUsageSkillMetric) => row.skill;
  trackTopCall = (_: number, row: AdminAiUsageTopCall) => row.messageId;
  trackShare = (_: number, row: CostShareSegment) => row.key;
  trackKpi = (_: number, row: KpiCard) => row.key;
  trackRange = (_: number, row: RangeOption) => row.value;

  private startUsageStream(): void {
    if (this.usageStreamStarted) {
      return;
    }

    this.usageStreamStarted = true;
    this.rangeTrigger
      .pipe(
        tap(() => {
          this.isLoading.set(true);
          this.errorMessage.set(null);
        }),
        switchMap((range) => this.loadRange(range)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        this.dashboard.set(data);
        this.isLoading.set(false);
      });

    this.rangeTrigger.next(this.selectedRange());
  }

  private loadRange(range: AdminAiUsageRange) {
    return this.usageService.getUsage(range).pipe(
      map((data) => data || this.createEmptyDashboard(range)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          this.authService.forceLogout();
          this.isAuthenticatedOwner.set(false);
          this.loginError.set('Your admin session expired or is not allowed for this dashboard.');
        } else if (error instanceof HttpErrorResponse && error.status === 404) {
          this.errorMessage.set('The admin AI usage endpoint is not available on this server.');
        } else {
          this.errorMessage.set('Could not load AI usage analytics. Try refreshing.');
        }
        return of(this.createEmptyDashboard(range));
      }),
      finalize(() => {
        this.isLoading.set(false);
      }),
    );
  }

  private isAllowedOwner(user: User | null): boolean {
    return (
      user?.role === UserRole.OWNER &&
      (user.email ?? '').trim().toLowerCase() === ADMIN_OWNER_EMAIL
    );
  }

  private humanizeIdentifier(value: string): string {
    const cleaned = (value || 'unknown')
      .replace(/^agent_runner:/, '')
      .replace(/[_:.-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.replace(/\b\w/g, (match) => match.toUpperCase());
  }

  private createEmptyDashboard(range: AdminAiUsageRange): AdminAiUsageDashboard {
    return {
      generatedAt: '',
      range: {
        key: range,
        label: '',
        start: '',
        end: '',
        scope: 'ovh-only',
      },
      summary: {
        assistantMessages: 0,
        ovhMessagesPriced: 0,
        ovhMessagesUnpriced: 0,
        toolCalls: 0,
        uniqueUsers: 0,
        tokensIn: 0,
        tokensOut: 0,
        tokensMissing: 0,
        estimatedCost: 0,
        rowsWithMissingPurpose: 0,
        rowsWithMissingModel: 0,
      },
      taskUsage: [],
      agentUsage: [],
      skillUsage: [],
      userUsage: [],
      garageUsage: [],
      toolUsage: [],
      approvalRefusal: {
        totalToolCalls: 0,
        approvalRequired: 0,
        approvedOrExecuted: 0,
        denied: 0,
        expired: 0,
        pending: 0,
        rows: [],
      },
      topExpensiveCalls: [],
      sourceCoverage: {
        dataSource: 'persisted_tables_only',
        includesGatewayOnlySignals: {
          classifierCalls: false,
          conversationTitles: false,
          rawGatewayLatency: false,
        },
        rowCoverage: {
          assistantMessagesScanned: 0,
          assistantToolCallsScanned: 0,
          messagesWithoutModel: 0,
          messagesWithoutPurpose: 0,
          messagesWithoutTokens: 0,
        },
      },
    };
  }
}
