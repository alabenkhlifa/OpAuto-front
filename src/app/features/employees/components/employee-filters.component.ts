import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeeFilters, EmployeeRole, EmployeeDepartment, EmployeeStatus, ExperienceLevel } from '../../../core/models/employee.model';

@Component({
  selector: 'app-employee-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="glass-card">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-white">Filters</h3>
        <button 
          class="btn-clear-filters"
          (click)="clearFilters()">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear All
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        <!-- Search -->
        <div class="lg:col-span-2">
          <label class="form-label">
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
          <label class="form-label">
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
          <label class="form-label">
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
          <label class="form-label">
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
          <label class="form-label">
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
    /* Component uses global form classes from /src/styles/forms.css */
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