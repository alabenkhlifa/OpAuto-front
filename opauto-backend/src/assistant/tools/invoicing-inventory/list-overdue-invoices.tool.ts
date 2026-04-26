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

/**
 * Lists invoices whose dueDate has passed and which are not yet PAID or
 * CANCELLED. Computes daysOverdue server-side so the LLM doesn't have to.
 */
export function buildListOverdueInvoicesTool(
  prisma: PrismaService,
): ToolDefinition<Record<string, never>, ListOverdueInvoicesResult> {
  return {
    name: 'list_overdue_invoices',
    description:
      "Lists the owner's invoices that are past due — dueDate before now() " +
      'AND status not PAID or CANCELLED. Each entry includes daysOverdue ' +
      '(integer days since dueDate). Use when the user asks "what invoices ' +
      'are overdue", "who owes me money", "late payments", etc.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      _args: Record<string, never>,
      ctx: AssistantUserContext,
    ): Promise<ListOverdueInvoicesResult> => {
      const now = new Date();
      const rows = await prisma.invoice.findMany({
        where: {
          garageId: ctx.garageId,
          dueDate: { lt: now },
          status: { notIn: ['PAID', 'CANCELLED'] },
        },
        orderBy: { dueDate: 'asc' },
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
