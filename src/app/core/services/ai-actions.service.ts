import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  AiAction,
  ApproveActionRequest,
  DraftActionRequest,
  ListActionsFilters,
  RedeemActionRequest,
} from '../models/ai-action.model';

@Injectable({ providedIn: 'root' })
export class AiActionsService {
  private api = inject(ApiService);
  private base = 'ai/actions';

  draft(customerId: string): Observable<AiAction> {
    const body: DraftActionRequest = { customerId };
    return this.api.post<AiAction>(`${this.base}/draft`, body);
  }

  list(filters: ListActionsFilters = {}): Observable<AiAction[]> {
    const params: Record<string, string> = {};
    if (filters.customerId) params['customerId'] = filters.customerId;
    if (filters.status) params['status'] = filters.status;
    return this.api.get<AiAction[]>(this.base, params);
  }

  findOne(id: string): Observable<AiAction> {
    return this.api.get<AiAction>(`${this.base}/${id}`);
  }

  approve(id: string, edits: ApproveActionRequest = {}): Observable<AiAction> {
    return this.api.post<AiAction>(`${this.base}/${id}/approve`, edits);
  }

  skip(id: string): Observable<AiAction> {
    return this.api.post<AiAction>(`${this.base}/${id}/skip`, {});
  }

  redeem(id: string, req: RedeemActionRequest = {}): Observable<AiAction> {
    return this.api.post<AiAction>(`${this.base}/${id}/redeem`, req);
  }
}
