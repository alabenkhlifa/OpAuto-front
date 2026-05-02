import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { QuoteListPageComponent } from './quote-list.component';
import { QuoteService } from '../../../../core/services/quote.service';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { QuoteWithDetails } from '../../../../core/models/quote.model';

/**
 * S-QUO-019 — Quote list filters by status (DRAFT / SENT / APPROVED /
 * REJECTED / EXPIRED). The list component already exposes a status
 * <select> + a `selectedStatus` signal that drives a `filteredQuotes`
 * computed; these specs pin that contract.
 */
describe('QuoteListPageComponent — status filter (S-QUO-019)', () => {
  let fixture: ComponentFixture<QuoteListPageComponent>;
  let component: QuoteListPageComponent;
  let quoteServiceSpy: jasmine.SpyObj<QuoteService>;

  function makeQuote(
    overrides: Partial<QuoteWithDetails> = {},
  ): QuoteWithDetails {
    return {
      id: 'q-1',
      quoteNumber: 'DEV-2026-0001',
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
      createdBy: 'u-1',
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
    quoteServiceSpy = jasmine.createSpyObj<QuoteService>('QuoteService', [
      'list',
      'getStatusBadgeClass',
      'isExpired',
    ]);
    quoteServiceSpy.getStatusBadgeClass.and.returnValue('badge');
    quoteServiceSpy.isExpired.and.returnValue(false);
    quoteServiceSpy.list.and.returnValue(
      of([
        makeQuote({ id: 'q-1', status: 'DRAFT' }),
        makeQuote({ id: 'q-2', status: 'SENT' }),
        makeQuote({ id: 'q-3', status: 'APPROVED' }),
        makeQuote({ id: 'q-4', status: 'REJECTED' }),
        makeQuote({ id: 'q-5', status: 'EXPIRED' }),
      ]),
    );

    await TestBed.configureTestingModule({
      imports: [QuoteListPageComponent],
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
          provide: Router,
          useValue: jasmine.createSpyObj('Router', ['navigate']),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuoteListPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('exposes all five status options (DRAFT/SENT/APPROVED/REJECTED/EXPIRED)', () => {
    expect(component.getAvailableStatuses()).toEqual([
      'DRAFT',
      'SENT',
      'APPROVED',
      'REJECTED',
      'EXPIRED',
    ]);
  });

  it('defaults to "all" → returns every loaded quote', () => {
    expect(component.selectedStatus()).toBe('all');
    expect(component.filteredQuotes().length).toBe(5);
  });

  it('narrows to DRAFT-only when the status filter is set to DRAFT', () => {
    component.selectedStatus.set('DRAFT');
    const rows = component.filteredQuotes();
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('DRAFT');
  });

  it('narrows to SENT-only when the status filter is set to SENT', () => {
    component.selectedStatus.set('SENT');
    const rows = component.filteredQuotes();
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('SENT');
  });

  it('narrows to APPROVED-only when the status filter is set to APPROVED', () => {
    component.selectedStatus.set('APPROVED');
    const rows = component.filteredQuotes();
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('APPROVED');
  });

  it('narrows to REJECTED-only when the status filter is set to REJECTED', () => {
    component.selectedStatus.set('REJECTED');
    const rows = component.filteredQuotes();
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('REJECTED');
  });

  it('narrows to EXPIRED-only when the status filter is set to EXPIRED', () => {
    component.selectedStatus.set('EXPIRED');
    const rows = component.filteredQuotes();
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('EXPIRED');
  });

  it('renders the status <select> with the correct number of options', () => {
    const select = (fixture.nativeElement as HTMLElement).querySelector(
      'select.filter-select',
    ) as HTMLSelectElement;
    expect(select).not.toBeNull();
    // 1 "all" + 5 statuses = 6 options.
    expect(select.options.length).toBe(6);
  });

  it('updates selectedStatus on change-event from the <select>', () => {
    const select = (fixture.nativeElement as HTMLElement).querySelector(
      'select.filter-select',
    ) as HTMLSelectElement;
    select.value = 'SENT';
    select.dispatchEvent(new Event('change'));
    expect(component.selectedStatus()).toBe('SENT');
  });
});
