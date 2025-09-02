import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
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

@Injectable({
  providedIn: 'root'
})
export class ApprovalService {
  private approvalsSubject = new BehaviorSubject<Approval[]>(this.generateMockData());
  public approvals$ = this.approvalsSubject.asObservable();

  private generateMockData(): Approval[] {
    return [
      {
        id: '1',
        type: ApprovalType.PART_PURCHASE,
        title: 'Brake Pads for Mercedes C220',
        description: 'Customer needs premium brake pads replacement. Original part recommended for better quality and warranty.',
        requestedBy: {
          id: 'emp1',
          name: 'Ahmed Slimani',
          role: 'Lead Mechanic'
        },
        requestedAt: new Date('2024-12-28T10:30:00'),
        priority: ApprovalPriority.HIGH,
        status: ApprovalStatus.PENDING,
        estimatedCost: 285,
        currency: 'TND',
        relatedEntity: {
          type: 'maintenance',
          id: 'maint_001',
          name: 'Mercedes C220 Brake Service'
        },
        dueDate: new Date('2024-12-30T17:00:00'),
        createdAt: new Date('2024-12-28T10:30:00'),
        updatedAt: new Date('2024-12-28T10:30:00'),
        comments: [
          {
            id: 'c1',
            content: 'Customer specifically requested OEM parts for better reliability.',
            author: {
              id: 'emp1',
              name: 'Ahmed Slimani',
              role: 'Lead Mechanic'
            },
            createdAt: new Date('2024-12-28T10:32:00'),
            isInternal: true
          }
        ]
      },
      {
        id: '2',
        type: ApprovalType.OVERTIME_REQUEST,
        title: 'Weekend Work for Urgent Repair',
        description: 'Customer needs their car ready for Monday morning. Requesting approval for weekend overtime to complete transmission repair.',
        requestedBy: {
          id: 'emp2',
          name: 'Fatma Ben Ali',
          role: 'Mechanic'
        },
        requestedAt: new Date('2024-12-27T16:45:00'),
        priority: ApprovalPriority.URGENT,
        status: ApprovalStatus.PENDING,
        estimatedCost: 150,
        currency: 'TND',
        relatedEntity: {
          type: 'maintenance',
          id: 'maint_002',
          name: 'Peugeot 308 Transmission Repair'
        },
        dueDate: new Date('2024-12-28T09:00:00'),
        createdAt: new Date('2024-12-27T16:45:00'),
        updatedAt: new Date('2024-12-27T16:45:00')
      },
      {
        id: '3',
        type: ApprovalType.DISCOUNT_REQUEST,
        title: '15% Discount for Loyal Customer',
        description: 'Mr. Karim has been our customer for 5 years with regular maintenance. Requesting special discount for major engine work.',
        requestedBy: {
          id: 'emp1',
          name: 'Ahmed Slimani',
          role: 'Lead Mechanic'
        },
        requestedAt: new Date('2024-12-26T14:20:00'),
        priority: ApprovalPriority.MEDIUM,
        status: ApprovalStatus.APPROVED,
        estimatedCost: 450,
        currency: 'TND',
        relatedEntity: {
          type: 'customer',
          id: 'cust_003',
          name: 'Karim Essid'
        },
        approvedBy: {
          id: 'admin1',
          name: 'Garage Owner'
        },
        approvedAt: new Date('2024-12-26T15:30:00'),
        createdAt: new Date('2024-12-26T14:20:00'),
        updatedAt: new Date('2024-12-26T15:30:00')
      },
      {
        id: '4',
        type: ApprovalType.EXPENSE_CLAIM,
        title: 'New Tools Purchase',
        description: 'Need to purchase diagnostic tool for modern vehicles. Will improve service quality and reduce diagnostic time.',
        requestedBy: {
          id: 'emp3',
          name: 'Mohamed Gharbi',
          role: 'Senior Mechanic'
        },
        requestedAt: new Date('2024-12-25T11:15:00'),
        priority: ApprovalPriority.LOW,
        status: ApprovalStatus.REJECTED,
        estimatedCost: 1250,
        currency: 'TND',
        rejectedBy: {
          id: 'admin1',
          name: 'Garage Owner'
        },
        rejectedAt: new Date('2024-12-25T18:00:00'),
        createdAt: new Date('2024-12-25T11:15:00'),
        updatedAt: new Date('2024-12-25T18:00:00'),
        comments: [
          {
            id: 'c2',
            content: 'Budget constraints for this quarter. Please resubmit in Q1 2025.',
            author: {
              id: 'admin1',
              name: 'Garage Owner',
              role: 'Admin'
            },
            createdAt: new Date('2024-12-25T18:00:00'),
            isInternal: true
          }
        ]
      },
      {
        id: '5',
        type: ApprovalType.SERVICE_APPROVAL,
        title: 'Additional Engine Work',
        description: 'During oil change, discovered engine mount issue. Customer approved verbal estimate but need written approval for additional work.',
        requestedBy: {
          id: 'emp2',
          name: 'Fatma Ben Ali',
          role: 'Mechanic'
        },
        requestedAt: new Date('2024-12-28T09:15:00'),
        priority: ApprovalPriority.HIGH,
        status: ApprovalStatus.INFO_REQUESTED,
        estimatedCost: 320,
        currency: 'TND',
        relatedEntity: {
          type: 'maintenance',
          id: 'maint_003',
          name: 'Toyota Corolla Engine Mount Replacement'
        },
        createdAt: new Date('2024-12-28T09:15:00'),
        updatedAt: new Date('2024-12-28T11:30:00'),
        comments: [
          {
            id: 'c3',
            content: 'Need customer signature on written estimate before proceeding.',
            author: {
              id: 'admin1',
              name: 'Garage Owner',
              role: 'Admin'
            },
            createdAt: new Date('2024-12-28T11:30:00'),
            isInternal: false
          }
        ]
      }
    ];
  }

  getApprovals(filter?: ApprovalFilter): Observable<Approval[]> {
    return this.approvals$.pipe(
      map(approvals => {
        if (!filter) return approvals;

        return approvals.filter(approval => {
          // Status filter
          if (filter.status && filter.status.length > 0) {
            if (!filter.status.includes(approval.status)) return false;
          }

          // Type filter
          if (filter.type && filter.type.length > 0) {
            if (!filter.type.includes(approval.type)) return false;
          }

          // Priority filter
          if (filter.priority && filter.priority.length > 0) {
            if (!filter.priority.includes(approval.priority)) return false;
          }

          // Requested by filter
          if (filter.requestedBy && filter.requestedBy.length > 0) {
            if (!filter.requestedBy.includes(approval.requestedBy.id)) return false;
          }

          // Date range filter
          if (filter.dateRange) {
            const requestDate = new Date(approval.requestedAt);
            if (requestDate < filter.dateRange.start || requestDate > filter.dateRange.end) {
              return false;
            }
          }

          // Search query filter
          if (filter.searchQuery) {
            const query = filter.searchQuery.toLowerCase();
            const searchableText = [
              approval.title,
              approval.description,
              approval.requestedBy.name
            ].join(' ').toLowerCase();
            
            if (!searchableText.includes(query)) return false;
          }

          return true;
        });
      }),
      delay(300)
    );
  }

  getApprovalById(id: string): Observable<Approval | undefined> {
    return this.approvals$.pipe(
      map(approvals => approvals.find(a => a.id === id)),
      delay(200)
    );
  }

  createApproval(request: ApprovalRequest): Observable<Approval> {
    const newApproval: Approval = {
      id: `approval_${Date.now()}`,
      type: request.type,
      title: request.title,
      description: request.description,
      priority: request.priority,
      estimatedCost: request.estimatedCost,
      currency: request.currency,
      relatedEntity: request.relatedEntityType && request.relatedEntityId ? {
        type: request.relatedEntityType,
        id: request.relatedEntityId,
        name: `${request.relatedEntityType} ${request.relatedEntityId}`
      } : undefined,
      dueDate: request.dueDate,
      requestedBy: {
        id: 'current_user',
        name: 'Current User',
        role: 'Mechanic'
      },
      requestedAt: new Date(),
      status: ApprovalStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const currentApprovals = this.approvalsSubject.value;
    this.approvalsSubject.next([newApproval, ...currentApprovals]);

    return of(newApproval).pipe(delay(500));
  }

  processApproval(action: ApprovalAction): Observable<Approval> {
    const currentApprovals = this.approvalsSubject.value;
    const approvalIndex = currentApprovals.findIndex(a => a.id === action.approvalId);
    
    if (approvalIndex === -1) {
      throw new Error('Approval not found');
    }

    const approval = { ...currentApprovals[approvalIndex] };
    const now = new Date();

    switch (action.action) {
      case 'approve':
        approval.status = ApprovalStatus.APPROVED;
        approval.approvedBy = {
          id: 'admin1',
          name: 'Garage Owner'
        };
        approval.approvedAt = now;
        break;

      case 'reject':
        approval.status = ApprovalStatus.REJECTED;
        approval.rejectedBy = {
          id: 'admin1',
          name: 'Garage Owner'
        };
        approval.rejectedAt = now;
        break;

      case 'request_info':
        approval.status = ApprovalStatus.INFO_REQUESTED;
        break;
    }

    if (action.comment) {
      const newComment = {
        id: `comment_${Date.now()}`,
        content: action.comment,
        author: {
          id: 'admin1',
          name: 'Garage Owner',
          role: 'Admin'
        },
        createdAt: now,
        isInternal: action.action === 'request_info'
      };

      approval.comments = [...(approval.comments || []), newComment];
    }

    approval.updatedAt = now;

    const updatedApprovals = [...currentApprovals];
    updatedApprovals[approvalIndex] = approval;
    this.approvalsSubject.next(updatedApprovals);

    return of(approval).pipe(delay(300));
  }

  getApprovalStats(): Observable<ApprovalStats> {
    return this.approvals$.pipe(
      map(approvals => {
        const stats: ApprovalStats = {
          total: approvals.length,
          pending: approvals.filter(a => a.status === ApprovalStatus.PENDING).length,
          approved: approvals.filter(a => a.status === ApprovalStatus.APPROVED).length,
          rejected: approvals.filter(a => a.status === ApprovalStatus.REJECTED).length,
          overdue: approvals.filter(a => 
            a.status === ApprovalStatus.PENDING && 
            a.dueDate && 
            new Date() > a.dueDate
          ).length,
          byPriority: {
            low: approvals.filter(a => a.priority === ApprovalPriority.LOW).length,
            medium: approvals.filter(a => a.priority === ApprovalPriority.MEDIUM).length,
            high: approvals.filter(a => a.priority === ApprovalPriority.HIGH).length,
            urgent: approvals.filter(a => a.priority === ApprovalPriority.URGENT).length
          },
          byType: {
            partPurchase: approvals.filter(a => a.type === ApprovalType.PART_PURCHASE).length,
            serviceApproval: approvals.filter(a => a.type === ApprovalType.SERVICE_APPROVAL).length,
            customerCredit: approvals.filter(a => a.type === ApprovalType.CUSTOMER_CREDIT).length,
            overtime: approvals.filter(a => a.type === ApprovalType.OVERTIME_REQUEST).length,
            expense: approvals.filter(a => a.type === ApprovalType.EXPENSE_CLAIM).length,
            other: approvals.filter(a => a.type === ApprovalType.OTHER).length
          },
          avgResponseTime: 2.5 // days
        };

        return stats;
      }),
      delay(200)
    );
  }

  getPendingApprovals(): Observable<Approval[]> {
    return this.getApprovals({
      status: [ApprovalStatus.PENDING, ApprovalStatus.INFO_REQUESTED]
    });
  }

  getOverdueApprovals(): Observable<Approval[]> {
    return this.approvals$.pipe(
      map(approvals => approvals.filter(a => 
        a.status === ApprovalStatus.PENDING && 
        a.dueDate && 
        new Date() > a.dueDate
      )),
      delay(200)
    );
  }

  addComment(approvalId: string, content: string, isInternal: boolean = true): Observable<Approval> {
    const currentApprovals = this.approvalsSubject.value;
    const approvalIndex = currentApprovals.findIndex(a => a.id === approvalId);
    
    if (approvalIndex === -1) {
      throw new Error('Approval not found');
    }

    const approval = { ...currentApprovals[approvalIndex] };
    const newComment = {
      id: `comment_${Date.now()}`,
      content,
      author: {
        id: 'current_user',
        name: 'Current User',
        role: 'Admin'
      },
      createdAt: new Date(),
      isInternal
    };

    approval.comments = [...(approval.comments || []), newComment];
    approval.updatedAt = new Date();

    const updatedApprovals = [...currentApprovals];
    updatedApprovals[approvalIndex] = approval;
    this.approvalsSubject.next(updatedApprovals);

    return of(approval).pipe(delay(200));
  }

  deleteApproval(id: string): Observable<boolean> {
    const currentApprovals = this.approvalsSubject.value;
    const filteredApprovals = currentApprovals.filter(a => a.id !== id);
    this.approvalsSubject.next(filteredApprovals);
    
    return of(true).pipe(delay(200));
  }

  bulkAction(approvalIds: string[], action: 'approve' | 'reject' | 'delete'): Observable<boolean> {
    const currentApprovals = this.approvalsSubject.value;
    let updatedApprovals = [...currentApprovals];
    const now = new Date();

    approvalIds.forEach(id => {
      const index = updatedApprovals.findIndex(a => a.id === id);
      if (index !== -1) {
        if (action === 'delete') {
          updatedApprovals = updatedApprovals.filter(a => a.id !== id);
        } else {
          const approval = { ...updatedApprovals[index] };
          
          if (action === 'approve') {
            approval.status = ApprovalStatus.APPROVED;
            approval.approvedBy = { id: 'admin1', name: 'Garage Owner' };
            approval.approvedAt = now;
          } else if (action === 'reject') {
            approval.status = ApprovalStatus.REJECTED;
            approval.rejectedBy = { id: 'admin1', name: 'Garage Owner' };
            approval.rejectedAt = now;
          }
          
          approval.updatedAt = now;
          updatedApprovals[index] = approval;
        }
      }
    });

    this.approvalsSubject.next(updatedApprovals);
    return of(true).pipe(delay(500));
  }
}