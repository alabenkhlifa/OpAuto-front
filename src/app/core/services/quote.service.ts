import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  Quote,
  QuoteStatus,
  QuoteWithDetails,
  CreateQuoteRequest,
  UpdateQuoteRequest,
} from '../models/quote.model';
import { InvoiceLineItem, LineItemType } from '../models/invoice.model';

/**
 * QuoteService — thin HTTP wrapper around `/quotes`. Mirrors the shape
 * of InvoiceService but for the devis (quote) resource.
 */
@Injectable({ providedIn: 'root' })
export class QuoteService {
  private http = inject(HttpClient);

  private readonly baseUrl = '/quotes';

  private quotesSubject = new BehaviorSubject<QuoteWithDetails[]>([]);
  public quotes$ = this.quotesSubject.asObservable();

  list(status?: QuoteStatus): Observable<QuoteWithDetails[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http
      .get<unknown[]>(this.baseUrl, { params })
      .pipe(
        map((items) => items.map((b) => this.mapFromBackend(b))),
        tap((rows) => this.quotesSubject.next(rows)),
      );
  }

  get(id: string): Observable<QuoteWithDetails> {
    return this.http
      .get<unknown>(`${this.baseUrl}/${id}`)
      .pipe(map((b) => this.mapFromBackend(b)));
  }

  create(payload: CreateQuoteRequest): Observable<QuoteWithDetails> {
    return this.http
      .post<unknown>(this.baseUrl, this.mapToBackend(payload))
      .pipe(map((b) => this.mapFromBackend(b)));
  }

  update(
    id: string,
    payload: UpdateQuoteRequest,
  ): Observable<QuoteWithDetails> {
    return this.http
      .put<unknown>(`${this.baseUrl}/${id}`, this.mapToBackend(payload))
      .pipe(map((b) => this.mapFromBackend(b)));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  send(id: string): Observable<QuoteWithDetails> {
    return this.http
      .post<unknown>(`${this.baseUrl}/${id}/send`, {})
      .pipe(map((b) => this.mapFromBackend(b)));
  }

  approve(id: string): Observable<{ quote: QuoteWithDetails; invoiceId: string }> {
    return this.http
      .post<{ quote: unknown; invoiceId: string }>(
        `${this.baseUrl}/${id}/approve`,
        {},
      )
      .pipe(
        map((res) => ({
          quote: this.mapFromBackend(res.quote),
          invoiceId: res.invoiceId,
        })),
      );
  }

  reject(id: string): Observable<QuoteWithDetails> {
    return this.http
      .post<unknown>(`${this.baseUrl}/${id}/reject`, {})
      .pipe(map((b) => this.mapFromBackend(b)));
  }

  // --- Mapping helpers ---

  private mapFromBackend(b: any): QuoteWithDetails {
    const subtotal = b.subtotal ?? 0;
    const totalAmount = b.totalAmount ?? b.total ?? 0;
    const taxAmount = b.taxAmount ?? b.tax ?? 0;
    const discountAmount = b.discountAmount ?? b.discount ?? 0;
    return {
      id: b.id,
      quoteNumber: b.quoteNumber ?? '',
      customerId: b.customerId,
      carId: b.carId,
      status: (b.status ?? 'DRAFT') as QuoteStatus,
      issueDate: new Date(b.issueDate ?? b.createdAt),
      validUntil: new Date(b.validUntil ?? b.createdAt),
      currency: b.currency ?? 'TND',
      subtotal,
      taxAmount,
      discountPercentage: b.discountPercentage ?? 0,
      discountAmount,
      totalAmount,
      lineItems: ((b.lineItems ?? []) as any[]).map((li) => ({
        id: li.id,
        type: (li.type || 'misc') as LineItemType,
        description: li.description || '',
        quantity: li.quantity || 1,
        unit: li.unit || 'service',
        unitPrice: li.unitPrice || 0,
        totalPrice:
          li.totalPrice || (li.quantity || 1) * (li.unitPrice || 0),
        partId: li.partId,
        serviceCode: li.serviceCode,
        mechanicId: li.mechanicId,
        laborHours: li.laborHours,
        discountPercentage: li.discountPercentage,
        taxable: li.taxable ?? true,
      })) as InvoiceLineItem[],
      notes: b.notes,
      convertedToInvoiceId: b.convertedToInvoiceId ?? null,
      createdBy: b.createdBy ?? '',
      createdAt: new Date(b.createdAt),
      updatedAt: new Date(b.updatedAt ?? b.createdAt),
      customerName: b.customer
        ? `${b.customer.firstName ?? ''} ${b.customer.lastName ?? b.customer.name ?? ''}`.trim()
        : '',
      customerPhone: b.customer?.phone ?? '',
      customerEmail: b.customer?.email,
      carMake: b.car?.make ?? '',
      carModel: b.car?.model ?? '',
      carYear: b.car?.year ?? 0,
      licensePlate: b.car?.licensePlate ?? '',
    };
  }

  private mapToBackend(f: Partial<CreateQuoteRequest | UpdateQuoteRequest>): any {
    const payload: any = {};
    if (f.customerId !== undefined) payload.customerId = f.customerId;
    if (f.carId !== undefined) payload.carId = f.carId;
    if (f.status !== undefined) payload.status = f.status;
    if (f.validUntil !== undefined) {
      payload.validUntil =
        f.validUntil instanceof Date ? f.validUntil.toISOString() : f.validUntil;
    }
    if (f.issueDate !== undefined) {
      payload.issueDate =
        f.issueDate instanceof Date ? f.issueDate.toISOString() : f.issueDate;
    }
    if (f.currency !== undefined) payload.currency = f.currency;
    if (f.discountPercentage !== undefined)
      payload.discountPercentage = f.discountPercentage;
    if (f.notes !== undefined) payload.notes = f.notes;
    if (f.lineItems !== undefined) {
      payload.lineItems = f.lineItems.map((li) => ({
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
        taxable: li.taxable,
      }));
    }
    return payload;
  }

  // --- View helpers ---

  getStatusBadgeClass(status: QuoteStatus): string {
    const classes: Record<QuoteStatus, string> = {
      DRAFT: 'badge badge-neutral',
      SENT: 'badge badge-active',
      APPROVED: 'badge badge-completed',
      REJECTED: 'badge badge-cancelled',
      EXPIRED: 'badge badge-priority-urgent',
    };
    return classes[status] ?? 'badge badge-neutral';
  }

  isExpired(quote: { validUntil: Date; status: QuoteStatus }): boolean {
    if (quote.status === 'EXPIRED') return true;
    return quote.status === 'SENT' && new Date() > quote.validUntil;
  }
}
