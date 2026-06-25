import { AssistantBlastTier } from '@prisma/client';
import { EmailService } from '../../../email/email.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssistantUserContext, ToolDefinition } from '../../types';
import { invoicesToPdf, InvoicePdfRow } from './invoice-pdf';
import { detectToolCallLeak } from '../../leak-detector';

export type AttachmentFormat = 'csv' | 'pdf';

export interface SendEmailArgs {
  /**
   * Optional recipient email. Omit for "email me" / owner self-send. For
   * customer emails, pass the customer's actual email and customerId together.
   */
  to?: string;
  customerId?: string;
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
    | 'customer_not_found'
    | 'invalid_recipient'
    | 'missing_body'
    | 'missing_recipient'
    | 'missing_attachments'
    | 'recipient_mismatch'
    | 'send_failed'
    | 'leak_in_body'
    | 'dangling_attachment_reference'
    | 'no_supporting_reads'
    | 'unresolved_placeholder'
    | 'raw_utc_timestamp';
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

function bodyNeedsSupportingReadForDataSummary(
  haystack: string,
  hasInvoiceAttachments: boolean,
): boolean {
  if (!bodyLooksLikeDataSummary(haystack)) return false;

  if (hasInvoiceAttachments) {
    const lower = haystack.toLowerCase();
    const nonInvoiceDataKeywords = DATA_SUMMARY_KEYWORDS.filter(
      (kw) => kw !== 'invoice' && kw !== 'invoices',
    );
    return nonInvoiceDataKeywords.some((kw) => lower.includes(kw));
  }

  return true;
}

function userMessageRequiresAppointmentRead(message: string | undefined): boolean {
  if (!message) return false;
  const asksForAppointment = /\b(?:appointment|appointments|booking|booked|schedule|scheduled|rendez-?vous|rdv)\b/i.test(
    message,
  );
  if (!asksForAppointment) return false;

  const asksForLookup =
    /\b(?:upcoming|next|coming|future|date\s+and\s+time|date\s*&\s*time|date|time|when|details?|confirm(?:ation)?)\b/i.test(
      message,
    );
  if (!asksForLookup) return false;

  return (
    /\bemail\s+(?!(?:address|account|settings)\b)\w+/i.test(message) ||
    /\bsend\s+(?:\w+\s+)*(?:an?\s+)?e-?mails?\b/i.test(message) ||
    /\b(?:via|by|as\s+an?|to\s+my)\s+(?:personal\s+)?e-?mail\b/i.test(
      message,
    ) ||
    /\benvoie[zr]?[\s-]+(?:moi|nous)?\s*(?:un\s+|le\s+)?(?:e-?mail|courriel)\b/i.test(
      message,
    ) ||
    /\bpar\s+(?:e-?mail|courriel)\b/i.test(message) ||
    /إيميل|بريد\s*(?:إلكتروني|الكتروني)/.test(message)
  );
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
  /\[(?:date|heure|time|hour)\]/i,
  /\{\{\s*(?:date|heure|time|hour)\s*\}\}/i,
  /<(?:date|heure|time|hour)>/i,
];

function bodyContainsUnresolvedPlaceholder(haystack: string): boolean {
  return UNRESOLVED_PLACEHOLDER_PATTERNS.some((re) => re.test(haystack));
}

const RAW_UTC_TIMESTAMP_RE =
  /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z\b/;

function bodyContainsRawUtcTimestamp(haystack: string): boolean {
  return RAW_UTC_TIMESTAMP_RE.test(haystack);
}

const SENDER_NAME_PLACEHOLDER_PATTERNS: RegExp[] = [
  /\[(?:your\s+name|sender\s+name|garage\s+name|votre\s+nom|nom|nom\s+du\s+garage|name)\]/gi,
  /\{\{\s*(?:your\s+name|sender\s+name|garage\s+name|votre\s+nom|nom|nom\s+du\s+garage|name)\s*\}\}/gi,
  /<(?:your\s+name|sender\s+name|garage\s+name|votre\s+nom|nom|nom\s+du\s+garage|name)>/gi,
];

function bodyContainsSenderNamePlaceholder(haystack: string): boolean {
  return SENDER_NAME_PLACEHOLDER_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(haystack);
  });
}

function replaceSenderNamePlaceholders(
  value: string | undefined,
  garageName: string,
): string | undefined {
  if (value === undefined) return undefined;
  return SENDER_NAME_PLACEHOLDER_PATTERNS.reduce((out, re) => {
    re.lastIndex = 0;
    return out.replace(re, garageName);
  }, value);
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

function normalizeRecipient(value: string | null | undefined): string | undefined {
  const email = value?.trim();
  return email && email.length > 0 ? email : undefined;
}

function emailsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = normalizeRecipient(left)?.toLowerCase();
  const b = normalizeRecipient(right)?.toLowerCase();
  return !!a && !!b && a === b;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ');
}

function bodyHasProfessionalFooter(value: string, garageName: string): boolean {
  const plain = stripHtmlTags(value).toLowerCase();
  const normalizedGarage = garageName.toLowerCase();
  return (
    plain.includes(normalizedGarage) &&
    (/\b(?:best regards|kind regards|regards|sincerely|cordialement|salutations)\b/i.test(
      plain,
    ) ||
      plain.includes('مع أطيب التحيات'))
  );
}

function footerSignoff(locale: AssistantUserContext['locale']): string {
  if (locale === 'fr') return 'Cordialement';
  if (locale === 'ar') return 'مع أطيب التحيات،';
  return 'Best regards';
}

function appendProfessionalTextFooter(
  value: string,
  garageName: string,
  locale: AssistantUserContext['locale'],
): string {
  if (bodyHasProfessionalFooter(value, garageName)) return value;
  return `${value.trimEnd()}\n\n${footerSignoff(locale)}\n${garageName}`;
}

function appendProfessionalHtmlFooter(
  value: string,
  garageName: string,
  locale: AssistantUserContext['locale'],
): string {
  if (bodyHasProfessionalFooter(value, garageName)) return value;
  return `${value.trimEnd()}\n<p>${escapeHtml(footerSignoff(locale))}<br>${escapeHtml(garageName)}</p>`;
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
  const resolveGarageName = async (
    ctx: AssistantUserContext,
  ): Promise<string | undefined> => {
    const garage = await deps.prisma.garage.findUnique({
      where: { id: ctx.garageId },
      select: { name: true },
    });
    const name = garage?.name?.trim();
    return name && name.length > 0 ? name : undefined;
  };

  const replaceSenderPlaceholdersInArgs = async (
    args: SendEmailArgs,
    ctx: AssistantUserContext,
  ): Promise<SendEmailArgs> => {
    const haystack = [args.subject, args.html ?? '', args.text ?? '']
      .filter((s) => s && s.length > 0)
      .join('\n');
    if (!bodyContainsSenderNamePlaceholder(haystack)) return args;

    const garageName = await resolveGarageName(ctx);
    if (!garageName) return args;

    return {
      ...args,
      subject:
        replaceSenderNamePlaceholders(args.subject, garageName) ?? args.subject,
      html: replaceSenderNamePlaceholders(args.html, garageName),
      text: replaceSenderNamePlaceholders(args.text, garageName),
    };
  };

  const ensureCustomerFooterInArgs = async (
    args: SendEmailArgs,
    ctx: AssistantUserContext,
  ): Promise<SendEmailArgs> => {
    const to = normalizeRecipient(args.to);
    const ownerEmail = normalizeRecipient(ctx.email);
    const isCustomerOrExternal =
      Boolean(args.customerId?.trim()) ||
      Boolean(to && !emailsMatch(to, ownerEmail));
    if (!isCustomerOrExternal) return args;

    const garageName = await resolveGarageName(ctx);
    if (!garageName) return args;

    return {
      ...args,
      html: args.html
        ? appendProfessionalHtmlFooter(args.html, garageName, ctx.locale)
        : args.html,
      text: args.text
        ? appendProfessionalTextFooter(args.text, garageName, ctx.locale)
        : args.text,
    };
  };

  const prepareEmailArgs = async (
    args: SendEmailArgs,
    ctx: AssistantUserContext,
  ): Promise<SendEmailArgs> =>
    ensureCustomerFooterInArgs(
      await replaceSenderPlaceholdersInArgs(args, ctx),
      ctx,
    );

  return {
    name: 'send_email',
    description:
      'Send a transactional email. Omit `to` for "email me", "send me", or owner self-sends; ' +
      'that recipient is resolved server-side from the authenticated session and executes ' +
      'without approval. When the user provides an external email address, pass it in `to`. ' +
      'When emailing a customer resolved through find_customer/get_customer, pass both the ' +
      "customer's real `customerId` and their actual email in `to`. External recipients require " +
      'owner approval before delivery. At least one of `html` or `text` MUST be a non-empty string. ' +
      'Never use placeholders such as [date], [heure], or [time]; use real values ' +
      'from prior tool results or ask for missing details before sending. For sender/signature names, ' +
      'use the garage name; the backend also replaces sender-name placeholders such as [Your Name] with the garage name. ' +
      'For customer-facing appointment emails, use a professional tone, include the garage name, include a footer/signature, and use local display times such as startTimeLocal/endTimeLocal/timeZone rather than raw UTC ISO timestamps ending in Z. ' +
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
        to: {
          type: 'string',
          minLength: 3,
          maxLength: 254,
          description:
            'Recipient email for an explicit external/customer recipient. Omit for owner self-send.',
        },
        customerId: {
          type: 'string',
          description:
            'Customer UUID when the recipient was resolved from find_customer/get_customer. Must match the email in `to`.',
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
    resolveBlastTier: (args: SendEmailArgs, ctx: AssistantUserContext) => {
      const to = normalizeRecipient(args.to);
      const ownerEmail = normalizeRecipient(ctx.email);
      if (args.customerId?.trim()) return AssistantBlastTier.CONFIRM_WRITE;
      if (to && !emailsMatch(to, ownerEmail)) {
        return AssistantBlastTier.CONFIRM_WRITE;
      }
      return AssistantBlastTier.AUTO_WRITE;
    },
    prepareApprovalArgs: prepareEmailArgs,
    handler: async (
      args: SendEmailArgs,
      ctx: AssistantUserContext,
    ): Promise<SendEmailResult | SendEmailError> => {
      const resolvedArgs = await prepareEmailArgs(args, ctx);
      const explicitRecipient = normalizeRecipient(resolvedArgs.to);
      const customerId = resolvedArgs.customerId?.trim();
      let recipient = explicitRecipient;

      if (customerId) {
        const customer = await deps.prisma.customer.findFirst({
          where: { id: customerId, garageId: ctx.garageId },
          select: { id: true, email: true },
        });
        if (!customer) {
          return {
            error: 'customer_not_found',
            message:
              `send_email received customerId="${customerId}", but no customer ` +
              'with that id exists in this garage. Resolve the recipient with find_customer/get_customer first.',
          };
        }

        const customerEmail = normalizeRecipient(customer.email);
        if (!customerEmail) {
          return {
            error: 'missing_recipient',
            message:
              'Cannot send email: the resolved customer has no email address on file.',
          };
        }
        if (explicitRecipient && !emailsMatch(explicitRecipient, customerEmail)) {
          return {
            error: 'recipient_mismatch',
            message:
              'send_email recipient email does not match the resolved customer. Use the email returned by find_customer/get_customer.',
          };
        }
        recipient = customerEmail;
      }

      recipient = recipient ?? normalizeRecipient(ctx.email);
      if (!recipient) {
        return {
          error: 'missing_recipient',
          message:
            'Cannot send email: the authenticated session has no email address on record. Ask the owner to set their account email under Settings → Profile.',
        };
      }
      if (!isValidEmail(recipient)) {
        return {
          error: 'invalid_recipient',
          message: 'Cannot send email: recipient email address is invalid.',
        };
      }

      const subject = normalizeEmailString(resolvedArgs.subject).trim();
      const text = blankToUndefined(normalizeEmailString(resolvedArgs.text));
      const providedHtml = blankToUndefined(normalizeEmailString(resolvedArgs.html));
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

      if (bodyContainsRawUtcTimestamp(haystack)) {
        return {
          error: 'raw_utc_timestamp',
          message:
            'send_email contains a raw UTC ISO timestamp ending in Z. Use a customer-facing local date/time from the appointment result (startTimeLocal/endTimeLocal/timeZone) instead.',
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
      const attachInvoiceIds = normalizeAttachInvoiceIds(resolvedArgs.attachInvoiceIds);
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
        if (
          bodyNeedsSupportingReadForDataSummary(
            haystack,
            hasInvoiceAttachments,
          ) ||
          userMessageRequiresAppointmentRead(ctx.turnState.userMessage)
        ) {
          return {
            error: 'no_supporting_reads',
            message:
              'send_email body summarises data (KPIs, revenue, invoices, appointments, snapshot, etc.) ' +
              'but no read tool ran this turn. Call the relevant read tool first and ' +
              'inline its result, or remove the data-summary language from the body.',
          };
        }
      }

      const format: AttachmentFormat = resolvedArgs.attachInvoiceFormat ?? 'csv';
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
