import { AssistantBlastTier, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface ListInvoicesArgs {
  status?: InvoiceStatus;
  from?: string;
  to?: string;
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
      'are unpaid", "invoices this month", etc.',
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
          format: 'date-time',
          description: 'Lower bound on createdAt (inclusive), ISO 8601.',
        },
        to: {
          type: 'string',
          format: 'date-time',
          description: 'Upper bound on createdAt (inclusive), ISO 8601.',
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

      const rows = await prisma.invoice.findMany({
        where: where as never,
        orderBy: { createdAt: 'desc' },
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
