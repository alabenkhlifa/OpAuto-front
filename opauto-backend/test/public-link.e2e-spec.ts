import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { execSync } from 'child_process';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { InvoiceTokenService } from '../src/public/invoice-token.service';

/**
 * Public PDF link e2e — Phase 4.4.
 *
 * Verifies:
 *   - GET /public/invoices/:token returns a real PDF (Content-Type +
 *     `%PDF` magic) and transitions a SENT invoice to VIEWED.
 *   - Second call is idempotent (status stays VIEWED, PDF still served).
 *   - Token signed for a quote cannot be used on the invoice route.
 *
 * Isolated DB pattern follows the rest of the e2e suite — uses
 * `opauto_test`, creates its own fixture rows, cleans up after.
 */
const TEST_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/opauto_test';

describe('Public invoice link (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: InvoiceTokenService;

  // fixture ids
  let garageId: string;
  let customerId: string;
  let invoiceId: string;
  let quoteId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';

    try {
      execSync('npx prisma db push --skip-generate', {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'pipe',
      });
    } catch {
      // ignore — db may already be in sync
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
    tokens = app.get(InvoiceTokenService);

    // Create a fresh, isolated garage + customer + SENT invoice + DRAFT quote.
    const stamp = Date.now();
    const garage = await prisma.garage.create({
      data: {
        name: 'Public Link Test Garage',
        currency: 'TND',
        mfNumber: '9999999/A/B/000',
        rib: '01010101010101010101',
        bankName: 'Test Bank',
      },
    });
    garageId = garage.id;

    const customer = await prisma.customer.create({
      data: {
        garageId,
        firstName: 'Public',
        lastName: 'Link Customer',
        phone: '+216 23 000 000',
        email: 'public-link@example.tn',
      },
    });
    customerId = customer.id;

    const invoice = await prisma.invoice.create({
      data: {
        garageId,
        customerId,
        invoiceNumber: `INV-PL-${stamp}`,
        status: 'SENT',
        subtotal: 100,
        taxAmount: 19,
        discount: 0,
        fiscalStamp: 1,
        total: 120,
        lineItems: {
          create: [
            {
              description: 'Test service',
              quantity: 1,
              unitPrice: 100,
              tvaRate: 19,
              tvaAmount: 19,
              total: 119,
            },
          ],
        },
      },
    });
    invoiceId = invoice.id;

    const quote = await prisma.quote.create({
      data: {
        garageId,
        customerId,
        quoteNumber: `DEV-PL-${stamp}`,
        status: 'SENT',
        subtotal: 50,
        taxAmount: 9.5,
        total: 59.5,
        lineItems: {
          create: [
            {
              description: 'Inspection',
              quantity: 1,
              unitPrice: 50,
              tvaRate: 19,
              tvaAmount: 9.5,
              total: 59.5,
            },
          ],
        },
      },
    });
    quoteId = quote.id;
  });

  afterAll(async () => {
    if (invoiceId) {
      await prisma.invoiceLineItem
        .deleteMany({ where: { invoiceId } })
        .catch(() => {});
      await prisma.invoice.delete({ where: { id: invoiceId } }).catch(() => {});
    }
    if (quoteId) {
      await prisma.quoteLineItem
        .deleteMany({ where: { quoteId } })
        .catch(() => {});
      await prisma.quote.delete({ where: { id: quoteId } }).catch(() => {});
    }
    if (customerId) {
      await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    }
    if (garageId) {
      await prisma.garage.delete({ where: { id: garageId } }).catch(() => {});
    }
    await app.close();
  });

  function fetchPdf(url: string) {
    // supertest defaults treat any unknown content type as text. We tell
    // it to buffer raw bytes so PDF magic / length checks work.
    return request(app.getHttpServer())
      .get(url)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  }

  it('GET /public/invoices/:token serves a PDF and transitions SENT → VIEWED', async () => {
    const token = tokens.sign(invoiceId, 'invoice');

    const res = await fetchPdf(`/api/public/invoices/${token}`).expect(200);

    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toContain('inline');
    const buf = res.body as unknown as Buffer;
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');

    const after = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });
    expect(after?.status).toBe('VIEWED');
  });

  it('Second call is idempotent — status stays VIEWED, PDF still served', async () => {
    const token = tokens.sign(invoiceId, 'invoice');

    const res = await fetchPdf(`/api/public/invoices/${token}`).expect(200);
    expect((res.body as unknown as Buffer).slice(0, 4).toString()).toBe('%PDF');

    const after = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });
    expect(after?.status).toBe('VIEWED');
  });

  it('Quote-typed token cannot be replayed on the invoice route', async () => {
    const quoteToken = tokens.sign(quoteId, 'quote');
    await fetchPdf(`/api/public/invoices/${quoteToken}`).expect(401);
  });

  it('GET /public/quotes/:token serves the quote PDF', async () => {
    const token = tokens.sign(quoteId, 'quote');
    const res = await fetchPdf(`/api/public/quotes/${token}`).expect(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect((res.body as unknown as Buffer).slice(0, 4).toString()).toBe('%PDF');
  });

  it('Returns 401 for an obviously bad token', async () => {
    await fetchPdf('/api/public/invoices/not-a-real-jwt').expect(401);
  });
});
