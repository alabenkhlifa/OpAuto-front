import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { of } from 'rxjs';
import { InvoicePickerModalComponent } from './invoice-picker-modal.component';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { TranslationService } from '../../../../core/services/translation.service';
import {
  InvoiceWithDetails,
  Payment,
  InvoiceStatus,
} from '../../../../core/models/invoice.model';

function makeInvoice(over: Partial<InvoiceWithDetails> = {}): InvoiceWithDetails {
  const now = new Date();
  return {
    id: 'i1',
    invoiceNumber: 'INV-001',
    customerId: 'c1',
    carId: 'car1',
    issueDate: now,
    dueDate: now,
    status: 'sent' as InvoiceStatus,
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

describe('InvoicePickerModalComponent', () => {
  let fixture: ComponentFixture<InvoicePickerModalComponent>;
  let component: InvoicePickerModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoicePickerModalComponent],
      providers: [
        {
          provide: InvoiceService,
          useValue: {
            formatCurrency: (a: number) => `${a.toFixed(2)} TND`,
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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoicePickerModalComponent);
    component = fixture.componentInstance;
  });

  it('only shows invoices with remaining > 0 and a payable status', () => {
    component.invoices = [
      makeInvoice({ id: 'a', status: 'sent', remainingAmount: 50 }),
      makeInvoice({ id: 'b', status: 'paid', remainingAmount: 0 }),
      makeInvoice({ id: 'c', status: 'cancelled', remainingAmount: 100 }),
      makeInvoice({ id: 'd', status: 'draft', remainingAmount: 100 }),
      makeInvoice({ id: 'e', status: 'overdue', remainingAmount: 75 }),
      makeInvoice({ id: 'f', status: 'partially-paid', remainingAmount: 30 }),
      makeInvoice({ id: 'g', status: 'viewed', remainingAmount: 10 }),
    ];
    expect(component.payable().map((i) => i.id).sort()).toEqual([
      'a',
      'e',
      'f',
      'g',
    ]);
  });

  it('filters by invoice number (case-insensitive)', () => {
    component.invoices = [
      makeInvoice({ id: '1', invoiceNumber: 'INV-2026-0001', remainingAmount: 100 }),
      makeInvoice({ id: '2', invoiceNumber: 'INV-2026-0002', remainingAmount: 100 }),
    ];
    component.query.set('0001');
    expect(component.filtered().map((i) => i.id)).toEqual(['1']);
    component.query.set('inv-2026');
    expect(component.filtered().length).toBe(2);
  });

  it('filters by customer name', () => {
    component.invoices = [
      makeInvoice({ id: '1', customerName: 'Hela Mahmoud', remainingAmount: 100 }),
      makeInvoice({ id: '2', customerName: 'Acme Industries', remainingAmount: 100 }),
    ];
    component.query.set('hela');
    expect(component.filtered().map((i) => i.id)).toEqual(['1']);
  });

  it('emits pick when an invoice is chosen', () => {
    const spy = jasmine.createSpy('pick');
    component.pick.subscribe(spy);
    const inv = makeInvoice({ id: 'x', remainingAmount: 50 });
    component.onPick(inv);
    expect(spy).toHaveBeenCalledWith(inv);
  });

  it('emits close when backdrop is clicked', () => {
    const spy = jasmine.createSpy('close');
    component.close.subscribe(spy);
    const fakeEvent = {
      target: 'BACKDROP',
      currentTarget: 'BACKDROP',
    } as unknown as Event;
    component.onBackdrop(fakeEvent);
    expect(spy).toHaveBeenCalled();
  });

  it('does NOT emit close when an inner element is clicked', () => {
    const spy = jasmine.createSpy('close');
    component.close.subscribe(spy);
    const fakeEvent = {
      target: 'INNER',
      currentTarget: 'BACKDROP',
    } as unknown as Event;
    component.onBackdrop(fakeEvent);
    expect(spy).not.toHaveBeenCalled();
  });

  it('clears the query whenever the modal re-opens', () => {
    component.query.set('still-here');
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: new SimpleChange(false, true, false),
    });
    expect(component.query()).toBe('');
  });
});
