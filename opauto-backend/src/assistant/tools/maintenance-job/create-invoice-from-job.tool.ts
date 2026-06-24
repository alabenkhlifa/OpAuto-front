import { AssistantBlastTier } from '@prisma/client';
import { FromJobService } from '../../../invoicing/from-job.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface CreateInvoiceFromJobArgs {
  jobId: string;
  dueDate?: string;
  notes?: string;
}

export interface CreateInvoiceFromJobResult {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  customerId: string;
  carId: string | null;
  dueDate: string | null;
}

function toIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return null;
}

function toString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function toNum(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

export function buildCreateInvoiceFromJobTool(
  fromJobService: FromJobService,
): ToolDefinition<CreateInvoiceFromJobArgs, CreateInvoiceFromJobResult> {
  return {
    name: 'create_invoice_from_job',
    description:
      'Create a DRAFT invoice from a maintenance job using durable parts/labor lines ' +
      'and return the draft invoice payload. This does not issue/finalize the invoice.',
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
          description:
            'Maintenance job id that should be converted into an invoice draft.',
        },
        dueDate: {
          type: 'string',
          description:
            'Optional due date for the generated invoice (ISO-8601, e.g. 2026-07-01).',
        },
        notes: {
          type: 'string',
          description:
            'Optional draft notes to persist on the invoice (e.g. internal follow-up).',
        },
      },
    },
    handler: async (
      args: CreateInvoiceFromJobArgs,
      ctx: AssistantUserContext,
    ): Promise<CreateInvoiceFromJobResult> => {
      const invoice = await fromJobService.createFromJob(
        args.jobId,
        ctx.garageId,
        { dueDate: args.dueDate, notes: args.notes },
      );

      return {
        invoiceId: toString(invoice.id),
        invoiceNumber: toString(invoice.invoiceNumber),
        status: toString(invoice.status),
        total: toNum(invoice.total),
        currency: toString(invoice.currency) || 'TND',
        customerId: toString(invoice.customerId),
        carId: typeof invoice.carId === 'string' ? invoice.carId : null,
        dueDate: toIso(invoice.dueDate),
      };
    },
  };
}
