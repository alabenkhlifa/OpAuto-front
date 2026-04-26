import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AssistantUserContext,
  ToolDefinition,
} from '../../types';

export interface ListTopCustomersArgs {
  by: 'revenue' | 'visit_count';
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

export function createListTopCustomersTool(deps: {
  prisma: PrismaService;
}): ToolDefinition<ListTopCustomersArgs, TopCustomerEntry[]> {
  return {
    name: 'list_top_customers',
    description:
      'List top customers in this garage, ranked either by total revenue (totalSpent) or by number of visits. Owner-only (revenue data).',
    parameters: {
      type: 'object',
      properties: {
        by: {
          type: 'string',
          enum: ['revenue', 'visit_count'],
          description:
            "Ranking criterion: 'revenue' sorts by totalSpent desc, 'visit_count' sorts by visitCount desc.",
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
