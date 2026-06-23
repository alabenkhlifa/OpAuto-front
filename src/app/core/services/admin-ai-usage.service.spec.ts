import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { AdminAiUsageService } from './admin-ai-usage.service';
import { ApiService } from './api.service';
import {
  AdminAiUsageDashboard,
  AdminAiUsageDashboardCopy,
} from '../models/admin-ai-usage.model';

describe('AdminAiUsageService', () => {
  let service: AdminAiUsageService;
  let api: jasmine.SpyObj<ApiService>;

  const copy: AdminAiUsageDashboardCopy = {
    app: { ariaLabel: 'AI usage' },
    login: {
      ariaLabel: 'Login',
      eyebrow: 'Owner analytics',
      title: 'AI / OVH Usage Analytics',
      description: 'Usage dashboard',
      factsAriaLabel: 'Scope',
      facts: ['Gateway usage events'],
      formEyebrow: 'Standalone login',
      formTitle: 'Open dashboard',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      emailValidation: 'Enter email',
      passwordValidation: 'Enter password',
      defaultEmail: 'ala.khliifa@gmail.com',
      submitLabel: 'Sign in',
      submittingLabel: 'Signing in',
      restrictedError: 'Restricted',
      invalidCredentialsError: 'Invalid',
      sessionExpiredError: 'Expired',
    },
    header: {
      badge: 'Operations Console',
      title: 'AI / OVH Usage Analytics',
      generatedTemplate: 'Generated {generatedAt}',
      rangeLabel: 'Range',
      rangeWindowSeparator: 'to',
      scopeLabel: 'Gateway OVH account',
      refreshLabel: 'Refresh',
      loadingLabel: 'Loading',
      signOutLabel: 'Sign out',
    },
    rangeOptions: [{ value: 'today', label: 'Today' }],
    kpis: {
      calls: { label: 'Gateway AI calls', hintTemplate: '{gatewayEvents}' },
      spend: { label: 'Estimated OVH spend', hintTemplate: '{pricedCalls}' },
      tokens: { label: 'Input / output tokens', hintTemplate: '{totalTokens}' },
      latency: {
        label: 'Average completion latency',
        hintTemplate: '{failureRate}',
      },
    },
    sections: {
      costByTask: { title: 'Cost by AI Task', subtitle: '{rangeLabel}' },
      costShare: { title: 'AI Task Cost Share', subtitle: 'top tasks' },
      trend: { title: 'OVH Usage Trend', subtitle: '{rangeLabel}' },
      modelUsage: { title: 'Model Usage', subtitle: 'models' },
      taskUsage: { title: 'AI Task Usage', subtitle: 'tasks' },
      userUsage: { title: 'User Usage', subtitle: 'users' },
      garageUsage: { title: 'Garage Usage', subtitle: 'garages' },
      toolHealth: { title: 'Tool Execution Health', subtitle: 'tools' },
      agentUsage: { title: 'Agent Usage', subtitle: 'agents' },
      sourceCoverage: { title: 'Source Coverage', subtitle: '{coverage}' },
      approval: { title: 'Approval / Refusal Analytics', subtitle: 'approval' },
      topCalls: { title: 'Top Expensive AI Calls', subtitle: 'calls' },
    },
    tableHeaders: {
      taskUsage: ['AI Task'],
      agentUsage: ['Agent'],
      sourceCoverage: ['Metric'],
      approval: ['Status'],
    },
    labels: { notAvailable: 'n/a', utc: 'UTC', otherTasks: 'Other AI tasks' },
    units: { milliseconds: 'ms', seconds: 's' },
    booleans: { yes: 'Yes', no: 'No' },
    messages: {},
    approvalKpis: {},
    statuses: { FAILED: 'Failed' },
    tiers: {},
    purposes: {},
    purposeTemplates: {},
    sourceRows: {},
  };

  const payload: AdminAiUsageDashboard = {
    copy,
    generatedAt: '2026-01-01T00:00:00.000Z',
    range: {
      key: 'today',
      label: 'Today',
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-02T00:00:00.000Z',
      scope: 'gateway-ovh-account',
    },
    summary: {
      llmCalls: 3,
      assistantMessages: 3,
      ovhMessagesPriced: 3,
      ovhMessagesUnpriced: 0,
      toolCalls: 2,
      uniqueUsers: 1,
      tokensIn: 1200,
      tokensOut: 400,
      tokensMissing: 0,
      estimatedCost: 0.001184,
      rowsWithMissingPurpose: 0,
      rowsWithMissingModel: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      mockCalls: 0,
      avgLatencyMs: 220,
      gatewayEvents: 3,
      eventsMissingContext: 0,
    },
    taskUsage: [
      {
        purpose: 'assistant_tool_selection:find_customer',
        label: 'Find Customer tool planning',
        description: 'Selects Find Customer as the next assistant action.',
        model: 'Meta-Llama-3_3-70B-Instruct',
        modelLabel: 'Llama 3.3 70B',
        calls: 3,
        toolCalls: 2,
        tokensIn: 1200,
        tokensOut: 400,
        estimatedCost: 0.001184,
        unpricedCalls: 0,
        avgLatencyMs: 220,
        failedCalls: 0,
      },
    ],
    modelUsage: [
      {
        provider: 'ovh',
        providerLabel: 'OVH',
        model: 'Meta-Llama-3_3-70B-Instruct',
        modelLabel: 'Llama 3.3 70B',
        calls: 3,
        tokensIn: 1200,
        tokensOut: 400,
        estimatedCost: 0.001184,
        avgLatencyMs: 220,
        failedCalls: 0,
      },
    ],
    timeBuckets: [],
    agentUsage: [],
    skillUsage: [],
    userUsage: [],
    garageUsage: [],
    toolUsage: [],
    approvalRefusal: {
      totalToolCalls: 2,
      approvalRequired: 1,
      approvedOrExecuted: 1,
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
        gatewayEventsScanned: 3,
        assistantToolCallsScanned: 2,
        eventsWithoutModel: 0,
        eventsWithoutPurpose: 0,
        eventsWithoutTokens: 0,
        eventsWithoutContext: 0,
      },
      rows: [],
    },
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    TestBed.configureTestingModule({
      providers: [AdminAiUsageService, { provide: ApiService, useValue: api }],
    });
    service = TestBed.inject(AdminAiUsageService);
  });

  it('fetches usage for today with the expected endpoint and query', (done) => {
    api.get.and.returnValue(of(payload));

    service.getUsage('today').subscribe((data) => {
      expect(api.get).toHaveBeenCalledWith('/admin/ai-usage', {
        range: 'today',
      });
      expect(data.summary.tokensIn + data.summary.tokensOut).toBe(1600);
      expect(data.taskUsage[0].purpose).toBe(
        'assistant_tool_selection:find_customer',
      );
      expect(data.copy.header.title).toBe('AI / OVH Usage Analytics');
      expect(data.taskUsage[0].label).toBe('Find Customer tool planning');
      done();
    });
  });

  it('fetches dashboard copy from the public copy endpoint', (done) => {
    api.get.and.returnValue(of(copy));

    service.getCopy().subscribe((data) => {
      expect(api.get).toHaveBeenCalledWith('/admin/ai-usage/copy');
      expect(data.login.defaultEmail).toBe('ala.khliifa@gmail.com');
      done();
    });
  });

  it('memoizes requests by range using shareReplay cache', () => {
    api.get.and.returnValue(of(payload));

    service.getUsage('this_month').subscribe();
    service.getUsage('this_month').subscribe();

    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('does not reuse cache across ranges', () => {
    api.get.and.returnValue(of(payload));

    service.getUsage('today').subscribe();
    service.getUsage('yesterday').subscribe();

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get.calls.allArgs()).toEqual([
      ['/admin/ai-usage', { range: 'today' }],
      ['/admin/ai-usage', { range: 'yesterday' }],
    ]);
  });

  it('clears cache after backend error so retry can re-fetch', () => {
    api.get.and.returnValues(
      throwError(() => new HttpErrorResponse({ status: 500 })),
      of(payload),
    );

    service.getUsage('today').subscribe({ error: () => undefined });
    service.getUsage('today').subscribe();

    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
