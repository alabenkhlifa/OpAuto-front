import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ReportingService } from '../../../core/services/reporting.service';
import { ReportFilters, InventoryMetrics } from '../../../core/models/report.model';

Chart.register(...registerables);

@Component({
  selector: 'app-inventory-reports',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  template: `
    <div class="space-y-6">
      
      <!-- Stock Level Analysis -->
      <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Stock Level Analysis</h3>
        <div class="h-80">
          <canvas *ngIf="stockChart()" 
                  baseChart
                  [type]="stockChart()!.type"
                  [data]="stockChart()!.data"
                  [options]="stockChart()!.options">
          </canvas>
        </div>
      </div>

      <!-- Inventory Performance -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Parts by Category -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Parts by Category</h3>
          <div class="h-64">
            <canvas *ngIf="categoryChart()" 
                    baseChart
                    [type]="categoryChart()!.type"
                    [data]="categoryChart()!.data"
                    [options]="categoryChart()!.options">
            </canvas>
          </div>
        </div>

        <!-- Supplier Performance -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Supplier Performance</h3>
          <div class="space-y-4">
            <div class="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div>
                <p class="font-medium text-green-700 dark:text-green-300">Auto Parts Tunisia</p>
                <p class="text-sm text-green-600 dark:text-green-400">On-time delivery: 95%</p>
              </div>
              <div class="text-right">
                <p class="font-bold text-green-600 dark:text-green-400">{{ reportingService.formatCurrency(15420) }}</p>
                <p class="text-xs text-green-500 dark:text-green-500">45 orders</p>
              </div>
            </div>
            
            <div class="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div>
                <p class="font-medium text-blue-700 dark:text-blue-300">European Auto Supply</p>
                <p class="text-sm text-blue-600 dark:text-blue-400">On-time delivery: 88%</p>
              </div>
              <div class="text-right">
                <p class="font-bold text-blue-600 dark:text-blue-400">{{ reportingService.formatCurrency(8750) }}</p>
                <p class="text-xs text-blue-500 dark:text-blue-500">28 orders</p>
              </div>
            </div>
            
            <div class="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div>
                <p class="font-medium text-purple-700 dark:text-purple-300">Maghreb Motors Parts</p>
                <p class="text-sm text-purple-600 dark:text-purple-400">On-time delivery: 92%</p>
              </div>
              <div class="text-right">
                <p class="font-bold text-purple-600 dark:text-purple-400">{{ reportingService.formatCurrency(12300) }}</p>
                <p class="text-xs text-purple-500 dark:text-purple-500">35 orders</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Inventory Turnover Analysis -->
      <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Inventory Turnover Analysis</h3>
        <div class="h-80">
          <canvas *ngIf="turnoverChart()" 
                  baseChart
                  [type]="turnoverChart()!.type"
                  [data]="turnoverChart()!.data"
                  [options]="turnoverChart()!.options">
          </canvas>
        </div>
      </div>

      <!-- Stock Alerts & Recommendations -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Stock Status Overview -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Stock Status</h3>
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-gray-600 dark:text-gray-400">In Stock</span>
              <span class="font-semibold text-green-600 dark:text-green-400">{{ (metrics?.totalParts || 0) - (metrics?.lowStockItems || 0) - (metrics?.outOfStockItems || 0) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-600 dark:text-gray-400">Low Stock</span>
              <span class="font-semibold text-yellow-600 dark:text-yellow-400">{{ metrics?.lowStockItems || 0 }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-600 dark:text-gray-400">Out of Stock</span>
              <span class="font-semibold text-red-600 dark:text-red-400">{{ metrics?.outOfStockItems || 0 }}</span>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
              <span class="text-gray-600 dark:text-gray-400">Reorder Value</span>
              <span class="font-semibold text-blue-600 dark:text-blue-400">
                {{ reportingService.formatCurrency(metrics?.reorderValue || 0) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Moving Parts Analysis -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Parts Movement</h3>
          <div class="space-y-4">
            <div class="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span class="text-green-700 dark:text-green-300">Fast Moving</span>
              <span class="font-bold text-green-600 dark:text-green-400">{{ metrics?.fastMovingParts || 0 }} parts</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <span class="text-yellow-700 dark:text-yellow-300">Slow Moving</span>
              <span class="font-bold text-yellow-600 dark:text-yellow-400">{{ metrics?.slowMovingParts || 0 }} parts</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span class="text-blue-700 dark:text-blue-300">Turnover Rate</span>
              <span class="font-bold text-blue-600 dark:text-blue-400">{{ (metrics?.inventoryTurnover || 0).toFixed(1) }}x/year</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <span class="text-purple-700 dark:text-purple-300">Wastage Rate</span>
              <span class="font-bold text-purple-600 dark:text-purple-400">{{ (metrics?.wastagePercentage || 0).toFixed(1) }}%</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  `
})
export class InventoryReportsComponent implements OnInit {
  @Input() filters!: ReportFilters;
  @Input() metrics!: InventoryMetrics | null;
  
  public reportingService = inject(ReportingService);

  stockChart = signal<ChartConfiguration | null>(null);
  categoryChart = signal<ChartConfiguration | null>(null);
  turnoverChart = signal<ChartConfiguration | null>(null);

  ngOnInit() {
    this.loadInventoryCharts();
  }

  private loadInventoryCharts() {
    // Stock Level Chart
    this.stockChart.set({
      type: 'bar',
      data: {
        labels: ['Engine Oil', 'Brake Pads', 'Oil Filters', 'Air Filters', 'Spark Plugs', 'Coolant'],
        datasets: [
          {
            label: 'Current Stock',
            data: [12, 8, 15, 20, 25, 6],
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1
          },
          {
            label: 'Min Stock Level',
            data: [5, 3, 8, 10, 12, 4],
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
            beginAtZero: true
          }
        }
      }
    });

    // Parts by Category Chart
    this.categoryChart.set({
      type: 'doughnut',
      data: {
        labels: ['Engine Parts', 'Brake System', 'Electrical', 'Fluids', 'Filters', 'Belts & Hoses'],
        datasets: [{
          data: [25, 20, 15, 18, 12, 10],
          backgroundColor: [
            '#EF4444',
            '#F59E0B',
            '#10B981',
            '#3B82F6',
            '#8B5CF6',
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
            position: 'right'
          }
        }
      }
    });

    // Inventory Turnover Chart
    this.turnoverChart.set({
      type: 'bar',
      data: {
        labels: ['Engine Oil', 'Brake Pads', 'Oil Filters', 'Air Filters', 'Spark Plugs', 'Coolant'],
        datasets: [{
          label: 'Turnover Rate (times/year)',
          data: [8.5, 6.2, 12.1, 9.8, 4.3, 7.6],
          backgroundColor: [
            '#10B981',
            '#3B82F6',
            '#8B5CF6',
            '#F59E0B',
            '#EF4444',
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
            beginAtZero: true,
            title: {
              display: true,
              text: 'Turnover Rate'
            }
          }
        }
      }
    });
  }
}