import { AssistantBlastTier } from '@prisma/client';
import { AiService } from '../../../ai/ai.service';
import {
  AssistantUserContext,
  ToolDefinition,
} from '../../types';

export interface ListMaintenanceDueArgs {
  withinDays?: number;
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
      'List vehicles with predicted maintenance due. Wraps the existing predictive-maintenance model. Optionally filter by `withinDays` (only returns alerts due within that many days from now). Negative dueWithinDays indicates overdue.',
    parameters: {
      type: 'object',
      properties: {
        withinDays: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_WITHIN_DAYS,
          description: `Only return alerts with predictedDate at most this many days from now (max ${MAX_WITHIN_DAYS}). Overdue items are always included.`,
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
      if (typeof args.withinDays === 'number') {
        return enriched.filter(
          (p) => p.dueWithinDays < 0 || p.dueWithinDays <= args.withinDays!,
        );
      }
      return enriched;
    },
  };
}
