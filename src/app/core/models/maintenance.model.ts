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
  notes: string;
  createdAt: Date;
  updatedAt: Date;
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
  type: 'part-purchase' | 'additional-work' | 'cost-estimate';
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
  comments?: string;
}

export type MaintenanceStatus = 
  | 'waiting' 
  | 'in-progress' 
  | 'waiting-approval' 
  | 'waiting-parts' 
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