import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { UserLimits, InviteUserRequest, UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-user-invite-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        
        <!-- Background overlay -->
        <div class="fixed inset-0 bg-black/75 transition-opacity" (click)="onClose()"></div>

        <!-- Modal -->
        <div class="relative inline-block transform overflow-hidden rounded-lg bg-gray-800 px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle border border-gray-600">
          
          <!-- Header -->
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-white">
              {{ 'users.inviteTeamMember' | translate }}
            </h3>
            <button 
              class="text-gray-400 hover:text-white"
              (click)="onClose()">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Limit Info -->
          @if (userLimits) {
            <div class="mb-6 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="text-sm text-blue-300">
                  @if (userLimits.limit !== null) {
                    {{ 'users.inviteLimit' | translate: {
                      remaining: userLimits.limit - userLimits.current,
                      total: userLimits.limit
                    } }}
                  } @else {
                    {{ 'users.unlimitedInvites' | translate }}
                  }
                </div>
              </div>
            </div>
          }

          <!-- Form -->
          <form (ngSubmit)="onSubmit()" #inviteForm="ngForm">
            
            <!-- Email -->
            <div class="mb-4">
              <label for="email" class="block text-sm font-medium text-gray-300 mb-2">
                {{ 'users.emailAddress' | translate }}
                <span class="text-red-400">*</span>
              </label>
              <input
                id="email"
                type="email"
                [(ngModel)]="formData.email"
                name="email"
                required
                email
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                [placeholder]="'users.emailPlaceholder' | translate"
                #emailInput="ngModel">
              
              @if (emailInput.invalid && emailInput.touched) {
                <div class="mt-1 text-sm text-red-400">
                  @if (emailInput.errors?.['required']) {
                    {{ 'validation.emailRequired' | translate }}
                  }
                  @if (emailInput.errors?.['email']) {
                    {{ 'validation.emailInvalid' | translate }}
                  }
                </div>
              }
            </div>

            <!-- First Name -->
            <div class="mb-4">
              <label for="firstName" class="block text-sm font-medium text-gray-300 mb-2">
                {{ 'users.firstName' | translate }}
              </label>
              <input
                id="firstName"
                type="text"
                [(ngModel)]="formData.firstName"
                name="firstName"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                [placeholder]="'users.firstNamePlaceholder' | translate">
            </div>

            <!-- Last Name -->
            <div class="mb-4">
              <label for="lastName" class="block text-sm font-medium text-gray-300 mb-2">
                {{ 'users.lastName' | translate }}
              </label>
              <input
                id="lastName"
                type="text"
                [(ngModel)]="formData.lastName"
                name="lastName"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                [placeholder]="'users.lastNamePlaceholder' | translate">
            </div>

            <!-- Role -->
            <div class="mb-4">
              <label for="role" class="block text-sm font-medium text-gray-300 mb-2">
                {{ 'users.role' | translate }}
                <span class="text-red-400">*</span>
              </label>
              <select
                id="role"
                [(ngModel)]="formData.role"
                name="role"
                required
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                #roleSelect="ngModel">
                <option value="">{{ 'users.selectRole' | translate }}</option>
                @for (role of availableRoles; track role.value) {
                  <option [value]="role.value">{{ role.label | translate }}</option>
                }
              </select>
              
              @if (roleSelect.invalid && roleSelect.touched) {
                <div class="mt-1 text-sm text-red-400">
                  {{ 'validation.roleRequired' | translate }}
                </div>
              }
            </div>

            <!-- Role Description -->
            @if (formData.role) {
              <div class="mb-4 p-3 bg-gray-700/50 rounded-lg">
                <div class="text-sm text-gray-300">
                  <div class="font-medium mb-1">
                    {{ 'roles.' + formData.role | translate }} {{ 'users.permissions' | translate }}:
                  </div>
                  <ul class="text-xs text-gray-400 space-y-0.5">
                    @for (permission of getRolePermissions(formData.role); track permission) {
                      <li>• {{ 'permissions.' + permission | translate }}</li>
                    }
                  </ul>
                </div>
              </div>
            }

            <!-- Personal Message -->
            <div class="mb-6">
              <label for="message" class="block text-sm font-medium text-gray-300 mb-2">
                {{ 'users.personalMessage' | translate }}
                <span class="text-gray-500">({{ 'common.optional' | translate }})</span>
              </label>
              <textarea
                id="message"
                [(ngModel)]="formData.message"
                name="message"
                rows="3"
                class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                [placeholder]="'users.messagePlaceholder' | translate">
              </textarea>
            </div>

            <!-- Actions -->
            <div class="flex justify-end space-x-3">
              <button
                type="button"
                class="btn-secondary"
                (click)="onClose()">
                {{ 'common.cancel' | translate }}
              </button>
              <button
                type="submit"
                class="btn-primary"
                [disabled]="inviteForm.invalid || submitting()">
                @if (submitting()) {
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ 'users.sending' | translate }}
                } @else {
                  {{ 'users.sendInvitation' | translate }}
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Component uses global classes from /src/styles/ */
  `]
})
export class UserInviteModalComponent {
  @Input() userLimits: UserLimits | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() invite = new EventEmitter<InviteUserRequest>();

  submitting = signal(false);

  formData: InviteUserRequest = {
    email: '',
    role: '' as UserRole,
    firstName: '',
    lastName: '',
    message: ''
  };

  availableRoles = [
    { value: 'admin' as UserRole, label: 'roles.admin' },
    { value: 'mechanic' as UserRole, label: 'roles.mechanic' },
    { value: 'viewer' as UserRole, label: 'roles.viewer' }
  ];

  onClose() {
    this.close.emit();
  }

  onSubmit() {
    if (!this.formData.email || !this.formData.role) {
      return;
    }

    this.submitting.set(true);
    
    // Simulate API delay
    setTimeout(() => {
      this.invite.emit(this.formData);
      this.submitting.set(false);
    }, 1000);
  }

  getRolePermissions(role: UserRole): string[] {
    switch (role) {
      case 'admin':
        return [
          'manageUsers',
          'viewReports', 
          'manageInventory',
          'manageAppointments',
          'manageInvoices',
          'manageMaintenance'
        ];
      case 'mechanic':
        return [
          'manageInventory',
          'manageAppointments', 
          'manageMaintenance'
        ];
      case 'viewer':
        return [
          'viewReports'
        ];
      default:
        return [];
    }
  }
}