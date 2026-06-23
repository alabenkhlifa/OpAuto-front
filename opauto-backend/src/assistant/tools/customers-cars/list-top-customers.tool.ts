import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AssistantUserContext,
  ToolDefinition,
} from '../../types';

export interface ListTopCustomersArgs {
  by: 'revenue' | 'visit_count';
  from?: string;
  to?: string;
  limit?: number;
}

export interface TopCustomerEntry {
  id: string;
  displayName: string;
  phone: string;
  email: string | null;
  totalSpent: number;
  visitCount: number;
  loyaltyTier: string | null;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function normaliseDateBound(value: string | undefined, edge: 'from' | 'to'): Date | undefined {
  if (!value) return undefined;
  if (DATE_ONLY_RE.test(value)) {
    return new Date(
      edge === 'from' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`,
    );
  }
  return new Date(value);
}

export function createListTopCustomersTool(deps: {
  prisma: PrismaService;
}): ToolDefinition<ListTopCustomersArgs, TopCustomerEntry[]> {
  return {
    name: 'list_top_customers',
    description:
      'List top customers in this garage, ranked either by total revenue or by number of visits. Owner-only (revenue data). ' +
      'For historical windows like "in 1990", "last year", or "Q1 2026", pass explicit from/to dates. Date-bounded revenue uses paid invoices in that date range; if none exist, return an empty list.',
    parameters: {
      type: 'object',
      properties: {
        by: {
          type: 'string',
          enum: ['revenue', 'visit_count'],
          description:
            "Ranking criterion: 'revenue' sorts by totalSpent desc, 'visit_count' sorts by visitCount desc.",
        },
        from: {
          type: 'string',
          description:
            'Optional lower bound for date-bounded revenue ranking. Accepts YYYY-MM-DD or ISO 8601.',
        },
        to: {
          type: 'string',
          description:
            'Optional upper bound for date-bounded revenue ranking. Accepts YYYY-MM-DD or ISO 8601.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_LIMIT,
          description: `Max number of customers (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}).`,
        },
      },
      required: ['by'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: ListTopCustomersArgs,
      ctx: AssistantUserContext,
    ): Promise<TopCustomerEntry[]> => {
      const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      if (args.by === 'revenue' && (args.from || args.to)) {
        const paidAt: Record<string, Date> = {};
        const from = normaliseDateBound(args.from, 'from');
        const to = normaliseDateBound(args.to, 'to');
        if (from) paidAt.gte = from;
        if (to) paidAt.lte = to;

        const invoices = await deps.prisma.invoice.findMany({
          where: {
            garageId: ctx.garageId,
            status: 'PAID',
            ...(Object.keys(paidAt).length > 0 ? { paidAt } : {}),
          },
          select: {
            total: true,
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
                visitCount: true,
                loyaltyTier: true,
              },
            },
          },
        });

        const totals = new Map<string, TopCustomerEntry>();
        for (const invoice of invoices) {
          const c = invoice.customer;
          const id = c.id;
          const current = totals.get(id);
          if (current) {
            current.totalSpent += invoice.total ?? 0;
          } else {
            totals.set(id, {
              id,
              displayName: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
              phone: c.phone,
              email: c.email ?? null,
              totalSpent: invoice.total ?? 0,
              visitCount: c.visitCount ?? 0,
              loyaltyTier: c.loyaltyTier ?? null,
            });
          }
        }

        return [...totals.values()]
          .sort((a, b) => b.totalSpent - a.totalSpent)
          .slice(0, limit);
      }

      const orderBy =
        args.by === 'revenue'
          ? { totalSpent: 'desc' as const }
          : { visitCount: 'desc' as const };

      const customers = await deps.prisma.customer.findMany({
        where: { garageId: ctx.garageId },
        orderBy,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          totalSpent: true,
          visitCount: true,
          loyaltyTier: true,
        },
      });

      return customers.map((c) => ({
        id: c.id,
        displayName: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
        phone: c.phone,
        email: c.email ?? null,
        totalSpent: c.totalSpent ?? 0,
        visitCount: c.visitCount ?? 0,
        loyaltyTier: c.loyaltyTier ?? null,
      }));
    },
  };
}
