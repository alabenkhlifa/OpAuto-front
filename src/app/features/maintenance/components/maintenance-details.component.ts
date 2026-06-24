import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { InvoiceService } from '../../../core/services/invoice.service';
import {
  MaintenanceJob,
  MaintenancePart,
  MaintenanceTimelineEvent,
  TaskStatus,
  ApprovalRequest,
  JobApprovalCreatePayload,
  JobApprovalResponsePayload,
  ApprovalChannel
} from '../../../core/models/maintenance.model';
import { PhotoUploadComponent } from '../../../shared/components/photo-upload/photo-upload.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-maintenance-details',
  standalone: true,
  imports: [CommonModule, FormsModule, PhotoUploadComponent, TranslatePipe],
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      @if (job()) {
        <div class="glass-card mb-6">
          <div class="flex items-start space-x-6">
            <button
              class="p-3 text-gray-500 hover:text-gray-900 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200"
              (click)="goBack()">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>

            <div class="flex-1">
              <div class="mb-3">
                <h1 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">{{ job()!.jobTitle }}</h1>
                <div class="flex items-center space-x-4">
                  <span class="inline-flex items-center px-4 py-2 rounded-xl text-base font-semibold backdrop-filter backdrop-blur-sm"
                        [class]="getStatusClasses(job()!.status)">
                    {{ getStatusLabel(job()!.status) }}
                  </span>
                  <span class="inline-flex items-center px-4 py-2 rounded-xl text-base font-semibold backdrop-filter backdrop-blur-sm"
                        [class]="getPriorityClasses(job()!.priority)">
                    {{ getPriorityLabel(job()!.priority) }}
                  </span>
                </div>
              </div>
              <div class="bg-gray-100 rounded-lg p-4">
                <div class="flex items-center space-x-3">
                  <svg class="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16H5a2 2 0 01-2-2V6a2 2 0 012-2h1.586a1 1 0 01.707.293L9 7.586A1 1 0 009.586 8H16a2 2 0 012 2v6a2 2 0 01-2 2h-1"/>
                  </svg>
                  <div>
                    <p class="text-lg font-medium text-gray-900">{{ job()!.carDetails }}</p>
                    <p class="text-blue-600 font-semibold text-lg">{{ job()!.licensePlate }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-col items-end space-y-2">
              @if (job()!.status !== 'completed' && job()!.status !== 'cancelled') {
                <button class="btn-secondary" (click)="editJob()">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                  {{ 'maintenance.actions.edit' | translate }}
                </button>
              }

              <button class="btn-secondary" [disabled]="creatingInvoice()" (click)="createInvoiceDraft()">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 17V7m0 10l-3-3m3 3l3-3"/>
                </svg>
                {{ creatingInvoice() ? ('maintenance.actions.loading' | translate) : ('maintenance.actions.createInvoiceDraft' | translate) }}
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-6">
            <div class="glass-card">
              <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ 'maintenance.details.jobInformation' | translate }}</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p class="text-sm text-gray-500">{{ 'maintenance.details.customer' | translate }}</p>
                  <p class="font-medium text-gray-900">{{ job()!.customerName }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-500">{{ 'maintenance.details.assignedMechanic' | translate }}</p>
                  <p class="font-medium text-gray-900">{{ job()!.mechanicName }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-500">{{ 'maintenance.details.currentMileage' | translate }}</p>
                  <p class="font-medium text-gray-900">{{ job()!.currentMileage | number }} km</p>
                </div>
                <div>
                  <p class="text-sm text-gray-500">{{ 'maintenance.details.estimatedCost' | translate }}</p>
                  <p class="font-medium text-gray-900">{{ formatCurrency(job()!.estimatedCost) }}</p>
                </div>
              </div>
              @if (job()!.description) {
                <div class="mt-4">
                  <p class="text-sm text-gray-500">{{ 'maintenance.details.description' | translate }}</p>
                  <p class="text-gray-900">{{ job()!.description }}</p>
                </div>
              }
              @if (job()!.notes) {
                <div class="mt-4">
                  <p class="text-sm text-gray-500">{{ 'maintenance.details.notes' | translate }}</p>
                  <p class="text-gray-900">{{ job()!.notes }}</p>
                </div>
              }
            </div>

            <div class="glass-card">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-900">{{ 'maintenance.details.parts' | translate }}</h2>
                <button class="btn-secondary" (click)="toggleAddPart()">
                  {{ isAddingPart() ? ('maintenance.details.cancel' | translate) : ('maintenance.details.addPart' | translate) }}
                </button>
              </div>

              @if (job()!.parts.length === 0) {
                <p class="text-gray-500 text-center py-6">{{ 'maintenance.details.noParts' | translate }}</p>
              } @else {
                <div class="space-y-3">
                  @for (part of job()!.parts; track part.id) {
                    <div class="p-4 border border-gray-200 rounded-lg">
                      @if (editingPartId() === part.id) {
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input class="form-input" [(ngModel)]="partForm.name" [placeholder]="'maintenance.details.partName' | translate">
                          <input class="form-input" [(ngModel)]="partForm.partNumber" [placeholder]="'maintenance.details.partNumber' | translate">
                          <input class="form-input" type="number" min="1" [(ngModel)]="partForm.quantity" [placeholder]="'maintenance.details.quantity' | translate">
                          <input class="form-input" type="number" min="0" step="0.01" [(ngModel)]="partForm.unitPrice" [placeholder]="'maintenance.details.unitPrice' | translate">
                          <input class="form-input" [(ngModel)]="partForm.supplier" [placeholder]="'maintenance.details.supplier' | translate">
                          <input class="form-input" [(ngModel)]="partForm.notes" [placeholder]="'maintenance.details.notes' | translate">
                        </div>
                        <div class="flex justify-end mt-3 space-x-2">
                          <button class="btn-primary" (click)="savePart(part.id)">{{ 'common.save' | translate }}</button>
                          <button class="btn-filter-toggle" (click)="cancelEditPart()">{{ 'maintenance.details.cancel' | translate }}</button>
                        </div>
                      } @else {
                        <div class="flex items-start justify-between">
                          <div>
                            <p class="font-medium text-gray-900">{{ part.name }}</p>
                            @if (part.partNumber) {
                              <p class="text-sm text-gray-500">{{ 'maintenance.details.partNumber' | translate }}: {{ part.partNumber }}</p>
                            }
                            <p class="text-sm text-gray-500">
                              {{ part.quantity }} × {{ formatCurrency(part.unitPrice) }} = {{ formatCurrency(part.totalPrice || (part.quantity * part.unitPrice)) }}
                            </p>
                            @if (part.supplier) {
                              <p class="text-sm text-gray-500">{{ 'maintenance.details.supplier' | translate }}: {{ part.supplier }}</p>
                            }
                            @if (part.notes) {
                              <p class="text-sm text-gray-500">{{ part.notes }}</p>
                            }
                          </div>
                          <div class="flex items-center space-x-2">
                            <button class="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700" (click)="editPart(part)">
                              {{ 'maintenance.actions.edit' | translate }}
                            </button>
                            <button class="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700" (click)="deletePart(part.id)">
                              {{ 'common.delete' | translate }}
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              }

              @if (isAddingPart()) {
                <div class="mt-4 p-4 border border-gray-200 rounded-lg">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input class="form-input" [(ngModel)]="newPart.name" [placeholder]="'maintenance.details.partName' | translate">
                    <input class="form-input" [(ngModel)]="newPart.partNumber" [placeholder]="'maintenance.details.partNumber' | translate">
                    <input class="form-input" type="number" min="1" [(ngModel)]="newPart.quantity" [placeholder]="'maintenance.details.quantity' | translate">
                    <input class="form-input" type="number" min="0" step="0.01" [(ngModel)]="newPart.unitPrice" [placeholder]="'maintenance.details.unitPrice' | translate">
                    <input class="form-input" [(ngModel)]="newPart.supplier" [placeholder]="'maintenance.details.supplier' | translate">
                    <input class="form-input" [(ngModel)]="newPart.notes" [placeholder]="'maintenance.details.notes' | translate">
                  </div>
                  <div class="mt-3 flex justify-end">
                    <button class="btn-primary" (click)="addPart()">{{ 'maintenance.details.addPart' | translate }}</button>
                  </div>
                </div>
              }
            </div>

            <div class="glass-card">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-900">{{ 'maintenance.details.approvalRequests' | translate }}</h2>
              </div>

              <div class="p-4 border border-gray-200 rounded-lg mb-4">
                <p class="font-medium mb-3">{{ 'maintenance.details.newApprovalRequest' | translate }}</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select class="form-select" [(ngModel)]="newRequest.type">
                    <option value="price-change">{{ 'maintenance.details.requestType.priceChange' | translate }}</option>
                    <option value="parts-request">{{ 'maintenance.details.requestType.partsRequest' | translate }}</option>
                    <option value="part-purchase">{{ 'maintenance.details.requestType.partPurchase' | translate }}</option>
                    <option value="additional-work">{{ 'maintenance.details.requestType.additionalWork' | translate }}</option>
                    <option value="cost-estimate">{{ 'maintenance.details.requestType.costEstimate' | translate }}</option>
                  </select>
                  <select class="form-select" [(ngModel)]="newRequest.urgency">
                    <option value="low">{{ 'maintenance.details.lowUrgency' | translate }}</option>
                    <option value="medium">{{ 'maintenance.details.mediumUrgency' | translate }}</option>
                    <option value="high">{{ 'maintenance.details.highUrgency' | translate }}</option>
                  </select>
                  <input class="form-input" type="number" min="0" step="0.01" [(ngModel)]="newRequest.estimatedPrice"
                         [placeholder]="'maintenance.details.estimatedPrice' | translate">
                  <input class="form-input" [(ngModel)]="newRequest.partName" [placeholder]="'maintenance.details.partName' | translate">
                  <input class="form-input md:col-span-2" [(ngModel)]="newRequest.comments" [placeholder]="'maintenance.details.comments' | translate">
                </div>
                <textarea class="form-textarea mt-3 mb-3" rows="3" [(ngModel)]="newRequest.description"
                          [placeholder]="'maintenance.details.approvalDescriptionPlaceholder' | translate"></textarea>
                <div class="flex items-center gap-3 text-sm">
                  <span>{{ 'maintenance.details.sendVia' | translate }}:</span>
                  <label class="flex items-center gap-1">
                    <input type="checkbox" [(ngModel)]="newRequest.sendByCall"> {{ 'maintenance.details.channel.call' | translate }}
                  </label>
                  <label class="flex items-center gap-1">
                    <input type="checkbox" [(ngModel)]="newRequest.sendBySms"> {{ 'maintenance.details.channel.sms' | translate }}
                  </label>
                  <label class="flex items-center gap-1">
                    <input type="checkbox" [(ngModel)]="newRequest.sendByEmail"> {{ 'maintenance.details.channel.email' | translate }}
                  </label>
                </div>
                <div class="mt-3">
                  <button class="btn-primary" (click)="createApprovalRequest()">
                    {{ 'maintenance.details.createApprovalRequest' | translate }}
                  </button>
                </div>
              </div>

              @if (job()!.approvalRequests.length === 0) {
                <p class="text-sm text-gray-500">{{ 'maintenance.details.noApprovalRequests' | translate }}</p>
              } @else {
                <div class="space-y-4">
                  @for (request of job()!.approvalRequests; track request.id) {
                    <div class="p-4 border border-gray-200 rounded-lg">
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <div class="flex items-center flex-wrap gap-2 mb-2">
                            <h3 class="font-medium text-gray-900">{{ getRequestTypeLabel(request.type) }}</h3>
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                  [class]="getRequestStatusClasses(request.status)">{{ getApprovalStatusLabel(request.status) }}</span>
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                  [class]="getUrgencyClasses(request.urgency)">{{ getUrgencyLabel(request.urgency) }}</span>
                          </div>
                          <p class="text-gray-700 mb-2">{{ request.description }}</p>
                          <div class="text-sm text-gray-500">
                            <p>{{ 'maintenance.details.estimatedPrice' | translate }}: {{ formatCurrency(request.estimatedPrice) }}</p>
                            <p>{{ 'maintenance.details.requestedBy' | translate }}: {{ request.requestedBy }} — {{ request.requestedAt | date:'short' }}</p>
                            @if (request.approvedAt) {
                              <p>{{ 'maintenance.details.approvedBy' | translate }}: {{ request.approvedBy }} — {{ request.approvedAt | date:'short' }}</p>
                            }
                            @if (request.customerResponse) {
                              <p>
                                {{ request.customerResponse === 'approved' ? ('maintenance.details.customerApproved' | translate) : ('maintenance.details.customerRejected' | translate) }}
                                @if (request.customerRespondedAt) {
                                  ({{ request.customerRespondedAt | date:'short' }})
                                }
                              </p>
                            }
                            @if (request.sentVia?.length) {
                              <p>{{ 'maintenance.details.sentVia' | translate }}: {{ formatApprovalChannels(request.sentVia) }}</p>
                            }
                            @if (request.sentTo) {
                              <p>{{ 'maintenance.details.sentTo' | translate }}: {{ request.sentTo }}</p>
                            }
                          </div>
                        </div>
                      </div>

                      @if (request.status === 'pending') {
                        <div class="mt-3">
                          <div class="flex items-center gap-2 mb-2">
                            <select class="form-select w-36" [value]="requestResponseChannel(request.id)"
                                    (change)="onRequestResponseChannelChange(request.id, $event)">
                              @for (ch of approvalChannels; track ch) {
                                <option [value]="ch">{{ ('maintenance.details.channel.' + ch) | translate }}</option>
                              }
                            </select>
                            <button class="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700" (click)="recordOwnerDecision(request.id, 'approved')">
                              {{ 'maintenance.details.recordApprove' | translate }}
                            </button>
                            <button class="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700" (click)="openRejectModal(request.id)">
                              {{ 'maintenance.actions.reject' | translate }}
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>

            <div class="glass-card">
              <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ 'maintenance.details.tasks' | translate }}</h2>
              <div class="flex items-center justify-between mb-4">
                <div class="text-sm text-gray-500">
                  {{ 'maintenance.details.tasksProgress' | translate: { completed: getCompletedTasksCount(), total: job()!.tasks.length } }}
                </div>
                <div class="text-sm text-gray-500">{{ getTaskProgress() }}%</div>
              </div>
              @if (job()!.tasks.length === 0) {
                <p class="text-gray-500 text-center py-6">{{ 'maintenance.details.noTasks' | translate }}</p>
              } @else {
                <div class="space-y-3">
                  @for (task of job()!.tasks; track task.id) {
                    <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div class="flex items-center space-x-3 flex-1">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center" [class]="getTaskStatusColor(task.status)">
                          @if (task.status === 'completed') {
                            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M5 13l4 4L19 7"/>
                            </svg>
                          } @else if (task.status === 'in-progress') {
                            <div class="w-2 h-2 bg-white rounded-full"></div>
                          }
                        </div>
                        <div>
                          <h3 class="font-medium text-gray-900">{{ task.name }}</h3>
                          @if (task.description) { <p class="text-sm text-gray-500">{{ task.description }}</p> }
                          <div class="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            <span>{{ 'maintenance.details.estimatedShort' | translate }}: {{ task.estimatedTime }}{{ 'maintenance.details.minutes' | translate }}</span>
                            @if (task.actualTime) { <span>{{ 'maintenance.details.actualShort' | translate }}: {{ task.actualTime }}{{ 'maintenance.details.minutes' | translate }}</span> }
                          </div>
                        </div>
                      </div>
                      @if (job()!.status === 'in-progress' && task.status !== 'completed') {
                        <button class="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700" (click)="updateTaskStatus(task.id, 'completed')">
                          {{ 'maintenance.actions.complete' | translate }}
                        </button>
                      } @else if (task.status === 'completed' && job()!.status === 'in-progress') {
                        <button class="px-3 py-1 text-xs bg-gray-400 text-white rounded-md hover:bg-gray-500" (click)="updateTaskStatus(task.id, 'pending')">
                          {{ 'maintenance.actions.reopen' | translate }}
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>

            <div class="glass-card">
              <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ 'maintenance.details.photos' | translate }}</h2>
              @if (job()?.id) {
                <app-photo-upload [jobId]="job()!.id"></app-photo-upload>
              }
            </div>
          </div>

          <div class="space-y-6">
            <div class="glass-card">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ 'maintenance.details.timeline' | translate }}</h3>
              <div class="space-y-4">
                @for (event of timelineEvents(); track event.id) {
                  <div class="flex items-center space-x-3">
                    <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div>
                      <p class="text-sm font-medium text-gray-900">{{ event.label || event.type }}</p>
                      @if (event.actorName) {
                        <p class="text-xs text-gray-500">{{ event.actorName }}</p>
                      }
                      @if (event.description) {
                        <p class="text-sm text-gray-500">{{ event.description }}</p>
                      }
                      <p class="text-xs text-gray-500">{{ event.occurredAt | date:'short' }}</p>
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="glass-card">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ 'maintenance.details.costInformation' | translate }}</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600">{{ 'maintenance.details.estimatedCost' | translate }}:</span>
                  <span class="font-medium text-gray-900">{{ formatCurrency(job()!.estimatedCost) }}</span>
                </div>
                @if (job()!.actualCost) {
                  <div class="flex justify-between">
                    <span class="text-gray-600">{{ 'maintenance.details.actualCost' | translate }}:</span>
                    <span class="font-medium text-gray-900">{{ formatCurrency(job()!.actualCost || 0) }}</span>
                  </div>
                }
              </div>
            </div>

            <div class="glass-card">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ 'maintenance.details.timeTracking' | translate }}</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600">{{ 'maintenance.details.estimatedDuration' | translate }}:</span>
                  <span class="font-medium text-gray-900">{{ job()!.estimatedDuration }}{{ 'maintenance.details.minutes' | translate }}</span>
                </div>
                @if (job()!.actualDuration) {
                  <div class="flex justify-between">
                    <span class="text-gray-600">{{ 'maintenance.details.actualDuration' | translate }}:</span>
                    <span class="font-medium text-gray-900">{{ job()!.actualDuration }}{{ 'maintenance.details.minutes' | translate }}</span>
                  </div>
                }
                @if (job()!.startDate && !job()!.completionDate) {
                  <div class="flex justify-between">
                    <span class="text-gray-600">{{ 'maintenance.details.timeElapsed' | translate }}:</span>
                    <span class="font-medium text-orange-600">{{ getElapsedTime() }}</span>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      } @else {
        <div class="flex items-center justify-center h-64">
          <div class="text-center">
            <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0L9 0 12 0 15 0 15 8A8 8 0 014 12H4z"></path>
            </svg>
            <p class="text-gray-500">{{ 'maintenance.details.loadingDetails' | translate }}</p>
          </div>
        </div>
      }
    </div>

    @if (showRejectModalSignal()) {
      <div class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" (click)="hideRejectModal()"></div>
          <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 class="text-lg font-medium text-gray-900 mb-4">{{ 'maintenance.details.rejectModalTitle' | translate }}</h3>
              <textarea
                [(ngModel)]="ownerRejectReason"
                rows="4"
                [placeholder]="'maintenance.details.rejectReasonPlaceholder' | translate"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
              </textarea>
            </div>
            <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:ml-3 sm:w-auto sm:text-sm"
                (click)="confirmReject()">
                {{ 'maintenance.details.rejectAction' | translate }}
              </button>
              <button
                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                (click)="hideRejectModal()">
                {{ 'maintenance.details.cancel' | translate }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .status-badge-waiting {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(245, 158, 11, 0.6);
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
    }

    .status-badge-in-progress {
      background: linear-gradient(135deg, rgba(255, 132, 0, 0.9), rgba(204, 106, 0, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 132, 0, 0.6);
      box-shadow: 0 4px 15px rgba(255, 132, 0, 0.3);
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

    .status-badge-cancelled {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(185, 28, 28, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(239, 68, 68, 0.6);
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
    }

    .status-badge-cancelled {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(185, 28, 28, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(239, 68, 68, 0.6);
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
    }

    .status-badge-pending {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(245, 158, 11, 0.6);
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
    }

    .priority-badge-low {
      background: linear-gradient(135deg, rgba(42, 37, 102, 0.9), rgba(55, 65, 81, 0.9)) !important;
      color: #ffffff !important;
      border: 1px solid rgba(42, 37, 102, 0.6);
      box-shadow: 0 4px 15px rgba(42, 37, 102, 0.3);
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
  private location = inject(Location);
  private maintenanceService = inject(MaintenanceService);
  private invoiceService = inject(InvoiceService);
  private translationService = inject(TranslationService);

  job = signal<MaintenanceJob | null>(null);
  showRejectModalSignal = signal(false);
  ownerRejectReason = '';
  pendingRequestId = '';
  creatingInvoice = signal(false);
  isAddingPart = signal(false);
  editingPartId = signal('');
  requestResponseChannels: Record<string, ApprovalChannel> = {};
  approvalChannels: ApprovalChannel[] = ['call', 'sms', 'email'];

  newPart: Omit<MaintenancePart, 'id' | 'totalPrice' | 'createdAt' | 'updatedAt'> = {
    name: '',
    partNumber: '',
    quantity: 1,
    unitPrice: 0,
    supplier: '',
    notes: ''
  };
  partForm: Omit<MaintenancePart, 'id' | 'totalPrice' | 'createdAt' | 'updatedAt'> = {
    name: '',
    partNumber: '',
    quantity: 1,
    unitPrice: 0,
    supplier: '',
    notes: ''
  };

  newRequest = {
    type: 'price-change' as 'price-change' | 'parts-request' | 'part-purchase' | 'additional-work' | 'cost-estimate',
    urgency: 'medium' as 'low' | 'medium' | 'high',
    description: '',
    partName: '',
    estimatedPrice: 0,
    comments: '',
    sendByCall: false,
    sendBySms: false,
    sendByEmail: false
  };

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
          this.goBack();
        }
      },
      error: () => this.goBack(),
    });
  }

  private refreshJob() {
    const jobId = this.job()?.id;
    if (!jobId) return;
    this.loadJob(jobId);
  }

  updateTaskStatus(taskId: string, status: TaskStatus) {
    const jobId = this.job()?.id;
    if (!jobId) return;
    this.maintenanceService.updateTaskStatus(jobId, taskId, status).subscribe((updatedJob) => this.job.set(updatedJob));
  }

  createInvoiceDraft() {
    const jobId = this.job()?.id;
    if (!jobId || this.creatingInvoice()) return;
    this.creatingInvoice.set(true);
    this.invoiceService.createInvoiceFromJob(jobId).subscribe({
      next: (invoice) => {
        this.creatingInvoice.set(false);
        this.router.navigate(['/invoices/edit', invoice.id]);
      },
      error: () => this.creatingInvoice.set(false),
    });
  }

  startJob() {
    const jobId = this.job()?.id;
    if (!jobId) return;
    this.maintenanceService.updateJobStatus(jobId, 'in-progress').subscribe((updatedJob) => this.job.set(updatedJob));
  }

  completeJob() {
    const jobId = this.job()?.id;
    if (!jobId) return;
    this.maintenanceService.updateJobStatus(jobId, 'completed').subscribe((updatedJob) => this.job.set(updatedJob));
  }

  editJob() {
    const jobId = this.job()?.id;
    if (jobId) this.router.navigate(['/maintenance/edit', jobId]);
  }

  goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/maintenance/active']);
    }
  }

  toggleAddPart() {
    this.isAddingPart.set(!this.isAddingPart());
    if (!this.isAddingPart()) {
      this.newPart = { name: '', partNumber: '', quantity: 1, unitPrice: 0, supplier: '', notes: '' };
    }
  }

  addPart() {
    const jobId = this.job()?.id;
    if (!jobId || !this.newPart.name.trim()) return;

    this.maintenanceService.addJobPart(jobId, {
      ...this.newPart,
      name: this.newPart.name.trim(),
      partNumber: this.newPart.partNumber?.trim(),
      quantity: Number(this.newPart.quantity) || 1,
      unitPrice: Number(this.newPart.unitPrice) || 0,
      supplier: this.newPart.supplier?.trim() || undefined,
      notes: this.newPart.notes?.trim() || undefined
    }).subscribe(() => {
      this.refreshJob();
      this.newPart = { name: '', partNumber: '', quantity: 1, unitPrice: 0, supplier: '', notes: '' };
      this.isAddingPart.set(false);
    });
  }

  editPart(part: MaintenancePart) {
    this.partForm = {
      name: part.name,
      partNumber: part.partNumber || '',
      quantity: part.quantity,
      unitPrice: part.unitPrice,
      supplier: part.supplier || '',
      notes: part.notes || ''
    };
    this.editingPartId.set(part.id);
  }

  savePart(partId: string) {
    const jobId = this.job()?.id;
    if (!jobId || !this.partForm.name.trim()) return;

    this.maintenanceService.updateJobPart(jobId, partId, {
      ...this.partForm,
      name: this.partForm.name.trim(),
      partNumber: this.partForm.partNumber?.trim(),
      supplier: this.partForm.supplier?.trim(),
      notes: this.partForm.notes?.trim(),
      quantity: Number(this.partForm.quantity) || 1,
      unitPrice: Number(this.partForm.unitPrice) || 0
    }).subscribe(() => {
      this.refreshJob();
      this.editingPartId.set('');
    });
  }

  cancelEditPart() {
    this.editingPartId.set('');
  }

  deletePart(partId: string) {
    const jobId = this.job()?.id;
    if (!jobId) return;
    this.maintenanceService.removeJobPart(jobId, partId).subscribe(() => this.refreshJob());
  }

  createApprovalRequest() {
    const jobId = this.job()?.id;
    if (!jobId || !this.newRequest.description.trim()) return;

    const channels = [] as ApprovalChannel[];
    if (this.newRequest.sendByCall) channels.push('call');
    if (this.newRequest.sendBySms) channels.push('sms');
    if (this.newRequest.sendByEmail) channels.push('email');

    const payload: JobApprovalCreatePayload = {
      type: this.newRequest.type,
      description: this.newRequest.description.trim(),
      urgency: this.newRequest.urgency,
      estimatedPrice: Number(this.newRequest.estimatedPrice) || 0,
      partName: this.newRequest.partName.trim() || undefined,
      comments: this.newRequest.comments.trim() || undefined,
      sentVia: channels.length ? channels : undefined
    };

    this.maintenanceService.createApprovalRequest(jobId, payload).subscribe(() => {
      this.newRequest = {
        type: 'price-change',
        urgency: 'medium',
        description: '',
        partName: '',
        estimatedPrice: 0,
        comments: '',
        sendByCall: false,
        sendBySms: false,
        sendByEmail: false
      };
      this.refreshJob();
    });
  }

  requestResponseChannel(requestId: string): ApprovalChannel {
    return this.requestResponseChannels[requestId] || 'call';
  }

  setRequestResponseChannel(requestId: string, channel: ApprovalChannel) {
    this.requestResponseChannels[requestId] = channel;
  }

  onRequestResponseChannelChange(requestId: string, event: Event) {
    const value = (event.target as HTMLSelectElement | null)?.value;
    if (value === 'call' || value === 'sms' || value === 'email') {
      this.setRequestResponseChannel(requestId, value);
    }
  }

  recordOwnerDecision(requestId: string, decision: 'approved' | 'rejected') {
    if (decision === 'approved') {
      this.respondToApprovalRequest(requestId, decision);
      return;
    }
    this.openRejectModal(requestId);
  }

  private respondToApprovalRequest(requestId: string, decision: 'approved' | 'rejected') {
    const jobId = this.job()?.id;
    if (!jobId) return;

    const payload: JobApprovalResponsePayload = {
      decision,
      channel: this.requestResponseChannel(requestId),
      reason: decision === 'rejected' ? (this.ownerRejectReason?.trim() || undefined) : undefined,
      reviewer: 'Owner'
    };
    if (decision === 'rejected' && !payload.reason) return;

    this.maintenanceService.recordOwnerApprovalDecision(jobId, requestId, payload).subscribe((updated) => {
      this.job.set(updated);
      this.ownerRejectReason = '';
      this.hideRejectModal();
    });
  }

  openRejectModal(requestId: string) {
    this.pendingRequestId = requestId;
    this.ownerRejectReason = '';
    this.showRejectModalSignal.set(true);
  }

  confirmReject() {
    if (!this.pendingRequestId || !this.ownerRejectReason.trim()) return;
    this.respondToApprovalRequest(this.pendingRequestId, 'rejected');
  }

  hideRejectModal() {
    this.showRejectModalSignal.set(false);
    this.pendingRequestId = '';
    this.ownerRejectReason = '';
  }

  getStatusLabel(status: string): string {
    const keyMap: Record<string, string> = {
      waiting: 'maintenance.status.waiting',
      'in-progress': 'maintenance.status.inProgress',
      'waiting-approval': 'maintenance.status.needsApproval',
      'waiting-parts': 'maintenance.status.waitingParts',
      'quality-check': 'maintenance.status.qualityCheck',
      completed: 'maintenance.status.completed',
      cancelled: 'maintenance.status.cancelled'
    };
    return this.translationService.instant(keyMap[status] || 'maintenance.status.pending');
  }

  getApprovalStatusLabel(status: string): string {
    const keyMap: Record<string, string> = {
      pending: 'maintenance.details.pending',
      approved: 'maintenance.details.approved',
      rejected: 'maintenance.details.rejected'
    };
    return this.translationService.instant(keyMap[status] || status);
  }

  getUrgencyLabel(urgency: string): string {
    const keyMap: Record<string, string> = {
      low: 'maintenance.priority.low',
      medium: 'maintenance.priority.medium',
      high: 'maintenance.priority.high'
    };
    return this.translationService.instant(keyMap[urgency] || urgency);
  }

  getPriorityLabel(priority: string): string {
    const keyMap: Record<string, string> = {
      low: 'maintenance.priority.low',
      medium: 'maintenance.priority.medium',
      high: 'maintenance.priority.high',
      urgent: 'maintenance.priority.urgent'
    };
    return this.translationService.instant(keyMap[priority] || priority);
  }

  getStatusClasses(status: string): string {
    const classes = {
      waiting: 'status-badge-waiting',
      'in-progress': 'status-badge-in-progress',
      'waiting-approval': 'status-badge-waiting-approval',
      'waiting-parts': 'status-badge-waiting-approval',
      'quality-check': 'status-badge-in-progress',
      completed: 'status-badge-completed',
      cancelled: 'status-badge-cancelled',
      pending: 'status-badge-pending'
    };
    return classes[status as keyof typeof classes] || 'status-badge-pending';
  }

  getPriorityClasses(priority: string): string {
    const classes = {
      low: 'priority-badge-low',
      medium: 'priority-badge-medium',
      high: 'priority-badge-high',
      urgent: 'priority-badge-urgent'
    };
    return classes[priority as keyof typeof classes] || 'priority-badge-medium';
  }

  getTaskStatusColor(status: TaskStatus): string {
    const colors = {
      pending: 'bg-gray-400',
      'in-progress': 'bg-blue-500',
      completed: 'bg-green-500',
      skipped: 'bg-gray-300'
    };
    return colors[status] || 'bg-gray-400';
  }

  getRequestTypeLabel(type: string): string {
    const keyMap: Record<string, string> = {
      'part-purchase': 'maintenance.details.requestType.partPurchase',
      'additional-work': 'maintenance.details.requestType.additionalWork',
      'cost-estimate': 'maintenance.details.requestType.costEstimate',
      'price-change': 'maintenance.details.requestType.priceChange',
      'parts-request': 'maintenance.details.requestType.partsRequest'
    };
    return this.translationService.instant(keyMap[type] || type);
  }

  formatApprovalChannels(channels: ApprovalChannel[] | undefined): string {
    return (channels || [])
      .map((channel) => this.translationService.instant(`maintenance.details.channel.${channel}`))
      .join(', ');
  }

  getRequestStatusClasses(status: string): string {
    const classes = {
      pending: 'badge badge-pending',
      approved: 'badge badge-completed',
      rejected: 'badge badge-cancelled'
    };
    return classes[status as keyof typeof classes] || classes.pending;
  }

  getUrgencyClasses(urgency: string): string {
    const classes = {
      low: 'badge badge-priority-low',
      medium: 'badge badge-priority-medium',
      high: 'badge badge-priority-high'
    };
    return classes[urgency as keyof typeof classes] || classes.medium;
  }

  timelineEvents(): MaintenanceTimelineEvent[] {
    const j = this.job();
    if (!j) return [];
    if (j.timelineEvents.length > 0) return [...j.timelineEvents].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    return [{
      id: `${j.id}-created`,
      type: 'job-created',
      label: this.translationService.instant('maintenance.details.jobCreated'),
      description: this.translationService.instant('maintenance.details.jobCreated'),
      occurredAt: j.createdAt
    }];
  }

  getTaskProgress(): number {
    const j = this.job();
    if (!j || j.tasks.length === 0) return 0;
    return Math.round((j.tasks.filter((task) => task.status === 'completed').length / j.tasks.length) * 100);
  }

  getCompletedTasksCount(): number {
    return this.job()?.tasks.filter((task) => task.status === 'completed').length || 0;
  }

  getElapsedTime(): string {
    const j = this.job();
    if (!j?.startDate) return '';
    const now = new Date();
    const elapsed = now.getTime() - j.startDate.getTime();
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
}
