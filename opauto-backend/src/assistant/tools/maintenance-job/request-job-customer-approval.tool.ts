import { AssistantBlastTier } from '@prisma/client';
import { MaintenanceService } from '../../../maintenance/maintenance.service';
import { InvoiceTokenService } from '../../../public/invoice-token.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface RequestJobCustomerApprovalArgs {
  jobId: string;
  requestedAmount?: number;
  summary?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  sendVia?: 'none' | 'email' | 'sms' | 'both';
  note?: string;
}

export interface RequestJobCustomerApprovalResult {
  id: string;
  maintenanceJobId: string;
  status: string;
  requestedAmount?: number | null;
  summary?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  requestedBy?: string | null;
  responseChannel?: string | null;
  responseNote?: string | null;
  respondedBy?: string | null;
  respondedAt?: string | null;
  publicToken?: string;
  publicUrl?: string;
  createdAt: string;
  updatedAt: string;
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

function mapApprovalRequest(
  row: any,
  publicToken?: string,
): RequestJobCustomerApprovalResult {
  return {
    id: String(row?.id ?? ''),
    maintenanceJobId: String(row?.maintenanceJobId ?? ''),
    status: String(row?.status ?? ''),
    requestedAmount: row?.requestedAmount === null ? null : toNullNum(row?.requestedAmount),
    summary: toNullableString(row?.summary),
    customerName: toNullableString(row?.customerName),
    customerEmail: toNullableString(row?.customerEmail),
    customerPhone: toNullableString(row?.customerPhone),
    requestedBy: toNullableString(row?.requestedBy),
    responseChannel: toNullableString(row?.responseChannel),
    responseNote: toNullableString(row?.responseNote),
    respondedBy: toNullableString(row?.respondedBy),
    respondedAt: toIso(row?.respondedAt),
    publicToken,
    publicUrl: publicToken ? `/public/job-approvals/${publicToken}` : undefined,
    createdAt: toIso(row?.createdAt),
    updatedAt: toIso(row?.updatedAt),
  };
}

export function buildRequestJobCustomerApprovalTool(
  maintenanceService: MaintenanceService,
  tokens?: InvoiceTokenService,
): ToolDefinition<RequestJobCustomerApprovalArgs, RequestJobCustomerApprovalResult> {
  return {
    name: 'request_job_customer_approval',
    description:
      'Create a customer approval request for a maintenance job and return a public ' +
      'approval URL that can be sent with send_sms or send_email after confirmation. ' +
      'Use this after parts or labor are prepared.',
    blastTier: AssistantBlastTier.CONFIRM_WRITE,
    requiredRole: 'OWNER',
    requiredModule: 'maintenance',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['jobId'],
      properties: {
        jobId: {
          type: 'string',
          format: 'uuid',
          description: 'Maintenance job id to attach the approval request to.',
        },
        requestedAmount: {
          type: 'number',
          minimum: 0,
          description:
            'Optional requested amount in TND to show in the customer request.',
        },
        summary: {
          type: 'string',
          description:
            'Optional short summary of work done and estimate rationale.',
        },
        customerName: {
          type: 'string',
          description:
            'Optional customer display name to attach to the approval request.',
        },
        customerEmail: {
          type: 'string',
          description:
            'Optional customer email, used by communication channels if configured.',
        },
        customerPhone: {
          type: 'string',
          description:
            'Optional customer phone, used by communication channels if configured.',
        },
        sendVia: {
          type: 'string',
          enum: ['none', 'email', 'sms', 'both'],
          description:
            'Optional communication channel hint for downstream workers: none, email, sms, or both.',
        },
        note: {
          type: 'string',
          description:
            'Optional internal note saved as the approval request note.',
        },
      },
    },
    handler: async (
      args: RequestJobCustomerApprovalArgs,
      ctx: AssistantUserContext,
    ): Promise<RequestJobCustomerApprovalResult> => {
      const request = await maintenanceService.createApprovalRequest(args.jobId, ctx.garageId, ctx.userId, {
        requestedAmount: args.requestedAmount,
        summary: args.summary,
        customerName: args.customerName,
        customerEmail: args.customerEmail,
        customerPhone: args.customerPhone,
        sendVia: args.sendVia ?? 'none',
        note: args.note,
      });
      const publicToken = tokens?.sign(request.id, 'jobApproval');
      return mapApprovalRequest(request, publicToken);
    },
  };
}
