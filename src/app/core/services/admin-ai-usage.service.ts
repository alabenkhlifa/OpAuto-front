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
  private readonly cache = new Map<AdminAiUsageRange, Observable<AdminAiUsageDashboard>>();

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

  private normalizePayload(payload: AdminAiUsageDashboard): AdminAiUsageDashboard {
    return {
      ...payload,
      generatedAt: payload.generatedAt || new Date().toISOString(),
      summary: {
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
      },
      taskUsage: (payload.taskUsage ?? []).map((row) => ({
        ...row,
        purpose: row.purpose?.trim() || 'unknown',
        model: row.model?.trim() || null,
      })),
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
        purpose: row.purpose?.trim() || 'unknown',
        model: row.model?.trim() || null,
      })),
      sourceCoverage: payload.sourceCoverage ?? {
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
