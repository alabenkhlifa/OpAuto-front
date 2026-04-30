import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { InvoiceFormComponent } from './invoice-form.component';
import { InvoiceService } from '../../../core/services/invoice.service';
import { CustomerService } from '../../../core/services/customer.service';
import { AppointmentService } from '../../appointments/services/appointment.service';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { GarageSettingsService } from '../../../core/services/garage-settings.service';
import { UserService } from '../../../core/services/user.service';
import { TranslationService } from '../../../core/services/translation.service';
import { InvoiceWithDetails } from '../../../core/models/invoice.model';
import { GarageSettings } from '../../../core/models/garage-settings.model';

/**
 * Behavior tests for the rebuilt invoice form (Task 5.3).
 *
 * The Karma `.html` loader hits subfolder component specs in this repo
 * (project memory: pre-existing). These tests therefore stay
 * template-agnostic — they exercise public methods + computed signals
 * without rendering the template.
 */
describe('InvoiceFormComponent', () => {
  const buildSettings = (overrides: Partial<GarageSettings['fiscalSettings']> = {}): GarageSettings => ({
    garageInfo: {
      name: 'OpAuto', address: 'Tunis', city: 'Tunis', postalCode: '1000',
      country: 'Tunisia', phone: '+216-71-000-000', email: 'a@b.tn', taxId: '', registrationNumber: '',
    } as any,
    operationalSettings: {} as any,
    businessSettings: { currency: 'TND', taxSettings: {}, paymentSettings: {}, invoiceSettings: {}, pricingRules: { laborRatePerHour: 30 } } as any,
    systemSettings: {} as any,
    integrationSettings: {} as any,
    fiscalSettings: {
      mfNumber: '', rib: '', bankName: '', logoUrl: '',
      numberingPrefix: 'INV', numberingResetPolicy: 'YEARLY', numberingDigitCount: 4,
      defaultTvaRate: 19, fiscalStampEnabled: true, defaultPaymentTermsDays: 30,
      ...overrides,
    } as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  function configure(overrides?: { route?: any; settings?: GarageSettings; invoice?: Partial<InvoiceWithDetails> }) {
    const settings = overrides?.settings ?? buildSettings();
    const invoiceServiceStub = {
      fetchInvoiceById: jasmine.createSpy('fetchInvoiceById').and.returnValue(
        of({
          id: 'i1', invoiceNumber: 'INV-001', customerId: 'c1', carId: 'car1',
          issueDate: new Date(), dueDate: new Date(), status: 'sent',
          paymentMethod: undefined, currency: 'TND', subtotal: 0, taxRate: 19, taxAmount: 0,
          discountPercentage: 0, discountAmount: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0,
          lineItems: [], notes: '', paymentTerms: '', createdBy: '',
          createdAt: new Date(), updatedAt: new Date(),
          customerName: 'Foo', customerPhone: '', carMake: 'Toy', carModel: 'C', carYear: 2020,
          licensePlate: '111TUN1', paymentHistory: [],
          ...overrides?.invoice,
        } as InvoiceWithDetails),
      ),
      createInvoice: jasmine.createSpy('createInvoice').and.returnValue(of({ id: 'new', invoiceNumber: 'INV-002' } as any)),
      updateInvoice: jasmine.createSpy('updateInvoice').and.returnValue(of({ id: 'i1' } as any)),
      issueInvoice: jasmine.createSpy('issueInvoice').and.returnValue(of({ id: 'i1', invoiceNumber: 'INV-002', status: 'sent', customerEmail: 'a@b' } as any)),
      createInvoiceFromJob: jasmine.createSpy('createInvoiceFromJob').and.returnValue(of({ id: 'i1' } as any)),
      deliverInvoice: jasmine.createSpy('deliverInvoice').and.returnValue(of({ ok: true })),
      formatCurrency: (n: number) => `${n.toFixed(2)} TND`,
      pdfUrl: (id: string) => `/invoices/${id}/pdf`,
    };
    const customerServiceStub = { getCustomers: () => of([{ id: 'c1', name: 'Foo', phone: '+216' } as any]) };
    const carsStub = [{ id: 'car1', customerId: 'c1', make: 'Toy', model: 'C', year: 2020, licensePlate: '111TUN1' }];
    const appointmentServiceStub = { getCars: () => of(carsStub) };
    const maintenanceServiceStub = { getMaintenanceJobs: () => of([]) };
    const garageSettingsStub = { getSettings: () => of(settings) };
    const userServiceStub = { getUsers: () => of([{ id: 'u1', role: 'owner', firstName: 'O', lastName: 'Wner', email: 'o@w' } as any]) };

    TestBed.configureTestingModule({
      imports: [InvoiceFormComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: overrides?.route ?? {
          snapshot: { paramMap: { get: () => null }, queryParamMap: { get: () => null } },
        } },
        { provide: InvoiceService, useValue: invoiceServiceStub },
        { provide: CustomerService, useValue: customerServiceStub },
        { provide: AppointmentService, useValue: appointmentServiceStub },
        { provide: MaintenanceService, useValue: maintenanceServiceStub },
        { provide: GarageSettingsService, useValue: garageSettingsStub },
        { provide: UserService, useValue: userServiceStub },
        { provide: TranslationService, useValue: { instant: (k: string, p?: any) => k, getCurrentLanguage: () => 'en', translations$: of({}) } },
      ],
    });

    return { invoiceServiceStub, settings };
  }

  it('is invalid until customer + car + at least one line item are present', async () => {
    configure();
    const fixture: ComponentFixture<InvoiceFormComponent> = TestBed.createComponent(InvoiceFormComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();

    expect(cmp.canSubmit()).toBeFalse();
    expect(cmp.validationIssues()).toContain('invoicing.form.errors.customerRequired');

    cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
    expect(cmp.validationIssues()).toContain('invoicing.form.errors.lineItemRequired');

    cmp.addLine('misc');
    cmp.updateLine(0, 'description', 'Hello');
    cmp.updateLine(0, 'quantity', 1);
    cmp.updateLine(0, 'unitPrice', 10);
    expect(cmp.canSubmit()).toBeTrue();
  });

  it('service-picker prefills the row description, price, tva and labor hours', async () => {
    configure();
    const fixture = TestBed.createComponent(InvoiceFormComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    cmp.addLine('service');
    cmp.onServicePicked(0, {
      id: 's', garageId: 'g', code: 'OIL', name: 'Oil change', defaultPrice: 120,
      defaultLaborHours: 1, defaultTvaRate: 13, isActive: true, createdAt: '', updatedAt: '',
    });
    const line = cmp.lines()[0];
    expect(line.description).toBe('Oil change');
    expect(line.unitPrice).toBe(120);
    expect(line.tvaRate).toBe(13);
    expect(line.laborHours).toBe(1);
  });

  it('flags a part-overdraw row + invalidates the form', async () => {
    configure();
    const fixture = TestBed.createComponent(InvoiceFormComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
    cmp.addLine('part');
    cmp.onPartPicked(0, { id: 'p', name: 'Filter', brand: 'Bosch', price: 25, stockLevel: 2 } as any);
    cmp.updateLine(0, 'quantity', 5);
    expect(cmp.isOverdraw(0)).toBeTrue();
    expect(cmp.validationIssues()).toContain('invoicing.form.errors.partOverdraw');
    expect(cmp.canSubmit()).toBeFalse();
  });

  it('requires approver when invoice discount exceeds the audit threshold', async () => {
    configure({ settings: { ...buildSettings(), fiscalSettings: { ...buildSettings().fiscalSettings, defaultTvaRate: 19 } as any } });
    const fixture = TestBed.createComponent(InvoiceFormComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
    cmp.addLine('misc');
    cmp.updateLine(0, 'description', 'Foo');
    cmp.updateLine(0, 'quantity', 1);
    cmp.updateLine(0, 'unitPrice', 100);
    cmp.onDiscountChange(10);
    cmp.onDiscountReasonChange('Loyalty bonus');
    expect(cmp.approverRequired()).toBeTrue();
    expect(cmp.canSubmit()).toBeFalse();
    cmp.onApproverChange('u1');
    expect(cmp.canSubmit()).toBeTrue();
  });

  it('locked invoice (status=sent) reports isLocked and disables submit', async () => {
    configure({
      route: { snapshot: { paramMap: { get: () => 'i1' }, queryParamMap: { get: () => null } } },
    });
    const fixture = TestBed.createComponent(InvoiceFormComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    expect(cmp.isLocked()).toBeTrue();
    expect(cmp.canSubmit()).toBeFalse();
  });

  it('saveDraft persists a create payload via InvoiceService.createInvoice', async () => {
    const { invoiceServiceStub } = configure();
    const fixture = TestBed.createComponent(InvoiceFormComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
    cmp.addLine('misc');
    cmp.updateLine(0, 'description', 'Item');
    cmp.updateLine(0, 'quantity', 2);
    cmp.updateLine(0, 'unitPrice', 50);
    cmp.saveDraft();
    expect(invoiceServiceStub.createInvoice).toHaveBeenCalled();
    const arg = invoiceServiceStub.createInvoice.calls.mostRecent().args[0];
    expect(arg.customerId).toBe('c1');
    expect(arg.lineItems.length).toBe(1);
    expect(arg.lineItems[0].totalPrice).toBe(100);
  });

  it('Issue & Send opens the send modal after issuing successfully', async () => {
    const { invoiceServiceStub } = configure();
    const fixture = TestBed.createComponent(InvoiceFormComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
    cmp.addLine('misc');
    cmp.updateLine(0, 'description', 'Item');
    cmp.updateLine(0, 'quantity', 1);
    cmp.updateLine(0, 'unitPrice', 80);
    cmp.issueAndSend();
    expect(invoiceServiceStub.createInvoice).toHaveBeenCalled();
    expect(invoiceServiceStub.issueInvoice).toHaveBeenCalled();
    expect(cmp.sendModalOpen()).toBeTrue();
  });
});
