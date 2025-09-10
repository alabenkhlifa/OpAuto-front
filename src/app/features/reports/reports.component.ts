import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ReportingService } from '../../core/services/reporting.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TranslationService } from '../../core/services/translation.service';
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
  imports: [CommonModule, RouterModule, FormsModule, BaseChartDirective, TranslatePipe],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css'
})
export class ReportsComponent implements OnInit {
  private reportingService = inject(ReportingService);
  private translationService = inject(TranslationService);

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

  // Date presets for dropdown (computed for translation)
  datePresets = computed(() => [
    { value: 'today' as DateRangePreset, label: this.translationService.instant('reports.datePresets.today') },
    { value: 'yesterday' as DateRangePreset, label: this.translationService.instant('reports.datePresets.yesterday') },
    { value: 'this-week' as DateRangePreset, label: this.translationService.instant('reports.datePresets.thisWeek') },
    { value: 'last-week' as DateRangePreset, label: this.translationService.instant('reports.datePresets.lastWeek') },
    { value: 'this-month' as DateRangePreset, label: this.translationService.instant('reports.datePresets.thisMonth') },
    { value: 'last-month' as DateRangePreset, label: this.translationService.instant('reports.datePresets.lastMonth') },
    { value: 'this-quarter' as DateRangePreset, label: this.translationService.instant('reports.datePresets.thisQuarter') },
    { value: 'last-quarter' as DateRangePreset, label: this.translationService.instant('reports.datePresets.lastQuarter') },
    { value: 'this-year' as DateRangePreset, label: this.translationService.instant('reports.datePresets.thisYear') },
    { value: 'last-year' as DateRangePreset, label: this.translationService.instant('reports.datePresets.lastYear') },
    { value: 'last-30-days' as DateRangePreset, label: this.translationService.instant('reports.datePresets.last30Days') },
    { value: 'last-90-days' as DateRangePreset, label: this.translationService.instant('reports.datePresets.last90Days') },
    { value: 'last-365-days' as DateRangePreset, label: this.translationService.instant('reports.datePresets.last365Days') },
    { value: 'custom' as DateRangePreset, label: this.translationService.instant('reports.datePresets.custom') }
  ]);

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
    const message = this.translationService.instant('reports.export.exporting', { format: format.toUpperCase() });
    console.log(message);
    // TODO: Implement export functionality
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

  hasActiveFilters = computed(() => {
    const currentFilters = this.filters();
    return currentFilters.preset !== 'this-month';
  });

  getMetricCardClass(color: string): string {
    const baseClasses = 'glass-card';
    
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

  getKpiTranslationKey(kpi: DashboardKPI): string {
    // Map English labels to translation keys
    const labelToKeyMap: { [key: string]: string } = {
      'Total Revenue': 'reports.kpis.totalRevenue',
      'Appointments': 'reports.kpis.appointments',
      'Active Customers': 'reports.kpis.activeCustomers',
      'Mechanic Utilization': 'reports.kpis.mechanicUtilization',
      'Stock Value': 'reports.kpis.stockValue',
      'Customer Satisfaction': 'reports.kpis.customerSatisfaction'
    };
    
    return labelToKeyMap[kpi.label] || kpi.label;
  }
}