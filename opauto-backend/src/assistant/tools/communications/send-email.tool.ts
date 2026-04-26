import { AssistantBlastTier } from '@prisma/client';
import { EmailService } from '../../../email/email.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface SendEmailArgs {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  // v1: invoice attachment generation is deferred (see decision note in
  // communications-tools.module.ts). The schema accepts the field so callers
  // can express intent; the handler currently returns a soft notice.
  attachInvoiceIds?: string[];
}

export interface SendEmailResult {
  providerMessageId: string;
  status: string;
  // Surface a soft notice when attachInvoiceIds is supplied but ignored, so
  // the LLM can decide whether to proceed or pivot to `generate_invoices_pdf`.
  attachmentsNotice?: string;
}

export interface SendEmailError {
  error: 'missing_body' | 'send_failed';
  message: string;
}

export function resolveSendEmailBlastTier(
  args: SendEmailArgs,
  ctx: AssistantUserContext,
): AssistantBlastTier {
  // Self-facing send: owner emailing themselves (e.g. "email me today's report")
  // does not require approval. External recipients always require approval.
  if (
    ctx.email &&
    typeof args.to === 'string' &&
    args.to.trim().toLowerCase() === ctx.email.trim().toLowerCase()
  ) {
    return AssistantBlastTier.AUTO_WRITE;
  }
  return AssistantBlastTier.CONFIRM_WRITE;
}

export function createSendEmailTool(deps: {
  emailService: EmailService;
}): ToolDefinition<SendEmailArgs, SendEmailResult | SendEmailError> {
  return {
    name: 'send_email',
    description:
      'Send a transactional email. The blast tier is resolved at runtime: AUTO_WRITE when the ' +
      'recipient is the authenticated user (self-send, e.g. "email me the daily report"), and ' +
      'CONFIRM_WRITE for any other recipient. At least one of `html` or `text` must be supplied. ' +
      '`attachInvoiceIds` is accepted but invoice PDF generation is deferred to v2; the email ' +
      'will be sent without attachments and a notice returned in the result.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          format: 'email',
          description: 'Recipient email address.',
        },
        subject: {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Email subject line.',
        },
        html: {
          type: 'string',
          minLength: 1,
          description: 'HTML body. Either html or text (or both) must be provided.',
        },
        text: {
          type: 'string',
          minLength: 1,
          description: 'Plain-text body. Either html or text (or both) must be provided.',
        },
        attachInvoiceIds: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          description:
            'Optional list of invoice ids to attach as PDFs. Deferred in v1 — provided value is logged but no attachments are added.',
        },
      },
      required: ['to', 'subject'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.CONFIRM_WRITE,
    resolveBlastTier: resolveSendEmailBlastTier,
    handler: async (
      args: SendEmailArgs,
    ): Promise<SendEmailResult | SendEmailError> => {
      // JSON Schema can't easily express "at least one of html/text" without
      // oneOf gymnastics; enforce here so the error message is friendly.
      if (
        (!args.html || args.html.trim().length === 0) &&
        (!args.text || args.text.trim().length === 0)
      ) {
        return {
          error: 'missing_body',
          message: 'send_email requires at least one of `html` or `text`.',
        };
      }

      try {
        const result = await deps.emailService.send({
          to: args.to,
          subject: args.subject,
          html: args.html,
          text: args.text,
        });

        const out: SendEmailResult = {
          providerMessageId: result.providerMessageId,
          status: result.status,
        };
        if (args.attachInvoiceIds && args.attachInvoiceIds.length > 0) {
          out.attachmentsNotice =
            'Invoice PDF attachments are not yet supported; email was sent without attachments. ' +
            'To share invoices, call `generate_invoices_pdf` and include the signed URL in the body.';
        }
        return out;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: 'send_failed', message };
      }
    },
  };
}
