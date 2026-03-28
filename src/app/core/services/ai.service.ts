import { Injectable, inject, signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from './api.service';
import {
  AiError,
  AiChatRequest,
  AiChatResponse,
  AiDiagnoseRequest,
  AiDiagnoseResponse,
  AiEstimateRequest,
  AiEstimateResponse,
  AiScheduleRequest,
  AiScheduleResponse,
  AiInsightsRequest,
  AiInsightsResponse,
  AiMaintenancePredictionRequest,
  AiMaintenancePredictionResponse,
  AiChurnPredictionRequest,
  AiChurnPredictionResponse,
} from '../models/ai.model';

@Injectable({ providedIn: 'root' })
export class AiService {
  private api = inject(ApiService);

  readonly loading = signal(false);
  readonly error = signal<AiError | null>(null);

  clearError(): void {
    this.error.set(null);
  }

  private callAi<TReq, TRes>(endpoint: string, request: TReq): Observable<TRes> {
    this.loading.set(true);
    this.error.set(null);

    return this.api.post<TRes>(endpoint, request).pipe(
      catchError((err: HttpErrorResponse) => {
        let code: AiError['code'];
        if (err.status === 429) {
          code = 'RATE_LIMITED';
        } else if (err.status === 503 || err.status === 0) {
          code = 'PROVIDER_UNAVAILABLE';
        } else if (err.status === 404) {
          code = 'NOT_IMPLEMENTED';
        } else {
          code = 'UNKNOWN';
        }

        const aiError: AiError = {
          code,
          message: err.message || err.statusText,
        };

        this.error.set(aiError);
        return throwError(() => aiError);
      }),
      finalize(() => this.loading.set(false))
    );
  }

  chat(request: AiChatRequest): Observable<AiChatResponse> {
    return this.callAi<AiChatRequest, AiChatResponse>('/ai/chat', request);
  }

  diagnose(request: AiDiagnoseRequest): Observable<AiDiagnoseResponse> {
    return this.callAi<AiDiagnoseRequest, AiDiagnoseResponse>('/ai/diagnose', request);
  }

  estimate(request: AiEstimateRequest): Observable<AiEstimateResponse> {
    return this.callAi<AiEstimateRequest, AiEstimateResponse>('/ai/estimate', request);
  }

  suggestSchedule(request: AiScheduleRequest): Observable<AiScheduleResponse> {
    return this.callAi<AiScheduleRequest, AiScheduleResponse>('/ai/suggest-schedule', request);
  }

  generateInsights(request: AiInsightsRequest): Observable<AiInsightsResponse> {
    return this.callAi<AiInsightsRequest, AiInsightsResponse>('/ai/insights', request);
  }

  predictMaintenance(request: AiMaintenancePredictionRequest): Observable<AiMaintenancePredictionResponse> {
    return this.callAi<AiMaintenancePredictionRequest, AiMaintenancePredictionResponse>('/ai/predict-maintenance', request);
  }

  predictChurn(request: AiChurnPredictionRequest): Observable<AiChurnPredictionResponse> {
    return this.callAi<AiChurnPredictionRequest, AiChurnPredictionResponse>('/ai/predict-churn', request);
  }
}
