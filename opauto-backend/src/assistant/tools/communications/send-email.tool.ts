import { AssistantBlastTier } from '@prisma/client';
import { EmailService } from '../../../email/email.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';
import { invoicesToPdf, InvoicePdfRow } from './invoice-pdf';
import { detectToolCallLeak } from '../../leak-detector';

export type AttachmentFormat = 'csv' | 'pdf';

export interface SendEmailArgs {
  subject: string;
  html?: string;
  text?: string;
  /**
   * Optional list of invoice ids to attach. The invoices are fetched
   * (garage-scoped) and packaged according to `attachInvoiceFormat`.
   * Foreign-garage ids are silently filtered out.
   */
  attachInvoiceIds?: string[];
  /**
   * Format for the invoice attachment. Default 'csv' (single spreadsheet
   * row per invoice). 'pdf' produces a multi-page document, one full
   * invoice per page (header, line items, totals, payment status).
   */
  attachInvoiceFormat?: AttachmentFormat;
}

export interface SendEmailResult {
  providerMessageId: string;
  status: string;
  to: string;
  attachedInvoiceCount?: number;
  attachmentFormat?: AttachmentFormat;
}

export interface SendEmailError {
  error: 'missing_body' | 'missing_recipient' | 'send_failed' | 'leak_in_body';
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
  /**
   * Optional supplier of every name the LLM is allowed to call (tools, skills,
   * agents, plus the two reserved pseudo-tools). When provided, send_email
   * scans subject + html + text for tool-call-shaped substrings before
   * dispatching, and aborts with `error: 'leak_in_body'` if any are found.
   * This catches the I-016 failure mode where the model embeds tool-call
   * placeholders (`{get_dashboard_kpis: {}}`) into the email body instead of
   * executing the tools and substituting the results.
   */
  getKnownNames?: () => ReadonlySet<string>;
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
      'were requested) the fetched ids passed in `attachInvoiceIds`. ' +
      'When `attachInvoiceIds` is provided, those invoices are fetched (garage-scoped) and ' +
      'packaged according to `attachInvoiceFormat`: ' +
      "'csv' (default) — a single spreadsheet `invoices.csv` with one row per invoice; " +
      "'pdf' — a multi-page `invoices.pdf` document with one full invoice (header, line items, " +
      "totals, payment status) per page. Use 'pdf' when the user wants 'invoices', 'invoice " +
      "documents', 'PDFs', 'printable copies', or anything that suggests a billing artifact " +
      "rather than a spreadsheet export.",
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
            'Optional list of invoice ids to attach. Foreign-garage ids are silently filtered out.',
        },
        attachInvoiceFormat: {
          type: 'string',
          enum: ['csv', 'pdf'],
          description:
            "Attachment format. Default 'csv' (one row per invoice). 'pdf' renders one full " +
            'invoice per page, suitable for printing or sharing with a customer.',
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
      const recipient = ctx.email?.trim();
      if (!recipient) {
        return {
          error: 'missing_recipient',
          message:
            'Cannot send email: the authenticated session has no email address on record. Ask the owner to set their account email under Settings → Profile.',
        };
      }

      if (
        (!args.html || args.html.trim().length === 0) &&
        (!args.text || args.text.trim().length === 0)
      ) {
        return {
          error: 'missing_body',
          message: 'send_email requires at least one of `html` or `text`.',
        };
      }

      // I-016 — defense in depth. If a knownNames supplier is wired in (the
      // production registrar always provides one), refuse to deliver an email
      // whose subject/body contains tool-call-shaped substrings. The LLM
      // should have executed the tools and substituted the results.
      if (deps.getKnownNames) {
        const known = deps.getKnownNames();
        if (known.size > 0) {
          const haystack = [args.subject, args.html ?? '', args.text ?? '']
            .filter((s) => s && s.length > 0)
            .join('\n');
          const leak = detectToolCallLeak(haystack, known);
          if (leak) {
            return {
              error: 'leak_in_body',
              message:
                'send_email body contains tool-call-shaped placeholders ' +
                `(${leak.matches.length} match(es)). Execute the relevant data tools first, ` +
                'then call send_email with the actual values inlined into html/text.',
            };
          }
        }
      }

      const format: AttachmentFormat = args.attachInvoiceFormat ?? 'csv';
      let attachments:
        | { filename: string; content: string; contentType: string }[]
        | undefined;
      let attachedInvoiceCount = 0;

      if (args.attachInvoiceIds && args.attachInvoiceIds.length > 0) {
        const include =
          format === 'pdf'
            ? {
                customer: true,
                car: { select: { make: true, model: true, licensePlate: true, year: true } },
                payments: { select: { amount: true } },
                lineItems: true,
                garage: { select: { name: true, address: true, phone: true, email: true } },
              }
            : {
                customer: { select: { firstName: true, lastName: true } },
                payments: { select: { amount: true } },
              };

        const rows = await deps.prisma.invoice.findMany({
          where: {
            id: { in: args.attachInvoiceIds },
            garageId: ctx.garageId,
          },
          include: include as any,
          orderBy: { createdAt: 'desc' },
        });

        if (rows.length > 0) {
          if (format === 'pdf') {
            const garage = (rows[0] as any).garage as {
              name: string;
              address: string | null;
              phone: string | null;
              email: string | null;
            };
            const pdfRows: InvoicePdfRow[] = rows.map((inv: any) => {
              const paid = (inv.payments ?? []).reduce(
                (s: number, p: any) => s + p.amount,
                0,
              );
              return {
                invoiceNumber: inv.invoiceNumber,
                status: inv.status,
                customer: `${inv.customer.firstName} ${inv.customer.lastName}`.trim(),
                customerPhone: inv.customer.phone ?? null,
                customerEmail: inv.customer.email ?? null,
                customerAddress: inv.customer.address ?? null,
                carLabel: inv.car
                  ? `${inv.car.year} ${inv.car.make} ${inv.car.model} · ${inv.car.licensePlate}`
                  : null,
                subtotal: inv.subtotal,
                discount: inv.discount,
                taxAmount: inv.taxAmount,
                total: inv.total,
                paid,
                outstanding: Math.max(0, inv.total - paid),
                dueDate: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : '',
                createdAt: inv.createdAt.toISOString().slice(0, 10),
                paidAt: inv.paidAt ? inv.paidAt.toISOString().slice(0, 10) : null,
                lineItems: (inv.lineItems ?? []).map((li: any) => ({
                  description: li.description,
                  quantity: li.quantity,
                  unitPrice: li.unitPrice,
                  total: li.total,
                })),
              };
            });
            const pdfBuffer = await invoicesToPdf(pdfRows, {
              garageName: garage.name,
              garageAddress: garage.address,
              garagePhone: garage.phone,
              garageEmail: garage.email,
            });
            attachments = [
              {
                filename: 'invoices.pdf',
                content: pdfBuffer.toString('base64'),
                contentType: 'application/pdf',
              },
            ];
          } else {
            const csvRows: InvoiceCsvRow[] = rows.map((inv: any) => {
              const paid = inv.payments.reduce(
                (s: number, p: any) => s + p.amount,
                0,
              );
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
          }
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
          out.attachmentFormat = format;
        }
        return out;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: 'send_failed', message };
      }
    },
  };
}
