import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { 
  Approval, 
  ApprovalFilter, 
  ApprovalStats,
  ApprovalType,
  ApprovalStatus,
  ApprovalPriority,
  APPROVAL_TYPE_LABELS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_PRIORITY_LABELS 
} from '../../core/models/approval.model';
import { ApprovalService } from '../../core/services/approval.service';
import { ApprovalModalComponent } from './components/approval-modal.component';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ApprovalModalComponent],
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      
      <!-- Header -->
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Approval Requests</h1>
          <p class="text-gray-600 dark:text-gray-400">Manage and review pending approval requests</p>
        </div>
        
        <div class="flex items-center space-x-3 mt-4 lg:mt-0">
          <button 
            class="btn-secondary text-sm"
            (click)="refreshApprovals()">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          
          @if (selectedApprovals().length > 0) {
            <div class="flex items-center space-x-2">
              <button 
                class="btn-success text-sm"
                (click)="bulkApprove()"
                [disabled]="isBulkProcessing()">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Approve ({{ selectedApprovals().length }})
              </button>
              
              <button 
                class="btn-danger text-sm"
                (click)="bulkReject()"
                [disabled]="isBulkProcessing()">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject ({{ selectedApprovals().length }})
              </button>
            </div>
          }
        </div>
      </div>

      <!-- Stats Cards -->
      @if (stats()) {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center">
              <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                <p class="text-xl font-semibold text-gray-900 dark:text-white">{{ stats()!.pending }}</p>
              </div>
            </div>
          </div>

          <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center">
              <div class="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                <svg class="w-5 h-5 text-red-600 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-gray-600 dark:text-gray-400">Overdue</p>
                <p class="text-xl font-semibold text-gray-900 dark:text-white">{{ stats()!.overdue }}</p>
              </div>
            </div>
          </div>

          <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center">
              <div class="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <svg class="w-5 h-5 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-gray-600 dark:text-gray-400">Approved</p>
                <p class="text-xl font-semibold text-gray-900 dark:text-white">{{ stats()!.approved }}</p>
              </div>
            </div>
          </div>

          <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-center">
              <div class="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <svg class="w-5 h-5 text-purple-600 dark:text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-gray-600 dark:text-gray-400">Total</p>
                <p class="text-xl font-semibold text-gray-900 dark:text-white">{{ stats()!.total }}</p>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Filters -->
      <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <form [formGroup]="filterForm" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <!-- Search -->
            <div>
              <label class="form-label">Search</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="searchQuery"
                placeholder="Search approvals...">
            </div>

            <!-- Status Filter -->
            <div>
              <label class="form-label">Status</label>
              <select class="form-select" formControlName="status">
                <option value="">All Status</option>
                @for (status of statusOptions; track status.value) {
                  <option [value]="status.value">{{ status.label }}</option>
                }
              </select>
            </div>

            <!-- Type Filter -->
            <div>
              <label class="form-label">Type</label>
              <select class="form-select" formControlName="type">
                <option value="">All Types</option>
                @for (type of typeOptions; track type.value) {
                  <option [value]="type.value">{{ type.label }}</option>
                }
              </select>
            </div>

            <!-- Priority Filter -->
            <div>
              <label class="form-label">Priority</label>
              <select class="form-select" formControlName="priority">
                <option value="">All Priorities</option>
                @for (priority of priorityOptions; track priority.value) {
                  <option [value]="priority.value">{{ priority.label }}</option>
                }
              </select>
            </div>

          </div>

          <div class="flex items-center justify-between">
            <button 
              type="button"
              class="btn-secondary text-sm"
              (click)="resetFilters()">
              Reset Filters
            </button>
            
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {{ filteredApprovals().length }} of {{ approvals().length }} approvals
            </div>
          </div>
        </form>
      </div>

      <!-- Approvals List -->
      <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700">
        
        <!-- List Header -->
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Approval Requests</h2>
            
            @if (filteredApprovals().length > 0) {
              <div class="flex items-center space-x-2">
                <input 
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  [checked]="isAllSelected()"
                  [indeterminate]="isSomeSelected()"
                  (change)="toggleSelectAll()">
                <span class="text-sm text-gray-600 dark:text-gray-400">Select All</span>
              </div>
            }
          </div>
        </div>

        <!-- List Content -->
        <div class="p-6">
          @if (isLoading()) {
            <div class="flex items-center justify-center py-12">
              <svg class="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="ml-2 text-gray-600 dark:text-gray-400">Loading approvals...</span>
            </div>
          } @else if (filteredApprovals().length === 0) {
            <div class="text-center py-12">
              <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No approvals found</h3>
              <p class="text-gray-600 dark:text-gray-400">There are no approval requests matching your criteria.</p>
            </div>
          } @else {
            <div class="space-y-4">
              @for (approval of filteredApprovals(); track approval.id) {
                <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div class="flex items-start space-x-3">
                    
                    <!-- Checkbox -->
                    <input 
                      type="checkbox"
                      class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      [checked]="selectedApprovals().includes(approval.id)"
                      (change)="toggleSelection(approval.id)">

                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <h3 class="text-md font-medium text-gray-900 dark:text-white mb-1">
                            {{ approval.title }}
                          </h3>
                          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {{ approval.description }}
                          </p>
                          
                          <!-- Meta Information -->
                          <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span class="flex items-center">
                              <svg class="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {{ approval.requestedBy.name }}
                            </span>
                            
                            <span class="flex items-center">
                              <svg class="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {{ approval.requestedAt | date:'MMM d, y' }}
                            </span>
                            
                            @if (approval.estimatedCost) {
                              <span class="flex items-center">
                                <svg class="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                                {{ approval.estimatedCost }} {{ approval.currency }}
                              </span>
                            }
                          </div>
                        </div>

                        <!-- Badges and Actions -->
                        <div class="flex items-start space-x-2 ml-4">
                          <!-- Type Badge -->
                          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {{ getTypeLabel(approval.type) }}
                          </span>
                          
                          <!-- Priority Badge -->
                          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                [class]="getPriorityBadgeClass(approval.priority)">
                            {{ getPriorityLabel(approval.priority) }}
                          </span>
                          
                          <!-- Status Badge -->
                          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                [class]="getStatusBadgeClass(approval.status)">
                            {{ getStatusLabel(approval.status) }}
                          </span>
                        </div>
                      </div>

                      <!-- Action Buttons -->
                      @if (approval.status === 'pending' || approval.status === 'info_requested') {
                        <div class="flex items-center space-x-2 mt-3">
                          <button 
                            class="btn-success text-sm"
                            (click)="approveRequest(approval.id)">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Approve
                          </button>
                          
                          <button 
                            class="btn-danger text-sm"
                            (click)="rejectRequest(approval.id)">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Reject
                          </button>
                          
                          <button 
                            class="btn-secondary text-sm"
                            (click)="requestMoreInfo(approval.id)">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Request Info
                          </button>
                          
                          <button 
                            class="btn-secondary text-sm"
                            (click)="viewDetails(approval)">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Details
                          </button>
                        </div>
                      } @else {
                        <div class="flex items-center space-x-2 mt-3">
                          <button 
                            class="btn-secondary text-sm"
                            (click)="viewDetails(approval)">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Details
                          </button>
                          
                          @if (approval.status === 'approved' || approval.status === 'rejected') {
                            <span class="text-sm text-gray-500 dark:text-gray-400">
                              {{ approval.status === 'approved' ? 'Approved' : 'Rejected' }} by 
                              {{ approval.status === 'approved' ? approval.approvedBy?.name : approval.rejectedBy?.name }}
                              on {{ (approval.status === 'approved' ? approval.approvedAt : approval.rejectedAt) | date:'MMM d, y' }}
                            </span>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>

    <!-- Approval Modal -->
    @if (selectedApprovalForModal()) {
      <app-approval-modal
        [approval]="selectedApprovalForModal()!"
        [isOpen]="true"
        (close)="closeModal()"
        (action)="handleApprovalAction($event)">
      </app-approval-modal>
    }
  `,
  styles: [`
    .form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.25rem;
    }
    
    .dark .form-label {
      color: #d1d5db;
    }
    
    .form-input, .form-select {
      display: block;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      background-color: white;
      color: #111827;
      font-size: 0.875rem;
    }
    
    .form-input:focus, .form-select:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    
    .dark .form-input, .dark .form-select {
      background-color: #1f2937;
      border-color: #4b5563;
      color: #f9fafb;
    }
    
    .dark .form-input:focus, .dark .form-select:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .btn-success {
      display: inline-flex;
      align-items: center;
      padding: 0.375rem 0.75rem;
      border: 1px solid transparent;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.375rem;
      color: white;
      background-color: #16a34a;
      gap: 0.25rem;
    }
    
    .btn-success:hover:not(:disabled) {
      background-color: #15803d;
    }
    
    .btn-danger {
      display: inline-flex;
      align-items: center;
      padding: 0.375rem 0.75rem;
      border: 1px solid transparent;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.375rem;
      color: white;
      background-color: #dc2626;
      gap: 0.25rem;
    }
    
    .btn-danger:hover:not(:disabled) {
      background-color: #b91c1c;
    }
    
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      padding: 0.375rem 0.75rem;
      border: 1px solid #d1d5db;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.375rem;
      color: #374151;
      background-color: white;
      gap: 0.25rem;
    }
    
    .btn-secondary:hover {
      background-color: #f9fafb;
    }
    
    .dark .btn-secondary {
      border-color: #4b5563;
      color: #d1d5db;
      background-color: #1f2937;
    }
    
    .dark .btn-secondary:hover {
      background-color: #374151;
    }
  `]
})
export class ApprovalsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private approvalService = inject(ApprovalService);
  private destroy$ = new Subject<void>();

  approvals = signal<Approval[]>([]);
  filteredApprovals = signal<Approval[]>([]);
  stats = signal<ApprovalStats | null>(null);
  isLoading = signal(true);
  selectedApprovals = signal<string[]>([]);
  selectedApprovalForModal = signal<Approval | null>(null);
  isBulkProcessing = signal(false);

  filterForm!: FormGroup;

  statusOptions = Object.values(ApprovalStatus).map(status => ({
    value: status,
    label: APPROVAL_STATUS_LABELS[status]
  }));

  typeOptions = Object.values(ApprovalType).map(type => ({
    value: type,
    label: APPROVAL_TYPE_LABELS[type]
  }));

  priorityOptions = Object.values(ApprovalPriority).map(priority => ({
    value: priority,
    label: APPROVAL_PRIORITY_LABELS[priority]
  }));

  ngOnInit() {
    this.initializeFilterForm();
    this.loadApprovals();
    this.loadStats();
    this.setupFilterWatcher();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeFilterForm() {
    this.filterForm = this.fb.group({
      searchQuery: [''],
      status: [''],
      type: [''],
      priority: ['']
    });
  }

  private setupFilterWatcher() {
    this.filterForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });
  }

  private loadApprovals() {
    this.isLoading.set(true);
    
    this.approvalService.getApprovals()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (approvals) => {
          this.approvals.set(approvals);
          this.applyFilters();
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading approvals:', error);
          this.isLoading.set(false);
        }
      });
  }

  private loadStats() {
    this.approvalService.getApprovalStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats.set(stats);
        },
        error: (error) => {
          console.error('Error loading approval stats:', error);
        }
      });
  }

  private applyFilters() {
    const formValue = this.filterForm.value;
    const filter: ApprovalFilter = {};

    if (formValue.searchQuery) {
      filter.searchQuery = formValue.searchQuery;
    }

    if (formValue.status) {
      filter.status = [formValue.status];
    }

    if (formValue.type) {
      filter.type = [formValue.type];
    }

    if (formValue.priority) {
      filter.priority = [formValue.priority];
    }

    this.approvalService.getApprovals(filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (filtered) => {
          this.filteredApprovals.set(filtered);
        }
      });
  }

  refreshApprovals() {
    this.loadApprovals();
    this.loadStats();
  }

  resetFilters() {
    this.filterForm.reset();
    this.filteredApprovals.set(this.approvals());
  }

  toggleSelection(approvalId: string) {
    const current = this.selectedApprovals();
    if (current.includes(approvalId)) {
      this.selectedApprovals.set(current.filter(id => id !== approvalId));
    } else {
      this.selectedApprovals.set([...current, approvalId]);
    }
  }

  toggleSelectAll() {
    const currentSelection = this.selectedApprovals();
    const allIds = this.filteredApprovals().map(a => a.id);
    
    if (currentSelection.length === allIds.length) {
      this.selectedApprovals.set([]);
    } else {
      this.selectedApprovals.set(allIds);
    }
  }

  isAllSelected(): boolean {
    const current = this.selectedApprovals();
    const all = this.filteredApprovals().map(a => a.id);
    return current.length > 0 && current.length === all.length;
  }

  isSomeSelected(): boolean {
    const current = this.selectedApprovals();
    const all = this.filteredApprovals().map(a => a.id);
    return current.length > 0 && current.length < all.length;
  }

  approveRequest(approvalId: string) {
    this.approvalService.processApproval({
      approvalId,
      action: 'approve'
    }).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.refreshApprovals();
      }
    });
  }

  rejectRequest(approvalId: string) {
    this.approvalService.processApproval({
      approvalId,
      action: 'reject'
    }).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.refreshApprovals();
      }
    });
  }

  requestMoreInfo(approvalId: string) {
    this.approvalService.processApproval({
      approvalId,
      action: 'request_info',
      comment: 'More information needed before approval'
    }).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.refreshApprovals();
      }
    });
  }

  viewDetails(approval: Approval) {
    this.selectedApprovalForModal.set(approval);
  }

  closeModal() {
    this.selectedApprovalForModal.set(null);
  }

  handleApprovalAction(event: { action: string; comment?: string }) {
    const approval = this.selectedApprovalForModal();
    if (!approval) return;

    this.approvalService.processApproval({
      approvalId: approval.id,
      action: event.action as 'approve' | 'reject' | 'request_info',
      comment: event.comment
    }).pipe(takeUntil(this.destroy$))
    .subscribe({
      next: () => {
        this.refreshApprovals();
        this.closeModal();
      }
    });
  }

  bulkApprove() {
    this.isBulkProcessing.set(true);
    
    this.approvalService.bulkAction(this.selectedApprovals(), 'approve')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.selectedApprovals.set([]);
          this.refreshApprovals();
          this.isBulkProcessing.set(false);
        },
        error: () => {
          this.isBulkProcessing.set(false);
        }
      });
  }

  bulkReject() {
    this.isBulkProcessing.set(true);
    
    this.approvalService.bulkAction(this.selectedApprovals(), 'reject')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.selectedApprovals.set([]);
          this.refreshApprovals();
          this.isBulkProcessing.set(false);
        },
        error: () => {
          this.isBulkProcessing.set(false);
        }
      });
  }

  getTypeLabel(type: ApprovalType): string {
    return APPROVAL_TYPE_LABELS[type];
  }

  getStatusLabel(status: ApprovalStatus): string {
    return APPROVAL_STATUS_LABELS[status];
  }

  getPriorityLabel(priority: ApprovalPriority): string {
    return APPROVAL_PRIORITY_LABELS[priority];
  }

  getPriorityBadgeClass(priority: ApprovalPriority): string {
    const classes = {
      [ApprovalPriority.LOW]: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      [ApprovalPriority.MEDIUM]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      [ApprovalPriority.HIGH]: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      [ApprovalPriority.URGENT]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return classes[priority];
  }

  getStatusBadgeClass(status: ApprovalStatus): string {
    const classes = {
      [ApprovalStatus.PENDING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      [ApprovalStatus.APPROVED]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      [ApprovalStatus.REJECTED]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      [ApprovalStatus.INFO_REQUESTED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      [ApprovalStatus.CANCELLED]: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    };
    return classes[status];
  }
}