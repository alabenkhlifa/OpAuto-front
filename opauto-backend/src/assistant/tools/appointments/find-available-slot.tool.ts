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

interface FindAvailableSlotError {
  error: 'invalid_date';
  message: string;
}

const CONCRETE_DATE_PATTERN =
  '^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,3})?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?$';
const CONCRETE_DATE_RE = new RegExp(CONCRETE_DATE_PATTERN);
const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
}

function resolveWeekdayReference(
  message: string | undefined,
  now: Date = new Date(),
): string | null {
  if (!message) return null;
  const match = message.match(
    /\b(next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (!match) return null;

  const qualifier = match[1].toLowerCase();
  const targetDay = WEEKDAYS[match[2].toLowerCase()];
  const today = toUtcDateOnly(now);
  const currentDay = today.getUTCDay();
  let delta = (targetDay - currentDay + 7) % 7;
  if (qualifier === 'next' && delta === 0) delta = 7;

  const resolved = new Date(today);
  resolved.setUTCDate(resolved.getUTCDate() + delta);
  return resolved.toISOString().slice(0, 10);
}

function isValidConcreteDate(value: string): boolean {
  if (!CONCRETE_DATE_RE.test(value)) return false;

  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const dateOnly = new Date(Date.UTC(year, month - 1, day));
  if (
    dateOnly.getUTCFullYear() !== year ||
    dateOnly.getUTCMonth() !== month - 1 ||
    dateOnly.getUTCDate() !== day
  ) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

export function buildFindAvailableSlotTool(
  aiService: AiService,
): ToolDefinition<
  FindAvailableSlotArgs,
  { slots: RankedSlot[]; provider: string } | FindAvailableSlotError
> {
  return {
    name: 'find_available_slot',
    description:
      'Find the top 3 ranked available appointment slots near a preferred date for a given duration. Returns mechanic + reason per slot. Use before create_appointment to pick a time. The date must be a concrete YYYY-MM-DD or ISO 8601 value computed from today; never pass relative text like "today", "tomorrow", or "this Friday".',
    blastTier: AssistantBlastTier.READ,
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['date', 'durationMinutes'],
      properties: {
        date: {
          type: 'string',
          pattern: CONCRETE_DATE_PATTERN,
          description:
            'Preferred date. Must be a concrete YYYY-MM-DD or full ISO 8601 value. Resolve relative phrases before calling this tool; e.g. if today is 2026-06-23, "this Friday" must be passed as 2026-06-26.',
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
      if (!isValidConcreteDate(args.date)) {
        return {
          error: 'invalid_date',
          message:
            'find_available_slot requires a concrete YYYY-MM-DD or ISO 8601 date. Resolve relative phrases like "this Friday" before calling the tool.',
        };
      }

      const weekdayDate = resolveWeekdayReference(ctx.turnState?.userMessage);
      const preferredDate = weekdayDate ?? args.date;
      const scheduleRequest: {
        appointmentType: string;
        estimatedDuration: number;
        preferredDate: string;
        exactDateOnly?: boolean;
        language: AssistantUserContext['locale'];
      } = {
        appointmentType: args.appointmentType ?? 'general-inspection',
        estimatedDuration: args.durationMinutes,
        preferredDate,
        language: ctx.locale,
      };
      if (weekdayDate) scheduleRequest.exactDateOnly = true;

      const result = await aiService.suggestSchedule(ctx.garageId, scheduleRequest);
      return {
        slots: result.suggestedSlots.slice(0, 3),
        provider: result.provider,
      };
    },
  };
}
