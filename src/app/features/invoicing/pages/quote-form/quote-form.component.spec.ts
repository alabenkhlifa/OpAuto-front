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
});
