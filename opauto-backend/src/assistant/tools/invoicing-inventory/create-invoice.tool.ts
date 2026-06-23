import { AssistantBlastTier } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoicingService } from '../../../invoicing/invoicing.service';
import { InvoiceTokenService } from '../../../public/invoice-token.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface CreateInvoiceLineArgs {
  description: string;
  quantity: number;
  unitPrice: number;
  tvaRate?: number;
  type?: string;
  partId?: string;
  serviceCode?: string;
}

export interface CreateInvoiceArgs {
  customerId: string;
  carId?: string;
  dueDate: string;
  lineItems: CreateInvoiceLineArgs[];
  discount?: number;
  notes?: string;
  /**
   * Computed total the user must type to confirm the issue. The LLM should
   * fill this with the sum it computed locally from the line items (e.g.
   * "67.83 TND"). The orchestrator's TYPED_CONFIRM flow validates the typed
   * confirmation against this string before approval is granted. Server-side
   * the canonical total is derived by TaxCalculatorService — they should
   * match if the LLM did its math right.
   */
  _expectedConfirmation: string;
  /** Internal draft id used for preview + post-approval execution. */
  _draftInvoiceId?: string;
  /** Internal URL to preview the generated draft invoice PDF before approval. */
  _draftInvoicePreviewUrl?: string;
  /** User-facing URL for the approval card's draft invoice download link. */
  previewDownloadUrl?: string;
}

export interface CreateInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  status: string;
  dueDate: string | null;
}

const logger = new Logger('CreateInvoiceTool');

function withPublicBaseUrl(url?: string): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
}

function toInvoicePublicUrl(publicBaseUrl: string, token: string): string {
  const baseUrl = withPublicBaseUrl(publicBaseUrl);
  const apiBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
  return `${apiBase}/public/invoices/${token}`;
}

function toTndFormatted(value: number): string {
  return `${value.toFixed(2)} TND`;
}

function toCreateInvoiceDto(args: CreateInvoiceArgs) {
  return {
    customerId: args.customerId,
    carId: args.carId,
    dueDate: args.dueDate,
    discount: args.discount,
    notes: args.notes,
    lineItems: args.lineItems.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      tvaRate: line.tvaRate,
      type: line.type,
      partId: line.partId,
      serviceCode: line.serviceCode,
    })),
  };
}

function toCreateInvoiceResult(invoice: {
  id: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  status: string;
  dueDate: Date | null;
}) {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    total: invoice.total,
    currency: invoice.currency,
    status: invoice.status,
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : null,
  };
}

async function ensureGarageScopedCustomerAndCar(
  prisma: PrismaService,
  args: CreateInvoiceArgs,
  garageId: string,
) {
  const customer = await prisma.customer.findUnique({
    where: { id: args.customerId },
    select: { id: true, garageId: true },
  });
  if (!customer) {
    throw new NotFoundException('Customer not found');
  }
  if (customer.garageId !== garageId) {
    throw new ForbiddenException('Customer does not belong to this garage');
  }

  if (args.carId) {
    const car = await prisma.car.findUnique({
      where: { id: args.carId },
      select: { id: true, garageId: true, customerId: true },
    });
    if (!car) {
      throw new NotFoundException('Car not found');
    }
    if (car.garageId !== garageId) {
      throw new ForbiddenException('Car does not belong to this garage');
    }
    if (car.customerId !== args.customerId) {
      throw new BadRequestException(
        'Car belongs to a different customer than the one supplied',
      );
    }
  }
}

export function buildCreateInvoiceTool(
  prisma: PrismaService,
  invoicing: InvoicingService,
  invoiceTokenService?: InvoiceTokenService,
  publicBaseUrl: string = '',
): ToolDefinition<CreateInvoiceArgs, CreateInvoiceResult> {
  return {
    name: 'create_invoice',
    description:
      'Creates AND issues a new invoice in one step — assigns a gapless ' +
      'fiscal number, computes per-line TVA, and locks the invoice ' +
      'immediately (Tunisian fiscal compliance). Financial action — ' +
      'requires the user to type the computed total to confirm. Set ' +
      '_expectedConfirmation to the formatted total you computed from the ' +
      'line items (e.g. "67.83 TND"); the orchestrator validates the user ' +
      'typed it correctly before executing. Do NOT call this tool with ' +
      'placeholder, string-only, or guessed lineItems. If the user has not ' +
      'provided a quantity and HT unitPrice for each requested service/part, ' +
      'ask for those missing prices first. Use list_low_stock_parts first ' +
      "if any line uses a partId — issuing the invoice decrements stock " +
      'atomically and will fail with a friendly error on shortage.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['customerId', 'dueDate', 'lineItems', '_expectedConfirmation'],
      properties: {
        customerId: {
          type: 'string',
          format: 'uuid',
          description: 'Customer id (uuid). Must belong to this garage.',
        },
        carId: {
          type: 'string',
          format: 'uuid',
          description:
            'Optional car id (uuid). When supplied must belong to this ' +
            'garage AND to the named customer.',
        },
        dueDate: {
          type: 'string',
          description:
            'Required. ISO date the invoice is due — YYYY-MM-DD or full ' +
            'ISO 8601. The fiscal issue step requires this.',
        },
        discount: {
          type: 'number',
          minimum: 0,
          description: 'Optional invoice-level discount amount (TND).',
        },
        notes: {
          type: 'string',
          description: 'Optional free-text notes attached to the invoice.',
        },
        lineItems: {
          type: 'array',
          minItems: 1,
          description:
            'At least one line object is required. Never pass raw strings; ask the user for missing prices before calling this tool.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['description', 'quantity', 'unitPrice'],
            properties: {
              description: { type: 'string', minLength: 1 },
              quantity: {
                type: 'number',
                exclusiveMinimum: 0,
                description: 'Quantity, must be greater than zero.',
              },
              unitPrice: {
                type: 'number',
                minimum: 0,
                description:
                  'Unit price (TND, HT). Zero is allowed for courtesy / free items.',
              },
              tvaRate: {
                type: 'number',
                minimum: 0,
                maximum: 100,
                description:
                  'Per-line TVA rate (Tunisia: 0 / 7 / 13 / 19). Falls ' +
                  'back to garage default when omitted.',
              },
              type: { type: 'string', description: 'Optional line type label.' },
              partId: {
                type: 'string',
                description:
                  'Optional part id when the line consumes inventory; ' +
                  'issuing the invoice decrements Part.quantity atomically.',
              },
              serviceCode: { type: 'string' },
            },
          },
        },
        _expectedConfirmation: {
          type: 'string',
          minLength: 1,
          description:
            'The total string the user must type to confirm. Use the ' +
            'formatted total you computed (e.g. "67.83 TND").',
        },
      },
    },
    blastTier: AssistantBlastTier.TYPED_CONFIRM_WRITE,
    requiredRole: 'OWNER',
    requiredModule: 'invoicing',
    prepareApprovalArgs: async (
      args: CreateInvoiceArgs,
      ctx: AssistantUserContext,
    ): Promise<CreateInvoiceArgs> => {
      if (
        typeof args._draftInvoiceId === 'string' &&
        args._draftInvoiceId.trim().length > 0
      ) {
        return args;
      }
      if (!invoiceTokenService) {
        throw new Error(
          'create_invoice preview unavailable: InvoiceTokenService was not provided',
        );
      }

      await ensureGarageScopedCustomerAndCar(prisma, args, ctx.garageId);

      const draft = await invoicing.create(
        ctx.garageId,
        toCreateInvoiceDto(args),
        { userId: ctx.userId, role: ctx.role },
      );
      try {
        const token = invoiceTokenService.sign(draft.id, 'invoice');
        const previewUrl = toInvoicePublicUrl(publicBaseUrl, token);
        return {
          ...args,
          _draftInvoiceId: draft.id,
          _draftInvoicePreviewUrl: previewUrl,
          previewDownloadUrl: previewUrl,
          _expectedConfirmation: toTndFormatted(draft.total),
        };
      } catch (err) {
        try {
          await invoicing.remove(draft.id, ctx.garageId);
        } catch (cleanupErr) {
          const message =
            cleanupErr instanceof Error
              ? cleanupErr.message
              : String(cleanupErr);
          logger.warn(
            `create_invoice: failed to clean up DRAFT ${draft.id} after preview-signing error: ${message}`,
          );
        }
        throw err;
      }
    },
    cleanupApprovalArgs: async (
      args: CreateInvoiceArgs,
      ctx: AssistantUserContext,
    ): Promise<void> => {
      const draftInvoiceId =
        typeof args._draftInvoiceId === 'string'
          ? args._draftInvoiceId.trim()
          : '';
      if (!draftInvoiceId) return;

      await invoicing.remove(draftInvoiceId, ctx.garageId);
    },
    handler: async (
      args: CreateInvoiceArgs,
      ctx: AssistantUserContext,
    ): Promise<CreateInvoiceResult> => {
      await ensureGarageScopedCustomerAndCar(prisma, args, ctx.garageId);

      const draftInvoiceId =
        typeof args._draftInvoiceId === 'string'
          ? args._draftInvoiceId.trim()
          : '';
      if (draftInvoiceId) {
        try {
          const issued = await invoicing.issue(
            draftInvoiceId,
            ctx.garageId,
            ctx.userId,
          );
          return toCreateInvoiceResult(issued);
        } catch (issueErr) {
          try {
            await invoicing.remove(draftInvoiceId, ctx.garageId);
          } catch (cleanupErr) {
            const message =
              cleanupErr instanceof Error
                ? cleanupErr.message
                : String(cleanupErr);
            logger.warn(
              `create_invoice: failed to clean up prepared DRAFT ${draftInvoiceId} after issue() error: ${message}`,
            );
          }
          throw issueErr;
        }
      }

      const draft = await invoicing.create(
        ctx.garageId,
        toCreateInvoiceDto(args),
        { userId: ctx.userId, role: ctx.role },
      );

      try {
        const issued = await invoicing.issue(
          draft.id,
          ctx.garageId,
          ctx.userId,
        );
        return toCreateInvoiceResult(issued);
      } catch (issueErr) {
        // Atomic semantics from the user POV — if issue() fails (insufficient
        // stock, fiscal counter race, etc.) we drop the orphan DRAFT so the
        // assistant doesn't leave half-state behind. Cleanup is best-effort:
        // the original error is what matters to the caller.
        try {
          await invoicing.remove(draft.id, ctx.garageId);
        } catch (cleanupErr) {
          const message =
            cleanupErr instanceof Error
              ? cleanupErr.message
              : String(cleanupErr);
          logger.warn(
            `create_invoice: failed to clean up DRAFT ${draft.id} after issue() error: ${message}`,
          );
        }
        throw issueErr;
      }
    },
  };
}
