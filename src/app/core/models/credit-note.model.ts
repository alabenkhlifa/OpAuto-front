import { InvoiceLineItem } from './invoice.model';

/**
 * Credit Note (Avoir) — issued against an existing invoice.
 *
 * Backend resource: `/credit-notes` (Phase 1.6 backend already implemented).
 */
export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  invoiceId: string;
  reason: string;
  total: number;
  restockParts: boolean;
  lineItems: InvoiceLineItem[];
  lockedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditNoteWithDetails extends CreditNote {
  invoiceNumber: string;
  customerName: string;
  carMake: string;
  carModel: string;
  licensePlate: string;
}

export interface CreateCreditNoteRequest {
  invoiceId: string;
  reason: string;
  restockParts: boolean;
  /** Subset of source invoice line items (caller picks which to credit). */
  lineItems: Array<Omit<InvoiceLineItem, 'id'>>;
}
