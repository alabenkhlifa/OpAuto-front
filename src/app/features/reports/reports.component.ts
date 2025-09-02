import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ReportingService } from '../../core/services/reporting.service';
import { ThemeService } from '../../core/services/theme.service';
import { 
  ReportFilters, 
  DateRangePreset, 
  FinancialMetrics,
  OperationalMetrics,
  CustomerMetrics,
  InventoryMetrics,
  DashboardKPI,
  MonthlyComparison
} from '../../core/models/report.model';

Chart.register(...registerables);

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BaseChartDirective],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css'
})
export class ReportsComponent implements OnInit {
  private reportingService = inject(ReportingService);
  public themeService = inject(ThemeService);

  // State signals
  currentView = signal<'dashboard' | 'financial' | 'operational' | 'customer' | 'inventory'>('dashboard');
  isLoading = signal(false);
  selectedPreset = signal<DateRangePreset>('this-month');
  customStartDate = signal<string>('');
  customEndDate = signal<string>('');
  
  // Data signals
  filters = signal<ReportFilters>({
    dateRange: this.reportingService.getDateRangeForPreset('this-month'),
    preset: 'this-month'
  });

  kpis = signal<DashboardKPI[]>([]);
  financialMetrics = signal<FinancialMetrics | null>(null);
  operationalMetrics = signal<OperationalMetrics | null>(null);
  customerMetrics = signal<CustomerMetrics | null>(null);
  inventoryMetrics = signal<InventoryMetrics | null>(null);
  monthlyComparison = signal<MonthlyComparison | null>(null);

  // Chart configurations
  revenueChartConfig = signal<ChartConfiguration | null>(null);
  serviceTypeChartConfig = signal<ChartConfiguration | null>(null);
  appointmentStatusChartConfig = signal<ChartConfiguration | null>(null);

  // Date presets for dropdown
  datePresets: { value: DateRangePreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this-week', label: 'This Week' },
    { value: 'last-week', label: 'Last Week' },
    { value: 'this-month', label: 'This Month' },
    { value: 'last-month', label: 'Last Month' },
    { value: 'this-quarter', label: 'This Quarter' },
    { value: 'last-quarter', label: 'Last Quarter' },
    { value: 'this-year', label: 'This Year' },
    { value: 'last-year', label: 'Last Year' },
    { value: 'last-30-days', label: 'Last 30 Days' },
    { value: 'last-90-days', label: 'Last 90 Days' },
    { value: 'last-365-days', label: 'Last 365 Days' },
    { value: 'custom', label: 'Custom Range' }
  ];

  ngOnInit() {
    this.loadDashboardData();
  }

  private loadDashboardData() {
    this.isLoading.set(true);
    const currentFilters = this.filters();

    // Load KPIs
    this.reportingService.getDashboardKPIs(currentFilters).subscribe({
      next: (kpis) => {
        this.kpis.set(kpis);
      },
      error: (error) => console.error('Error loading KPIs:', error)
    });

    // Load metrics
    this.reportingService.getFinancialMetrics(currentFilters).subscribe({
      next: (metrics) => {
        this.financialMetrics.set(metrics);
      },
      error: (error) => console.error('Error loading financial metrics:', error)
    });

    this.reportingService.getOperationalMetrics(currentFilters).subscribe({
      next: (metrics) => {
        this.operationalMetrics.set(metrics);
      },
      error: (error) => console.error('Error loading operational metrics:', error)
    });

    this.reportingService.getCustomerMetrics(currentFilters).subscribe({
      next: (metrics) => {
        this.customerMetrics.set(metrics);
      },
      error: (error) => console.error('Error loading customer metrics:', error)
    });

    this.reportingService.getInventoryMetrics(currentFilters).subscribe({
      next: (metrics) => {
        this.inventoryMetrics.set(metrics);
      },
      error: (error) => console.error('Error loading inventory metrics:', error)
    });

    // Load monthly comparison
    this.reportingService.getMonthlyComparison().subscribe({
      next: (comparison) => {
        this.monthlyComparison.set(comparison);
      },
      error: (error) => console.error('Error loading monthly comparison:', error)
    });

    // Load charts
    this.loadCharts();
    
    this.isLoading.set(false);
  }

  private loadCharts() {
    const currentFilters = this.filters();
    
    // Revenue chart
    this.reportingService.getRevenueChartData(currentFilters).subscribe({
      next: (data) => {
        this.revenueChartConfig.set({
          type: 'line',
          data,
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Revenue Trends'
              },
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
    });

    // Service type chart
    this.reportingService.getServiceTypeChartData(currentFilters).subscribe({
      next: (data) => {
        this.serviceTypeChartConfig.set({
          type: 'doughnut',
          data,
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Services by Type'
              },
              legend: {
                display: true,
                position: 'right'
              }
            }
          }
        });
      }
    });

    // Appointment status chart
    this.reportingService.getAppointmentStatusChartData(currentFilters).subscribe({
      next: (data) => {
        this.appointmentStatusChartConfig.set({
          type: 'bar',
          data,
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Appointments by Status'
              }
            },
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        });
      }
    });
  }

  onViewChange(view: 'dashboard' | 'financial' | 'operational' | 'customer' | 'inventory') {
    this.currentView.set(view);
  }

  onPresetChange(preset: DateRangePreset) {
    this.selectedPreset.set(preset);
    
    if (preset !== 'custom') {
      const dateRange = this.reportingService.getDateRangeForPreset(preset);
      this.filters.set({
        ...this.filters(),
        dateRange,
        preset
      });
      this.loadDashboardData();
    }
  }

  onCustomDateChange() {
    const startDate = this.customStartDate();
    const endDate = this.customEndDate();
    
    if (startDate && endDate) {
      const dateRange = {
        startDate: new Date(startDate),
        endDate: new Date(endDate + 'T23:59:59'),
        label: 'Custom Range'
      };
      
      this.filters.set({
        ...this.filters(),
        dateRange,
        preset: 'custom'
      });
      this.loadDashboardData();
    }
  }

  onRefreshData() {
    this.loadDashboardData();
  }

  onExportReport(format: 'pdf' | 'excel' | 'csv') {
    // TODO: Implement export functionality
    console.log(`Exporting report as ${format}`);
  }

  onPrintReport() {
    window.print();
  }

  getKpiChangeClass(kpi: DashboardKPI): string {
    const baseClasses = 'text-sm font-medium';
    
    switch (kpi.changeType) {
      case 'increase':
        return `${baseClasses} text-green-600 dark:text-green-400`;
      case 'decrease':
        return `${baseClasses} text-red-600 dark:text-red-400`;
      default:
        return `${baseClasses} text-gray-600 dark:text-gray-400`;
    }
  }

  getKpiChangeIcon(kpi: DashboardKPI): string {
    switch (kpi.changeType) {
      case 'increase':
        return '↗️';
      case 'decrease':
        return '↘️';
      default:
        return '➡️';
    }
  }

  formatKpiValue(kpi: DashboardKPI): string {
    switch (kpi.format) {
      case 'currency':
        return this.reportingService.formatCurrency(Number(kpi.value));
      case 'percentage':
        return this.reportingService.formatPercentage(Number(kpi.value));
      case 'number':
        return this.reportingService.formatNumber(Number(kpi.value));
      default:
        return String(kpi.value);
    }
  }

  formatChange(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  }

  getCurrentDateRangeLabel(): string {
    return this.filters().dateRange.label;
  }

  getMetricCardClass(color: string): string {
    const baseClasses = 'bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6';
    
    switch (color) {
      case 'blue':
        return `${baseClasses} border-l-4 border-l-blue-500`;
      case 'green':
        return `${baseClasses} border-l-4 border-l-green-500`;
      case 'red':
        return `${baseClasses} border-l-4 border-l-red-500`;
      case 'yellow':
        return `${baseClasses} border-l-4 border-l-yellow-500`;
      case 'purple':
        return `${baseClasses} border-l-4 border-l-purple-500`;
      default:
        return `${baseClasses} border-l-4 border-l-gray-500`;
    }
  }
}