import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export type RevenuePeriod = 'today' | 'week' | 'month' | 'ytd';

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
 * Compute [from, to) for a named period in the server's local timezone.
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
    case 'week':
      // Rolling 7 days ending now.
      from.setDate(from.getDate() - 7);
      break;
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

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Date-only strings ("2026-02-01") parse as UTC midnight — natural for "starting on this day". */
function parseFromArg(s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid from date: ${s}`);
  return d;
}

/**
 * Date-only `to` advances to the next day's UTC midnight so the day is fully
 * included under the half-open `lt` interval used downstream. Full timestamps
 * pass through.
 */
function parseToArg(s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid to date: ${s}`);
  if (DATE_ONLY.test(s)) return new Date(d.getTime() + 24 * 60 * 60 * 1000);
  return d;
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
      'When both modes are supplied, `from`+`to` wins. When everything is omitted, defaults to "ytd".',
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
      let from: Date;
      let to: Date;
      let periodLabel: RevenueSummaryResult['period'];

      if (args.from || args.to) {
        if (!args.from || !args.to) {
          throw new Error(
            '`from` and `to` must be provided together. Either pass both or use `period` instead.',
          );
        }
        from = parseFromArg(args.from);
        to = parseToArg(args.to);
        if (from.getTime() >= to.getTime()) {
          throw new Error(
            `Invalid range: from (${args.from}) must be earlier than to (${args.to}).`,
          );
        }
        periodLabel = 'custom';
      } else {
        const period = args.period ?? 'ytd';
        const resolved = resolveRevenuePeriod(period);
        from = resolved.from;
        to = resolved.to;
        periodLabel = period;
      }

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
