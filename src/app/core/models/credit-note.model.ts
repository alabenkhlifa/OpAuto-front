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
  /**
   * Parent-level "default for new lines" + aggregate flag. Each line in
   * `lineItems` may override via its own `restockPart` (S-EDGE-013, Sweep
   * C-23). The BE persists `CreditNote.restockParts = true` iff at least
   * one line ends up restocking.
   */
  restockParts: boolean;
  reason: string;
  /**
   * Subset of source invoice line items (caller picks which to credit).
   * `tvaRate` is optional here — when omitted the service maps from the
   * legacy `taxable` flag, falling back to the garage default (19).
   * `restockPart` is per-line and optional — when omitted the BE inherits
   * from the parent `restockParts` flag (S-EDGE-013, Sweep C-23).
   */
  lineItems: Array<
    Omit<InvoiceLineItem, 'id'> & { tvaRate?: number; restockPart?: boolean }
  >;
}
