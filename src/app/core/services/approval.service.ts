import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  Approval,
  ApprovalRequest,
  ApprovalAction,
  ApprovalFilter,
  ApprovalStats,
  ApprovalType,
  ApprovalStatus,
  ApprovalPriority
} from '../models/approval.model';
import { fromBackendEnum, toBackendEnum } from '../utils/enum-mapper';

@Injectable({
  providedIn: 'root'
})
export class ApprovalService {
  private http = inject(HttpClient);

  private approvalsSubject = new BehaviorSubject<Approval[]>([]);
  public approvals$ = this.approvalsSubject.asObservable();

  getApprovals(filter?: ApprovalFilter): Observable<Approval[]> {
    return this.http.get<any[]>('/approvals').pipe(
      map(items => items.map(a => this.mapFromBackend(a))),
      tap(approvals => this.approvalsSubject.next(approvals)),
      map(approvals => this.applyFilter(approvals, filter))
    );
  }

  getApprovalById(id: string): Observable<Approval | undefined> {
    return this.http.get<any>(`/approvals/${id}`).pipe(
      map(a => a ? this.mapFromBackend(a) : undefined)
    );
  }

  createApproval(request: ApprovalRequest): Observable<Approval> {
    return this.http.post<any>('/approvals', this.mapRequestToBackend(request)).pipe(
      map(a => this.mapFromBackend(a)),
      tap(newApproval => {
        const current = this.approvalsSubject.value;
        this.approvalsSubject.next([newApproval, ...current]);
      })
    );
  }

  processApproval(action: ApprovalAction): Observable<Approval> {
    const payload: any = {
      status: action.action === 'approve' ? 'APPROVED' : action.action === 'reject' ? 'REJECTED' : 'INFO_REQUESTED',
      responseNote: action.comment
    };

    return this.http.put<any>(`/approvals/${action.approvalId}/respond`, payload).pipe(
      map(a => this.mapFromBackend(a)),
      tap(updated => {
        const current = this.approvalsSubject.value;
        const index = current.findIndex(a => a.id === action.approvalId);
        if (index !== -1) {
          const updatedList = [...current];
          updatedList[index] = updated;
          this.approvalsSubject.next(updatedList);
        }
      })
    );
  }

  getApprovalStats(): Observable<ApprovalStats> {
    return this.approvals$.pipe(
      map(approvals => ({
        total: approvals.length,
        pending: approvals.filter(a => a.status === ApprovalStatus.PENDING).length,
        approved: approvals.filter(a => a.status === ApprovalStatus.APPROVED).length,
        rejected: approvals.filter(a => a.status === ApprovalStatus.REJECTED).length,
        overdue: approvals.filter(a => a.status === ApprovalStatus.PENDING && a.dueDate && new Date() > a.dueDate).length,
        byPriority: {
          low: approvals.filter(a => a.priority === ApprovalPriority.LOW).length,
          medium: approvals.filter(a => a.priority === ApprovalPriority.MEDIUM).length,
          high: approvals.filter(a => a.priority === ApprovalPriority.HIGH).length,
          urgent: approvals.filter(a => a.priority === ApprovalPriority.URGENT).length
        },
        byType: {
          maintenance: approvals.filter(a => a.type === ApprovalType.MAINTENANCE).length,
          invoice: approvals.filter(a => a.type === ApprovalType.INVOICE).length,
          purchaseOrder: approvals.filter(a => a.type === ApprovalType.PURCHASE_ORDER).length,
          discount: approvals.filter(a => a.type === ApprovalType.DISCOUNT).length
        },
        avgResponseTime: 0
      }))
    );
  }

  getPendingApprovals(): Observable<Approval[]> {
    return this.getApprovals({ status: [ApprovalStatus.PENDING, ApprovalStatus.INFO_REQUESTED] });
  }

  getOverdueApprovals(): Observable<Approval[]> {
    return this.approvals$.pipe(
      map(approvals => approvals.filter(a =>
        a.status === ApprovalStatus.PENDING && a.dueDate && new Date() > a.dueDate
      ))
    );
  }

  addComment(approvalId: string, content: string, isInternal: boolean = true): Observable<Approval> {
    return this.http.post<any>(`/approvals/${approvalId}/comments`, { content, isInternal }).pipe(
      map(a => this.mapFromBackend(a)),
      tap(updated => {
        const current = this.approvalsSubject.value;
        const index = current.findIndex(a => a.id === approvalId);
        if (index !== -1) {
          const updatedList = [...current];
          updatedList[index] = updated;
          this.approvalsSubject.next(updatedList);
        }
      })
    );
  }

  deleteApproval(id: string): Observable<boolean> {
    return this.http.delete<void>(`/approvals/${id}`).pipe(
      map(() => {
        const filtered = this.approvalsSubject.value.filter(a => a.id !== id);
        this.approvalsSubject.next(filtered);
        return true;
      })
    );
  }

  bulkAction(approvalIds: string[], action: 'approve' | 'reject' | 'delete'): Observable<boolean> {
    // Sequential calls to single endpoint (no bulk API)
    const current = this.approvalsSubject.value;
    let updated = [...current];
    const now = new Date();

    approvalIds.forEach(id => {
      const index = updated.findIndex(a => a.id === id);
      if (index !== -1) {
        if (action === 'delete') {
          updated = updated.filter(a => a.id !== id);
        } else {
          const approval = { ...updated[index] };
          if (action === 'approve') {
            approval.status = ApprovalStatus.APPROVED;
            approval.approvedBy = { id: 'current-user', name: 'Current User' };
            approval.approvedAt = now;
          } else if (action === 'reject') {
            approval.status = ApprovalStatus.REJECTED;
            approval.rejectedBy = { id: 'current-user', name: 'Current User' };
            approval.rejectedAt = now;
          }
          approval.updatedAt = now;
          updated[index] = approval;
        }
      }
    });

    this.approvalsSubject.next(updated);

    // Fire HTTP calls for each
    approvalIds.forEach(id => {
      if (action === 'delete') {
        this.http.delete(`/approvals/${id}`).subscribe();
      } else {
        const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
        this.http.put(`/approvals/${id}/respond`, { status }).subscribe();
      }
    });

    return of(true);
  }

  private mapFromBackend(b: any): Approval {
    // Backend stores requestedBy/respondedBy as raw user-id strings and
    // attaches requesterName/responderName via a batched lookup. We reshape
    // those into the {id, name, role} objects the UI expects, and route
    // respondedBy/respondedAt into approvedBy/approvedAt or rejectedBy/
    // rejectedAt based on status.
    const status = this.mapStatus(b.status);
    const requester = typeof b.requestedBy === 'string'
      ? { id: b.requestedBy, name: b.requesterName || 'Unknown', role: '' }
      : (b.requestedBy || { id: '', name: 'Unknown', role: '' });
    const responder = b.respondedBy
      ? { id: b.respondedBy, name: b.responderName || 'Unknown', role: '' }
      : undefined;
    const respondedAt = b.respondedAt ? new Date(b.respondedAt) : undefined;

    return {
      id: b.id,
      type: this.mapType(b.type),
      title: b.title || '',
      description: b.description || '',
      requestedBy: requester,
      requestedAt: new Date(b.requestedAt || b.createdAt),
      priority: this.mapPriority(b.priority),
      status,
      estimatedCost: b.estimatedCost || b.amount || 0,
      currency: b.currency || 'TND',
      relatedEntity: b.relatedEntity,
      dueDate: b.dueDate ? new Date(b.dueDate) : undefined,
      approvedBy: status === 'approved' ? responder : undefined,
      approvedAt: status === 'approved' ? respondedAt : undefined,
      rejectedBy: status === 'rejected' ? responder : undefined,
      rejectedAt: status === 'rejected' ? respondedAt : undefined,
      createdAt: new Date(b.createdAt),
      updatedAt: new Date(b.updatedAt),
      comments: b.comments || []
    };
  }

  private mapRequestToBackend(request: ApprovalRequest): any {
    return {
      type: toBackendEnum(request.type),
      title: request.title,
      description: request.description,
      priority: toBackendEnum(request.priority),
      estimatedCost: request.estimatedCost,
      currency: request.currency,
      relatedEntityType: request.relatedEntityType,
      relatedEntityId: request.relatedEntityId,
      dueDate: request.dueDate?.toISOString()
    };
  }

  private mapType(type: string): ApprovalType {
    const upper = (type || '').toUpperCase();
    if (upper === 'INVOICE') return ApprovalType.INVOICE;
    if (upper === 'PURCHASE_ORDER') return ApprovalType.PURCHASE_ORDER;
    if (upper === 'DISCOUNT') return ApprovalType.DISCOUNT;
    return ApprovalType.MAINTENANCE;
  }

  private mapStatus(status: string): ApprovalStatus {
    const upper = (status || '').toUpperCase();
    if (upper === 'APPROVED') return ApprovalStatus.APPROVED;
    if (upper === 'REJECTED') return ApprovalStatus.REJECTED;
    if (upper === 'INFO_REQUESTED') return ApprovalStatus.INFO_REQUESTED;
    return ApprovalStatus.PENDING;
  }

  private mapPriority(priority: string): ApprovalPriority {
    const upper = (priority || '').toUpperCase();
    if (upper === 'LOW') return ApprovalPriority.LOW;
    if (upper === 'HIGH') return ApprovalPriority.HIGH;
    if (upper === 'URGENT') return ApprovalPriority.URGENT;
    return ApprovalPriority.MEDIUM;
  }

  private applyFilter(approvals: Approval[], filter?: ApprovalFilter): Approval[] {
    if (!filter) return approvals;

    return approvals.filter(approval => {
      if (filter.status && filter.status.length > 0 && !filter.status.includes(approval.status)) return false;
      if (filter.type && filter.type.length > 0 && !filter.type.includes(approval.type)) return false;
      if (filter.priority && filter.priority.length > 0 && !filter.priority.includes(approval.priority)) return false;
      if (filter.requestedBy && filter.requestedBy.length > 0 && !filter.requestedBy.includes(approval.requestedBy.id)) return false;
      if (filter.dateRange) {
        const requestDate = new Date(approval.requestedAt);
        if (requestDate < filter.dateRange.start || requestDate > filter.dateRange.end) return false;
      }
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const searchableText = [approval.title, approval.description, approval.requestedBy.name].join(' ').toLowerCase();
        if (!searchableText.includes(query)) return false;
      }
      return true;
    });
  }
}
