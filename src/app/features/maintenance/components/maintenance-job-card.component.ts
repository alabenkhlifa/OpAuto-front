import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaintenanceJob, MaintenanceStatus } from '../../../core/models/maintenance.model';

@Component({
  selector: 'app-maintenance-job-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white bg-opacity-60 backdrop-blur-sm rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 maintenance-card">
      
      <!-- Header -->
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {{ job.jobTitle }}
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ job.carDetails }} • {{ job.licensePlate }}
          </p>
        </div>
        
        <!-- Priority Badge -->
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              [class]="getPriorityClasses(job.priority)">
          {{ job.priority | titlecase }}
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
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
            {{ job.approvalRequests.length }} pending
          </span>
        }
      </div>

      <!-- Customer & Mechanic -->
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Customer</p>
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ job.customerName }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Mechanic</p>
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ job.mechanicName }}</p>
        </div>
      </div>

      <!-- Progress -->
      @if (job.tasks.length > 0) {
        <div class="mb-4">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-600 dark:text-gray-400">Progress</span>
            <span class="text-gray-900 dark:text-white">{{ getTaskProgress(job) }}%</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div class="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all" 
                 [style.width.%]="getTaskProgress(job)"></div>
          </div>
        </div>
      }

      <!-- Time & Cost Info -->
      <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <p class="text-gray-500 dark:text-gray-400">Mileage</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ job.currentMileage | number }} km</p>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400">Est. Cost</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(job.estimatedCost) }}</p>
        </div>
      </div>

      <!-- Description -->
      @if (view === 'list' || job.description.length < 100) {
        <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">{{ job.description }}</p>
      }

      <!-- Timestamps -->
      <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
        <span>Created: {{ job.createdAt | date:'short' }}</span>
        @if (job.completionDate) {
          <span>Completed: {{ job.completionDate | date:'short' }}</span>
        } @else if (job.startDate) {
          <span>Started: {{ job.startDate | date:'short' }}</span>
        }
      </div>

      <!-- Actions -->
      <div class="flex space-x-2">
        <button 
          class="flex-1 btn-outline text-sm py-2"
          (click)="viewDetails.emit(job.id)">
          View Details
        </button>
        
        @if (job.status !== 'completed' && job.status !== 'cancelled') {
          <button 
            class="flex-1 btn-primary text-sm py-2"
            (click)="edit.emit(job.id)">
            Edit
          </button>
        }

        <!-- Status Actions -->
        @switch (job.status) {
          @case ('waiting') {
            <button 
              class="btn-success text-sm py-2 px-3"
              (click)="changeStatus('in-progress')"
              title="Start Job">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-3-5h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          }
          @case ('in-progress') {
            <button 
              class="btn-success text-sm py-2 px-3"
              (click)="changeStatus('completed')"
              title="Complete Job">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          }
        }
      </div>

    </div>
  `,
  styles: [`
    .btn-outline {
      @apply inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500;
    }
    
    .btn-success {
      @apply inline-flex items-center justify-center border border-transparent font-medium rounded-md text-white bg-green-600 hover:bg-green-700;
    }
    
    .maintenance-card.dark {
      background-color: rgba(0, 0, 0, 0.2) !important;
      border-color: rgba(75, 85, 99, 1) !important;
    }
  `]
})
export class MaintenanceJobCardComponent {
  
  @Input() job!: MaintenanceJob;
  @Input() view: 'list' | 'grid' = 'grid';
  
  @Output() statusChange = new EventEmitter<{jobId: string, status: MaintenanceStatus}>();
  @Output() edit = new EventEmitter<string>();
  @Output() viewDetails = new EventEmitter<string>();

  getStatusLabel(status: MaintenanceStatus): string {
    const labels = {
      'waiting': 'Waiting',
      'in-progress': 'In Progress',
      'waiting-approval': 'Needs Approval',
      'waiting-parts': 'Waiting for Parts',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return labels[status] || status;
  }

  getStatusColor(status: MaintenanceStatus): string {
    const colors = {
      'waiting': 'bg-yellow-400',
      'in-progress': 'bg-blue-500',
      'waiting-approval': 'bg-orange-500',
      'waiting-parts': 'bg-purple-500',
      'completed': 'bg-green-500',
      'cancelled': 'bg-gray-500'
    };
    return colors[status] || 'bg-gray-500';
  }

  getStatusTextColor(status: MaintenanceStatus): string {
    const colors = {
      'waiting': 'text-yellow-700 dark:text-yellow-300',
      'in-progress': 'text-blue-700 dark:text-blue-300',
      'waiting-approval': 'text-orange-700 dark:text-orange-300',
      'waiting-parts': 'text-purple-700 dark:text-purple-300',
      'completed': 'text-green-700 dark:text-green-300',
      'cancelled': 'text-gray-700 dark:text-gray-300'
    };
    return colors[status] || 'text-gray-700 dark:text-gray-300';
  }

  getPriorityClasses(priority: string): string {
    const classes = {
      'low': 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
      'medium': 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300',
      'high': 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300',
      'urgent': 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
    };
    return classes[priority as keyof typeof classes] || classes.medium;
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
}