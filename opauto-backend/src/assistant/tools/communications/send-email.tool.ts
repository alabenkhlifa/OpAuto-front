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
  error:
    | 'missing_body'
    | 'missing_recipient'
    | 'missing_attachments'
    | 'send_failed'
    | 'leak_in_body'
    | 'dangling_attachment_reference'
    | 'no_supporting_reads'
    | 'unresolved_placeholder';
  message: string;
}

/**
 * Phrases that signal "this email body is summarising data the LLM should
 * have just fetched". When the model bypasses the read tools and lies about
 * empty results (B-XX, observed 2026-05-04), it almost always uses one of
 * these vocabularies. Combined with `turnState.readToolCallsSoFar === 0`,
 * a hit means the model never actually called a read this turn.
 */
const DATA_SUMMARY_KEYWORDS = [
  'kpi',
  'kpis',
  'revenue',
  'overdue',
  'invoice',
  'invoices',
  'snapshot',
  'briefing',
  'breakdown',
  'at-risk',
  'at risk',
  'low-stock',
  'low stock',
  'active job',
  'top customer',
  'period report',
  'month-end',
  'monthly report',
  'financial report',
  'no data',
  'no data is available',
  'no data available',
] as const;

function bodyLooksLikeDataSummary(haystack: string): boolean {
  const lower = haystack.toLowerCase();
  return DATA_SUMMARY_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Phrases that signal "the email body promises an attachment". Strict patterns
 * — only contexts that uniquely mean a *file is attached to this email*. We
 * deliberately avoid bare "attached" (cf. "attached to the engine block") and
 * require either a co-occurring email-attachment word ("file", "document",
 * "PDF", "CSV", "report attached"), the typical idiom ("please find ...
 * attached"), or the French equivalents ("ci-joint", "pièce jointe").
 */
const ATTACHMENT_INTENT_PATTERNS: RegExp[] = [
  /\bplease find\b[\s\S]{0,80}\battach(?:ed|ment)\b/i,
  /\battach(?:ed|ment)\b[\s\S]{0,40}\b(?:file|document|pdf|csv|report|invoice|spreadsheet|herewith|below|hereto)\b/i,
  /\b(?:file|document|pdf|csv|report|invoice|spreadsheet)\b[\s\S]{0,40}\battach(?:ed|ment)\b/i,
  /\bsee\s+(?:the\s+)?attach(?:ed|ment)\b/i,
  /\battachment\s+(?:below|above|here|hereto|herewith)\b/i,
  /\bin\s+the\s+attachment\b/i,
  /\bci-joint\b/i,
  /\bci-joints?\b/i,
  /\bpi[èe]ce[s]?\s+jointe[s]?\b/i,
  /\bveuillez\s+trouver\b[\s\S]{0,80}\bci-joint\b/i,
];

function bodyReferencesAttachment(haystack: string): boolean {
  return ATTACHMENT_INTENT_PATTERNS.some((re) => re.test(haystack));
}

const UNRESOLVED_PLACEHOLDER_PATTERNS: RegExp[] = [
  /\[(?:date|heure|time|hour|votre\s+nom|your\s+name|nom|name)\]/i,
  /\{\{\s*(?:date|heure|time|hour|votre\s+nom|your\s+name|nom|name)\s*\}\}/i,
  /<(?:date|heure|time|hour|votre\s+nom|your\s+name|nom|name)>/i,
];

function bodyContainsUnresolvedPlaceholder(haystack: string): boolean {
  return UNRESOLVED_PLACEHOLDER_PATTERNS.some((re) => re.test(haystack));
}

function normalizeEmailString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n');
}

function blankToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.trim().length > 0 ? value : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => {
      const lines = paragraph
        .split('\n')
        .map((line) => escapeHtml(line.trimEnd()))
        .join('<br>');
      return `<p>${lines}</p>`;
    })
    .join('\n');
}

function normalizeAttachInvoiceIds(ids: string[] | undefined): string[] {
  if (!ids) return [];

  const normalized: string[] = [];
  for (const raw of ids) {
    const value = raw.trim();
    if (!value) continue;

    if (value.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string' && item.trim().length > 0) {
              normalized.push(item.trim());
            }
          }
          continue;
        }
      } catch {
        // Keep the original value below so the no-match guard can fail safely.
      }
    }

    normalized.push(value);
  }

  return Array.from(new Set(normalized));
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
  ]
    .map(csvCell)
    .join(',');
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
      'Never use placeholders such as [date], [heure], [time], or [Votre nom]; use real values ' +
      'from prior tool results or ask for missing details before sending. ' +
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
      'rather than a spreadsheet export.',
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

      const subject = normalizeEmailString(args.subject).trim();
      const text = blankToUndefined(normalizeEmailString(args.text));
      const providedHtml = blankToUndefined(normalizeEmailString(args.html));
      const html = providedHtml ?? (text ? textToHtml(text) : undefined);

      if (
        (!html || html.trim().length === 0) &&
        (!text || text.trim().length === 0)
      ) {
        return {
          error: 'missing_body',
          message: 'send_email requires at least one of `html` or `text`.',
        };
      }

      const haystack = [subject, html ?? '', text ?? '']
        .filter((s) => s && s.length > 0)
        .join('\n');
      if (bodyContainsUnresolvedPlaceholder(haystack)) {
        return {
          error: 'unresolved_placeholder',
          message:
            'send_email contains an unresolved placeholder such as [date], [heure], or [Votre nom]. Use real values from tool results or ask for the missing details before sending.',
        };
      }

      // I-016 — defense in depth. If a knownNames supplier is wired in (the
      // production registrar always provides one), refuse to deliver an email
      // whose subject/body contains tool-call-shaped substrings. The LLM
      // should have executed the tools and substituted the results.
      if (deps.getKnownNames) {
        const known = deps.getKnownNames();
        if (known.size > 0) {
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

      // Dangling-attachment guard. The model has been observed sending emails
      // whose body promises an attachment ("please find the report attached")
      // while never populating `attachInvoiceIds`. The recipient gets an
      // empty-looking email referring to a phantom file. Reject before send.
      const attachInvoiceIds = normalizeAttachInvoiceIds(args.attachInvoiceIds);
      const hasInvoiceAttachments = attachInvoiceIds.length > 0;
      if (!hasInvoiceAttachments) {
        if (bodyReferencesAttachment(haystack)) {
          return {
            error: 'dangling_attachment_reference',
            message:
              'send_email body references an attachment but no attachInvoiceIds were ' +
              'provided. Either pass the relevant invoice ids in attachInvoiceIds, or ' +
              'remove the attachment language from the body.',
          };
        }
      }

      // No-supporting-reads guard. When the orchestrator has plumbed
      // `turnState`, refuse to send a body that LOOKS like a data summary if
      // zero read tools have run this turn — the LLM is hallucinating empty
      // data (B-XX, "No data is available for ..." with no preceding tool
      // calls). Legacy callers that don't set turnState bypass this gate so
      // unit tests of unrelated paths stay simple.
      if (
        ctx.turnState !== undefined &&
        ctx.turnState.readToolCallsSoFar === 0
      ) {
        if (bodyLooksLikeDataSummary(haystack)) {
          return {
            error: 'no_supporting_reads',
            message:
              'send_email body summarises data (KPIs, revenue, invoices, snapshot, etc.) ' +
              'but no read tool ran this turn. Call the relevant read tool first and ' +
              'inline its result, or remove the data-summary language from the body.',
          };
        }
      }

      const format: AttachmentFormat = args.attachInvoiceFormat ?? 'csv';
      let attachments:
        | { filename: string; content: string; contentType: string }[]
        | undefined;
      let attachedInvoiceCount = 0;

      if (attachInvoiceIds.length > 0) {
        const include =
          format === 'pdf'
            ? {
                customer: true,
                car: {
                  select: {
                    make: true,
                    model: true,
                    licensePlate: true,
                    year: true,
                  },
                },
                payments: { select: { amount: true } },
                lineItems: true,
                garage: {
                  select: {
                    name: true,
                    address: true,
                    phone: true,
                    email: true,
                  },
                },
              }
            : {
                customer: { select: { firstName: true, lastName: true } },
                payments: { select: { amount: true } },
              };

        const rows = await deps.prisma.invoice.findMany({
          where: {
            id: { in: attachInvoiceIds },
            garageId: ctx.garageId,
          },
          include: include as any,
          orderBy: { createdAt: 'desc' },
        });

        if (rows.length === 0) {
          return {
            error: 'missing_attachments',
            message:
              'Could not find any invoices for the requested attachments in this garage. ' +
              'Call the invoice read tool again and pass real invoice ids before sending.',
          };
        }

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
                customer:
                  `${inv.customer.firstName} ${inv.customer.lastName}`.trim(),
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
                dueDate: inv.dueDate
                  ? inv.dueDate.toISOString().slice(0, 10)
                  : '',
                createdAt: inv.createdAt.toISOString().slice(0, 10),
                paidAt: inv.paidAt
                  ? inv.paidAt.toISOString().slice(0, 10)
                  : null,
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
                customer:
                  `${inv.customer.firstName} ${inv.customer.lastName}`.trim(),
                total: inv.total,
                paid,
                outstanding: Math.max(0, inv.total - paid),
                dueDate: inv.dueDate
                  ? inv.dueDate.toISOString().slice(0, 10)
                  : '',
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
          subject,
          html,
          text,
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
