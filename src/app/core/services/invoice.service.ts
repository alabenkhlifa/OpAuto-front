import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import {
  Invoice,
  InvoiceWithDetails,
  InvoiceLineItem,
  Payment,
  InvoiceStats,
  InvoiceSettings,
  InvoiceStatus,
  PaymentMethod,
  LineItemType,
  ServiceRate,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  InvoiceCalculation,
  InvoiceSearchCriteria
} from '../models/invoice.model';
import { Appointment } from '../models/appointment.model';
import { fromBackendEnum, toBackendEnum } from '../utils/enum-mapper';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private http = inject(HttpClient);

  private invoicesSubject = new BehaviorSubject<InvoiceWithDetails[]>([]);
  public invoices$ = this.invoicesSubject.asObservable();

  private paymentsSubject = new BehaviorSubject<Payment[]>([]);
  public payments$ = this.paymentsSubject.asObservable();

  private serviceRatesSubject = new BehaviorSubject<ServiceRate[]>([]);
  public serviceRates$ = this.serviceRatesSubject.asObservable();

  // Search and filter signals
  public searchQuery = signal<string>('');
  public selectedStatus = signal<string>('all');
  public selectedPaymentMethod = signal<string>('all');
  public dateRange = signal<{ from?: Date; to?: Date }>({});

  // Hardcoded defaults (no backend endpoint for these)
  private invoiceSettings: InvoiceSettings = {
    garageInfo: {
      name: 'OpAuto Garage',
      address: '123 Avenue Habib Bourguiba',
      city: 'Tunis',
      postalCode: '1000',
      country: 'Tunisia',
      phone: '+216-71-123-456',
      email: 'contact@opautogatage.tn',
      website: 'www.opautogarage.tn',
      taxId: 'TN123456789',
      bankDetails: {
        bankName: 'Banque de Tunisie',
        accountNumber: '20127000123456789',
        routingNumber: '20127',
        iban: 'TN59 2012 7000 1234 5678 9012'
      }
    },
    taxSettings: {
      defaultTaxRate: 19, // 19% TVA in Tunisia
      taxName: 'TVA',
      taxNumber: 'TN123456789',
      taxExemptItems: []
    },
    paymentTerms: {
      defaultTerms: 'Payment due within 30 days',
      dueDays: 30,
      lateFeePercentage: 2,
      lateFeeGraceDays: 7
    },
    invoiceNumbering: {
      prefix: 'INV',
      currentNumber: 1001,
      resetPeriod: 'yearly',
      digitCount: 4
    }
  };

  private defaultServiceRates: ServiceRate[] = [
    {
      id: 'service1',
      serviceCode: 'OIL_CHANGE',
      serviceName: 'Oil Change & Filter',
      description: 'Complete oil change with filter replacement',
      category: 'maintenance',
      basePrice: 120.00,
      laborHours: 1.5,
      hourlyRate: 80.00,
      isActive: true
    },
    {
      id: 'service2',
      serviceCode: 'BRAKE_SERVICE',
      serviceName: 'Brake System Service',
      description: 'Brake pads replacement and system check',
      category: 'safety',
      basePrice: 350.00,
      laborHours: 3.0,
      hourlyRate: 80.00,
      isActive: true
    },
    {
      id: 'service3',
      serviceCode: 'ENGINE_DIAG',
      serviceName: 'Engine Diagnostic',
      description: 'Complete engine diagnostic and tune-up',
      category: 'diagnostic',
      basePrice: 200.00,
      laborHours: 2.5,
      hourlyRate: 80.00,
      isActive: true
    },
    {
      id: 'service4',
      serviceCode: 'TIRE_SERVICE',
      serviceName: 'Tire Service',
      description: 'Tire rotation, balancing, and alignment',
      category: 'maintenance',
      basePrice: 150.00,
      laborHours: 2.0,
      hourlyRate: 80.00,
      isActive: true
    }
  ];

  // --- Backend mapping helpers ---

  private mapFromBackend(b: any): InvoiceWithDetails {
    const payments: Payment[] = (b.payments || []).map((p: any) => ({
      id: p.id,
      invoiceId: p.invoiceId || b.id,
      amount: p.amount,
      method: fromBackendEnum(p.method) as PaymentMethod,
      paymentDate: new Date(p.paymentDate || p.createdAt),
      reference: p.reference,
      notes: p.notes,
      processedBy: p.processedBy || '',
      createdAt: new Date(p.createdAt)
    }));

    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalAmount = b.total || b.totalAmount || 0;
    const taxAmount = b.tax || b.taxAmount || 0;
    const discountAmount = b.discount || b.discountAmount || 0;
    const subtotal = b.subtotal || (totalAmount - taxAmount + discountAmount);

    return {
      id: b.id,
      invoiceNumber: b.invoiceNumber || '',
      customerId: b.customerId,
      carId: b.carId,
      appointmentId: b.appointmentId,
      issueDate: new Date(b.createdAt || b.issueDate),
      dueDate: new Date(b.dueDate || b.createdAt),
      status: fromBackendEnum(b.status) as InvoiceStatus,
      paymentMethod: b.paymentMethod ? fromBackendEnum(b.paymentMethod) as PaymentMethod : undefined,
      paymentDate: b.paymentDate ? new Date(b.paymentDate) : undefined,
      currency: b.currency || 'TND',
      subtotal,
      taxRate: b.taxRate ?? this.invoiceSettings.taxSettings.defaultTaxRate,
      taxAmount,
      discountPercentage: b.discountPercentage || 0,
      discountAmount,
      totalAmount,
      paidAmount,
      remainingAmount: totalAmount - paidAmount,
      lineItems: (b.lineItems || []).map((li: any) => ({
        id: li.id,
        type: (li.type || 'misc') as LineItemType,
        description: li.description || '',
        quantity: li.quantity || 1,
        unit: li.unit || 'service',
        unitPrice: li.unitPrice || 0,
        totalPrice: li.totalPrice || (li.quantity * li.unitPrice) || 0,
        partId: li.partId,
        serviceCode: li.serviceCode,
        mechanicId: li.mechanicId,
        laborHours: li.laborHours,
        discountPercentage: li.discountPercentage,
        taxable: li.taxable ?? true
      })),
      notes: b.notes,
      paymentTerms: b.paymentTerms || this.invoiceSettings.paymentTerms.defaultTerms,
      createdBy: b.createdBy || '',
      createdAt: new Date(b.createdAt),
      updatedAt: new Date(b.updatedAt || b.createdAt),
      // Relations
      customerName: b.customer ? `${b.customer.firstName || ''} ${b.customer.lastName || b.customer.name || ''}`.trim() : '',
      customerPhone: b.customer?.phone || '',
      customerEmail: b.customer?.email,
      carMake: b.car?.make || '',
      carModel: b.car?.model || '',
      carYear: b.car?.year || 0,
      licensePlate: b.car?.licensePlate || '',
      serviceName: b.serviceName,
      mechanicName: b.mechanicName,
      paymentHistory: payments
    };
  }

  private mapToBackend(f: Partial<CreateInvoiceRequest | UpdateInvoiceRequest>): any {
    const payload: any = {};

    if (f.customerId !== undefined) payload.customerId = f.customerId;
    if (f.carId !== undefined) payload.carId = f.carId;
    if ((f as any).appointmentId !== undefined) payload.appointmentId = (f as any).appointmentId;
    if (f.status !== undefined) payload.status = toBackendEnum(f.status);
    if (f.lineItems !== undefined) {
      payload.lineItems = f.lineItems.map(li => ({
        type: li.type,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        unitPrice: li.unitPrice,
        totalPrice: li.totalPrice,
        partId: li.partId,
        serviceCode: li.serviceCode,
        mechanicId: li.mechanicId,
        laborHours: li.laborHours,
        discountPercentage: li.discountPercentage,
        taxable: li.taxable
      }));
    }
    if (f.notes !== undefined) payload.notes = f.notes;
    if (f.discountPercentage !== undefined) payload.discountPercentage = f.discountPercentage;
    if (f.taxRate !== undefined) payload.taxRate = f.taxRate;
    if (f.dueDate !== undefined) payload.dueDate = f.dueDate instanceof Date ? f.dueDate.toISOString() : f.dueDate;
    if (f.issueDate !== undefined) payload.issueDate = f.issueDate instanceof Date ? f.issueDate.toISOString() : f.issueDate;
    if (f.currency !== undefined) payload.currency = f.currency;
    if (f.paymentTerms !== undefined) payload.paymentTerms = f.paymentTerms;
    if (f.paymentMethod !== undefined) payload.paymentMethod = toBackendEnum(f.paymentMethod);

    return payload;
  }

  // --- Invoice CRUD operations ---

  getInvoices(): Observable<InvoiceWithDetails[]> {
    return this.http.get<any[]>('/invoices').pipe(
      map(items => items.map(b => this.mapFromBackend(b))),
      tap(invoices => this.invoicesSubject.next(invoices))
    );
  }

  getInvoiceById(invoiceId: string): InvoiceWithDetails | undefined {
    return this.invoicesSubject.value.find(invoice => invoice.id === invoiceId);
  }

  fetchInvoiceById(invoiceId: string): Observable<InvoiceWithDetails> {
    return this.http.get<any>(`/invoices/${invoiceId}`).pipe(
      map(b => this.mapFromBackend(b))
    );
  }

  createInvoice(invoiceData: CreateInvoiceRequest): Observable<InvoiceWithDetails> {
    const body = this.mapToBackend(invoiceData);
    return this.http.post<any>('/invoices', body).pipe(
      map(b => this.mapFromBackend(b)),
      tap(created => {
        const current = this.invoicesSubject.value;
        this.invoicesSubject.next([...current, created]);
      })
    );
  }

  updateInvoice(invoiceId: string, updates: UpdateInvoiceRequest): Observable<InvoiceWithDetails> {
    const body = this.mapToBackend(updates);
    return this.http.put<any>(`/invoices/${invoiceId}`, body).pipe(
      map(b => this.mapFromBackend(b)),
      tap(updated => {
        const current = this.invoicesSubject.value;
        const index = current.findIndex(inv => inv.id === invoiceId);
        if (index !== -1) {
          current[index] = updated;
          this.invoicesSubject.next([...current]);
        }
      })
    );
  }

  deleteInvoice(invoiceId: string): Observable<boolean> {
    return this.http.delete<void>(`/invoices/${invoiceId}`).pipe(
      map(() => {
        const current = this.invoicesSubject.value;
        const index = current.findIndex(inv => inv.id === invoiceId);
        if (index !== -1) {
          current.splice(index, 1);
          this.invoicesSubject.next([...current]);
        }
        return true;
      })
    );
  }

  // --- Payment operations ---

  addPayment(payment: Omit<Payment, 'id' | 'createdAt'>): Observable<Payment> {
    const body = {
      amount: payment.amount,
      method: toBackendEnum(payment.method),
      paymentDate: payment.paymentDate instanceof Date ? payment.paymentDate.toISOString() : payment.paymentDate,
      reference: payment.reference,
      notes: payment.notes,
      processedBy: payment.processedBy
    };
    return this.http.post<any>(`/invoices/${payment.invoiceId}/payments`, body).pipe(
      map(b => ({
        id: b.id,
        invoiceId: b.invoiceId || payment.invoiceId,
        amount: b.amount,
        method: fromBackendEnum(b.method) as PaymentMethod,
        paymentDate: new Date(b.paymentDate || b.createdAt),
        reference: b.reference,
        notes: b.notes,
        processedBy: b.processedBy || '',
        createdAt: new Date(b.createdAt)
      })),
      tap(newPayment => {
        const currentPayments = this.paymentsSubject.value;
        this.paymentsSubject.next([...currentPayments, newPayment]);

        // Refresh the invoice to get updated totals from backend
        this.refreshInvoice(payment.invoiceId);
      })
    );
  }

  getPaymentsByInvoice(invoiceId: string): Observable<Payment[]> {
    return this.http.get<any[]>(`/invoices/${invoiceId}/payments`).pipe(
      map(items => items.map(p => ({
        id: p.id,
        invoiceId: p.invoiceId || invoiceId,
        amount: p.amount,
        method: fromBackendEnum(p.method) as PaymentMethod,
        paymentDate: new Date(p.paymentDate || p.createdAt),
        reference: p.reference,
        notes: p.notes,
        processedBy: p.processedBy || '',
        createdAt: new Date(p.createdAt)
      })).sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime()))
    );
  }

  // --- Generate invoice from appointment ---

  createInvoiceFromAppointment(appointment: Appointment, partsUsed: any[] = []): Observable<InvoiceWithDetails> {
    const serviceRate = this.defaultServiceRates.find(rate =>
      rate.serviceCode === appointment.serviceType.toUpperCase().replace('-', '_')
    );

    const lineItems: InvoiceLineItem[] = [];

    // Add service item
    if (serviceRate) {
      lineItems.push({
        id: `service_${Date.now()}`,
        type: 'service',
        description: appointment.serviceName,
        quantity: 1,
        unit: 'service',
        unitPrice: serviceRate.basePrice,
        totalPrice: serviceRate.basePrice,
        serviceCode: serviceRate.serviceCode,
        mechanicId: appointment.mechanicId,
        laborHours: serviceRate.laborHours,
        taxable: true
      });

      // Add labor item
      lineItems.push({
        id: `labor_${Date.now()}`,
        type: 'labor',
        description: `Mechanic Labor (${serviceRate.laborHours} hours)`,
        quantity: serviceRate.laborHours,
        unit: 'hour',
        unitPrice: serviceRate.hourlyRate,
        totalPrice: serviceRate.laborHours * serviceRate.hourlyRate,
        mechanicId: appointment.mechanicId,
        laborHours: serviceRate.laborHours,
        taxable: true
      });
    }

    // Add parts used
    partsUsed.forEach(part => {
      lineItems.push({
        id: `part_${Date.now()}_${part.id}`,
        type: 'part',
        description: `${part.name} - ${part.brand}`,
        quantity: part.quantityUsed || 1,
        unit: part.unit,
        unitPrice: part.price,
        totalPrice: part.price * (part.quantityUsed || 1),
        partId: part.id,
        taxable: true
      });
    });

    const invoiceData: CreateInvoiceRequest = {
      customerId: appointment.customerId,
      carId: appointment.carId,
      appointmentId: appointment.id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + (this.invoiceSettings.paymentTerms.dueDays * 24 * 60 * 60 * 1000)),
      status: 'draft',
      currency: 'TND',
      taxRate: this.invoiceSettings.taxSettings.defaultTaxRate,
      discountPercentage: 0,
      paidAmount: 0,
      lineItems,
      notes: appointment.notes,
      paymentTerms: this.invoiceSettings.paymentTerms.defaultTerms,
      createdBy: 'current-user' // TODO: Get from auth service
    };

    return this.createInvoice(invoiceData);
  }

  // --- Calculations (pure functions) ---

  calculateInvoiceTotals(lineItems: InvoiceLineItem[], discountPercentage: number = 0): InvoiceCalculation {
    const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountAmount = (subtotal * discountPercentage) / 100;
    const discountedSubtotal = subtotal - discountAmount;
    const taxAmount = (discountedSubtotal * this.invoiceSettings.taxSettings.defaultTaxRate) / 100;
    const totalAmount = discountedSubtotal + taxAmount;

    return {
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount
    };
  }

  calculateLineItemTotal(quantity: number, unitPrice: number, discountPercentage: number = 0): number {
    const subtotal = quantity * unitPrice;
    const discount = (subtotal * discountPercentage) / 100;
    return subtotal - discount;
  }

  // --- Search and filtering (computed from local cache) ---

  searchInvoices(criteria: InvoiceSearchCriteria): Observable<InvoiceWithDetails[]> {
    let filtered = [...this.invoicesSubject.value];

    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.invoiceNumber.toLowerCase().includes(query) ||
        inv.customerName.toLowerCase().includes(query) ||
        inv.licensePlate.toLowerCase().includes(query) ||
        inv.serviceName?.toLowerCase().includes(query)
      );
    }

    if (criteria.status) {
      filtered = filtered.filter(inv => inv.status === criteria.status);
    }

    if (criteria.customerId) {
      filtered = filtered.filter(inv => inv.customerId === criteria.customerId);
    }

    if (criteria.paymentMethod) {
      filtered = filtered.filter(inv => inv.paymentMethod === criteria.paymentMethod);
    }

    if (criteria.dateFrom) {
      filtered = filtered.filter(inv => inv.issueDate >= criteria.dateFrom!);
    }

    if (criteria.dateTo) {
      filtered = filtered.filter(inv => inv.issueDate <= criteria.dateTo!);
    }

    if (criteria.minAmount) {
      filtered = filtered.filter(inv => inv.totalAmount >= criteria.minAmount!);
    }

    if (criteria.maxAmount) {
      filtered = filtered.filter(inv => inv.totalAmount <= criteria.maxAmount!);
    }

    return of(filtered.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime()));
  }

  // --- Statistics (computed from local cache) ---

  getInvoiceStats(): Observable<InvoiceStats> {
    const invoices = this.invoicesSubject.value;
    const totalInvoices = invoices.length;
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
    const pendingInvoices = invoices.filter(inv => ['sent', 'viewed'].includes(inv.status)).length;
    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;
    const averageInvoiceAmount = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    // Calculate monthly and yearly revenue
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyRevenue = invoices
      .filter(inv => inv.issueDate.getMonth() === currentMonth && inv.issueDate.getFullYear() === currentYear)
      .reduce((sum, inv) => sum + inv.paidAmount, 0);

    const yearlyRevenue = invoices
      .filter(inv => inv.issueDate.getFullYear() === currentYear)
      .reduce((sum, inv) => sum + inv.paidAmount, 0);

    // Payment method statistics
    const paymentMethodCounts = invoices.reduce((counts, inv) => {
      if (inv.paymentMethod) {
        counts[inv.paymentMethod] = (counts[inv.paymentMethod] || 0) + 1;
      }
      return counts;
    }, {} as Record<PaymentMethod, number>);

    const paymentMethodStats = Object.entries(paymentMethodCounts).map(([method, count]) => ({
      method: method as PaymentMethod,
      count,
      totalAmount: invoices
        .filter(inv => inv.paymentMethod === method)
        .reduce((sum, inv) => sum + inv.paidAmount, 0),
      percentage: totalInvoices > 0 ? (count / totalInvoices) * 100 : 0
    }));

    const stats: InvoiceStats = {
      totalInvoices,
      totalRevenue,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
      averageInvoiceAmount,
      monthlyRevenue,
      yearlyRevenue,
      topCustomers: [], // TODO: Calculate from data
      recentInvoices: [...invoices]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10),
      paymentMethodStats
    };

    return of(stats);
  }

  // --- Service rates (hardcoded defaults, no backend endpoint) ---

  getServiceRates(): Observable<ServiceRate[]> {
    this.serviceRatesSubject.next(this.defaultServiceRates);
    return this.serviceRates$;
  }

  getServiceRateByCode(serviceCode: string): ServiceRate | undefined {
    return this.defaultServiceRates.find(rate => rate.serviceCode === serviceCode);
  }

  // --- Settings ---

  getInvoiceSettings(): Observable<InvoiceSettings> {
    return this.http.get<any>('/garage-settings').pipe(
      map(garage => {
        const parts = (garage.address || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        const city = parts.length > 1 ? parts[parts.length - 1].replace(/\s*\d+\s*$/, '').trim() : this.invoiceSettings.garageInfo.city;
        const postal = (garage.address || '').match(/\b\d{4}\b/)?.[0] || this.invoiceSettings.garageInfo.postalCode;
        this.invoiceSettings = {
          ...this.invoiceSettings,
          garageInfo: {
            ...this.invoiceSettings.garageInfo,
            name: garage.name || this.invoiceSettings.garageInfo.name,
            address: parts[0] || garage.address || this.invoiceSettings.garageInfo.address,
            city,
            postalCode: postal,
            phone: garage.phone || this.invoiceSettings.garageInfo.phone,
            email: garage.email || this.invoiceSettings.garageInfo.email,
          },
          taxSettings: {
            ...this.invoiceSettings.taxSettings,
            defaultTaxRate: garage.taxRate ?? this.invoiceSettings.taxSettings.defaultTaxRate,
          },
        };
        return this.invoiceSettings;
      }),
      catchError(() => of(this.invoiceSettings))
    );
  }

  updateInvoiceSettings(settings: Partial<InvoiceSettings>): Observable<InvoiceSettings> {
    this.invoiceSettings = { ...this.invoiceSettings, ...settings };
    return of(this.invoiceSettings);
  }

  // --- Utility methods (pure functions) ---

  getStatusColor(status: InvoiceStatus): string {
    const colors = {
      'draft': 'text-gray-600',
      'sent': 'text-blue-600',
      'viewed': 'text-blue-600',
      'paid': 'text-green-600',
      'partially-paid': 'text-amber-600',
      'overdue': 'text-red-600',
      'cancelled': 'text-gray-400',
      'refunded': 'text-purple-600'
    };
    return colors[status] || 'text-gray-600';
  }

  getStatusBadgeClass(status: InvoiceStatus): string {
    const classes = {
      'draft': 'badge badge-neutral',
      'sent': 'badge badge-active',
      'viewed': 'badge badge-active',
      'paid': 'badge badge-completed',
      'partially-paid': 'badge badge-pending',
      'overdue': 'badge badge-priority-urgent',
      'cancelled': 'badge badge-cancelled',
      'refunded': 'badge badge-info'
    };
    return classes[status] || classes.draft;
  }

  formatCurrency(amount: number, currency: string = 'TND'): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-TN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  // --- Private helpers ---

  private refreshInvoice(invoiceId: string): void {
    this.http.get<any>(`/invoices/${invoiceId}`).pipe(
      map(b => this.mapFromBackend(b))
    ).subscribe(updated => {
      const current = this.invoicesSubject.value;
      const index = current.findIndex(inv => inv.id === invoiceId);
      if (index !== -1) {
        current[index] = updated;
        this.invoicesSubject.next([...current]);
      }
    });
  }
}
