import { AssistantBlastTier } from '@prisma/client';
import { EmailService } from '../../../email/email.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface SendEmailArgs {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  /**
   * Optional list of invoice ids to attach as a single CSV. Each invoice
   * row in the CSV includes invoice number, status, customer, total,
   * paid amount, due date, and created date. Foreign-garage ids are
   * silently filtered out — the email still sends with whatever the
   * user is authorised to access.
   */
  attachInvoiceIds?: string[];
}

export interface SendEmailResult {
  providerMessageId: string;
  status: string;
  /** Number of invoices included in the CSV attachment, if any. */
  attachedInvoiceCount?: number;
}

export interface SendEmailError {
  error: 'missing_body' | 'send_failed';
  message: string;
}

/** RFC 4180-ish CSV cell escape: wrap in quotes + double inner quotes. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const s = String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

interface InvoiceCsvRow {
  invoiceNumber: string;
  status: string;
  customer: string;
  total: number;
  paid: number;
  outstanding: number;
  dueDate: string;
  createdAt: string;
}

function invoicesToCsv(rows: InvoiceCsvRow[]): string {
  const header = [
    'Invoice #',
    'Status',
    'Customer',
    'Total (TND)',
    'Paid (TND)',
    'Outstanding (TND)',
    'Due Date',
    'Created',
  ].map(csvCell).join(',');
  const body = rows
    .map((r) =>
      [
        r.invoiceNumber,
        r.status,
        r.customer,
        r.total.toFixed(2),
        r.paid.toFixed(2),
        r.outstanding.toFixed(2),
        r.dueDate,
        r.createdAt,
      ]
        .map(csvCell)
        .join(','),
    )
    .join('\n');
  return `${header}\n${body}\n`;
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
  prisma: PrismaService;
}): ToolDefinition<SendEmailArgs, SendEmailResult | SendEmailError> {
  return {
    name: 'send_email',
    description:
      'Send a transactional email. The blast tier is resolved at runtime: AUTO_WRITE when the ' +
      'recipient is the authenticated user (self-send, e.g. "email me the daily report"), and ' +
      'CONFIRM_WRITE for any other recipient. At least one of `html` or `text` MUST be a ' +
      'non-empty string — empty bodies are rejected before the user is asked to approve. ' +
      'IMPORTANT: do NOT call this tool with empty `text`/`html` and an empty ' +
      '`attachInvoiceIds` array. If the user asked for data attached or summarised, call the ' +
      'relevant read tool (list_invoices, get_revenue_summary, list_at_risk_customers, etc.) ' +
      'FIRST, then call send_email with the fetched data baked into `text` and (when invoices ' +
      'were requested as a CSV) the fetched ids passed in `attachInvoiceIds`. ' +
      'When `attachInvoiceIds` is provided, those invoices are fetched (garage-scoped) and ' +
      'attached to the email as a single `invoices.csv` file (number, status, customer, total, ' +
      'paid, outstanding, due, created).',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address (e.g. user@example.com).',
        },
        subject: {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Email subject line.',
        },
        html: {
          type: 'string',
          description:
            'HTML body. Either html or text (or both) must be a non-empty string. The handler enforces this — do not omit both fields, do not pass empty strings.',
        },
        text: {
          type: 'string',
          description:
            'Plain-text body. Either html or text (or both) must be a non-empty string. The handler enforces this — do not omit both fields, do not pass empty strings.',
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
      ctx: AssistantUserContext,
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

      let attachments:
        | { filename: string; content: string; contentType: string }[]
        | undefined;
      let attachedInvoiceCount = 0;

      if (args.attachInvoiceIds && args.attachInvoiceIds.length > 0) {
        const rows = await deps.prisma.invoice.findMany({
          where: {
            id: { in: args.attachInvoiceIds },
            garageId: ctx.garageId,
          },
          include: {
            customer: { select: { firstName: true, lastName: true } },
            payments: { select: { amount: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (rows.length > 0) {
          const csvRows: InvoiceCsvRow[] = rows.map((inv) => {
            const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
            return {
              invoiceNumber: inv.invoiceNumber,
              status: inv.status,
              customer: `${inv.customer.firstName} ${inv.customer.lastName}`.trim(),
              total: inv.total,
              paid,
              outstanding: Math.max(0, inv.total - paid),
              dueDate: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : '',
              createdAt: inv.createdAt.toISOString().slice(0, 10),
            };
          });
          const csv = invoicesToCsv(csvRows);
          attachments = [
            {
              filename: 'invoices.csv',
              content: Buffer.from(csv, 'utf8').toString('base64'),
              contentType: 'text/csv',
            },
          ];
          attachedInvoiceCount = rows.length;
        }
      }

      try {
        const result = await deps.emailService.send({
          to: args.to,
          subject: args.subject,
          html: args.html,
          text: args.text,
          attachments,
        });

        const out: SendEmailResult = {
          providerMessageId: result.providerMessageId,
          status: result.status,
        };
        if (attachedInvoiceCount > 0) {
          out.attachedInvoiceCount = attachedInvoiceCount;
        }
        return out;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: 'send_failed', message };
      }
    },
  };
}
