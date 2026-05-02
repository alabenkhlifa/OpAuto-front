import {
  AssistantBlastTier,
  InvoiceStatus,
  PaymentMethod,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoicingService } from '../../../invoicing/invoicing.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface RecordPaymentArgs {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  /**
   * The invoice number the user must type to confirm the payment. Set by the
   * LLM (it should fill this from a prior get_invoice / list_invoices call) so
   * the orchestrator's TYPED_CONFIRM_WRITE flow can validate the typed string
   * server-side against the same canonical value.
   */
  _expectedConfirmation: string;
  reference?: string;
  notes?: string;
}

export interface RecordPaymentResult {
  paymentId: string;
  invoiceId: string;
  newBalance: number;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'CHECK',
  'MOBILE_PAYMENT',
];

/**
 * Records a payment against an invoice. TYPED_CONFIRM_WRITE — financial side
 * effect, the user must type the invoice number before approval is granted.
 */
export function buildRecordPaymentTool(
  prisma: PrismaService,
  invoicing: InvoicingService,
): ToolDefinition<RecordPaymentArgs, RecordPaymentResult> {
  return {
    name: 'record_payment',
    description:
      'Records a payment against an invoice. Financial action — requires the ' +
      'user to type the invoice number to confirm. Set _expectedConfirmation ' +
      'to the exact invoiceNumber (e.g. "INV-202604-0001") that you found via ' +
      'get_invoice or list_invoices; the orchestrator validates the typed ' +
      'confirmation against this value before executing. Returns the new ' +
      'paymentId and the remaining newBalance after the payment.',
    parameters: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'string',
          minLength: 1,
          description: 'The invoice id (uuid) being paid.',
        },
        amount: {
          type: 'number',
          exclusiveMinimum: 0,
          description: 'Payment amount, must be greater than zero.',
        },
        method: {
          type: 'string',
          enum: PAYMENT_METHODS,
          description: 'Payment method.',
        },
        _expectedConfirmation: {
          type: 'string',
          minLength: 1,
          description:
            'The invoice number string the user must type to confirm. Use ' +
            'the canonical invoiceNumber (e.g. "INV-202604-0001").',
        },
        reference: {
          type: 'string',
          description: 'Optional payment reference (check number, txn id).',
        },
        notes: {
          type: 'string',
          description: 'Optional free-text notes attached to the payment.',
        },
      },
      required: ['invoiceId', 'amount', 'method', '_expectedConfirmation'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.TYPED_CONFIRM_WRITE,
    requiredRole: 'OWNER',
    handler: async (
      args: RecordPaymentArgs,
      ctx: AssistantUserContext,
    ): Promise<RecordPaymentResult> => {
      // Verify the invoice belongs to ctx.garageId BEFORE handing off to the
      // service. This guards against a malicious LLM trying to record a
      // payment against a foreign-garage invoice id it learned out-of-band.
      const invoice = await prisma.invoice.findUnique({
        where: { id: args.invoiceId },
        select: { id: true, garageId: true, total: true, status: true },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      if (invoice.garageId !== ctx.garageId) {
        throw new ForbiddenException('Invoice does not belong to this garage');
      }
      // Guard against double-charge via the assistant. The general InvoicingService
      // permits over-payment for direct-API users (refunds, tips, manual edge
      // cases), but the assistant must NOT silently record a second payment when
      // a typed-confirm flow is retried after a transient network/UI error.
      if (invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException(
          'Invoice is already PAID; refusing to record an additional payment via the assistant.',
        );
      }

      const payment = await invoicing.addPayment(args.invoiceId, ctx.garageId, {
        amount: args.amount,
        method: args.method,
        reference: args.reference,
        notes: args.notes,
        processedBy: ctx.userId,
      });

      const payments = await prisma.payment.findMany({
        where: { invoiceId: args.invoiceId },
        select: { amount: true },
      });
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const newBalance = Math.max(0, invoice.total - totalPaid);

      return {
        paymentId: payment.id,
        invoiceId: args.invoiceId,
        newBalance,
      };
    },
  };
}
