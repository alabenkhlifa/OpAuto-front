import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AssistantBlastTier } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface GenerateInvoicesPdfArgs {
  invoiceIds: string[];
}

export interface GenerateInvoicesPdfResult {
  url: string;
  expiresAt: string;
  invoiceCount: number;
}

/**
 * v1 stub: validates ownership of every invoice id against the caller's
 * garage, then returns a placeholder signed-URL token. Real PDF rendering
 * is deferred to Phase 5 hardening — the LLM can already "promise" a
 * report today; the resolver endpoint and binary generator land later.
 */
export function buildGenerateInvoicesPdfTool(
  prisma: PrismaService,
  logger: Logger,
): ToolDefinition<GenerateInvoicesPdfArgs, GenerateInvoicesPdfResult> {
  return {
    name: 'generate_invoices_pdf',
    description:
      'Generates a PDF bundling one or more invoices for the current garage and returns a short-lived signed URL. ' +
      'Use when the user asks to download, email, or print invoices as PDFs. ' +
      'All invoiceIds must belong to the caller\'s garage; foreign ids cause an error.',
    parameters: {
      type: 'object',
      properties: {
        invoiceIds: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 1,
          maxItems: 50,
          description: 'IDs of invoices to bundle. Must all belong to the current garage.',
        },
      },
      required: ['invoiceIds'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.READ,
    requiredRole: 'OWNER',
    handler: async (
      args: GenerateInvoicesPdfArgs,
      ctx: AssistantUserContext,
    ): Promise<GenerateInvoicesPdfResult> => {
      const owned = await prisma.invoice.findMany({
        where: { id: { in: args.invoiceIds }, garageId: ctx.garageId },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((i) => i.id));
      const missing = args.invoiceIds.filter((id) => !ownedSet.has(id));
      if (missing.length > 0) {
        // Don't echo other garages' ids; just count them. Avoids leaking that
        // an id exists in some other tenant.
        throw new Error(
          `One or more invoiceIds do not belong to this garage (missing=${missing.length})`,
        );
      }

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      logger.warn(
        `generate_invoices_pdf: report generation is stubbed; will be implemented in Phase 5 (token=${token}, count=${args.invoiceIds.length})`,
      );

      return {
        url: `/api/assistant/downloads/${token}.pdf`,
        expiresAt,
        invoiceCount: args.invoiceIds.length,
      };
    },
  };
}
