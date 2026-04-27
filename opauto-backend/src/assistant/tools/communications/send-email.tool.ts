import { AssistantBlastTier } from '@prisma/client';
import { EmailService } from '../../../email/email.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';

export interface SendEmailArgs {
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
  /** Recipient that was actually used (always the authenticated user's email). */
  to: string;
  /** Number of invoices included in the CSV attachment, if any. */
  attachedInvoiceCount?: number;
}

export interface SendEmailError {
  error: 'missing_body' | 'missing_recipient' | 'send_failed';
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

export function createSendEmailTool(deps: {
  emailService: EmailService;
  prisma: PrismaService;
}): ToolDefinition<SendEmailArgs, SendEmailResult | SendEmailError> {
  return {
    name: 'send_email',
    description:
      'Send a transactional email to the authenticated user (the garage owner). The recipient ' +
      'is always resolved server-side from the session — the LLM never specifies it. Use this ' +
      'for "email me the daily report", "send me the at-risk customer list", etc. At least one ' +
      'of `html` or `text` MUST be a non-empty string. ' +
      'IMPORTANT: do NOT call this tool with empty `text`/`html` and an empty ' +
      '`attachInvoiceIds` array. If the user asked for data attached or summarised, call the ' +
      'relevant read tool (list_invoices, get_revenue_summary, list_at_risk_customers, etc.) ' +
      'FIRST, then call send_email with the fetched data baked into `text` and (when invoices ' +
      'were requested as a CSV) the fetched ids passed in `attachInvoiceIds`. ' +
      'When `attachInvoiceIds` is provided, those invoices are fetched (garage-scoped) and ' +
      'attached as a single `invoices.csv` file (number, status, customer, total, paid, ' +
      'outstanding, due, created).',
    parameters: {
      type: 'object',
      properties: {
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
            'Optional list of invoice ids to attach as a single CSV file. Foreign-garage ids are silently filtered out.',
        },
      },
      required: ['subject'],
      additionalProperties: false,
    },
    blastTier: AssistantBlastTier.AUTO_WRITE,
    handler: async (
      args: SendEmailArgs,
      ctx: AssistantUserContext,
    ): Promise<SendEmailResult | SendEmailError> => {
      // Recipient is *always* the authenticated user. The LLM cannot redirect
      // mail elsewhere — that's a hard tenancy boundary, not a default.
      const recipient = ctx.email?.trim();
      if (!recipient) {
        return {
          error: 'missing_recipient',
          message:
            'Cannot send email: the authenticated session has no email address on record. Ask the owner to set their account email under Settings → Profile.',
        };
      }

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
          to: recipient,
          subject: args.subject,
          html: args.html,
          text: args.text,
          attachments,
        });

        const out: SendEmailResult = {
          providerMessageId: result.providerMessageId,
          status: result.status,
          to: recipient,
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
