import { Component, Input, Output, EventEmitter, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  Approval, 
  ApprovalStatus,
  APPROVAL_TYPE_LABELS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_PRIORITY_LABELS 
} from '../../../core/models/approval.model';

@Component({
  selector: 'app-approval-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <!-- Modal Overlay -->
    <div class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex min-h-screen items-center justify-center p-4">
        
        <!-- Backdrop -->
        <div 
          class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
          (click)="onClose()">
        </div>

        <!-- Modal Content -->
        <div class="relative glass-modal max-w-2xl w-full max-h-[90vh] overflow-hidden">
          
          <!-- Header -->
          <div class="p-6 border-b border-gray-600">
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-xl font-semibold text-white mb-2">{{ approval.title }}</h2>
                <div class="flex items-center space-x-4">
                  <!-- Type Badge -->
                  <span class="badge badge-active">
                    {{ getTypeLabel(approval.type) }}
                  </span>
                  
                  <!-- Priority Badge -->
                  <span class="badge" [class]="getPriorityBadgeClass(approval.priority)">
                    {{ getPriorityLabel(approval.priority) }}
                  </span>
                  
                  <!-- Status Badge -->
                  <span class="badge" [class]="getStatusBadgeClass(approval.status)">
                    {{ getStatusLabel(approval.status) }}
                  </span>
                </div>
              </div>
              
              <button 
                class="text-gray-400 hover:text-gray-200"
                (click)="onClose()">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="p-6 overflow-y-auto max-h-[60vh]">
            
            <!-- Description -->
            <div class="mb-6">
              <h3 class="text-md font-medium text-white mb-2">Description</h3>
              <p class="text-gray-300">{{ approval.description }}</p>
            </div>

            <!-- Details Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              
              <!-- Request Details -->
              <div>
                <h3 class="text-md font-medium text-white mb-3">Request Details</h3>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-400">Requested by:</span>
                    <span class="text-white font-medium">{{ approval.requestedBy.name }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Role:</span>
                    <span class="text-white">{{ approval.requestedBy.role }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Requested on:</span>
                    <span class="text-white">{{ approval.requestedAt | date:'MMM d, y h:mm a' }}</span>
                  </div>
                  @if (approval.dueDate) {
                    <div class="flex justify-between">
                      <span class="text-gray-400">Due date:</span>
                      <span class="text-white" 
                            [class.text-red-400]="isOverdue(approval.dueDate)">
                        {{ approval.dueDate | date:'MMM d, y h:mm a' }}
                        @if (isOverdue(approval.dueDate)) {
                          <span class="text-xs ml-1">(Overdue)</span>
                        }
                      </span>
                    </div>
                  }
                </div>
              </div>

              <!-- Financial Details -->
              @if (approval.estimatedCost) {
                <div>
                  <h3 class="text-md font-medium text-white mb-3">Financial Details</h3>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-gray-400">Estimated cost:</span>
                      <span class="text-white font-medium text-lg">
                        {{ approval.estimatedCost }} {{ approval.currency }}
                      </span>
                    </div>
                    @if (approval.relatedEntity) {
                      <div class="flex justify-between">
                        <span class="text-gray-400">Related to:</span>
                        <span class="text-white">{{ approval.relatedEntity.name }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Status Information -->
            @if (approval.status !== 'pending') {
              <div class="mb-6">
                <h3 class="text-md font-medium text-white mb-3">Status Information</h3>
                <div class="bg-gray-700 bg-opacity-50 p-4 rounded-lg">
                  @if (approval.status === 'approved' && approval.approvedBy) {
                    <div class="flex items-center text-green-600 dark:text-green-400 mb-2">
                      <svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span class="font-medium">Approved by {{ approval.approvedBy.name }}</span>
                    </div>
                    <p class="text-sm text-gray-300">
                      Approved on {{ approval.approvedAt | date:'MMM d, y h:mm a' }}
                    </p>
                  }
                  
                  @if (approval.status === 'rejected' && approval.rejectedBy) {
                    <div class="flex items-center text-red-600 dark:text-red-400 mb-2">
                      <svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span class="font-medium">Rejected by {{ approval.rejectedBy.name }}</span>
                    </div>
                    <p class="text-sm text-gray-300">
                      Rejected on {{ approval.rejectedAt | date:'MMM d, y h:mm a' }}
                    </p>
                  }

                  @if (approval.status === 'info_requested') {
                    <div class="flex items-center text-blue-600 dark:text-blue-400 mb-2">
                      <svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span class="font-medium">Additional information requested</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Comments -->
            @if (approval.comments && approval.comments.length > 0) {
              <div class="mb-6">
                <h3 class="text-md font-medium text-white mb-3">Comments</h3>
                <div class="space-y-3">
                  @for (comment of approval.comments; track comment.id) {
                    <div class="bg-gray-700 bg-opacity-50 p-3 rounded-lg">
                      <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center space-x-2">
                          <span class="text-sm font-medium text-white">{{ comment.author.name }}</span>
                          <span class="text-xs text-gray-400">{{ comment.author.role }}</span>
                          @if (comment.isInternal) {
                            <span class="badge badge-pending badge-sm">
                              Internal
                            </span>
                          }
                        </div>
                        <span class="text-xs text-gray-400">{{ comment.createdAt | date:'MMM d, h:mm a' }}</span>
                      </div>
                      <p class="text-sm text-gray-300">{{ comment.content }}</p>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Add Comment Form -->
            @if (approval.status === 'pending' || approval.status === 'info_requested') {
              <div>
                <h3 class="text-md font-medium text-white mb-3">Add Comment</h3>
                <form [formGroup]="commentForm" (ngSubmit)="addComment()">
                  <div class="space-y-3">
                    <textarea 
                      class="glass-input"
                      formControlName="comment"
                      rows="3"
                      placeholder="Add your comment or feedback..."></textarea>
                    
                    <div class="flex items-center space-x-3">
                      <input 
                        type="checkbox" 
                        id="internalComment"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        formControlName="isInternal">
                      <label for="internalComment" class="text-sm text-gray-300">Internal comment (not visible to requester)</label>
                    </div>
                  </div>
                </form>
              </div>
            }

          </div>

          <!-- Footer Actions -->
          <div class="p-6 border-t border-gray-600 bg-gray-800 bg-opacity-50">
            @if (approval.status === 'pending' || approval.status === 'info_requested') {
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <button 
                    type="button"
                    class="btn-success"
                    (click)="processApproval('approve')"
                    [disabled]="isProcessing()">
                    @if (isProcessing() && currentAction() === 'approve') {
                      <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Approving...
                    } @else {
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    }
                  </button>
                  
                  <button 
                    type="button"
                    class="btn-danger"
                    (click)="processApproval('reject')"
                    [disabled]="isProcessing()">
                    @if (isProcessing() && currentAction() === 'reject') {
                      <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Rejecting...
                    } @else {
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    }
                  </button>
                  
                  <button 
                    type="button"
                    class="btn-tertiary"
                    (click)="processApproval('request_info')"
                    [disabled]="isProcessing()">
                    @if (isProcessing() && currentAction() === 'request_info') {
                      <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Requesting...
                    } @else {
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Request Info
                    }
                  </button>
                </div>

                <button 
                  type="button"
                  class="btn-secondary"
                  (click)="onClose()"
                  [disabled]="isProcessing()">
                  Close
                </button>
              </div>
            } @else {
              <div class="flex justify-end">
                <button 
                  type="button"
                  class="btn-secondary"
                  (click)="onClose()">
                  Close
                </button>
              </div>
            }
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Modal uses global glass styles and buttons - minimal custom styling needed */
  `]
})
export class ApprovalModalComponent implements OnInit {
  private fb = inject(FormBuilder);

  @Input() approval!: Approval;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() action = new EventEmitter<{ action: string; comment?: string }>();

  commentForm!: FormGroup;
  isProcessing = signal(false);
  currentAction = signal<string>('');

  ngOnInit() {
    this.initializeCommentForm();
  }

  private initializeCommentForm() {
    this.commentForm = this.fb.group({
      comment: [''],
      isInternal: [true]
    });
  }

  onClose() {
    if (!this.isProcessing()) {
      this.close.emit();
    }
  }

  processApproval(action: 'approve' | 'reject' | 'request_info') {
    this.isProcessing.set(true);
    this.currentAction.set(action);

    const comment = this.commentForm.get('comment')?.value;
    
    setTimeout(() => {
      this.action.emit({ action, comment: comment || undefined });
      this.isProcessing.set(false);
      this.currentAction.set('');
    }, 1000);
  }

  addComment() {
    if (this.commentForm.valid) {
      const comment = this.commentForm.get('comment')?.value;
      if (comment?.trim()) {
        this.action.emit({ action: 'comment', comment });
        this.commentForm.reset({ isInternal: true });
      }
    }
  }

  isOverdue(dueDate: Date): boolean {
    return new Date() > new Date(dueDate);
  }

  getTypeLabel(type: string): string {
    return APPROVAL_TYPE_LABELS[type as keyof typeof APPROVAL_TYPE_LABELS] || type;
  }

  getStatusLabel(status: string): string {
    return APPROVAL_STATUS_LABELS[status as keyof typeof APPROVAL_STATUS_LABELS] || status;
  }

  getPriorityLabel(priority: string): string {
    return APPROVAL_PRIORITY_LABELS[priority as keyof typeof APPROVAL_PRIORITY_LABELS] || priority;
  }

  getPriorityBadgeClass(priority: string): string {
    const classes = {
      'low': 'badge-priority-low',
      'medium': 'badge-priority-medium',
      'high': 'badge-priority-high',
      'urgent': 'badge-priority-urgent'
    };
    return classes[priority as keyof typeof classes] || classes.medium;
  }

  getStatusBadgeClass(status: string): string {
    const classes = {
      'pending': 'badge-pending',
      'approved': 'badge-completed',
      'rejected': 'badge-cancelled',
      'info_requested': 'badge-active',
      'cancelled': 'badge-cancelled'
    };
    return classes[status as keyof typeof classes] || classes.pending;
  }
}