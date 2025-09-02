import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeStats } from '../../../core/models/employee.model';

@Component({
  selector: 'app-employee-stats',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (stats) {
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <!-- Total Employees -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Employees</p>
              <p class="text-2xl font-semibold text-gray-900 dark:text-white">{{ stats.totalEmployees }}</p>
            </div>
          </div>
        </div>

        <!-- Active Employees -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Active</p>
              <p class="text-2xl font-semibold text-gray-900 dark:text-white">{{ stats.activeEmployees }}</p>
            </div>
          </div>
        </div>

        <!-- Available Now -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Available Now</p>
              <p class="text-2xl font-semibold text-gray-900 dark:text-white">{{ stats.availableEmployees }}</p>
            </div>
          </div>
        </div>

        <!-- Monthly Payroll -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Payroll</p>
              <p class="text-2xl font-semibold text-gray-900 dark:text-white">{{ formatCurrency(stats.totalSalaryExpense) }}</p>
            </div>
          </div>
        </div>

      </div>

      <!-- Department Distribution -->
      <div class="mt-6 bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Department Distribution</h3>
        <div class="space-y-3">
          @for (dept of getDepartmentEntries(stats); track dept.department) {
            @if (dept.count > 0) {
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <div class="w-3 h-3 rounded-full mr-3" [class]="getDepartmentColor(dept.department)"></div>
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ getDepartmentLabel(dept.department) }}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="text-sm text-gray-500 dark:text-gray-400">{{ dept.count }}</span>
                  <div class="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div class="h-2 rounded-full" [class]="getDepartmentColor(dept.department)" [style.width.%]="dept.percentage"></div>
                  </div>
                </div>
              </div>
            }
          }
        </div>
      </div>
    }
  `
})
export class EmployeeStatsComponent {
  @Input() stats: EmployeeStats | null = null;

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0
    }).format(amount);
  }

  getDepartmentEntries(stats: EmployeeStats) {
    const total = stats.totalEmployees;
    return Object.entries(stats.departmentDistribution).map(([dept, count]) => ({
      department: dept as keyof typeof stats.departmentDistribution,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }));
  }

  getDepartmentLabel(department: string): string {
    const labels = {
      'management': 'Management',
      'mechanical': 'Mechanical',
      'bodywork': 'Bodywork',
      'electrical': 'Electrical',
      'service': 'Service'
    };
    return labels[department as keyof typeof labels] || department;
  }

  getDepartmentColor(department: string): string {
    const colors = {
      'management': 'bg-purple-500',
      'mechanical': 'bg-blue-500',
      'bodywork': 'bg-green-500',
      'electrical': 'bg-yellow-500',
      'service': 'bg-orange-500'
    };
    return colors[department as keyof typeof colors] || 'bg-gray-500';
  }
}