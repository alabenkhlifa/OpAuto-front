import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeeFilters, EmployeeRole, EmployeeDepartment, EmployeeStatus, ExperienceLevel } from '../../../core/models/employee.model';

@Component({
  selector: 'app-employee-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
        <button 
          class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          (click)="clearFilters()">
          Clear All
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        <!-- Search -->
        <div class="lg:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search
          </label>
          <input 
            type="text" 
            class="form-input"
            placeholder="Name, email, employee #..."
            [(ngModel)]="localFilters.searchTerm"
            (ngModelChange)="onFilterChange()">
        </div>

        <!-- Role Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Role
          </label>
          <select 
            class="form-select"
            [(ngModel)]="selectedRole"
            (ngModelChange)="onRoleChange($event)">
            <option value="">All Roles</option>
            @for (role of roleOptions; track role.value) {
              <option [value]="role.value">{{ role.label }}</option>
            }
          </select>
        </div>

        <!-- Department Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Department
          </label>
          <select 
            class="form-select"
            [(ngModel)]="selectedDepartment"
            (ngModelChange)="onDepartmentChange($event)">
            <option value="">All Departments</option>
            @for (dept of departmentOptions; track dept.value) {
              <option [value]="dept.value">{{ dept.label }}</option>
            }
          </select>
        </div>

        <!-- Status Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select 
            class="form-select"
            [(ngModel)]="selectedStatus"
            (ngModelChange)="onStatusChange($event)">
            <option value="">All Status</option>
            @for (status of statusOptions; track status.value) {
              <option [value]="status.value">{{ status.label }}</option>
            }
          </select>
        </div>

        <!-- Availability Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Availability
          </label>
          <select 
            class="form-select"
            [(ngModel)]="selectedAvailability"
            (ngModelChange)="onAvailabilityChange($event)">
            <option value="">All</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .form-input {
      display: block;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      background-color: white;
      color: #111827;
      font-size: 0.875rem;
    }
    
    .form-input:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    
    .form-select {
      display: block;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      background-color: white;
      color: #111827;
      font-size: 0.875rem;
    }
    
    .form-select:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    
    .dark .form-input,
    .dark .form-select {
      background-color: #1f2937;
      border-color: #4b5563;
      color: #f9fafb;
    }
    
    .dark .form-input:focus,
    .dark .form-select:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
  `]
})
export class EmployeeFiltersComponent {
  @Input() filters: EmployeeFilters = {};
  @Output() filtersChange = new EventEmitter<EmployeeFilters>();

  localFilters: EmployeeFilters = {};
  selectedRole = '';
  selectedDepartment = '';
  selectedStatus = '';
  selectedAvailability = '';

  roleOptions = [
    { value: 'admin', label: 'Administrator' },
    { value: 'senior-mechanic', label: 'Senior Mechanic' },
    { value: 'junior-mechanic', label: 'Junior Mechanic' },
    { value: 'apprentice', label: 'Apprentice' },
    { value: 'service-advisor', label: 'Service Advisor' }
  ];

  departmentOptions = [
    { value: 'management', label: 'Management' },
    { value: 'mechanical', label: 'Mechanical' },
    { value: 'bodywork', label: 'Bodywork' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'service', label: 'Service' }
  ];

  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'on-leave', label: 'On Leave' },
    { value: 'terminated', label: 'Terminated' }
  ];

  ngOnInit() {
    this.localFilters = { ...this.filters };
    this.initializeSelectValues();
  }

  private initializeSelectValues() {
    this.selectedRole = this.localFilters.role?.[0] || '';
    this.selectedDepartment = this.localFilters.department?.[0] || '';
    this.selectedStatus = this.localFilters.status?.[0] || '';
    this.selectedAvailability = this.localFilters.isAvailable !== undefined ? String(this.localFilters.isAvailable) : '';
  }

  onFilterChange() {
    this.emitFilters();
  }

  onRoleChange(role: string) {
    this.localFilters.role = role ? [role as EmployeeRole] : undefined;
    this.emitFilters();
  }

  onDepartmentChange(department: string) {
    this.localFilters.department = department ? [department as EmployeeDepartment] : undefined;
    this.emitFilters();
  }

  onStatusChange(status: string) {
    this.localFilters.status = status ? [status as EmployeeStatus] : undefined;
    this.emitFilters();
  }

  onAvailabilityChange(availability: string) {
    this.localFilters.isAvailable = availability === '' ? undefined : availability === 'true';
    this.emitFilters();
  }

  clearFilters() {
    this.localFilters = {};
    this.selectedRole = '';
    this.selectedDepartment = '';
    this.selectedStatus = '';
    this.selectedAvailability = '';
    this.emitFilters();
  }

  private emitFilters() {
    this.filtersChange.emit({ ...this.localFilters });
  }
}