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
  AdminAiUsageDashboardCopy,
  AdminAiUsageGarageMetric,
  AdminAiUsageModelMetric,
  AdminAiUsageRange,
  AdminAiUsageRangeOption,
  AdminAiUsageSourceCoverageRow,
  AdminAiUsageTaskMetric,
  AdminAiUsageTimeBucket,
  AdminAiUsageToolMetric,
  AdminAiUsageTopCall,
  AdminAiUsageUserMetric,
} from '../../../core/models/admin-ai-usage.model';

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

const SHARE_COLORS = [
  '#465fff',
  '#12b76a',
  '#f79009',
  '#7a5af8',
  '#f04438',
  '#0ba5ec',
  '#667085',
];

function createEmptyCopy(): AdminAiUsageDashboardCopy {
  return {
    app: { ariaLabel: '' },
    login: {
      ariaLabel: '',
      eyebrow: '',
      title: '',
      description: '',
      factsAriaLabel: '',
      facts: [],
      formEyebrow: '',
      formTitle: '',
      emailLabel: '',
      passwordLabel: '',
      emailValidation: '',
      passwordValidation: '',
      defaultEmail: '',
      submitLabel: '',
      submittingLabel: '',
      restrictedError: '',
      invalidCredentialsError: '',
      sessionExpiredError: '',
    },
    header: {
      badge: '',
      title: '',
      generatedTemplate: '',
      rangeLabel: '',
      rangeWindowSeparator: '',
      scopeLabel: '',
      refreshLabel: '',
      loadingLabel: '',
      signOutLabel: '',
    },
    rangeOptions: [],
    kpis: {
      calls: { label: '', hintTemplate: '' },
      spend: { label: '', hintTemplate: '' },
      tokens: { label: '', hintTemplate: '' },
      latency: { label: '', hintTemplate: '' },
    },
    sections: {
      costByTask: { title: '', subtitle: '' },
      costShare: { title: '', subtitle: '' },
      trend: { title: '', subtitle: '' },
      modelUsage: { title: '', subtitle: '' },
      taskUsage: { title: '', subtitle: '' },
      userUsage: { title: '', subtitle: '' },
      garageUsage: { title: '', subtitle: '' },
      toolHealth: { title: '', subtitle: '' },
      agentUsage: { title: '', subtitle: '' },
      sourceCoverage: { title: '', subtitle: '' },
      approval: { title: '', subtitle: '' },
      topCalls: { title: '', subtitle: '' },
    },
    tableHeaders: {
      taskUsage: [],
      agentUsage: [],
      sourceCoverage: [],
      approval: [],
    },
    labels: {},
    units: {},
    booleans: {},
    messages: {},
    approvalKpis: {},
    statuses: {},
    tiers: {},
    purposes: {},
    purposeTemplates: {},
    sourceRows: {},
  };
}

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

  readonly copy = signal<AdminAiUsageDashboardCopy>(createEmptyCopy());
  readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly selectedRange = signal<AdminAiUsageRange>('today');
  readonly isAuthenticatedOwner = signal(false);
  readonly isLoginLoading = signal(false);
  readonly loginError = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly dashboard = signal<AdminAiUsageDashboard>(
    this.createEmptyDashboard('today'),
  );

  readonly ranges = computed(() => this.copy().rangeOptions);
  readonly summary = computed(() => this.dashboard().summary);
  readonly taskUsage = computed(() =>
    [...this.dashboard().taskUsage].sort(
      (a, b) => b.estimatedCost - a.estimatedCost,
    ),
  );
  readonly userUsage = computed(() =>
    [...this.dashboard().userUsage].sort(
      (a, b) => b.estimatedCost - a.estimatedCost,
    ),
  );
  readonly garageUsage = computed(() =>
    [...this.dashboard().garageUsage].sort(
      (a, b) => b.estimatedCost - a.estimatedCost,
    ),
  );
  readonly toolUsage = computed(() =>
    [...this.dashboard().toolUsage].sort((a, b) => b.calls - a.calls),
  );
  readonly agentUsage = computed(() =>
    [...this.dashboard().agentUsage].sort(
      (a, b) => b.estimatedCost - a.estimatedCost,
    ),
  );
  readonly modelUsage = computed(() =>
    [...this.dashboard().modelUsage].sort(
      (a, b) => b.estimatedCost - a.estimatedCost,
    ),
  );
  readonly timeBuckets = computed(() => this.dashboard().timeBuckets ?? []);
  readonly sourceCoverageRows = computed(
    () => this.dashboard().sourceCoverage.rows ?? [],
  );
  readonly topExpensiveCalls = computed(() =>
    this.dashboard().topExpensiveCalls.slice(0, 8),
  );

  readonly hasUsage = computed(
    () => this.summary().llmCalls > 0 || this.summary().toolCalls > 0,
  );

  readonly kpiCards = computed<KpiCard[]>(() => {
    const copy = this.copy();
    const summary = this.summary();
    const failedShare =
      summary.llmCalls > 0
        ? ((summary.failedCalls + summary.rejectedCalls) / summary.llmCalls) *
          100
        : 0;

    return [
      {
        key: 'calls',
        label: copy.kpis.calls.label,
        value: this.formatInteger(summary.llmCalls),
        hint: this.formatTemplate(copy.kpis.calls.hintTemplate, {
          gatewayEvents: this.formatInteger(summary.gatewayEvents),
        }),
      },
      {
        key: 'spend',
        label: copy.kpis.spend.label,
        value: this.formatCost(summary.estimatedCost),
        hint: this.formatTemplate(copy.kpis.spend.hintTemplate, {
          pricedCalls: this.formatInteger(summary.ovhMessagesPriced),
          unpricedCalls: this.formatInteger(summary.ovhMessagesUnpriced),
        }),
      },
      {
        key: 'tokens',
        label: copy.kpis.tokens.label,
        value: `${this.formatCompact(summary.tokensIn)} / ${this.formatCompact(
          summary.tokensOut,
        )}`,
        hint: this.formatTemplate(copy.kpis.tokens.hintTemplate, {
          totalTokens: this.formatCompact(summary.tokensIn + summary.tokensOut),
        }),
      },
      {
        key: 'latency',
        label: copy.kpis.latency.label,
        value: this.formatDuration(summary.avgLatencyMs),
        hint: this.formatTemplate(copy.kpis.latency.hintTemplate, {
          failureRate: this.formatPercent(failedShare),
        }),
      },
    ];
  });

  readonly costShare = computed<CostShareSegment[]>(() => {
    const total = this.summary().estimatedCost;
    if (total <= 0) {
      return [];
    }

    const top = this.taskUsage()
      .slice(0, 6)
      .map((row, index) => ({
        key: `${row.purpose}:${row.model ?? 'unknown'}`,
        label: row.label,
        cost: row.estimatedCost,
        share: (row.estimatedCost / total) * 100,
        color: SHARE_COLORS[index],
      }));
    const used = top.reduce((sum, item) => sum + item.cost, 0);
    const remaining = Math.max(0, total - used);
    if (remaining > 0.000001) {
      top.push({
        key: 'other',
        label: this.copy().labels['otherTasks'] ?? '',
        cost: remaining,
        share: (remaining / total) * 100,
        color: SHARE_COLORS[6],
      });
    }
    return top;
  });

  readonly costShareGradient = computed(() => {
    const segments = this.costShare();
    if (segments.length === 0) {
      return 'conic-gradient(#eef2f6 0deg 360deg)';
    }

    let cursor = 0;
    const stops = segments.map((segment) => {
      const start = cursor;
      const end = cursor + segment.share * 3.6;
      cursor = end;
      return `${segment.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    });
    return `conic-gradient(${stops.join(', ')}, #eef2f6 ${cursor.toFixed(2)}deg 360deg)`;
  });

  readonly maxTaskCost = computed(() =>
    Math.max(0, ...this.taskUsage().map((row) => row.estimatedCost)),
  );
  readonly maxToolCalls = computed(() =>
    Math.max(0, ...this.toolUsage().map((row) => row.calls)),
  );
  readonly maxBucketCost = computed(() =>
    Math.max(0, ...this.timeBuckets().map((row) => row.estimatedCost)),
  );
  readonly generatedSummary = computed(() =>
    this.formatTemplate(this.copy().header.generatedTemplate, {
      generatedAt: this.formatGeneratedAt(this.dashboard().generatedAt),
    }),
  );
  readonly rangeWindow = computed(() => this.formatRangeWindow());
  readonly approvalRequiredShare = computed(() => {
    const total = this.summary().toolCalls;
    if (total <= 0) {
      return 0;
    }
    return (this.dashboard().approvalRefusal.approvalRequired / total) * 100;
  });
  readonly approvedExecutedShare = computed(() => {
    const total = this.summary().toolCalls;
    if (total <= 0) {
      return 0;
    }
    return (this.dashboard().approvalRefusal.approvedOrExecuted / total) * 100;
  });
  readonly costByTaskSubtitle = computed(() =>
    this.formatTemplate(this.copy().sections.costByTask.subtitle, {
      rangeLabel: this.dashboard().range.label,
      totalCost: this.formatCost(this.summary().estimatedCost),
    }),
  );
  readonly trendSubtitle = computed(() =>
    this.formatTemplate(this.copy().sections.trend.subtitle, {
      rangeLabel: this.dashboard().range.label,
    }),
  );
  readonly sourceCoverageSubtitle = computed(() => {
    const events =
      this.dashboard().sourceCoverage.rowCoverage.gatewayEventsScanned ?? 0;
    const missing =
      this.dashboard().sourceCoverage.rowCoverage.eventsWithoutContext ?? 0;
    if (events <= 0) {
      return this.copy().messages['noGatewayEvents'] ?? '';
    }
    return this.formatTemplate(this.copy().sections.sourceCoverage.subtitle, {
      coverage: this.formatPercent(((events - missing) / events) * 100),
    });
  });

  ngOnInit(): void {
    this.usageService
      .getCopy()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (copy) => {
          this.copy.set(copy);
          this.dashboard.set({
            ...this.dashboard(),
            copy,
          });
          const configuredEmail = copy.login.defaultEmail.trim();
          if (configuredEmail && !this.loginForm.controls.email.value) {
            this.loginForm.patchValue({ email: configuredEmail });
          }

          const currentUser = this.authService.getCurrentUser();
          if (this.isAllowedOwner(currentUser)) {
            this.isAuthenticatedOwner.set(true);
            this.startUsageStream();
          }
        },
      });
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
            this.loginError.set(this.copy().login.restrictedError);
            return;
          }

          this.isAuthenticatedOwner.set(true);
          this.startUsageStream();
          this.rangeTrigger.next(this.selectedRange());
        },
        error: () => {
          this.loginError.set(this.copy().login.invalidCredentialsError);
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

  statusClass(status: string): string {
    const value = status.toUpperCase();
    if (value === 'APPROVED' || value === 'EXECUTED') {
      return 'status-chip status-chip--success';
    }
    if (value === 'DENIED' || value === 'FAILED') {
      return 'status-chip status-chip--danger';
    }
    if (value === 'EXPIRED') {
      return 'status-chip status-chip--warning';
    }
    return 'status-chip';
  }

  sourceToneClass(row: AdminAiUsageSourceCoverageRow): string {
    return row.tone === 'primary'
      ? 'tier-chip tier-chip--blue'
      : row.tone === 'warn'
        ? 'tier-chip tier-chip--warning'
        : 'tier-chip';
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
      return this.copy().labels['notAvailable'] ?? '';
    }
    if (milliseconds < 1000) {
      return `${milliseconds.toFixed(0)} ${this.copy().units['milliseconds'] ?? ''}`;
    }
    return `${(milliseconds / 1000).toFixed(1)} ${this.copy().units['seconds'] ?? ''}`;
  }

  formatSeconds(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return this.copy().labels['notAvailable'] ?? '';
    }
    return `${seconds.toFixed(1)} ${this.copy().units['seconds'] ?? ''}`;
  }

  formatShortDateTime(raw: string): string {
    if (!raw) {
      return this.copy().labels['notAvailable'] ?? '';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return this.copy().labels['notAvailable'] ?? '';
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: false,
    }).format(date);
  }

  formatGeneratedAt(raw: string): string {
    if (!raw) {
      return this.copy().labels['notAvailable'] ?? '';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return this.copy().labels['notAvailable'] ?? '';
    }
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
      hour12: false,
    }).format(date);
  }

  formatUtcIsoMinute(raw: string): string {
    if (!raw) {
      return this.copy().labels['notAvailable'] ?? '';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return this.copy().labels['notAvailable'] ?? '';
    }
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }

  taskAvgMs(task: AdminAiUsageTaskMetric): string {
    return this.formatDuration(task.avgLatencyMs);
  }

  modelAvgMs(model: AdminAiUsageModelMetric): string {
    return this.formatDuration(model.avgLatencyMs);
  }

  bucketHeight(bucket: AdminAiUsageTimeBucket): string {
    return this.rowWidth(bucket.estimatedCost, this.maxBucketCost());
  }

  trackTask = (_: number, row: AdminAiUsageTaskMetric) =>
    `${row.purpose}:${row.model ?? 'unknown'}`;
  trackUser = (_: number, row: AdminAiUsageUserMetric) => row.userId;
  trackGarage = (_: number, row: AdminAiUsageGarageMetric) => row.garageId;
  trackTool = (_: number, row: AdminAiUsageToolMetric) => row.toolName;
  trackAgent = (_: number, row: AdminAiUsageAgentMetric) => row.agent;
  trackTopCall = (_: number, row: AdminAiUsageTopCall) => row.eventId;
  trackModel = (_: number, row: AdminAiUsageModelMetric) =>
    `${row.provider}:${row.model ?? 'unknown'}`;
  trackBucket = (_: number, row: AdminAiUsageTimeBucket) => row.start;
  trackShare = (_: number, row: CostShareSegment) => row.key;
  trackKpi = (_: number, row: KpiCard) => row.key;
  trackRange = (_: number, row: AdminAiUsageRangeOption) => row.value;
  trackSourceRow = (_: number, row: AdminAiUsageSourceCoverageRow) => row.key;

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
        this.copy.set(data.copy);
        this.dashboard.set(data);
        this.isLoading.set(false);
      });

    this.rangeTrigger.next(this.selectedRange());
  }

  private loadRange(range: AdminAiUsageRange) {
    return this.usageService.getUsage(range).pipe(
      map((data) => data || this.createEmptyDashboard(range)),
      catchError((error: unknown) => {
        if (
          error instanceof HttpErrorResponse &&
          (error.status === 401 || error.status === 403)
        ) {
          this.authService.forceLogout();
          this.isAuthenticatedOwner.set(false);
          this.loginError.set(this.copy().login.sessionExpiredError);
        } else if (error instanceof HttpErrorResponse && error.status === 404) {
          this.errorMessage.set(this.copy().messages['endpointUnavailable']);
        } else {
          this.errorMessage.set(this.copy().messages['analyticsLoadFailed']);
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
      (user.email ?? '').trim().toLowerCase() ===
        this.copy().login.defaultEmail.trim().toLowerCase()
    );
  }

  private formatRangeWindow(): string {
    const range = this.dashboard().range;
    if (!range.start || !range.end) {
      return this.copy().labels['notAvailable'] ?? '';
    }
    return `${this.formatUtcIsoMinute(range.start)} ${
      this.copy().header.rangeWindowSeparator
    } ${this.formatUtcIsoMinute(range.end)} ${this.copy().labels['utc'] ?? ''}`;
  }

  private formatTemplate(
    template: string,
    values: Record<string, string | number>,
  ): string {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) =>
      values[key] === undefined ? match : String(values[key]),
    );
  }

  private createEmptyDashboard(
    range: AdminAiUsageRange,
  ): AdminAiUsageDashboard {
    return {
      copy: this.copy(),
      generatedAt: '',
      range: {
        key: range,
        label: '',
        start: '',
        end: '',
        scope: 'gateway-ovh-account',
      },
      summary: {
        llmCalls: 0,
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
        failedCalls: 0,
        rejectedCalls: 0,
        mockCalls: 0,
        avgLatencyMs: null,
        gatewayEvents: 0,
        eventsMissingContext: 0,
      },
      taskUsage: [],
      modelUsage: [],
      timeBuckets: [],
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
        dataSource: 'gateway_usage_events',
        includesGatewayOnlySignals: {
          classifierCalls: true,
          conversationTitles: true,
          rawGatewayLatency: true,
        },
        rowCoverage: {
          gatewayEventsScanned: 0,
          assistantToolCallsScanned: 0,
          eventsWithoutModel: 0,
          eventsWithoutPurpose: 0,
          eventsWithoutTokens: 0,
          eventsWithoutContext: 0,
        },
        rows: [],
      },
    };
  }
}
