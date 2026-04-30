import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryService,
  normalizeTunisiaPhone,
} from './delivery.service';

/**
 * Unit tests for DeliveryService — all I/O is mocked. The goal is to
 * pin down:
 *   - happy path → DeliveryLog SENT, email called with subject + attachment
 *   - email failure → DeliveryLog FAILED with the error captured
 *   - WhatsApp → wa.me URL with normalized phone + URL-encoded message,
 *                DeliveryLog PENDING (we cannot confirm receipt)
 *   - phone normalization helper covers the documented edge cases
 */
describe('DeliveryService', () => {
  let service: DeliveryService;
  let prisma: any;
  let email: any;
  let pdf: any;
  let tokens: any;

  beforeEach(() => {
    prisma = {
      invoice: {
        findFirst: jest.fn(async (args: any) => ({
          id: args.where.id,
          garageId: args.where.garageId,
          invoiceNumber: 'INV-2026-0001',
          customer: {
            firstName: 'Aly',
            lastName: 'Ben Khlifa',
            email: 'aly@example.tn',
            phone: '+216 23 456 789',
          },
          garage: { name: 'Garage El Manar' },
        })),
      },
      quote: {
        findFirst: jest.fn(async (args: any) => ({
          id: args.where.id,
          garageId: args.where.garageId,
          quoteNumber: 'DEV-2026-0001',
          customer: {
            firstName: 'Aly',
            lastName: 'Ben Khlifa',
            email: 'aly@example.tn',
            phone: '23456789',
          },
          garage: { name: 'Garage El Manar' },
        })),
      },
      creditNote: { findFirst: jest.fn() },
      deliveryLog: {
        create: jest.fn(async ({ data }: any) => ({
          id: 'log-' + Math.random().toString(36).slice(2, 8),
          createdAt: new Date(),
          ...data,
        })),
      },
    };

    email = {
      send: jest.fn(async () => ({
        providerMessageId: 'mock-1',
        status: 'queued',
      })),
    };

    pdf = {
      renderInvoice: jest.fn(async () => Buffer.from('%PDF-1.4 fake-invoice')),
      renderQuote: jest.fn(async () => Buffer.from('%PDF-1.4 fake-quote')),
      renderCreditNote: jest.fn(async () => Buffer.from('%PDF-1.4 fake-cn')),
    };

    tokens = {
      sign: jest.fn(() => 'signed.jwt.token'),
      verify: jest.fn(),
    };

    const config = {
      get: jest.fn((k: string) => {
        if (k === 'PUBLIC_BASE_URL') return 'https://opauto.test';
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new DeliveryService(prisma, email, pdf, tokens, config);
  });

  describe('deliverInvoice — EMAIL', () => {
    it('renders PDF, sends via EmailService, writes DeliveryLog SENT', async () => {
      const result = await service.deliverInvoice('inv-1', 'g-1', {
        channel: 'EMAIL',
      });

      expect(pdf.renderInvoice).toHaveBeenCalledWith('inv-1', 'g-1', {
        publicToken: 'signed.jwt.token',
      });
      expect(email.send).toHaveBeenCalledTimes(1);

      const call = email.send.mock.calls[0][0];
      expect(call.to).toBe('aly@example.tn');
      expect(call.subject).toBe('Facture INV-2026-0001');
      expect(call.attachments).toHaveLength(1);
      expect(call.attachments[0].filename).toBe('invoice-INV-2026-0001.pdf');
      expect(call.attachments[0].contentType).toBe('application/pdf');
      expect(Buffer.isBuffer(call.attachments[0].content)).toBe(true);

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].channel).toBe('EMAIL');
      expect(result.logs[0].status).toBe('SENT');
      expect(result.logs[0].sentAt).toBeInstanceOf(Date);
      expect(result.logs[0].recipient).toBe('aly@example.tn');
    });

    it('writes DeliveryLog FAILED when email send throws', async () => {
      email.send.mockRejectedValueOnce(new Error('Resend 503'));

      const result = await service.deliverInvoice('inv-1', 'g-1', {
        channel: 'EMAIL',
      });

      expect(result.logs[0].status).toBe('FAILED');
      expect(result.logs[0].error).toContain('Resend 503');
      expect(result.logs[0].sentAt ?? null).toBeNull();
    });

    it('honors `to` override when provided', async () => {
      await service.deliverInvoice('inv-1', 'g-1', {
        channel: 'EMAIL',
        to: 'override@example.tn',
      });
      expect(email.send.mock.calls[0][0].to).toBe('override@example.tn');
    });

    it('writes FAILED when customer has no email and no override', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce({
        id: 'inv-1',
        garageId: 'g-1',
        invoiceNumber: 'INV-2026-0002',
        customer: { firstName: 'A', lastName: 'B', email: null, phone: '23456789' },
        garage: { name: 'G' },
      });
      const result = await service.deliverInvoice('inv-1', 'g-1', {
        channel: 'EMAIL',
      });
      expect(result.logs[0].status).toBe('FAILED');
      expect(result.logs[0].error).toMatch(/no email/i);
      expect(email.send).not.toHaveBeenCalled();
    });

    it('writes FAILED on invalid email', async () => {
      const result = await service.deliverInvoice('inv-1', 'g-1', {
        channel: 'EMAIL',
        to: 'not-an-email',
      });
      expect(result.logs[0].status).toBe('FAILED');
      expect(email.send).not.toHaveBeenCalled();
    });
  });

  describe('deliverInvoice — WHATSAPP', () => {
    it('returns wa.me URL with normalized phone + URL-encoded message + PENDING log', async () => {
      const result = await service.deliverInvoice('inv-1', 'g-1', {
        channel: 'WHATSAPP',
      });

      expect(result.whatsappUrl).toBeDefined();
      expect(result.whatsappUrl).toMatch(/^https:\/\/wa\.me\/21623456789\?text=/);
      // The message must contain the public URL (URL-encoded)
      expect(result.whatsappUrl).toContain(
        encodeURIComponent('https://opauto.test/public/invoices/signed.jwt.token'),
      );

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].channel).toBe('WHATSAPP');
      expect(result.logs[0].status).toBe('PENDING');
      expect(result.logs[0].recipient).toBe('21623456789');
    });

    it('records FAILED log with error when phone is invalid', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce({
        id: 'inv-1',
        garageId: 'g-1',
        invoiceNumber: 'INV-2026-0003',
        customer: {
          firstName: 'A',
          lastName: 'B',
          email: null,
          phone: '12-bad',
        },
        garage: { name: 'G' },
      });
      const result = await service.deliverInvoice('inv-1', 'g-1', {
        channel: 'WHATSAPP',
      });
      expect(result.logs[0].status).toBe('FAILED');
      expect(result.logs[0].error).toMatch(/Invalid Tunisia phone/);
    });

    it('round-trips message with spaces and Arabic characters via URL encoding', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce({
        id: 'inv-1',
        garageId: 'g-1',
        invoiceNumber: 'INV-2026-0004',
        customer: {
          firstName: 'علي',
          lastName: 'بن خليفة',
          email: null,
          phone: '23456789',
        },
        garage: { name: 'G' },
      });
      const result = await service.deliverInvoice('inv-1', 'g-1', {
        channel: 'WHATSAPP',
      });
      const url = result.whatsappUrl!;
      // Pull text param
      const text = decodeURIComponent(
        url.substring(url.indexOf('?text=') + '?text='.length),
      );
      expect(text).toContain('علي بن خليفة');
      expect(text).toContain('INV-2026-0004');
    });
  });

  describe('deliverInvoice — BOTH', () => {
    it('produces two logs and a wa.me URL', async () => {
      const result = await service.deliverInvoice('inv-1', 'g-1', {
        channel: 'BOTH',
      });
      expect(result.logs).toHaveLength(2);
      expect(result.logs.map((l: any) => l.channel).sort()).toEqual([
        'EMAIL',
        'WHATSAPP',
      ]);
      expect(result.whatsappUrl).toMatch(/wa\.me/);
    });

    it('email failure does not block whatsapp', async () => {
      email.send.mockRejectedValueOnce(new Error('boom'));
      const result = await service.deliverInvoice('inv-1', 'g-1', {
        channel: 'BOTH',
      });
      const byCh = Object.fromEntries(result.logs.map((l: any) => [l.channel, l]));
      expect(byCh.EMAIL.status).toBe('FAILED');
      expect(byCh.WHATSAPP.status).toBe('PENDING');
    });
  });

  describe('deliverQuote', () => {
    it('uses Devis subject and quote PDF renderer', async () => {
      await service.deliverQuote('q-1', 'g-1', { channel: 'EMAIL' });
      expect(pdf.renderQuote).toHaveBeenCalledWith('q-1', 'g-1', {
        publicToken: 'signed.jwt.token',
      });
      expect(email.send.mock.calls[0][0].subject).toBe('Devis DEV-2026-0001');
    });
  });
});

describe('normalizeTunisiaPhone', () => {
  it('strips a leading 0 and prepends 216', () => {
    expect(normalizeTunisiaPhone('012345678')).toBe('21612345678');
  });

  it('strips a leading +216 and spaces', () => {
    expect(normalizeTunisiaPhone('+216 12345678')).toBe('21612345678');
  });

  it('accepts a bare 8-digit number', () => {
    expect(normalizeTunisiaPhone('12345678')).toBe('21612345678');
  });

  it('accepts a 216-prefixed number with spaces', () => {
    expect(normalizeTunisiaPhone('216 12345678')).toBe('21612345678');
  });

  it('strips an international 00216 prefix', () => {
    expect(normalizeTunisiaPhone('0021612345678')).toBe('21612345678');
  });

  it('handles dashes and parens', () => {
    expect(normalizeTunisiaPhone('+216 (23) 456-789')).toBe('21623456789');
  });

  it('throws on too-few digits', () => {
    expect(() => normalizeTunisiaPhone('1234567')).toThrow(BadRequestException);
  });

  it('throws on too-many digits', () => {
    expect(() => normalizeTunisiaPhone('123456789')).toThrow(
      BadRequestException,
    );
  });

  it('throws on non-string input', () => {
    expect(() => normalizeTunisiaPhone(undefined as any)).toThrow(
      BadRequestException,
    );
  });
});
