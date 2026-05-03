/**
 * Shared helpers for analytics tools that aggregate over a paid-revenue
 * window. Lifted from `revenue-summary.tool.ts` so additional tools (e.g.
 * `get_revenue_breakdown_by_service`) can reuse the exact same window
 * semantics without duplicating the parsing rules.
 */
export type RevenuePeriod = 'today' | 'week' | 'month' | 'ytd';

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
export function parseFromArg(s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid from date: ${s}`);
  return d;
}

/**
 * Date-only `to` advances to the next day's UTC midnight so the day is fully
 * included under the half-open `lt` interval used downstream. Full timestamps
 * pass through.
 */
export function parseToArg(s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid to date: ${s}`);
  if (DATE_ONLY.test(s)) return new Date(d.getTime() + 24 * 60 * 60 * 1000);
  return d;
}

export interface ResolvedWindow {
  from: Date;
  to: Date;
  /** Echoed back to the caller so the LLM can confirm the window used. */
  periodLabel: RevenuePeriod | 'custom';
}

/**
 * Centralised arg → window resolution shared by every tool that aggregates
 * paid revenue over a time range. Throws on partial / inverted ranges with
 * the same error wording the LLM has learned from `get_revenue_summary`,
 * so error-recovery prompts behave identically across tools.
 */
export function resolveRevenueWindow(args: {
  period?: RevenuePeriod;
  from?: string;
  to?: string;
}): ResolvedWindow {
  if (args.from || args.to) {
    if (!args.from || !args.to) {
      throw new Error(
        '`from` and `to` must be provided together. Either pass both or use `period` instead.',
      );
    }
    const from = parseFromArg(args.from);
    const to = parseToArg(args.to);
    if (from.getTime() >= to.getTime()) {
      throw new Error(
        `Invalid range: from (${args.from}) must be earlier than to (${args.to}).`,
      );
    }
    return { from, to, periodLabel: 'custom' };
  }

  const period = args.period ?? 'ytd';
  const resolved = resolveRevenuePeriod(period);
  return { from: resolved.from, to: resolved.to, periodLabel: period };
}
