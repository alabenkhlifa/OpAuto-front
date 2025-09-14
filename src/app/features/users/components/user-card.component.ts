import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { User, UserRole, UserStatus } from '../../../core/models/user.model';

@Component({
  selector: 'app-user-card',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="glass-card p-4 hover:bg-gray-800/40 transition-all duration-200">
      <div class="flex items-start justify-between">
        
        <!-- User Info -->
        <div class="flex items-start space-x-3">
          <div class="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
            @if (user.avatar) {
              <img [src]="user.avatar" [alt]="user.fullName" class="w-10 h-10 rounded-full">
            } @else {
              <span class="text-white text-sm font-medium">
                {{ user.firstName.charAt(0) }}{{ user.lastName.charAt(0) }}
              </span>
            }
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-medium text-white truncate">{{ user.fullName }}</h3>
            <p class="text-xs text-gray-400 truncate">{{ user.email }}</p>
            <div class="flex items-center space-x-2 mt-1">
              <span class="badge badge-{{ getRoleBadgeClass(user.role) }} text-xs">
                {{ 'roles.' + user.role | translate }}
              </span>
              <span class="badge badge-{{ getStatusBadgeClass(user.status) }} text-xs">
                {{ 'status.' + user.status | translate }}
              </span>
            </div>
          </div>
        </div>

        <!-- Actions Dropdown -->
        @if (canManageUser()) {
          <div class="relative">
            <button 
              class="text-gray-400 hover:text-white p-1 rounded"
              (click)="showActions.set(!showActions())">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            @if (showActions()) {
              <div class="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg z-10 border border-gray-700">
                
                <!-- Change Role -->
                @if (user.role !== 'owner' && currentUser?.role === 'owner') {
                  <div class="py-1">
                    <div class="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {{ 'users.changeRole' | translate }}
                    </div>
                    @for (role of availableRoles; track role) {
                      @if (role !== user.role) {
                        <button 
                          class="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                          (click)="changeRole(role)">
                          {{ 'roles.' + role | translate }}
                        </button>
                      }
                    }
                  </div>
                  <div class="border-t border-gray-700"></div>
                }

                <!-- Change Status -->
                @if (user.id !== currentUser?.id) {
                  <div class="py-1">
                    <div class="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {{ 'users.changeStatus' | translate }}
                    </div>
                    @for (status of availableStatuses; track status) {
                      @if (status !== user.status) {
                        <button 
                          class="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                          (click)="changeStatus(status)">
                          {{ 'status.' + status | translate }}
                        </button>
                      }
                    }
                  </div>
                  <div class="border-t border-gray-700"></div>
                }

                <!-- Remove User -->
                @if (user.role !== 'owner' && user.id !== currentUser?.id) {
                  <div class="py-1">
                    <button 
                      class="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                      (click)="confirmRemoveUser()">
                      {{ 'users.removeUser' | translate }}
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Additional Info -->
      <div class="mt-3 pt-3 border-t border-gray-700">
        <div class="flex items-center justify-between text-xs text-gray-400">
          <span>{{ 'users.joinedOn' | translate: {date: user.joinedAt | date} }}</span>
          @if (user.lastActiveAt) {
            <span>{{ 'users.lastActive' | translate: {date: user.lastActiveAt | date:'short'} }}</span>
          }
        </div>
        
        <!-- Permissions Summary -->
        @if (user.role !== 'owner') {
          <div class="mt-2">
            <div class="text-xs text-gray-400 mb-1">{{ 'users.permissions' | translate }}:</div>
            <div class="flex flex-wrap gap-1">
              @for (permission of getActivePermissions(); track permission) {
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                  {{ 'permissions.' + permission | translate }}
                </span>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Click outside handler to close dropdown -->
    @if (showActions()) {
      <div class="fixed inset-0 z-0" (click)="showActions.set(false)"></div>
    }
  `,
  styles: [`
    /* Component uses global classes from /src/styles/ */
  `]
})
export class UserCardComponent {
  @Input({ required: true }) user!: User;
  @Input() currentUser: User | null = null;

  @Output() updateRole = new EventEmitter<{userId: string, role: UserRole}>();
  @Output() updateStatus = new EventEmitter<{userId: string, status: UserStatus}>();
  @Output() removeUser = new EventEmitter<string>();

  showActions = signal(false);

  availableRoles: UserRole[] = ['admin', 'mechanic', 'viewer'];
  availableStatuses: UserStatus[] = ['active', 'inactive', 'suspended'];

  canManageUser(): boolean {
    if (!this.currentUser) return false;
    if (this.user.role === 'owner') return false; // Owner cannot be managed
    if (this.currentUser.role === 'owner') return true; // Owner can manage everyone
    if (this.currentUser.role === 'admin') return true;
    return false;
  }

  getRoleBadgeClass(role: UserRole): string {
    switch (role) {
      case 'owner': return 'primary';
      case 'admin': return 'success';
      case 'mechanic': return 'info';
      case 'viewer': return 'secondary';
      default: return 'secondary';
    }
  }

  getStatusBadgeClass(status: UserStatus): string {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'inactive': return 'secondary';
      case 'suspended': return 'danger';
      default: return 'secondary';
    }
  }

  getActivePermissions(): string[] {
    const permissions = [];
    const userPerms = this.user.permissions;
    
    if (userPerms.canManageUsers) permissions.push('manageUsers');
    if (userPerms.canManageSettings) permissions.push('manageSettings');
    if (userPerms.canViewReports) permissions.push('viewReports');
    if (userPerms.canManageInventory) permissions.push('manageInventory');
    if (userPerms.canManageAppointments) permissions.push('manageAppointments');
    if (userPerms.canManageInvoices) permissions.push('manageInvoices');
    if (userPerms.canManageMaintenance) permissions.push('manageMaintenance');
    
    return permissions.slice(0, 4); // Show only first 4 to save space
  }

  changeRole(role: UserRole) {
    this.updateRole.emit({ userId: this.user.id, role });
    this.showActions.set(false);
  }

  changeStatus(status: UserStatus) {
    this.updateStatus.emit({ userId: this.user.id, status });
    this.showActions.set(false);
  }

  confirmRemoveUser() {
    if (confirm(`Are you sure you want to remove ${this.user.fullName} from your team?`)) {
      this.removeUser.emit(this.user.id);
    }
    this.showActions.set(false);
  }
}