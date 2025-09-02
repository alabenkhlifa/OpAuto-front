export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: CustomerAddress;
  registrationDate: Date;
  lastVisitDate?: Date;
  totalCars: number;
  totalAppointments: number;
  totalInvoices: number;
  totalSpent: number;
  averageSpending: number;
  status: CustomerStatus;
  notes?: string;
  preferredContactMethod: ContactMethod;
  loyaltyPoints: number;
  referralSource?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export type CustomerStatus = 'active' | 'inactive' | 'vip' | 'blocked';
export type ContactMethod = 'phone' | 'email' | 'sms' | 'whatsapp';

export interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  vipCustomers: number;
  newCustomersThisMonth: number;
  averageCustomerValue: number;
  topCustomers: CustomerSummary[];
  customersByStatus: Record<CustomerStatus, number>;
  recentCustomers: CustomerSummary[];
}

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: CustomerStatus;
  totalSpent: number;
  lastVisitDate?: Date;
  totalCars: number;
}

export interface CustomerHistory {
  appointments: CustomerAppointmentHistory[];
  invoices: CustomerInvoiceHistory[];
  cars: CustomerCarHistory[];
}

export interface CustomerAppointmentHistory {
  id: string;
  date: Date;
  serviceName: string;
  carMake: string;
  carModel: string;
  licensePlate: string;
  status: string;
  totalCost: number;
}

export interface CustomerInvoiceHistory {
  id: string;
  invoiceNumber: string;
  date: Date;
  amount: number;
  status: string;
  serviceName: string;
  dueDate: Date;
}

export interface CustomerCarHistory {
  id: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  registrationDate: Date;
  lastServiceDate?: Date;
  totalServices: number;
  totalSpent: number;
}

export interface CreateCustomerRequest {
  name: string;
  phone: string;
  email?: string;
  address?: CustomerAddress;
  notes?: string;
  preferredContactMethod: ContactMethod;
  referralSource?: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  phone?: string;
  email?: string;
  address?: CustomerAddress;
  status?: CustomerStatus;
  notes?: string;
  preferredContactMethod?: ContactMethod;
  loyaltyPoints?: number;
}

export interface CustomerSearchFilters {
  query?: string;
  status?: CustomerStatus;
  city?: string;
  registrationDateFrom?: Date;
  registrationDateTo?: Date;
  minSpent?: number;
  maxSpent?: number;
  hasEmail?: boolean;
  sortBy?: CustomerSortField;
  sortOrder?: 'asc' | 'desc';
}

export type CustomerSortField = 'name' | 'registrationDate' | 'lastVisitDate' | 'totalSpent' | 'totalAppointments';