import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { UserStats } from '../../../core/models/user.model';

@Component({
  selector: 'app-user-stats',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      
      <!-- Total Users -->
      <div class="glass-card p-4">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-300">{{ 'users.totalUsers' | translate }}</p>
            <p class="text-2xl font-bold text-white">{{ stats.totalUsers }}</p>
          </div>
        </div>
      </div>

      <!-- Active Users -->
      <div class="glass-card p-4">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-300">{{ 'users.activeUsers' | translate }}</p>
            <p class="text-2xl font-bold text-white">{{ stats.activeUsers }}</p>
          </div>
        </div>
      </div>

      <!-- Pending Invitations -->
      <div class="glass-card p-4">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-300">{{ 'users.pendingInvitations' | translate }}</p>
            <p class="text-2xl font-bold text-white">{{ stats.pendingUsers }}</p>
          </div>
        </div>
      </div>

      <!-- Current Tier -->
      <div class="glass-card p-4">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-300">{{ 'tiers.currentPlan' | translate }}</p>
            <p class="text-xl font-bold text-white capitalize">
              {{ 'tiers.' + stats.tierInfo.current.id | translate }}
            </p>
            @if (stats.tierInfo.limits.limit !== null) {
              <p class="text-xs text-gray-400">
                {{ stats.tierInfo.limits.current }}/{{ stats.tierInfo.limits.limit }} {{ 'users.users' | translate }}
              </p>
            } @else {
              <p class="text-xs text-gray-400">{{ 'tiers.unlimited' | translate }}</p>
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Role Distribution -->
    @if (hasRoleData()) {
      <div class="glass-card p-6 mt-6">
        <h3 class="text-lg font-semibold text-white mb-4">{{ 'users.roleDistribution' | translate }}</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          @for (role of roleEntries(); track role.key) {
            @if (role.value > 0) {
              <div class="text-center">
                <div class="text-2xl font-bold text-white">{{ role.value }}</div>
                <div class="text-sm text-gray-400">
                  {{ 'roles.' + role.key | translate }}
                  @if (role.value !== 1) {
                    <span>{{ 's' }}</span>
                  }
                </div>
              </div>
            }
          }
        </div>
      </div>
    }

    <!-- Recent Joins -->
    @if (stats.recentJoins.length > 0) {
      <div class="glass-card p-6 mt-6">
        <h3 class="text-lg font-semibold text-white mb-4">{{ 'users.recentJoins' | translate }}</h3>
        <div class="space-y-3">
          @for (user of stats.recentJoins; track user.id) {
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                @if (user.avatar) {
                  <img [src]="user.avatar" [alt]="user.fullName" class="w-8 h-8 rounded-full">
                } @else {
                  <span class="text-white text-sm font-medium">
                    {{ user.firstName.charAt(0) }}{{ user.lastName.charAt(0) }}
                  </span>
                }
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white truncate">{{ user.fullName }}</p>
                <p class="text-xs text-gray-400">
                  {{ 'users.joinedOn' | translate: {date: user.joinedAt | date} }}
                </p>
              </div>
              <div class="flex-shrink-0">
                <span class="badge badge-{{ getRoleBadgeClass(user.role) }}">
                  {{ 'roles.' + user.role | translate }}
                </span>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    /* Component uses global classes from /src/styles/ */
  `]
})
export class UserStatsComponent {
  @Input({ required: true }) stats!: UserStats;

  hasRoleData(): boolean {
    return Object.values(this.stats.roleDistribution).some(count => count > 0);
  }

  roleEntries() {
    return Object.entries(this.stats.roleDistribution).map(([key, value]) => ({ key, value }));
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'owner': return 'primary';
      case 'admin': return 'success';
      case 'mechanic': return 'info';
      case 'viewer': return 'secondary';
      default: return 'secondary';
    }
  }
}