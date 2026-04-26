import { AssistantBlastTier, MaintenanceStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface ListActiveJobsArgs {
  limit?: number;
}

export interface ActiveJobSummary {
  id: string;
  title: string;
  status: MaintenanceStatus;
  customerId: string | null;
  carId: string;
  startDate: string | null;
}

export interface ListActiveJobsResult {
  jobs: ActiveJobSummary[];
}

const TERMINAL_STATUSES: MaintenanceStatus[] = [
  MaintenanceStatus.COMPLETED,
  MaintenanceStatus.CANCELLED,
];

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/**
 * Lists the most recently updated maintenance jobs that are still in flight
 * (anything not COMPLETED or CANCELLED), scoped by garage. The customerId is
 * pulled through the car relation since MaintenanceJob has no direct link.
 */
export function buildListActiveJobsTool(
  prisma: PrismaService,
): ToolDefinition<ListActiveJobsArgs, ListActiveJobsResult> {
  return {
    name: 'list_active_jobs',
    description:
      'Returns the top-N maintenance jobs that are still active (not completed ' +
      'or cancelled), most recently updated first. Use when the user asks "what ' +
      'jobs are in progress" or "what is the workshop working on".',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_LIMIT,
          description: `Max number of jobs to return. Defaults to ${DEFAULT_LIMIT}, hard cap ${MAX_LIMIT}.`,
        },
      },
      required: [],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: ListActiveJobsArgs,
      ctx: AssistantUserContext,
    ): Promise<ListActiveJobsResult> => {
      const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      const rows = await prisma.maintenanceJob.findMany({
        where: {
          garageId: ctx.garageId,
          status: { notIn: TERMINAL_STATUSES },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          carId: true,
          startDate: true,
          car: { select: { customerId: true } },
        },
      });

      return {
        jobs: rows.map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          customerId: row.car?.customerId ?? null,
          carId: row.carId,
          startDate: row.startDate ? row.startDate.toISOString() : null,
        })),
      };
    },
  };
}
