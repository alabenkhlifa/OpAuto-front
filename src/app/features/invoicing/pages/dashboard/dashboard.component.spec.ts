import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { InvoicingDashboardComponent } from './dashboard.component';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { QuoteService } from '../../../../core/services/quote.service';
import { CreditNoteService } from '../../../../core/services/credit-note.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../shared/services/toast.service';
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
  openPaymentParam?: string | null;
  addPayment$?: any;
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
            addPayment: () => opts.addPayment$ || of({} as any),
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
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: () => ({ id: 'user-1' }),
          },
        },
        {
          provide: ToastService,
          useValue: {
            success: jasmine.createSpy('success'),
            error: jasmine.createSpy('error'),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(
                opts.openPaymentParam !== undefined
                  ? { openPayment: opts.openPaymentParam ?? '' }
                  : {},
              ),
            },
            queryParamMap: of(
              convertToParamMap(
                opts.openPaymentParam !== undefined
                  ? { openPayment: opts.openPaymentParam ?? '' }
                  : {},
              ),
            ),
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

  describe('S-DASH-005 — Urgent banner visibility', () => {
    it('hides the urgent banner DOM block when overdueCount === 0', () => {
      const fixture = setup({
        invoices: [makeInvoice({ status: 'paid', remainingAmount: 0 })],
      });
      expect(fixture.componentInstance.overdueCount()).toBe(0);
      const text: string = (fixture.nativeElement as HTMLElement).textContent || '';
      expect(text).not.toContain('overdue');
    });

    it('renders the urgent banner DOM block when overdueCount > 0', () => {
      const fixture = setup({
        invoices: [
          makeInvoice({ status: 'overdue', remainingAmount: 100, totalAmount: 100 }),
        ],
      });
      expect(fixture.componentInstance.overdueCount()).toBe(1);
      const html: string = (fixture.nativeElement as HTMLElement).innerHTML;
      expect(html).toContain('urgent-card');
    });
  });

  describe('S-DASH-007 — Recent invoice click navigates to detail', () => {
    it('navigateInvoice routes to /invoices/:id', () => {
      const fixture = setup();
      const router = TestBed.inject(Router);
      const spy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
      fixture.componentInstance.navigateInvoice('abc-123');
      expect(spy).toHaveBeenCalledWith(['/invoices', 'abc-123']);
    });
  });

  describe('S-DASH-011 — Resilience to upstream failures', () => {
    it('still renders KPI tiles when the invoice fetch fails', () => {
      const fixture = setup({ invoiceError: true });
      const tiles = fixture.componentInstance.kpiTiles();
      expect(tiles.length).toBe(4);
      // All numeric tiles fall back to "0" / "0.00 TND" rather than "—" or
      // a thrown error — page still paints.
      expect(tiles[0].value).toBeTruthy();
    });
  });

  describe('S-DASH-003 — Record Payment quick-action', () => {
    it('opens the invoice picker when Record Payment is clicked', () => {
      const fixture = setup();
      const c = fixture.componentInstance;
      expect(c.pickerOpen()).toBeFalse();
      c.navigateRecordPayment();
      expect(c.pickerOpen()).toBeTrue();
    });

    it('switches to the payment modal when an invoice is picked', () => {
      const fixture = setup();
      const c = fixture.componentInstance;
      const inv = makeInvoice({ id: 'pick-1', remainingAmount: 50 });
      c.openInvoicePicker();
      c.onInvoicePicked(inv);
      expect(c.pickerOpen()).toBeFalse();
      expect(c.paymentModalOpen()).toBeTrue();
      expect(c.pickedInvoice()?.id).toBe('pick-1');
      expect(c.paymentContext()?.invoiceId).toBe('pick-1');
      expect(c.paymentContext()?.remainingAmount).toBe(50);
    });

    it('records a payment by calling InvoiceService.addPayment with the picked invoice', () => {
      const fixture = setup();
      const svc = TestBed.inject(InvoiceService);
      const spy = spyOn(svc, 'addPayment').and.returnValue(of({} as any));
      const c = fixture.componentInstance;
      c.onInvoicePicked(makeInvoice({ id: 'pay-1', remainingAmount: 80 }));
      c.onPaymentModalSubmit({
        amount: 80,
        method: 'cash',
        paymentDate: '2026-05-01',
        reference: undefined,
        notes: undefined,
      });
      expect(spy).toHaveBeenCalled();
      const arg: any = spy.calls.mostRecent().args[0];
      expect(arg.invoiceId).toBe('pay-1');
      expect(arg.amount).toBe(80);
      expect(arg.method).toBe('cash');
    });
  });

  describe('S-NAV-007 — "+ New → Payment" deep-link auto-opens picker', () => {
    it('opens the picker when ?openPayment=1 is present on init', () => {
      const fixture = setup({ openPaymentParam: '1' });
      expect(fixture.componentInstance.pickerOpen()).toBeTrue();
    });

    it('does NOT open the picker when ?openPayment is missing', () => {
      const fixture = setup();
      expect(fixture.componentInstance.pickerOpen()).toBeFalse();
    });

    it('does NOT open the picker when ?openPayment has a non-1 value', () => {
      const fixture = setup({ openPaymentParam: '0' });
      expect(fixture.componentInstance.pickerOpen()).toBeFalse();
    });
  });
});
