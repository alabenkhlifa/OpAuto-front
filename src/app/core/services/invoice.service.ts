import { Injectable, signal, computed } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
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

  private mockServiceRates: ServiceRate[] = [
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

  private mockInvoices: InvoiceWithDetails[] = [
    {
      id: 'inv1',
      invoiceNumber: 'INV-2025-1001',
      customerId: 'customer1',
      carId: 'car1',
      appointmentId: '1',
      issueDate: new Date(2025, 7, 25),
      dueDate: new Date(2025, 8, 24),
      status: 'paid',
      paymentMethod: 'cash',
      paymentDate: new Date(2025, 7, 26),
      currency: 'TND',
      subtotal: 450.00,
      taxRate: 19,
      taxAmount: 85.50,
      discountPercentage: 0,
      discountAmount: 0,
      totalAmount: 535.50,
      paidAmount: 535.50,
      remainingAmount: 0,
      lineItems: [
        {
          id: 'line1',
          type: 'service',
          description: 'Oil Change & Filter Replacement',
          quantity: 1,
          unit: 'service',
          unitPrice: 120.00,
          totalPrice: 120.00,
          serviceCode: 'OIL_CHANGE',
          mechanicId: 'mechanic1',
          laborHours: 1.5,
          taxable: true
        },
        {
          id: 'line2',
          type: 'part',
          description: 'Engine Oil 5W-30 (5L)',
          quantity: 2,
          unit: 'bottle',
          unitPrice: 45.50,
          totalPrice: 91.00,
          partId: 'part1',
          taxable: true
        },
        {
          id: 'line3',
          type: 'labor',
          description: 'Mechanic Labor (1.5 hours)',
          quantity: 1.5,
          unit: 'hour',
          unitPrice: 80.00,
          totalPrice: 120.00,
          mechanicId: 'mechanic1',
          laborHours: 1.5,
          taxable: true
        },
        {
          id: 'line4',
          type: 'part',
          description: 'Oil Filter',
          quantity: 1,
          unit: 'piece',
          unitPrice: 25.00,
          totalPrice: 25.00,
          partId: 'part6',
          taxable: true
        },
        {
          id: 'line5',
          type: 'misc',
          description: 'Environmental Disposal Fee',
          quantity: 1,
          unit: 'service',
          unitPrice: 15.00,
          totalPrice: 15.00,
          taxable: true
        }
      ],
      notes: 'Customer requested synthetic oil. Next service due in 6 months.',
      paymentTerms: 'Payment due within 30 days',
      createdBy: 'admin1',
      createdAt: new Date(2025, 7, 25),
      updatedAt: new Date(2025, 7, 26),
      customerName: 'Ahmed Ben Ali',
      customerPhone: '+216-20-123-456',
      customerEmail: 'ahmed.benali@email.tn',
      carMake: 'BMW',
      carModel: 'X5',
      carYear: 2020,
      licensePlate: '123 TUN 2024',
      serviceName: 'Oil Change & Filter Replacement',
      mechanicName: 'Karim Mechanic',
      paymentHistory: []
    },
    {
      id: 'inv2',
      invoiceNumber: 'INV-2025-1002',
      customerId: 'customer2',
      carId: 'car2',
      appointmentId: '2',
      issueDate: new Date(2025, 7, 28),
      dueDate: new Date(2025, 8, 27),
      status: 'sent',
      currency: 'TND',
      subtotal: 720.00,
      taxRate: 19,
      taxAmount: 136.80,
      discountPercentage: 5,
      discountAmount: 36.00,
      totalAmount: 820.80,
      paidAmount: 0,
      remainingAmount: 820.80,
      lineItems: [
        {
          id: 'line6',
          type: 'service',
          description: 'Front Brake Pads Replacement',
          quantity: 1,
          unit: 'service',
          unitPrice: 350.00,
          totalPrice: 350.00,
          serviceCode: 'BRAKE_SERVICE',
          mechanicId: 'mechanic2',
          laborHours: 3.0,
          taxable: true
        },
        {
          id: 'line7',
          type: 'part',
          description: 'Brake Pads Front Set - Bosch',
          quantity: 1,
          unit: 'set',
          unitPrice: 180.00,
          totalPrice: 180.00,
          partId: 'part2',
          taxable: true
        },
        {
          id: 'line8',
          type: 'labor',
          description: 'Mechanic Labor (3 hours)',
          quantity: 3,
          unit: 'hour',
          unitPrice: 80.00,
          totalPrice: 240.00,
          mechanicId: 'mechanic2',
          laborHours: 3.0,
          taxable: true
        }
      ],
      notes: 'Customer complained about brake noise. Brake pads were worn out.',
      paymentTerms: 'Payment due within 30 days',
      createdBy: 'admin1',
      createdAt: new Date(2025, 7, 28),
      updatedAt: new Date(2025, 7, 28),
      customerName: 'Fatma Trabelsi',
      customerPhone: '+216-25-789-123',
      customerEmail: 'fatma.trabelsi@email.tn',
      carMake: 'Honda',
      carModel: 'Civic',
      carYear: 2019,
      licensePlate: '456 TUN 2019',
      serviceName: 'Front Brake Pads Replacement',
      mechanicName: 'Ahmed Mechanic',
      paymentHistory: []
    },
    {
      id: 'inv3',
      invoiceNumber: 'INV-2025-1003',
      customerId: 'customer3',
      carId: 'car4',
      issueDate: new Date(2025, 7, 20),
      dueDate: new Date(2025, 8, 19),
      status: 'overdue',
      currency: 'TND',
      subtotal: 280.00,
      taxRate: 19,
      taxAmount: 53.20,
      discountPercentage: 0,
      discountAmount: 0,
      totalAmount: 333.20,
      paidAmount: 200.00,
      remainingAmount: 133.20,
      lineItems: [
        {
          id: 'line9',
          type: 'service',
          description: 'Routine Maintenance Check',
          quantity: 1,
          unit: 'service',
          unitPrice: 150.00,
          totalPrice: 150.00,
          serviceCode: 'ROUTINE_CHECK',
          mechanicId: 'mechanic1',
          laborHours: 2.0,
          taxable: true
        },
        {
          id: 'line10',
          type: 'labor',
          description: 'Mechanic Labor (2 hours)',
          quantity: 2,
          unit: 'hour',
          unitPrice: 80.00,
          totalPrice: 160.00,
          mechanicId: 'mechanic1',
          laborHours: 2.0,
          taxable: true
        }
      ],
      notes: 'Customer made partial payment. Follow up required.',
      paymentTerms: 'Payment due within 30 days',
      createdBy: 'admin1',
      createdAt: new Date(2025, 7, 20),
      updatedAt: new Date(2025, 7, 25),
      customerName: 'Mohamed Khemir',
      customerPhone: '+216-22-456-789',
      customerEmail: 'mohamed.khemir@email.tn',
      carMake: 'Mercedes',
      carModel: 'C-Class',
      carYear: 2022,
      licensePlate: '321 TUN 2022',
      serviceName: 'Routine Maintenance Check',
      mechanicName: 'Karim Mechanic',
      paymentHistory: [
        {
          id: 'pay1',
          invoiceId: 'inv3',
          amount: 200.00,
          method: 'cash',
          paymentDate: new Date(2025, 7, 22),
          notes: 'Partial payment',
          processedBy: 'admin1',
          createdAt: new Date(2025, 7, 22)
        }
      ]
    }
  ];

  private mockPayments: Payment[] = [
    {
      id: 'pay1',
      invoiceId: 'inv3',
      amount: 200.00,
      method: 'cash',
      paymentDate: new Date(2025, 7, 22),
      notes: 'Partial payment',
      processedBy: 'admin1',
      createdAt: new Date(2025, 7, 22)
    }
  ];

  constructor() {
    this.invoicesSubject.next(this.mockInvoices);
    this.paymentsSubject.next(this.mockPayments);
    this.serviceRatesSubject.next(this.mockServiceRates);
  }

  // Invoice CRUD operations
  getInvoices(): Observable<InvoiceWithDetails[]> {
    return this.invoices$;
  }

  getInvoiceById(invoiceId: string): InvoiceWithDetails | undefined {
    return this.mockInvoices.find(invoice => invoice.id === invoiceId);
  }

  createInvoice(invoiceData: CreateInvoiceRequest): Observable<InvoiceWithDetails> {
    const calculation = this.calculateInvoiceTotals(invoiceData.lineItems, invoiceData.discountPercentage || 0);
    
    const newInvoice: InvoiceWithDetails = {
      ...invoiceData,
      id: Date.now().toString(),
      invoiceNumber: this.generateInvoiceNumber(),
      subtotal: calculation.subtotal,
      taxAmount: calculation.taxAmount,
      discountAmount: calculation.discountAmount,
      totalAmount: calculation.totalAmount,
      remainingAmount: calculation.totalAmount,
      createdAt: new Date(),
      updatedAt: new Date(),
      // These will be populated from related services
      customerName: '',
      customerPhone: '',
      carMake: '',
      carModel: '',
      carYear: 0,
      licensePlate: '',
      paymentHistory: []
    };

    // Populate customer and car details
    this.populateInvoiceDetails(newInvoice);

    this.mockInvoices.push(newInvoice);
    this.invoicesSubject.next([...this.mockInvoices]);
    return of(newInvoice);
  }

  updateInvoice(invoiceId: string, updates: UpdateInvoiceRequest): Observable<InvoiceWithDetails> {
    const index = this.mockInvoices.findIndex(inv => inv.id === invoiceId);
    if (index !== -1) {
      const currentInvoice = this.mockInvoices[index];
      
      // Recalculate totals if line items changed
      let calculation = {
        subtotal: currentInvoice.subtotal,
        taxAmount: currentInvoice.taxAmount,
        discountAmount: currentInvoice.discountAmount,
        totalAmount: currentInvoice.totalAmount
      };

      if (updates.lineItems || updates.discountPercentage !== undefined) {
        calculation = this.calculateInvoiceTotals(
          updates.lineItems || currentInvoice.lineItems,
          updates.discountPercentage ?? currentInvoice.discountPercentage
        );
      }

      const updatedInvoice = {
        ...currentInvoice,
        ...updates,
        ...calculation,
        remainingAmount: calculation.totalAmount - (updates.paidAmount ?? currentInvoice.paidAmount),
        updatedAt: new Date()
      };

      this.mockInvoices[index] = updatedInvoice;
      this.invoicesSubject.next([...this.mockInvoices]);
      return of(updatedInvoice);
    }
    throw new Error('Invoice not found');
  }

  deleteInvoice(invoiceId: string): Observable<boolean> {
    const index = this.mockInvoices.findIndex(inv => inv.id === invoiceId);
    if (index !== -1) {
      this.mockInvoices.splice(index, 1);
      this.invoicesSubject.next([...this.mockInvoices]);
      return of(true);
    }
    return of(false);
  }

  // Payment operations
  addPayment(payment: Omit<Payment, 'id' | 'createdAt'>): Observable<Payment> {
    const newPayment: Payment = {
      ...payment,
      id: Date.now().toString(),
      createdAt: new Date()
    };

    this.mockPayments.push(newPayment);
    this.paymentsSubject.next([...this.mockPayments]);

    // Update invoice paid amount and status
    this.updateInvoicePaymentStatus(payment.invoiceId, payment.amount);

    return of(newPayment);
  }

  getPaymentsByInvoice(invoiceId: string): Observable<Payment[]> {
    const payments = this.mockPayments.filter(p => p.invoiceId === invoiceId);
    return of(payments.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime()));
  }

  // Generate invoice from appointment
  createInvoiceFromAppointment(appointment: Appointment, partsUsed: any[] = []): Observable<InvoiceWithDetails> {
    const serviceRate = this.mockServiceRates.find(rate => 
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

  // Calculations
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

  // Search and filtering
  searchInvoices(criteria: InvoiceSearchCriteria): Observable<InvoiceWithDetails[]> {
    let filtered = [...this.mockInvoices];

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

  // Statistics
  getInvoiceStats(): Observable<InvoiceStats> {
    const totalInvoices = this.mockInvoices.length;
    const totalRevenue = this.mockInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const paidInvoices = this.mockInvoices.filter(inv => inv.status === 'paid').length;
    const pendingInvoices = this.mockInvoices.filter(inv => ['sent', 'viewed'].includes(inv.status)).length;
    const overdueInvoices = this.mockInvoices.filter(inv => inv.status === 'overdue').length;
    const averageInvoiceAmount = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    // Calculate monthly and yearly revenue
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyRevenue = this.mockInvoices
      .filter(inv => inv.issueDate.getMonth() === currentMonth && inv.issueDate.getFullYear() === currentYear)
      .reduce((sum, inv) => sum + inv.paidAmount, 0);

    const yearlyRevenue = this.mockInvoices
      .filter(inv => inv.issueDate.getFullYear() === currentYear)
      .reduce((sum, inv) => sum + inv.paidAmount, 0);

    // Payment method statistics
    const paymentMethodCounts = this.mockInvoices.reduce((counts, inv) => {
      if (inv.paymentMethod) {
        counts[inv.paymentMethod] = (counts[inv.paymentMethod] || 0) + 1;
      }
      return counts;
    }, {} as Record<PaymentMethod, number>);

    const paymentMethodStats = Object.entries(paymentMethodCounts).map(([method, count]) => ({
      method: method as PaymentMethod,
      count,
      totalAmount: this.mockInvoices
        .filter(inv => inv.paymentMethod === method)
        .reduce((sum, inv) => sum + inv.paidAmount, 0),
      percentage: (count / totalInvoices) * 100
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
      recentInvoices: [...this.mockInvoices]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10),
      paymentMethodStats
    };

    return of(stats);
  }

  // Service rates
  getServiceRates(): Observable<ServiceRate[]> {
    return this.serviceRates$;
  }

  getServiceRateByCode(serviceCode: string): ServiceRate | undefined {
    return this.mockServiceRates.find(rate => rate.serviceCode === serviceCode);
  }

  // Settings
  getInvoiceSettings(): Observable<InvoiceSettings> {
    return of(this.invoiceSettings);
  }

  updateInvoiceSettings(settings: Partial<InvoiceSettings>): Observable<InvoiceSettings> {
    this.invoiceSettings = { ...this.invoiceSettings, ...settings };
    return of(this.invoiceSettings);
  }

  // Utility methods
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
      currency: currency
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-TN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  // Private helper methods
  private generateInvoiceNumber(): string {
    const settings = this.invoiceSettings.invoiceNumbering;
    const year = new Date().getFullYear();
    const number = settings.currentNumber.toString().padStart(settings.digitCount, '0');
    
    // Increment counter
    settings.currentNumber++;
    
    return `${settings.prefix}-${year}-${number}`;
  }

  private updateInvoicePaymentStatus(invoiceId: string, paymentAmount: number): void {
    const invoice = this.getInvoiceById(invoiceId);
    if (invoice) {
      const newPaidAmount = invoice.paidAmount + paymentAmount;
      const remainingAmount = invoice.totalAmount - newPaidAmount;
      
      let newStatus: InvoiceStatus = 'paid';
      if (remainingAmount > 0) {
        newStatus = 'partially-paid';
      }
      
      this.updateInvoice(invoiceId, {
        paidAmount: newPaidAmount,
        remainingAmount,
        status: newStatus,
        paymentDate: remainingAmount === 0 ? new Date() : undefined
      });
    }
  }

  private populateInvoiceDetails(invoice: InvoiceWithDetails): void {
    // This would typically fetch from other services
    // For now, using mock data from existing services
    const customers = [
      { id: 'customer1', name: 'Ahmed Ben Ali', phone: '+216-20-123-456', email: 'ahmed.benali@email.tn' },
      { id: 'customer2', name: 'Fatma Trabelsi', phone: '+216-25-789-123', email: 'fatma.trabelsi@email.tn' },
      { id: 'customer3', name: 'Mohamed Khemir', phone: '+216-22-456-789', email: 'mohamed.khemir@email.tn' }
    ];

    const cars = [
      { id: 'car1', licensePlate: '123 TUN 2024', make: 'BMW', model: 'X5', year: 2020 },
      { id: 'car2', licensePlate: '456 TUN 2019', make: 'Honda', model: 'Civic', year: 2019 },
      { id: 'car4', licensePlate: '321 TUN 2022', make: 'Mercedes', model: 'C-Class', year: 2022 }
    ];

    const customer = customers.find(c => c.id === invoice.customerId);
    const car = cars.find(c => c.id === invoice.carId);

    if (customer) {
      invoice.customerName = customer.name;
      invoice.customerPhone = customer.phone;
      invoice.customerEmail = customer.email;
    }

    if (car) {
      invoice.carMake = car.make;
      invoice.carModel = car.model;
      invoice.carYear = car.year;
      invoice.licensePlate = car.licensePlate;
    }
  }
}