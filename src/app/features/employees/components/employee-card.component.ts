import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Employee, EmployeeRole, EmployeeDepartment, EmployeeStatus } from '../../../core/models/employee.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-employee-card',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="glass-card">
      
      <!-- Header -->
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center space-x-3">
          <!-- Avatar -->
          <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
            {{ getInitials(employee.personalInfo.fullName) }}
          </div>
          
          <div class="flex-1 min-w-0">
            <h3 class="text-lg font-semibold text-white truncate">
              {{ employee.personalInfo.fullName }}
            </h3>
            <p class="text-sm text-gray-400">
              {{ employee.employeeNumber }} • {{ getRoleLabel(employee.employment.role) }}
            </p>
          </div>
        </div>
        
        <!-- Status Badge -->
        <span class="badge"
              [class]="getStatusClasses(employee.employment.status)">
          {{ (employee.employment.status === 'on-leave' ? 'employees.status.onLeave' : 'employees.status.' + employee.employment.status) | translate }}
        </span>
      </div>

      <!-- Department & Contact -->
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p class="text-xs text-gray-400 uppercase tracking-wide">{{ 'employees.cardLabels.department' | translate }}</p>
          <p class="text-sm font-medium text-white">{{ 'employees.departments.' + employee.employment.department | translate }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-400 uppercase tracking-wide">{{ 'employees.cardLabels.phone' | translate }}</p>
          <p class="text-sm font-medium text-white">{{ employee.personalInfo.phone }}</p>
        </div>
      </div>

      <!-- Availability & Workload -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-gray-400 uppercase tracking-wide">
            {{ 'employees.cardLabels.availability' | translate }}
          </span>
          <div class="flex items-center">
            <div class="w-2 h-2 rounded-full mr-2" [class]="getAvailabilityColor(employee.availability.isAvailable)"></div>
            <span class="text-sm font-medium" [class]="getAvailabilityTextColor(employee.availability.isAvailable)">
              {{ (employee.availability.isAvailable ? 'employees.status.available' : 'employees.status.unavailable') | translate }}
            </span>
          </div>
        </div>
        
        @if (employee.availability.isAvailable) {
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-400">{{ 'employees.cardLabels.currentWorkload' | translate }}</span>
            <span class="text-white">{{ employee.availability.currentWorkload }}/{{ employee.availability.maxWorkload }}</span>
          </div>
          <div class="w-full bg-gray-700 rounded-full h-2">
            <div class="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all" 
                 [style.width.%]="getWorkloadPercentage(employee)"></div>
          </div>
        } @else if (employee.availability.unavailableReason) {
          <p class="text-sm text-gray-300">{{ employee.availability.unavailableReason }}</p>
          @if (employee.availability.unavailableUntil) {
            <p class="text-xs text-gray-400">Until: {{ employee.availability.unavailableUntil | date:'short' }}</p>
          }
        }
      </div>

      <!-- Skills & Experience -->
      <div class="mb-4">
        <p class="text-xs text-gray-400 uppercase tracking-wide mb-2">{{ 'employees.cardLabels.specialties' | translate }}</p>
        <div class="flex flex-wrap gap-1">
          @for (specialty of employee.skills.specialties.slice(0, 3); track specialty) {
            <span class="badge badge-active">
              {{ specialty }}
            </span>
          }
          @if (employee.skills.specialties.length > 3) {
            <span class="badge badge-inactive">
              +{{ employee.skills.specialties.length - 3 }} more
            </span>
          }
        </div>
      </div>

      <!-- Performance (Grid view only) -->
      @if (view === 'grid') {
        <div class="mb-4 text-sm">
          <div>
            <p class="text-gray-400">{{ 'employees.cardLabels.completedJobs' | translate }}</p>
            <p class="font-medium text-white">{{ employee.performance.completedJobs }}</p>
          </div>
        </div>
      }

      <!-- Actions -->
      <div class="flex space-x-2">
        <button 
          class="flex-1 btn-tertiary text-sm justify-center"
          (click)="viewDetails.emit(employee.id)">
          {{ 'employees.actions.viewDetails' | translate }}
        </button>
        
        <button 
          class="flex-1 btn-primary text-sm justify-center"
          (click)="edit.emit(employee.id)">
          {{ 'employees.actions.edit' | translate }}
        </button>

        <!-- Availability Toggle -->
        @if (employee.employment.status === 'active') {
          <button 
            class="btn-sm text-xs justify-center"
            [class]="employee.availability.isAvailable ? 'btn-warning' : 'btn-success'"
            (click)="toggleAvailability.emit({employeeId: employee.id, isAvailable: !employee.availability.isAvailable})">
            @if (employee.availability.isAvailable) {
              <svg class="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636" />
              </svg>
              {{ 'employees.actions.markUnavailable' | translate }}
            } @else {
              <svg class="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ 'employees.actions.markAvailable' | translate }}
            }
          </button>
        }
      </div>

    </div>
  `,
  styles: [`
    /* Component uses global glass-card and button classes */
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
      'active': 'badge-active',
      'inactive': 'badge-inactive',
      'on-leave': 'badge-pending',
      'terminated': 'badge-cancelled'
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

  private translationService = inject(TranslationService);

  getStatusTranslation(status: EmployeeStatus): string {
    const key = status === 'on-leave' ? 'onLeave' : status;
    return this.translationService.instant(`employees.status.${key}`);
  }

  getAvailabilityTranslation(isAvailable: boolean): string {
    const key = isAvailable ? 'available' : 'unavailable';
    return this.translationService.instant(`employees.status.${key}`);
  }
}