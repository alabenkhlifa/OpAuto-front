import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface CustomerCountArgs {
  /** ISO date (YYYY-MM-DD or full ISO timestamp). When provided, also returns the count of customers created at or after this instant. */
  newSince?: string;
}

export interface CustomerCountResult {
  total: number;
  new?: number;
}

/**
 * Returns the customer roster size for the caller's garage. When `newSince`
 * is supplied, also reports how many of those customers were created at or
 * after that timestamp — useful for "how many new customers this week".
 */
export function buildGetCustomerCountTool(
  prisma: PrismaService,
): ToolDefinition<CustomerCountArgs, CustomerCountResult> {
  return {
    name: 'get_customer_count',
    description:
      'Returns the total number of customers for the garage, optionally with ' +
      'the number of new customers created since a given date (newSince, ISO ' +
      'date or timestamp). Use when the user asks "how many customers do I have" ' +
      'or "how many new customers did I get since X".',
    parameters: {
      type: 'object',
      properties: {
        newSince: {
          type: 'string',
          description: 'ISO 8601 date or timestamp. Counts customers created at or after this instant.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: CustomerCountArgs,
      ctx: AssistantUserContext,
    ): Promise<CustomerCountResult> => {
      const total = await prisma.customer.count({ where: { garageId: ctx.garageId } });

      if (!args.newSince) {
        return { total };
      }

      const since = new Date(args.newSince);
      if (Number.isNaN(since.getTime())) {
        throw new Error(`Invalid newSince: ${args.newSince}`);
      }

      const fresh = await prisma.customer.count({
        where: { garageId: ctx.garageId, createdAt: { gte: since } },
      });
      return { total, new: fresh };
    },
  };
}
