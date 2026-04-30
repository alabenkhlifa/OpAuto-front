import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { InvoicingDashboardComponent } from './dashboard.component';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { QuoteService } from '../../../../core/services/quote.service';
import { CreditNoteService } from '../../../../core/services/credit-note.service';
import { TranslationService } from '../../../../core/services/translation.service';
import {
  InvoiceWithDetails,
  Payment,
} from '../../../../core/models/invoice.model';
import { QuoteWithDetails } from '../../../../core/models/quote.model';
import { CreditNoteWithDetails } from '../../../../core/models/credit-note.model';

function makeInvoice(over: Partial<InvoiceWithDetails> = {}): InvoiceWithDetails {
  const now = new Date();
  return {
    id: 'i1',
    invoiceNumber: 'INV-001',
    customerId: 'c1',
    carId: 'car1',
    issueDate: now,
    dueDate: now,
    status: 'sent',
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

interface SetupOpts {
  invoices?: InvoiceWithDetails[];
  invoiceError?: boolean;
}

describe('InvoicingDashboardComponent', () => {
  function setup(opts: SetupOpts = {}): ComponentFixture<InvoicingDashboardComponent> {
    const invoices: InvoiceWithDetails[] =
      opts.invoices !== undefined
        ? opts.invoices
        : [
            makeInvoice({
              id: '1',
              status: 'overdue',
              remainingAmount: 200,
              totalAmount: 200,
            }),
            makeInvoice({
              id: '2',
              status: 'paid',
              paidAmount: 500,
              remainingAmount: 0,
              totalAmount: 500,
            }),
          ];

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [InvoicingDashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: InvoiceService,
          useValue: {
            getInvoices: () =>
              opts.invoiceError ? throwError(() => new Error('x')) : of(invoices),
            formatCurrency: (a: number) => `${a.toFixed(2)} TND`,
            formatDate: (d: Date) => d.toISOString().slice(0, 10),
            getStatusBadgeClass: () => 'badge badge-active',
          },
        },
        {
          provide: QuoteService,
          useValue: {
            list: () => of([] as QuoteWithDetails[]),
          },
        },
        {
          provide: CreditNoteService,
          useValue: {
            list: () => of([] as CreditNoteWithDetails[]),
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

    const fixture = TestBed.createComponent(InvoicingDashboardComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('counts overdue invoices and total outstanding amount', () => {
    const fixture = setup();
    const c = fixture.componentInstance;
    expect(c.overdueCount()).toBe(1);
    expect(c.overdueAmount()).toBe(200);
  });

  it('builds aging buckets across the right age ranges', () => {
    const fixture = setup();
    const c = fixture.componentInstance;
    const buckets = c.agingBuckets();
    const total = buckets.reduce((s, b) => s + b.amount, 0);
    expect(total).toBe(200);
    expect(buckets[0].key).toBe('current');
    expect(buckets[buckets.length - 1].key).toBe('90+');
  });

  it('builds 4 KPI tiles, each with at least 2 spark points', () => {
    const fixture = setup();
    const tiles = fixture.componentInstance.kpiTiles();
    expect(tiles.length).toBe(4);
    for (const t of tiles) {
      expect(t.sparkline.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('sparkline path produces empty strings for too-short input', () => {
    const fixture = setup();
    const c = fixture.componentInstance;
    expect(c.buildSparklinePath([]).line).toBe('');
    expect(c.buildSparklinePath([5]).line).toBe('');
  });

  it('reports gracefully when invoice service errors', () => {
    const fixture = setup({ invoiceError: true });
    expect(fixture.componentInstance.invoices().length).toBe(0);
  });
});
