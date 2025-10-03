import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaintenanceStats } from '../../../core/models/maintenance.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-maintenance-stats',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      
      <!-- Total Jobs -->
      <div class="glass-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-300">{{ 'maintenance.totalJobs' | translate }}</p>
            <p class="text-2xl font-bold text-white">{{ stats?.totalJobs || 0 }}</p>
          </div>
          <div class="text-2xl">📋</div>
        </div>
      </div>

      <!-- Active Jobs -->
      <div class="glass-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-300">{{ 'maintenance.activeJobs' | translate }}</p>
            <p class="text-2xl font-bold text-white">{{ stats?.activeJobs || 0 }}</p>
          </div>
          <div class="text-2xl">⏱️</div>
        </div>
      </div>

      <!-- Completed Today -->
      <div class="glass-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-300">{{ 'maintenance.completedToday' | translate }}</p>
            <p class="text-2xl font-bold text-white">{{ stats?.completedToday || 0 }}</p>
          </div>
          <div class="text-2xl">✅</div>
        </div>
      </div>

      <!-- Pending Approvals -->
      <div class="glass-card">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-300">{{ 'maintenance.pendingApprovals' | translate }}</p>
            <p class="text-2xl font-bold text-white">{{ stats?.pendingApprovals || 0 }}</p>
          </div>
          <div class="text-2xl">⚠️</div>
        </div>
      </div>

    </div>

    <!-- Additional Stats Row (for larger views) -->
    @if (view === 'list' || view === 'dashboard' || view === 'history') {
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        
        <!-- Average Completion Time -->
        <div class="glass-card">
          <div class="text-center">
            <p class="text-sm font-medium text-gray-300">{{ 'maintenance.avgCompletionTime' | translate }}</p>
            <p class="text-xl font-bold text-white">{{ (stats?.averageCompletionTime || 0).toFixed(1) }}h</p>
          </div>
        </div>

        <!-- Revenue Today -->
        @if (authService.isOwner()) {
          <div class="glass-card">
            <div class="text-center">
              <p class="text-sm font-medium text-gray-300">{{ 'maintenance.revenueToday' | translate }}</p>
              <p class="text-xl font-bold text-white">{{ formatCurrency(stats?.revenueToday || 0) }}</p>
            </div>
          </div>
        }

        <!-- Efficiency -->
        <div class="glass-card">
          <div class="text-center">
            <p class="text-sm font-medium text-gray-300">{{ 'maintenance.weeklyEfficiency' | translate }}</p>
            <p class="text-xl font-bold text-white">{{ (stats?.efficiency || 0).toFixed(1) }}%</p>
          </div>
        </div>

      </div>
    }
  `,
  styles: [`
    /* Maintenance Stats - Uses global glass-card styling */
    /* Component now uses global .glass-card from /src/styles.css */
  `]
})
export class MaintenanceStatsComponent {
  
  authService = inject(AuthService);
  
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