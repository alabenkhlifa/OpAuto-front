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
      .post<unknown>(this.baseUrl, payload)
      .pipe(map((b) => this.mapFromBackend(b)));
  }

  pdfUrl(id: string): string {
    return `/credit-notes/${id}/pdf`;
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
