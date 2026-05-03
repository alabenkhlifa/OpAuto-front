import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';
import {
  RevenuePeriod,
  resolveRevenueWindow,
} from './revenue-period.util';

// Re-exported so existing call sites (specs, other tools) keep working.
export {
  RevenuePeriod,
  resolveRevenuePeriod,
  parseFromArg,
  parseToArg,
  resolveRevenueWindow,
} from './revenue-period.util';

export interface RevenueSummaryArgs {
  /**
   * Named shortcut. Used when no `from`/`to` is supplied. Defaults to 'ytd'
   * if everything is omitted.
   */
  period?: RevenuePeriod;
  /**
   * Custom range start. ISO 8601 (YYYY-MM-DD or full timestamp). Inclusive.
   * If a `from` is supplied, `to` is required.
   */
  from?: string;
  /**
   * Custom range end. ISO 8601 (YYYY-MM-DD or full timestamp). Inclusive of
   * the whole day for date-only inputs. If a `to` is supplied, `from` is
   * required.
   */
  to?: string;
}

export interface RevenueSummaryResult {
  /** Echoed back so the LLM can confirm the actual window used. */
  period: RevenuePeriod | 'custom';
  from: string;
  to: string;
  totalRevenue: number;
  paidInvoiceCount: number;
  currency: 'TND';
}

/**
 * Sums Invoice.total for paid invoices within the requested window, scoped
 * to the caller's garage. Uses paidAt as the time anchor so partial/overdue
 * invoices don't show up. Returns TND.
 */
export function buildGetRevenueSummaryTool(
  prisma: PrismaService,
): ToolDefinition<RevenueSummaryArgs, RevenueSummaryResult> {
  return {
    name: 'get_revenue_summary',
    description:
      'Returns the total paid revenue and number of paid invoices for any window. ' +
      'Two ways to specify the window: ' +
      "(a) `period` — one of 'today', 'week' (rolling 7 days), 'month' (current calendar month), 'ytd'; " +
      '(b) `from`+`to` — any ISO date range (YYYY-MM-DD or full ISO 8601). ' +
      'Use the custom range whenever the user asks for something the named periods do not cover, e.g. ' +
      '"last 3 months", "Q1", "since March", "between Jan 15 and Feb 28", "last 90 days". For "last 3 months" ' +
      'pass from = today minus 90 days, to = today (both YYYY-MM-DD). ' +
      'When both modes are supplied, `from`+`to` wins. When everything is omitted, defaults to "ytd". ' +
      'For breakdowns / segmentation by service type or category, use `get_revenue_breakdown_by_service` instead.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'ytd'],
          description:
            "Named shortcut. 'week' is rolling 7 days; 'month' is current calendar month.",
        },
        from: {
          type: 'string',
          description:
            'Custom range start. YYYY-MM-DD or full ISO 8601. Required if `to` is provided.',
        },
        to: {
          type: 'string',
          description:
            'Custom range end (inclusive of the whole day for date-only inputs). YYYY-MM-DD or full ISO 8601. Required if `from` is provided.',
        },
      },
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: RevenueSummaryArgs,
      ctx: AssistantUserContext,
    ): Promise<RevenueSummaryResult> => {
      const { from, to, periodLabel } = resolveRevenueWindow(args);

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
        period: periodLabel,
        from: from.toISOString(),
        to: to.toISOString(),
        totalRevenue: aggregate._sum.total ?? 0,
        paidInvoiceCount: aggregate._count,
        currency: 'TND',
      };
    },
  };
}
