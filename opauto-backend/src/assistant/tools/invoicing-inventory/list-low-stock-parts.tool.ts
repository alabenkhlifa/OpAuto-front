import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface ListLowStockPartsArgs {
  threshold?: number;
}

export interface LowStockPartItem {
  id: string;
  name: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
}

export interface ListLowStockPartsResult {
  parts: LowStockPartItem[];
  count: number;
  thresholdMode: 'explicit' | 'per-part-min';
}

/**
 * Lists parts whose current quantity is at or below their reorder threshold.
 * If `threshold` is provided, all parts are checked against that single
 * value. Otherwise each part is compared to its own minQuantity field.
 */
export function buildListLowStockPartsTool(
  prisma: PrismaService,
): ToolDefinition<ListLowStockPartsArgs, ListLowStockPartsResult> {
  return {
    name: 'list_low_stock_parts',
    description:
      'Lists parts that need to be reordered. By default, returns parts ' +
      'where quantity <= minQuantity (per-part threshold). If a numeric ' +
      'threshold argument is provided, returns parts where quantity <= ' +
      'threshold instead. Use when the user asks "what parts are low", ' +
      '"do I need to reorder", "running low on parts", etc.',
    parameters: {
      type: 'object',
      properties: {
        threshold: {
          type: 'integer',
          minimum: 0,
          description:
            'Optional explicit quantity threshold. If omitted, each part is ' +
            'compared to its own minQuantity field.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    requiredModule: 'inventory',
    handler: async (
      args: ListLowStockPartsArgs,
      ctx: AssistantUserContext,
    ): Promise<ListLowStockPartsResult> => {
      const all = await prisma.part.findMany({
        where: { garageId: ctx.garageId },
        select: {
          id: true,
          name: true,
          quantity: true,
          minQuantity: true,
          unitPrice: true,
        },
        orderBy: { name: 'asc' },
      });

      const explicit = typeof args.threshold === 'number';
      const parts = all.filter((p) =>
        explicit ? p.quantity <= (args.threshold as number) : p.quantity <= p.minQuantity,
      );

      return {
        parts,
        count: parts.length,
        thresholdMode: explicit ? 'explicit' : 'per-part-min',
      };
    },
  };
}
