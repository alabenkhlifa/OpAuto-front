import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { QuoteFormPageComponent } from './quote-form.component';
import { QuoteService } from '../../../../core/services/quote.service';
import { CustomerService } from '../../../../core/services/customer.service';
import { AppointmentService } from '../../../appointments/services/appointment.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { QuoteWithDetails } from '../../../../core/models/quote.model';

/**
 * BUG-095 — quote-form must support edit mode via the `:id` route param.
 * Verifies: form hydration from a DRAFT quote, redirect when status is
 * locked, update path on submit, cancel returns to detail.
 */
describe('QuoteFormPageComponent — edit mode (BUG-095)', () => {
  let fixture: ComponentFixture<QuoteFormPageComponent>;
  let component: QuoteFormPageComponent;
  let routerSpy: jasmine.SpyObj<Router>;
  let quoteServiceSpy: jasmine.SpyObj<QuoteService>;

  const customers = [{ id: 'c-1', name: 'Karoui', phone: '+21612', email: 'k@x.tn' }];
  const cars = [
    { id: 'car-1', customerId: 'c-1', make: 'Toyota', model: 'Yaris', year: 2020, licensePlate: 'AB-123' } as any,
    { id: 'car-2', customerId: 'c-2', make: 'Renault', model: 'Clio', year: 2018, licensePlate: 'CD-456' } as any,
  ];

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
      lineItems: [
        {
          id: 'li-1',
          type: 'service',
          description: 'Oil change',
          quantity: 1,
          unit: 'service',
          unitPrice: 100,
          totalPrice: 100,
          tvaRate: 19,
          taxable: true,
        } as any,
      ],
      createdBy: 'user-1',
      createdAt: new Date('2026-04-30'),
      updatedAt: new Date('2026-04-30'),
      customerName: 'Karoui',
      customerPhone: '+21612',
      carMake: 'Toyota',
      carModel: 'Yaris',
      carYear: 2020,
      licensePlate: 'AB-123',
      notes: 'pre-existing notes',
      ...overrides,
    };
  }

  async function setupWithRouteId(id: string | null) {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    quoteServiceSpy = jasmine.createSpyObj<QuoteService>(
      'QuoteService',
      ['get', 'create', 'update'],
    );

    await TestBed.configureTestingModule({
      imports: [QuoteFormPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: QuoteService, useValue: quoteServiceSpy },
        {
          provide: CustomerService,
          useValue: { getCustomers: () => of(customers as any) },
        },
        {
          provide: AppointmentService,
          useValue: { getCars: () => of(cars) },
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
          useValue: {
            success: jasmine.createSpy(),
            error: jasmine.createSpy(),
            warning: jasmine.createSpy(),
          },
        },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuoteFormPageComponent);
    component = fixture.componentInstance;
  }

  it('hydrates the form and lines from the loaded quote when route has :id', async () => {
    await setupWithRouteId('q-1');
    quoteServiceSpy.get.and.returnValue(of(makeQuote()));

    fixture.detectChanges(); // triggers ngOnInit forkJoin → loadQuote

    expect(component.isEditMode()).toBeTrue();
    expect(component.quoteId()).toBe('q-1');
    expect(component.form.value.customerId).toBe('c-1');
    expect(component.form.value.carId).toBe('car-1');
    expect(component.form.value.notes).toBe('pre-existing notes');
    // Filtered cars must include the customer's vehicles so the <select>
    // shows the right option (BUG-095 hydration order trap).
    expect(component.cars().length).toBe(1);
    expect(component.cars()[0].id).toBe('car-1');
    // Lines are rebuilt with TVA rate intact.
    expect(component.lines().length).toBe(1);
    expect(component.lines()[0].tvaRate).toBe(19);
  });

  it('redirects to detail page when the quote is not DRAFT (locked)', async () => {
    await setupWithRouteId('q-1');
    quoteServiceSpy.get.and.returnValue(of(makeQuote({ status: 'SENT' })));

    fixture.detectChanges();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/invoices/quotes', 'q-1']);
    expect(component.isEditMode()).toBeFalse(); // quoteId never set
  });

  it('calls QuoteService.update (NOT create) on submit in edit mode', async () => {
    await setupWithRouteId('q-1');
    quoteServiceSpy.get.and.returnValue(of(makeQuote()));
    quoteServiceSpy.update.and.returnValue(of(makeQuote()));

    fixture.detectChanges();

    component.onSubmit();

    expect(quoteServiceSpy.update).toHaveBeenCalledWith(
      'q-1',
      jasmine.objectContaining({
        customerId: 'c-1',
        carId: 'car-1',
        notes: 'pre-existing notes',
        lineItems: jasmine.any(Array),
      }),
    );
    expect(quoteServiceSpy.create).not.toHaveBeenCalled();
  });

  it('cancel() returns to /invoices/quotes/:id in edit mode', async () => {
    await setupWithRouteId('q-1');
    quoteServiceSpy.get.and.returnValue(of(makeQuote()));

    fixture.detectChanges();

    component.cancel();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/invoices/quotes', 'q-1']);
  });

  it('cancel() returns to /invoices/quotes (list) in create mode', async () => {
    await setupWithRouteId(null);

    fixture.detectChanges();
    component.cancel();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/invoices/quotes']);
    expect(component.isEditMode()).toBeFalse();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Sweep C-3 — Section 4 line types (S-QUO-005 / 006 / 007)
  // ─────────────────────────────────────────────────────────────────────────

  describe('S-QUO-005 — Add line type=Labor with hours × rate auto-compute', () => {
    it('addLine("labor") seeds laborHours=1, default description, quantity sync via updateLine', async () => {
      await setupWithRouteId(null);
      fixture.detectChanges();

      component.addLine('labor');

      const line = component.lines()[0];
      expect(line.type).toBe('labor');
      expect(line.laborHours).toBe(1);
      // The default description key is resolved via TranslationService.instant
      // — the test stub returns the key verbatim, so we assert the key.
      expect(line.description).toBe('invoicing.form.lines.defaultLaborDescription');
      expect(line.tvaRate).toBe(19);
    });

    it('updates quantity = laborHours when laborHours changes (2h × 80 DT = 160 HT)', async () => {
      await setupWithRouteId(null);
      fixture.detectChanges();

      component.addLine('labor');
      component.updateLine(0, 'unitPrice', 80);
      component.updateLine(0, 'laborHours', 2);

      const line = component.lines()[0];
      expect(line.laborHours).toBe(2);
      // updateLine syncs quantity for labor when laborHours / unitPrice change
      expect(line.quantity).toBe(2);
      // Line HT = 2 × 80 = 160
      expect(component.lineTotal(0)).toBe(160);
      // Subtotal HT = 160, TVA 19% = 30.40, TTC = 190.40
      expect(component.subtotalHT()).toBe(160);
      expect(component.totalTVA()).toBeCloseTo(30.4, 2);
      expect(component.totalTTC()).toBeCloseTo(190.4, 2);
    });

    it('toggling line type to labor via onLineTypeChange seeds laborHours/quantity', async () => {
      await setupWithRouteId(null);
      fixture.detectChanges();

      component.addLine('misc');
      component.onLineTypeChange(0, 'labor');

      const line = component.lines()[0];
      expect(line.type).toBe('labor');
      expect(line.laborHours).toBe(1);
      expect(line.quantity).toBe(1);
    });

    it('round-trips a labor line through QuoteService.create payload (unit=hour)', async () => {
      await setupWithRouteId(null);
      fixture.detectChanges();

      component.form.patchValue({
        customerId: 'c-1',
        carId: 'car-1',
        validUntil: '2026-05-14',
      });
      // Force the customer-change cascade so the car select is hydrated.
      component.cars.set(cars.filter((c) => c.customerId === 'c-1') as any);

      component.addLine('labor');
      component.updateLine(0, 'unitPrice', 80);
      component.updateLine(0, 'laborHours', 2);

      quoteServiceSpy.create.and.returnValue(of(makeQuote()));
      component.onSubmit();

      const payload = quoteServiceSpy.create.calls.mostRecent().args[0] as any;
      expect(payload.lineItems.length).toBe(1);
      expect(payload.lineItems[0]).toEqual(
        jasmine.objectContaining({
          type: 'labor',
          unit: 'hour',
          quantity: 2,
          unitPrice: 80,
          totalPrice: 160,
          laborHours: 2,
          tvaRate: 19,
        }),
      );
    });

    it('hydrates laborHours / quantity / unitPrice from a saved labor line in edit mode', async () => {
      await setupWithRouteId('q-1');
      const laborQuote = makeQuote({
        lineItems: [
          {
            id: 'li-2',
            type: 'labor',
            description: 'Mechanic labor',
            quantity: 2,
            unit: 'hour',
            unitPrice: 80,
            totalPrice: 160,
            laborHours: 2,
            tvaRate: 19,
            taxable: true,
          } as any,
        ],
      });
      quoteServiceSpy.get.and.returnValue(of(laborQuote));

      fixture.detectChanges();

      const line = component.lines()[0];
      expect(line.type).toBe('labor');
      expect(line.laborHours).toBe(2);
      expect(line.quantity).toBe(2);
      expect(line.unitPrice).toBe(80);
      expect(line.tvaRate).toBe(19);
      expect(component.lineTotal(0)).toBe(160);
    });
  });

  describe('S-QUO-006 — Add line type=Misc free-text', () => {
    it('addLine("misc") seeds an empty description with no picker fields', async () => {
      await setupWithRouteId(null);
      fixture.detectChanges();

      component.addLine('misc');

      const line = component.lines()[0];
      expect(line.type).toBe('misc');
      expect(line.description).toBe('');
      expect(line.quantity).toBe(1);
      expect(line.unitPrice).toBe(0);
      expect(line.partId).toBeUndefined();
      expect(line.serviceCode).toBeUndefined();
      expect(line.laborHours).toBeUndefined();
    });

    it('persists user free-text description / qty / unitPrice into create payload', async () => {
      await setupWithRouteId(null);
      fixture.detectChanges();

      component.form.patchValue({
        customerId: 'c-1',
        carId: 'car-1',
        validUntil: '2026-05-14',
      });
      component.cars.set(cars.filter((c) => c.customerId === 'c-1') as any);

      component.addLine('misc');
      component.updateLine(0, 'description', 'Pickup fee');
      component.updateLine(0, 'quantity', 1);
      component.updateLine(0, 'unitPrice', 15);

      quoteServiceSpy.create.and.returnValue(of(makeQuote()));
      component.onSubmit();

      const payload = quoteServiceSpy.create.calls.mostRecent().args[0] as any;
      expect(payload.lineItems[0]).toEqual(
        jasmine.objectContaining({
          type: 'misc',
          description: 'Pickup fee',
          unit: 'service',
          quantity: 1,
          unitPrice: 15,
          totalPrice: 15,
        }),
      );
      // No picker linkage
      expect(payload.lineItems[0].partId).toBeUndefined();
      expect(payload.lineItems[0].serviceCode).toBeUndefined();
    });

    it('hydrates a misc line from saved quote with arbitrary description', async () => {
      await setupWithRouteId('q-1');
      const miscQuote = makeQuote({
        lineItems: [
          {
            id: 'li-3',
            type: 'misc',
            description: 'Pickup fee',
            quantity: 1,
            unit: 'service',
            unitPrice: 15,
            totalPrice: 15,
            tvaRate: 19,
            taxable: true,
          } as any,
        ],
      });
      quoteServiceSpy.get.and.returnValue(of(miscQuote));

      fixture.detectChanges();

      const line = component.lines()[0];
      expect(line.type).toBe('misc');
      expect(line.description).toBe('Pickup fee');
      expect(line.quantity).toBe(1);
      expect(line.unitPrice).toBe(15);
      expect(component.lineTotal(0)).toBe(15);
    });
  });

  describe('S-QUO-007 — Remove line via × button', () => {
    it('removeLine drops the indexed line, recomputes totals', async () => {
      await setupWithRouteId(null);
      fixture.detectChanges();

      component.addLine('misc');
      component.updateLine(0, 'description', 'Line A');
      component.updateLine(0, 'quantity', 1);
      component.updateLine(0, 'unitPrice', 100);

      component.addLine('misc');
      component.updateLine(1, 'description', 'Line B');
      component.updateLine(1, 'quantity', 2);
      component.updateLine(1, 'unitPrice', 50);

      // Pre: 100 + 2*50 = 200 HT
      expect(component.lines().length).toBe(2);
      expect(component.subtotalHT()).toBe(200);

      component.removeLine(0);

      expect(component.lines().length).toBe(1);
      expect(component.lines()[0].description).toBe('Line B');
      // Post: only Line B (2 × 50 = 100 HT)
      expect(component.subtotalHT()).toBe(100);
      expect(component.totalTVA()).toBeCloseTo(19, 2);
      expect(component.totalTTC()).toBeCloseTo(119, 2);
    });

    it('removeLine is a no-op safe-guard for an out-of-range index', async () => {
      await setupWithRouteId(null);
      fixture.detectChanges();

      component.addLine('misc');
      component.updateLine(0, 'unitPrice', 100);

      component.removeLine(7); // bogus

      expect(component.lines().length).toBe(1);
      expect(component.subtotalHT()).toBe(100);
    });

    it('removing the only line empties the totals (back to 0)', async () => {
      await setupWithRouteId(null);
      fixture.detectChanges();

      component.addLine('misc');
      component.updateLine(0, 'unitPrice', 100);

      expect(component.subtotalHT()).toBe(100);

      component.removeLine(0);

      expect(component.lines().length).toBe(0);
      expect(component.subtotalHT()).toBe(0);
      expect(component.totalTVA()).toBe(0);
      expect(component.totalTTC()).toBe(0);
    });

    it('persists only the surviving line via QuoteService.create after removeLine', async () => {
      await setupWithRouteId(null);
      fixture.detectChanges();

      component.form.patchValue({
        customerId: 'c-1',
        carId: 'car-1',
        validUntil: '2026-05-14',
      });
      component.cars.set(cars.filter((c) => c.customerId === 'c-1') as any);

      component.addLine('misc');
      component.updateLine(0, 'description', 'First');
      component.updateLine(0, 'unitPrice', 100);

      component.addLine('misc');
      component.updateLine(1, 'description', 'Second');
      component.updateLine(1, 'unitPrice', 50);

      component.removeLine(0);

      quoteServiceSpy.create.and.returnValue(of(makeQuote()));
      component.onSubmit();

      const payload = quoteServiceSpy.create.calls.mostRecent().args[0] as any;
      expect(payload.lineItems.length).toBe(1);
      expect(payload.lineItems[0].description).toBe('Second');
      expect(payload.lineItems[0].unitPrice).toBe(50);
    });
  });
});
