import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { QuoteService } from './quote.service';

/**
 * QuoteService specs — pin the BE wire shape, especially the approve()
 * response mapping that BUG-105 (Sweep C-4) uncovered. The BE returns
 * `{ quote, invoice: { id } }`; the FE must surface that as
 * `{ quote, invoiceId }` for the existing call sites.
 */
describe('QuoteService — approve mapping (BUG-105, Sweep C-4)', () => {
  let service: QuoteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        QuoteService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(QuoteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps the BE { quote, invoice } shape into { quote, invoiceId } for the FE', (done) => {
    service.approve('q-1').subscribe((res) => {
      expect(res.invoiceId).toBe('inv-1');
      expect(res.quote.id).toBe('q-1');
      expect(res.quote.status).toBe('APPROVED');
      done();
    });

    const req = http.expectOne('/quotes/q-1/approve');
    expect(req.request.method).toBe('POST');
    req.flush({
      quote: {
        id: 'q-1',
        quoteNumber: 'DEV-2026-0001',
        customerId: 'c-1',
        carId: 'car-1',
        status: 'APPROVED',
        issueDate: new Date().toISOString(),
        validUntil: new Date().toISOString(),
        currency: 'TND',
        totalAmount: 119,
        lineItems: [],
        convertedToInvoiceId: 'inv-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      invoice: { id: 'inv-1', invoiceNumber: 'INV-2026-0042' },
    });
  });

  it('surfaces invoiceId=undefined gracefully when the BE response omits the invoice block', (done) => {
    // Defensive — guards against future BE shape drift. The component-level
    // handler now degrades to local hydration instead of routing to
    // /invoices/undefined (see quote-detail spec).
    service.approve('q-2').subscribe((res) => {
      expect(res.invoiceId).toBeUndefined();
      expect(res.quote.id).toBe('q-2');
      done();
    });

    const req = http.expectOne('/quotes/q-2/approve');
    req.flush({
      quote: {
        id: 'q-2',
        quoteNumber: 'DEV-2026-0002',
        customerId: 'c-1',
        carId: 'car-1',
        status: 'APPROVED',
        issueDate: new Date().toISOString(),
        validUntil: new Date().toISOString(),
        currency: 'TND',
        totalAmount: 119,
        lineItems: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      // invoice intentionally absent
    });
  });

  it('reject() POSTs to /quotes/:id/reject and maps the BE Quote → QuoteWithDetails (S-QUO-014)', (done) => {
    service.reject('q-1').subscribe((q) => {
      expect(q.id).toBe('q-1');
      expect(q.status).toBe('REJECTED');
      done();
    });

    const req = http.expectOne('/quotes/q-1/reject');
    expect(req.request.method).toBe('POST');
    req.flush({
      id: 'q-1',
      quoteNumber: 'DEV-2026-0001',
      status: 'REJECTED',
      customerId: 'c-1',
      carId: 'car-1',
      issueDate: new Date().toISOString(),
      validUntil: new Date().toISOString(),
      currency: 'TND',
      totalAmount: 119,
      lineItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('list() forwards an optional status filter as a query param (S-QUO-019)', () => {
    service.list('SENT').subscribe();
    const req = http.expectOne((r) => r.url === '/quotes' && r.params.get('status') === 'SENT');
    req.flush([]);
  });

  it('list() omits the status param when no filter is passed (S-QUO-019)', () => {
    service.list().subscribe();
    const req = http.expectOne((r) => r.url === '/quotes' && !r.params.has('status'));
    req.flush([]);
  });

  it('getQuotePdfBlob() GETs /quotes/:id/pdf with responseType=blob (S-PDF-004)', (done) => {
    service.getQuotePdfBlob('q-42').subscribe((blob) => {
      expect(blob).toEqual(jasmine.any(Blob));
      expect(blob.type).toBe('application/pdf');
      done();
    });
    const req = http.expectOne('/quotes/q-42/pdf');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF-fake'], { type: 'application/pdf' }));
  });
});
