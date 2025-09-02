export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  carId: string;
  appointmentId?: string;
  issueDate: Date;
  dueDate: Date;
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod;
  paymentDate?: Date;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountPercentage: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  paymentTerms: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceStatus = 
  | 'draft' 
  | 'sent' 
  | 'viewed' 
  | 'paid' 
  | 'partially-paid' 
  | 'overdue' 
  | 'cancelled' 
  | 'refunded';

export type PaymentMethod = 'cash' | 'card' | 'bank-transfer' | 'check' | 'credit';

export interface InvoiceLineItem {
  id: string;
  type: LineItemType;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  partId?: string;
  serviceCode?: string;
  mechanicId?: string;
  laborHours?: number;
  discountPercentage?: number;
  taxable: boolean;
}

export type LineItemType = 'service' | 'part' | 'labor' | 'misc' | 'discount';

export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  lineItems: Omit<InvoiceLineItem, 'id' | 'totalPrice'>[];
  defaultPaymentTerms: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: Date;
  reference?: string;
  notes?: string;
  processedBy: string;
  createdAt: Date;
}

export interface InvoiceSettings {
  garageInfo: GarageInfo;
  taxSettings: TaxSettings;
  paymentTerms: PaymentTermsSettings;
  invoiceNumbering: InvoiceNumberingSettings;
}

export interface GarageInfo {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  website?: string;
  taxId: string;
  bankDetails?: BankDetails;
  logo?: string;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  iban?: string;
  swift?: string;
}

export interface TaxSettings {
  defaultTaxRate: number;
  taxName: string; // e.g., "TVA", "VAT"
  taxNumber: string;
  taxExemptItems: string[];
}

export interface PaymentTermsSettings {
  defaultTerms: string;
  dueDays: number;
  lateFeePercentage: number;
  lateFeeGraceDays: number;
}

export interface InvoiceNumberingSettings {
  prefix: string;
  suffix?: string;
  currentNumber: number;
  resetPeriod: 'never' | 'yearly' | 'monthly';
  digitCount: number;
}

export interface InvoiceStats {
  totalInvoices: number;
  totalRevenue: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  averageInvoiceAmount: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  topCustomers: CustomerRevenue[];
  recentInvoices: Invoice[];
  paymentMethodStats: PaymentMethodStats[];
}

export interface CustomerRevenue {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  invoiceCount: number;
  lastInvoiceDate: Date;
}

export interface PaymentMethodStats {
  method: PaymentMethod;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface InvoiceSearchCriteria {
  query?: string;
  status?: InvoiceStatus;
  customerId?: string;
  carId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  paymentMethod?: PaymentMethod;
  minAmount?: number;
  maxAmount?: number;
}

export interface ServiceRate {
  id: string;
  serviceCode: string;
  serviceName: string;
  description: string;
  category: string;
  basePrice: number;
  laborHours: number;
  hourlyRate: number;
  isActive: boolean;
}

export interface InvoiceWithDetails extends Invoice {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  carMake: string;
  carModel: string;
  carYear: number;
  licensePlate: string;
  serviceName?: string;
  mechanicName?: string;
  paymentHistory: Payment[];
}

// Utility types for forms and API
export type CreateInvoiceRequest = Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt' | 'subtotal' | 'taxAmount' | 'discountAmount' | 'totalAmount' | 'remainingAmount'>;

export type UpdateInvoiceRequest = Partial<Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>>;

export type InvoiceCalculation = {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
};

export interface InvoicePrintOptions {
  includeNotes: boolean;
  includePaymentTerms: boolean;
  includeGarageLogo: boolean;
  paperSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
}