import { AssistantBlastTier } from '@prisma/client';
import { InvoicingService } from '../../../invoicing/invoicing.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface GetInvoiceArgs {
  invoiceId: string;
}

/**
 * Loads a single invoice by id or invoice number (garage-scoped) including
 * line items, payments, customer, and car.
 */
export function buildGetInvoiceTool(
  invoicing: InvoicingService,
): ToolDefinition<GetInvoiceArgs, unknown> {
  return {
    name: 'get_invoice',
    description:
      'Returns the full invoice record for a given invoice id or visible invoice number, including line ' +
      'items, payments, customer, and car. Garage-scoped — invoices from ' +
      'other garages are rejected. Use when the user asks for invoice details, ' +
      '"show me invoice INV-...", or "what is on this invoice". Users usually know the invoice number, not the internal UUID.',
    parameters: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          minLength: 1,
          description:
            'The internal invoice UUID or visible invoice number to load, e.g. INV-2026-0001.',
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
      return invoicing.findOneByIdentifier(args.invoiceId, ctx.garageId);
    },
  };
}
