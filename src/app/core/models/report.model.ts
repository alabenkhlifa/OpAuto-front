export interface ReportDateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

export type DateRangePreset = 'today' | 'yesterday' | 'this-week' | 'last-week' | 
  'this-month' | 'last-month' | 'this-quarter' | 'last-quarter' | 
  'this-year' | 'last-year' | 'last-30-days' | 'last-90-days' | 'last-365-days' | 'custom';

export interface ReportFilters {
  dateRange: ReportDateRange;
  preset: DateRangePreset;
  customerId?: string;
  mechanicId?: string;
  serviceType?: string;
  carMake?: string;
  paymentMethod?: string;
}

export interface FinancialMetrics {
  totalRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
  overdueRevenue: number;
  averageInvoiceValue: number;
  revenueGrowth: number;
  profitMargin: number;
  taxCollected: number;
  discountsGiven: number;
  refundsIssued: number;
}

export interface OperationalMetrics {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  averageServiceTime: number;
  mechanicUtilization: number;
  garageCapacityUsed: number;
  customerSatisfactionScore: number;
  repeatCustomerRate: number;
  appointmentConversionRate: number;
  onTimeCompletionRate: number;
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  activeCustomers: number;
  churnedCustomers: number;
  averageCustomerValue: number;
  customerLifetimeValue: number;
  visitFrequency: number;
  customerRetentionRate: number;
  referralRate: number;
  loyaltyProgramAdoption: number;
}

export interface InventoryMetrics {
  totalParts: number;
  stockValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  fastMovingParts: number;
  slowMovingParts: number;
  inventoryTurnover: number;
  supplierPerformance: number;
  wastagePercentage: number;
  reorderValue: number;
}

export interface RevenueChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    type?: 'line' | 'bar';
  }[];
}

export interface ServiceTypeChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
  }[];
}

export interface AppointmentStatusChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
  }[];
}

export interface MechanicPerformanceData {
  mechanicId: string;
  mechanicName: string;
  appointmentsCompleted: number;
  totalRevenue: number;
  averageServiceTime: number;
  customerRating: number;
  utilizationRate: number;
}

export interface CustomerSegmentData {
  segment: string;
  count: number;
  totalValue: number;
  averageSpend: number;
  percentage: number;
}

export interface PopularServicesData {
  serviceName: string;
  serviceCode: string;
  count: number;
  revenue: number;
  averagePrice: number;
  growthRate: number;
}

export interface PaymentTrendData {
  date: string;
  cash: number;
  card: number;
  bank_transfer: number;
  cheque: number;
  total: number;
}

export interface InventoryTurnoverData {
  partName: string;
  category: string;
  turnoverRate: number;
  stockValue: number;
  lastOrderDate?: Date;
  supplierName: string;
}

export interface MonthlyComparison {
  currentMonth: {
    revenue: number;
    appointments: number;
    customers: number;
    parts: number;
  };
  previousMonth: {
    revenue: number;
    appointments: number;
    customers: number;
    parts: number;
  };
  growth: {
    revenue: number;
    appointments: number;
    customers: number;
    parts: number;
  };
}

export interface YearlyTrends {
  months: string[];
  revenue: number[];
  appointments: number[];
  customers: number[];
  expenses: number[];
  profit: number[];
}

export interface TopPerformers {
  topCustomers: {
    customerId: string;
    name: string;
    totalSpent: number;
    visits: number;
  }[];
  topServices: {
    serviceName: string;
    count: number;
    revenue: number;
  }[];
  topMechanics: {
    mechanicId: string;
    name: string;
    completedJobs: number;
    revenue: number;
  }[];
  topParts: {
    partId: string;
    name: string;
    quantitySold: number;
    revenue: number;
  }[];
}

export interface BusinessInsights {
  peakHours: { hour: string; appointments: number }[];
  peakDays: { day: string; appointments: number }[];
  seasonalTrends: { month: string; revenue: number; factor: number }[];
  serviceRecommendations: {
    type: string;
    reason: string;
    potentialRevenue: number;
  }[];
  optimizationOpportunities: {
    area: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
  }[];
}

export interface ReportExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'png' | 'jpg';
  includeCharts: boolean;
  includeSummary: boolean;
  dateRange: ReportDateRange;
  reportSections: ReportSection[];
}

export type ReportSection = 'financial' | 'operational' | 'customer' | 'inventory' | 'insights';

export interface DashboardKPI {
  label: string;
  value: number | string;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  format: 'currency' | 'number' | 'percentage';
  icon: string;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
}

export interface ChartConfiguration {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'area' | 'gauge' | 'heatmap';
  title: string;
  subtitle?: string;
  data: any;
  options?: any;
  responsive?: boolean;
  plugins?: string[];
}

export interface ReportPreferences {
  userId: string;
  defaultDateRange: DateRangePreset;
  favoriteCharts: string[];
  dashboardLayout: string[];
  emailFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
  autoRefresh: boolean;
  refreshInterval: number; // seconds
}