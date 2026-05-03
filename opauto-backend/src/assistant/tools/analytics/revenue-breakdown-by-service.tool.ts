import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';
import {
  RevenuePeriod,
  resolveRevenueWindow,
} from './revenue-period.util';

export interface RevenueBreakdownByServiceArgs {
  period?: RevenuePeriod;
  from?: string;
  to?: string;
}

export interface RevenueBreakdownBucket {
  category: string;
  totalRevenue: number;
  lineItemCount: number;
  /** 0–100, rounded to 2 decimal places. Sums to 100 across the breakdown (or all-zero when totalRevenue is 0). */
  percentage: number;
}

export interface RevenueBreakdownByServiceResult {
  period: RevenuePeriod | 'custom';
  from: string;
  to: string;
  currency: 'TND';
  /**
   * Sum of every line-item total across paid invoices in the window. Note
   * this is a sum of *line totals*, not a sum of `Invoice.total` — keeps the
   * breakdown internally consistent.
   */
  totalRevenue: number;
  breakdown: RevenueBreakdownBucket[];
}

/** Bucket label for parts lines that don't resolve to a service catalog category. */
const PARTS_BUCKET = 'Parts';
/** Bucket label for labor-typed lines without a service catalog match. */
const LABOR_BUCKET = 'Labor';
/** Catch-all bucket for line items missing both a serviceCode and a recognisable type. */
const OTHER_BUCKET = 'Other';

/**
 * Round to 2 decimal places without floating-point drift sneaking past us
 * (`(0.1 + 0.2).toFixed(2)` style cleanup).
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Returns paid revenue grouped by service category for any window. The
 * fallback bucketing rules are:
 *
 *   - line.serviceCode → ServiceCatalog row with non-null `category` →
 *     bucket = catalog.category.
 *   - line.serviceCode → ServiceCatalog row with null `category` →
 *     bucket = catalog.name (still a meaningful label for the user).
 *   - line.type === 'part' OR line.partId set → bucket = "Parts".
 *   - line.type === 'labor' → bucket = "Labor".
 *   - everything else → bucket = "Other".
 *
 * Tenant isolation: invoices are filtered by `ctx.garageId`, and the
 * ServiceCatalog lookup is also scoped by garageId, so a stray code that
 * collides with another tenant's catalog cannot leak categories across
 * garages.
 */
export function buildGetRevenueBreakdownByServiceTool(
  prisma: PrismaService,
): ToolDefinition<
  RevenueBreakdownByServiceArgs,
  RevenueBreakdownByServiceResult
> {
  return {
    name: 'get_revenue_breakdown_by_service',
    description:
      'Returns paid revenue grouped by service category for any window. ' +
      "Use this whenever the user asks to 'break down', 'segment', 'split', or 'group' revenue by service / service type / category, " +
      "or compares categories like 'engine vs brakes'. Window args mirror get_revenue_summary: " +
      "(a) `period` — one of 'today', 'week', 'month', 'ytd'; " +
      "(b) `from`+`to` — any ISO date range (YYYY-MM-DD or full ISO 8601). " +
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
      args: RevenueBreakdownByServiceArgs,
      ctx: AssistantUserContext,
    ): Promise<RevenueBreakdownByServiceResult> => {
      const { from, to, periodLabel } = resolveRevenueWindow(args);

      // Pull every paid-invoice line-item in the window. Line-item volume per
      // garage is tiny (~hundreds at most), so an in-memory group-by beats
      // raw SQL on maintainability.
      const invoices = await prisma.invoice.findMany({
        where: {
          garageId: ctx.garageId,
          status: 'PAID',
          paidAt: { gte: from, lt: to },
        },
        select: {
          lineItems: {
            select: {
              total: true,
              type: true,
              partId: true,
              serviceCode: true,
            },
          },
        },
      });

      const lineItems = invoices.flatMap((inv) => inv.lineItems);

      const baseResult: RevenueBreakdownByServiceResult = {
        period: periodLabel,
        from: from.toISOString(),
        to: to.toISOString(),
        currency: 'TND',
        totalRevenue: 0,
        breakdown: [],
      };

      if (lineItems.length === 0) {
        return baseResult;
      }

      // Resolve service catalog rows for every code we see, in a single
      // garage-scoped query. Avoids N+1 lookups and tenant leakage.
      const codes = Array.from(
        new Set(
          lineItems
            .map((li) => li.serviceCode)
            .filter((c): c is string => typeof c === 'string' && c.length > 0),
        ),
      );

      const catalogRows = codes.length
        ? await prisma.serviceCatalog.findMany({
            where: { garageId: ctx.garageId, code: { in: codes } },
            select: { code: true, name: true, category: true },
          })
        : [];

      const catalogByCode = new Map<
        string,
        { name: string; category: string | null }
      >();
      for (const row of catalogRows) {
        catalogByCode.set(row.code, { name: row.name, category: row.category });
      }

      const buckets = new Map<
        string,
        { category: string; totalRevenue: number; lineItemCount: number }
      >();

      let totalRevenue = 0;

      for (const li of lineItems) {
        const lineTotal = typeof li.total === 'number' ? li.total : 0;
        totalRevenue += lineTotal;

        let bucketLabel: string;
        if (li.serviceCode && catalogByCode.has(li.serviceCode)) {
          const row = catalogByCode.get(li.serviceCode)!;
          bucketLabel = row.category && row.category.length > 0
            ? row.category
            : row.name;
        } else if (li.type === 'part' || li.partId) {
          bucketLabel = PARTS_BUCKET;
        } else if (li.type === 'labor') {
          bucketLabel = LABOR_BUCKET;
        } else {
          bucketLabel = OTHER_BUCKET;
        }

        const existing = buckets.get(bucketLabel);
        if (existing) {
          existing.totalRevenue += lineTotal;
          existing.lineItemCount += 1;
        } else {
          buckets.set(bucketLabel, {
            category: bucketLabel,
            totalRevenue: lineTotal,
            lineItemCount: 1,
          });
        }
      }

      const totalRounded = round2(totalRevenue);

      // Build percentages; defend against an all-zero sum (e.g. every line
      // item happens to be 0 TND) so we don't divide by zero.
      const breakdown: RevenueBreakdownBucket[] = Array.from(buckets.values())
        .map((b) => ({
          category: b.category,
          totalRevenue: round2(b.totalRevenue),
          lineItemCount: b.lineItemCount,
          percentage:
            totalRevenue > 0 ? round2((b.totalRevenue / totalRevenue) * 100) : 0,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Fix any rounding drift so percentages sum to exactly 100. Apply the
      // delta to the largest bucket (index 0 after sort) — keeps the visible
      // ordering stable.
      if (breakdown.length > 0 && totalRevenue > 0) {
        const sumPct = breakdown.reduce((acc, b) => acc + b.percentage, 0);
        const drift = round2(100 - sumPct);
        if (drift !== 0) {
          breakdown[0].percentage = round2(breakdown[0].percentage + drift);
        }
      }

      return {
        ...baseResult,
        totalRevenue: totalRounded,
        breakdown,
      };
    },
  };
}
