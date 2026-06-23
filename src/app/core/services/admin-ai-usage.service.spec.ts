import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { AdminAiUsageService } from './admin-ai-usage.service';
import { ApiService } from './api.service';
import { AdminAiUsageDashboard } from '../models/admin-ai-usage.model';

describe('AdminAiUsageService', () => {
  let service: AdminAiUsageService;
  let api: jasmine.SpyObj<ApiService>;

  const payload: AdminAiUsageDashboard = {
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
        model: 'Meta-Llama-3_3-70B-Instruct',
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
        model: 'Meta-Llama-3_3-70B-Instruct',
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
