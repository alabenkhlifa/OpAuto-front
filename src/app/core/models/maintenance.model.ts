export interface MaintenanceJob {
  id: string;
  carId: string;
  customerId: string;
  mechanicId: string;
  licensePlate: string;
  customerName: string;
  mechanicName: string;
  carDetails: string; // "2020 Toyota Camry"
  currentMileage: number;
  jobTitle: string;
  description: string;
  tasks: MaintenanceTask[];
  photos: MaintenancePhoto[];
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  estimatedCost: number;
  actualCost?: number;
  estimatedDuration: number; // minutes
  actualDuration?: number;
  startDate?: Date;
  completionDate?: Date;
  approvalRequests: ApprovalRequest[];
  parts: MaintenancePart[];
  timelineEvents: MaintenanceTimelineEvent[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenancePart {
  id: string;
  name: string;
  partNumber?: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  supplier?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MaintenanceTimelineEvent {
  id: string;
  type: string;
  label?: string;
  description?: string;
  actorName?: string;
  actorId?: string;
  occurredAt: Date;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  estimatedTime: number; // minutes
  actualTime?: number;
  assignedMechanicId?: string;
  completedAt?: Date;
  notes?: string;
}

export interface MaintenancePhoto {
  id: string;
  url: string;
  filename: string;
  description: string;
  category: PhotoCategory;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface ApprovalRequest {
  id: string;
  type: 'part-purchase' | 'additional-work' | 'cost-estimate' | 'price-change' | 'parts-request';
  description: string;
  partName?: string;
  estimatedPrice: number;
  urgency: 'low' | 'medium' | 'high';
  requestedBy: string;
  requestedAt: Date;
  status: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  customerResponse?: 'approved' | 'rejected';
  customerRespondedAt?: Date;
  respondedVia?: 'call' | 'sms' | 'email';
  sentVia?: ApprovalChannel[];
  sentTo?: string;
  token?: string;
  comments?: string;
}

export type ApprovalChannel = 'call' | 'sms' | 'email';

export interface JobApprovalCreatePayload {
  type: ApprovalRequest['type'];
  description: string;
  partName?: string;
  estimatedPrice: number;
  urgency: ApprovalRequest['urgency'];
  requestedBy?: string;
  sentVia?: ApprovalChannel[];
  comments?: string;
}

export interface JobApprovalResponsePayload {
  decision: 'approved' | 'rejected';
  channel?: ApprovalChannel;
  reason?: string;
  reviewer?: string;
}

export interface PublicJobApprovalSummary {
  token: string;
  jobId: string;
  jobTitle: string;
  customerName: string;
  carDetails: string;
  licensePlate: string;
  status: 'pending' | 'approved' | 'rejected';
  request: ApprovalRequest;
  alreadyResponded: boolean;
  respondedAt?: Date;
  respondedBy?: string;
  respondedVia?: ApprovalChannel;
  timeline?: MaintenanceTimelineEvent[];
}

export type MaintenanceStatus =
  | 'waiting'
  | 'in-progress'
  | 'waiting-approval'
  | 'waiting-parts'
  | 'quality-check'
  | 'completed'
  | 'cancelled';

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'skipped';

export type PhotoCategory = 'before' | 'during' | 'after' | 'diagnostic' | 'damage' | 'parts';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface MaintenanceFilters {
  status?: MaintenanceStatus[];
  priority?: MaintenancePriority[];
  mechanicId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
  carMake?: string;
  serviceType?: string;
}

export interface MaintenanceStats {
  totalJobs: number;
  activeJobs: number;
  completedToday: number;
  pendingApprovals: number;
  averageCompletionTime: number; // hours
  revenueToday: number;
  efficiency: number; // percentage
}

export interface MaintenanceHistory {
  jobId: string;
  carId: string;
  licensePlate: string;
  serviceDate: Date;
  serviceType: string;
  mileage: number;
  cost: number;
  mechanicName: string;
  notes?: string;
}

export interface ServiceType {
  id: string;
  name: string;
  category: ServiceCategory;
  estimatedDuration: number; // minutes
  estimatedCost: number;
  description: string;
  requiredSkills: string[];
  commonParts: string[];
}

export type ServiceCategory = 
  | 'engine' 
  | 'brakes' 
  | 'electrical' 
  | 'transmission' 
  | 'suspension' 
  | 'body-work' 
  | 'diagnostics' 
  | 'routine-maintenance';
