import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PdfRendererService } from '../invoicing/pdf-renderer.service';
import { InvoiceTokenService } from './invoice-token.service';

/**
 * InvoicePublicController — token-gated, public PDF endpoints.
 *
 * Routes
 *   GET /public/invoices/:token       → invoice PDF (also marks VIEWED)
 *   GET /public/quotes/:token         → quote PDF
 *   GET /public/credit-notes/:token   → credit note PDF
 *
 * No JwtAuthGuard — the JWT in the URL IS the credential.
 * Tokens are signed by InvoiceTokenService and carry the document id +
 * a `type` discriminator so a token cannot be replayed across routes.
 *
 * VIEWED side-effect (invoices only):
 *   When an invoice is currently SENT, the first successful render
 *   transitions it to VIEWED. Subsequent renders are no-ops.
 *   PARTIALLY_PAID/PAID are NOT downgraded to VIEWED.
 */
@ApiTags('public')
@Controller('public')
export class InvoicePublicController {
  private readonly logger = new Logger(InvoicePublicController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfRendererService,
    private readonly tokens: InvoiceTokenService,
  ) {}

  @Get('invoices/:token')
  async getInvoicePdf(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const payload = this.tokens.verify(token, 'invoice');
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: payload.id },
      select: { id: true, garageId: true, status: true, invoiceNumber: true },
    });
    // S-EDGE-015 — token verifies but resource is gone (e.g. DRAFT was
    // deleted). Surface 404 (not 401) so the public link tells the
    // recipient "this document no longer exists" rather than implying
    // the token is invalid.
    if (!invoice) throw new NotFoundException('Invoice not found');

    const buf = await this.pdf.renderInvoice(invoice.id, invoice.garageId, {
      publicToken: token,
    });

    // Side-effect: SENT → VIEWED on first successful render. We use
    // updateMany with a status guard to keep this idempotent and to
    // avoid downgrading PAID/PARTIALLY_PAID/CANCELLED invoices.
    if (invoice.status === InvoiceStatus.SENT) {
      try {
        await this.prisma.invoice.updateMany({
          where: { id: invoice.id, status: InvoiceStatus.SENT },
          data: { status: InvoiceStatus.VIEWED },
        });
      } catch (err: any) {
        // Side-effect failure must NOT prevent PDF delivery.
        this.logger.warn(
          `Failed to mark invoice ${invoice.id} as VIEWED: ${err?.message ?? err}`,
        );
      }
    }

    this.sendPdf(res, `invoice-${invoice.invoiceNumber}.pdf`, buf);
  }

  @Get('quotes/:token')
  async getQuotePdf(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const payload = this.tokens.verify(token, 'quote');
    const quote = await this.prisma.quote.findUnique({
      where: { id: payload.id },
      select: { id: true, garageId: true, quoteNumber: true },
    });
    // S-EDGE-015 parity for quotes — see invoice handler above.
    if (!quote) throw new NotFoundException('Quote not found');

    const buf = await this.pdf.renderQuote(quote.id, quote.garageId, {
      publicToken: token,
    });
    this.sendPdf(res, `quote-${quote.quoteNumber}.pdf`, buf);
  }

  @Get('credit-notes/:token')
  async getCreditNotePdf(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const payload = this.tokens.verify(token, 'creditNote');
    const cn = await this.prisma.creditNote.findUnique({
      where: { id: payload.id },
      select: { id: true, garageId: true, creditNoteNumber: true },
    });
    // S-EDGE-015 parity for credit notes — see invoice handler above.
    if (!cn) throw new NotFoundException('Credit note not found');

    const buf = await this.pdf.renderCreditNote(cn.id, cn.garageId, {
      publicToken: token,
    });
    this.sendPdf(res, `credit-note-${cn.creditNoteNumber}.pdf`, buf);
  }

  // ── helpers ─────────────────────────────────────────────────

  private sendPdf(res: Response, filename: string, buf: Buffer): void {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename.replace(/"/g, '')}"`,
    );
    res.setHeader('Content-Length', String(buf.length));
    res.end(buf);
  }
}
