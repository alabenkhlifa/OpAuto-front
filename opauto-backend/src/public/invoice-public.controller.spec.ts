import { ConfigService } from '@nestjs/config';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { InvoicePublicController } from './invoice-public.controller';
import { InvoiceTokenService } from './invoice-token.service';

/**
 * Unit tests for InvoiceTokenService and InvoicePublicController.
 * Heavy integration (real DB + JWT round-trip) lives in the e2e suite;
 * here we cover the pure logic — token sign/verify, expiry, type
 * mismatch — and the controller's VIEWED side-effect.
 */
describe('InvoiceTokenService', () => {
  let svc: InvoiceTokenService;
  let jwt: JwtService;

  beforeEach(() => {
    jwt = new JwtService({});
    const config = {
      get: jest.fn((k: string) => {
        if (k === 'INVOICE_TOKEN_SECRET') return 'unit-test-secret';
        if (k === 'INVOICE_TOKEN_EXPIRES_IN') return '30d';
        return undefined;
      }),
    } as unknown as ConfigService;
    svc = new InvoiceTokenService(jwt, config);
  });

  it('signs and verifies a token round-trip', () => {
    const token = svc.sign('inv-1', 'invoice');
    expect(typeof token).toBe('string');
    const payload = svc.verify(token);
    expect(payload.id).toBe('inv-1');
    expect(payload.type).toBe('invoice');
  });

  it('rejects a token signed with a different secret', () => {
    const otherJwt = new JwtService({});
    const bad = otherJwt.sign({ id: 'x', type: 'invoice' }, { secret: 'wrong' });
    expect(() => svc.verify(bad)).toThrow(UnauthorizedException);
  });

  it('rejects a token whose type does not match expected', () => {
    const t = svc.sign('q-1', 'quote');
    expect(() => svc.verify(t, 'invoice')).toThrow(UnauthorizedException);
    expect(() => svc.verify(t, 'creditNote')).toThrow(UnauthorizedException);
    // matching type passes
    expect(svc.verify(t, 'quote').id).toBe('q-1');
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(
      { id: 'inv-1', type: 'invoice' },
      { secret: 'unit-test-secret', expiresIn: '-1s' },
    );
    expect(() => svc.verify(expired)).toThrow(UnauthorizedException);
    try {
      svc.verify(expired);
    } catch (e: any) {
      expect(e.message.toLowerCase()).toContain('expired');
    }
  });

  it('rejects a token without id/type claims', () => {
    const malformed = jwt.sign(
      { foo: 'bar' },
      { secret: 'unit-test-secret', expiresIn: '1h' },
    );
    expect(() => svc.verify(malformed)).toThrow(UnauthorizedException);
  });

  it('throws TokenExpiredError mapping cleanly', () => {
    // sanity: our verify catches TokenExpiredError correctly
    const verify = jest
      .spyOn(jwt, 'verify')
      .mockImplementationOnce(() => {
        throw new TokenExpiredError('jwt expired', new Date(0));
      });
    expect(() => svc.verify('whatever')).toThrow(/expired/i);
    verify.mockRestore();
  });
});

describe('InvoicePublicController', () => {
  let controller: InvoicePublicController;
  let prisma: any;
  let pdf: any;
  let tokens: any;
  let res: any;

  beforeEach(() => {
    prisma = {
      invoice: {
        findUnique: jest.fn(),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      quote: { findUnique: jest.fn() },
      creditNote: { findUnique: jest.fn() },
    };
    pdf = {
      renderInvoice: jest.fn(async () => Buffer.from('%PDF-1.4 fake-inv')),
      renderQuote: jest.fn(async () => Buffer.from('%PDF-1.4 fake-q')),
      renderCreditNote: jest.fn(async () => Buffer.from('%PDF-1.4 fake-cn')),
    };
    tokens = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    res = makeRes();
    controller = new InvoicePublicController(prisma, pdf, tokens);
  });

  describe('getInvoicePdf', () => {
    it('verifies token, loads invoice, returns PDF, transitions SENT → VIEWED', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'inv-1', type: 'invoice' });
      prisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        garageId: 'g-1',
        status: 'SENT',
        invoiceNumber: 'INV-2026-0001',
      });

      await controller.getInvoicePdf('signed.token', res);

      expect(tokens.verify).toHaveBeenCalledWith('signed.token', 'invoice');
      expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
        where: { id: 'inv-1', status: 'SENT' },
        data: { status: 'VIEWED' },
      });
      expect(res.headers['Content-Type']).toBe('application/pdf');
      expect(res.headers['Content-Disposition']).toContain(
        'invoice-INV-2026-0001.pdf',
      );
      expect(res.bodyBuffer?.slice(0, 4).toString()).toBe('%PDF');
    });

    it('does NOT update status when invoice is PAID', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'inv-1', type: 'invoice' });
      prisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        garageId: 'g-1',
        status: 'PAID',
        invoiceNumber: 'INV-2026-0002',
      });

      await controller.getInvoicePdf('signed.token', res);
      expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    });

    it('still serves PDF when the VIEWED update throws', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'inv-1', type: 'invoice' });
      prisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'inv-1',
        garageId: 'g-1',
        status: 'SENT',
        invoiceNumber: 'INV-2026-0003',
      });
      prisma.invoice.updateMany.mockRejectedValueOnce(new Error('DB busy'));

      await controller.getInvoicePdf('signed.token', res);
      expect(res.bodyBuffer?.slice(0, 4).toString()).toBe('%PDF');
    });

    it('throws when invoice missing', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'gone', type: 'invoice' });
      prisma.invoice.findUnique.mockResolvedValueOnce(null);
      await expect(
        controller.getInvoicePdf('signed.token', res),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rethrows token verification errors', async () => {
      tokens.verify.mockImplementationOnce(() => {
        throw new UnauthorizedException('Invalid token');
      });
      await expect(
        controller.getInvoicePdf('bad', res),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getQuotePdf', () => {
    it('serves quote PDF and never touches invoice status', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'q-1', type: 'quote' });
      prisma.quote.findUnique.mockResolvedValueOnce({
        id: 'q-1',
        garageId: 'g-1',
        quoteNumber: 'DEV-2026-0001',
      });
      await controller.getQuotePdf('t', res);
      expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
      expect(pdf.renderQuote).toHaveBeenCalledWith('q-1', 'g-1', {
        publicToken: 't',
      });
    });
  });

  describe('getCreditNotePdf', () => {
    it('serves credit note PDF', async () => {
      tokens.verify.mockReturnValueOnce({ id: 'cn-1', type: 'creditNote' });
      prisma.creditNote.findUnique.mockResolvedValueOnce({
        id: 'cn-1',
        garageId: 'g-1',
        creditNoteNumber: 'AVO-2026-0001',
      });
      await controller.getCreditNotePdf('t', res);
      expect(pdf.renderCreditNote).toHaveBeenCalledWith('cn-1', 'g-1', {
        publicToken: 't',
      });
    });
  });
});

function makeRes(): any {
  const headers: Record<string, string> = {};
  return {
    headers,
    bodyBuffer: undefined as Buffer | undefined,
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    end(buf: Buffer) {
      this.bodyBuffer = buf;
    },
  };
}
