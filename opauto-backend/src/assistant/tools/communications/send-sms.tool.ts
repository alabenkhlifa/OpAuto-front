import { AssistantBlastTier } from '@prisma/client';
import { CustomersService } from '../../../customers/customers.service';
import { SmsService } from '../../../sms/sms.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface SendSmsArgs {
  to: string;
  body: string;
  // Optional binding for audit + defense-in-depth: if supplied, we verify the
  // customer belongs to ctx.garageId AND its phone matches `to` before sending.
  customerId?: string;
}

export interface SendSmsResult {
  providerMessageId: string;
  status: string;
}

export interface SendSmsError {
  error:
    | 'customer_not_found'
    | 'phone_mismatch'
    | 'send_failed';
  message: string;
}

function normalisePhone(phone: string): string {
  // Strip whitespace and common separators so "+216 12 345 678" matches "+21612345678".
  return phone.replace(/[\s\-()]/g, '');
}

export function createSendSmsTool(deps: {
  smsService: SmsService;
  customersService: CustomersService;
}): ToolDefinition<SendSmsArgs, SendSmsResult | SendSmsError> {
  return {
    name: 'send_sms',
    description:
      'Send a transactional SMS to a phone number. Requires user approval (CONFIRM_WRITE). ' +
      'If a customerId is provided, the tool verifies the customer belongs to the current garage ' +
      'and that the customer\'s phone matches `to`. Returns {providerMessageId, status} on success ' +
      'or a structured error. Do NOT use this to send AI-drafted retention messages — those go ' +
      'through `propose_retention_action` and the existing AI Actions approval flow.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          minLength: 8,
          maxLength: 32,
          description:
            'Recipient phone number in E.164 format (e.g. +21612345678).',
        },
        body: {
          type: 'string',
          minLength: 1,
          maxLength: 1600,
          description: 'SMS body text. Keep it concise; long bodies are split across segments.',
        },
        customerId: {
          type: 'string',
          minLength: 1,
          description: 'Optional customer id to bind for audit + phone-match verification.',
        },
      },
      required: ['to', 'body'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.CONFIRM_WRITE,
    handler: async (
      args: SendSmsArgs,
      ctx: AssistantUserContext,
    ): Promise<SendSmsResult | SendSmsError> => {
      if (args.customerId) {
        try {
          const customer = await deps.customersService.findOne(
            args.customerId,
            ctx.garageId,
          );
          if (normalisePhone(customer.phone) !== normalisePhone(args.to)) {
            return {
              error: 'phone_mismatch',
              message:
                `Customer ${args.customerId} phone does not match the provided 'to' number. ` +
                'Refusing to send to prevent cross-customer contamination.',
            };
          }
        } catch {
          return {
            error: 'customer_not_found',
            message: `Customer ${args.customerId} not found in this garage.`,
          };
        }
      }

      try {
        const result = await deps.smsService.send(args.to, args.body);
        return {
          providerMessageId: result.providerMessageId,
          status: result.status,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: 'send_failed', message };
      }
    },
  };
}
