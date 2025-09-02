import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ReportingService } from '../../../core/services/reporting.service';
import { ReportFilters, OperationalMetrics } from '../../../core/models/report.model';

Chart.register(...registerables);

@Component({
  selector: 'app-operational-reports',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  template: `
    <div class="space-y-6">
      
      <!-- Mechanic Performance Chart -->
      <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Mechanic Performance</h3>
        <div class="h-80">
          <canvas *ngIf="mechanicChart()" 
                  baseChart
                  [type]="mechanicChart()!.type"
                  [data]="mechanicChart()!.data"
                  [options]="mechanicChart()!.options">
          </canvas>
        </div>
      </div>

      <!-- Service Efficiency & Appointment Trends -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Service Time Analysis -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Service Time Analysis</h3>
          <div class="h-64">
            <canvas *ngIf="serviceTimeChart()" 
                    baseChart
                    [type]="serviceTimeChart()!.type"
                    [data]="serviceTimeChart()!.data"
                    [options]="serviceTimeChart()!.options">
            </canvas>
          </div>
        </div>

        <!-- Appointment Trends -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appointment Trends</h3>
          <div class="h-64">
            <canvas *ngIf="appointmentTrendChart()" 
                    baseChart
                    [type]="appointmentTrendChart()!.type"
                    [data]="appointmentTrendChart()!.data"
                    [options]="appointmentTrendChart()!.options">
            </canvas>
          </div>
        </div>

      </div>

      <!-- Capacity Utilization -->
      <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resource Utilization</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Garage Capacity -->
          <div class="space-y-4">
            <div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-gray-600 dark:text-gray-400">Garage Capacity</span>
                <span class="text-gray-900 dark:text-white">{{ (metrics?.garageCapacityUsed || 0).toFixed(1) }}%</span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div class="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all" 
                     [style.width.%]="metrics?.garageCapacityUsed || 0"></div>
              </div>
            </div>
            
            <div>
              <div class="flex justify-between text-sm mb-2">
                <span class="text-gray-600 dark:text-gray-400">Mechanic Utilization</span>
                <span class="text-gray-900 dark:text-white">{{ (metrics?.mechanicUtilization || 0).toFixed(1) }}%</span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div class="bg-gradient-to-r from-green-500 to-emerald-600 h-3 rounded-full transition-all" 
                     [style.width.%]="metrics?.mechanicUtilization || 0"></div>
              </div>
            </div>
          </div>

          <!-- Efficiency Metrics -->
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-gray-600 dark:text-gray-400">On-Time Completion</span>
              <span class="font-semibold text-gray-900 dark:text-white">{{ (metrics?.onTimeCompletionRate || 0).toFixed(1) }}%</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-600 dark:text-gray-400">Conversion Rate</span>
              <span class="font-semibold text-gray-900 dark:text-white">{{ (metrics?.appointmentConversionRate || 0).toFixed(1) }}%</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-600 dark:text-gray-400">Customer Satisfaction</span>
              <span class="font-semibold text-gray-900 dark:text-white">{{ (metrics?.customerSatisfactionScore || 0).toFixed(1) }}/5.0</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  `
})
export class OperationalReportsComponent implements OnInit {
  @Input() filters!: ReportFilters;
  @Input() metrics!: OperationalMetrics | null;
  
  public reportingService = inject(ReportingService);

  mechanicChart = signal<ChartConfiguration | null>(null);
  serviceTimeChart = signal<ChartConfiguration | null>(null);
  appointmentTrendChart = signal<ChartConfiguration | null>(null);

  ngOnInit() {
    this.loadOperationalCharts();
  }

  private loadOperationalCharts() {
    // Mechanic Performance Chart
    this.mechanicChart.set({
      type: 'bar',
      data: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Revenue',
            data: [4200, 3800, 4500, 4100],
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 1
          },
          {
            label: 'Expenses',
            data: [2800, 2400, 3100, 2900],
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => this.reportingService.formatCurrency(Number(value))
            }
          }
        }
      }
    });

    // Service Time Analysis Chart
    this.serviceTimeChart.set({
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        datasets: [{
          label: 'Avg Service Time (hours)',
          data: [2.5, 3.2, 2.8, 3.5, 2.9, 4.1],
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Hours'
            }
          }
        }
      }
    });

    // Appointment Trends Chart
    this.appointmentTrendChart.set({
      type: 'line',
      data: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [{
          label: 'Appointments',
          data: [12, 15, 8, 18],
          borderColor: 'rgb(147, 51, 234)',
          backgroundColor: 'rgba(147, 51, 234, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Appointments'
            }
          }
        }
      }
    });
  }
}