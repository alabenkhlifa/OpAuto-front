import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export type RevenuePeriod = 'today' | 'week' | 'month' | 'ytd';

export interface RevenueSummaryArgs {
  period: RevenuePeriod;
}

export interface RevenueSummaryResult {
  period: RevenuePeriod;
  from: string;
  to: string;
  totalRevenue: number;
  paidInvoiceCount: number;
  currency: 'TND';
}

/**
 * Compute [from, to) for a period in the server's local timezone.
 * `to` is exclusive — set to "now" so the current moment is always included.
 */
export function resolveRevenuePeriod(
  period: RevenuePeriod,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const to = new Date(now);
  const from = new Date(now);
  switch (period) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      // Rolling 7 days ending now (good enough for casual "this week" queries
      // and avoids week-start ambiguity across locales).
      from.setDate(from.getDate() - 7);
      break;
    }
    case 'month':
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'ytd':
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      break;
    default: {
      const exhaustive: never = period;
      throw new Error(`Unsupported period: ${exhaustive as string}`);
    }
  }
  return { from, to };
}

/**
 * Sums Invoice.total for paid invoices within the requested period, scoped to
 * the caller's garage. Uses paidAt as the time anchor so partial/overdue
 * invoices don't show up. Returns TND — Tunisia is the only supported market
 * for v1 (see UI/translation conventions).
 */
export function buildGetRevenueSummaryTool(
  prisma: PrismaService,
): ToolDefinition<RevenueSummaryArgs, RevenueSummaryResult> {
  return {
    name: 'get_revenue_summary',
    description:
      'Returns the total paid revenue and number of paid invoices for a fixed ' +
      'period: today, the last 7 days, the current calendar month, or year-to-date. ' +
      'Use when the user asks "how much did I make today/this week/this month/this year".',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'ytd'],
          description: 'Reporting window. "week" is rolling 7 days; "month" is current calendar month.',
        },
      },
      required: ['period'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: RevenueSummaryArgs,
      ctx: AssistantUserContext,
    ): Promise<RevenueSummaryResult> => {
      const { from, to } = resolveRevenuePeriod(args.period);
      const aggregate = await prisma.invoice.aggregate({
        where: {
          garageId: ctx.garageId,
          status: 'PAID',
          paidAt: { gte: from, lt: to },
        },
        _sum: { total: true },
        _count: true,
      });

      return {
        period: args.period,
        from: from.toISOString(),
        to: to.toISOString(),
        totalRevenue: aggregate._sum.total ?? 0,
        paidInvoiceCount: aggregate._count,
        currency: 'TND',
      };
    },
  };
}
