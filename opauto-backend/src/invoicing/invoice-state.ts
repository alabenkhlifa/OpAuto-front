import { BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';

/**
 * Invoice state machine — pure module, no NestJS DI.
 *
 * Defines the legal `from → to` transitions for an Invoice. Any change
 * outside this table must be rejected by the service layer to keep the
 * fiscal trail consistent (no "un-issuing" a sent invoice, no skipping
 * states, no reviving terminal ones).
 *
 * The schema's `InvoiceStatus` enum currently defines:
 *   DRAFT, SENT, PAID, PARTIALLY_PAID, OVERDUE, CANCELLED
 *
 * NOTE: A `VIEWED` state was discussed in the plan but is not yet in
 * the Prisma enum — when it is added (Phase 4 public links), extend the
 * `ALLOWED_TRANSITIONS` map and the `markViewed` service method.
 *
 * Terminal-ish states (PAID, CANCELLED, OVERDUE) cannot transition out
 * via this service. PAID can only be reversed by issuing a credit note
 * (Task 1.6). OVERDUE flips automatically to PARTIALLY_PAID/PAID once
 * the customer settles — that's modeled as the implicit transition from
 * OVERDUE below.
 */

/**
 * Allowed transitions: `from → set(to)`.
 *
 * Keep this as a plain const map (not a Set) so it serializes cleanly
 * for tests and admin tooling.
 */
export const ALLOWED_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'OVERDUE'],
  OVERDUE: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  PAID: [], // terminal — only credit notes can offset
  CANCELLED: [], // terminal
};

export function canTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  if (from === to) return true; // idempotent re-set is a no-op, not an error
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}

export function assertCanTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(
      `Invalid invoice status transition: ${from} → ${to}`,
    );
  }
}

/**
 * An invoice is "locked" once it leaves DRAFT. After that, line items,
 * totals, customer/car, and dueDate become immutable — only `notes`
 * and the `status` (via state machine) may change.
 */
export function isLocked(status: InvoiceStatus): boolean {
  return status !== 'DRAFT';
}
