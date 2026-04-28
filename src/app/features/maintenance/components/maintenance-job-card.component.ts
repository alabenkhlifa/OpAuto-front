import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceJob, MaintenanceStatus } from '../../../core/models/maintenance.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-maintenance-job-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="glass-card">
      
      <!-- Header -->
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold text-gray-900 truncate">
            {{ getServiceName(job.jobTitle) }}
          </h3>
          <p class="text-sm text-gray-500 mt-1">
            {{ job.carDetails }} • {{ job.licensePlate }}
          </p>
        </div>
        
        <!-- Priority Badge -->
        <span [class]="getPriorityBadgeClass(job.priority)">
          {{ 'maintenance.priority.' + job.priority | translate }}
        </span>
      </div>

      <!-- Status -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center">
          <div class="w-3 h-3 rounded-full mr-2" [class]="getStatusColor(job.status)"></div>
          <span class="text-sm font-medium" [class]="getStatusTextColor(job.status)">
            {{ getStatusLabel(job.status) }}
          </span>
        </div>
        
        @if (job.status === 'waiting-approval' && job.approvalRequests.length > 0) {
          <span class="approval-badge">
            {{ job.approvalRequests.length }} {{ 'maintenance.pending' | translate }}
          </span>
        }
      </div>

      <!-- Customer & Mechanic -->
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide">{{ 'maintenance.customer' | translate }}</p>
          <p class="text-sm font-medium text-gray-900">{{ job.customerName }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wide">{{ 'maintenance.mechanic' | translate }}</p>
          <p class="text-sm font-medium text-gray-900">{{ job.mechanicName }}</p>
        </div>
      </div>

      <!-- Progress -->
      @if (job.tasks.length > 0) {
        <div class="mb-4">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600">{{ 'maintenance.progress' | translate }}</span>
            <span class="text-gray-900">{{ getTaskProgress(job) }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all" 
                 [style.width.%]="getTaskProgress(job)"></div>
          </div>
        </div>
      }

      <!-- Time & Cost Info -->
      @if (authService.isOwner()) {
        <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <p class="text-gray-500">{{ 'maintenance.mileage' | translate }}</p>
            <p class="font-medium text-gray-900">{{ job.currentMileage | number }} km</p>
          </div>
          <div>
            <p class="text-gray-500">{{ 'maintenance.estimatedCost' | translate }}</p>
            <p class="font-medium text-gray-900">{{ formatCurrency(job.estimatedCost) }}</p>
          </div>
        </div>
      } @else {
        <div class="mb-4 text-sm">
          <div>
            <p class="text-gray-500">{{ 'maintenance.mileage' | translate }}</p>
            <p class="font-medium text-gray-900">{{ job.currentMileage | number }} km</p>
          </div>
        </div>
      }

      <!-- Description -->
      @if (view === 'list' || job.description.length < 100) {
        <p class="text-sm text-gray-600 mb-4">{{ job.description }}</p>
      }

      <!-- Timestamps -->
      <div class="flex justify-between text-xs text-gray-500 mb-4">
        <span>{{ 'maintenance.created' | translate }}: {{ job.createdAt | date:'short' }}</span>
        @if (job.completionDate) {
          <span>{{ 'maintenance.completed' | translate }}: {{ job.completionDate | date:'short' }}</span>
        } @else if (job.startDate) {
          <span>{{ 'maintenance.started' | translate }}: {{ job.startDate | date:'short' }}</span>
        }
      </div>

      <!-- Status Change Dropdown -->
      @if (job.status !== 'completed' && job.status !== 'cancelled') {
        <div class="status-change-row mb-3">
          <label class="status-change-label" [for]="'job-status-' + job.id">
            {{ 'maintenance.actions.changeStatus' | translate }}
          </label>
          <select [id]="'job-status-' + job.id"
                  class="status-change-select"
                  [ngModel]="job.status"
                  (ngModelChange)="changeStatus($event)"
                  (click)="$event.stopPropagation()">
            @for (s of availableStatuses; track s) {
              <option [value]="s">{{ getStatusLabel(s) }}</option>
            }
          </select>
        </div>
      }

      <!-- Actions -->
      <div class="flex space-x-2" [class]="view === 'list' ? 'justify-end' : ''">
        <button
          [class]="view === 'list' ? 'btn-tertiary btn-sm' : 'flex-1 btn-tertiary'"
          (click)="viewDetails.emit(job.id)">
          {{ 'maintenance.actions.viewDetails' | translate }}
        </button>

        @if (job.status !== 'completed' && job.status !== 'cancelled') {
          <button
            [class]="view === 'list' ? 'btn-warning btn-sm' : 'flex-1 btn-warning'"
            (click)="edit.emit(job.id)">
            {{ 'maintenance.actions.edit' | translate }}
          </button>
        }
      </div>

    </div>
  `,
  styles: [`
    /* Maintenance Job Card - Uses global glass-card and button system */
    .glass-card {
      cursor: pointer;
    }


    /* Component uses global button classes from /src/styles/buttons.css */
    /* Component uses global badge classes from /src/styles/badges.css */

    /* Custom approval badge - distinct from priority badges */
    .approval-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 16px; /* More rounded than regular badges */
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(245, 158, 11, 0.6) !important;
      box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
      backdrop-filter: blur(10px);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }

    .status-change-row {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .status-change-label {
      font-size: 0.7rem;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .status-change-select {
      padding: 0.45rem 2.25rem 0.45rem 0.625rem;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      background-color: #fff;
      background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
      background-repeat: no-repeat;
      background-position: right 0.625rem center;
      background-size: 1rem;
      color: #111827;
      font-size: 0.85rem;
      cursor: pointer;
      transition: border-color 0.15s;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
    }

    .status-change-select:hover,
    .status-change-select:focus {
      border-color: #FF8400;
      outline: none;
    }
  `]
})
export class MaintenanceJobCardComponent {
  private translationService = inject(TranslationService);
  authService = inject(AuthService);

  @Input() job!: MaintenanceJob;
  @Input() view: 'list' | 'grid' = 'grid';

  @Output() statusChange = new EventEmitter<{jobId: string, status: MaintenanceStatus}>();
  @Output() edit = new EventEmitter<string>();
  @Output() viewDetails = new EventEmitter<string>();

  readonly availableStatuses: MaintenanceStatus[] = [
    'waiting', 'in-progress', 'waiting-approval', 'waiting-parts', 'quality-check', 'completed', 'cancelled'
  ];

  getStatusLabel(status: MaintenanceStatus): string {
    const statusKeys = {
      'waiting': 'waiting',
      'in-progress': 'inProgress',
      'waiting-approval': 'needsApproval',
      'waiting-parts': 'waitingParts',
      'quality-check': 'qualityCheck',
      'completed': 'completed',
      'cancelled': 'cancelled'
    };
    const key = statusKeys[status as keyof typeof statusKeys] || 'waiting';
    return this.translationService.instant(`maintenance.status.${key}`);
  }

  getStatusColor(status: MaintenanceStatus): string {
    const colors = {
      'waiting': 'bg-yellow-400',
      'in-progress': 'bg-blue-500',
      'waiting-approval': 'bg-orange-500',
      'waiting-parts': 'bg-purple-500',
      'quality-check': 'bg-cyan-500',
      'completed': 'bg-green-500',
      'cancelled': 'bg-gray-500'
    };
    return colors[status] || 'bg-gray-500';
  }

  getStatusTextColor(status: MaintenanceStatus): string {
    const colors = {
      'waiting': 'text-yellow-700',
      'in-progress': 'text-blue-700',
      'waiting-approval': 'text-orange-700',
      'waiting-parts': 'text-purple-700',
      'quality-check': 'text-cyan-700',
      'completed': 'text-green-700',
      'cancelled': 'text-gray-700'
    };
    return colors[status] || 'text-gray-700';
  }

  getPriorityBadgeClass(priority: string): string {
    const classes = {
      'low': 'badge badge-priority-low',
      'medium': 'badge badge-priority-medium', 
      'high': 'badge badge-priority-high',
      'urgent': 'badge badge-priority-urgent'
    };
    return classes[priority as keyof typeof classes] || 'badge badge-priority-medium';
  }

  getTaskProgress(job: MaintenanceJob): number {
    if (job.tasks.length === 0) return 0;
    const completedTasks = job.tasks.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / job.tasks.length) * 100);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0
    }).format(amount);
  }

  changeStatus(newStatus: MaintenanceStatus) {
    this.statusChange.emit({ jobId: this.job.id, status: newStatus });
  }

  getServiceName(serviceName: string): string {
    const translationKey = `serviceNames.${serviceName}`;
    const translatedName = this.translationService.instant(translationKey);
    return translatedName === translationKey ? serviceName : translatedName;
  }
}