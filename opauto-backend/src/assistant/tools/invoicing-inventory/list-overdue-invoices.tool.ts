import { AssistantBlastTier, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface OverdueInvoiceItem {
  id: string;
  invoiceNumber: string;
  customerId: string;
  status: InvoiceStatus;
  total: number;
  dueDate: string;
  daysOverdue: number;
}

export interface ListOverdueInvoicesResult {
  invoices: OverdueInvoiceItem[];
  count: number;
  totalOutstanding: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ListOverdueInvoicesOrder =
  | 'most_overdue'
  | 'least_overdue'
  | 'highest_amount';

export interface ListOverdueInvoicesArgs {
  orderBy?: ListOverdueInvoicesOrder;
  limit?: number;
}

/**
 * Lists invoices whose dueDate has passed and which are not yet PAID or
 * CANCELLED. Computes daysOverdue server-side so the LLM doesn't have to.
 */
export function buildListOverdueInvoicesTool(
  prisma: PrismaService,
): ToolDefinition<ListOverdueInvoicesArgs, ListOverdueInvoicesResult> {
  return {
    name: 'list_overdue_invoices',
    description:
      "Lists the owner's invoices that are past due — dueDate before now() " +
      'AND status not PAID or CANCELLED. Each entry includes daysOverdue ' +
      '(integer days since dueDate). Use when the user asks "what invoices ' +
      'are overdue", "who owes me money", "late payments", etc. ' +
      'IMPORTANT — ORDERING: pass `orderBy: "most_overdue"` (default) for ' +
      '"most overdue / oldest unpaid"; `"least_overdue"` for "recently overdue"; ' +
      '`"highest_amount"` for "biggest debts first". Combine with `limit` for ' +
      '"top N overdue" requests.',
    parameters: {
      type: 'object',
      properties: {
        orderBy: {
          type: 'string',
          enum: ['most_overdue', 'least_overdue', 'highest_amount'],
          description:
            '"most_overdue" (default) sorts by oldest dueDate first; ' +
            '"least_overdue" sorts by most-recent dueDate first; ' +
            '"highest_amount" sorts by invoice total descending.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Max rows to return (1-100). Use for "top N overdue" requests.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: ListOverdueInvoicesArgs,
      ctx: AssistantUserContext,
    ): Promise<ListOverdueInvoicesResult> => {
      const now = new Date();
      const orderBy =
        args.orderBy === 'highest_amount'
          ? { total: 'desc' as const }
          : args.orderBy === 'least_overdue'
            ? { dueDate: 'desc' as const }
            : { dueDate: 'asc' as const };
      const rows = await prisma.invoice.findMany({
        where: {
          garageId: ctx.garageId,
          dueDate: { lt: now },
          status: { notIn: ['PAID', 'CANCELLED'] },
        },
        orderBy,
        ...(args.limit ? { take: args.limit } : {}),
        select: {
          id: true,
          invoiceNumber: true,
          customerId: true,
          status: true,
          total: true,
          dueDate: true,
        },
      });

      let totalOutstanding = 0;
      const invoices: OverdueInvoiceItem[] = rows
        .filter((r): r is typeof r & { dueDate: Date } => r.dueDate !== null)
        .map((row) => {
          const days = Math.max(
            0,
            Math.floor((now.getTime() - row.dueDate.getTime()) / MS_PER_DAY),
          );
          totalOutstanding += row.total;
          return {
            id: row.id,
            invoiceNumber: row.invoiceNumber,
            customerId: row.customerId,
            status: row.status,
            total: row.total,
            dueDate: row.dueDate.toISOString(),
            daysOverdue: days,
          };
        });

      return {
        invoices,
        count: invoices.length,
        totalOutstanding,
      };
    },
  };
}
