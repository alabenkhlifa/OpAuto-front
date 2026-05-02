import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { QuoteDetailPageComponent } from './quote-detail.component';
import { QuoteService } from '../../../../core/services/quote.service';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { QuoteWithDetails } from '../../../../core/models/quote.model';

/**
 * BUG-095 — quote-detail must expose an Edit affordance for DRAFT quotes
 * (also indirectly unblocks S-QUO-010). Edit is gated by status === 'DRAFT'
 * so SENT/APPROVED/REJECTED/EXPIRED stay locked.
 */
describe('QuoteDetailPageComponent — Edit affordance (BUG-095)', () => {
  let fixture: ComponentFixture<QuoteDetailPageComponent>;
  let component: QuoteDetailPageComponent;
  let routerSpy: jasmine.SpyObj<Router>;
  let quoteServiceSpy: jasmine.SpyObj<QuoteService>;

  function makeQuote(overrides: Partial<QuoteWithDetails> = {}): QuoteWithDetails {
    return {
      id: 'q-1',
      quoteNumber: 'DRAFT-abc12345',
      customerId: 'c-1',
      carId: 'car-1',
      status: 'DRAFT',
      issueDate: new Date('2026-04-30'),
      validUntil: new Date('2026-05-14'),
      currency: 'TND',
      subtotal: 100,
      taxAmount: 19,
      discountPercentage: 0,
      discountAmount: 0,
      totalAmount: 119,
      lineItems: [],
      createdBy: 'user-1',
      createdAt: new Date('2026-04-30'),
      updatedAt: new Date('2026-04-30'),
      customerName: 'Karoui',
      customerPhone: '+216 12 345 678',
      carMake: 'Toyota',
      carModel: 'Yaris',
      carYear: 2020,
      licensePlate: 'AB-123',
      ...overrides,
    };
  }

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    quoteServiceSpy = jasmine.createSpyObj<QuoteService>(
      'QuoteService',
      ['get', 'send', 'approve', 'reject', 'getStatusBadgeClass', 'isExpired'],
    );
    quoteServiceSpy.getStatusBadgeClass.and.returnValue('badge');
    quoteServiceSpy.isExpired.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [QuoteDetailPageComponent],
      providers: [
        { provide: QuoteService, useValue: quoteServiceSpy },
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
        {
          provide: ToastService,
          useValue: { error: jasmine.createSpy(), success: jasmine.createSpy() },
        },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'q-1' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuoteDetailPageComponent);
    component = fixture.componentInstance;
  });

  it('navigates to /invoices/quotes/edit/:id when edit() is called on a DRAFT quote', () => {
    quoteServiceSpy.get.and.returnValue(of(makeQuote({ status: 'DRAFT' })));
    fixture.detectChanges(); // ngOnInit → load

    component.edit();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/invoices/quotes/edit', 'q-1']);
  });

  it('does NOT navigate when edit() is called on a SENT quote (guard)', () => {
    quoteServiceSpy.get.and.returnValue(of(makeQuote({ status: 'SENT' })));
    fixture.detectChanges();

    component.edit();

    expect(routerSpy.navigate).not.toHaveBeenCalledWith([
      '/invoices/quotes/edit',
      'q-1',
    ]);
  });

  it('does NOT navigate when no quote is loaded yet', () => {
    quoteServiceSpy.get.and.returnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();

    component.edit();

    expect(routerSpy.navigate).not.toHaveBeenCalledWith([
      '/invoices/quotes/edit',
      jasmine.anything(),
    ]);
  });

  it('renders the Edit button only when status is DRAFT', () => {
    quoteServiceSpy.get.and.returnValue(of(makeQuote({ status: 'DRAFT' })));
    fixture.detectChanges();

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.quote-detail-page__actions button',
    );
    const labels = Array.from(buttons).map((b) => b.textContent?.trim() ?? '');
    expect(labels.some((l) => l.includes('invoicing.quotes.detail.edit'))).toBeTrue();
  });

  it('hides the Edit button when status is SENT', () => {
    quoteServiceSpy.get.and.returnValue(of(makeQuote({ status: 'SENT' })));
    fixture.detectChanges();

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.quote-detail-page__actions button',
    );
    const labels = Array.from(buttons).map((b) => b.textContent?.trim() ?? '');
    expect(labels.some((l) => l.includes('invoicing.quotes.detail.edit'))).toBeFalse();
  });
});

/**
 * Sweep C-4 — Section 4 quote lifecycle scenarios. Pins the FE behaviour
 * that closes S-QUO-013 / 014 / 015 / 016 / 020 after BUG-105 fix.
 */
describe('QuoteDetailPageComponent — lifecycle (Sweep C-4)', () => {
  let fixture: ComponentFixture<QuoteDetailPageComponent>;
  let component: QuoteDetailPageComponent;
  let routerSpy: jasmine.SpyObj<Router>;
  let quoteServiceSpy: jasmine.SpyObj<QuoteService>;
  let invoiceServiceSpy: jasmine.SpyObj<InvoiceService>;

  function makeQuote(overrides: Partial<QuoteWithDetails> = {}): QuoteWithDetails {
    return {
      id: 'q-1',
      quoteNumber: 'DEV-2026-0001',
      customerId: 'c-1',
      carId: 'car-1',
      status: 'SENT',
      issueDate: new Date('2026-04-30'),
      validUntil: new Date('2026-05-14'),
      currency: 'TND',
      subtotal: 100,
      taxAmount: 19,
      discountPercentage: 0,
      discountAmount: 0,
      totalAmount: 119,
      lineItems: [],
      createdBy: 'user-1',
      createdAt: new Date('2026-04-30'),
      updatedAt: new Date('2026-04-30'),
      customerName: 'Karoui',
      customerPhone: '+216 12 345 678',
      carMake: 'Toyota',
      carModel: 'Yaris',
      carYear: 2020,
      licensePlate: 'AB-123',
      ...overrides,
    };
  }

  async function build(quote: QuoteWithDetails) {
    // Include createUrlTree + serializeUrl + events so the [routerLink]
    // directive on the APPROVED→converted-invoice link can resolve at
    // render time without wiring a full Router/RouterTestingModule.
    routerSpy = jasmine.createSpyObj<Router>(
      'Router',
      ['navigate', 'createUrlTree', 'serializeUrl'],
      { events: of() },
    );
    routerSpy.createUrlTree.and.returnValue({} as any);
    routerSpy.serializeUrl.and.returnValue('/invoices/inv-1');
    quoteServiceSpy = jasmine.createSpyObj<QuoteService>('QuoteService', [
      'get',
      'send',
      'approve',
      'reject',
      'getStatusBadgeClass',
      'isExpired',
    ]);
    quoteServiceSpy.getStatusBadgeClass.and.returnValue('badge');
    quoteServiceSpy.isExpired.and.returnValue(false);
    quoteServiceSpy.get.and.returnValue(of(quote));

    invoiceServiceSpy = jasmine.createSpyObj<InvoiceService>('InvoiceService', [
      'formatCurrency',
      'formatDate',
      'fetchInvoiceById',
    ]);
    invoiceServiceSpy.formatCurrency.and.callFake((n: number) => `${n} TND`);
    invoiceServiceSpy.formatDate.and.callFake((d: Date) => d.toISOString());
    invoiceServiceSpy.fetchInvoiceById.and.returnValue(
      of({ id: 'inv-1', invoiceNumber: 'INV-2026-0042' } as any),
    );

    await TestBed.configureTestingModule({
      imports: [QuoteDetailPageComponent],
      providers: [
        { provide: QuoteService, useValue: quoteServiceSpy },
        { provide: InvoiceService, useValue: invoiceServiceSpy },
        {
          provide: TranslationService,
          useValue: {
            instant: (k: string) => k,
            getCurrentLanguage: () => 'en',
            translations$: of({}),
          },
        },
        {
          provide: ToastService,
          useValue: { error: jasmine.createSpy(), success: jasmine.createSpy() },
        },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'q-1' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuoteDetailPageComponent);
    component = fixture.componentInstance;
  }

  // ── S-QUO-013 — Approve auto-navigates to the new draft invoice ─────────

  it('S-QUO-013 — approve() navigates to /invoices/:id using the invoice id from the BE response', async () => {
    await build(makeQuote({ status: 'SENT' }));
    quoteServiceSpy.approve.and.returnValue(
      of({ quote: makeQuote({ status: 'APPROVED' }), invoiceId: 'inv-1' }),
    );
    fixture.detectChanges();

    component.approve();

    expect(quoteServiceSpy.approve).toHaveBeenCalledWith('q-1');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/invoices', 'inv-1']);
  });

  it('S-QUO-013 — falls back to local hydration (no /invoices/undefined) when BE omits invoiceId', async () => {
    await build(makeQuote({ status: 'SENT' }));
    const approved = makeQuote({
      status: 'APPROVED',
      convertedToInvoiceId: 'inv-1',
    });
    quoteServiceSpy.approve.and.returnValue(
      of({ quote: approved, invoiceId: undefined as any }),
    );
    fixture.detectChanges();

    component.approve();

    expect(routerSpy.navigate).not.toHaveBeenCalledWith(['/invoices', undefined]);
    expect(component.quote()?.status).toBe('APPROVED');
  });

  // ── S-QUO-014 — Reject SENT → REJECTED + Approve/Reject hidden ─────────

  it('S-QUO-014 — reject() flips status to REJECTED and re-renders without Approve/Reject', async () => {
    await build(makeQuote({ status: 'SENT' }));
    quoteServiceSpy.reject.and.returnValue(of(makeQuote({ status: 'REJECTED' })));
    fixture.detectChanges();

    component.reject();
    fixture.detectChanges();

    expect(component.quote()?.status).toBe('REJECTED');
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.quote-detail-page__actions button',
    );
    const labels = Array.from(buttons).map((b) => b.textContent?.trim() ?? '');
    expect(labels.some((l) => l.includes('invoicing.quotes.detail.approve'))).toBeFalse();
    expect(labels.some((l) => l.includes('invoicing.quotes.detail.reject'))).toBeFalse();
    expect(labels.some((l) => l.includes('invoicing.quotes.detail.send'))).toBeFalse();
  });

  // ── S-QUO-015 — REJECTED is terminal: Send button never renders ─────────

  it('S-QUO-015 — REJECTED quote does not render the Send button (terminal state)', async () => {
    await build(makeQuote({ status: 'REJECTED' }));
    fixture.detectChanges();

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.quote-detail-page__actions button',
    );
    const labels = Array.from(buttons).map((b) => b.textContent?.trim() ?? '');
    expect(labels.some((l) => l.includes('invoicing.quotes.detail.send'))).toBeFalse();
    expect(labels.length).toBe(0);
  });

  // ── S-QUO-016 — DRAFT cannot be approved: Approve button absent ─────────

  it('S-QUO-016 — DRAFT quote does not render the Approve button (must SEND first)', async () => {
    await build(makeQuote({ status: 'DRAFT' }));
    fixture.detectChanges();

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.quote-detail-page__actions button',
    );
    const labels = Array.from(buttons).map((b) => b.textContent?.trim() ?? '');
    expect(labels.some((l) => l.includes('invoicing.quotes.detail.approve'))).toBeFalse();
    expect(labels.some((l) => l.includes('invoicing.quotes.detail.reject'))).toBeFalse();
  });

  // ── S-QUO-020 — APPROVED → "Converted to invoice INV-..." link ─────────

  it('S-QUO-020 — APPROVED quote renders the converted-invoice link with the fetched number', async () => {
    await build(
      makeQuote({
        status: 'APPROVED',
        convertedToInvoiceId: 'inv-1',
      }),
    );
    fixture.detectChanges();
    // hydrateLinkedInvoice → fetchInvoiceById emits synchronously via stub.
    fixture.detectChanges();

    expect(invoiceServiceSpy.fetchInvoiceById).toHaveBeenCalledWith('inv-1');
    expect(component.linkedInvoiceNumber()).toBe('INV-2026-0042');

    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '.quote-detail-page__converted-link',
    );
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain('INV-2026-0042');
  });

  it('S-QUO-020 — non-APPROVED quote does NOT render the converted-invoice link', async () => {
    await build(
      makeQuote({
        status: 'SENT',
        convertedToInvoiceId: null,
      }),
    );
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '.quote-detail-page__converted-link',
    );
    expect(link).toBeNull();
    expect(component.linkedInvoiceNumber()).toBeNull();
  });

  it('S-QUO-020 — falls back to translated label when invoice fetch fails', async () => {
    await build(
      makeQuote({
        status: 'APPROVED',
        convertedToInvoiceId: 'inv-1',
      }),
    );
    invoiceServiceSpy.fetchInvoiceById.and.returnValue(
      throwError(() => new Error('boom')),
    );
    fixture.detectChanges();

    expect(component.linkedInvoiceNumber()).toBeNull();
    // Link still renders (because convertedToInvoiceId is present), just
    // without the customer-friendly number.
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '.quote-detail-page__converted-link',
    );
    expect(link).not.toBeNull();
  });
});
