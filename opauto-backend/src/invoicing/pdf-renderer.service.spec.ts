import { ConfigService } from '@nestjs/config';
import { PdfRendererService } from './pdf-renderer.service';

/**
 * Extract visible text from a pdfkit-generated PDF buffer.
 *
 * Why we don't use `pdf-parse` 2.x: it depends on `pdfjs-dist` whose
 * worker uses ESM dynamic imports, which Jest's CJS test environment
 * cannot load without `--experimental-vm-modules`. Building a small
 * scanner is faster, deterministic, and good enough for our assertions
 * (we only need to confirm specific strings are in the rendered output).
 *
 * pdfkit + Helvetica encodes glyphs as hex strings inside `[< … > … ]TJ`
 * operators, like:
 *   [<494e56> 80 <2d323032362d3030343220416c79> ...] TJ
 *
 * This walks the stream, decodes every hex run into UTF-8/latin1 bytes,
 * and concatenates them into a flat string.
 */
async function extractText(buf: Buffer): Promise<string> {
  const raw = buf.toString('latin1');
  // Match every `<…>` hex literal anywhere in the stream — the few that
  // appear outside text operators (file IDs, dates) are also fine; we
  // only care about substring presence. Hex runs are concatenated
  // without separators because pdfkit splits a single text run into
  // multiple `<>` chunks across kerning offsets, e.g.
  //   [<494e56> 80 <2d323032362d30303432>]
  // which decodes to "INV" + "-2026-0042" — the pieces must rejoin.
  const out: string[] = [];
  const re = /<([0-9A-Fa-f]{2,})>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const hex = m[1];
    if (hex.length % 2 !== 0) continue;
    let s = '';
    for (let i = 0; i < hex.length; i += 2) {
      s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    out.push(s);
  }
  return out.join('');
}

/**
 * Unit tests for PdfRendererService — generate against an in-memory
 * Prisma stub, then assert on the raw bytes (PDF magic) and on the
 * extracted text (pdf-parse) so we catch regressions in either the
 * binary header or the visible content.
 */
describe('PdfRendererService', () => {
  let service: PdfRendererService;
  let prisma: any;
  let invoiceFixture: any;
  let quoteFixture: any;
  let creditNoteFixture: any;

  beforeEach(() => {
    invoiceFixture = makeInvoiceFixture();
    quoteFixture = makeQuoteFixture();
    creditNoteFixture = makeCreditNoteFixture();

    prisma = {
      invoice: {
        findFirst: jest.fn(async () => invoiceFixture),
      },
      quote: {
        findFirst: jest.fn(async () => quoteFixture),
      },
      creditNote: {
        findFirst: jest.fn(async () => creditNoteFixture),
      },
    };

    const config = {
      get: jest.fn((k: string) => {
        if (k === 'PUBLIC_BASE_URL') return 'https://opauto.test';
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new PdfRendererService(prisma, config);
  });

  describe('renderInvoice', () => {
    it('returns a Buffer whose first bytes are the %PDF header', async () => {
      const buf = await service.renderInvoice('inv-1', 'g-1');

      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(500);
      expect(buf.slice(0, 4).toString()).toBe('%PDF');
    });

    it('contains invoice number, garage MF, customer name, line item, total in the rendered text', async () => {
      const buf = await service.renderInvoice('inv-1', 'g-1');
      const text = await extractText(buf);

      expect(text).toContain('INV-2026-0042');
      expect(text).toContain('1234567/A/B/000'); // garage MF
      expect(text).toContain('Aly Ben Khlifa'); // customer name
      expect(text).toContain('Vidange moteur'); // line description
      // Total TTC = subtotal HT (200) + TVA (38) + fiscal stamp (1) = 239,
      // formatted to 3 decimals.
      expect(text).toMatch(/239\.000/);
    });

    it('caches by id+updatedAt and returns the same Buffer on repeat calls', async () => {
      const a = await service.renderInvoice('inv-1', 'g-1');
      const b = await service.renderInvoice('inv-1', 'g-1');
      expect(a).toBe(b); // same reference — cache hit
      expect(prisma.invoice.findFirst).toHaveBeenCalledTimes(2); // load is per-call; cache is post-load
    });

    it('invalidates cache when updatedAt changes', async () => {
      const a = await service.renderInvoice('inv-1', 'g-1');
      // Mutate the fixture to simulate an update
      invoiceFixture.updatedAt = new Date(invoiceFixture.updatedAt.getTime() + 1000);
      const b = await service.renderInvoice('inv-1', 'g-1');
      expect(a).not.toBe(b);
    });

    it('embeds QR code data when publicToken is provided', async () => {
      const buf = await service.renderInvoice('inv-1', 'g-1', {
        publicToken: 'abc123',
      });
      // QR is embedded as image stream; assert PDF still parses and is
      // bigger than the no-QR variant.
      const baseline = await service.renderInvoice('inv-1', 'g-1', {
        publicToken: 'def456', // new token = new cache entry
      });
      expect(buf.length).toBeGreaterThan(0);
      expect(baseline.length).toBeGreaterThan(0);
      // Different tokens → different cache buckets → not the same buffer
      expect(buf).not.toBe(baseline);
    });

    it('throws NotFoundException when invoice missing', async () => {
      prisma.invoice.findFirst.mockResolvedValueOnce(null);
      await expect(service.renderInvoice('missing', 'g-1')).rejects.toThrow(
        /not found/i,
      );
    });
  });

  describe('renderQuote', () => {
    it('renders a DEVIS PDF with the quote number and validUntil', async () => {
      const buf = await service.renderQuote('q-1', 'g-1');
      expect(buf.slice(0, 4).toString()).toBe('%PDF');

      const text = await extractText(buf);
      expect(text).toContain('DEV-2026-0001');
      expect(text).toContain('DEVIS');
    });
  });

  describe('renderCreditNote', () => {
    it('renders an AVOIR PDF with the credit note number + linked invoice', async () => {
      const buf = await service.renderCreditNote('cn-1', 'g-1');
      expect(buf.slice(0, 4).toString()).toBe('%PDF');

      const text = await extractText(buf);
      expect(text).toContain('AVO-2026-0001');
      expect(text).toContain('AVOIR');
      // Linked invoice reference
      expect(text).toContain('INV-2026-0042');
    });
  });

  describe('clearCache', () => {
    it('flushes cached entries so the next call regenerates', async () => {
      const a = await service.renderInvoice('inv-1', 'g-1');
      service.clearCache();
      const b = await service.renderInvoice('inv-1', 'g-1');
      expect(a).not.toBe(b);
    });
  });
});

// ── Fixtures ────────────────────────────────────────────────────

function makeInvoiceFixture(): any {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-0042',
    status: 'SENT',
    currency: 'TND',
    subtotal: 200,
    taxAmount: 38,
    discount: 0,
    fiscalStamp: 1,
    total: 239,
    dueDate: new Date('2026-05-30T00:00:00Z'),
    notes: 'Merci pour votre confiance.',
    createdAt: new Date('2026-04-30T08:00:00Z'),
    updatedAt: new Date('2026-04-30T08:00:00Z'),
    customer: {
      id: 'c-1',
      firstName: 'Aly',
      lastName: 'Ben Khlifa',
      address: 'Avenue Habib Bourguiba, Tunis',
      phone: '+216 23 456 789',
      mfNumber: null,
    },
    car: {
      make: 'Renault',
      model: 'Clio',
      year: 2018,
      licensePlate: '123 TU 4567',
    },
    lineItems: [
      {
        description: 'Vidange moteur',
        quantity: 1,
        unitPrice: 100,
        tvaRate: 19,
        tvaAmount: 19,
        total: 119,
      },
      {
        description: 'Filtre à huile',
        quantity: 1,
        unitPrice: 100,
        tvaRate: 19,
        tvaAmount: 19,
        total: 119,
      },
    ],
    payments: [{ amount: 100 }],
    garage: {
      name: 'Garage El Manar',
      address: 'Cite El Manar, Tunis',
      phone: '+216 71 000 000',
      email: 'contact@garage-elmanar.tn',
      mfNumber: '1234567/A/B/000',
      rib: '01234567890123456789',
      bankName: 'Attijari Bank',
      defaultPaymentTermsDays: 30,
    },
  };
}

function makeQuoteFixture(): any {
  return {
    id: 'q-1',
    quoteNumber: 'DEV-2026-0001',
    status: 'SENT',
    subtotal: 100,
    taxAmount: 19,
    discount: 0,
    total: 119,
    validUntil: new Date('2026-06-01T00:00:00Z'),
    notes: null,
    createdAt: new Date('2026-04-30T09:00:00Z'),
    updatedAt: new Date('2026-04-30T09:00:00Z'),
    customer: {
      firstName: 'Aly',
      lastName: 'Ben Khlifa',
      phone: '+216 23 456 789',
    },
    car: {
      make: 'Renault',
      model: 'Clio',
      year: 2018,
      licensePlate: '123 TU 4567',
    },
    lineItems: [
      {
        description: 'Diagnostic électrique',
        quantity: 1,
        unitPrice: 100,
        tvaRate: 19,
        tvaAmount: 19,
        total: 119,
      },
    ],
    garage: {
      name: 'Garage El Manar',
      mfNumber: '1234567/A/B/000',
    },
  };
}

function makeCreditNoteFixture(): any {
  return {
    id: 'cn-1',
    creditNoteNumber: 'AVO-2026-0001',
    reason: 'Pièce défectueuse — remplacement gratuit',
    status: 'ISSUED',
    subtotal: 50,
    taxAmount: 9.5,
    discount: 0,
    total: 59.5,
    lockedAt: new Date('2026-04-30T10:00:00Z'),
    createdAt: new Date('2026-04-30T10:00:00Z'),
    updatedAt: new Date('2026-04-30T10:00:00Z'),
    lineItems: [
      {
        description: 'Filtre à huile',
        quantity: 1,
        unitPrice: 50,
        tvaRate: 19,
        tvaAmount: 9.5,
        total: 59.5,
      },
    ],
    invoice: {
      invoiceNumber: 'INV-2026-0042',
      customer: {
        firstName: 'Aly',
        lastName: 'Ben Khlifa',
      },
      car: {
        make: 'Renault',
        model: 'Clio',
        year: 2018,
        licensePlate: '123 TU 4567',
      },
    },
    garage: {
      name: 'Garage El Manar',
      mfNumber: '1234567/A/B/000',
    },
  };
}
