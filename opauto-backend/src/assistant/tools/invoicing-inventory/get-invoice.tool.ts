import { AssistantBlastTier } from '@prisma/client';
import { InvoicingService } from '../../../invoicing/invoicing.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface GetInvoiceArgs {
  invoiceId: string;
}

/**
 * Loads a single invoice by id (garage-scoped) including line items, payments,
 * customer, and car. Wraps InvoicingService.findOne which throws NotFound when
 * the invoice doesn't belong to this garage.
 */
export function buildGetInvoiceTool(
  invoicing: InvoicingService,
): ToolDefinition<GetInvoiceArgs, unknown> {
  return {
    name: 'get_invoice',
    description:
      'Returns the full invoice record for a given invoiceId, including line ' +
      'items, payments, customer, and car. Garage-scoped — invoices from ' +
      'other garages are rejected. Use when the user asks for invoice details, ' +
      '"show me invoice INV-...", or "what is on this invoice".',
    parameters: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          format: 'uuid',
          description: 'The invoice id (uuid) to load.',
        },
      },
      required: ['invoiceId'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: GetInvoiceArgs,
      ctx: AssistantUserContext,
    ): Promise<unknown> => {
      return invoicing.findOne(args.invoiceId, ctx.garageId);
    },
  };
}
