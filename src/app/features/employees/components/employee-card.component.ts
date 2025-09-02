import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Employee, EmployeeRole, EmployeeDepartment, EmployeeStatus } from '../../../core/models/employee.model';

@Component({
  selector: 'app-employee-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200">
      
      <!-- Header -->
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center space-x-3">
          <!-- Avatar -->
          <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
            {{ getInitials(employee.personalInfo.fullName) }}
          </div>
          
          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {{ employee.personalInfo.fullName }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ employee.employeeNumber }} • {{ getRoleLabel(employee.employment.role) }}
            </p>
          </div>
        </div>
        
        <!-- Status Badge -->
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              [class]="getStatusClasses(employee.employment.status)">
          {{ getStatusLabel(employee.employment.status) }}
        </span>
      </div>

      <!-- Department & Contact -->
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Department</p>
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ getDepartmentLabel(employee.employment.department) }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Phone</p>
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ employee.personalInfo.phone }}</p>
        </div>
      </div>

      <!-- Availability & Workload -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Availability
          </span>
          <div class="flex items-center">
            <div class="w-2 h-2 rounded-full mr-2" [class]="getAvailabilityColor(employee.availability.isAvailable)"></div>
            <span class="text-sm font-medium" [class]="getAvailabilityTextColor(employee.availability.isAvailable)">
              {{ employee.availability.isAvailable ? 'Available' : 'Unavailable' }}
            </span>
          </div>
        </div>
        
        @if (employee.availability.isAvailable) {
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600 dark:text-gray-400">Current Workload</span>
            <span class="text-gray-900 dark:text-white">{{ employee.availability.currentWorkload }}/{{ employee.availability.maxWorkload }}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div class="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all" 
                 [style.width.%]="getWorkloadPercentage(employee)"></div>
          </div>
        } @else if (employee.availability.unavailableReason) {
          <p class="text-sm text-gray-600 dark:text-gray-300">{{ employee.availability.unavailableReason }}</p>
          @if (employee.availability.unavailableUntil) {
            <p class="text-xs text-gray-500 dark:text-gray-400">Until: {{ employee.availability.unavailableUntil | date:'short' }}</p>
          }
        }
      </div>

      <!-- Skills & Experience -->
      <div class="mb-4">
        <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Specialties</p>
        <div class="flex flex-wrap gap-1">
          @for (specialty of employee.skills.specialties.slice(0, 3); track specialty) {
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
              {{ specialty }}
            </span>
          }
          @if (employee.skills.specialties.length > 3) {
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              +{{ employee.skills.specialties.length - 3 }} more
            </span>
          }
        </div>
      </div>

      <!-- Performance (Grid view only) -->
      @if (view === 'grid') {
        <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <p class="text-gray-500 dark:text-gray-400">Completed Jobs</p>
            <p class="font-medium text-gray-900 dark:text-white">{{ employee.performance.completedJobs }}</p>
          </div>
          <div>
            <p class="text-gray-500 dark:text-gray-400">Rating</p>
            <div class="flex items-center">
              <span class="font-medium text-gray-900 dark:text-white mr-1">{{ employee.performance.customerRating.toFixed(1) }}</span>
              <div class="flex text-yellow-400">
                @for (star of getStarArray(employee.performance.customerRating); track $index) {
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Actions -->
      <div class="flex space-x-2">
        <button 
          class="flex-1 btn-outline text-sm py-2"
          (click)="viewDetails.emit(employee.id)">
          View Details
        </button>
        
        <button 
          class="flex-1 btn-primary text-sm py-2"
          (click)="edit.emit(employee.id)">
          Edit
        </button>

        <!-- Availability Toggle -->
        @if (employee.employment.status === 'active') {
          <button 
            class="btn-icon"
            [class]="employee.availability.isAvailable ? 'btn-warning' : 'btn-success'"
            (click)="toggleAvailability.emit({employeeId: employee.id, isAvailable: !employee.availability.isAvailable})"
            [title]="employee.availability.isAvailable ? 'Mark Unavailable' : 'Mark Available'">
            @if (employee.availability.isAvailable) {
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636" />
              </svg>
            } @else {
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          </button>
        }
      </div>

    </div>
  `,
  styles: [`
    .btn-outline {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      border: 1px solid #d1d5db;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.375rem;
      color: #374151;
      background-color: white;
    }
    
    .btn-outline:hover {
      background-color: #f9fafb;
    }
    
    .btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
      border: 1px solid transparent;
      border-radius: 0.375rem;
      font-weight: 500;
    }
    
    .btn-warning {
      color: white;
      background-color: #f59e0b;
    }
    
    .btn-warning:hover {
      background-color: #d97706;
    }
    
    .btn-success {
      color: white;
      background-color: #059669;
    }
    
    .btn-success:hover {
      background-color: #047857;
    }
    
    .dark .btn-outline {
      border-color: #4b5563;
      color: #d1d5db;
      background-color: #1f2937;
    }
    
    .dark .btn-outline:hover {
      background-color: #374151;
    }
  `]
})
export class EmployeeCardComponent {
  @Input() employee!: Employee;
  @Input() view: 'list' | 'grid' = 'grid';
  
  @Output() edit = new EventEmitter<string>();
  @Output() viewDetails = new EventEmitter<string>();
  @Output() toggleAvailability = new EventEmitter<{employeeId: string, isAvailable: boolean, reason?: string}>();

  getInitials(fullName: string): string {
    return fullName.split(' ').map(name => name.charAt(0)).join('').toUpperCase().slice(0, 2);
  }

  getRoleLabel(role: EmployeeRole): string {
    const labels = {
      'admin': 'Administrator',
      'senior-mechanic': 'Senior Mechanic',
      'junior-mechanic': 'Junior Mechanic',
      'apprentice': 'Apprentice',
      'service-advisor': 'Service Advisor'
    };
    return labels[role] || role;
  }

  getDepartmentLabel(department: EmployeeDepartment): string {
    const labels = {
      'management': 'Management',
      'mechanical': 'Mechanical',
      'bodywork': 'Bodywork',
      'electrical': 'Electrical',
      'service': 'Service'
    };
    return labels[department] || department;
  }

  getStatusLabel(status: EmployeeStatus): string {
    const labels = {
      'active': 'Active',
      'inactive': 'Inactive',
      'on-leave': 'On Leave',
      'terminated': 'Terminated'
    };
    return labels[status] || status;
  }

  getStatusClasses(status: EmployeeStatus): string {
    const classes = {
      'active': 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300',
      'inactive': 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
      'on-leave': 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300',
      'terminated': 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
    };
    return classes[status] || classes.inactive;
  }

  getAvailabilityColor(isAvailable: boolean): string {
    return isAvailable ? 'bg-green-500' : 'bg-red-500';
  }

  getAvailabilityTextColor(isAvailable: boolean): string {
    return isAvailable ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300';
  }

  getWorkloadPercentage(employee: Employee): number {
    if (employee.availability.maxWorkload === 0) return 0;
    return Math.round((employee.availability.currentWorkload / employee.availability.maxWorkload) * 100);
  }

  getStarArray(rating: number): number[] {
    return Array(Math.floor(rating)).fill(0);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0
    }).format(amount);
  }
}