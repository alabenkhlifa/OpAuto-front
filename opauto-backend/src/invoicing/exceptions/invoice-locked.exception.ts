import { HttpException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';

/** HTTP 423 Locked — not exposed by NestJS's `HttpStatus` enum, so we
 *  define it here and reference it by name. */
const HTTP_LOCKED = 423;

/**
 * Thrown when a caller attempts to mutate a locked (issued) invoice's
 * fiscal fields — line items, totals, discount, due date, customer/car.
 *
 * Maps to HTTP 423 Locked. The status code is intentional: 400 reads
 * like a validation error, 409 like a concurrency conflict, but the
 * resource here is genuinely locked by fiscal rules. 423 communicates
 * that intent to API clients without requiring custom error codes.
 *
 * Phase 1 — Task 1.4. Aligns with the Tunisian fiscal requirement
 * that issued invoices be immutable; corrections happen via credit
 * notes (Task 1.6), not edits.
 */
export class InvoiceLockedException extends HttpException {
  constructor(invoiceNumber: string, status: InvoiceStatus) {
    super(
      `Invoice ${invoiceNumber} is locked (status: ${status})`,
      HTTP_LOCKED,
    );
  }
}
