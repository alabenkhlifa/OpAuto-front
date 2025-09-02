import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ReportingService } from '../../../core/services/reporting.service';
import { ReportFilters, FinancialMetrics, PaymentTrendData } from '../../../core/models/report.model';

Chart.register(...registerables);

@Component({
  selector: 'app-financial-reports',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  template: `
    <div class="space-y-6">
      
      <!-- Revenue vs Expenses Chart -->
      <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue vs Expenses</h3>
        <div class="h-80">
          <canvas *ngIf="revenueExpenseChart()" 
                  baseChart
                  [type]="revenueExpenseChart()!.type"
                  [data]="revenueExpenseChart()!.data"
                  [options]="revenueExpenseChart()!.options">
          </canvas>
        </div>
      </div>

      <!-- Payment Methods Distribution -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h3>
          <div class="h-64">
            <canvas *ngIf="paymentMethodChart()" 
                    baseChart
                    [type]="paymentMethodChart()!.type"
                    [data]="paymentMethodChart()!.data"
                    [options]="paymentMethodChart()!.options">
            </canvas>
          </div>
        </div>

        <!-- Cash Flow Analysis -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cash Flow Analysis</h3>
          <div class="space-y-4">
            <div class="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span class="text-green-700 dark:text-green-300">Cash Inflow</span>
              <span class="font-bold text-green-600 dark:text-green-400">
                {{ reportingService.formatCurrency((metrics?.paidRevenue || 0)) }}
              </span>
            </div>
            <div class="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <span class="text-red-700 dark:text-red-300">Outstanding Amount</span>
              <span class="font-bold text-red-600 dark:text-red-400">
                {{ reportingService.formatCurrency((metrics?.pendingRevenue || 0) + (metrics?.overdueRevenue || 0)) }}
              </span>
            </div>
            <div class="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span class="text-blue-700 dark:text-blue-300">Net Cash Flow</span>
              <span class="font-bold text-blue-600 dark:text-blue-400">
                {{ reportingService.formatCurrency((metrics?.paidRevenue || 0) - (metrics?.pendingRevenue || 0)) }}
              </span>
            </div>
          </div>
        </div>

      </div>

      <!-- Profit Analysis -->
      <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profit Analysis</h3>
        <div class="h-80">
          <canvas *ngIf="profitChart()" 
                  baseChart
                  [type]="profitChart()!.type"
                  [data]="profitChart()!.data"
                  [options]="profitChart()!.options">
          </canvas>
        </div>
      </div>

    </div>
  `
})
export class FinancialReportsComponent implements OnInit {
  @Input() filters!: ReportFilters;
  @Input() metrics!: FinancialMetrics | null;
  
  public reportingService = inject(ReportingService);

  revenueExpenseChart = signal<ChartConfiguration | null>(null);
  paymentMethodChart = signal<ChartConfiguration | null>(null);
  profitChart = signal<ChartConfiguration | null>(null);

  ngOnInit() {
    this.loadFinancialCharts();
  }

  private loadFinancialCharts() {
    // Revenue vs Expenses Chart
    this.revenueExpenseChart.set({
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
        datasets: [
          {
            label: 'Revenue',
            data: [12500, 14200, 13800, 15600, 16200, 17800, 16900, 18500],
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 1
          },
          {
            label: 'Expenses',
            data: [8500, 9200, 8800, 9600, 10200, 11800, 10900, 12500],
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

    // Payment Methods Chart
    this.paymentMethodChart.set({
      type: 'pie',
      data: {
        labels: ['Cash', 'Card', 'Bank Transfer', 'Cheque'],
        datasets: [{
          data: [45, 30, 20, 5],
          backgroundColor: [
            '#10B981',
            '#3B82F6', 
            '#8B5CF6',
            '#F59E0B'
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

    // Profit Chart
    this.profitChart.set({
      type: 'line',
      data: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Gross Profit',
            data: [3200, 4100, 3800, 4500],
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.3,
            fill: true
          },
          {
            label: 'Net Profit',
            data: [2800, 3600, 3200, 3900],
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
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