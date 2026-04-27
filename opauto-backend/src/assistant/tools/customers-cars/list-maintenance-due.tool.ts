import { AssistantBlastTier } from '@prisma/client';
import { AiService } from '../../../ai/ai.service';
import {
  AssistantUserContext,
  ToolDefinition,
} from '../../types';

export type ListMaintenanceDueOrder = 'soonest' | 'most_urgent';

export interface ListMaintenanceDueArgs {
  withinDays?: number;
  orderBy?: ListMaintenanceDueOrder;
  limit?: number;
}

export interface MaintenanceDueEntry {
  carId: string;
  carLabel: string;
  service: string;
  predictedDate: string;
  dueWithinDays: number;
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
  reason: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_WITHIN_DAYS = 365;

export function createListMaintenanceDueTool(deps: {
  aiService: AiService;
}): ToolDefinition<ListMaintenanceDueArgs, MaintenanceDueEntry[]> {
  return {
    name: 'list_maintenance_due',
    description:
      'List vehicles with predicted maintenance due. Wraps the existing predictive-maintenance model. ' +
      'Optionally filter by `withinDays` (only returns alerts due within that many days from now). ' +
      'Negative dueWithinDays indicates overdue. Pass `orderBy: "soonest"` (default) for ' +
      '"earliest due"; `"most_urgent"` to sort by urgency (high→medium→low). Combine with `limit` ' +
      'for "top N upcoming services".',
    parameters: {
      type: 'object',
      properties: {
        withinDays: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_WITHIN_DAYS,
          description: `Only return alerts with predictedDate at most this many days from now (max ${MAX_WITHIN_DAYS}). Overdue items are always included.`,
        },
        orderBy: {
          type: 'string',
          enum: ['soonest', 'most_urgent'],
          description:
            '"soonest" (default) sorts by predictedDate ascending — earliest due first. ' +
            '"most_urgent" sorts by urgency level (high → medium → low), ties broken by date.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Max rows to return (1-100). Use for "top N" requests.',
        },
      },
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    handler: async (
      args: ListMaintenanceDueArgs,
      ctx: AssistantUserContext,
    ): Promise<MaintenanceDueEntry[]> => {
      const result = await deps.aiService.predictMaintenance(ctx.garageId, {
        language: ctx.locale,
      });

      const now = Date.now();
      const enriched = result.predictions.map((p) => {
        const predictedMs = new Date(p.predictedDate).getTime();
        const dueWithinDays = Math.floor((predictedMs - now) / MS_PER_DAY);
        return { ...p, dueWithinDays };
      });

      // If withinDays is set, keep overdue (dueWithinDays < 0) plus anything
      // due in <= withinDays. Overdue is always relevant.
      const filtered =
        typeof args.withinDays === 'number'
          ? enriched.filter(
              (p) => p.dueWithinDays < 0 || p.dueWithinDays <= args.withinDays!,
            )
          : enriched;

      const URGENCY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const sorted =
        args.orderBy === 'most_urgent'
          ? [...filtered].sort((a, b) => {
              const ra = URGENCY_RANK[a.urgency] ?? 99;
              const rb = URGENCY_RANK[b.urgency] ?? 99;
              if (ra !== rb) return ra - rb;
              return a.dueWithinDays - b.dueWithinDays;
            })
          : [...filtered].sort((a, b) => a.dueWithinDays - b.dueWithinDays);

      return args.limit ? sorted.slice(0, args.limit) : sorted;
    },
  };
}
