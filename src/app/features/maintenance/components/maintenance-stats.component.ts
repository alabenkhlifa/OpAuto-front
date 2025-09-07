import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaintenanceStats } from '../../../core/models/maintenance.model';

@Component({
  selector: 'app-maintenance-stats',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      
      <!-- Total Jobs -->
      <div class="stats-card">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Jobs</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats?.totalJobs || 0 }}</p>
          </div>
        </div>
      </div>

      <!-- Active Jobs -->
      <div class="stats-card">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Active Jobs</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats?.activeJobs || 0 }}</p>
          </div>
        </div>
      </div>

      <!-- Completed Today -->
      <div class="stats-card">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Completed Today</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats?.completedToday || 0 }}</p>
          </div>
        </div>
      </div>

      <!-- Pending Approvals -->
      <div class="stats-card">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Approvals</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats?.pendingApprovals || 0 }}</p>
          </div>
        </div>
      </div>

    </div>

    <!-- Additional Stats Row (for larger views) -->
    @if (view === 'list' || view === 'dashboard') {
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        
        <!-- Average Completion Time -->
        <div class="stats-card-small">
          <div class="text-center">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Completion Time</p>
            <p class="text-xl font-bold text-gray-900 dark:text-white">{{ (stats?.averageCompletionTime || 0).toFixed(1) }}h</p>
          </div>
        </div>

        <!-- Revenue Today -->
        <div class="stats-card-small">
          <div class="text-center">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Revenue Today</p>
            <p class="text-xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(stats?.revenueToday || 0) }}</p>
          </div>
        </div>

        <!-- Efficiency -->
        <div class="stats-card-small">
          <div class="text-center">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Weekly Efficiency</p>
            <p class="text-xl font-bold text-gray-900 dark:text-white">{{ (stats?.efficiency || 0).toFixed(1) }}%</p>
          </div>
        </div>

      </div>
    }
  `,
  styles: [`
    /* Maintenance Stats - Permanent Dark Glassmorphism */
    .stats-card,
    .stats-card-small {
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(75, 85, 99, 0.6);
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .stats-card {
      padding: 1.5rem;
    }

    .stats-card-small {
      padding: 1rem;
    }

    .stats-card:hover,
    .stats-card-small:hover {
      background: rgba(31, 41, 55, 0.98);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8);
      border-color: rgba(59, 130, 246, 0.7);
      transform: translateY(-2px);
    }

    /* Fix text colors for permanent dark theme */
    .stats-card p,
    .stats-card-small p {
      color: #ffffff !important;
    }

    .stats-card .text-gray-500,
    .stats-card .text-gray-400,
    .stats-card-small .text-gray-500,
    .stats-card-small .text-gray-400 {
      color: #9ca3af !important;
    }

    .stats-card .text-gray-900,
    .stats-card-small .text-gray-900 {
      color: #ffffff !important;
    }

    .stats-card .text-2xl,
    .stats-card .text-xl,
    .stats-card-small .text-2xl,
    .stats-card-small .text-xl {
      color: #ffffff !important;
    }

    /* Fix icon backgrounds for dark theme */
    .stats-card .bg-blue-100,
    .stats-card .bg-orange-100,
    .stats-card .bg-green-100,
    .stats-card .bg-red-100 {
      background: rgba(59, 130, 246, 0.2) !important;
    }
  `]
})
export class MaintenanceStatsComponent {
  
  @Input() stats: MaintenanceStats | null = null;
  @Input() view: string = 'grid';

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0
    }).format(amount);
  }
}