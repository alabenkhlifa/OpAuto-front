import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';

import { ApiService } from './api.service';
import {
  AdminAiUsageDashboard,
  AdminAiUsageDashboardCopy,
  AdminAiUsageRange,
} from '../models/admin-ai-usage.model';

const EMPTY_COPY: AdminAiUsageDashboardCopy = {
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

@Injectable({
  providedIn: 'root',
})
export class AdminAiUsageService {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<
    AdminAiUsageRange,
    Observable<AdminAiUsageDashboard>
  >();
  private copyRequest$: Observable<AdminAiUsageDashboardCopy> | null = null;

  getCopy(): Observable<AdminAiUsageDashboardCopy> {
    if (!this.copyRequest$) {
      this.copyRequest$ = this.api
        .get<AdminAiUsageDashboardCopy>('/admin/ai-usage/copy')
        .pipe(
          map((copy) => this.normalizeCopy(copy)),
          catchError((error) => {
            this.copyRequest$ = null;
            return throwError(() => error);
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }

    return this.copyRequest$;
  }

  getUsage(range: AdminAiUsageRange): Observable<AdminAiUsageDashboard> {
    const cached = this.cache.get(range);
    if (cached) {
      return cached;
    }

    const request$ = this.api
      .get<AdminAiUsageDashboard>('/admin/ai-usage', { range })
      .pipe(
        map((payload) => this.normalizePayload(payload)),
        catchError((error) => {
          this.cache.delete(range);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.cache.set(range, request$);
    return request$;
  }

  private normalizePayload(
    payload: AdminAiUsageDashboard,
  ): AdminAiUsageDashboard {
    return {
      ...payload,
      copy: this.normalizeCopy(payload.copy),
      generatedAt: payload.generatedAt || new Date().toISOString(),
      summary: {
        llmCalls:
          payload.summary?.llmCalls ?? payload.summary?.assistantMessages ?? 0,
        assistantMessages: payload.summary?.assistantMessages ?? 0,
        ovhMessagesPriced: payload.summary?.ovhMessagesPriced ?? 0,
        ovhMessagesUnpriced: payload.summary?.ovhMessagesUnpriced ?? 0,
        toolCalls: payload.summary?.toolCalls ?? 0,
        uniqueUsers: payload.summary?.uniqueUsers ?? 0,
        tokensIn: payload.summary?.tokensIn ?? 0,
        tokensOut: payload.summary?.tokensOut ?? 0,
        tokensMissing: payload.summary?.tokensMissing ?? 0,
        estimatedCost: payload.summary?.estimatedCost ?? 0,
        rowsWithMissingPurpose: payload.summary?.rowsWithMissingPurpose ?? 0,
        rowsWithMissingModel: payload.summary?.rowsWithMissingModel ?? 0,
        failedCalls: payload.summary?.failedCalls ?? 0,
        rejectedCalls: payload.summary?.rejectedCalls ?? 0,
        mockCalls: payload.summary?.mockCalls ?? 0,
        avgLatencyMs: payload.summary?.avgLatencyMs ?? null,
        gatewayEvents:
          payload.summary?.gatewayEvents ??
          payload.summary?.assistantMessages ??
          0,
        eventsMissingContext: payload.summary?.eventsMissingContext ?? 0,
      },
      taskUsage: (payload.taskUsage ?? []).map((row) => ({
        ...row,
        purpose: row.purpose?.trim() || 'unknown',
        label: row.label ?? '',
        description: row.description ?? '',
        model: row.model?.trim() || null,
        modelLabel: row.modelLabel ?? '',
        avgLatencyMs: row.avgLatencyMs ?? null,
        failedCalls: row.failedCalls ?? 0,
      })),
      modelUsage: (payload.modelUsage ?? []).map((row) => ({
        ...row,
        provider: row.provider?.trim() || 'unknown',
        providerLabel: row.providerLabel ?? '',
        model: row.model?.trim() || null,
        modelLabel: row.modelLabel ?? '',
        avgLatencyMs: row.avgLatencyMs ?? null,
        failedCalls: row.failedCalls ?? 0,
      })),
      timeBuckets: payload.timeBuckets ?? [],
      agentUsage: (payload.agentUsage ?? []).map((row) => ({
        ...row,
        label: row.label ?? '',
        description: row.description ?? '',
      })),
      skillUsage: (payload.skillUsage ?? []).map((row) => ({
        ...row,
        label: row.label ?? '',
        description: row.description ?? '',
      })),
      userUsage: payload.userUsage ?? [],
      garageUsage: payload.garageUsage ?? [],
      toolUsage: (payload.toolUsage ?? []).map((row) => ({
        ...row,
        label: row.label ?? '',
        description: row.description ?? '',
        dominantTierLabel: row.dominantTierLabel ?? '',
        outcomeLabel: row.outcomeLabel ?? '',
      })),
      approvalRefusal: {
        totalToolCalls: payload.approvalRefusal?.totalToolCalls ?? 0,
        approvalRequired: payload.approvalRefusal?.approvalRequired ?? 0,
        approvedOrExecuted: payload.approvalRefusal?.approvedOrExecuted ?? 0,
        denied: payload.approvalRefusal?.denied ?? 0,
        expired: payload.approvalRefusal?.expired ?? 0,
        pending: payload.approvalRefusal?.pending ?? 0,
        rows: (payload.approvalRefusal?.rows ?? []).map((row) => ({
          ...row,
          label: row.label ?? '',
          approvalRequired: row.approvalRequired ?? false,
          approvalRequiredLabel: row.approvalRequiredLabel ?? '',
        })),
      },
      topExpensiveCalls: (payload.topExpensiveCalls ?? []).map((row) => ({
        ...row,
        eventId: row.eventId || '',
        purpose: row.purpose?.trim() || 'unknown',
        label: row.label ?? '',
        description: row.description ?? '',
        model: row.model?.trim() || null,
        modelLabel: row.modelLabel ?? '',
        providerLabel: row.providerLabel ?? '',
        latencyMs: row.latencyMs ?? null,
        status: row.status?.trim() || 'SUCCESS',
        statusLabel: row.statusLabel ?? '',
      })),
      sourceCoverage: payload.sourceCoverage ?? {
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

  private normalizeCopy(
    copy: AdminAiUsageDashboardCopy | null | undefined,
  ): AdminAiUsageDashboardCopy {
    if (!copy) {
      return EMPTY_COPY;
    }

    return {
      ...EMPTY_COPY,
      ...copy,
      app: { ...EMPTY_COPY.app, ...copy.app },
      login: { ...EMPTY_COPY.login, ...copy.login },
      header: { ...EMPTY_COPY.header, ...copy.header },
      rangeOptions: copy.rangeOptions ?? [],
      kpis: {
        calls: { ...EMPTY_COPY.kpis.calls, ...copy.kpis?.calls },
        spend: { ...EMPTY_COPY.kpis.spend, ...copy.kpis?.spend },
        tokens: { ...EMPTY_COPY.kpis.tokens, ...copy.kpis?.tokens },
        latency: { ...EMPTY_COPY.kpis.latency, ...copy.kpis?.latency },
      },
      sections: {
        costByTask: {
          ...EMPTY_COPY.sections.costByTask,
          ...copy.sections?.costByTask,
        },
        costShare: {
          ...EMPTY_COPY.sections.costShare,
          ...copy.sections?.costShare,
        },
        trend: { ...EMPTY_COPY.sections.trend, ...copy.sections?.trend },
        modelUsage: {
          ...EMPTY_COPY.sections.modelUsage,
          ...copy.sections?.modelUsage,
        },
        taskUsage: {
          ...EMPTY_COPY.sections.taskUsage,
          ...copy.sections?.taskUsage,
        },
        userUsage: {
          ...EMPTY_COPY.sections.userUsage,
          ...copy.sections?.userUsage,
        },
        garageUsage: {
          ...EMPTY_COPY.sections.garageUsage,
          ...copy.sections?.garageUsage,
        },
        toolHealth: {
          ...EMPTY_COPY.sections.toolHealth,
          ...copy.sections?.toolHealth,
        },
        agentUsage: {
          ...EMPTY_COPY.sections.agentUsage,
          ...copy.sections?.agentUsage,
        },
        sourceCoverage: {
          ...EMPTY_COPY.sections.sourceCoverage,
          ...copy.sections?.sourceCoverage,
        },
        approval: {
          ...EMPTY_COPY.sections.approval,
          ...copy.sections?.approval,
        },
        topCalls: {
          ...EMPTY_COPY.sections.topCalls,
          ...copy.sections?.topCalls,
        },
      },
      tableHeaders: {
        taskUsage: copy.tableHeaders?.taskUsage ?? [],
        agentUsage: copy.tableHeaders?.agentUsage ?? [],
        sourceCoverage: copy.tableHeaders?.sourceCoverage ?? [],
        approval: copy.tableHeaders?.approval ?? [],
      },
      labels: { ...EMPTY_COPY.labels, ...copy.labels },
      units: { ...EMPTY_COPY.units, ...copy.units },
      booleans: { ...EMPTY_COPY.booleans, ...copy.booleans },
      messages: { ...EMPTY_COPY.messages, ...copy.messages },
      approvalKpis: { ...EMPTY_COPY.approvalKpis, ...copy.approvalKpis },
      statuses: { ...EMPTY_COPY.statuses, ...copy.statuses },
      tiers: { ...EMPTY_COPY.tiers, ...copy.tiers },
      purposes: { ...EMPTY_COPY.purposes, ...copy.purposes },
      purposeTemplates: {
        ...EMPTY_COPY.purposeTemplates,
        ...copy.purposeTemplates,
      },
      sourceRows: { ...EMPTY_COPY.sourceRows, ...copy.sourceRows },
    };
  }
}
