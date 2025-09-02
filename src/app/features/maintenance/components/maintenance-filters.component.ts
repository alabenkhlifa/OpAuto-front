import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceFilters, MaintenanceStatus, MaintenancePriority } from '../../../core/models/maintenance.model';

@Component({
  selector: 'app-maintenance-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Filters</h3>
        <button 
          class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
          (click)="clearFilters()">
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
            class="px-3 py-1 text-xs font-medium rounded-full border"
            [class]="isQuickFilterActive(quickFilter) ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'"
            (click)="applyQuickFilter(quickFilter)">
            {{ quickFilter.label }}
          </button>
        }
      </div>

    </div>
  `
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