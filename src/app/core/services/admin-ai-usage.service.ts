import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';

import { ApiService } from './api.service';
import {
  AdminAiUsageDashboard,
  AdminAiUsageRange,
} from '../models/admin-ai-usage.model';

@Injectable({
  providedIn: 'root',
})
export class AdminAiUsageService {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<
    AdminAiUsageRange,
    Observable<AdminAiUsageDashboard>
  >();

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
        model: row.model?.trim() || null,
        avgLatencyMs: row.avgLatencyMs ?? null,
        failedCalls: row.failedCalls ?? 0,
      })),
      modelUsage: (payload.modelUsage ?? []).map((row) => ({
        ...row,
        provider: row.provider?.trim() || 'unknown',
        model: row.model?.trim() || null,
        avgLatencyMs: row.avgLatencyMs ?? null,
        failedCalls: row.failedCalls ?? 0,
      })),
      timeBuckets: payload.timeBuckets ?? [],
      agentUsage: payload.agentUsage ?? [],
      skillUsage: payload.skillUsage ?? [],
      userUsage: payload.userUsage ?? [],
      garageUsage: payload.garageUsage ?? [],
      toolUsage: payload.toolUsage ?? [],
      approvalRefusal: {
        totalToolCalls: payload.approvalRefusal?.totalToolCalls ?? 0,
        approvalRequired: payload.approvalRefusal?.approvalRequired ?? 0,
        approvedOrExecuted: payload.approvalRefusal?.approvedOrExecuted ?? 0,
        denied: payload.approvalRefusal?.denied ?? 0,
        expired: payload.approvalRefusal?.expired ?? 0,
        pending: payload.approvalRefusal?.pending ?? 0,
        rows: payload.approvalRefusal?.rows ?? [],
      },
      topExpensiveCalls: (payload.topExpensiveCalls ?? []).map((row) => ({
        ...row,
        eventId: row.eventId || '',
        purpose: row.purpose?.trim() || 'unknown',
        model: row.model?.trim() || null,
        latencyMs: row.latencyMs ?? null,
        status: row.status?.trim() || 'SUCCESS',
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
      },
    };
  }
}
