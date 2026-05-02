import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { CreditNoteService } from './credit-note.service';

/**
 * CreditNoteService specs — pin the wire shape for the new PDF-blob
 * helper (S-PDF-005). Mirrors the existing InvoiceService.getInvoicePdfBlob
 * contract: GET on `/credit-notes/:id/pdf` with responseType=blob.
 */
describe('CreditNoteService — getCreditNotePdfBlob (S-PDF-005)', () => {
  let service: CreditNoteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CreditNoteService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(CreditNoteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GETs /credit-notes/:id/pdf with responseType=blob and resolves with the PDF blob', (done) => {
    service.getCreditNotePdfBlob('cn-42').subscribe((blob) => {
      expect(blob).toEqual(jasmine.any(Blob));
      expect(blob.type).toBe('application/pdf');
      done();
    });
    const req = http.expectOne('/credit-notes/cn-42/pdf');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF-fake'], { type: 'application/pdf' }));
  });

  it('pdfUrl() builds the SPA-relative path (kept for legacy callers)', () => {
    expect(service.pdfUrl('cn-1')).toBe('/credit-notes/cn-1/pdf');
  });

  // ── BUG-106 — Sweep C-10 (S-I18N-001/002) ───────────────────────
  // Same uppercase-line-type fallout as in InvoiceService — credit-note
  // detail rendering ultimately reuses the same `invoicing.form.lineTypes.*`
  // i18n keys when surfaced in any list / table chrome. Normalize at the
  // service mapper boundary so consumers always receive the lowercase enum.
  it('lowercases line item type to match the FE LineItemType enum (BUG-106)', (done) => {
    service.get('cn-1').subscribe((cn: any) => {
      expect(cn.lineItems[0].type).toBe('service');
      expect(cn.lineItems[1].type).toBe('part');
      expect(cn.lineItems[2].type).toBe('labor');
      expect(cn.lineItems[3].type).toBe('misc');
      done();
    });
    const req = http.expectOne('/credit-notes/cn-1');
    req.flush({
      id: 'cn-1',
      creditNoteNumber: 'AVO-2026-0001',
      invoiceId: 'inv-1',
      customerId: 'c',
      reason: 'r',
      issueDate: new Date().toISOString(),
      currency: 'TND',
      subtotal: 0,
      tvaTotal: 0,
      total: 0,
      restockParts: false,
      lockedAt: new Date().toISOString(),
      lineItems: [
        { id: 'l1', type: 'SERVICE', description: 'A', quantity: 1, unitPrice: 10 },
        { id: 'l2', type: 'Part',    description: 'B', quantity: 1, unitPrice: 10 },
        { id: 'l3', type: 'labor',   description: 'C', quantity: 1, unitPrice: 10 },
        { id: 'l4',                  description: 'D', quantity: 1, unitPrice: 10 },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
});
