import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { MaintenanceJob, ApprovalRequest, TaskStatus } from '../../../core/models/maintenance.model';

@Component({
  selector: 'app-maintenance-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      
      @if (job()) {
        <!-- Header -->
        <div class="glass-card mb-6">
          <div class="flex items-start space-x-6">
            <button 
              class="p-3 text-gray-400 hover:text-white transition-colors bg-gray-800/50 rounded-lg hover:bg-gray-700/50"
              (click)="goBack()">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div class="flex-1">
              <div class="mb-3">
                <h1 class="text-3xl lg:text-4xl font-bold text-white mb-2">{{ job()!.jobTitle }}</h1>
                <div class="flex items-center space-x-4 mb-3">
                  <span class="inline-flex items-center px-4 py-2 rounded-xl text-base font-semibold backdrop-filter backdrop-blur-sm"
                        [class]="getStatusClasses(job()!.status)">
                    {{ getStatusLabel(job()!.status) }}
                  </span>
                  <span class="inline-flex items-center px-4 py-2 rounded-xl text-base font-semibold backdrop-filter backdrop-blur-sm"
                        [class]="getPriorityClasses(job()!.priority)">
                    {{ job()!.priority | titlecase }}
                  </span>
                </div>
              </div>
              <div class="bg-gray-800/30 rounded-lg p-4 backdrop-filter backdrop-blur-sm">
                <div class="flex items-center space-x-3">
                  <svg class="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16H5a2 2 0 01-2-2V6a2 2 0 012-2h1.586a1 1 0 01.707.293L9 7.586A1 1 0 009.586 8H16a2 2 0 012 2v6a2 2 0 01-2 2h-1"/>
                  </svg>
                  <div>
                    <p class="text-lg font-medium text-white">{{ job()!.carDetails }}</p>
                    <p class="text-blue-300 font-semibold text-lg">{{ job()!.licensePlate }}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex space-x-2">
              @if (job()!.status !== 'completed' && job()!.status !== 'cancelled') {
                <button class="btn-secondary" (click)="editJob()">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              }
              
              <!-- Status Action Button -->
              @switch (job()!.status) {
                @case ('waiting') {
                  <button class="btn-primary" (click)="startJob()">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-3-5h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Job
                  </button>
                }
                @case ('in-progress') {
                  <button class="btn-success" (click)="completeJob()">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Complete Job
                  </button>
                }
              }
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Left Column - Job Details -->
          <div class="lg:col-span-2 space-y-6">
            
            <!-- Job Information -->
            <div class="glass-card">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Job Information</h2>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                  <p class="font-medium text-gray-900 dark:text-white">{{ job()!.customerName }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Assigned Mechanic</p>
                  <p class="font-medium text-gray-900 dark:text-white">{{ job()!.mechanicName }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Current Mileage</p>
                  <p class="font-medium text-gray-900 dark:text-white">{{ job()!.currentMileage | number }} km</p>
                </div>
                <div>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Estimated Cost</p>
                  <p class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(job()!.estimatedCost) }}</p>
                </div>
              </div>

              @if (job()!.description) {
                <div class="mt-4">
                  <p class="text-sm text-gray-500 dark:text-gray-400">Description</p>
                  <p class="text-gray-900 dark:text-white">{{ job()!.description }}</p>
                </div>
              }

              @if (job()!.notes) {
                <div class="mt-4">
                  <p class="text-sm text-gray-500 dark:text-gray-400">Notes</p>
                  <p class="text-gray-900 dark:text-white">{{ job()!.notes }}</p>
                </div>
              }
            </div>

            <!-- Tasks -->
            <div class="glass-card">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Tasks</h2>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  {{ getCompletedTasksCount() }} of {{ job()!.tasks.length }} completed
                </div>
              </div>

              @if (job()!.tasks.length === 0) {
                <p class="text-gray-500 dark:text-gray-400 text-center py-8">No tasks defined for this job.</p>
              } @else {
                <div class="space-y-3">
                  @for (task of job()!.tasks; track task.id) {
                    <div class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <div class="flex items-center space-x-3 flex-1">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center"
                             [class]="getTaskStatusColor(task.status)">
                          @if (task.status === 'completed') {
                            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                          } @else if (task.status === 'in-progress') {
                            <div class="w-2 h-2 bg-white rounded-full"></div>
                          }
                        </div>
                        
                        <div class="flex-1">
                          <h3 class="font-medium text-gray-900 dark:text-white">{{ task.name }}</h3>
                          @if (task.description) {
                            <p class="text-sm text-gray-500 dark:text-gray-400">{{ task.description }}</p>
                          }
                          <div class="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>Est: {{ task.estimatedTime }}min</span>
                            @if (task.actualTime) {
                              <span>Actual: {{ task.actualTime }}min</span>
                            }
                            @if (task.completedAt) {
                              <span>Completed: {{ task.completedAt | date:'short' }}</span>
                            }
                          </div>
                        </div>
                      </div>

                      <!-- Task Actions -->
                      @if (job()!.status === 'in-progress' && task.status !== 'completed') {
                        <div class="flex space-x-2">
                          @if (task.status === 'pending') {
                            <button 
                              class="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
                              (click)="updateTaskStatus(task.id, 'in-progress')">
                              Start
                            </button>
                          }
                          @if (task.status === 'in-progress') {
                            <button 
                              class="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700"
                              (click)="updateTaskStatus(task.id, 'completed')">
                              Complete
                            </button>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Progress Bar -->
                <div class="mt-4">
                  <div class="flex justify-between text-sm mb-2">
                    <span class="text-gray-600 dark:text-gray-400">Overall Progress</span>
                    <span class="text-gray-900 dark:text-white">{{ getTaskProgress() }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div class="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all" 
                         [style.width.%]="getTaskProgress()"></div>
                  </div>
                </div>
              }
            </div>

            <!-- Approval Requests -->
            @if (job()!.approvalRequests.length > 0) {
              <div class="glass-card">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Approval Requests</h2>
                
                <div class="space-y-4">
                  @for (request of job()!.approvalRequests; track request.id) {
                    <div class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="flex items-center space-x-2 mb-2">
                            <h3 class="font-medium text-gray-900 dark:text-white">{{ getRequestTypeLabel(request.type) }}</h3>
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                  [class]="getRequestStatusClasses(request.status)">
                              {{ request.status | titlecase }}
                            </span>
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                  [class]="getUrgencyClasses(request.urgency)">
                              {{ request.urgency | titlecase }}
                            </span>
                          </div>
                          
                          <p class="text-gray-700 dark:text-gray-300 mb-2">{{ request.description }}</p>
                          
                          <div class="text-sm text-gray-500 dark:text-gray-400">
                            <p>Estimated Price: {{ formatCurrency(request.estimatedPrice) }}</p>
                            <p>Requested by: {{ request.requestedBy }} on {{ request.requestedAt | date:'short' }}</p>
                            @if (request.approvedAt) {
                              <p>Approved by: {{ request.approvedBy }} on {{ request.approvedAt | date:'short' }}</p>
                            }
                            @if (request.rejectionReason) {
                              <p class="text-red-600 dark:text-red-400">Rejected: {{ request.rejectionReason }}</p>
                            }
                          </div>
                        </div>

                        <!-- Approval Actions -->
                        @if (request.status === 'pending') {
                          <div class="flex space-x-2 ml-4">
                            <button 
                              class="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                              (click)="approveRequest(request.id)">
                              Approve
                            </button>
                            <button 
                              class="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                              (click)="showRejectModal(request.id)">
                              Reject
                            </button>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

          </div>

          <!-- Right Column - Sidebar Info -->
          <div class="space-y-6">
            
            <!-- Timeline -->
            <div class="glass-card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Timeline</h3>
              
              <div class="space-y-4">
                <div class="flex items-center space-x-3">
                  <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">Job Created</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ job()!.createdAt | date:'short' }}</p>
                  </div>
                </div>
                
                @if (job()!.startDate) {
                  <div class="flex items-center space-x-3">
                    <div class="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">Work Started</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ job()!.startDate | date:'short' }}</p>
                    </div>
                  </div>
                }
                
                @if (job()!.completionDate) {
                  <div class="flex items-center space-x-3">
                    <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">Job Completed</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ job()!.completionDate | date:'short' }}</p>
                    </div>
                  </div>
                }
                
                <div class="flex items-center space-x-3">
                  <div class="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">Last Updated</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ job()!.updatedAt | date:'short' }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cost Information -->
            <div class="glass-card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cost Information</h3>
              
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Estimated Cost:</span>
                  <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(job()!.estimatedCost) }}</span>
                </div>
                
                @if (job()!.actualCost) {
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">Actual Cost:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(job()!.actualCost || 0) }}</span>
                  </div>
                  
                  @if (job()!.actualCost !== job()!.estimatedCost) {
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-500 dark:text-gray-400">Variance:</span>
                      <span [class]="(job()!.actualCost || 0) > job()!.estimatedCost ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
                        {{ formatCurrency(getAbsoluteValue((job()!.actualCost || 0) - job()!.estimatedCost)) }}
                        {{ (job()!.actualCost || 0) > job()!.estimatedCost ? 'over' : 'under' }}
                      </span>
                    </div>
                  }
                }
              </div>
            </div>

            <!-- Time Information -->
            <div class="glass-card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Time Tracking</h3>
              
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Estimated Duration:</span>
                  <span class="font-medium text-gray-900 dark:text-white">{{ job()!.estimatedDuration }}min</span>
                </div>
                
                @if (job()!.actualDuration) {
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">Actual Duration:</span>
                    <span class="font-medium text-gray-900 dark:text-white">{{ job()!.actualDuration }}min</span>
                  </div>
                }
                
                @if (job()!.startDate && !job()!.completionDate) {
                  <div class="flex justify-between">
                    <span class="text-gray-600 dark:text-gray-400">Time Elapsed:</span>
                    <span class="font-medium text-orange-600 dark:text-orange-400">{{ getElapsedTime() }}</span>
                  </div>
                }
              </div>
            </div>

          </div>

        </div>

      } @else {
        <!-- Loading State -->
        <div class="flex items-center justify-center h-64">
          <div class="text-center">
            <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-gray-500 dark:text-gray-400">Loading job details...</p>
          </div>
        </div>
      }

    </div>

    <!-- Reject Modal -->
    @if (showRejectModalSignal()) {
      <div class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" (click)="hideRejectModal()"></div>
          
          <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div class="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Reject Approval Request</h3>
              <textarea
                [(ngModel)]="rejectionReason"
                rows="4"
                placeholder="Please provide a reason for rejection..."
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
              </textarea>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button 
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                (click)="confirmReject()">
                Reject
              </button>
              <button 
                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                (click)="hideRejectModal()">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    }
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

    /* Button styling to match other screens */
    .btn-primary {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      border: 1px solid #f59e0b;
      color: white !important;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(20px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #d97706, #b45309);
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
      transform: translateY(-1px);
    }
    
    .btn-secondary {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      border: 1px solid #f59e0b;
      color: white !important;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(20px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
    }

    .btn-secondary:hover {
      background: linear-gradient(135deg, #d97706, #b45309);
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
      transform: translateY(-1px);
    }
    
    .btn-success {
      background: linear-gradient(135deg, #059669, #047857);
      border: 1px solid #059669;
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(20px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(5, 150, 105, 0.3);
    }

    .btn-success:hover {
      background: linear-gradient(135deg, #047857, #065f46);
      box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4);
      transform: translateY(-1px);
    }

    /* Fix text colors for permanent dark theme */
    .glass-card h2,
    .glass-card h3,
    .glass-card .text-gray-900 {
      color: #ffffff !important;
    }

    .glass-card .text-gray-500,
    .glass-card .text-gray-400 {
      color: #9ca3af !important;
    }

    .glass-card .text-gray-600 {
      color: #d1d5db !important;
    }

    /* Enhanced status and priority badge styling */
    .status-badge-waiting {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(245, 158, 11, 0.6);
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
    }

    .status-badge-in-progress {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(29, 78, 216, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(59, 130, 246, 0.6);
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    }

    .status-badge-completed {
      background: linear-gradient(135deg, rgba(5, 150, 105, 0.9), rgba(4, 120, 87, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(5, 150, 105, 0.6);
      box-shadow: 0 4px 15px rgba(5, 150, 105, 0.3);
    }

    .status-badge-waiting-approval {
      background: linear-gradient(135deg, rgba(249, 115, 22, 0.9), rgba(194, 65, 12, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(249, 115, 22, 0.6);
      box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);
    }

    .priority-badge-low {
      background: linear-gradient(135deg, rgba(75, 85, 99, 0.9), rgba(55, 65, 81, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(75, 85, 99, 0.6);
      box-shadow: 0 4px 15px rgba(75, 85, 99, 0.3);
    }

    .priority-badge-medium {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(245, 158, 11, 0.6);
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
    }

    .priority-badge-high {
      background: linear-gradient(135deg, rgba(249, 115, 22, 0.9), rgba(194, 65, 12, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(249, 115, 22, 0.6);
      box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);
    }

    .priority-badge-urgent {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(185, 28, 28, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(239, 68, 68, 0.6);
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
    }
  `]
})
export class MaintenanceDetailsComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private maintenanceService = inject(MaintenanceService);

  job = signal<MaintenanceJob | null>(null);
  showRejectModalSignal = signal(false);
  rejectionReason = '';
  pendingRequestId = '';

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadJob(id);
    } else {
      this.goBack();
    }
  }

  private loadJob(id: string) {
    this.maintenanceService.getMaintenanceJob(id).subscribe({
      next: (job) => {
        if (job) {
          this.job.set(job);
        } else {
          console.error('Job not found');
          this.goBack();
        }
      },
      error: (error) => {
        console.error('Error loading job:', error);
        this.goBack();
      }
    });
  }

  updateTaskStatus(taskId: string, status: TaskStatus) {
    const jobId = this.job()?.id;
    if (!jobId) return;

    this.maintenanceService.updateTaskStatus(jobId, taskId, status).subscribe({
      next: (updatedJob) => {
        this.job.set(updatedJob);
      },
      error: (error) => console.error('Error updating task status:', error)
    });
  }

  startJob() {
    const jobId = this.job()?.id;
    if (!jobId) return;

    this.maintenanceService.updateJobStatus(jobId, 'in-progress').subscribe({
      next: (updatedJob) => this.job.set(updatedJob),
      error: (error) => console.error('Error starting job:', error)
    });
  }

  completeJob() {
    const jobId = this.job()?.id;
    if (!jobId) return;

    this.maintenanceService.updateJobStatus(jobId, 'completed').subscribe({
      next: (updatedJob) => this.job.set(updatedJob),
      error: (error) => console.error('Error completing job:', error)
    });
  }

  approveRequest(requestId: string) {
    const jobId = this.job()?.id;
    if (!jobId) return;

    this.maintenanceService.approveRequest(jobId, requestId, 'Admin').subscribe({
      next: (updatedJob) => this.job.set(updatedJob),
      error: (error) => console.error('Error approving request:', error)
    });
  }

  showRejectModal(requestId: string) {
    this.pendingRequestId = requestId;
    this.rejectionReason = '';
    this.showRejectModalSignal.set(true);
  }

  hideRejectModal() {
    this.showRejectModalSignal.set(false);
    this.pendingRequestId = '';
    this.rejectionReason = '';
  }

  confirmReject() {
    if (!this.rejectionReason.trim()) return;
    
    const jobId = this.job()?.id;
    if (!jobId) return;

    this.maintenanceService.rejectRequest(jobId, this.pendingRequestId, this.rejectionReason).subscribe({
      next: (updatedJob) => {
        this.job.set(updatedJob);
        this.hideRejectModal();
      },
      error: (error) => console.error('Error rejecting request:', error)
    });
  }

  editJob() {
    const jobId = this.job()?.id;
    if (jobId) {
      this.router.navigate(['/maintenance/edit', jobId]);
    }
  }

  goBack() {
    this.router.navigate(['/maintenance/active']);
  }

  // Helper methods
  getStatusLabel(status: string): string {
    const labels = {
      'waiting': 'Waiting',
      'in-progress': 'In Progress',
      'waiting-approval': 'Needs Approval',
      'waiting-parts': 'Waiting for Parts',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return labels[status as keyof typeof labels] || status;
  }

  getStatusClasses(status: string): string {
    const classes = {
      'waiting': 'status-badge-waiting',
      'in-progress': 'status-badge-in-progress',
      'waiting-approval': 'status-badge-waiting-approval',
      'waiting-parts': 'status-badge-waiting-approval',
      'completed': 'status-badge-completed',
      'cancelled': 'status-badge-waiting'
    };
    return classes[status as keyof typeof classes] || 'status-badge-waiting';
  }

  getPriorityClasses(priority: string): string {
    const classes = {
      'low': 'priority-badge-low',
      'medium': 'priority-badge-medium',
      'high': 'priority-badge-high',
      'urgent': 'priority-badge-urgent'
    };
    return classes[priority as keyof typeof classes] || 'priority-badge-medium';
  }

  getTaskStatusColor(status: TaskStatus): string {
    const colors = {
      'pending': 'bg-gray-400',
      'in-progress': 'bg-blue-500',
      'completed': 'bg-green-500',
      'skipped': 'bg-gray-300'
    };
    return colors[status] || 'bg-gray-400';
  }

  getRequestTypeLabel(type: string): string {
    const labels = {
      'part-purchase': 'Part Purchase',
      'additional-work': 'Additional Work',
      'cost-estimate': 'Cost Estimate Update'
    };
    return labels[type as keyof typeof labels] || type;
  }

  getRequestStatusClasses(status: string): string {
    const classes = {
      'pending': 'badge badge-pending',
      'approved': 'badge badge-completed',
      'rejected': 'badge badge-cancelled'
    };
    return classes[status as keyof typeof classes] || classes.pending;
  }

  getUrgencyClasses(urgency: string): string {
    const classes = {
      'low': 'badge badge-priority-low',
      'medium': 'badge badge-priority-medium',
      'high': 'badge badge-priority-high'
    };
    return classes[urgency as keyof typeof classes] || classes.medium;
  }

  getTaskProgress(): number {
    const job = this.job();
    if (!job || job.tasks.length === 0) return 0;
    
    const completedTasks = job.tasks.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / job.tasks.length) * 100);
  }

  getCompletedTasksCount(): number {
    return this.job()?.tasks.filter(task => task.status === 'completed').length || 0;
  }

  getElapsedTime(): string {
    const job = this.job();
    if (!job?.startDate) return '';
    
    const now = new Date();
    const elapsed = now.getTime() - job.startDate.getTime();
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0
    }).format(amount);
  }

  getAbsoluteValue(value: number): number {
    return Math.abs(value);
  }
}