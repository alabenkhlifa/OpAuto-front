import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  CreditNoteWithDetails,
  CreateCreditNoteRequest,
} from '../models/credit-note.model';
import { InvoiceLineItem, LineItemType } from '../models/invoice.model';

/**
 * Default Tunisian TVA rate when a credit note line doesn't carry an
 * explicit rate. Backend DTO requires `tvaRate` on every credit-note line.
 */
const DEFAULT_TVA_RATE = 19;

/**
 * CreditNoteService — thin HTTP wrapper around `/credit-notes`.
 * Backend already implements POST/GET endpoints (Phase 1.6).
 */
@Injectable({ providedIn: 'root' })
export class CreditNoteService {
  private http = inject(HttpClient);

  private readonly baseUrl = '/credit-notes';

  private creditNotesSubject = new BehaviorSubject<CreditNoteWithDetails[]>([]);
  public creditNotes$ = this.creditNotesSubject.asObservable();

  list(): Observable<CreditNoteWithDetails[]> {
    return this.http.get<unknown[]>(this.baseUrl).pipe(
      map((items) => items.map((b) => this.mapFromBackend(b))),
      tap((rows) => this.creditNotesSubject.next(rows)),
    );
  }

  get(id: string): Observable<CreditNoteWithDetails> {
    return this.http
      .get<unknown>(`${this.baseUrl}/${id}`)
      .pipe(map((b) => this.mapFromBackend(b)));
  }

  create(payload: CreateCreditNoteRequest): Observable<CreditNoteWithDetails> {
    return this.http
      .post<unknown>(this.baseUrl, this.mapToBackend(payload))
      .pipe(map((b) => this.mapFromBackend(b)));
  }

  /**
   * Strip legacy frontend fields (`unit`, `totalPrice`, `taxable`) and add the
   * backend-required `tvaRate`. Backend whitelists CreateCreditNoteDto +
   * CreditNoteLineItemDto; anything else trips a 400.
   *
   * @see opauto-backend/src/invoicing/dto/create-credit-note.dto.ts
   * @see opauto-backend/src/invoicing/dto/credit-note-line-item.dto.ts
   */
  private mapToBackend(f: CreateCreditNoteRequest): any {
    return {
      invoiceId: f.invoiceId,
      reason: f.reason,
      restockParts: f.restockParts,
      lineItems: f.lineItems.map((li) => {
        const liAny = li as any;
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
        // S-EDGE-013 (Sweep C-23) — per-line restock toggle. Forward only
        // when the caller has explicitly set it; the BE DTO defaults the
        // missing flag to the parent `restockParts` value.
        if ((li as any).restockPart !== undefined)
          out.restockPart = (li as any).restockPart;
        return out;
      }),
    };
  }

  pdfUrl(id: string): string {
    return `/credit-notes/${id}/pdf`;
  }

  /**
   * Fetches the rendered credit-note PDF as a Blob. Mirrors
   * `InvoiceService.getInvoicePdfBlob` so the caller can open it in a new
   * tab via `URL.createObjectURL` (the JWT rides on the interceptor — a
   * raw `<a href>` to the SPA-relative path would 401 in a fresh tab).
   */
  getCreditNotePdfBlob(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/pdf`, { responseType: 'blob' });
  }

  private mapFromBackend(b: any): CreditNoteWithDetails {
    return {
      id: b.id,
      creditNoteNumber: b.creditNoteNumber ?? b.number ?? '',
      invoiceId: b.invoiceId,
      reason: b.reason ?? '',
      total: b.total ?? 0,
      restockParts: b.restockParts ?? false,
      lockedAt: new Date(b.lockedAt ?? b.createdAt),
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
      createdAt: new Date(b.createdAt),
      updatedAt: new Date(b.updatedAt ?? b.createdAt),
      invoiceNumber: b.invoice?.invoiceNumber ?? '',
      customerName: b.invoice?.customer
        ? `${b.invoice.customer.firstName ?? ''} ${b.invoice.customer.lastName ?? b.invoice.customer.name ?? ''}`.trim()
        : '',
      carMake: b.invoice?.car?.make ?? '',
      carModel: b.invoice?.car?.model ?? '',
      licensePlate: b.invoice?.car?.licensePlate ?? '',
    };
  }
}
