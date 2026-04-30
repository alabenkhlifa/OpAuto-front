/**
 * IssueInvoiceDto — body payload for `POST /invoices/:id/issue`.
 *
 * Currently empty: issuing takes no input — the invoice's stored data
 * (customer, line items, dueDate) is what gets locked in. The DTO exists
 * as a placeholder so future phases can add optional fields (e.g. an
 * override `dueDate`, a "send email immediately" flag, etc.) without
 * breaking the public route shape.
 */
export class IssueInvoiceDto {}
