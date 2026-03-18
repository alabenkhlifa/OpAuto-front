export type ModuleId =
  | 'dashboard'
  | 'customers'
  | 'cars'
  | 'appointments'
  | 'calendar'
  | 'maintenance'
  | 'invoicing'
  | 'inventory'
  | 'employees'
  | 'reports'
  | 'approvals'
  | 'users'
  | 'settings'
  | 'ai'
  | 'notifications';

export interface GarageModule {
  id: ModuleId;
  name: string;
  description: string;
  price: number;
  icon: string;
  isActive: boolean;
  isFree: boolean;
  willRenew?: boolean;
  purchasedAt?: string;
  expiresAt?: string;
}

export const FREE_MODULES: ModuleId[] = ['dashboard', 'customers', 'cars', 'appointments'];

export const MODULE_CATALOG: Omit<GarageModule, 'isActive'>[] = [
  { id: 'dashboard', name: 'Dashboard', description: 'Overview and KPIs', price: 0, icon: 'dashboard', isFree: true },
  { id: 'customers', name: 'Customers', description: 'Customer management', price: 0, icon: 'people', isFree: true },
  { id: 'cars', name: 'Cars', description: 'Vehicle registry', price: 0, icon: 'car', isFree: true },
  { id: 'appointments', name: 'Appointments', description: 'Basic scheduling', price: 0, icon: 'calendar', isFree: true },
  { id: 'calendar', name: 'Calendar', description: 'Advanced calendar with drag-drop', price: 29, icon: 'calendar-view', isFree: false },
  { id: 'maintenance', name: 'Maintenance', description: 'Job tracking and workflows', price: 39, icon: 'wrench', isFree: false },
  { id: 'invoicing', name: 'Invoicing', description: 'Invoice and payment management', price: 29, icon: 'invoice', isFree: false },
  { id: 'inventory', name: 'Inventory', description: 'Parts and stock management', price: 29, icon: 'inventory', isFree: false },
  { id: 'employees', name: 'Employees', description: 'Staff management', price: 19, icon: 'team', isFree: false },
  { id: 'reports', name: 'Reports', description: 'Analytics and reporting', price: 39, icon: 'chart', isFree: false },
  { id: 'approvals', name: 'Approvals', description: 'Approval workflows', price: 19, icon: 'check-circle', isFree: false },
  { id: 'users', name: 'User Management', description: 'Multi-user access', price: 19, icon: 'users', isFree: false },
  { id: 'settings', name: 'Advanced Settings', description: 'Garage configuration', price: 9, icon: 'settings', isFree: false },
  { id: 'ai', name: 'AI Features', description: 'AI-powered insights', price: 49, icon: 'sparkle', isFree: false },
  { id: 'notifications', name: 'Notifications', description: 'Smart notifications', price: 19, icon: 'bell', isFree: false },
];
