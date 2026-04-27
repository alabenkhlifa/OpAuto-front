import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface ListReturningCustomersArgs {
  /** Inclusive ISO date (YYYY-MM-DD) lower bound on visit completionDate. */
  from: string;
  /** Inclusive ISO date (YYYY-MM-DD) upper bound on visit completionDate. */
  to: string;
  /** Minimum number of completed visits in the window (default 2). */
  minVisits?: number;
  /** Cap on rows returned, ordered by visit count desc (default 50). */
  limit?: number;
}

export interface ReturningCustomerEntry {
  customerId: string;
  displayName: string;
  phone: string;
  email: string | null;
  visitsInWindow: number;
  totalSpent: number;
  loyaltyTier: string | null;
}

export interface ListReturningCustomersResult {
  from: string;
  to: string;
  minVisits: number;
  count: number;
  customers: ReturningCustomerEntry[];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseFrom(s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid from date: ${s}`);
  return d;
}
function parseTo(s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid to date: ${s}`);
  if (DATE_ONLY.test(s)) return new Date(d.getTime() + 24 * 60 * 60 * 1000);
  return d;
}

/**
 * Counts COMPLETED maintenance jobs per customer within a date window
 * (joining via Car), filters those with at least `minVisits`, and returns
 * them ordered by visit count desc. Answers questions like "how many
 * customers have returned at least twice in the last 3 months".
 */
export function createListReturningCustomersTool(deps: {
  prisma: PrismaService;
}): ToolDefinition<ListReturningCustomersArgs, ListReturningCustomersResult> {
  return {
    name: 'list_returning_customers',
    description:
      'List customers who returned for at least N completed maintenance visits within a date window. ' +
      'Use for "how many customers came back ≥ N times in the last X months", "returning customers", ' +
      '"loyal customers in window". Pass `from` and `to` as YYYY-MM-DD relative to TODAY ' +
      '(e.g. "last 3 months" → from = today − 90 days, to = today). Default `minVisits` is 2.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['from', 'to'],
      properties: {
        from: {
          type: 'string',
          description: 'Window start (inclusive). YYYY-MM-DD or ISO 8601.',
        },
        to: {
          type: 'string',
          description: 'Window end (inclusive of full day for date-only inputs). YYYY-MM-DD or ISO 8601.',
        },
        minVisits: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Minimum completed visits in the window per customer (default 2).',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_LIMIT,
          description: `Max rows returned (default ${DEFAULT_LIMIT}).`,
        },
      },
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: ListReturningCustomersArgs,
      ctx: AssistantUserContext,
    ): Promise<ListReturningCustomersResult> => {
      const from = parseFrom(args.from);
      const to = parseTo(args.to);
      if (from.getTime() >= to.getTime()) {
        throw new Error(`Invalid range: from (${args.from}) must be earlier than to (${args.to}).`);
      }
      const minVisits = Math.max(1, args.minVisits ?? 2);
      const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

      // Pull every completed job in window for this garage with the customerId
      // resolved through the car relation. groupBy on Car.customerId would be
      // cleaner but Prisma's groupBy can't traverse relations directly, so we
      // do the aggregation in memory — under our seeded scale it's trivial.
      const jobs = await deps.prisma.maintenanceJob.findMany({
        where: {
          garageId: ctx.garageId,
          status: 'COMPLETED',
          completionDate: { gte: from, lt: to },
        },
        select: { car: { select: { customerId: true } } },
      });

      const counts = new Map<string, number>();
      for (const j of jobs) {
        const cid = j.car?.customerId;
        if (!cid) continue;
        counts.set(cid, (counts.get(cid) ?? 0) + 1);
      }

      const matchingIds = [...counts.entries()]
        .filter(([, n]) => n >= minVisits)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([id]) => id);

      const customers = matchingIds.length
        ? await deps.prisma.customer.findMany({
            where: { garageId: ctx.garageId, id: { in: matchingIds } },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              totalSpent: true,
              loyaltyTier: true,
            },
          })
        : [];

      const byId = new Map(customers.map((c) => [c.id, c]));
      const entries: ReturningCustomerEntry[] = matchingIds
        .map((id) => {
          const c = byId.get(id);
          if (!c) return null;
          return {
            customerId: c.id,
            displayName: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
            phone: c.phone,
            email: c.email ?? null,
            visitsInWindow: counts.get(id)!,
            totalSpent: c.totalSpent ?? 0,
            loyaltyTier: c.loyaltyTier ?? null,
          };
        })
        .filter((x): x is ReturningCustomerEntry => x !== null);

      return {
        from: from.toISOString(),
        to: to.toISOString(),
        minVisits,
        count: entries.length,
        customers: entries,
      };
    },
  };
}
