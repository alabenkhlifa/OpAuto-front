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
 * Default Tunisian TVA rate when the form / line doesn't specify one.
 * Backend resolves the same default from `garage.defaultTvaRate`.
 */
const DEFAULT_TVA_RATE = 19;

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

  /**
   * Approve a SENT quote. The backend creates a DRAFT invoice from the
   * quote's line items, links both directions (`invoice.quoteId` +
   * `quote.convertedToInvoiceId`) and returns `{ quote, invoice }`.
   *
   * BUG-105 (Sweep C-4) — the previous mapping read `res.invoiceId`
   * which is undefined in the BE shape `{ quote, invoice }`; the
   * downstream `router.navigate(['/invoices', invoiceId])` then routed
   * to `/invoices/undefined` and the destination page rendered "not
   * found". We now read `res.invoice.id` and surface it as `invoiceId`
   * for the existing call sites.
   */
  approve(id: string): Observable<{ quote: QuoteWithDetails; invoiceId: string }> {
    return this.http
      .post<{ quote: unknown; invoice: { id: string } }>(
        `${this.baseUrl}/${id}/approve`,
        {},
      )
      .pipe(
        map((res) => ({
          quote: this.mapFromBackend(res.quote),
          invoiceId: res.invoice?.id,
        })),
      );
  }

  reject(id: string): Observable<QuoteWithDetails> {
    return this.http
      .post<unknown>(`${this.baseUrl}/${id}/reject`, {})
      .pipe(map((b) => this.mapFromBackend(b)));
  }

  /**
   * Fetches the rendered quote PDF as a Blob. Mirrors
   * `InvoiceService.getInvoicePdfBlob` so the caller can `URL.createObjectURL`
   * the result and either open it in a new tab or trigger a download. The
   * blob carries the JWT via the HTTP interceptor — using a raw `<a href>`
   * to the SPA-relative `/api/quotes/:id/pdf` path 401s in a fresh tab.
   */
  getQuotePdfBlob(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/pdf`, { responseType: 'blob' });
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
        // Normalize to the FE lowercase enum (`service|part|labor|misc`).
        // BE stores `type` as free-form string; legacy rows can be uppercase
        // (`SERVICE`) which would miss the `invoicing.form.lineTypes.<type>`
        // i18n key and surface as a raw key in the UI (Sweep C-10).
        type: (typeof li.type === 'string' ? li.type.toLowerCase() : (li.type || 'misc')) as LineItemType,
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

  /**
   * Map a frontend CreateQuoteRequest / UpdateQuoteRequest to the strict
   * backend CreateQuoteDto / UpdateQuoteDto shape. The backend whitelists
   * its DTO via class-validator, so we MUST drop legacy fields like
   * `status`, `issueDate`, `currency`, `discountPercentage`, `unit`,
   * `totalPrice`, `taxable` — anything not in the DTO triggers a 400.
   *
   * @see opauto-backend/src/invoicing/dto/create-quote.dto.ts
   * @see opauto-backend/src/invoicing/dto/quote-line-item.dto.ts
   */
  private mapToBackend(f: Partial<CreateQuoteRequest | UpdateQuoteRequest>): any {
    const payload: any = {};
    if (f.customerId !== undefined) payload.customerId = f.customerId;
    if (f.carId !== undefined) payload.carId = f.carId;
    if (f.validUntil !== undefined) {
      payload.validUntil =
        f.validUntil instanceof Date ? f.validUntil.toISOString() : f.validUntil;
    }
    if (f.notes !== undefined) payload.notes = f.notes;
    if (f.lineItems !== undefined) {
      payload.lineItems = f.lineItems.map((li) => {
        const liAny = li as any;
        // tvaRate may live on the line itself (new contract) or be inferred
        // from the legacy `taxable` flag (old shape) — fall back to the
        // garage default of 19 when neither is set.
        const tvaRate =
          typeof liAny.tvaRate === 'number'
            ? liAny.tvaRate
            : liAny.taxable === false
            ? 0
            : DEFAULT_TVA_RATE;
        const out: any = {
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          tvaRate,
        };
        if (li.type !== undefined) out.type = li.type;
        if (li.partId !== undefined) out.partId = li.partId;
        if (li.serviceCode !== undefined) out.serviceCode = li.serviceCode;
        if (li.mechanicId !== undefined) out.mechanicId = li.mechanicId;
        if (li.laborHours !== undefined) out.laborHours = li.laborHours;
        if (li.discountPercentage !== undefined)
          out.discountPct = li.discountPercentage;
        return out;
      });
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
