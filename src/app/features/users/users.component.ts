import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { UserService } from '../../core/services/user.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { 
  User, 
  UserStats, 
  UserFilters, 
  UserLimits,
  InviteUserRequest,
  UserInvitation 
} from '../../core/models/user.model';
import { UserStatsComponent } from './components/user-stats.component';
import { UserCardComponent } from './components/user-card.component';
import { UserInviteModalComponent } from './components/user-invite-modal.component';
import { UpgradePromptModalComponent } from './components/upgrade-prompt-modal.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslatePipe,
    UserStatsComponent,
    UserCardComponent,
    UserInviteModalComponent,
    UpgradePromptModalComponent
  ],
  template: `
    <div class="p-6 space-y-6">
      
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">
            {{ 'users.teamManagement' | translate }}
          </h1>
          <p class="mt-1 text-sm text-gray-300">
            {{ 'users.manageTeamMembers' | translate }}
          </p>
        </div>
        <div class="mt-4 sm:mt-0 flex space-x-3">
          <button 
            class="btn-secondary"
            (click)="showTierInfo = !showTierInfo">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="hidden sm:inline">{{ 'users.tierInfo' | translate }}</span>
          </button>
          <button 
            class="btn-primary"
            [disabled]="!userLimits()?.canAddUser"
            (click)="openInviteModal()">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span class="hidden sm:inline">{{ 'users.inviteUser' | translate }}</span>
          </button>
        </div>
      </div>

      <!-- Tier Info -->
      @if (showTierInfo && userLimits()) {
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-white">
                {{ 'tiers.' + (stats()?.tierInfo?.current?.id || 'solo') | translate }} {{ 'tiers.plan' | translate }}
              </h3>
              <p class="text-sm text-gray-300">
                {{ 'users.currentUsage' | translate: {
                  current: userLimits()!.current, 
                  limit: userLimits()!.limit || '∞'
                } }}
              </p>
            </div>
            <div class="flex items-center space-x-4">
              @if (userLimits()!.limit !== null) {
                <div class="text-right">
                  <div class="text-sm text-gray-400">{{ 'users.remaining' | translate }}</div>
                  <div class="text-lg font-bold text-white">
                    {{ userLimits()!.limit! - userLimits()!.current }}
                  </div>
                </div>
                <div class="w-32 bg-gray-700 rounded-full h-2">
                  <div 
                    class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    [style.width.%]="(userLimits()!.current / userLimits()!.limit!) * 100">
                  </div>
                </div>
              }
              @if (userLimits()!.nextTier) {
                <button 
                  class="btn-secondary text-xs"
                  (click)="showUpgradePrompt()">
                  {{ 'tiers.upgrade' | translate }}
                </button>
              }
            </div>
          </div>
        </div>
      }

      <!-- User Limit Warning -->
      @if (!userLimits()?.canAddUser) {
        <div class="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.98-.833-2.75 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-400">
                {{ 'users.limitReached' | translate }}
              </h3>
              <p class="mt-1 text-sm text-red-300">
                {{ 'users.limitReachedDescription' | translate: {
                  tier: stats()?.tierInfo?.current?.name || 'Solo'
                } }}
              </p>
              @if (userLimits()!.nextTier) {
                <button 
                  class="mt-2 btn-primary text-sm"
                  (click)="showUpgradePrompt()">
                  {{ 'tiers.upgradeTo' | translate: {tier: userLimits()!.nextTier?.id || 'professional'} }}
                </button>
              }
            </div>
          </div>
        </div>
      }

      <!-- Stats Overview -->
      @if (stats()) {
        <app-user-stats [stats]="stats()!"></app-user-stats>
      }

      <!-- Users List -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-white">
            {{ 'users.teamMembers' | translate }}
            <span class="ml-2 text-sm font-normal text-gray-400">
              ({{ users().length }})
            </span>
          </h2>
          
          <!-- Search -->
          <div class="relative">
            <input
              type="text"
              [(ngModel)]="searchTerm"
              (ngModelChange)="onSearchChange($event)"
              [placeholder]="'users.searchUsers' | translate"
              class="w-64 px-4 py-2 pl-10 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <svg class="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <!-- No Users Message -->
        @if (filteredUsers().length === 0 && !loading()) {
          <div class="text-center py-12">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-white">{{ 'users.noUsersFound' | translate }}</h3>
            <p class="mt-1 text-sm text-gray-400">{{ 'users.noUsersDescription' | translate }}</p>
            @if (userLimits()?.canAddUser) {
              <div class="mt-6">
                <button class="btn-primary" (click)="openInviteModal()">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  {{ 'users.inviteFirstUser' | translate }}
                </button>
              </div>
            }
          </div>
        } @else {
          <!-- Users Grid -->
          <div class="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            @for (user of filteredUsers(); track user.id) {
              <app-user-card
                [user]="user"
                [currentUser]="currentUser()"
                (updateRole)="updateUserRole($event.userId, $event.role)"
                (updateStatus)="updateUserStatus($event.userId, $event.status)"
                (removeUser)="removeUser($event)">
              </app-user-card>
            }
          </div>

          <!-- Pending Invitations -->
          @if (pendingInvitations().length > 0) {
            <div class="mt-8">
              <h3 class="text-lg font-semibold text-white mb-4">
                {{ 'users.pendingInvitations' | translate }}
                <span class="ml-2 text-sm font-normal text-gray-400">
                  ({{ pendingInvitations().length }})
                </span>
              </h3>
              <div class="space-y-2">
                @for (invitation of pendingInvitations(); track invitation.id) {
                  <div class="glass-card p-4 flex items-center justify-between">
                    <div>
                      <div class="text-white font-medium">{{ invitation.email }}</div>
                      <div class="text-sm text-gray-400">
                        {{ 'users.invitedAs' | translate: {role: 'roles.' + invitation.role | translate} }} •
                        {{ 'users.invitedOn' | translate: {date: invitation.invitedAt | date} }}
                      </div>
                    </div>
                    <div class="flex space-x-2">
                      <button 
                        class="btn-secondary text-sm"
                        (click)="resendInvitation(invitation.id)">
                        {{ 'users.resend' | translate }}
                      </button>
                      <button 
                        class="btn-danger text-sm"
                        (click)="cancelInvitation(invitation.id)">
                        {{ 'common.cancel' | translate }}
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>

    </div>

    <!-- Modals -->
    @if (showInviteModal()) {
      <app-user-invite-modal
        [userLimits]="userLimits()"
        (close)="showInviteModal.set(false)"
        (invite)="inviteUser($event)">
      </app-user-invite-modal>
    }

    @if (showUpgradeModal() && upgradePromptData()) {
      <app-upgrade-prompt-modal
        [upgradePrompt]="upgradePromptData()!"
        (close)="showUpgradeModal.set(false)"
        (upgrade)="handleUpgrade($event)">
      </app-upgrade-prompt-modal>
    }
  `,
  styles: [`
    /* Component uses global classes from /src/styles/ */
  `]
})
export class UsersComponent implements OnInit {
  private userService = inject(UserService);
  private subscriptionService = inject(SubscriptionService);
  private router = inject(Router);

  // Signals
  users = signal<User[]>([]);
  currentUser = signal<User | null>(null);
  stats = signal<UserStats | null>(null);
  userLimits = signal<UserLimits | null>(null);
  invitations = signal<UserInvitation[]>([]);
  loading = signal(false);
  showInviteModal = signal(false);
  showUpgradeModal = signal(false);
  upgradePromptData = signal<any>(null);

  // UI State
  searchTerm = '';
  showTierInfo = false;

  // Computed
  filteredUsers = computed(() => {
    const users = this.users();
    const search = this.searchTerm.toLowerCase();
    if (!search) return users;
    
    return users.filter(user =>
      user.fullName.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search) ||
      user.role.toLowerCase().includes(search)
    );
  });

  pendingInvitations = computed(() => {
    return this.invitations().filter(inv => inv.status === 'pending');
  });

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.loading.set(true);
    
    // Load users
    this.userService.getUsers().subscribe({
      next: (users) => this.users.set(users),
      error: (error) => console.error('Error loading users:', error)
    });

    // Load current user
    this.userService.getCurrentUser().subscribe({
      next: (user) => this.currentUser.set(user),
      error: (error) => console.error('Error loading current user:', error)
    });

    // Load stats
    this.userService.getUserStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading stats:', error);
        this.loading.set(false);
      }
    });

    // Load user limits
    this.userService.getUserLimits().subscribe({
      next: (limits) => this.userLimits.set(limits),
      error: (error) => console.error('Error loading limits:', error)
    });

    // Load invitations
    this.userService.invitations$.subscribe({
      next: (invitations) => this.invitations.set(invitations),
      error: (error) => console.error('Error loading invitations:', error)
    });
  }

  onSearchChange(term: string) {
    this.searchTerm = term;
  }

  openInviteModal() {
    const limits = this.userLimits();
    if (!limits?.canAddUser) {
      this.showUpgradePrompt();
      return;
    }
    this.showInviteModal.set(true);
  }

  inviteUser(request: InviteUserRequest) {
    this.userService.inviteUser(request).subscribe({
      next: () => {
        this.showInviteModal.set(false);
        // Refresh data
        this.loadData();
      },
      error: (error) => {
        console.error('Error inviting user:', error);
        if (error.message.includes('User limit reached')) {
          this.showUpgradePrompt();
        }
      }
    });
  }

  updateUserRole(userId: string, role: any) {
    this.userService.updateUserRole(userId, role).subscribe({
      next: () => this.loadData(),
      error: (error) => console.error('Error updating user role:', error)
    });
  }

  updateUserStatus(userId: string, status: any) {
    this.userService.updateUserStatus(userId, status).subscribe({
      next: () => this.loadData(),
      error: (error) => console.error('Error updating user status:', error)
    });
  }

  removeUser(userId: string) {
    if (confirm('Are you sure you want to remove this user?')) {
      this.userService.removeUser(userId).subscribe({
        next: () => this.loadData(),
        error: (error) => console.error('Error removing user:', error)
      });
    }
  }

  resendInvitation(invitationId: string) {
    this.userService.resendInvitation(invitationId).subscribe({
      next: () => this.loadData(),
      error: (error) => console.error('Error resending invitation:', error)
    });
  }

  cancelInvitation(invitationId: string) {
    this.userService.cancelInvitation(invitationId).subscribe({
      next: () => this.loadData(),
      error: (error) => console.error('Error cancelling invitation:', error)
    });
  }

  showUpgradePrompt() {
    this.subscriptionService.getTierComparison().subscribe({
      next: (comparison) => {
        if (comparison.recommendedTierId) {
          const currentTier = comparison.tiers.find(t => t.id === comparison.currentTierId)!;
          const suggestedTier = comparison.tiers.find(t => t.id === comparison.recommendedTierId)!;
          
          this.upgradePromptData.set({
            currentTier,
            suggestedTier,
            benefits: this.getUpgradeBenefits(comparison.currentTierId, comparison.recommendedTierId),
            priceComparison: {
              currentPrice: currentTier.price,
              newPrice: suggestedTier.price,
              additionalCost: suggestedTier.price - currentTier.price
            }
          });
          
          this.showUpgradeModal.set(true);
        }
      }
    });
  }

  handleUpgrade(tierId: string) {
    this.subscriptionService.upgradeTo(tierId as any).subscribe({
      next: () => {
        this.showUpgradeModal.set(false);
        this.loadData(); // Refresh with new limits
      },
      error: (error) => console.error('Error upgrading:', error)
    });
  }

  private getUpgradeBenefits(currentTier: string, targetTier: string): string[] {
    if (currentTier === 'solo' && targetTier === 'starter') {
      return [
        'Add up to 5 team members',
        'Advanced reports and analytics',
        'Mobile app access',
        'Email notifications',
        'Priority support'
      ];
    }
    
    if (currentTier === 'starter' && targetTier === 'professional') {
      return [
        'Unlimited team members',
        'Team collaboration tools',
        'API access',
        'Custom integrations',
        'Priority phone support'
      ];
    }
    
    return [];
  }
}