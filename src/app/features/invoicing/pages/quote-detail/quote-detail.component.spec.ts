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
