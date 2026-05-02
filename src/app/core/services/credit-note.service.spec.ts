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
});
