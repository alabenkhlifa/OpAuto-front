import { InvoiceLineItem } from './invoice.model';

/**
 * Quote (Devis) — same shape as Invoice minus fiscal stamp,
 * with a `validUntil` deadline and a richer status set.
 *
 * Backend resource: `/quotes` (Phase 2.3 backend already implemented).
 */
export type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  carId: string;
  status: QuoteStatus;
  issueDate: Date;
  validUntil: Date;
  currency: string;
  subtotal: number;
  taxAmount: number;
  discountPercentage: number;
  discountAmount: number;
  totalAmount: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  convertedToInvoiceId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteWithDetails extends Quote {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  carMake: string;
  carModel: string;
  carYear: number;
  licensePlate: string;
}

/**
 * Quote line items on the wire carry an optional per-line `tvaRate` so
 * the backend can recompute totals against the right VAT slice. The base
 * `InvoiceLineItem` type is shared with invoices and doesn't include it,
 * so we widen the request line shape here.
 */
export type CreateQuoteRequest = Omit<
  Quote,
  | 'id'
  | 'quoteNumber'
  | 'createdAt'
  | 'updatedAt'
  | 'subtotal'
  | 'taxAmount'
  | 'discountAmount'
  | 'totalAmount'
  | 'convertedToInvoiceId'
  | 'lineItems'
> & {
  lineItems: Array<InvoiceLineItem & { tvaRate?: number }>;
};

export type UpdateQuoteRequest = Partial<
  Omit<Quote, 'id' | 'quoteNumber' | 'createdAt' | 'updatedAt' | 'lineItems'>
> & {
  lineItems?: Array<InvoiceLineItem & { tvaRate?: number }>;
};
