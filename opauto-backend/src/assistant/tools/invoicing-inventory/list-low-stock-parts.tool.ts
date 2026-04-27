import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export type ListLowStockPartsOrder = 'most_critical' | 'name';

export interface ListLowStockPartsArgs {
  threshold?: number;
  orderBy?: ListLowStockPartsOrder;
  limit?: number;
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
      '"do I need to reorder", "running low on parts", etc. ' +
      'Pass `orderBy: "most_critical"` and a small `limit` for "top N most ' +
      'urgent restocks" — sorts by largest deficit (minQuantity - quantity) first.',
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
        orderBy: {
          type: 'string',
          enum: ['most_critical', 'name'],
          description:
            '"most_critical" sorts by largest deficit (minQuantity - quantity) first — ' +
            'use for "top N most urgent restocks". "name" (default) sorts alphabetically.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Max rows to return (1-100). Use for "top N" requests.',
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
      const filtered = all.filter((p) =>
        explicit ? p.quantity <= (args.threshold as number) : p.quantity <= p.minQuantity,
      );

      const sorted =
        args.orderBy === 'most_critical'
          ? [...filtered].sort(
              (a, b) => b.minQuantity - b.quantity - (a.minQuantity - a.quantity),
            )
          : filtered;
      const parts = args.limit ? sorted.slice(0, args.limit) : sorted;

      return {
        parts,
        count: parts.length,
        thresholdMode: explicit ? 'explicit' : 'per-part-min',
      };
    },
  };
}
