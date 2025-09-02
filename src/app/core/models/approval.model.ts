export interface Approval {
  id: string;
  type: ApprovalType;
  title: string;
  description: string;
  requestedBy: {
    id: string;
    name: string;
    role: string;
  };
  requestedAt: Date;
  priority: ApprovalPriority;
  status: ApprovalStatus;
  estimatedCost?: number;
  currency: string;
  relatedEntity?: {
    type: 'maintenance' | 'customer' | 'invoice' | 'part';
    id: string;
    name: string;
  };
  approvedBy?: {
    id: string;
    name: string;
  };
  approvedAt?: Date;
  rejectedBy?: {
    id: string;
    name: string;
  };
  rejectedAt?: Date;
  comments?: ApprovalComment[];
  attachments?: ApprovalAttachment[];
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalComment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    role: string;
  };
  createdAt: Date;
  isInternal: boolean;
}

export interface ApprovalAttachment {
  id: string;
  filename: string;
  url: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface ApprovalRequest {
  type: ApprovalType;
  title: string;
  description: string;
  priority: ApprovalPriority;
  estimatedCost?: number;
  currency: string;
  relatedEntityType?: 'maintenance' | 'customer' | 'invoice' | 'part';
  relatedEntityId?: string;
  dueDate?: Date;
  attachments?: File[];
}

export interface ApprovalAction {
  approvalId: string;
  action: 'approve' | 'reject' | 'request_info';
  comment?: string;
  attachments?: File[];
}

export interface ApprovalFilter {
  status?: ApprovalStatus[];
  type?: ApprovalType[];
  priority?: ApprovalPriority[];
  requestedBy?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

export interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  overdue: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  byType: {
    partPurchase: number;
    serviceApproval: number;
    customerCredit: number;
    overtime: number;
    expense: number;
    other: number;
  };
  avgResponseTime: number;
}

export enum ApprovalType {
  PART_PURCHASE = 'part_purchase',
  SERVICE_APPROVAL = 'service_approval',
  CUSTOMER_CREDIT = 'customer_credit',
  OVERTIME_REQUEST = 'overtime_request',
  EXPENSE_CLAIM = 'expense_claim',
  DISCOUNT_REQUEST = 'discount_request',
  REFUND_REQUEST = 'refund_request',
  OTHER = 'other'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  INFO_REQUESTED = 'info_requested',
  CANCELLED = 'cancelled'
}

export enum ApprovalPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  [ApprovalType.PART_PURCHASE]: 'Part Purchase',
  [ApprovalType.SERVICE_APPROVAL]: 'Service Approval',
  [ApprovalType.CUSTOMER_CREDIT]: 'Customer Credit',
  [ApprovalType.OVERTIME_REQUEST]: 'Overtime Request',
  [ApprovalType.EXPENSE_CLAIM]: 'Expense Claim',
  [ApprovalType.DISCOUNT_REQUEST]: 'Discount Request',
  [ApprovalType.REFUND_REQUEST]: 'Refund Request',
  [ApprovalType.OTHER]: 'Other'
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: 'Pending',
  [ApprovalStatus.APPROVED]: 'Approved',
  [ApprovalStatus.REJECTED]: 'Rejected',
  [ApprovalStatus.INFO_REQUESTED]: 'Info Requested',
  [ApprovalStatus.CANCELLED]: 'Cancelled'
};

export const APPROVAL_PRIORITY_LABELS: Record<ApprovalPriority, string> = {
  [ApprovalPriority.LOW]: 'Low',
  [ApprovalPriority.MEDIUM]: 'Medium',
  [ApprovalPriority.HIGH]: 'High',
  [ApprovalPriority.URGENT]: 'Urgent'
};