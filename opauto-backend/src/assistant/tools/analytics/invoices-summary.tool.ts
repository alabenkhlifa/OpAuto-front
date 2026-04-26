import { AssistantBlastTier, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface InvoicesSummaryArgs {
  status?: InvoiceStatus;
  /** ISO date or timestamp; lower bound on invoice createdAt. */
  from?: string;
  /** ISO date or timestamp; upper bound on invoice createdAt (exclusive). */
  to?: string;
}

export interface InvoicesSummaryResult {
  count: number;
  totalSum: number;
  paidSum: number;
  outstandingSum: number;
}

const PAID_STATUSES: InvoiceStatus[] = [InvoiceStatus.PAID];
// Anything that's been issued but not fully paid counts as outstanding.
const OUTSTANDING_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

function parseDate(label: string, raw: string | undefined): Date | undefined {
  if (raw === undefined) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  return d;
}

/**
 * Aggregates invoices for the caller's garage. Returns count + sum-of-totals
 * across the matching set, plus side-totals for paid vs outstanding so the
 * model can phrase "X paid, Y outstanding" without a second call.
 */
export function buildGetInvoicesSummaryTool(
  prisma: PrismaService,
): ToolDefinition<InvoicesSummaryArgs, InvoicesSummaryResult> {
  return {
    name: 'get_invoices_summary',
    description:
      'Returns aggregate invoice numbers (count, total sum, paid sum, outstanding ' +
      'sum) for the garage, optionally filtered by status and a createdAt date ' +
      'range. Use for "how much have I billed", "what is outstanding", or status-' +
      'specific aggregates.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: Object.values(InvoiceStatus),
          description: 'Restrict the count + total sum to invoices of this status.',
        },
        from: {
          type: 'string',
          description: 'ISO date/timestamp lower bound on invoice createdAt (inclusive).',
        },
        to: {
          type: 'string',
          description: 'ISO date/timestamp upper bound on invoice createdAt (exclusive).',
        },
      },
      required: [],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: InvoicesSummaryArgs,
      ctx: AssistantUserContext,
    ): Promise<InvoicesSummaryResult> => {
      const from = parseDate('from', args.from);
      const to = parseDate('to', args.to);

      const createdAt: Prisma.DateTimeFilter | undefined =
        from || to ? { ...(from && { gte: from }), ...(to && { lt: to }) } : undefined;

      const baseWhere: Prisma.InvoiceWhereInput = {
        garageId: ctx.garageId,
        ...(args.status && { status: args.status }),
        ...(createdAt && { createdAt }),
      };

      // Paid/outstanding side totals always span the same date window but are
      // independent of the status filter — the user wants the absolute paid
      // and outstanding figures within the window for context.
      const paidWhere: Prisma.InvoiceWhereInput = {
        garageId: ctx.garageId,
        status: { in: PAID_STATUSES },
        ...(createdAt && { createdAt }),
      };
      const outstandingWhere: Prisma.InvoiceWhereInput = {
        garageId: ctx.garageId,
        status: { in: OUTSTANDING_STATUSES },
        ...(createdAt && { createdAt }),
      };

      const [main, paid, outstanding] = await Promise.all([
        prisma.invoice.aggregate({
          where: baseWhere,
          _sum: { total: true },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: paidWhere,
          _sum: { total: true },
        }),
        prisma.invoice.aggregate({
          where: outstandingWhere,
          _sum: { total: true },
        }),
      ]);

      return {
        count: main._count,
        totalSum: main._sum.total ?? 0,
        paidSum: paid._sum.total ?? 0,
        outstandingSum: outstanding._sum.total ?? 0,
      };
    },
  };
}
