import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AiUsageDashboardComponent } from './ai-usage-dashboard.component';
import { AdminAiUsageService } from '../../../core/services/admin-ai-usage.service';
import { AuthService } from '../../../core/services/auth.service';
import { User, UserRole } from '../../../core/models/auth.model';
import { AdminAiUsageDashboard, AdminAiUsageRange } from '../../../core/models/admin-ai-usage.model';

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
        purpose: 'assistant_tool_selection:find_customer',
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
        purpose: 'assistant_tool_selection:find_customer',
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
    const authService = {
      getCurrentUser: jasmine.createSpy('getCurrentUser').and.returnValue(opts.currentUser ?? null),
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
    expect(component.summary().tokensIn + component.summary().tokensOut).toBe(3600);
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
    expect(component.loginError()).toBe('This dashboard is restricted to the configured owner account.');
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

  it('maps known purpose slugs to friendly copy and falls back for unknown tasks', () => {
    const fixture = setup({ currentUser: ownerUser });
    const component = fixture.componentInstance;

    expect(component.purposeLabel('assistant_tool_selection:find_customer')).toBe(
      'Find Customer tool planning',
    );
    expect(component.purposeDescription('assistant_tool_selection:find_customer')).toContain(
      'Selects Find Customer',
    );
    expect(component.purposeLabel('assistant_compose:send_email')).toBe('Send Email reply writing');
    expect(component.purposeLabel('unknown-task')).toBe('Unknown Task');
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
    expect(component.errorMessage()).toBe('Could not load AI usage analytics. Try refreshing.');
    expect(component.taskUsage().length).toBe(0);
    expect(component.userUsage().length).toBe(0);
  });
});
