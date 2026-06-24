import { AssistantBlastTier, ApprovalStatus } from '@prisma/client';
import { MaintenanceService } from '../../../maintenance/maintenance.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface RecordJobCustomerAcceptanceArgs {
  jobId: string;
  requestId: string;
  responseNote?: string;
  responseChannel?: string;
}

export interface RecordJobCustomerAcceptanceResult {
  id: string;
  maintenanceJobId: string;
  status: string;
  requestedAmount?: number | null;
  summary?: string | null;
  responseChannel?: string | null;
  responseNote?: string | null;
  respondedBy?: string | null;
  respondedAt?: string | null;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return '';
}

function toNullableString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

function toNullNum(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

function mapApprovalRequest(row: any): RecordJobCustomerAcceptanceResult {
  return {
    id: String(row?.id ?? ''),
    maintenanceJobId: String(row?.maintenanceJobId ?? ''),
    status: String(row?.status ?? ''),
    requestedAmount: row?.requestedAmount === null ? null : toNullNum(row?.requestedAmount),
    summary: toNullableString(row?.summary),
    responseChannel: toNullableString(row?.responseChannel),
    responseNote: toNullableString(row?.responseNote),
    respondedBy: toNullableString(row?.respondedBy),
    respondedAt: toIso(row?.respondedAt),
  };
}

export function buildRecordJobCustomerAcceptanceTool(
  maintenanceService: MaintenanceService,
): ToolDefinition<RecordJobCustomerAcceptanceArgs, RecordJobCustomerAcceptanceResult> {
  return {
    name: 'record_job_customer_acceptance',
    description:
      'Record the owner-side approval outcome for a customer approval request. ' +
      'Use this to mark a request as approved/reviewed when the shop already ' +
      'confirmed the customer accepted by another channel.',
    blastTier: AssistantBlastTier.CONFIRM_WRITE,
    requiredRole: 'OWNER',
    requiredModule: 'maintenance',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['jobId', 'requestId'],
      properties: {
        jobId: {
          type: 'string',
          format: 'uuid',
          description: 'Maintenance job id that owns this approval request.',
        },
        requestId: {
          type: 'string',
          format: 'uuid',
          description: 'Approval request id to mark as owner-accepted.',
        },
        responseNote: {
          type: 'string',
          description: 'Optional internal note captured with owner approval.',
        },
        responseChannel: {
          type: 'string',
          description:
            'Optional channel used to capture owner-side acceptance (e.g. phone, walk-in).',
        },
      },
    },
    handler: async (
      args: RecordJobCustomerAcceptanceArgs,
      ctx: AssistantUserContext,
    ): Promise<RecordJobCustomerAcceptanceResult> => {
      const request = await maintenanceService.ownerRespondToApproval(
        args.jobId,
        args.requestId,
        ctx.garageId,
        ctx.userId,
        {
          status: ApprovalStatus.APPROVED,
          responseNote: args.responseNote,
          responseChannel: args.responseChannel,
        },
      );
      return mapApprovalRequest(request);
    },
  };
}
