import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryChannel,
  DeliveryStatus,
  DeliveryLog,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { InvoiceTokenService } from '../public/invoice-token.service';
import { PdfRendererService } from './pdf-renderer.service';

export type DocumentKind = 'invoice' | 'quote' | 'creditNote';

export interface DeliverDto {
  channel: DeliveryChannel;
  /** Override recipient — email address or phone number. Defaults to
   *  the customer's stored email/phone. */
  to?: string;
}

export interface DeliveryResult {
  channel: DeliveryChannel;
  /** WhatsApp link to open in a new tab — only set for WHATSAPP/BOTH. */
  whatsappUrl?: string;
  /** DeliveryLog rows created (one per channel). */
  logs: DeliveryLog[];
}

/**
 * DeliveryService — sends invoices/quotes/credit-notes to customers
 * via email (Resend) and/or WhatsApp (wa.me link), and records every
 * attempt in `DeliveryLog`.
 *
 * Channels:
 *   EMAIL    — render PDF, attach, send via EmailService. Status SENT
 *              on success, FAILED on error.
 *   WHATSAPP — build a wa.me URL containing a public-token link to the
 *              PDF. Status PENDING (we cannot confirm delivery via the
 *              click-to-chat flow). The frontend opens the URL in a
 *              new tab.
 *   BOTH     — runs both. Errors in one channel do NOT block the other.
 *
 * Tunisia phone normalization (WhatsApp):
 *   - strip all non-digits
 *   - strip a leading 0 prefix
 *   - if 8 digits, prepend the country code 216
 *   - validate against /^216\d{8}$/
 */
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly pdf: PdfRendererService,
    @Inject(forwardRef(() => InvoiceTokenService))
    private readonly tokens: InvoiceTokenService,
    private readonly config: ConfigService,
  ) {
    this.publicBaseUrl =
      this.config.get<string>('PUBLIC_BASE_URL') ?? 'http://localhost:4200';
  }

  // ── Public entry points ──────────────────────────────────────

  async deliverInvoice(
    invoiceId: string,
    garageId: string,
    dto: DeliverDto,
  ): Promise<DeliveryResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, garageId },
      include: { customer: true, garage: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    return this.deliver({
      kind: 'invoice',
      docId: invoiceId,
      garageId,
      docNumber: invoice.invoiceNumber,
      customerName:
        `${invoice.customer.firstName} ${invoice.customer.lastName}`.trim(),
      customerEmail: invoice.customer.email,
      customerPhone: invoice.customer.phone,
      garageName: invoice.garage.name,
      dto,
    });
  }

  async deliverQuote(
    quoteId: string,
    garageId: string,
    dto: DeliverDto,
  ): Promise<DeliveryResult> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, garageId },
      include: { customer: true, garage: true },
    });
    if (!quote) throw new NotFoundException('Quote not found');

    return this.deliver({
      kind: 'quote',
      docId: quoteId,
      garageId,
      docNumber: quote.quoteNumber,
      customerName:
        `${quote.customer.firstName} ${quote.customer.lastName}`.trim(),
      customerEmail: quote.customer.email,
      customerPhone: quote.customer.phone,
      garageName: quote.garage.name,
      dto,
    });
  }

  async deliverCreditNote(
    creditNoteId: string,
    garageId: string,
    dto: DeliverDto,
  ): Promise<DeliveryResult> {
    const cn = await this.prisma.creditNote.findFirst({
      where: { id: creditNoteId, garageId },
      include: {
        invoice: { include: { customer: true } },
        garage: true,
      },
    });
    if (!cn) throw new NotFoundException('Credit note not found');

    return this.deliver({
      kind: 'creditNote',
      docId: creditNoteId,
      garageId,
      docNumber: cn.creditNoteNumber,
      customerName:
        `${cn.invoice.customer.firstName} ${cn.invoice.customer.lastName}`.trim(),
      customerEmail: cn.invoice.customer.email,
      customerPhone: cn.invoice.customer.phone,
      garageName: cn.garage.name,
      // Credit notes inherit the parent invoice's id for DeliveryLog
      // bookkeeping — DeliveryLog is FK'd to Invoice in the schema.
      invoiceIdForLog: cn.invoiceId,
      dto,
    });
  }

  // ── Core fan-out ─────────────────────────────────────────────

  private async deliver(opts: {
    kind: DocumentKind;
    docId: string;
    garageId: string;
    docNumber: string;
    customerName: string;
    customerEmail?: string | null;
    customerPhone?: string | null;
    garageName: string;
    invoiceIdForLog?: string;
    dto: DeliverDto;
  }): Promise<DeliveryResult> {
    const channel = opts.dto.channel;
    if (!channel) throw new BadRequestException('channel is required');

    // Pre-sign the public token so the same URL is embedded in both
    // email body and WhatsApp link.
    const token = this.tokens.sign(opts.docId, opts.kind);
    const publicUrl = this.publicUrlFor(opts.kind, token);

    const logs: DeliveryLog[] = [];
    let whatsappUrl: string | undefined;

    if (channel === 'EMAIL' || channel === 'BOTH') {
      const log = await this.sendEmail({
        ...opts,
        to: opts.dto.to ?? opts.customerEmail ?? undefined,
        publicUrl,
        token,
      });
      logs.push(log);
    }

    if (channel === 'WHATSAPP' || channel === 'BOTH') {
      const r = await this.buildWhatsapp({
        ...opts,
        to: opts.dto.to ?? opts.customerPhone ?? undefined,
        publicUrl,
      });
      whatsappUrl = r.url;
      logs.push(r.log);
    }

    return { channel, whatsappUrl, logs };
  }

  // ── Email ────────────────────────────────────────────────────

  private async sendEmail(opts: {
    kind: DocumentKind;
    docId: string;
    garageId: string;
    docNumber: string;
    customerName: string;
    garageName: string;
    invoiceIdForLog?: string;
    to?: string;
    publicUrl: string;
    token: string;
  }): Promise<DeliveryLog> {
    if (!opts.to) {
      return this.recordFailure(
        'EMAIL',
        '',
        opts,
        'Customer has no email on file and no override provided',
      );
    }
    const recipient = opts.to.trim();
    if (!isValidEmail(recipient)) {
      return this.recordFailure(
        'EMAIL',
        recipient,
        opts,
        `Invalid email: ${recipient}`,
      );
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.renderPdf(opts.kind, opts.docId, opts.garageId, opts.token);
    } catch (err: any) {
      return this.recordFailure(
        'EMAIL',
        recipient,
        opts,
        `PDF render failed: ${err?.message ?? err}`,
      );
    }

    const subject = subjectFor(opts.kind, opts.docNumber);
    const filename = filenameFor(opts.kind, opts.docNumber);
    const html = renderEmailHtml({
      customerName: opts.customerName,
      garageName: opts.garageName,
      docKind: opts.kind,
      docNumber: opts.docNumber,
      publicUrl: opts.publicUrl,
    });

    try {
      await this.email.send({
        to: recipient,
        subject,
        html,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
    } catch (err: any) {
      return this.recordFailure(
        'EMAIL',
        recipient,
        opts,
        err?.message ?? String(err),
      );
    }

    return this.prisma.deliveryLog.create({
      data: {
        invoiceId: opts.invoiceIdForLog ?? opts.docId,
        channel: 'EMAIL',
        recipient,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  // ── WhatsApp ─────────────────────────────────────────────────

  private async buildWhatsapp(opts: {
    kind: DocumentKind;
    docId: string;
    garageId: string;
    docNumber: string;
    customerName: string;
    invoiceIdForLog?: string;
    to?: string;
    publicUrl: string;
  }): Promise<{ url: string; log: DeliveryLog }> {
    const raw = opts.to;
    if (!raw) {
      const log = await this.recordFailure(
        'WHATSAPP',
        '',
        opts,
        'Customer has no phone on file and no override provided',
      );
      return { url: '', log };
    }

    let normalized: string;
    try {
      normalized = normalizeTunisiaPhone(raw);
    } catch (err: any) {
      const log = await this.recordFailure(
        'WHATSAPP',
        raw,
        opts,
        err?.message ?? 'Invalid phone',
      );
      return { url: '', log };
    }

    const message = whatsappMessage({
      customerName: opts.customerName,
      docKind: opts.kind,
      docNumber: opts.docNumber,
      publicUrl: opts.publicUrl,
    });
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;

    const log = await this.prisma.deliveryLog.create({
      data: {
        invoiceId: opts.invoiceIdForLog ?? opts.docId,
        channel: 'WHATSAPP',
        recipient: normalized,
        // PENDING — wa.me click-to-chat doesn't confirm receipt.
        status: 'PENDING',
        sentAt: null,
      },
    });

    return { url, log };
  }

  // ── helpers ─────────────────────────────────────────────────

  private async renderPdf(
    kind: DocumentKind,
    docId: string,
    garageId: string,
    token: string,
  ): Promise<Buffer> {
    const ctx = { publicToken: token };
    if (kind === 'invoice') return this.pdf.renderInvoice(docId, garageId, ctx);
    if (kind === 'quote') return this.pdf.renderQuote(docId, garageId, ctx);
    return this.pdf.renderCreditNote(docId, garageId, ctx);
  }

  private async recordFailure(
    channel: DeliveryChannel,
    recipient: string,
    opts: { docId: string; invoiceIdForLog?: string },
    error: string,
  ): Promise<DeliveryLog> {
    this.logger.warn(
      `Delivery failed channel=${channel} doc=${opts.docId} recipient=${recipient}: ${error}`,
    );
    return this.prisma.deliveryLog.create({
      data: {
        invoiceId: opts.invoiceIdForLog ?? opts.docId,
        channel,
        recipient,
        status: DeliveryStatus.FAILED,
        error,
      },
    });
  }

  private publicUrlFor(kind: DocumentKind, token: string): string {
    const segment =
      kind === 'invoice'
        ? 'invoices'
        : kind === 'quote'
          ? 'quotes'
          : 'credit-notes';
    return `${this.publicBaseUrl}/public/${segment}/${token}`;
  }
}

// ── Pure helpers (exported for tests) ─────────────────────────

/**
 * Normalize a phone number into Tunisian E.164-without-the-plus form
 * `216XXXXXXXX`. Throws BadRequestException if the input cannot be
 * coerced to that shape.
 */
export function normalizeTunisiaPhone(input: string): string {
  if (typeof input !== 'string') {
    throw new BadRequestException('Phone must be a string');
  }
  // Drop anything that is not a digit (handles "+", spaces, dashes,
  // parens — common phone formats).
  let digits = input.replace(/\D/g, '');

  if (digits.startsWith('00216')) digits = digits.slice(5);
  else if (digits.startsWith('216')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  if (digits.length !== 8) {
    throw new BadRequestException(
      `Invalid Tunisia phone: '${input}' (expected 8 digits after country/leading-zero strip, got ${digits.length})`,
    );
  }

  const out = `216${digits}`;
  if (!/^216\d{8}$/.test(out)) {
    throw new BadRequestException(`Invalid Tunisia phone: '${input}'`);
  }
  return out;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function subjectFor(kind: DocumentKind, docNumber: string): string {
  if (kind === 'invoice') return `Facture ${docNumber}`;
  if (kind === 'quote') return `Devis ${docNumber}`;
  return `Avoir ${docNumber}`;
}

function filenameFor(kind: DocumentKind, docNumber: string): string {
  const safe = docNumber.replace(/[^A-Za-z0-9_-]/g, '-');
  if (kind === 'invoice') return `invoice-${safe}.pdf`;
  if (kind === 'quote') return `quote-${safe}.pdf`;
  return `credit-note-${safe}.pdf`;
}

function renderEmailHtml(opts: {
  customerName: string;
  garageName: string;
  docKind: DocumentKind;
  docNumber: string;
  publicUrl: string;
}): string {
  const docLabel =
    opts.docKind === 'invoice'
      ? 'facture'
      : opts.docKind === 'quote'
        ? 'devis'
        : 'avoir';
  const safeName = escapeHtml(opts.customerName || 'Client');
  const safeGarage = escapeHtml(opts.garageName);
  const safeNumber = escapeHtml(opts.docNumber);
  const safeUrl = escapeHtml(opts.publicUrl);
  return [
    `<p>Bonjour ${safeName},</p>`,
    `<p>Veuillez trouver ci-joint votre ${docLabel} <strong>${safeNumber}</strong>.</p>`,
    `<p>Vous pouvez également la consulter en ligne : <a href="${safeUrl}">${safeUrl}</a></p>`,
    `<p>Cordialement,<br/>${safeGarage}</p>`,
  ].join('\n');
}

function whatsappMessage(opts: {
  customerName: string;
  docKind: DocumentKind;
  docNumber: string;
  publicUrl: string;
}): string {
  const docLabel =
    opts.docKind === 'invoice'
      ? 'votre facture'
      : opts.docKind === 'quote'
        ? 'votre devis'
        : 'votre avoir';
  // TODO i18n — wire to TranslationService once it's exposed at this layer.
  return `Bonjour ${opts.customerName || 'cher client'}, voici ${docLabel} ${opts.docNumber} : ${opts.publicUrl}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
