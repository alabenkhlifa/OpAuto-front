import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
      maintenanceJobId: b.maintenanceJobId,
      quoteId: b.quoteId,
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
        // Normalize to the FE lowercase enum (`service|part|labor|misc`).
        // BE stores `type` as free-form string; legacy rows can be uppercase
        // (`SERVICE`) which would miss the `invoicing.form.lineTypes.<type>`
        // i18n key and surface as a raw key in the UI (Sweep C-10 / S-I18N-001/002).
        type: (typeof li.type === 'string' ? li.type.toLowerCase() : (li.type || 'misc')) as LineItemType,
        description: li.description || '',
        quantity: li.quantity || 1,
        unit: li.unit || 'service',
        unitPrice: li.unitPrice || 0,
        // Backend persists fiscal line total as `total` (HT × qty + TVA);
        // accept the legacy `totalPrice` shape for any older callers.
        totalPrice: li.total ?? li.totalPrice ?? (li.quantity * li.unitPrice) ?? 0,
        partId: li.partId,
        serviceCode: li.serviceCode,
        mechanicId: li.mechanicId,
        laborHours: li.laborHours,
        tvaRate: li.tvaRate,
        discountPercentage: li.discountPct ?? li.discountPercentage,
        taxable: (li.tvaRate ?? 19) > 0
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

  /**
   * Maps the FE form/model to the backend DTO contract. The backend uses
   * `whitelist + forbidNonWhitelisted` validation, so any field not declared
   * in `CreateInvoiceDto`/`UpdateInvoiceDto` triggers 400. Server-computed
   * fiscal fields (subtotal, tax, fiscalStamp, total, status defaults,
   * issueDate, currency, paymentTerms, createdBy) are intentionally NOT
   * sent — the BE derives them. State transitions (issue, deliver,
   * payments) go through dedicated endpoints, not PUT.
   */
  private mapToBackend(
    f: Partial<CreateInvoiceRequest | UpdateInvoiceRequest>,
    opts: { forUpdate?: boolean } = {}
  ): any {
    const payload: any = {};

    if (f.customerId !== undefined) payload.customerId = f.customerId;
    if (f.carId !== undefined) payload.carId = f.carId;
    if (f.dueDate !== undefined) {
      payload.dueDate = f.dueDate instanceof Date ? f.dueDate.toISOString() : f.dueDate;
    }
    if (f.notes !== undefined) payload.notes = f.notes;
    if ((f as any).discount !== undefined) payload.discount = (f as any).discount;
    if ((f as any).discountReason !== undefined) {
      payload.discountReason = (f as any).discountReason;
    }
    if ((f as any).discountApprovedBy !== undefined) {
      payload.discountApprovedBy = (f as any).discountApprovedBy;
    }
    // Status mutations are only valid on PUT (DRAFT → CANCELLED, etc.).
    // The Issue transition has its own endpoint and never flows here.
    if (opts.forUpdate && f.status !== undefined) {
      payload.status = toBackendEnum(f.status);
    }
    if (f.lineItems !== undefined) {
      payload.lineItems = f.lineItems.map(li => {
        const line: any = {
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        };
        if (li.type !== undefined) line.type = li.type;
        if (li.tvaRate !== undefined) line.tvaRate = li.tvaRate;
        if (li.partId !== undefined) line.partId = li.partId;
        if (li.serviceCode !== undefined) line.serviceCode = li.serviceCode;
        if (li.mechanicId !== undefined) line.mechanicId = li.mechanicId;
        if (li.laborHours !== undefined) line.laborHours = li.laborHours;
        if (li.discountPercentage !== undefined) line.discountPct = li.discountPercentage;
        return line;
      });
    }

    return payload;
  }

  // --- Invoice CRUD operations ---

  /**
   * S-PERF-002 (Sweep C-18) — optional `search` parameter is forwarded
   * to the BE as `?search=` so the invoice-list page can filter
   * server-side instead of dumping the entire catalog into memory.
   * Empty / whitespace `search` keeps the existing all-rows behaviour
   * so other callers (cache hydration, dashboards) stay compatible.
   *
   * S-PERF-001 (Sweep C-20) — back-compat list-of-invoices wrapper.
   * Calls the paginated endpoint with `limit=100` (the BE-clamped
   * maximum) so non-list callers (dashboards, reports, the cache
   * hydration in `pending-list`) still get a single fetch worth of
   * rows without paging plumbing. The list page (and any other caller
   * that needs page-driven data) should call `getInvoicesPaginated()`
   * directly to consume the full envelope.
   */
  getInvoices(search?: string): Observable<InvoiceWithDetails[]> {
    return this.getInvoicesPaginated({ search, page: 1, limit: 100 }).pipe(
      map(envelope => envelope.items),
      tap(invoices => this.invoicesSubject.next(invoices)),
    );
  }

  /**
   * S-PERF-001 (Sweep C-20) — paginated invoice list. Returns the BE
   * envelope `{ items, total, page, limit }` so the consumer can drive
   * its own pagination footer off a stable BE-authoritative count.
   *
   * Filters apply BEFORE pagination — i.e. `total` reflects the
   * post-search row count, not the global garage row count. That's
   * the contract `invoice-list.component` relies on to keep its
   * "Showing 26-50 of 237" text correct under search.
   *
   * Empty / whitespace `search` is omitted from the query string so
   * the BE's `where` short-circuit kicks in.
   */
  getInvoicesPaginated(
    opts: { search?: string; page?: number; limit?: number } = {},
  ): Observable<{
    items: InvoiceWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    let params = new HttpParams();
    const trimmed = (opts.search ?? '').trim();
    if (trimmed) params = params.set('search', trimmed);
    if (opts.page !== undefined) params = params.set('page', String(opts.page));
    if (opts.limit !== undefined) params = params.set('limit', String(opts.limit));
    return this.http
      .get<{ items: any[]; total: number; page: number; limit: number }>(
        '/invoices',
        { params },
      )
      .pipe(
        map(envelope => ({
          items: envelope.items.map(b => this.mapFromBackend(b)),
          total: envelope.total,
          page: envelope.page,
          limit: envelope.limit,
        })),
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
    const body = this.mapToBackend(updates, { forUpdate: true });
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
    // S-EDGE-017 — guard against Invalid Date instances. `new Date('')`
    // and `new Date(undefined)` produce a Date object that satisfies
    // `instanceof Date` but throws RangeError on `.toISOString()`. Fall
    // back to the current timestamp so the BE always receives a valid
    // ISO string. The RangeError previously surfaced as a transient
    // glitch on submit re-render even though the payment still posted.
    const isDate = payment.paymentDate instanceof Date;
    const validDate = isDate && !isNaN((payment.paymentDate as Date).getTime());
    const isoDate = validDate
      ? (payment.paymentDate as Date).toISOString()
      : isDate
        ? new Date().toISOString()
        : (payment.paymentDate as any);
    const body = {
      amount: payment.amount,
      method: toBackendEnum(payment.method),
      paymentDate: isoDate,
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

  // --- Generate invoice from a maintenance job (Phase 2.1 backend) ---

  /**
   * Calls `POST /invoices/from-job/:jobId` and maps the resulting DRAFT
   * invoice through the standard backend mapper. Used by the invoice
   * form's "Pull from job" CTA — the backend prefills line items from
   * the job's parts + labor + services.
   */
  createInvoiceFromJob(jobId: string): Observable<InvoiceWithDetails> {
    return this.http.post<any>(`/invoices/from-job/${jobId}`, {}).pipe(
      map(b => this.mapFromBackend(b)),
      tap(created => {
        const current = this.invoicesSubject.value;
        const idx = current.findIndex(inv => inv.id === created.id);
        if (idx === -1) {
          this.invoicesSubject.next([...current, created]);
        } else {
          const next = [...current];
          next[idx] = created;
          this.invoicesSubject.next(next);
        }
      })
    );
  }

  /** Triggers the backend issue endpoint — locks the invoice and decrements stock. */
  issueInvoice(invoiceId: string): Observable<InvoiceWithDetails> {
    return this.http.post<any>(`/invoices/${invoiceId}/issue`, {}).pipe(
      map(b => this.mapFromBackend(b)),
      tap(updated => {
        const current = this.invoicesSubject.value;
        const idx = current.findIndex(inv => inv.id === invoiceId);
        if (idx !== -1) {
          const next = [...current];
          next[idx] = updated;
          this.invoicesSubject.next(next);
        }
      })
    );
  }

  /** Triggers the delivery endpoint — sends the document via the chosen channel. */
  deliverInvoice(invoiceId: string, payload: { channel: 'EMAIL' | 'WHATSAPP' | 'BOTH'; to?: string }): Observable<{ ok: boolean }> {
    return this.http.post<any>(`/invoices/${invoiceId}/deliver`, payload).pipe(
      map(b => ({ ok: !!b }))
    );
  }

  /**
   * Fetches the rendered invoice PDF as a Blob via the authenticated
   * `GET /api/invoices/:id/pdf` route. Returning a Blob lets the caller
   * either preview (createObjectURL → window.open) or download (anchor
   * with `download` attribute) without bypassing the JWT guard — a plain
   * `<a target="_blank">` to the API URL would 401 since cross-tab
   * requests don't carry the bearer header from the interceptor.
   */
  getInvoicePdfBlob(invoiceId: string): Observable<Blob> {
    return this.http.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
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
