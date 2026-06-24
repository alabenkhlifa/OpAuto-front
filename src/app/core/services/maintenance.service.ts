import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap, switchMap } from 'rxjs/operators';
import {
  MaintenanceJob,
  MaintenanceFilters,
  MaintenanceStats,
  MaintenanceHistory,
  ServiceType,
  ApprovalRequest,
  MaintenancePart,
  MaintenanceTimelineEvent,
  ApprovalChannel,
  JobApprovalCreatePayload,
  JobApprovalResponsePayload,
  PublicJobApprovalSummary,
  ApprovalStatus,
  MaintenanceStatus,
  TaskStatus
} from '../models/maintenance.model';
import { fromBackendEnum, toBackendEnum } from '../utils/enum-mapper';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {
  private http = inject(HttpClient);

  private maintenanceJobsSubject = new BehaviorSubject<MaintenanceJob[]>([]);
  public maintenanceJobs$ = this.maintenanceJobsSubject.asObservable();

  public selectedJob = signal<MaintenanceJob | null>(null);
  public filters = signal<MaintenanceFilters>({});

  getMaintenanceJobs(filters?: MaintenanceFilters): Observable<MaintenanceJob[]> {
    return this.http.get<any[]>('/maintenance').pipe(
      map(jobs => jobs.map(j => this.mapFromBackend(j))),
      tap(jobs => this.maintenanceJobsSubject.next(jobs)),
      map(jobs => this.applyFilters(jobs, filters))
    );
  }

  getMaintenanceJob(id: string): Observable<MaintenanceJob | null> {
    return this.http.get<any>(`/maintenance/${id}`).pipe(
      map(j => j ? this.mapFromBackend(j) : null)
    );
  }

  createMaintenanceJob(job: Partial<MaintenanceJob>): Observable<MaintenanceJob> {
    const payload = this.mapToBackend(job);
    // These are client-side fields — backend rejects them
    delete payload.customerId;
    delete payload.status;
    delete payload.tasks;
    delete payload.approvals;
    delete payload.parts;
    delete payload.timelineEvents;
    delete payload.mileage;
    return this.http.post<any>('/maintenance', payload).pipe(
      map(j => this.mapFromBackend(j)),
      tap(newJob => this.syncJobIntoStore(newJob))
    );
  }

  updateMaintenanceJob(id: string, updates: Partial<MaintenanceJob>): Observable<MaintenanceJob> {
    const payload = this.mapToBackend(updates);
    delete payload.customerId;
    delete payload.tasks;
    delete payload.approvals;
    delete payload.mileage;
    return this.http.put<any>(`/maintenance/${id}`, payload).pipe(
      map(j => this.mapFromBackend(j)),
      tap(updated => this.syncJobIntoStore(updated))
    );
  }

  // ── Tasks ────────────────────────────────────────────────────────
  addTask(jobId: string, task: { title: string; description?: string; estimatedMinutes?: number; isCompleted?: boolean }): Observable<any> {
    return this.http.post<any>(`/maintenance/${jobId}/tasks`, task);
  }

  updateTask(jobId: string, taskId: string, updates: { title?: string; description?: string; estimatedMinutes?: number; actualMinutes?: number; isCompleted?: boolean }): Observable<any> {
    return this.http.put<any>(`/maintenance/${jobId}/tasks/${taskId}`, updates);
  }

  deleteTask(jobId: string, taskId: string): Observable<any> {
    return this.http.delete<any>(`/maintenance/${jobId}/tasks/${taskId}`);
  }

  updateJobStatus(id: string, status: MaintenanceStatus): Observable<MaintenanceJob> {
    const updates: any = { status: status === 'waiting' ? 'PENDING' : toBackendEnum(status) };
    if (status === 'completed') {
      updates.completionDate = new Date().toISOString();
    }
    return this.http.put<any>(`/maintenance/${id}`, updates).pipe(
      map(j => this.mapFromBackend(j)),
      tap(updated => this.syncJobIntoStore(updated))
    );
  }

  updateTaskStatus(jobId: string, taskId: string, status: TaskStatus): Observable<MaintenanceJob> {
    return this.updateTask(jobId, taskId, {
      isCompleted: status === 'completed',
    }).pipe(
      switchMap(() => this.http.get<any>(`/maintenance/${jobId}`)),
      map(j => this.mapFromBackend(j)),
      tap(updated => this.syncJobIntoStore(updated))
    );
  }

  addApprovalRequest(jobId: string, request: Omit<ApprovalRequest, 'id' | 'requestedAt' | 'status'>): Observable<MaintenanceJob> {
    return this.createApprovalRequest(jobId, {
      ...request,
      requestedBy: request.requestedBy || 'owner',
    }).pipe(
      switchMap(() => this.getMaintenanceJob(jobId)),
      map(job => {
        if (!job) throw new Error(`Job with id ${jobId} not found`);
        return job;
      }),
      tap(updated => this.syncJobIntoStore(updated))
    );
  }

  createApprovalRequest(jobId: string, request: JobApprovalCreatePayload): Observable<ApprovalRequest> {
    const payload = {
      ...request,
      requestedAt: new Date().toISOString()
    };
    return this.http.post<any>(`/maintenance/${jobId}/approvals`, payload).pipe(
      map(r => this.mapApprovalFromBackend(r))
    );
  }

  approveRequest(jobId: string, requestId: string, approvedBy: string, channel?: ApprovalChannel): Observable<MaintenanceJob> {
    return this.recordOwnerApprovalDecision(jobId, requestId, {
      decision: 'approved',
      reviewer: approvedBy,
      channel
    });
  }

  rejectRequest(jobId: string, requestId: string, rejectionReason: string, channel?: ApprovalChannel): Observable<MaintenanceJob> {
    return this.recordOwnerApprovalDecision(jobId, requestId, {
      decision: 'rejected',
      reason: rejectionReason,
      channel
    });
  }

  recordOwnerApprovalDecision(
    jobId: string,
    requestId: string,
    payload: JobApprovalResponsePayload
  ): Observable<MaintenanceJob> {
    return this.http.post<any>(`/maintenance/${jobId}/approvals/${requestId}/response`, payload).pipe(
      switchMap(() => this.getMaintenanceJob(jobId)),
      map(job => {
        if (!job) throw new Error(`Job with id ${jobId} not found`);
        return job;
      }),
      tap(updated => this.syncJobIntoStore(updated))
    );
  }

  addJobPart(jobId: string, part: Omit<MaintenancePart, 'id' | 'createdAt' | 'updatedAt' | 'totalPrice'>): Observable<MaintenancePart> {
    return this.http.post<any>(`/maintenance/${jobId}/parts`, this.mapPartToBackend(part)).pipe(
      map(p => this.mapPartFromBackend(p))
    );
  }

  updateJobPart(jobId: string, partId: string, part: Partial<MaintenancePart>): Observable<MaintenancePart> {
    return this.http.put<any>(`/maintenance/${jobId}/parts/${partId}`, this.mapPartToBackend(part)).pipe(
      map(p => this.mapPartFromBackend(p))
    );
  }

  removeJobPart(jobId: string, partId: string): Observable<void> {
    return this.http.delete<void>(`/maintenance/${jobId}/parts/${partId}`).pipe(
      map(() => undefined),
      tap(() => {
        const current = this.maintenanceJobsSubject.value;
        const job = current.find(j => j.id === jobId);
        if (!job) return;
        const updatedJob = this.syncJobAfterPartRemoval(job, partId);
        this.syncJobIntoStore(updatedJob);
      })
    );
  }

  refreshJobWithParts(jobId: string): Observable<MaintenanceJob | null> {
    return this.getMaintenanceJob(jobId).pipe(
      tap(job => {
        if (!job) return;
        this.syncJobIntoStore(job);
      }),
      switchMap(job => of(job || this.maintenanceJobsSubject.value.find(j => j.id === jobId) || null))
    );
  }

  getPublicApprovalSummary(token: string): Observable<PublicJobApprovalSummary> {
    return this.http.get<any>(`/public/job-approvals/${token}`).pipe(
      map(payload => this.mapPublicApprovalSummary(payload))
    );
  }

  respondToPublicApproval(token: string, response: JobApprovalResponsePayload): Observable<PublicJobApprovalSummary> {
    return this.http.post<any>(`/public/job-approvals/${token}/response`, response).pipe(
      map(payload => this.mapPublicApprovalSummary(payload))
    );
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

        const completedJobs = jobs.filter(job => job.status === 'completed' && job.actualDuration);
        const averageCompletionTime = completedJobs.length > 0
          ? completedJobs.reduce((sum, job) => sum + (job.actualDuration || 0), 0) / completedJobs.length / 60
          : 0;

        const revenueToday = jobs
          .filter(job => job.status === 'completed' && job.completionDate && job.completionDate >= startOfToday)
          .reduce((sum, job) => sum + (job.actualCost || job.estimatedCost), 0);

        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const thisWeekJobs = jobs.filter(job => job.createdAt >= weekAgo);
        const thisWeekCompleted = thisWeekJobs.filter(job => job.status === 'completed');
        const efficiency = thisWeekJobs.length > 0 ? (thisWeekCompleted.length / thisWeekJobs.length) * 100 : 0;

        return { totalJobs, activeJobs, completedToday, pendingApprovals, averageCompletionTime, revenueToday, efficiency };
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
    // TODO: Wire to backend when endpoint exists
    return of([
      { id: 'oil-change', name: 'Oil Change', category: 'routine-maintenance', estimatedDuration: 30, estimatedCost: 75, description: 'Engine oil and filter replacement', requiredSkills: ['basic-maintenance'], commonParts: ['engine-oil', 'oil-filter'] },
      { id: 'brake-repair', name: 'Brake Repair', category: 'brakes', estimatedDuration: 120, estimatedCost: 200, description: 'Brake pad and disc service', requiredSkills: ['brake-systems'], commonParts: ['brake-pads', 'brake-discs', 'brake-fluid'] },
      { id: 'engine-diagnostic', name: 'Engine Diagnostic', category: 'diagnostics', estimatedDuration: 60, estimatedCost: 100, description: 'Comprehensive engine analysis', requiredSkills: ['diagnostics', 'engine-systems'], commonParts: [] }
    ]);
  }

  deleteMaintenanceJob(id: string): Observable<boolean> {
    return this.http.delete<void>(`/maintenance/${id}`).pipe(
      map(() => {
        const current = this.maintenanceJobsSubject.value;
        this.maintenanceJobsSubject.next(current.filter(j => j.id !== id));
        return true;
      })
    );
  }

  private mapFromBackend(b: any): MaintenanceJob {
    return {
      id: b.id,
      carId: b.carId,
      // BUG-098: backend nests customerId under `b.car.customerId` or
      // `b.car.customer.id` for jobs
      // (Maintenance always belongs to a (customer, car) pair via the car).
      // Reading `b.customerId` alone returned undefined and cascaded into
      // the invoice-form's "Pull from job" flow (silently clearing the
      // customer field). Prefer the nested path when present.
      customerId: b.car?.customerId ?? b.car?.customer?.id ?? b.customerId,
      mechanicId: b.employeeId || b.mechanicId,
      licensePlate: b.car?.licensePlate || b.licensePlate || '',
      customerName: (() => {
        const c = b.customer || b.car?.customer;
        if (c) return `${c.firstName || ''} ${c.lastName || ''}`.trim();
        return b.customerName || '';
      })(),
      mechanicName: b.employee ? `${b.employee.firstName || ''} ${b.employee.lastName || ''}`.trim() : (b.mechanicName || ''),
      carDetails: b.car ? [b.car.year, b.car.make, b.car.model].filter(Boolean).join(' ') : (b.carDetails || ''),
      currentMileage: b.car?.mileage || b.mileage || b.currentMileage || 0,
      jobTitle: b.title || b.jobTitle,
      description: b.description || '',
      tasks: (b.tasks || []).map((t: any) => ({
        id: t.id,
        name: t.title || t.name,
        description: t.description || '',
        status: (t.isCompleted ? 'completed' : (fromBackendEnum(t.status) || 'pending')) as TaskStatus,
        estimatedTime: t.estimatedTime || 0,
        actualTime: t.actualTime,
        assignedMechanicId: t.assignedMechanicId || t.employeeId,
        completedAt: t.completedAt ? new Date(t.completedAt) : undefined
      })),
      photos: (b.photos || []).map((p: any) => ({
        id: p.id,
        url: p.url,
        filename: p.filename || '',
        description: p.description || '',
        category: p.category || 'other',
        uploadedAt: new Date(p.uploadedAt || p.createdAt),
        uploadedBy: p.uploadedBy
      })),
      status: ((): MaintenanceStatus => {
        const s = fromBackendEnum(b.status) || 'waiting';
        return (s === 'pending' ? 'waiting' : s) as MaintenanceStatus;
      })(),
      priority: b.priority || 'medium',
      estimatedCost: b.estimatedCost || 0,
      actualCost: b.actualCost,
      estimatedDuration: b.estimatedHours ? b.estimatedHours * 60 : (b.estimatedDuration || 60),
      actualDuration: b.actualDuration,
      startDate: b.startDate ? new Date(b.startDate) : undefined,
      completionDate: b.completionDate ? new Date(b.completionDate) : undefined,
      approvalRequests: (
        Array.isArray(b.approvalRequests) && b.approvalRequests.length
          ? b.approvalRequests
          : b.approvals || []
      ).map((a: any) => this.mapApprovalFromBackend(a)),
      parts: (b.parts || b.jobParts || []).map((p: any) => this.mapPartFromBackend(p)),
      timelineEvents: (b.timelineEvents || b.timeline || []).map((e: any) => this.mapTimelineFromBackend(e)),
      notes: b.notes || '',
      createdAt: new Date(b.createdAt),
      updatedAt: new Date(b.updatedAt)
    };
  }

  private mapToBackend(f: Partial<MaintenanceJob>): any {
    const result: any = {};
    if (f.jobTitle !== undefined) result.title = f.jobTitle;
    if (f.description !== undefined) result.description = f.description;
    if (f.mechanicId !== undefined) result.employeeId = f.mechanicId;
    if (f.carId !== undefined) result.carId = f.carId;
    if (f.customerId !== undefined) result.customerId = f.customerId;
    if (f.status !== undefined) result.status = f.status === 'waiting' ? 'PENDING' : toBackendEnum(f.status);
    if (f.priority !== undefined) result.priority = f.priority;
    if (f.estimatedCost !== undefined) result.estimatedCost = f.estimatedCost;
    if (f.actualCost !== undefined) result.actualCost = f.actualCost;
    if (f.estimatedDuration !== undefined) result.estimatedHours = f.estimatedDuration / 60;
    if (f.notes !== undefined) result.notes = f.notes;
    if (f.tasks !== undefined) result.tasks = f.tasks;
    if (f.approvalRequests !== undefined) result.approvals = f.approvalRequests;
    if (f.parts !== undefined) result.parts = f.parts;
    if (f.timelineEvents !== undefined) result.timelineEvents = f.timelineEvents;
    if (f.completionDate !== undefined) result.completionDate = f.completionDate;
    if (f.currentMileage !== undefined) result.mileage = f.currentMileage;
    return result;
  }

  private mapApprovalFromBackend(a: any): ApprovalRequest {
    const status = (fromBackendEnum(a.status) || a.status || 'pending') as ApprovalStatus;
    const customerResponse = a.customerResponse
      || (status === 'approved' || status === 'rejected' ? status : undefined);
    const sentVia = a.sentVia
      || (a.sendVia && a.sendVia !== 'none'
        ? (a.sendVia === 'both' ? ['sms', 'email'] : [a.sendVia])
        : undefined);
    return {
      id: a.id,
      type: a.type || 'cost-estimate',
      description: a.description || a.summary || '',
      partName: a.partName,
      estimatedPrice: a.estimatedPrice ?? a.requestedAmount ?? a.price ?? 0,
      urgency: a.urgency || 'medium',
      requestedBy: typeof a.requestedBy === 'string' ? a.requestedBy : 'Owner',
      requestedAt: new Date(a.requestedAt || a.createdAt || Date.now()),
      status,
      approvedBy: a.approvedBy,
      approvedAt: a.approvedAt ? new Date(a.approvedAt) : undefined,
      rejectionReason: a.rejectionReason || a.reason || (status === 'rejected' ? a.responseNote : undefined),
      customerResponse,
      customerRespondedAt: (a.customerRespondedAt || a.respondedAt)
        ? new Date(a.customerRespondedAt || a.respondedAt)
        : undefined,
      respondedVia: a.respondedVia || a.responseChannel,
      sentVia,
      sentTo: a.sentTo,
      token: a.token || a.publicToken,
      comments: a.comments || a.note || a.responseNote
    };
  }

  private mapPartFromBackend(part: any): MaintenancePart {
    const nestedPart = part.part || {};
    return {
      id: part.id,
      name: part.name || part.partName || nestedPart.name || part.description || 'Part',
      partNumber: part.partNumber || nestedPart.partNumber,
      quantity: part.quantity ?? 1,
      unitPrice: part.unitPrice || part.price || 0,
      totalPrice: part.totalPrice || (part.quantity ? part.unitPrice * part.quantity : undefined),
      supplier: part.supplier || part.vendor,
      notes: part.notes || part.description,
      createdAt: part.createdAt ? new Date(part.createdAt) : undefined,
      updatedAt: part.updatedAt ? new Date(part.updatedAt) : undefined
    };
  }

  private mapPartToBackend(part: Partial<MaintenancePart>): any {
    return {
      ...(part.name !== undefined ? { name: part.name } : {}),
      ...(part.partNumber !== undefined ? { partNumber: part.partNumber } : {}),
      ...(part.quantity !== undefined ? { quantity: part.quantity } : {}),
      ...(part.unitPrice !== undefined ? { unitPrice: part.unitPrice } : {}),
      ...(part.notes !== undefined ? { notes: part.notes } : {}),
      ...(part.supplier !== undefined ? { supplier: part.supplier } : {})
    };
  }

  private mapTimelineFromBackend(event: any): MaintenanceTimelineEvent {
    const occurredAt = event.occurredAt || event.createdAt || event.timestamp;
    return {
      id: event.id,
      type: event.type || event.eventType || 'job-event',
      label: event.label || event.title,
      description: event.description || event.message,
      actorName: event.actorName || event.actor || event.performedBy,
      actorId: event.actorId,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      metadata: event.metadata || event.data || event.details
    };
  }

  private mapPublicApprovalSummary(payload: any): PublicJobApprovalSummary {
    const request = payload.request || {};
    const job = payload.job || request.maintenanceJob || {};
    const car = job.car || {};
    const customer = car.customer || {};
    const requestStatus = fromBackendEnum(request.status) || request.status || 'pending';
    const responded = requestStatus === 'approved' || requestStatus === 'rejected';
    const mappedRequest: ApprovalRequest = this.mapApprovalFromBackend(request);
    const customerName = payload.customerName
      || payload.name
      || [customer.firstName, customer.lastName].filter(Boolean).join(' ');
    const carDetails = payload.carDetails
      || payload.car
      || [car.year, car.make, car.model].filter(Boolean).join(' ');
    return {
      token: payload.token || payload.approvalToken || request.token || request.publicToken || '',
      jobId: payload.jobId || request.jobId || request.maintenanceJobId || job.id || '',
      jobTitle: payload.jobTitle || payload.title || request.jobTitle || job.title || '',
      customerName,
      carDetails,
      licensePlate: payload.licensePlate || car.licensePlate || '',
      status: requestStatus as 'pending' | 'approved' | 'rejected',
      request: mappedRequest,
      alreadyResponded: !!responded || !!payload.alreadyResponded,
      respondedAt: payload.respondedAt ? new Date(payload.respondedAt) : undefined,
      respondedBy: payload.respondedBy || request.respondedBy,
      respondedVia: payload.respondedVia || request.respondedVia || request.responseChannel,
      timeline: (payload.timeline || []).map((event: any) => this.mapTimelineFromBackend(event))
    };
  }

  private syncJobIntoStore(job: MaintenanceJob): void {
    const current = this.maintenanceJobsSubject.value;
    const index = current.findIndex(j => j.id === job.id);
    if (index !== -1) {
      const updatedJobs = [...current];
      updatedJobs[index] = job;
      this.maintenanceJobsSubject.next(updatedJobs);
    } else {
      this.maintenanceJobsSubject.next([...current, job]);
    }
    if (this.selectedJob()?.id === job.id) {
      this.selectedJob.set(job);
    }
  }

  private syncJobAfterPartRemoval(job: MaintenanceJob, partId: string): MaintenanceJob {
    return {
      ...job,
      parts: job.parts.filter(p => p.id !== partId)
    };
  }

  private applyFilters(jobs: MaintenanceJob[], filters?: MaintenanceFilters): MaintenanceJob[] {
    if (!filters) return jobs;

    return jobs.filter(job => {
      if (filters.status && filters.status.length > 0 && !filters.status.includes(job.status)) return false;
      if (filters.priority && filters.priority.length > 0 && !filters.priority.includes(job.priority)) return false;
      if (filters.mechanicId && job.mechanicId !== filters.mechanicId) return false;
      if (filters.dateRange) {
        const jobDate = job.createdAt;
        if (jobDate < filters.dateRange.start || jobDate > filters.dateRange.end) return false;
      }
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const searchableText = [job.jobTitle, job.description, job.licensePlate, job.customerName, job.carDetails].join(' ').toLowerCase();
        if (!searchableText.includes(searchLower)) return false;
      }
      if (filters.carMake && !job.carDetails.toLowerCase().includes(filters.carMake.toLowerCase())) return false;
      return true;
    });
  }
}
