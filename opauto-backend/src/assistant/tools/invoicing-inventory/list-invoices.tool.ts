import { AssistantBlastTier, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export type ListInvoicesOrder = 'newest' | 'oldest';

export interface ListInvoicesArgs {
  status?: InvoiceStatus;
  from?: string;
  to?: string;
  orderBy?: ListInvoicesOrder;
  limit?: number;
}

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  customerId: string;
  status: InvoiceStatus;
  total: number;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ListInvoicesResult {
  invoices: InvoiceListItem[];
  count: number;
}

const INVOICE_STATUSES: InvoiceStatus[] = [
  'DRAFT',
  'SENT',
  'PAID',
  'PARTIALLY_PAID',
  'OVERDUE',
  'CANCELLED',
];

/**
 * Lists invoices for the caller's garage. Optional status filter (matches the
 * Prisma InvoiceStatus enum) and optional createdAt date-range bounds in ISO
 * format (inclusive).
 */
export function buildListInvoicesTool(
  prisma: PrismaService,
): ToolDefinition<ListInvoicesArgs, ListInvoicesResult> {
  return {
    name: 'list_invoices',
    description:
      "Lists invoices for the owner's garage. Optionally filter by status " +
      '(DRAFT, SENT, PAID, PARTIALLY_PAID, OVERDUE, CANCELLED) and by ' +
      'createdAt date range (from/to ISO 8601). Returns a projected list ' +
      'with id, invoiceNumber, customerId, status, total, dueDate, paidAt, ' +
      'createdAt. Use when the user asks "show invoices", "what invoices ' +
      'are unpaid", "invoices this month", etc. ' +
      'IMPORTANT — ORDERING: pass `orderBy: "oldest"` when the user asks for ' +
      '"first", "earliest", "initial", "from the start of the year/month", or ' +
      'any phrasing that implies chronologically earliest. Pass ' +
      '`orderBy: "newest"` (default) for "latest", "most recent", "last N", ' +
      '"recent invoices". Combine with `limit` to cap the response, e.g. ' +
      '"first 3 invoices of this year" → ' +
      '{from: "2026-01-01", orderBy: "oldest", limit: 3}.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: INVOICE_STATUSES,
          description: 'Filter by invoice status.',
        },
        from: {
          type: 'string',
          description:
            'Lower bound on createdAt (inclusive). Accepts YYYY-MM-DD or full ISO 8601.',
        },
        to: {
          type: 'string',
          description:
            'Upper bound on createdAt (inclusive). Accepts YYYY-MM-DD or full ISO 8601.',
        },
        orderBy: {
          type: 'string',
          enum: ['newest', 'oldest'],
          description:
            'Sort by createdAt. "newest" (default) returns most-recent first; ' +
            '"oldest" returns earliest first — use this for "first/earliest" requests.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description:
            'Maximum number of invoices to return (1-100). Use with orderBy to ' +
            'answer "first/last N invoices" questions without paging through all rows.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: ListInvoicesArgs,
      ctx: AssistantUserContext,
    ): Promise<ListInvoicesResult> => {
      const where: Record<string, unknown> = { garageId: ctx.garageId };
      if (args.status) {
        where.status = args.status;
      }
      if (args.from || args.to) {
        const created: Record<string, Date> = {};
        if (args.from) created.gte = new Date(args.from);
        if (args.to) created.lte = new Date(args.to);
        where.createdAt = created;
      }

      const direction = args.orderBy === 'oldest' ? 'asc' : 'desc';
      const rows = await prisma.invoice.findMany({
        where: where as never,
        orderBy: { createdAt: direction },
        ...(args.limit ? { take: args.limit } : {}),
        select: {
          id: true,
          invoiceNumber: true,
          customerId: true,
          status: true,
          total: true,
          dueDate: true,
          paidAt: true,
          createdAt: true,
        },
      });

      const invoices: InvoiceListItem[] = rows.map((row) => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        customerId: row.customerId,
        status: row.status,
        total: row.total,
        dueDate: row.dueDate ? row.dueDate.toISOString() : null,
        paidAt: row.paidAt ? row.paidAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      }));

      return { invoices, count: invoices.length };
    },
  };
}
