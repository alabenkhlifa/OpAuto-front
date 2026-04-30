import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LRUCache } from 'lru-cache';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';

type DocKind = 'invoice' | 'quote' | 'creditNote';

interface RenderContext {
  publicToken?: string;
}

interface CacheKey {
  kind: DocKind;
  id: string;
  updatedAt: string; // ISO; Buffer changes when this changes
  publicToken?: string; // QR url depends on token, must invalidate
}

/**
 * PdfRendererService — renders fiscal-compliant Tunisian PDFs for
 * invoices, quotes (devis) and credit notes (avoirs).
 *
 * Layout: A4 portrait, 50pt margins, Helvetica family. Sections:
 *
 *   ┌──────────────────────────────────────┐
 *   │ [Logo]   GARAGE NAME                 │ Header
 *   │          Address · Phone · Email     │
 *   │          MF: ... · RIB: ...          │
 *   │                                      │
 *   │ FACTURE INV-2026-0001    Date: ...   │ Title bar
 *   │                          Échéance:.. │
 *   │                                      │
 *   │ Client                Véhicule       │ Two-column meta
 *   │ Name, addr, MF        Make/Model/Imm │
 *   │                                      │
 *   │ ┌──────────────────────────────────┐ │
 *   │ │ Description │ Qty │ HT │ TVA% │ … │ Line table
 *   │ └──────────────────────────────────┘ │
 *   │                                      │
 *   │                  Sous-total HT  ...  │
 *   │                  TVA 19%       ...   │ Totals box
 *   │                  Timbre fiscal 1.000 │
 *   │                  Total TTC      ...  │
 *   │                                      │
 *   │ Notes/Conditions de paiement   [QR]  │ Footer
 *   └──────────────────────────────────────┘
 *
 * Caching:
 *   In-memory LRU keyed on `${kind}:${id}:${updatedAt}:${publicToken}`.
 *   The `updatedAt` field guarantees natural invalidation when the
 *   underlying record mutates, and the token is part of the key because
 *   the embedded QR code depends on it.
 *
 * RTL/Arabic limitation:
 *   pdfkit v0.18 does not implement RTL line breaking. Arabic text in
 *   names/notes will render LTR (visually wrong but legible). Acceptable
 *   for v1; replace with @react-pdf/renderer or Puppeteer if RTL becomes
 *   a hard requirement.
 */
@Injectable()
export class PdfRendererService {
  private readonly logger = new Logger(PdfRendererService.name);
  private readonly cache: LRUCache<string, Buffer>;
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.cache = new LRUCache<string, Buffer>({ max: 50 });
    this.publicBaseUrl =
      this.config.get<string>('PUBLIC_BASE_URL') ?? 'http://localhost:4200';
  }

  // ── Public API ────────────────────────────────────────────────

  async renderInvoice(
    invoiceId: string,
    garageId: string,
    ctx: RenderContext = {},
  ): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, garageId },
      include: {
        customer: true,
        car: true,
        lineItems: true,
        payments: true,
        garage: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    return this.cached(
      {
        kind: 'invoice',
        id: invoice.id,
        updatedAt: invoice.updatedAt.toISOString(),
        publicToken: ctx.publicToken,
      },
      () =>
        this.renderDocument({
          kind: 'invoice',
          docTitle: 'FACTURE',
          docNumber: invoice.invoiceNumber,
          dateLabel: 'Date',
          date: invoice.createdAt,
          secondaryDateLabel: 'Échéance',
          secondaryDate: invoice.dueDate,
          garage: invoice.garage,
          customer: invoice.customer,
          car: invoice.car,
          lineItems: invoice.lineItems,
          subtotal: invoice.subtotal,
          taxAmount: invoice.taxAmount,
          discount: invoice.discount,
          fiscalStamp: invoice.fiscalStamp,
          total: invoice.total,
          currency: invoice.currency,
          paidAmount: invoice.payments.reduce((s, p) => s + p.amount, 0),
          notes: invoice.notes,
          publicToken: ctx.publicToken,
        }),
    );
  }

  async renderQuote(
    quoteId: string,
    garageId: string,
    ctx: RenderContext = {},
  ): Promise<Buffer> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, garageId },
      include: {
        customer: true,
        car: true,
        lineItems: true,
        garage: true,
      },
    });
    if (!quote) throw new NotFoundException('Quote not found');

    return this.cached(
      {
        kind: 'quote',
        id: quote.id,
        updatedAt: quote.updatedAt.toISOString(),
        publicToken: ctx.publicToken,
      },
      () =>
        this.renderDocument({
          kind: 'quote',
          docTitle: 'DEVIS',
          docNumber: quote.quoteNumber,
          dateLabel: 'Date',
          date: quote.createdAt,
          secondaryDateLabel: 'Valable jusqu\'au',
          secondaryDate: quote.validUntil,
          garage: quote.garage,
          customer: quote.customer,
          car: quote.car,
          lineItems: quote.lineItems,
          subtotal: quote.subtotal,
          taxAmount: quote.taxAmount,
          discount: quote.discount,
          fiscalStamp: 0,
          total: quote.total,
          currency: 'TND',
          paidAmount: undefined,
          notes: quote.notes,
          publicToken: ctx.publicToken,
        }),
    );
  }

  async renderCreditNote(
    creditNoteId: string,
    garageId: string,
    ctx: RenderContext = {},
  ): Promise<Buffer> {
    const cn = await this.prisma.creditNote.findFirst({
      where: { id: creditNoteId, garageId },
      include: {
        lineItems: true,
        garage: true,
        invoice: { include: { customer: true, car: true } },
      },
    });
    if (!cn) throw new NotFoundException('Credit note not found');

    return this.cached(
      {
        kind: 'creditNote',
        id: cn.id,
        updatedAt: cn.updatedAt.toISOString(),
        publicToken: ctx.publicToken,
      },
      () =>
        this.renderDocument({
          kind: 'creditNote',
          docTitle: 'AVOIR',
          docNumber: cn.creditNoteNumber,
          dateLabel: 'Date',
          date: cn.createdAt,
          secondaryDateLabel: 'Facture liée',
          secondaryDate: undefined,
          secondaryText: cn.invoice.invoiceNumber,
          garage: cn.garage,
          customer: cn.invoice.customer,
          car: cn.invoice.car,
          lineItems: cn.lineItems,
          subtotal: cn.subtotal,
          taxAmount: cn.taxAmount,
          discount: cn.discount,
          fiscalStamp: 0,
          total: cn.total,
          currency: 'TND',
          paidAmount: undefined,
          notes: cn.reason,
          publicToken: ctx.publicToken,
        }),
    );
  }

  // ── Cache helpers ─────────────────────────────────────────────

  private async cached(
    key: CacheKey,
    factory: () => Promise<Buffer>,
  ): Promise<Buffer> {
    const k = `${key.kind}:${key.id}:${key.updatedAt}:${key.publicToken ?? ''}`;
    const hit = this.cache.get(k);
    if (hit) return hit;
    const buf = await factory();
    this.cache.set(k, buf);
    return buf;
  }

  /** Visible for testing — flushes the LRU. */
  clearCache(): void {
    this.cache.clear();
  }

  // ── Rendering core ────────────────────────────────────────────

  private async renderDocument(opts: {
    kind: DocKind;
    docTitle: string;
    docNumber: string;
    dateLabel: string;
    date: Date;
    secondaryDateLabel: string;
    secondaryDate?: Date | null;
    secondaryText?: string;
    garage: any;
    customer: any;
    car?: any;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      tvaRate: number;
      tvaAmount: number;
      total: number;
    }>;
    subtotal: number;
    taxAmount: number;
    discount: number;
    fiscalStamp: number;
    total: number;
    currency: string;
    paidAmount?: number;
    notes?: string | null;
    publicToken?: string;
  }): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      // Compression disabled so the text content remains as plain hex
      // strings in the output stream — easier to grep, easier to test,
      // and the size delta on a typical 1-2 page fiscal PDF is < 5KB.
      // Set PDF_COMPRESS=true in env if you want the smaller (compressed)
      // output for production traffic.
      compress: this.config.get<string>('PDF_COMPRESS') === 'true',
      info: {
        Title: `${opts.docTitle} ${opts.docNumber}`,
        Author: opts.garage?.name ?? 'OpAuto',
        Producer: 'OpAuto pdfkit',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));

    // Pre-render the QR code (if any) before drawing — pdfkit accepts
    // a data-URL via image() with a base64 buffer.
    let qrPngBuffer: Buffer | undefined;
    if (opts.publicToken) {
      const url = this.publicUrlFor(opts.kind, opts.publicToken);
      qrPngBuffer = await QRCode.toBuffer(url, {
        margin: 0,
        width: 90,
      });
    }

    this.drawHeader(doc, opts.garage);
    this.drawTitleBar(doc, {
      title: opts.docTitle,
      number: opts.docNumber,
      dateLabel: opts.dateLabel,
      date: opts.date,
      secondaryLabel: opts.secondaryDateLabel,
      secondaryDate: opts.secondaryDate ?? null,
      secondaryText: opts.secondaryText,
    });
    this.drawPartiesBlock(doc, opts.customer, opts.car);
    this.drawLineTable(doc, opts.lineItems, opts.currency);
    this.drawTotals(doc, {
      subtotal: opts.subtotal,
      taxAmount: opts.taxAmount,
      discount: opts.discount,
      fiscalStamp: opts.fiscalStamp,
      total: opts.total,
      currency: opts.currency,
      paidAmount: opts.paidAmount,
      lineItems: opts.lineItems,
    });
    this.drawFooter(doc, {
      notes: opts.notes,
      garage: opts.garage,
      qrPngBuffer,
      publicUrl: opts.publicToken
        ? this.publicUrlFor(opts.kind, opts.publicToken)
        : undefined,
    });

    doc.end();

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }

  private publicUrlFor(kind: DocKind, token: string): string {
    const segment =
      kind === 'invoice'
        ? 'invoices'
        : kind === 'quote'
          ? 'quotes'
          : 'credit-notes';
    return `${this.publicBaseUrl}/public/${segment}/${token}`;
  }

  // ── Sections ─────────────────────────────────────────────────

  private drawHeader(doc: PDFKit.PDFDocument, garage: any): void {
    const top = doc.y;
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(garage?.name ?? 'Garage', 50, top, { continued: false });

    const lines: string[] = [];
    if (garage?.address) lines.push(garage.address);
    const contact = [garage?.phone, garage?.email].filter(Boolean).join(' · ');
    if (contact) lines.push(contact);
    if (garage?.mfNumber) lines.push(`MF: ${garage.mfNumber}`);
    const bank = [
      garage?.rib ? `RIB: ${garage.rib}` : null,
      garage?.bankName,
    ]
      .filter(Boolean)
      .join(' · ');
    if (bank) lines.push(bank);

    doc.font('Helvetica').fontSize(9);
    for (const ln of lines) {
      doc.text(ln, 50, doc.y, { width: 500 });
    }

    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .lineWidth(0.5)
      .strokeColor('#cccccc')
      .stroke();
    doc.moveDown(0.5);
  }

  private drawTitleBar(
    doc: PDFKit.PDFDocument,
    opts: {
      title: string;
      number: string;
      dateLabel: string;
      date: Date;
      secondaryLabel: string;
      secondaryDate: Date | null;
      secondaryText?: string;
    },
  ): void {
    const top = doc.y;
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#FF8400')
      .text(`${opts.title} ${opts.number}`, 50, top);
    doc.fillColor('black');

    doc.font('Helvetica').fontSize(10);
    const dateStr = formatDate(opts.date);
    doc.text(`${opts.dateLabel}: ${dateStr}`, 350, top, {
      width: 195,
      align: 'right',
    });

    const secondary =
      opts.secondaryText ??
      (opts.secondaryDate ? formatDate(opts.secondaryDate) : '—');
    doc.text(`${opts.secondaryLabel}: ${secondary}`, 350, top + 14, {
      width: 195,
      align: 'right',
    });

    doc.moveDown(2);
  }

  private drawPartiesBlock(
    doc: PDFKit.PDFDocument,
    customer: any,
    car: any,
  ): void {
    const top = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).text('Client', 50, top);
    if (car) {
      doc.text('Véhicule', 320, top);
    }

    doc.font('Helvetica').fontSize(9);
    let cY = top + 14;
    const fullName = `${customer?.firstName ?? ''} ${customer?.lastName ?? ''}`.trim();
    if (fullName) {
      doc.text(fullName, 50, cY, { width: 250 });
      cY = doc.y;
    }
    if (customer?.address) {
      doc.text(customer.address, 50, cY, { width: 250 });
      cY = doc.y;
    }
    if (customer?.phone) {
      doc.text(`Tél: ${customer.phone}`, 50, cY, { width: 250 });
      cY = doc.y;
    }
    if (customer?.mfNumber) {
      doc.text(`MF: ${customer.mfNumber}`, 50, cY, { width: 250 });
      cY = doc.y;
    }

    if (car) {
      let rY = top + 14;
      doc.text(`${car.make} ${car.model}`.trim(), 320, rY, { width: 230 });
      rY = doc.y;
      doc.text(`Imm: ${car.licensePlate}`, 320, rY, { width: 230 });
      rY = doc.y;
      if (car.year) {
        doc.text(`Année: ${car.year}`, 320, rY, { width: 230 });
      }
    }

    doc.y = Math.max(doc.y, cY) + 12;
  }

  private drawLineTable(
    doc: PDFKit.PDFDocument,
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      tvaRate: number;
      tvaAmount: number;
      total: number;
    }>,
    currency: string,
  ): void {
    const cols = [
      { x: 50, w: 215, label: 'Description', align: 'left' as const },
      { x: 265, w: 35, label: 'Qté', align: 'right' as const },
      { x: 300, w: 70, label: 'PU HT', align: 'right' as const },
      { x: 370, w: 40, label: 'TVA %', align: 'right' as const },
      { x: 410, w: 60, label: 'TVA', align: 'right' as const },
      { x: 470, w: 75, label: 'Total HT', align: 'right' as const },
    ];

    const headerY = doc.y;
    doc
      .rect(50, headerY - 2, 495, 16)
      .fillColor('#f3f4f6')
      .fill();
    doc.fillColor('black').font('Helvetica-Bold').fontSize(9);
    for (const c of cols) {
      doc.text(c.label, c.x + 2, headerY, { width: c.w - 4, align: c.align });
    }

    doc.y = headerY + 16;
    doc.font('Helvetica').fontSize(9);

    for (const li of items) {
      const rowY = doc.y + 2;
      // Description first to know its rendered height.
      doc.text(li.description, cols[0].x + 2, rowY, {
        width: cols[0].w - 4,
        align: cols[0].align,
      });
      const descBottom = doc.y;

      const lineHt = (li.quantity * li.unitPrice) - (li.unitPrice * li.quantity * 0); // pre-discount HT — keep simple
      const lineHTNet = li.total - li.tvaAmount;

      doc.text(formatNumber(li.quantity), cols[1].x + 2, rowY, {
        width: cols[1].w - 4,
        align: cols[1].align,
      });
      doc.text(formatMoney(li.unitPrice), cols[2].x + 2, rowY, {
        width: cols[2].w - 4,
        align: cols[2].align,
      });
      doc.text(`${li.tvaRate}%`, cols[3].x + 2, rowY, {
        width: cols[3].w - 4,
        align: cols[3].align,
      });
      doc.text(formatMoney(li.tvaAmount), cols[4].x + 2, rowY, {
        width: cols[4].w - 4,
        align: cols[4].align,
      });
      doc.text(formatMoney(lineHTNet), cols[5].x + 2, rowY, {
        width: cols[5].w - 4,
        align: cols[5].align,
      });

      doc.y = descBottom + 4;
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .lineWidth(0.25)
        .strokeColor('#e5e7eb')
        .stroke();
    }

    doc.moveDown(0.5);
  }

  private drawTotals(
    doc: PDFKit.PDFDocument,
    opts: {
      subtotal: number;
      taxAmount: number;
      discount: number;
      fiscalStamp: number;
      total: number;
      currency: string;
      paidAmount?: number;
      lineItems: Array<{ tvaRate: number; tvaAmount: number }>;
    },
  ): void {
    const boxX = 340;
    const boxW = 205;
    let y = doc.y + 4;

    const cur = opts.currency || 'TND';

    const row = (label: string, value: string, bold = false): void => {
      if (bold) doc.font('Helvetica-Bold');
      else doc.font('Helvetica');
      doc.fontSize(9).text(label, boxX, y, { width: 110, align: 'left' });
      doc.text(value, boxX + 110, y, { width: boxW - 110, align: 'right' });
      y += 14;
    };

    row('Sous-total HT', `${formatMoney(opts.subtotal)} ${cur}`);

    if (opts.discount && opts.discount > 0) {
      row('Remise', `- ${formatMoney(opts.discount)} ${cur}`);
    }

    // Breakdown by TVA rate (aggregate from line items).
    const byRate = new Map<number, number>();
    for (const li of opts.lineItems) {
      byRate.set(li.tvaRate, (byRate.get(li.tvaRate) ?? 0) + li.tvaAmount);
    }
    const sortedRates = [...byRate.keys()].sort((a, b) => a - b);
    for (const rate of sortedRates) {
      row(`TVA ${rate}%`, `${formatMoney(byRate.get(rate)!)} ${cur}`);
    }

    if (opts.fiscalStamp && opts.fiscalStamp > 0) {
      row('Timbre fiscal', `${formatMoney(opts.fiscalStamp)} ${cur}`);
    }

    doc
      .moveTo(boxX, y - 2)
      .lineTo(boxX + boxW, y - 2)
      .lineWidth(0.5)
      .strokeColor('#999999')
      .stroke();
    row('Total TTC', `${formatMoney(opts.total)} ${cur}`, true);

    if (opts.paidAmount !== undefined) {
      const remaining = round3(opts.total - opts.paidAmount);
      row('Payé', `${formatMoney(opts.paidAmount)} ${cur}`);
      row('Reste à payer', `${formatMoney(remaining)} ${cur}`, true);
    }

    doc.y = y + 4;
  }

  private drawFooter(
    doc: PDFKit.PDFDocument,
    opts: {
      notes?: string | null;
      garage: any;
      qrPngBuffer?: Buffer;
      publicUrl?: string;
    },
  ): void {
    doc.moveDown(1);
    const footY = Math.max(doc.y, 720);
    doc
      .moveTo(50, footY)
      .lineTo(545, footY)
      .lineWidth(0.5)
      .strokeColor('#cccccc')
      .stroke();

    doc.font('Helvetica').fontSize(8).fillColor('#374151');
    let textY = footY + 6;
    if (opts.notes) {
      doc.text(opts.notes, 50, textY, { width: 380 });
      textY = doc.y + 4;
    }
    const terms = opts.garage?.defaultPaymentTermsDays
      ? `Conditions de paiement: ${opts.garage.defaultPaymentTermsDays} jours.`
      : null;
    if (terms) {
      doc.text(terms, 50, textY, { width: 380 });
    }

    if (opts.qrPngBuffer) {
      // Anchor the QR to the bottom-right of the page.
      doc.image(opts.qrPngBuffer, 455, footY + 6, { width: 90, height: 90 });
      if (opts.publicUrl) {
        doc.fontSize(7).fillColor('#6b7280').text(
          'Consulter en ligne',
          455,
          footY + 100,
          { width: 90, align: 'center' },
        );
      }
    }
    doc.fillColor('black');
  }
}

// ── Pure helpers ───────────────────────────────────────────────

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

function formatMoney(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0.000';
  return n.toFixed(3);
}

function formatNumber(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function formatDate(d: Date | string): string {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
