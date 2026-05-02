import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { PendingListPageComponent } from './pending-list.component';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { InvoiceWithDetails, InvoiceStatus, Payment } from '../../../../core/models/invoice.model';

function makeInvoice(
  status: InvoiceStatus,
  over: Partial<InvoiceWithDetails> = {},
): InvoiceWithDetails {
  const now = new Date();
  return {
    id: `inv-${status}-${Math.random().toString(36).slice(2, 8)}`,
    invoiceNumber: `INV-${status.toUpperCase()}`,
    customerId: 'c1',
    carId: 'car1',
    issueDate: now,
    dueDate: now,
    status,
    currency: 'TND',
    subtotal: 100,
    taxRate: 19,
    taxAmount: 19,
    discountPercentage: 0,
    discountAmount: 0,
    totalAmount: 119,
    paidAmount: 0,
    remainingAmount: 119,
    lineItems: [],
    notes: '',
    paymentTerms: 'Net 30',
    createdBy: 'u',
    createdAt: now,
    updatedAt: now,
    customerName: 'Acme',
    customerPhone: '',
    carMake: 'Peugeot',
    carModel: '208',
    carYear: 2020,
    licensePlate: '123 TUN 456',
    paymentHistory: [] as Payment[],
    ...over,
  };
}

describe('PendingListPageComponent (S-SB-003 — pending bucket)', () => {
  let fixture: ComponentFixture<PendingListPageComponent>;
  let component: PendingListPageComponent;
  let invoiceService: jasmine.SpyObj<InvoiceService>;

  beforeEach(async () => {
    invoiceService = jasmine.createSpyObj<InvoiceService>('InvoiceService', [
      'getInvoices',
      'formatCurrency',
      'formatDate',
    ]);
    invoiceService.formatCurrency.and.callFake((n) => `${n} DT`);
    invoiceService.formatDate.and.callFake(() => 'today');

    const translation = jasmine.createSpyObj<TranslationService>(
      'TranslationService',
      ['instant'],
      { translations$: of({}) },
    );
    translation.instant.and.callFake((k: string) => k);

    await TestBed.configureTestingModule({
      imports: [PendingListPageComponent],
      providers: [
        provideRouter([]),
        { provide: InvoiceService, useValue: invoiceService },
        { provide: TranslationService, useValue: translation },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PendingListPageComponent);
    component = fixture.componentInstance;
  });

  // --------------------------------------------------------------
  // The pending-list page row count must equal the sidebar Pending
  // Payment badge count. Both buckets are: SENT + VIEWED +
  // PARTIALLY_PAID + OVERDUE. See sidebar.component.ts loadBadgeCounts.
  // --------------------------------------------------------------
  it('keeps SENT, VIEWED, PARTIALLY_PAID and OVERDUE invoices in the pending bucket', () => {
    const data: InvoiceWithDetails[] = [
      makeInvoice('sent'),
      makeInvoice('sent'),
      makeInvoice('viewed'),
      makeInvoice('partially-paid'),
      makeInvoice('partially-paid'),
      makeInvoice('overdue'),
      makeInvoice('overdue'),
      makeInvoice('overdue'),
      // The following must NOT appear in the pending bucket.
      makeInvoice('paid'),
      makeInvoice('paid'),
      makeInvoice('draft'),
      makeInvoice('cancelled'),
    ];
    invoiceService.getInvoices.and.returnValue(of(data));

    fixture.detectChanges(); // ngOnInit -> getInvoices
    expect(component.invoices().length).toBe(12);

    // SENT(2) + VIEWED(1) + PARTIALLY_PAID(2) + OVERDUE(3) = 8.
    expect(component.pendingInvoices().length).toBe(8);

    // Spot-check the excluded statuses are absent.
    const pendingStatuses = component.pendingInvoices().map((i) => i.status);
    expect(pendingStatuses).not.toContain('paid' as InvoiceStatus);
    expect(pendingStatuses).not.toContain('draft' as InvoiceStatus);
    expect(pendingStatuses).not.toContain('cancelled' as InvoiceStatus);
  });

  it('returns an empty bucket when no unpaid issued invoices exist', () => {
    invoiceService.getInvoices.and.returnValue(
      of([makeInvoice('paid'), makeInvoice('draft'), makeInvoice('cancelled')]),
    );
    fixture.detectChanges();
    expect(component.pendingInvoices().length).toBe(0);
  });

  it('still flips isLoading off when the service errors', () => {
    invoiceService.getInvoices.and.returnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();
    expect(component.isLoading()).toBe(false);
    expect(component.pendingInvoices().length).toBe(0);
  });

  it('navigateToDetail routes to /invoices/:id', () => {
    invoiceService.getInvoices.and.returnValue(of([]));
    const router = TestBed.inject(Router);
    const spy = spyOn(router, 'navigate');
    fixture.detectChanges();

    const inv = makeInvoice('sent', { id: 'abc-123' });
    component.navigateToDetail(inv);
    expect(spy).toHaveBeenCalledWith(['/invoices', 'abc-123']);
  });
});
