import { AssistantBlastTier } from '@prisma/client';
import { AiService } from '../../../ai/ai.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

interface FindAvailableSlotArgs {
  date: string;
  durationMinutes: number;
  appointmentType?: string;
}

interface RankedSlot {
  start: string;
  end: string;
  mechanicId: string;
  mechanicName: string;
  score: number;
  reason: string;
  warning?: string;
}

export function buildFindAvailableSlotTool(
  aiService: AiService,
): ToolDefinition<FindAvailableSlotArgs, { slots: RankedSlot[]; provider: string }> {
  return {
    name: 'find_available_slot',
    description:
      'Find the top 3 ranked available appointment slots near a preferred date for a given duration. Returns mechanic + reason per slot. Use before create_appointment to pick a time.',
    blastTier: AssistantBlastTier.READ,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['date', 'durationMinutes'],
      properties: {
        date: {
          type: 'string',
          description:
            'Preferred date. Accepts YYYY-MM-DD or full ISO 8601. Search window is ±3 days around this date.',
        },
        durationMinutes: {
          type: 'integer',
          minimum: 15,
          maximum: 600,
          description: 'Required slot duration in minutes (15–600).',
        },
        appointmentType: {
          type: 'string',
          description:
            'Type slug (e.g. oil-change, brake-repair, inspection, transmission, engine, tires). Used for skill match. Defaults to general-inspection.',
        },
      },
    },
    handler: async (args, ctx: AssistantUserContext) => {
      const result = await aiService.suggestSchedule(ctx.garageId, {
        appointmentType: args.appointmentType ?? 'general-inspection',
        estimatedDuration: args.durationMinutes,
        preferredDate: args.date,
        language: ctx.locale,
      });
      return {
        slots: result.suggestedSlots.slice(0, 3),
        provider: result.provider,
      };
    },
  };
}
