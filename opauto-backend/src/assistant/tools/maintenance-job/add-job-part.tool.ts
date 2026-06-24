import { AssistantBlastTier } from '@prisma/client';
import { MaintenanceService } from '../../../maintenance/maintenance.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface AddJobPartArgs {
  jobId: string;
  partId?: string;
  description?: string;
  type?: 'part' | 'labor';
  quantity?: number;
  unitPrice?: number;
  serviceCode?: string;
  mechanicId?: string;
  laborHours?: number;
  tvaRate?: number;
  discountPct?: number;
}

export interface AddJobPartResult {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  partId?: string | null;
  serviceCode?: string | null;
  mechanicId?: string | null;
  laborHours?: number | null;
  tvaRate: number;
  discountPct?: number | null;
  createdAt: string;
  updatedAt: string;
}

const PART_TYPES: readonly string[] = ['part', 'labor'];

function toLine(line: {
  id: string;
  type: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  partId?: string | null;
  serviceCode?: string | null;
  mechanicId?: string | null;
  laborHours?: number | null;
  tvaRate?: number | null;
  discountPct?: number | null;
  createdAt: Date;
  updatedAt: Date;
}): AddJobPartResult {
  return {
    id: line.id,
    type: line.type,
    description: line.description ?? '',
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    partId: line.partId,
    serviceCode: line.serviceCode,
    mechanicId: line.mechanicId,
    laborHours: line.laborHours,
    tvaRate: line.tvaRate ?? 19,
    discountPct: line.discountPct,
    createdAt: line.createdAt.toISOString(),
    updatedAt: line.updatedAt.toISOString(),
  };
}

export function buildAddJobPartTool(
  maintenanceService: MaintenanceService,
): ToolDefinition<AddJobPartArgs, AddJobPartResult> {
  return {
    name: 'add_job_part',
    description:
      'Add one durable line item (part or labor) to a maintenance job. ' +
      'This writes to the maintenance job history and makes the line visible ' +
      'for invoice generation and approval workflows.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['jobId'],
      properties: {
        jobId: {
          type: 'string',
          format: 'uuid',
          description: 'Maintenance job id to receive the line.',
        },
        partId: {
          type: 'string',
          description:
            'Inventory part ID when known. Omit for labor lines or ad-hoc part lines.',
        },
        description: {
          type: 'string',
          description:
            'Text shown on the invoice. Required for ad-hoc part lines without partId.',
        },
        type: {
          type: 'string',
          enum: PART_TYPES,
          description: 'Line type: part (default) or labor.',
        },
        quantity: {
          type: 'number',
          exclusiveMinimum: 0,
          description: 'Quantity. Defaults to 1 when omitted.',
        },
        unitPrice: {
          type: 'number',
          minimum: 0,
          description:
            'Unit price in TND. For parts without an explicit value, ' +
            'the service uses the part catalog price when available.',
        },
        serviceCode: {
          type: 'string',
          description: 'Optional service identifier for reporting.',
        },
        mechanicId: {
          type: 'string',
          description: 'Optional mechanic id to attribute the line.',
        },
        laborHours: {
          type: 'number',
          minimum: 0,
          description:
            'Optional labor hours for labor lines; kept for reporting.',
        },
        tvaRate: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description:
            'Optional TVA rate in percent (default from garage settings).',
        },
        discountPct: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Optional line discount percentage.',
        },
      },
    },
    blastTier: AssistantBlastTier.CONFIRM_WRITE,
    requiredRole: 'OWNER',
    requiredModule: 'maintenance',
    handler: async (
      args: AddJobPartArgs,
      ctx: AssistantUserContext,
    ): Promise<AddJobPartResult> => {
      const line = await maintenanceService.addPartLine(args.jobId, ctx.garageId, {
        partId: args.partId,
        description: args.description,
        type: args.type ?? 'part',
        quantity: args.quantity,
        unitPrice: args.unitPrice,
        serviceCode: args.serviceCode,
        mechanicId: args.mechanicId,
        laborHours: args.laborHours,
        tvaRate: args.tvaRate,
        discountPct: args.discountPct,
      });
      return toLine(line);
    },
  };
}
