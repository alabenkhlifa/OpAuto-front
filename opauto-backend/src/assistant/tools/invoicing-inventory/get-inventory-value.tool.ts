import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface GetInventoryValueResult {
  totalCount: number;
  totalValue: number;
  currency: 'TND';
}

/**
 * Returns the total inventory holding value, summed at cost across every
 * part in the caller's garage: SUM(quantity * costPrice). Currency is fixed
 * to TND for this single-currency MVP.
 */
export function buildGetInventoryValueTool(
  prisma: PrismaService,
): ToolDefinition<Record<string, never>, GetInventoryValueResult> {
  return {
    name: 'get_inventory_value',
    description:
      "Returns the total inventory value (sum of quantity * costPrice across " +
      "every part in the owner's garage) plus the total part count. Use when " +
      'the user asks "how much is my inventory worth", "stock value", ' +
      '"inventory worth", etc. Currency is TND.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    requiredModule: 'inventory',
    handler: async (
      _args: Record<string, never>,
      ctx: AssistantUserContext,
    ): Promise<GetInventoryValueResult> => {
      const parts = await prisma.part.findMany({
        where: { garageId: ctx.garageId },
        select: { quantity: true, costPrice: true },
      });

      let totalCount = 0;
      let totalValue = 0;
      for (const p of parts) {
        totalCount += p.quantity;
        totalValue += p.quantity * p.costPrice;
      }

      return {
        totalCount,
        totalValue,
        currency: 'TND',
      };
    },
  };
}
