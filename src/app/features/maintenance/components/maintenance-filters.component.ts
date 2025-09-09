import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceFilters, MaintenanceStatus, MaintenancePriority } from '../../../core/models/maintenance.model';

@Component({
  selector: 'app-maintenance-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="glass-card">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Filters</h3>
        <button 
          class="btn-clear-filters"
          (click)="clearFilters()">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear All
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- Search -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search
          </label>
          <input
            type="text"
            [(ngModel)]="localFilters.searchTerm"
            (ngModelChange)="onFilterChange()"
            placeholder="Job title, customer, license plate..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm">
        </div>

        <!-- Status Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            [(ngModel)]="selectedStatus"
            (ngModelChange)="onStatusChange($event)"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm">
            <option value="">All Statuses</option>
            @for (status of statusOptions; track status.value) {
              <option [value]="status.value">{{ status.label }}</option>
            }
          </select>
        </div>

        <!-- Priority Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Priority
          </label>
          <select
            [(ngModel)]="selectedPriority"
            (ngModelChange)="onPriorityChange($event)"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm">
            <option value="">All Priorities</option>
            @for (priority of priorityOptions; track priority.value) {
              <option [value]="priority.value">{{ priority.label }}</option>
            }
          </select>
        </div>

        <!-- Mechanic Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mechanic
          </label>
          <select
            [(ngModel)]="localFilters.mechanicId"
            (ngModelChange)="onFilterChange()"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm">
            <option value="">All Mechanics</option>
            @for (mechanic of mechanicOptions; track mechanic.id) {
              <option [value]="mechanic.id">{{ mechanic.name }}</option>
            }
          </select>
        </div>

      </div>

      <!-- Date Range Filter -->
      <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            From Date
          </label>
          <input
            type="date"
            [(ngModel)]="startDate"
            (ngModelChange)="onDateRangeChange()"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            To Date
          </label>
          <input
            type="date"
            [(ngModel)]="endDate"
            (ngModelChange)="onDateRangeChange()"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm">
        </div>
      </div>

      <!-- Quick Filter Buttons -->
      <div class="mt-4 flex flex-wrap gap-2">
        @for (quickFilter of quickFilters; track quickFilter.label) {
          <button
            [class]="isQuickFilterActive(quickFilter) ? 'btn-filter-chip active' : 'btn-filter-chip'"
            (click)="applyQuickFilter(quickFilter)">
            {{ quickFilter.label }}
          </button>
        }
      </div>

    </div>
  `,
  styles: [`
    /* Dark glassmorphism card styling */
    .glass-card {
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(75, 85, 99, 0.6);
      border-radius: 20px;
      padding: 1.5rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      margin-bottom: 1rem;
    }

    .glass-card:hover {
      background: rgba(31, 41, 55, 0.98);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8);
      border-color: rgba(59, 130, 246, 0.7);
      transform: translateY(-2px);
    }

    /* Fix text colors for permanent dark theme */
    .glass-card h3,
    .glass-card .text-gray-900 {
      color: #ffffff !important;
    }

    .glass-card .text-gray-700,
    .glass-card .text-gray-600 {
      color: #d1d5db !important;
    }

    .glass-card .text-gray-300 {
      color: #9ca3af !important;
    }

    /* Component uses global button system from /src/styles/buttons.css */
  `]
})
export class MaintenanceFiltersComponent {
  @Input() filters: MaintenanceFilters = {};
  @Output() filtersChange = new EventEmitter<MaintenanceFilters>();

  localFilters: MaintenanceFilters = {};
  selectedStatus = '';
  selectedPriority = '';
  startDate = '';
  endDate = '';

  statusOptions = [
    { value: 'waiting', label: 'Waiting' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'waiting-approval', label: 'Needs Approval' },
    { value: 'waiting-parts', label: 'Waiting for Parts' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  priorityOptions = [
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  mechanicOptions = [
    { id: 'mechanic-001', name: 'Mohamed Trabelsi' },
    { id: 'mechanic-002', name: 'Ali Sassi' },
    { id: 'mechanic-003', name: 'Ahmed Bouzid' }
  ];

  quickFilters = [
    { label: 'High Priority', filter: { priority: ['high', 'urgent'] as MaintenancePriority[] } },
    { label: 'Needs Approval', filter: { status: ['waiting-approval'] as MaintenanceStatus[] } },
    { label: 'In Progress', filter: { status: ['in-progress'] as MaintenanceStatus[] } },
    { label: 'Today', filter: { dateRange: this.getTodayRange() } },
    { label: 'This Week', filter: { dateRange: this.getThisWeekRange() } }
  ];

  ngOnInit() {
    this.localFilters = { ...this.filters };
    this.initializeFormFields();
  }

  ngOnChanges() {
    this.localFilters = { ...this.filters };
    this.initializeFormFields();
  }

  private initializeFormFields() {
    this.selectedStatus = this.localFilters.status?.[0] || '';
    this.selectedPriority = this.localFilters.priority?.[0] || '';
    
    if (this.localFilters.dateRange) {
      this.startDate = this.formatDateForInput(this.localFilters.dateRange.start);
      this.endDate = this.formatDateForInput(this.localFilters.dateRange.end);
    }
  }

  onFilterChange() {
    this.filtersChange.emit(this.localFilters);
  }

  onStatusChange(status: string) {
    if (status) {
      this.localFilters.status = [status as MaintenanceStatus];
    } else {
      delete this.localFilters.status;
    }
    this.onFilterChange();
  }

  onPriorityChange(priority: string) {
    if (priority) {
      this.localFilters.priority = [priority as MaintenancePriority];
    } else {
      delete this.localFilters.priority;
    }
    this.onFilterChange();
  }

  onDateRangeChange() {
    if (this.startDate && this.endDate) {
      this.localFilters.dateRange = {
        start: new Date(this.startDate),
        end: new Date(this.endDate)
      };
    } else {
      delete this.localFilters.dateRange;
    }
    this.onFilterChange();
  }

  clearFilters() {
    this.localFilters = {};
    this.selectedStatus = '';
    this.selectedPriority = '';
    this.startDate = '';
    this.endDate = '';
    this.onFilterChange();
  }

  applyQuickFilter(quickFilter: any) {
    this.localFilters = { ...quickFilter.filter };
    this.initializeFormFields();
    this.onFilterChange();
  }

  isQuickFilterActive(quickFilter: any): boolean {
    // Simple check - could be more sophisticated
    if (quickFilter.filter.status) {
      return this.localFilters.status?.includes(quickFilter.filter.status[0]) || false;
    }
    if (quickFilter.filter.priority) {
      return this.localFilters.priority?.some(p => quickFilter.filter.priority.includes(p)) || false;
    }
    return false;
  }

  private getTodayRange() {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    return { start, end };
  }

  private getThisWeekRange() {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}