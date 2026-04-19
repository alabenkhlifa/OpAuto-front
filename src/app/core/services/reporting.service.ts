import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, combineLatest, map } from 'rxjs';
import {
  ReportDateRange,
  DateRangePreset,
  ReportFilters,
  FinancialMetrics,
  OperationalMetrics,
  CustomerMetrics,
  InventoryMetrics,
  RevenueChartData,
  ServiceTypeChartData,
  AppointmentStatusChartData,
  MechanicPerformanceData,
  CustomerSegmentData,
  PopularServicesData,
  PaymentTrendData,
  InventoryTurnoverData,
  MonthlyComparison,
  YearlyTrends,
  TopPerformers,
  BusinessInsights,
  DashboardKPI,
  ChartConfiguration
} from '../models/report.model';
import { InvoiceService } from './invoice.service';
import { CustomerService } from './customer.service';
import { AppointmentService } from '../../features/appointments/services/appointment.service';
import { PartService } from './part.service';

@Injectable({
  providedIn: 'root'
})
export class ReportingService {
  private http = inject(HttpClient);
  private invoiceService = inject(InvoiceService);
  private customerService = inject(CustomerService);
  private appointmentService = inject(AppointmentService);
  private partService = inject(PartService);

  public currentFilters = signal<ReportFilters>({
    dateRange: this.getDateRangeForPreset('this-month'),
    preset: 'this-month'
  });

  getDateRangeForPreset(preset: DateRangePreset): ReportDateRange {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    switch (preset) {
      case 'today':
        return { startDate: startOfToday, endDate: endOfToday, label: 'Today' };
      case 'yesterday': {
        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);
        const endYesterday = new Date(yesterday);
        endYesterday.setHours(23, 59, 59);
        return { startDate: yesterday, endDate: endYesterday, label: 'Yesterday' };
      }
      case 'this-week': {
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        return { startDate: startOfWeek, endDate: endOfToday, label: 'This Week' };
      }
      case 'last-week': {
        const lastWeekStart = new Date(startOfToday);
        lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
        lastWeekEnd.setHours(23, 59, 59);
        return { startDate: lastWeekStart, endDate: lastWeekEnd, label: 'Last Week' };
      }
      case 'this-month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: startOfMonth, endDate: endOfToday, label: 'This Month' };
      }
      case 'last-month': {
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { startDate: lastMonthStart, endDate: lastMonthEnd, label: 'Last Month' };
      }
      case 'this-quarter': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
        return { startDate: quarterStart, endDate: endOfToday, label: 'This Quarter' };
      }
      case 'last-quarter': {
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
        const lastQuarterStart = new Date(now.getFullYear(), lastQuarter * 3, 1);
        const lastQuarterEnd = new Date(now.getFullYear(), lastQuarter * 3 + 3, 0, 23, 59, 59);
        return { startDate: lastQuarterStart, endDate: lastQuarterEnd, label: 'Last Quarter' };
      }
      case 'this-year': {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return { startDate: yearStart, endDate: endOfToday, label: 'This Year' };
      }
      case 'last-year': {
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        return { startDate: lastYearStart, endDate: lastYearEnd, label: 'Last Year' };
      }
      case 'last-30-days': {
        const thirtyDaysAgo = new Date(startOfToday);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return { startDate: thirtyDaysAgo, endDate: endOfToday, label: 'Last 30 Days' };
      }
      case 'last-90-days': {
        const ninetyDaysAgo = new Date(startOfToday);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return { startDate: ninetyDaysAgo, endDate: endOfToday, label: 'Last 90 Days' };
      }
      case 'last-365-days': {
        const oneYearAgo = new Date(startOfToday);
        oneYearAgo.setDate(oneYearAgo.getDate() - 365);
        return { startDate: oneYearAgo, endDate: endOfToday, label: 'Last 365 Days' };
      }
      default: {
        const defaultStartOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: defaultStartOfMonth, endDate: endOfToday, label: 'This Month' };
      }
    }
  }

  getFinancialMetrics(filters: ReportFilters): Observable<FinancialMetrics> {
    return this.invoiceService.getInvoices().pipe(
      map(invoices => {
        const filteredInvoices = this.filterInvoicesByDate(invoices, filters.dateRange);
        const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const paidRevenue = filteredInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.paidAmount, 0);
        const pendingRevenue = filteredInvoices.filter(inv => ['sent', 'viewed'].includes(inv.status)).reduce((sum, inv) => sum + inv.remainingAmount, 0);
        const overdueRevenue = filteredInvoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.remainingAmount, 0);
        const averageInvoiceValue = filteredInvoices.length > 0 ? totalRevenue / filteredInvoices.length : 0;

        const previousPeriod = this.getPreviousPeriod(filters.dateRange);
        const previousInvoices = this.filterInvoicesByDate(invoices, previousPeriod);
        const previousRevenue = previousInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
        const revenueGrowth = previousRevenue > 0 ? ((paidRevenue - previousRevenue) / previousRevenue) * 100 : 0;

        const taxCollected = filteredInvoices.reduce((sum, inv) => sum + inv.taxAmount, 0);
        const discountsGiven = filteredInvoices.reduce((sum, inv) => sum + inv.discountAmount, 0);

        return {
          totalRevenue, paidRevenue, pendingRevenue, overdueRevenue, averageInvoiceValue,
          revenueGrowth, profitMargin: 30, taxCollected, discountsGiven, refundsIssued: 0
        };
      })
    );
  }

  getOperationalMetrics(filters: ReportFilters): Observable<OperationalMetrics> {
    return this.appointmentService.getAppointments().pipe(
      map(appointments => {
        const filtered = this.filterAppointmentsByDate(appointments, filters.dateRange);
        const totalAppointments = filtered.length;
        const completedAppointments = filtered.filter(apt => apt.status === 'completed').length;
        const cancelledAppointments = filtered.filter(apt => apt.status === 'cancelled').length;
        const averageServiceTime = filtered.length > 0
          ? filtered.reduce((sum, apt) => sum + apt.estimatedDuration, 0) / filtered.length : 0;

        const totalWorkHours = filtered.reduce((sum, apt) => sum + (apt.estimatedDuration / 60), 0);
        const workingDays = this.getWorkingDaysInRange(filters.dateRange);
        const availableHours = workingDays * 8 * 2;
        const mechanicUtilization = availableHours > 0 ? (totalWorkHours / availableHours) * 100 : 0;

        const dailyCapacity = 5 * 10;
        const garageCapacityUsed = workingDays > 0 ? (filtered.length / (dailyCapacity * workingDays)) * 100 : 0;

        return {
          totalAppointments, completedAppointments, cancelledAppointments, averageServiceTime,
          mechanicUtilization, garageCapacityUsed,
          customerSatisfactionScore: 4.2, repeatCustomerRate: 65,
          appointmentConversionRate: 85, onTimeCompletionRate: 92
        };
      })
    );
  }

  getCustomerMetrics(filters: ReportFilters): Observable<CustomerMetrics> {
    return this.customerService.getCustomers().pipe(
      map(customers => {
        const totalCustomers = customers.length;
        const newCustomers = customers.filter(c =>
          c.registrationDate >= filters.dateRange.startDate && c.registrationDate <= filters.dateRange.endDate
        ).length;
        const activeCustomers = customers.filter(c => c.status === 'active' || c.status === 'vip').length;
        const churnedCustomers = customers.filter(c => c.status === 'inactive').length;
        const averageCustomerValue = customers.length > 0
          ? customers.reduce((sum, c) => sum + c.totalSpent, 0) / customers.length : 0;
        const customerLifetimeValue = averageCustomerValue * 1.5;
        const visitFrequency = customers.length > 0
          ? customers.reduce((sum, c) => sum + c.totalAppointments, 0) / customers.length : 0;
        const customerRetentionRate = totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0;

        return {
          totalCustomers, newCustomers, activeCustomers, churnedCustomers, averageCustomerValue,
          customerLifetimeValue, visitFrequency, customerRetentionRate, referralRate: 25, loyaltyProgramAdoption: 40
        };
      })
    );
  }

  getInventoryMetrics(filters: ReportFilters): Observable<InventoryMetrics> {
    return this.partService.getParts().pipe(
      map(parts => {
        const totalParts = parts.length;
        const stockValue = parts.reduce((sum, part) => sum + (part.stockLevel * part.price), 0);
        const lowStockItems = parts.filter(part => part.stockLevel <= part.minStockLevel).length;
        const outOfStockItems = parts.filter(part => part.stockLevel === 0).length;
        const averageStock = totalParts > 0 ? stockValue / totalParts : 0;
        const fastMovingParts = parts.filter(part => (part.stockLevel * part.price) > averageStock).length;
        const slowMovingParts = parts.filter(part => (part.stockLevel * part.price) < averageStock * 0.5).length;
        const reorderValue = parts.filter(part => part.stockLevel <= part.minStockLevel)
          .reduce((sum, part) => sum + (((part.maxStockLevel || part.minStockLevel * 2 || 10) - part.stockLevel) * part.price), 0);

        return {
          totalParts, stockValue, lowStockItems, outOfStockItems, fastMovingParts, slowMovingParts,
          inventoryTurnover: 4.2, supplierPerformance: 87, wastagePercentage: 2.1, reorderValue
        };
      })
    );
  }

  getRevenueChartData(filters: ReportFilters): Observable<RevenueChartData> {
    return this.invoiceService.getInvoices().pipe(
      map(invoices => {
        const filtered = this.filterInvoicesByDate(invoices, filters.dateRange);
        const dailyRevenue = this.groupInvoicesByDay(filtered);
        const labels = Object.keys(dailyRevenue).sort();
        const revenueData = labels.map(date => dailyRevenue[date]);
        const paidData = labels.map(date =>
          filtered.filter(inv => this.formatDateKey(inv.issueDate) === date && inv.status === 'paid')
            .reduce((sum, inv) => sum + inv.paidAmount, 0)
        );

        return {
          labels,
          datasets: [
            { label: 'Total Revenue', data: revenueData, borderColor: '#FF8400', backgroundColor: 'rgba(255, 132, 0, 0.1)', type: 'line' },
            { label: 'Paid Revenue', data: paidData, borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', type: 'line' }
          ]
        };
      })
    );
  }

  getServiceTypeChartData(filters: ReportFilters): Observable<ServiceTypeChartData> {
    return this.appointmentService.getAppointments().pipe(
      map(appointments => {
        const filtered = this.filterAppointmentsByDate(appointments, filters.dateRange);
        const serviceTypeCounts = this.groupAppointmentsByServiceType(filtered);
        const labels = Object.keys(serviceTypeCounts);
        const data = Object.values(serviceTypeCounts);

        return { labels, datasets: [{ label: 'Appointments by Service Type', data, backgroundColor: this.generateChartColors(labels.length) }] };
      })
    );
  }

  getAppointmentStatusChartData(filters: ReportFilters): Observable<AppointmentStatusChartData> {
    return this.appointmentService.getAppointments().pipe(
      map(appointments => {
        const filtered = this.filterAppointmentsByDate(appointments, filters.dateRange);
        const statusCounts = this.groupAppointmentsByStatus(filtered);
        const labels = Object.keys(statusCounts);
        const data = Object.values(statusCounts);

        return { labels, datasets: [{ label: 'Appointments by Status', data, backgroundColor: ['#10B981', '#FF8400', '#7B8CC4', '#EF4444'].slice(0, labels.length) }] };
      })
    );
  }

  getMechanicPerformance(filters: ReportFilters): Observable<MechanicPerformanceData[]> {
    return combineLatest([
      this.appointmentService.getAppointments(),
      this.appointmentService.getMechanics(),
      this.invoiceService.getInvoices()
    ]).pipe(
      map(([appointments, mechanics, invoices]) => {
        const filtered = this.filterAppointmentsByDate(appointments, filters.dateRange);
        const filteredInvoices = this.filterInvoicesByDate(invoices, filters.dateRange);

        return mechanics.map(mechanic => {
          const mechanicAppts = filtered.filter(apt => apt.mechanicId === mechanic.id);
          const mechanicRevenue = filteredInvoices
            .filter(inv => mechanicAppts.some(apt => apt.id === inv.appointmentId))
            .reduce((sum, inv) => sum + inv.paidAmount, 0);
          const totalServiceTime = mechanicAppts.reduce((sum, apt) => sum + apt.estimatedDuration, 0);
          const averageServiceTime = mechanicAppts.length > 0 ? totalServiceTime / mechanicAppts.length : 0;

          return {
            mechanicId: mechanic.id, mechanicName: mechanic.name,
            appointmentsCompleted: mechanicAppts.filter(apt => apt.status === 'completed').length,
            totalRevenue: mechanicRevenue, averageServiceTime,
            customerRating: 4.5, utilizationRate: 75
          };
        });
      })
    );
  }

  getTopPerformers(filters: ReportFilters): Observable<TopPerformers> {
    return combineLatest([
      this.customerService.getCustomers(),
      this.appointmentService.getAppointments(),
      this.invoiceService.getInvoices(),
      this.partService.getParts()
    ]).pipe(
      map(([customers, appointments, invoices, parts]) => {
        const filteredInvoices = this.filterInvoicesByDate(invoices, filters.dateRange);
        const filteredAppts = this.filterAppointmentsByDate(appointments, filters.dateRange);

        const topCustomers = customers.map(customer => ({
          customerId: customer.id, name: customer.name,
          totalSpent: filteredInvoices.filter(inv => inv.customerId === customer.id).reduce((sum, inv) => sum + inv.paidAmount, 0),
          visits: filteredAppts.filter(apt => apt.customerId === customer.id).length
        })).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);

        const serviceStats = this.groupAppointmentsByServiceType(filteredAppts);
        const topServices = Object.entries(serviceStats).map(([serviceName, count]) => ({
          serviceName, count,
          revenue: filteredInvoices.filter(inv => inv.serviceName === serviceName).reduce((sum, inv) => sum + inv.paidAmount, 0)
        })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

        return { topCustomers, topServices, topMechanics: [], topParts: [] };
      })
    );
  }

  getDashboardKPIs(filters: ReportFilters): Observable<DashboardKPI[]> {
    return combineLatest([
      this.getFinancialMetrics(filters),
      this.getOperationalMetrics(filters),
      this.getCustomerMetrics(filters),
      this.getInventoryMetrics(filters)
    ]).pipe(
      map(([financial, operational, customer, inventory]) => [
        { label: 'Total Revenue', value: financial.totalRevenue, change: financial.revenueGrowth, changeType: financial.revenueGrowth >= 0 ? 'increase' : 'decrease', format: 'currency', icon: '', color: 'green' },
        { label: 'Appointments', value: operational.totalAppointments, change: 0, changeType: 'increase', format: 'number', icon: '', color: 'blue' },
        { label: 'Active Customers', value: customer.activeCustomers, change: 0, changeType: 'increase', format: 'number', icon: '', color: 'purple' },
        { label: 'Mechanic Utilization', value: operational.mechanicUtilization, change: 0, changeType: 'increase', format: 'percentage', icon: '', color: 'yellow' },
        { label: 'Stock Value', value: inventory.stockValue, change: 0, changeType: 'increase', format: 'currency', icon: '', color: 'gray' },
        { label: 'Customer Satisfaction', value: operational.customerSatisfactionScore, change: 0, changeType: 'increase', format: 'number', icon: '', color: 'green' }
      ])
    );
  }

  getMonthlyComparison(): Observable<MonthlyComparison> {
    const thisMonth = this.getDateRangeForPreset('this-month');
    const lastMonth = this.getDateRangeForPreset('last-month');

    return combineLatest([
      this.getFinancialMetrics({ dateRange: thisMonth, preset: 'this-month' }),
      this.getFinancialMetrics({ dateRange: lastMonth, preset: 'last-month' }),
      this.getOperationalMetrics({ dateRange: thisMonth, preset: 'this-month' }),
      this.getOperationalMetrics({ dateRange: lastMonth, preset: 'last-month' }),
      this.getCustomerMetrics({ dateRange: thisMonth, preset: 'this-month' }),
      this.getCustomerMetrics({ dateRange: lastMonth, preset: 'last-month' }),
      this.getInventoryMetrics({ dateRange: thisMonth, preset: 'this-month' }),
      this.getInventoryMetrics({ dateRange: lastMonth, preset: 'last-month' })
    ]).pipe(
      map(([cf, pf, co, po, cc, pc, ci, pi]) => ({
        currentMonth: { revenue: cf.paidRevenue, appointments: co.totalAppointments, customers: cc.newCustomers, parts: ci.totalParts },
        previousMonth: { revenue: pf.paidRevenue, appointments: po.totalAppointments, customers: pc.newCustomers, parts: pi.totalParts },
        growth: {
          revenue: this.calculateGrowthRate(cf.paidRevenue, pf.paidRevenue),
          appointments: this.calculateGrowthRate(co.totalAppointments, po.totalAppointments),
          customers: this.calculateGrowthRate(cc.newCustomers, pc.newCustomers),
          parts: this.calculateGrowthRate(ci.totalParts, pi.totalParts)
        }
      }))
    );
  }

  private filterInvoicesByDate(invoices: any[], dateRange: ReportDateRange) {
    return invoices.filter(inv => inv.issueDate >= dateRange.startDate && inv.issueDate <= dateRange.endDate);
  }

  private filterAppointmentsByDate(appointments: any[], dateRange: ReportDateRange) {
    return appointments.filter(apt => apt.scheduledDate >= dateRange.startDate && apt.scheduledDate <= dateRange.endDate);
  }

  private groupInvoicesByDay(invoices: any[]): Record<string, number> {
    return invoices.reduce((groups, invoice) => {
      const dateKey = this.formatDateKey(invoice.issueDate);
      groups[dateKey] = (groups[dateKey] || 0) + invoice.totalAmount;
      return groups;
    }, {} as Record<string, number>);
  }

  private groupAppointmentsByServiceType(appointments: any[]): Record<string, number> {
    return appointments.reduce((groups, appointment) => {
      const serviceType = appointment.serviceName || appointment.serviceType || 'Other';
      groups[serviceType] = (groups[serviceType] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private groupAppointmentsByStatus(appointments: any[]): Record<string, number> {
    return appointments.reduce((groups, appointment) => {
      groups[appointment.status] = (groups[appointment.status] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getPreviousPeriod(dateRange: ReportDateRange): ReportDateRange {
    const duration = dateRange.endDate.getTime() - dateRange.startDate.getTime();
    return { startDate: new Date(dateRange.startDate.getTime() - duration), endDate: new Date(dateRange.endDate.getTime() - duration), label: 'Previous Period' };
  }

  private getWorkingDaysInRange(dateRange: ReportDateRange): number {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    let workingDays = 0;
    while (start <= end) {
      const dayOfWeek = start.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
      start.setDate(start.getDate() + 1);
    }
    return workingDays;
  }

  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private generateChartColors(count: number): string[] {
    const baseColors = ['#FF8400', '#10B981', '#7B8CC4', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];
    return Array.from({ length: count }, (_, i) => baseColors[i % baseColors.length]);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatPercentage(value: number): string {
    return new Intl.NumberFormat('fr-TN', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('fr-TN').format(value);
  }
}
