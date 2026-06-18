import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { AiUsageDashboardComponent } from './ai-usage-dashboard.component';
import { AdminAiUsageService } from '../../../core/services/admin-ai-usage.service';
import { TranslationService } from '../../../core/services/translation.service';
import { AdminAiUsageDashboard, AdminAiUsageRange } from '../../../core/models/admin-ai-usage.model';

interface SetupOptions {
  serviceError?: boolean;
}

function makePayload(range: AdminAiUsageRange): AdminAiUsageDashboard {
  return {
    generatedAt: '2026-01-01T12:34:56.000Z',
    range: {
      key: range,
      label: 'Today',
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-02T00:00:00.000Z',
      scope: 'ovh-only',
    },
    summary: {
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
    },
    taskUsage: [
      {
        purpose: 'assistant_tool_selection',
        model: 'Meta-Llama-3_3-70B-Instruct',
        calls: 10,
        toolCalls: 4,
        tokensIn: 2000,
        tokensOut: 1200,
        estimatedCost: 0.002368,
        unpricedCalls: 0,
      },
      {
        purpose: 'unknown-task',
        model: 'OVH-Mistral-Small-3.2-24B-Instruct-2506',
        calls: 4,
        toolCalls: 1,
        tokensIn: 120,
        tokensOut: 280,
        estimatedCost: 0.000012,
        unpricedCalls: 0,
      },
    ],
    agentUsage: [
      {
        agent: 'analytics-agent',
        calls: 2,
        tokensIn: 500,
        tokensOut: 100,
        estimatedCost: 0.000444,
      },
    ],
    skillUsage: [
      {
        skill: 'direct_assistant',
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
          calls: 2,
          share: 40,
          avgDecisionSeconds: 6,
        },
      ],
    },
    topExpensiveCalls: [
      {
        messageId: 'msg-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        userName: 'Ala Khliifa',
        createdAt: '2026-01-01T12:00:00.000Z',
        purpose: 'assistant_tool_selection',
        model: 'Meta-Llama-3_3-70B-Instruct',
        tokensIn: 2000,
        tokensOut: 1200,
        estimatedCost: 0.002368,
        priced: true,
      },
    ],
    sourceCoverage: {
      dataSource: 'persisted_tables_only',
      includesGatewayOnlySignals: {
        classifierCalls: false,
        conversationTitles: false,
        rawGatewayLatency: false,
      },
      rowCoverage: {
        assistantMessagesScanned: 14,
        assistantToolCallsScanned: 5,
        messagesWithoutModel: 0,
        messagesWithoutPurpose: 0,
        messagesWithoutTokens: 0,
      },
    },
  };
}

describe('AiUsageDashboardComponent', () => {
  function setup(opts: SetupOptions = {}): ComponentFixture<AiUsageDashboardComponent> {
    const dashboardService = {
      getUsage: jasmine.createSpy('getUsage').and.callFake((range: AdminAiUsageRange) => {
        if (opts.serviceError) {
          return throwError(() => new Error('backend down'));
        }
        return of(makePayload(range));
      }),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AiUsageDashboardComponent],
      providers: [
        { provide: AdminAiUsageService, useValue: dashboardService },
        {
          provide: TranslationService,
          useValue: {
            instant: (key: string) => key,
            getCurrentLanguage: () => 'en',
            translations$: new BehaviorSubject({}),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AiUsageDashboardComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('loads initial dashboard data for today', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const svc = TestBed.inject(AdminAiUsageService) as any;

    expect(svc.getUsage).toHaveBeenCalledWith('today');
    expect(component.summary().tokensIn + component.summary().tokensOut).toBe(3600);
    expect(component.hasUsage()).toBeTrue();
    expect(component.userUsage()[0].userName).toBe('Ala Khliifa');
  });

  it('sorts AI tasks by estimated cost for display', () => {
    const fixture = setup();
    const tasks = fixture.componentInstance.taskUsage();

    expect(tasks.length).toBe(2);
    expect(tasks[0].purpose).toBe('assistant_tool_selection');
    expect(tasks[1].purpose).toBe('unknown-task');
  });

  it('maps known purpose slugs to friendly labels and falls back for unknown', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    expect(component.purposeLabelKey('assistant_tool_selection')).toBe(
      'adminAiUsage.purposeLabels.toolSelection',
    );
    expect(component.purposeLabelKey('unknown-task')).toBe(
      'adminAiUsage.purposeLabels.unknown',
    );
  });

  it('reloads data when a different range is selected', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const svc = TestBed.inject(AdminAiUsageService) as any;

    svc.getUsage.calls.reset();
    component.selectRange('this_quarter');

    expect(svc.getUsage).toHaveBeenCalledOnceWith('this_quarter');
  });

  it('surfaces load errors and keeps fallback empty data', () => {
    const fixture = setup({ serviceError: true });
    const component = fixture.componentInstance;

    expect(component.isLoading()).toBeFalse();
    expect(component.errorKey()).toBe('adminAiUsage.errors.loadFailed');
    expect(component.taskUsage().length).toBe(0);
    expect(component.userUsage().length).toBe(0);
  });
});
