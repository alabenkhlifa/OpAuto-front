import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AiUsageDashboardComponent } from './ai-usage-dashboard.component';
import { AdminAiUsageService } from '../../../core/services/admin-ai-usage.service';
import { AuthService } from '../../../core/services/auth.service';
import { User, UserRole } from '../../../core/models/auth.model';
import {
  AdminAiUsageDashboard,
  AdminAiUsageDashboardCopy,
  AdminAiUsageRange,
} from '../../../core/models/admin-ai-usage.model';

interface SetupOptions {
  serviceError?: boolean;
  currentUser?: User | null;
}

const ownerUser: User = {
  id: 'owner-1',
  email: 'ala.khliifa@gmail.com',
  name: 'Ala Khliifa',
  role: UserRole.OWNER,
  garageName: 'AutoTech Tunisia',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const otherOwnerUser: User = {
  ...ownerUser,
  id: 'owner-2',
  email: 'other@example.com',
};

function makeCopy(): AdminAiUsageDashboardCopy {
  return {
    app: { ariaLabel: 'AI and OVH usage analytics' },
    login: {
      ariaLabel: 'Admin AI dashboard login',
      eyebrow: 'Owner analytics',
      title: 'AI / OVH Usage Analytics',
      description: 'Usage dashboard',
      factsAriaLabel: 'Dashboard scope',
      facts: ['Gateway usage events', 'OVH account scope'],
      formEyebrow: 'Standalone login',
      formTitle: 'Open dashboard',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      emailValidation: 'Enter the configured owner email.',
      passwordValidation: 'Enter the dashboard password.',
      defaultEmail: 'ala.khliifa@gmail.com',
      submitLabel: 'Sign in',
      submittingLabel: 'Signing in...',
      restrictedError:
        'This dashboard is restricted to the configured owner account.',
      invalidCredentialsError: 'Invalid admin email or password.',
      sessionExpiredError:
        'Your admin session expired or is not allowed for this dashboard.',
    },
    header: {
      badge: 'Operations Console',
      title: 'AI / OVH Usage Analytics',
      generatedTemplate:
        'Generated {generatedAt}, gateway-level OVH usage events',
      rangeLabel: 'Range',
      rangeWindowSeparator: 'to',
      scopeLabel: 'Gateway OVH account',
      refreshLabel: 'Refresh',
      loadingLabel: 'Loading',
      signOutLabel: 'Sign out',
    },
    rangeOptions: [
      { value: 'today', label: 'Today' },
      { value: 'this_quarter', label: 'This quarter' },
    ],
    kpis: {
      calls: {
        label: 'Gateway AI calls',
        hintTemplate: '{gatewayEvents} OVH completion events recorded',
      },
      spend: {
        label: 'Estimated OVH spend',
        hintTemplate: '{pricedCalls} priced calls, {unpricedCalls} unpriced',
      },
      tokens: {
        label: 'Input / output tokens',
        hintTemplate: '{totalTokens} total tokens',
      },
      latency: {
        label: 'Average completion latency',
        hintTemplate: '{failureRate} failed or rejected provider attempts',
      },
    },
    sections: {
      costByTask: {
        title: 'Cost by AI Task',
        subtitle: '{rangeLabel}, {totalCost} total',
      },
      costShare: { title: 'AI Task Cost Share', subtitle: 'top tasks' },
      trend: { title: 'OVH Usage Trend', subtitle: '{rangeLabel} buckets' },
      modelUsage: { title: 'Model Usage', subtitle: 'gateway calls by model' },
      taskUsage: {
        title: 'AI Task Usage',
        subtitle: 'usage grouped by task and model',
      },
      userUsage: {
        title: 'User Usage',
        subtitle: 'gateway events grouped by user',
      },
      garageUsage: {
        title: 'Garage Usage',
        subtitle: 'gateway events grouped by garage',
      },
      toolHealth: {
        title: 'Tool Execution Health',
        subtitle: 'actual tool calls and outcomes',
      },
      agentUsage: {
        title: 'Agent Usage',
        subtitle: 'specialized agent calls from gateway events',
      },
      sourceCoverage: {
        title: 'Source Coverage',
        subtitle: '{coverage} attributed to user and garage',
      },
      approval: {
        title: 'Approval / Refusal Analytics',
        subtitle: 'tool calls grouped by approval outcome',
      },
      topCalls: {
        title: 'Top Expensive AI Calls',
        subtitle: 'individual gateway completion events',
      },
    },
    tableHeaders: {
      taskUsage: [
        'AI Task',
        'Model',
        'Calls',
        'Input tokens',
        'Output tokens',
        'Cost',
        'Avg ms',
      ],
      agentUsage: [
        'Agent',
        'Calls',
        'Input tokens',
        'Output tokens',
        'Tool calls',
        'Cost',
        'Avg ms',
      ],
      sourceCoverage: ['Metric', 'Rows', 'Status'],
      approval: [
        'Status',
        'Calls',
        'Share',
        'Approval-required',
        'Avg decision',
      ],
    },
    labels: {
      calls: 'calls',
      aiCalls: 'AI calls',
      tokens: 'Tokens',
      cost: 'Cost',
      latency: 'Latency',
      avgMs: 'Avg ms',
      notAvailable: 'n/a',
      utc: 'UTC',
      otherTasks: 'Other AI tasks',
    },
    units: { milliseconds: 'ms', seconds: 's' },
    booleans: { yes: 'Yes', no: 'No' },
    messages: {
      loadingAnalytics: 'Loading AI usage analytics...',
      endpointUnavailable:
        'The admin AI usage endpoint is not available on this server.',
      analyticsLoadFailed: 'Could not load AI usage analytics. Try refreshing.',
      noTaskUsage: 'No AI task usage in this range.',
      noCost: 'No cost recorded in this range.',
      noTrend: 'No usage trend in this range.',
      noModelUsage: 'No model usage in this range.',
      noUserUsage: 'No user usage in this range.',
      noGarageUsage: 'No garage usage in this range.',
      noToolUsage: 'No tool usage in this range.',
      noAgentUsage: 'No agent usage in this range.',
      noApprovalActivity: 'No approval or refusal activity in this range.',
      noTopCalls: 'No priced OVH calls in this range.',
      noGatewayEvents: 'No gateway events in range',
    },
    approvalKpis: {
      approvalRequiredShare: 'Approval-required share',
      approvedOrExecutedWrites: 'Approved/executed writes',
      deniedOrRefused: 'Denied/refused',
      expiredOrPending: 'Expired or pending',
    },
    statuses: {
      APPROVED: 'Approved',
      DENIED: 'Refused',
      FAILED: 'Failed',
    },
    tiers: {
      READ: 'Read action',
      CONFIRM_WRITE: 'Needs approval',
      UNKNOWN: 'Unknown access',
    },
    purposes: {},
    purposeTemplates: {},
    sourceRows: {},
  };
}

function makePayload(range: AdminAiUsageRange): AdminAiUsageDashboard {
  const copy = makeCopy();
  return {
    copy,
    generatedAt: '2026-01-01T12:34:56.000Z',
    range: {
      key: range,
      label: 'Today',
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-02T00:00:00.000Z',
      scope: 'gateway-ovh-account',
    },
    summary: {
      llmCalls: 14,
      assistantMessages: 14,
      ovhMessagesPriced: 14,
      ovhMessagesUnpriced: 0,
      toolCalls: 5,
      uniqueUsers: 1,
      tokensIn: 2120,
      tokensOut: 1480,
      tokensMissing: 0,
      estimatedCost: 0.002664,
      rowsWithMissingPurpose: 0,
      rowsWithMissingModel: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      mockCalls: 0,
      avgLatencyMs: 180,
      gatewayEvents: 14,
      eventsMissingContext: 0,
    },
    taskUsage: [
      {
        purpose: 'assistant_tool_selection:find_customer',
        label: 'Find Customer tool planning',
        description: 'Selects Find Customer as the next assistant action.',
        model: 'Meta-Llama-3_3-70B-Instruct',
        modelLabel: 'Llama 3.3 70B',
        calls: 10,
        toolCalls: 4,
        tokensIn: 2000,
        tokensOut: 1200,
        estimatedCost: 0.002368,
        unpricedCalls: 0,
        avgLatencyMs: 180,
        failedCalls: 0,
      },
      {
        purpose: 'unknown-task',
        label: 'Unknown Task',
        description: 'Stored AI call for Unknown Task.',
        model: 'OVH-Mistral-Small-3.2-24B-Instruct-2506',
        modelLabel: 'Mistral Small 3.2',
        calls: 4,
        toolCalls: 1,
        tokensIn: 120,
        tokensOut: 280,
        estimatedCost: 0.000012,
        unpricedCalls: 0,
        avgLatencyMs: 120,
        failedCalls: 0,
      },
    ],
    modelUsage: [
      {
        provider: 'ovh',
        providerLabel: 'OVH',
        model: 'Meta-Llama-3_3-70B-Instruct',
        modelLabel: 'Llama 3.3 70B',
        calls: 10,
        tokensIn: 2000,
        tokensOut: 1200,
        estimatedCost: 0.002368,
        avgLatencyMs: 180,
        failedCalls: 0,
      },
    ],
    timeBuckets: [
      {
        label: '12:00',
        start: '2026-01-01T12:00:00.000Z',
        end: '2026-01-01T13:00:00.000Z',
        calls: 10,
        tokensIn: 2000,
        tokensOut: 1200,
        estimatedCost: 0.002368,
        avgLatencyMs: 180,
      },
    ],
    agentUsage: [
      {
        agent: 'analytics-agent',
        label: 'Analytics agent',
        description:
          'Runs reporting and analysis requests through the LLM brain.',
        calls: 2,
        tokensIn: 500,
        tokensOut: 100,
        estimatedCost: 0.000444,
      },
    ],
    skillUsage: [
      {
        skill: 'direct_assistant',
        label: 'Direct assistant',
        description: 'Direct assistant usage',
        calls: 12,
        tokensIn: 1500,
        tokensOut: 700,
        estimatedCost: 0.001628,
      },
    ],
    userUsage: [
      {
        userId: 'user-1',
        userName: 'Ala Khliifa',
        calls: 14,
        toolCalls: 5,
        tokensIn: 2120,
        tokensOut: 1480,
        estimatedCost: 0.002664,
      },
    ],
    garageUsage: [
      {
        garageId: 'garage-1',
        garageName: 'AutoTech Tunisia',
        garageLocation: 'Tunis',
        calls: 14,
        toolCalls: 5,
        tokensIn: 2120,
        tokensOut: 1480,
        estimatedCost: 0.002664,
        uniqueUsers: 1,
      },
    ],
    toolUsage: [
      {
        toolName: 'find_customer',
        label: 'Find Customer',
        description: 'Tool invoked by the assistant.',
        dominantTierLabel: 'Read action',
        outcomeLabel: '2 approved, 1 refused, 0 failed',
        calls: 5,
        failed: 0,
        approved: 2,
        denied: 1,
        expired: 0,
        pending: 0,
        executed: 2,
        avgDurationMs: 80,
        durationSamples: 5,
        tierBreakdown: {
          READ: 3,
          AUTO_WRITE: 0,
          CONFIRM_WRITE: 2,
          TYPED_CONFIRM_WRITE: 0,
          UNKNOWN: 0,
        },
      },
    ],
    approvalRefusal: {
      totalToolCalls: 5,
      approvalRequired: 3,
      approvedOrExecuted: 4,
      denied: 1,
      expired: 0,
      pending: 0,
      rows: [
        {
          status: 'APPROVED',
          label: 'Approved',
          calls: 2,
          share: 40,
          approvalRequired: true,
          approvalRequiredLabel: 'Yes',
          avgDecisionSeconds: 6,
        },
      ],
    },
    topExpensiveCalls: [
      {
        eventId: 'ev-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        userName: 'Ala Khliifa',
        garageId: 'garage-1',
        garageName: 'AutoTech Tunisia',
        createdAt: '2026-01-01T12:00:00.000Z',
        provider: 'ovh',
        providerLabel: 'OVH',
        purpose: 'assistant_tool_selection:find_customer',
        label: 'Find Customer tool planning',
        description: 'Selects Find Customer as the next assistant action.',
        model: 'Meta-Llama-3_3-70B-Instruct',
        modelLabel: 'Llama 3.3 70B',
        tokensIn: 2000,
        tokensOut: 1200,
        estimatedCost: 0.002368,
        priced: true,
        latencyMs: 180,
        status: 'SUCCESS',
        statusLabel: 'Completed',
      },
    ],
    sourceCoverage: {
      dataSource: 'gateway_usage_events',
      includesGatewayOnlySignals: {
        classifierCalls: true,
        conversationTitles: true,
        rawGatewayLatency: true,
      },
      rowCoverage: {
        gatewayEventsScanned: 14,
        assistantToolCallsScanned: 5,
        eventsWithoutModel: 0,
        eventsWithoutPurpose: 0,
        eventsWithoutTokens: 0,
        eventsWithoutContext: 0,
      },
      rows: [
        {
          key: 'gatewayEventsScanned',
          label: 'Gateway events scanned',
          value: 14,
          statusLabel: 'Primary usage source',
          tone: 'primary',
        },
      ],
    },
  };
}

describe('AiUsageDashboardComponent', () => {
  function setup(
    opts: SetupOptions = {},
  ): ComponentFixture<AiUsageDashboardComponent> {
    const dashboardService = {
      getCopy: jasmine.createSpy('getCopy').and.returnValue(of(makeCopy())),
      getUsage: jasmine
        .createSpy('getUsage')
        .and.callFake((range: AdminAiUsageRange) => {
          if (opts.serviceError) {
            return throwError(() => new Error('backend down'));
          }
          return of(makePayload(range));
        }),
    };
    const authService = {
      getCurrentUser: jasmine
        .createSpy('getCurrentUser')
        .and.returnValue(opts.currentUser ?? null),
      login: jasmine.createSpy('login').and.returnValue(
        of({
          user: ownerUser,
          token: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
        }),
      ),
      logout: jasmine.createSpy('logout').and.returnValue(of(true)),
      forceLogout: jasmine.createSpy('forceLogout'),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AiUsageDashboardComponent],
      providers: [
        { provide: AdminAiUsageService, useValue: dashboardService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AiUsageDashboardComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the standalone login before loading dashboard data', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const svc = TestBed.inject(AdminAiUsageService) as any;

    expect(component.isAuthenticatedOwner()).toBeFalse();
    expect(svc.getCopy).toHaveBeenCalled();
    expect(svc.getUsage).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Standalone login');
  });

  it('loads dashboard data after the configured owner signs in', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const svc = TestBed.inject(AdminAiUsageService) as any;
    const auth = TestBed.inject(AuthService) as any;

    component.loginForm.patchValue({
      email: 'ala.khliifa@gmail.com',
      password: 'password123',
    });
    component.submitLogin();
    fixture.detectChanges();

    expect(auth.login).toHaveBeenCalledWith({
      emailOrUsername: 'ala.khliifa@gmail.com',
      password: 'password123',
    });
    expect(component.isAuthenticatedOwner()).toBeTrue();
    expect(svc.getUsage).toHaveBeenCalledWith('today');
    expect(component.summary().tokensIn + component.summary().tokensOut).toBe(
      3600,
    );
    expect(fixture.nativeElement.textContent).toContain('AI Task Usage');
  });

  it('rejects an authenticated owner when the email is not configured for this dashboard', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const auth = TestBed.inject(AuthService) as any;
    const svc = TestBed.inject(AdminAiUsageService) as any;

    auth.login.and.returnValue(
      of({
        user: otherOwnerUser,
        token: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      }),
    );
    component.loginForm.patchValue({
      email: 'other@example.com',
      password: 'password123',
    });
    component.submitLogin();

    expect(component.isAuthenticatedOwner()).toBeFalse();
    expect(component.loginError()).toBe(
      'This dashboard is restricted to the configured owner account.',
    );
    expect(auth.logout).toHaveBeenCalled();
    expect(svc.getUsage).not.toHaveBeenCalled();
  });

  it('loads initial dashboard data when the configured owner session already exists', () => {
    const fixture = setup({ currentUser: ownerUser });
    const component = fixture.componentInstance;
    const svc = TestBed.inject(AdminAiUsageService) as any;

    expect(component.isAuthenticatedOwner()).toBeTrue();
    expect(svc.getUsage).toHaveBeenCalledWith('today');
    expect(component.hasUsage()).toBeTrue();
    expect(component.userUsage()[0].userName).toBe('Ala Khliifa');
  });

  it('sorts AI tasks by estimated cost for display', () => {
    const fixture = setup({ currentUser: ownerUser });
    const tasks = fixture.componentInstance.taskUsage();

    expect(tasks.length).toBe(2);
    expect(tasks[0].purpose).toBe('assistant_tool_selection:find_customer');
    expect(tasks[1].purpose).toBe('unknown-task');
  });

  it('renders API-provided task labels and descriptions', () => {
    const fixture = setup({ currentUser: ownerUser });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Find Customer tool planning');
    expect(text).toContain(
      'Selects Find Customer as the next assistant action.',
    );
    expect(text).toContain('Unknown Task');
  });

  it('reloads data when a different range is selected', () => {
    const fixture = setup({ currentUser: ownerUser });
    const component = fixture.componentInstance;
    const svc = TestBed.inject(AdminAiUsageService) as any;

    svc.getUsage.calls.reset();
    component.selectRange('this_quarter');

    expect(svc.getUsage).toHaveBeenCalledOnceWith('this_quarter');
  });

  it('surfaces load errors and keeps fallback empty data', () => {
    const fixture = setup({ currentUser: ownerUser, serviceError: true });
    const component = fixture.componentInstance;

    expect(component.isLoading()).toBeFalse();
    expect(component.errorMessage()).toBe(
      'Could not load AI usage analytics. Try refreshing.',
    );
    expect(component.taskUsage().length).toBe(0);
    expect(component.userUsage().length).toBe(0);
  });
});
