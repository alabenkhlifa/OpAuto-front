import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AssistantBlastTier } from '@prisma/client';
import { AssistantUserContext, ToolDefinition } from '../../types';

export type ReportPeriod = 'today' | 'week' | 'month' | 'ytd';
export type ReportFormat = 'pdf' | 'csv';

export interface GeneratePeriodReportArgs {
  period: ReportPeriod;
  format: ReportFormat;
}

export interface GeneratePeriodReportResult {
  url: string;
  expiresAt: string;
  period: ReportPeriod;
  format: ReportFormat;
  from: string;
  to: string;
}

/**
 * Compute [from, to) bounds for a period in the server's local timezone.
 * Mirrors the convention used by `resolveRevenuePeriod` in analytics tools so
 * report ranges line up with revenue summaries the user already sees.
 */
export function resolveReportPeriod(
  period: ReportPeriod,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const to = new Date(now);
  const from = new Date(now);
  switch (period) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      break;
    case 'week':
      from.setDate(from.getDate() - 7);
      break;
    case 'month':
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'ytd':
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      break;
    default: {
      const exhaustive: never = period;
      throw new Error(`Unsupported period: ${exhaustive as string}`);
    }
  }
  return { from, to };
}

/**
 * v1 stub: validates inputs and computes the period bounds, then returns a
 * placeholder signed-URL token. Real CSV/PDF rendering is deferred to
 * Phase 5; for v1 the LLM tells the user "your report is being prepared"
 * and the URL is non-resolvable until the resolver endpoint ships.
 */
export function buildGeneratePeriodReportTool(
  logger: Logger,
): ToolDefinition<GeneratePeriodReportArgs, GeneratePeriodReportResult> {
  return {
    name: 'generate_period_report',
    description:
      'Generates a downloadable report (PDF or CSV) of garage activity for a fixed period: ' +
      'today, the last 7 days, the current calendar month, or year-to-date. ' +
      'Returns a short-lived signed URL. Use when the user asks to "export", "download", or ' +
      '"email me a report" for a time window.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'ytd'],
          description: 'Reporting window. "week" is rolling 7 days; "month" is current calendar month.',
        },
        format: {
          type: 'string',
          enum: ['pdf', 'csv'],
          description: 'Output format. PDF for printable summaries, CSV for spreadsheet drilldowns.',
        },
      },
      required: ['period', 'format'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: GeneratePeriodReportArgs,
      ctx: AssistantUserContext,
    ): Promise<GeneratePeriodReportResult> => {
      const { from, to } = resolveReportPeriod(args.period);

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      logger.warn(
        `generate_period_report: report generation is stubbed; will be implemented in Phase 5 (token=${token}, period=${args.period}, format=${args.format}, garageId=${ctx.garageId})`,
      );

      return {
        url: `/api/assistant/downloads/${token}.${args.format}`,
        expiresAt,
        period: args.period,
        format: args.format,
        from: from.toISOString(),
        to: to.toISOString(),
      };
    },
  };
}
