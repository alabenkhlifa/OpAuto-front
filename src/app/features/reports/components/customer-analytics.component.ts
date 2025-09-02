import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ReportingService } from '../../../core/services/reporting.service';
import { ReportFilters, CustomerMetrics, CustomerSegmentData, TopPerformers } from '../../../core/models/report.model';

Chart.register(...registerables);

@Component({
  selector: 'app-customer-analytics',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  template: `
    <div class="space-y-6">
      
      <!-- Customer Acquisition Trends -->
      <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Acquisition Trends</h3>
        <div class="h-80">
          <canvas *ngIf="acquisitionChart()" 
                  baseChart
                  [type]="acquisitionChart()!.type"
                  [data]="acquisitionChart()!.data"
                  [options]="acquisitionChart()!.options">
          </canvas>
        </div>
      </div>

      <!-- Customer Segmentation & Behavior -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Customer Segments -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Segments</h3>
          <div class="h-64">
            <canvas *ngIf="segmentChart()" 
                    baseChart
                    [type]="segmentChart()!.type"
                    [data]="segmentChart()!.data"
                    [options]="segmentChart()!.options">
            </canvas>
          </div>
        </div>

        <!-- Customer Lifetime Value -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Value Analysis</h3>
          <div class="space-y-4">
            <div class="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <span class="text-purple-700 dark:text-purple-300">Average Customer Value</span>
              <span class="font-bold text-purple-600 dark:text-purple-400">
                {{ reportingService.formatCurrency(metrics?.averageCustomerValue || 0) }}
              </span>
            </div>
            <div class="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span class="text-blue-700 dark:text-blue-300">Customer Lifetime Value</span>
              <span class="font-bold text-blue-600 dark:text-blue-400">
                {{ reportingService.formatCurrency(metrics?.customerLifetimeValue || 0) }}
              </span>
            </div>
            <div class="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span class="text-green-700 dark:text-green-300">Avg Visit Frequency</span>
              <span class="font-bold text-green-600 dark:text-green-400">
                {{ (metrics?.visitFrequency || 0).toFixed(1) }} visits/customer
              </span>
            </div>
          </div>
        </div>

      </div>

      <!-- Customer Behavior Heatmap -->
      <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Visit Patterns</h3>
        <div class="h-80">
          <canvas *ngIf="visitPatternChart()" 
                  baseChart
                  [type]="visitPatternChart()!.type"
                  [data]="visitPatternChart()!.data"
                  [options]="visitPatternChart()!.options">
          </canvas>
        </div>
      </div>

      <!-- Top Customers -->
      <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Customers by Revenue</h3>
        <div class="h-80">
          <canvas *ngIf="topCustomersChart()" 
                  baseChart
                  [type]="topCustomersChart()!.type"
                  [data]="topCustomersChart()!.data"
                  [options]="topCustomersChart()!.options">
          </canvas>
        </div>
      </div>

    </div>
  `
})
export class CustomerAnalyticsComponent implements OnInit {
  @Input() filters!: ReportFilters;
  @Input() metrics!: CustomerMetrics | null;
  
  public reportingService = inject(ReportingService);

  acquisitionChart = signal<ChartConfiguration | null>(null);
  segmentChart = signal<ChartConfiguration | null>(null);
  visitPatternChart = signal<ChartConfiguration | null>(null);
  topCustomersChart = signal<ChartConfiguration | null>(null);

  ngOnInit() {
    this.loadCustomerCharts();
  }

  private loadCustomerCharts() {
    // Customer Acquisition Chart
    this.acquisitionChart.set({
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
        datasets: [
          {
            label: 'New Customers',
            data: [8, 12, 15, 10, 18, 14, 22, 16],
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.3,
            fill: true
          },
          {
            label: 'Returning Customers',
            data: [45, 52, 48, 58, 62, 68, 65, 72],
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.3,
            fill: true
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
            beginAtZero: true
          }
        }
      }
    });

    // Customer Segments Chart
    this.segmentChart.set({
      type: 'pie',
      data: {
        labels: ['VIP', 'Regular', 'New', 'Inactive'],
        datasets: [{
          data: [15, 60, 20, 5],
          backgroundColor: [
            '#8B5CF6',
            '#3B82F6',
            '#10B981',
            '#6B7280'
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            position: 'bottom'
          }
        }
      }
    });

    // Visit Pattern Chart (Heatmap simulation)
    this.visitPatternChart.set({
      type: 'bar',
      data: {
        labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        datasets: [{
          label: 'Customer Visits',
          data: [45, 52, 48, 58, 62, 35],
          backgroundColor: [
            '#EF4444',
            '#F59E0B',
            '#10B981',
            '#3B82F6',
            '#8B5CF6',
            '#6B7280'
          ],
          borderWidth: 1
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
            beginAtZero: true
          }
        }
      }
    });

    // Top Customers Chart
    this.topCustomersChart.set({
      type: 'bar',
      data: {
        labels: ['Ahmed Ben Ali', 'Fatma Trabelsi', 'Mohamed Khemir', 'Leila Mansouri', 'Samira Bouzid'],
        datasets: [{
          label: 'Total Spent (TND)',
          data: [2850, 1650, 890, 1320, 4250],
          backgroundColor: 'rgba(139, 92, 246, 0.8)',
          borderColor: 'rgb(139, 92, 246)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        indexAxis: 'y' as const,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: (value) => this.reportingService.formatCurrency(Number(value))
            }
          }
        }
      }
    });
  }
}