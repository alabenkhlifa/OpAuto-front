import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CreditNoteListPageComponent } from './credit-note-list.component';
import { CreditNoteService } from '../../../../core/services/credit-note.service';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { CreditNoteWithDetails } from '../../../../core/models/credit-note.model';

/**
 * S-PDF-005 — Credit-note PDF preview + download from the list page.
 *
 * Pins the wiring against `CreditNoteService.getCreditNotePdfBlob`: blob
 * path so the JWT carries via the HTTP interceptor (an SPA-relative
 * `<a href>` would 401 in a fresh tab — same shape of bug we already
 * fixed for invoice PDFs in Sweep A).
 */
describe('CreditNoteListPageComponent — PDF preview/download (S-PDF-005)', () => {
  let fixture: ComponentFixture<CreditNoteListPageComponent>;
  let component: CreditNoteListPageComponent;
  let creditNoteServiceSpy: jasmine.SpyObj<CreditNoteService>;
  let toastSpy: { error: jasmine.Spy; success: jasmine.Spy; warning: jasmine.Spy };

  function makeCn(overrides: Partial<CreditNoteWithDetails> = {}): CreditNoteWithDetails {
    return {
      id: 'cn-1',
      creditNoteNumber: 'AVO-2026-0001',
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-2026-0001',
      reason: 'Customer return',
      total: 119,
      restockParts: true,
      lockedAt: new Date('2026-04-30'),
      lineItems: [],
      createdAt: new Date('2026-04-30'),
      updatedAt: new Date('2026-04-30'),
      customerName: 'Karoui',
      carMake: 'Toyota',
      carModel: 'Yaris',
      licensePlate: 'AB-123',
      ...overrides,
    } as CreditNoteWithDetails;
  }

  async function build(rows: CreditNoteWithDetails[] = [makeCn()]) {
    creditNoteServiceSpy = jasmine.createSpyObj<CreditNoteService>(
      'CreditNoteService',
      ['list', 'get', 'create', 'getCreditNotePdfBlob', 'pdfUrl'],
    );
    creditNoteServiceSpy.list.and.returnValue(of(rows));

    toastSpy = {
      error: jasmine.createSpy('error'),
      success: jasmine.createSpy('success'),
      warning: jasmine.createSpy('warning'),
    };

    await TestBed.configureTestingModule({
      imports: [CreditNoteListPageComponent],
      providers: [
        { provide: CreditNoteService, useValue: creditNoteServiceSpy },
        {
          provide: InvoiceService,
          useValue: {
            formatCurrency: (n: number) => `${n} TND`,
            formatDate: (d: Date) => d.toISOString(),
          },
        },
        {
          provide: TranslationService,
          useValue: {
            instant: (k: string) => k,
            getCurrentLanguage: () => 'en',
            translations$: of({}),
          },
        },
        { provide: ToastService, useValue: toastSpy },
        { provide: Router, useValue: { navigate: jasmine.createSpy() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreditNoteListPageComponent);
    component = fixture.componentInstance;
  }

  it('previewPdf() opens the credit-note PDF blob in a new tab', async () => {
    await build();
    const blob = new Blob(['%PDF-fake'], { type: 'application/pdf' });
    creditNoteServiceSpy.getCreditNotePdfBlob.and.returnValue(of(blob));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:http://x/cn');
    const winSpy = spyOn(window, 'open').and.returnValue(null);
    fixture.detectChanges();

    component.previewPdf(makeCn({ id: 'cn-42' }));

    expect(creditNoteServiceSpy.getCreditNotePdfBlob).toHaveBeenCalledWith('cn-42');
    expect(winSpy).toHaveBeenCalledWith('blob:http://x/cn', '_blank');
  });

  it('downloadPdf() triggers an <a download> click with `credit-note-AVO-...pdf` filename', async () => {
    await build();
    const blob = new Blob(['%PDF-fake'], { type: 'application/pdf' });
    creditNoteServiceSpy.getCreditNotePdfBlob.and.returnValue(of(blob));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:http://x/dl');
    const revokeSpy = spyOn(URL, 'revokeObjectURL');
    const clickSpy = jasmine.createSpy('click');
    const fakeAnchor: any = { href: '', download: '', click: clickSpy };
    // Capture the real createElement BEFORE spying so the fake delegate can
    // reach it without triggering recursion.
    const realCreate = document.createElement.bind(document);
    spyOn(document, 'createElement').and.callFake((tag: string) =>
      tag === 'a' ? fakeAnchor : realCreate(tag),
    );
    spyOn(document.body, 'appendChild').and.returnValue(null as any);
    spyOn(document.body, 'removeChild').and.returnValue(null as any);
    fixture.detectChanges();

    component.downloadPdf(makeCn({ creditNoteNumber: 'AVO-2026-0042' }));

    expect(fakeAnchor.download).toBe('credit-note-AVO-2026-0042.pdf');
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://x/dl');
  });

  it('surfaces a translated toast on PDF fetch failure (no tab opened)', async () => {
    await build();
    creditNoteServiceSpy.getCreditNotePdfBlob.and.returnValue(
      throwError(() => new Error('500')),
    );
    const winSpy = spyOn(window, 'open');
    fixture.detectChanges();

    component.previewPdf(makeCn());

    expect(toastSpy.error).toHaveBeenCalledWith(
      'invoicing.creditNotes.list.pdfFailed',
    );
    expect(winSpy).not.toHaveBeenCalled();
  });

  it('renders Preview PDF + Download PDF buttons per credit-note row', async () => {
    await build([makeCn({ id: 'cn-a' }), makeCn({ id: 'cn-b' })]);
    fixture.detectChanges();

    const previewButtons = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.credit-note-row__pdf-actions button',
    );
    // 2 rows × 2 buttons each = 4.
    expect(previewButtons.length).toBe(4);
    const labels = Array.from(previewButtons).map((b) => b.textContent?.trim() ?? '');
    expect(labels.filter((l) => l.includes('previewPdf')).length).toBe(2);
    expect(labels.filter((l) => l.includes('downloadPdf')).length).toBe(2);
  });
});
