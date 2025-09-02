import { Injectable, signal } from '@angular/core';
import { Observable, of, BehaviorSubject, map } from 'rxjs';
import { 
  MaintenanceJob, 
  MaintenanceFilters, 
  MaintenanceStats, 
  MaintenanceHistory,
  ServiceType,
  ApprovalRequest,
  MaintenanceStatus,
  TaskStatus
} from '../models/maintenance.model';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {
  private maintenanceJobsSubject = new BehaviorSubject<MaintenanceJob[]>([]);
  public maintenanceJobs$ = this.maintenanceJobsSubject.asObservable();
  
  public selectedJob = signal<MaintenanceJob | null>(null);
  public filters = signal<MaintenanceFilters>({});

  // Mock data for development
  private mockMaintenanceJobs: MaintenanceJob[] = [
    {
      id: 'mj-001',
      carId: 'car-001',
      customerId: 'customer-001',
      mechanicId: 'mechanic-001',
      licensePlate: '123 TN 1234',
      customerName: 'Ahmed Ben Ali',
      mechanicName: 'Mohamed Trabelsi',
      carDetails: '2019 Toyota Corolla',
      currentMileage: 85000,
      jobTitle: 'Brake System Repair',
      description: 'Customer reported squeaking noise and reduced braking performance',
      tasks: [
        {
          id: 'task-001',
          name: 'Inspect brake pads',
          description: 'Check front and rear brake pad thickness',
          status: 'completed',
          estimatedTime: 30,
          actualTime: 25,
          assignedMechanicId: 'mechanic-001',
          completedAt: new Date(2025, 7, 29, 9, 30)
        },
        {
          id: 'task-002',
          name: 'Replace front brake pads',
          description: 'Install new ceramic brake pads',
          status: 'in-progress',
          estimatedTime: 60,
          assignedMechanicId: 'mechanic-001'
        },
        {
          id: 'task-003',
          name: 'Test brake system',
          description: 'Road test to verify proper brake function',
          status: 'pending',
          estimatedTime: 15
        }
      ],
      photos: [
        {
          id: 'photo-001',
          url: '/assets/maintenance/brake-pads-worn.jpg',
          filename: 'brake-pads-worn.jpg',
          description: 'Worn front brake pads',
          category: 'before',
          uploadedAt: new Date(2025, 7, 29, 9, 0),
          uploadedBy: 'mechanic-001'
        }
      ],
      status: 'in-progress',
      priority: 'high',
      estimatedCost: 180,
      estimatedDuration: 105,
      startDate: new Date(2025, 7, 29, 9, 0),
      approvalRequests: [],
      notes: 'Customer will wait during repair',
      createdAt: new Date(2025, 7, 29, 8, 30),
      updatedAt: new Date(2025, 7, 29, 10, 15)
    },
    {
      id: 'mj-002',
      carId: 'car-002',
      customerId: 'customer-002',
      mechanicId: 'mechanic-002',
      licensePlate: '456 TN 7890',
      customerName: 'Fatma Habibi',
      mechanicName: 'Ali Sassi',
      carDetails: '2021 Renault Megane',
      currentMileage: 42000,
      jobTitle: 'Regular Oil Change Service',
      description: 'Routine maintenance - oil and filter change',
      tasks: [
        {
          id: 'task-004',
          name: 'Drain old oil',
          description: 'Remove old engine oil',
          status: 'completed',
          estimatedTime: 15,
          actualTime: 12,
          assignedMechanicId: 'mechanic-002',
          completedAt: new Date(2025, 7, 30, 8, 45)
        },
        {
          id: 'task-005',
          name: 'Replace oil filter',
          description: 'Install new oil filter',
          status: 'completed',
          estimatedTime: 10,
          actualTime: 8,
          assignedMechanicId: 'mechanic-002',
          completedAt: new Date(2025, 7, 30, 8, 55)
        },
        {
          id: 'task-006',
          name: 'Add new oil',
          description: 'Fill with 5W-30 synthetic oil',
          status: 'completed',
          estimatedTime: 10,
          actualTime: 10,
          assignedMechanicId: 'mechanic-002',
          completedAt: new Date(2025, 7, 30, 9, 5)
        }
      ],
      photos: [],
      status: 'completed',
      priority: 'medium',
      estimatedCost: 75,
      actualCost: 75,
      estimatedDuration: 35,
      actualDuration: 30,
      startDate: new Date(2025, 7, 30, 8, 30),
      completionDate: new Date(2025, 7, 30, 9, 0),
      approvalRequests: [],
      notes: 'Service completed on time',
      createdAt: new Date(2025, 7, 30, 8, 0),
      updatedAt: new Date(2025, 7, 30, 9, 10)
    },
    {
      id: 'mj-003',
      carId: 'car-003',
      customerId: 'customer-003',
      mechanicId: 'mechanic-001',
      licensePlate: '789 TN 2468',
      customerName: 'Karim Bouaziz',
      mechanicName: 'Mohamed Trabelsi',
      carDetails: '2018 Peugeot 208',
      currentMileage: 95000,
      jobTitle: 'Engine Diagnostic',
      description: 'Check engine light on, irregular idle',
      tasks: [
        {
          id: 'task-007',
          name: 'OBD scan',
          description: 'Run diagnostic scan for error codes',
          status: 'pending',
          estimatedTime: 20
        },
        {
          id: 'task-008',
          name: 'Inspect ignition system',
          description: 'Check spark plugs and coils',
          status: 'pending',
          estimatedTime: 45
        }
      ],
      photos: [],
      status: 'waiting-approval',
      priority: 'medium',
      estimatedCost: 150,
      estimatedDuration: 65,
      approvalRequests: [
        {
          id: 'approval-001',
          type: 'additional-work',
          description: 'Replace spark plugs - showing excessive wear',
          estimatedPrice: 120,
          urgency: 'medium',
          requestedBy: 'mechanic-001',
          requestedAt: new Date(2025, 7, 30, 11, 0),
          status: 'pending'
        }
      ],
      notes: 'Waiting for customer approval on additional work',
      createdAt: new Date(2025, 7, 30, 10, 30),
      updatedAt: new Date(2025, 7, 30, 11, 0)
    }
  ];

  private mockServiceTypes: ServiceType[] = [
    {
      id: 'oil-change',
      name: 'Oil Change',
      category: 'routine-maintenance',
      estimatedDuration: 30,
      estimatedCost: 75,
      description: 'Engine oil and filter replacement',
      requiredSkills: ['basic-maintenance'],
      commonParts: ['engine-oil', 'oil-filter']
    },
    {
      id: 'brake-repair',
      name: 'Brake Repair',
      category: 'brakes',
      estimatedDuration: 120,
      estimatedCost: 200,
      description: 'Brake pad and disc service',
      requiredSkills: ['brake-systems'],
      commonParts: ['brake-pads', 'brake-discs', 'brake-fluid']
    },
    {
      id: 'engine-diagnostic',
      name: 'Engine Diagnostic',
      category: 'diagnostics',
      estimatedDuration: 60,
      estimatedCost: 100,
      description: 'Comprehensive engine analysis',
      requiredSkills: ['diagnostics', 'engine-systems'],
      commonParts: []
    }
  ];

  constructor() {
    this.maintenanceJobsSubject.next(this.mockMaintenanceJobs);
  }

  getMaintenanceJobs(filters?: MaintenanceFilters): Observable<MaintenanceJob[]> {
    return this.maintenanceJobs$.pipe(
      map(jobs => this.applyFilters(jobs, filters))
    );
  }

  getMaintenanceJob(id: string): Observable<MaintenanceJob | null> {
    return this.maintenanceJobs$.pipe(
      map(jobs => jobs.find(job => job.id === id) || null)
    );
  }

  createMaintenanceJob(job: Partial<MaintenanceJob>): Observable<MaintenanceJob> {
    const newJob: MaintenanceJob = {
      id: this.generateId(),
      carId: job.carId!,
      customerId: job.customerId!,
      mechanicId: job.mechanicId!,
      licensePlate: job.licensePlate!,
      customerName: job.customerName!,
      mechanicName: job.mechanicName!,
      carDetails: job.carDetails!,
      currentMileage: job.currentMileage!,
      jobTitle: job.jobTitle!,
      description: job.description!,
      tasks: job.tasks || [],
      photos: job.photos || [],
      status: job.status || 'waiting',
      priority: job.priority || 'medium',
      estimatedCost: job.estimatedCost || 0,
      estimatedDuration: job.estimatedDuration || 60,
      approvalRequests: job.approvalRequests || [],
      notes: job.notes || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const currentJobs = this.maintenanceJobsSubject.value;
    this.maintenanceJobsSubject.next([...currentJobs, newJob]);
    
    return of(newJob);
  }

  updateMaintenanceJob(id: string, updates: Partial<MaintenanceJob>): Observable<MaintenanceJob> {
    const currentJobs = this.maintenanceJobsSubject.value;
    const jobIndex = currentJobs.findIndex(job => job.id === id);
    
    if (jobIndex === -1) {
      throw new Error(`Maintenance job with id ${id} not found`);
    }

    const updatedJob = {
      ...currentJobs[jobIndex],
      ...updates,
      updatedAt: new Date()
    };

    const updatedJobs = [...currentJobs];
    updatedJobs[jobIndex] = updatedJob;
    
    this.maintenanceJobsSubject.next(updatedJobs);
    
    return of(updatedJob);
  }

  updateJobStatus(id: string, status: MaintenanceStatus): Observable<MaintenanceJob> {
    const updates: Partial<MaintenanceJob> = { status };
    
    if (status === 'completed') {
      updates.completionDate = new Date();
    } else if (status === 'in-progress' && !this.selectedJob()?.startDate) {
      updates.startDate = new Date();
    }

    return this.updateMaintenanceJob(id, updates);
  }

  updateTaskStatus(jobId: string, taskId: string, status: TaskStatus): Observable<MaintenanceJob> {
    const currentJobs = this.maintenanceJobsSubject.value;
    const job = currentJobs.find(job => job.id === jobId);
    
    if (!job) {
      throw new Error(`Job with id ${jobId} not found`);
    }

    const updatedTasks = job.tasks.map(task => {
      if (task.id === taskId) {
        const updatedTask = { ...task, status };
        if (status === 'completed') {
          updatedTask.completedAt = new Date();
        }
        return updatedTask;
      }
      return task;
    });

    return this.updateMaintenanceJob(jobId, { tasks: updatedTasks });
  }

  addApprovalRequest(jobId: string, request: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'status'>): Observable<MaintenanceJob> {
    const newRequest: ApprovalRequest = {
      ...request,
      id: this.generateId(),
      requestedAt: new Date(),
      status: 'pending'
    };

    const currentJobs = this.maintenanceJobsSubject.value;
    const job = currentJobs.find(job => job.id === jobId);
    
    if (!job) {
      throw new Error(`Job with id ${jobId} not found`);
    }

    const updatedApprovalRequests = [...job.approvalRequests, newRequest];
    return this.updateMaintenanceJob(jobId, { 
      approvalRequests: updatedApprovalRequests,
      status: 'waiting-approval'
    });
  }

  approveRequest(jobId: string, requestId: string, approvedBy: string): Observable<MaintenanceJob> {
    const currentJobs = this.maintenanceJobsSubject.value;
    const job = currentJobs.find(job => job.id === jobId);
    
    if (!job) {
      throw new Error(`Job with id ${jobId} not found`);
    }

    const updatedRequests = job.approvalRequests.map(req => {
      if (req.id === requestId) {
        return {
          ...req,
          status: 'approved' as const,
          approvedBy,
          approvedAt: new Date()
        };
      }
      return req;
    });

    // If all approvals are resolved, move back to in-progress
    const hasApprovals = updatedRequests.some(req => req.status === 'pending');
    const newStatus = hasApprovals ? 'waiting-approval' : 'in-progress';

    return this.updateMaintenanceJob(jobId, { 
      approvalRequests: updatedRequests,
      status: newStatus
    });
  }

  rejectRequest(jobId: string, requestId: string, rejectionReason: string): Observable<MaintenanceJob> {
    const currentJobs = this.maintenanceJobsSubject.value;
    const job = currentJobs.find(job => job.id === jobId);
    
    if (!job) {
      throw new Error(`Job with id ${jobId} not found`);
    }

    const updatedRequests = job.approvalRequests.map(req => {
      if (req.id === requestId) {
        return {
          ...req,
          status: 'rejected' as const,
          rejectionReason
        };
      }
      return req;
    });

    return this.updateMaintenanceJob(jobId, { approvalRequests: updatedRequests });
  }

  getMaintenanceStats(): Observable<MaintenanceStats> {
    return this.maintenanceJobs$.pipe(
      map(jobs => {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        const totalJobs = jobs.length;
        const activeJobs = jobs.filter(job => ['waiting', 'in-progress', 'waiting-approval', 'waiting-parts'].includes(job.status)).length;
        const completedToday = jobs.filter(job => 
          job.status === 'completed' && 
          job.completionDate && 
          job.completionDate >= startOfToday
        ).length;
        const pendingApprovals = jobs.filter(job => job.status === 'waiting-approval').length;
        
        // Calculate average completion time for completed jobs
        const completedJobs = jobs.filter(job => job.status === 'completed' && job.actualDuration);
        const averageCompletionTime = completedJobs.length > 0 
          ? completedJobs.reduce((sum, job) => sum + (job.actualDuration || 0), 0) / completedJobs.length / 60 // convert to hours
          : 0;
        
        const revenueToday = jobs
          .filter(job => job.status === 'completed' && job.completionDate && job.completionDate >= startOfToday)
          .reduce((sum, job) => sum + (job.actualCost || job.estimatedCost), 0);
        
        // Calculate efficiency: completed jobs vs total jobs this week
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const thisWeekJobs = jobs.filter(job => job.createdAt >= weekAgo);
        const thisWeekCompleted = thisWeekJobs.filter(job => job.status === 'completed');
        const efficiency = thisWeekJobs.length > 0 ? (thisWeekCompleted.length / thisWeekJobs.length) * 100 : 0;

        return {
          totalJobs,
          activeJobs,
          completedToday,
          pendingApprovals,
          averageCompletionTime,
          revenueToday,
          efficiency
        };
      })
    );
  }

  getMaintenanceHistory(carId: string): Observable<MaintenanceHistory[]> {
    return this.maintenanceJobs$.pipe(
      map(jobs => jobs
        .filter(job => job.carId === carId && job.status === 'completed')
        .map(job => ({
          jobId: job.id,
          carId: job.carId,
          licensePlate: job.licensePlate,
          serviceDate: job.completionDate!,
          serviceType: job.jobTitle,
          mileage: job.currentMileage,
          cost: job.actualCost || job.estimatedCost,
          mechanicName: job.mechanicName,
          notes: job.notes
        }))
        .sort((a, b) => b.serviceDate.getTime() - a.serviceDate.getTime())
      )
    );
  }

  getServiceTypes(): Observable<ServiceType[]> {
    return of(this.mockServiceTypes);
  }

  deleteMaintenanceJob(id: string): Observable<boolean> {
    const currentJobs = this.maintenanceJobsSubject.value;
    const filteredJobs = currentJobs.filter(job => job.id !== id);
    this.maintenanceJobsSubject.next(filteredJobs);
    return of(true);
  }

  private applyFilters(jobs: MaintenanceJob[], filters?: MaintenanceFilters): MaintenanceJob[] {
    if (!filters) return jobs;

    return jobs.filter(job => {
      // Status filter
      if (filters.status && filters.status.length > 0 && !filters.status.includes(job.status)) {
        return false;
      }

      // Priority filter
      if (filters.priority && filters.priority.length > 0 && !filters.priority.includes(job.priority)) {
        return false;
      }

      // Mechanic filter
      if (filters.mechanicId && job.mechanicId !== filters.mechanicId) {
        return false;
      }

      // Date range filter
      if (filters.dateRange) {
        const jobDate = job.createdAt;
        if (jobDate < filters.dateRange.start || jobDate > filters.dateRange.end) {
          return false;
        }
      }

      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const searchableText = [
          job.jobTitle,
          job.description,
          job.licensePlate,
          job.customerName,
          job.carDetails
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      // Car make filter
      if (filters.carMake) {
        if (!job.carDetails.toLowerCase().includes(filters.carMake.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }

  private generateId(): string {
    return 'id-' + Math.random().toString(36).substr(2, 9);
  }
}