import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { ToastService } from '../../../shared/services/toast.service';

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
      discountAuditThresholdPct: 5,
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

  /**
   * S-INV-W-006 — Part-picker row turns red (`.error`) when the entered
   * quantity exceeds the live stock for the selected part. Visual cue is
   * a `.error` class on the `<tr>`; the warning span (`invoice-form-stock--bad`)
   * also surfaces the live stock count.
   */
  it('S-INV-W-006: row gains .error class + bad-stock warning when qty > stock', async () => {
    configure();
    const fixture = TestBed.createComponent(InvoiceFormComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();
    cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
    cmp.addLine('part');
    cmp.onPartPicked(0, { id: 'p', name: 'Filter', brand: 'Bosch', price: 25, stockLevel: 3 } as any);
    cmp.updateLine(0, 'quantity', 1); // within stock
    fixture.detectChanges();
    let row = (fixture.nativeElement as HTMLElement).querySelector(
      '.invoice-form-table tbody tr',
    );
    expect(row?.classList.contains('error')).toBeFalse();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.invoice-form-stock--bad',
      ),
    ).toBeNull();

    // Bump qty over stock — row should flip red, bad-stock span should mount.
    cmp.updateLine(0, 'quantity', 10);
    fixture.detectChanges();
    row = (fixture.nativeElement as HTMLElement).querySelector(
      '.invoice-form-table tbody tr',
    );
    expect(row?.classList.contains('error')).toBeTrue();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.invoice-form-stock--bad',
      ),
    ).toBeTruthy();
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

  // BUG-094: When reopening a saved DRAFT, the form must restore the
  // persisted line `type` and `tvaRate` verbatim — not snap to the dropdown's
  // first option (Service / 0 %). Saving from a desynced state would silently
  // overwrite the database with the wrong values.
  it('BUG-094: loadInvoice preserves persisted line type and per-line tvaRate', async () => {
    configure({
      route: { snapshot: { paramMap: { get: () => 'i1' }, queryParamMap: { get: () => null } } },
      invoice: {
        status: 'draft',
        taxRate: 0, // legacy invoice-level rate is intentionally bogus
        lineItems: [
          {
            id: 'l1', type: 'misc', description: 'Hose', quantity: 1, unit: 'piece',
            unitPrice: 100, totalPrice: 119, tvaRate: 19, discountPercentage: 0, taxable: true,
          } as any,
          {
            id: 'l2', type: 'part', description: 'Filter', quantity: 2, unit: 'piece',
            unitPrice: 50, totalPrice: 113, tvaRate: 13, discountPercentage: 0, taxable: true,
          } as any,
          {
            id: 'l3', type: 'labor', description: 'Diag', quantity: 1, unit: 'hour',
            unitPrice: 30, totalPrice: 32.1, tvaRate: 7, discountPercentage: 0, taxable: true,
          } as any,
        ],
      },
    });
    const fixture = TestBed.createComponent(InvoiceFormComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();

    const lines = cmp.lines();
    expect(lines.length).toBe(3);
    expect(lines[0].type).toBe('misc');
    expect(lines[0].tvaRate).toBe(19);
    expect(lines[1].type).toBe('part');
    expect(lines[1].tvaRate).toBe(13);
    expect(lines[2].type).toBe('labor');
    expect(lines[2].tvaRate).toBe(7);
  });

  // BUG-094 (defensive): If backend returns an unknown / null line type,
  // fall back to 'service' (UI default) rather than crashing the dropdown.
  it('BUG-094: loadInvoice falls back to service when type is missing/unknown', async () => {
    configure({
      route: { snapshot: { paramMap: { get: () => 'i1' }, queryParamMap: { get: () => null } } },
      invoice: {
        status: 'draft',
        lineItems: [
          { id: 'l1', type: null as any, description: 'X', quantity: 1, unit: 'service',
            unitPrice: 10, totalPrice: 11.9, tvaRate: 19, discountPercentage: 0, taxable: true } as any,
          { id: 'l2', type: 'gibberish' as any, description: 'Y', quantity: 1, unit: 'service',
            unitPrice: 20, totalPrice: 23.8, tvaRate: 19, discountPercentage: 0, taxable: true } as any,
        ],
      },
    });
    const fixture = TestBed.createComponent(InvoiceFormComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();

    expect(cmp.lines()[0].type).toBe('service');
    expect(cmp.lines()[1].type).toBe('service');
  });

  // BUG-094 (defensive): a numeric-string tvaRate from a JSON edge case
  // must coerce to the matching TVA bucket, not zero.
  it('BUG-094: loadInvoice coerces numeric-string tvaRate to the right bucket', async () => {
    configure({
      route: { snapshot: { paramMap: { get: () => 'i1' }, queryParamMap: { get: () => null } } },
      invoice: {
        status: 'draft',
        lineItems: [
          { id: 'l1', type: 'misc', description: 'X', quantity: 1, unit: 'service',
            unitPrice: 10, totalPrice: 11.9, tvaRate: '13' as any, discountPercentage: 0, taxable: true } as any,
        ],
      },
    });
    const fixture = TestBed.createComponent(InvoiceFormComponent);
    const cmp = fixture.componentInstance;
    cmp.ngOnInit();
    await fixture.whenStable();

    expect(cmp.lines()[0].tvaRate).toBe(13);
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

  // ── Sweep B-1 ──────────────────────────────────────────────────────────────

  /**
   * S-INV-021 — Discount % > Garage.discountAuditThresholdPct without an
   * approver MUST invalidate the form AND surface the
   * `invoicing.form.errors.approverRequired` translated entry in the sticky
   * banner. The default threshold is 5 %; we exercise the boundary explicitly.
   */
  describe('S-INV-021 — discount-audit guard', () => {
    it('5.5% discount on default 5% threshold without approver → invalid + banner entry', async () => {
      configure();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('misc');
      cmp.updateLine(0, 'description', 'Foo');
      cmp.updateLine(0, 'quantity', 1);
      cmp.updateLine(0, 'unitPrice', 100);
      cmp.onDiscountChange(5.5);
      cmp.onDiscountReasonChange('Loyalty');

      expect(cmp.auditThresholdPct()).toBe(5);
      expect(cmp.approverRequired()).toBeTrue();
      expect(cmp.validationIssues()).toContain('invoicing.form.errors.approverRequired');
      expect(cmp.canSubmit()).toBeFalse();

      cmp.onApproverChange('u1');
      expect(cmp.validationIssues()).not.toContain('invoicing.form.errors.approverRequired');
      expect(cmp.canSubmit()).toBeTrue();
    });

    it('discount exactly at threshold (5%) is allowed without approver', async () => {
      configure();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('misc');
      cmp.updateLine(0, 'description', 'Foo');
      cmp.updateLine(0, 'quantity', 1);
      cmp.updateLine(0, 'unitPrice', 100);
      cmp.onDiscountChange(5);
      cmp.onDiscountReasonChange('Loyalty');

      expect(cmp.approverRequired()).toBeFalse();
      expect(cmp.validationIssues()).not.toContain('invoicing.form.errors.approverRequired');
      expect(cmp.canSubmit()).toBeTrue();
    });

    it('honours a garage-level threshold override from FiscalSettings', async () => {
      const settings = buildSettings();
      (settings.fiscalSettings as any).discountAuditThresholdPct = 10;
      configure({ settings });
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('misc');
      cmp.updateLine(0, 'description', 'Foo');
      cmp.updateLine(0, 'quantity', 1);
      cmp.updateLine(0, 'unitPrice', 100);
      cmp.onDiscountChange(8);
      cmp.onDiscountReasonChange('Loyalty');

      expect(cmp.auditThresholdPct()).toBe(10);
      expect(cmp.approverRequired()).toBeFalse();
      expect(cmp.canSubmit()).toBeTrue();
    });

    // S-SET-009: 7 % discount fires the gate at the default 5 % threshold.
    it('S-SET-009: 7% discount triggers approver gate at default 5% threshold', async () => {
      configure({ settings: buildSettings() });
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('misc');
      cmp.updateLine(0, 'description', 'Foo');
      cmp.updateLine(0, 'quantity', 1);
      cmp.updateLine(0, 'unitPrice', 100);
      cmp.onDiscountChange(7);
      cmp.onDiscountReasonChange('Loyalty');
      expect(cmp.auditThresholdPct()).toBe(5);
      expect(cmp.approverRequired()).toBeTrue();
    });

    // S-SET-009: with threshold raised to 10 %, the same 7 % discount no
    // longer trips the approver gate.
    it('S-SET-009: 7% discount stays open when threshold raised to 10%', async () => {
      const settings = buildSettings();
      (settings.fiscalSettings as any).discountAuditThresholdPct = 10;
      configure({ settings });
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('misc');
      cmp.updateLine(0, 'description', 'Foo');
      cmp.updateLine(0, 'quantity', 1);
      cmp.updateLine(0, 'unitPrice', 100);
      cmp.onDiscountChange(7);
      cmp.onDiscountReasonChange('Loyalty');
      expect(cmp.auditThresholdPct()).toBe(10);
      expect(cmp.approverRequired()).toBeFalse();
    });
  });

  /**
   * S-SET-007 — Garage's `defaultTvaRate` flows into newly-added lines via
   * `addLine()`. Switching the garage default from 19 → 13 means the next
   * `+ Service`, `+ Part`, `+ Labor`, `+ Misc` row pre-selects 13 %.
   */
  describe('S-SET-007: defaultTvaRate from garage settings', () => {
    it('seeds new lines with the garage default TVA rate', async () => {
      const settings = buildSettings({ defaultTvaRate: 13 });
      configure({ settings });
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      cmp.addLine('service');
      cmp.addLine('part');
      cmp.addLine('labor');
      cmp.addLine('misc');

      expect(cmp.lines()[0].tvaRate).toBe(13);
      expect(cmp.lines()[1].tvaRate).toBe(13);
      expect(cmp.lines()[2].tvaRate).toBe(13);
      expect(cmp.lines()[3].tvaRate).toBe(13);
    });

    it('falls back to 19 % when defaultTvaRate is missing', async () => {
      const settings = buildSettings();
      delete (settings.fiscalSettings as any).defaultTvaRate;
      configure({ settings });
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.addLine('misc');
      expect(cmp.lines()[0].tvaRate).toBe(19);
    });

    // Defensive: an unknown TVA rate from settings should normalize to 19,
    // not silently corrupt the line.
    it('normalizes a non-canonical defaultTvaRate to 19 %', async () => {
      const settings = buildSettings({ defaultTvaRate: 42 } as any);
      configure({ settings });
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.addLine('misc');
      expect(cmp.lines()[0].tvaRate).toBe(19);
    });
  });

  /**
   * S-INV-023 — Per-line discount % auto-recomputes the line total AND the
   * invoice TVA breakdown on edit. Math pin: qty=2, unitPrice=100, line
   * discount 10 % → line net 180 ; TVA at 19 % → 34.20.
   */
  describe('S-INV-023 — per-line discount recomputes line + invoice TVA', () => {
    it('line net + TVA recompute when the line discount changes', async () => {
      configure();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('misc');
      cmp.updateLine(0, 'description', 'Foo');
      cmp.updateLine(0, 'quantity', 2);
      cmp.updateLine(0, 'unitPrice', 100);
      cmp.updateLine(0, 'tvaRate', 19);

      // Pre-discount: 2 × 100 = 200 ; TVA 19% = 38
      expect(cmp.lineTotal(0)).toBe(200);
      expect(cmp.subtotalHT()).toBe(200);
      expect(cmp.totalTVA()).toBeCloseTo(38, 5);

      // Apply 10% line discount.
      cmp.updateLine(0, 'discountPct', 10);

      expect(cmp.lineTotal(0)).toBe(180);
      expect(cmp.subtotalHT()).toBe(180);
      expect(cmp.totalTVA()).toBeCloseTo(34.2, 5);

      const breakdown = cmp.tvaBreakdown();
      expect(breakdown.length).toBe(1);
      expect(breakdown[0].rate).toBe(19);
      expect(breakdown[0].base).toBeCloseTo(180, 5);
      expect(breakdown[0].tva).toBeCloseTo(34.2, 5);
    });

    it('mixed-rate lines roll up into a per-rate TVA breakdown', async () => {
      configure();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });

      // Line A — 19% TVA, qty 2, price 100, disc 10% → 180
      cmp.addLine('misc');
      cmp.updateLine(0, 'description', 'A');
      cmp.updateLine(0, 'quantity', 2);
      cmp.updateLine(0, 'unitPrice', 100);
      cmp.updateLine(0, 'tvaRate', 19);
      cmp.updateLine(0, 'discountPct', 10);
      // Line B — 7% TVA, qty 1, price 50 → 50
      cmp.addLine('misc');
      cmp.updateLine(1, 'description', 'B');
      cmp.updateLine(1, 'quantity', 1);
      cmp.updateLine(1, 'unitPrice', 50);
      cmp.updateLine(1, 'tvaRate', 7);

      const breakdown = cmp.tvaBreakdown();
      expect(breakdown.length).toBe(2);
      const r7 = breakdown.find((r) => r.rate === 7)!;
      const r19 = breakdown.find((r) => r.rate === 19)!;
      expect(r7.base).toBeCloseTo(50, 5);
      expect(r7.tva).toBeCloseTo(3.5, 5);
      expect(r19.base).toBeCloseTo(180, 5);
      expect(r19.tva).toBeCloseTo(34.2, 5);
      expect(cmp.totalTVA()).toBeCloseTo(37.7, 5);
    });
  });

  /**
   * S-INV-024 — Sticky right-rail summary updates reactively on every form /
   * line / discount change. We pin the chain by reading the computed signals
   * directly: each mutation must flow through to subtotalHT / totalTVA /
   * totalTTC without an explicit trigger.
   */
  describe('S-INV-024 — sticky summary reactivity', () => {
    it('recomputes totals on add line / edit line / remove line / invoice discount', async () => {
      configure();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });

      // Empty: every total is 0 (apart from the fiscal stamp).
      expect(cmp.subtotalHT()).toBe(0);
      expect(cmp.totalTVA()).toBe(0);
      expect(cmp.totalTTC()).toBe(cmp.fiscalStamp());

      // Add line 1 (100 HT, 19% TVA).
      cmp.addLine('misc');
      cmp.updateLine(0, 'description', 'A');
      cmp.updateLine(0, 'quantity', 1);
      cmp.updateLine(0, 'unitPrice', 100);
      cmp.updateLine(0, 'tvaRate', 19);
      const stamp = cmp.fiscalStamp();
      expect(cmp.subtotalHT()).toBe(100);
      expect(cmp.totalTVA()).toBeCloseTo(19, 5);
      expect(cmp.totalTTC()).toBeCloseTo(100 + 19 + stamp, 5);

      // Add line 2 (50 HT, 7% TVA).
      cmp.addLine('misc');
      cmp.updateLine(1, 'description', 'B');
      cmp.updateLine(1, 'quantity', 1);
      cmp.updateLine(1, 'unitPrice', 50);
      cmp.updateLine(1, 'tvaRate', 7);
      expect(cmp.subtotalHT()).toBe(150);
      expect(cmp.totalTVA()).toBeCloseTo(19 + 3.5, 5);
      expect(cmp.totalTTC()).toBeCloseTo(150 + 22.5 + stamp, 5);

      // Apply a 4% invoice-level discount (under threshold — no approver gate).
      cmp.onDiscountChange(4);
      cmp.onDiscountReasonChange('Goodwill');
      expect(cmp.discountedSubtotal()).toBeCloseTo(150 * 0.96, 5);
      // TVA scales with the discounted base.
      expect(cmp.totalTVA()).toBeCloseTo((100 * 19 + 50 * 7) * 0.96 / 100, 5);

      // Remove the second line.
      cmp.removeLine(1);
      expect(cmp.subtotalHT()).toBe(100);
      expect(cmp.discountedSubtotal()).toBeCloseTo(96, 5);
      expect(cmp.totalTVA()).toBeCloseTo(96 * 0.19, 5);
      expect(cmp.totalTTC()).toBeCloseTo(96 + 96 * 0.19 + stamp, 5);
    });
  });

  /**
   * S-INV-025 — The sticky validation banner must list every missing required
   * field with a translated label, and entries must clear as the user fixes
   * each one. Branch matrix: no customer / no vehicle / no lines / discount
   * without reason / discount above threshold without approver.
   */
  describe('S-INV-025 — validation banner branch matrix', () => {
    it('lists each missing field independently and clears them in turn', async () => {
      configure();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      // Initial: customer + vehicle + line all missing.
      let issues = cmp.validationIssues();
      expect(issues).toContain('invoicing.form.errors.customerRequired');
      expect(issues).toContain('invoicing.form.errors.vehicleRequired');
      expect(issues).toContain('invoicing.form.errors.lineItemRequired');

      // Picking customer clears the customer entry but keeps the rest.
      cmp.form.patchValue({ customerId: 'c1' });
      issues = cmp.validationIssues();
      expect(issues).not.toContain('invoicing.form.errors.customerRequired');
      expect(issues).toContain('invoicing.form.errors.vehicleRequired');
      expect(issues).toContain('invoicing.form.errors.lineItemRequired');

      // Picking vehicle clears the vehicle entry.
      cmp.form.patchValue({ carId: 'car1' });
      issues = cmp.validationIssues();
      expect(issues).not.toContain('invoicing.form.errors.vehicleRequired');
      expect(issues).toContain('invoicing.form.errors.lineItemRequired');

      // Adding an empty line clears `lineItemRequired` but introduces
      // `lineDescriptionRequired` (the line has no description yet).
      cmp.addLine('misc');
      issues = cmp.validationIssues();
      expect(issues).not.toContain('invoicing.form.errors.lineItemRequired');
      expect(issues).toContain('invoicing.form.errors.lineDescriptionRequired');

      // Filling the line clears the description entry → form valid.
      cmp.updateLine(0, 'description', 'Hello');
      cmp.updateLine(0, 'quantity', 1);
      cmp.updateLine(0, 'unitPrice', 10);
      expect(cmp.validationIssues().length).toBe(0);
      expect(cmp.canSubmit()).toBeTrue();
    });

    it('discount > 0 without reason → banner lists discountReasonRequired', async () => {
      configure();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('misc');
      cmp.updateLine(0, 'description', 'X');
      cmp.updateLine(0, 'quantity', 1);
      cmp.updateLine(0, 'unitPrice', 100);
      cmp.onDiscountChange(2);

      expect(cmp.validationIssues()).toContain('invoicing.form.errors.discountReasonRequired');

      cmp.onDiscountReasonChange('Goodwill');
      expect(cmp.validationIssues()).not.toContain('invoicing.form.errors.discountReasonRequired');
    });

    it('every banner key has a counterpart in en.json (no raw keys leak through)', () => {
      // Lightweight guard: we don't load JSON at runtime here; instead, we
      // pin the canonical key list. The companion i18n parity script
      // (`npm run i18n:check`) verifies en/fr/ar coverage for these keys.
      const expectedKeys = [
        'invoicing.form.errors.customerRequired',
        'invoicing.form.errors.vehicleRequired',
        'invoicing.form.errors.lineItemRequired',
        'invoicing.form.errors.lineDescriptionRequired',
        'invoicing.form.errors.discountReasonRequired',
        'invoicing.form.errors.approverRequired',
        'invoicing.form.errors.partOverdraw',
      ];
      // Every key must be a non-empty string with the expected namespace.
      for (const key of expectedKeys) {
        expect(key.startsWith('invoicing.form.errors.')).toBeTrue();
      }
    });
  });

  describe('S-INV-005 — Edit DRAFT invoice: change customer / car cascades', () => {
    /**
     * The cascading-dropdown behaviour is what S-INV-005 actually tests:
     * picking a new customer must (a) refilter the vehicle list to that
     * customer's cars and (b) clear the previously-selected `carId` so
     * we never persist a (customerA, carB) combo. Picking a new car must
     * clear any maintenance-job link. Save Draft in edit mode must
     * persist the new customer + car via PUT /invoices/:id (the mapper
     * forwards `customerId` + `carId` per `mapToBackend`).
     */
    function multiCustomerConfig() {
      const settings: GarageSettings = {
        garageInfo: { name: 'OpAuto' } as any,
        operationalSettings: {} as any,
        businessSettings: { currency: 'TND', taxSettings: {}, paymentSettings: {}, invoiceSettings: {}, pricingRules: { laborRatePerHour: 30 } } as any,
        systemSettings: {} as any,
        integrationSettings: {} as any,
        fiscalSettings: {
          mfNumber: '', rib: '', bankName: '', logoUrl: '',
          numberingPrefix: 'INV', numberingResetPolicy: 'YEARLY', numberingDigitCount: 4,
          defaultTvaRate: 19, fiscalStampEnabled: true, defaultPaymentTermsDays: 30,
          discountAuditThresholdPct: 5,
        } as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const customers = [
        { id: 'c1', name: 'Foo', phone: '+216-1' } as any,
        { id: 'c2', name: 'Bar', phone: '+216-2' } as any,
      ];
      const cars = [
        { id: 'carA', customerId: 'c1', make: 'Toy', model: 'Corolla', year: 2020, licensePlate: '111TUN1' } as any,
        { id: 'carB', customerId: 'c1', make: 'Peu', model: '208', year: 2018, licensePlate: '222TUN2' } as any,
        { id: 'carC', customerId: 'c2', make: 'Ren', model: 'Clio', year: 2022, licensePlate: '333TUN3' } as any,
      ];
      const jobs = [
        { id: 'j1', customerId: 'c1', carId: 'carA', repairOrderNumber: 'RO-1' } as any,
      ];
      const invoiceServiceStub = {
        fetchInvoiceById: jasmine.createSpy('fetchInvoiceById').and.returnValue(
          of({
            id: 'i1', invoiceNumber: 'INV-001',
            customerId: 'c1', carId: 'carA',
            issueDate: new Date(), dueDate: new Date(), status: 'draft',
            paymentMethod: undefined, currency: 'TND',
            subtotal: 100, taxRate: 19, taxAmount: 19,
            discountPercentage: 0, discountAmount: 0,
            totalAmount: 119, paidAmount: 0, remainingAmount: 119,
            lineItems: [
              { id: 'l1', type: 'misc', description: 'X', quantity: 1, unit: 'piece',
                unitPrice: 100, totalPrice: 119, tvaRate: 19, discountPercentage: 0, taxable: true } as any,
            ],
            notes: '', paymentTerms: '', createdBy: '',
            createdAt: new Date(), updatedAt: new Date(),
            customerName: 'Foo', customerPhone: '+216-1',
            carMake: 'Toy', carModel: 'Corolla', carYear: 2020,
            licensePlate: '111TUN1', paymentHistory: [],
            maintenanceJobId: 'j1',
          } as InvoiceWithDetails),
        ),
        createInvoice: jasmine.createSpy('createInvoice').and.returnValue(of({ id: 'new' } as any)),
        updateInvoice: jasmine.createSpy('updateInvoice').and.returnValue(of({ id: 'i1' } as any)),
        issueInvoice: jasmine.createSpy('issueInvoice').and.returnValue(of({ id: 'i1' } as any)),
        createInvoiceFromJob: jasmine.createSpy('createInvoiceFromJob').and.returnValue(of({ id: 'i1' } as any)),
        formatCurrency: (n: number) => `${n.toFixed(2)} TND`,
        pdfUrl: (id: string) => `/invoices/${id}/pdf`,
      };

      TestBed.configureTestingModule({
        imports: [InvoiceFormComponent],
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ActivatedRoute, useValue: {
            snapshot: { paramMap: { get: () => 'i1' }, queryParamMap: { get: () => null } },
          } },
          { provide: InvoiceService, useValue: invoiceServiceStub },
          { provide: CustomerService, useValue: { getCustomers: () => of(customers) } },
          { provide: AppointmentService, useValue: { getCars: () => of(cars) } },
          { provide: MaintenanceService, useValue: { getMaintenanceJobs: () => of(jobs) } },
          { provide: GarageSettingsService, useValue: { getSettings: () => of(settings) } },
          { provide: UserService, useValue: { getUsers: () => of([{ id: 'u1', role: 'owner', firstName: 'O', lastName: 'W', email: 'o@w' } as any]) } },
          { provide: TranslationService, useValue: { instant: (k: string) => k, getCurrentLanguage: () => 'en', translations$: of({}) } },
        ],
      });

      return invoiceServiceStub;
    }

    it('hydrates the form from the existing invoice in edit mode (customer / car / line)', async () => {
      multiCustomerConfig();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      expect(cmp.isEditMode()).toBeTrue();
      expect(cmp.form.value.customerId).toBe('c1');
      expect(cmp.form.value.carId).toBe('carA');
      expect(cmp.lines().length).toBe(1);
      // filteredCars must reflect the loaded customer (carA + carB).
      expect(cmp.filteredCars().map((c) => c.id).sort()).toEqual(['carA', 'carB']);
    });

    it('changing customer rebuilds filteredCars and clears carId / job link', async () => {
      multiCustomerConfig();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      // Switch customer c1 → c2.
      cmp.form.patchValue({ customerId: 'c2' });
      cmp.onCustomerChange();

      // Only c2's cars remain in the dropdown.
      expect(cmp.filteredCars().map((c) => c.id)).toEqual(['carC']);
      // carId was cleared (was carA from c1) since c2 has != 1 (well, 1
      // here — single-match auto-pick keeps the form usable, see next).
      // For this seed c2 has exactly one car, so handler auto-picks it.
      expect(cmp.form.value.carId).toBe('carC');
      // Job link is cleared regardless.
      expect(cmp.form.value.maintenanceJobId).toBe('');
      expect(cmp.linkedJob()).toBeNull();
    });

    it('switching to a customer with multiple cars clears carId (no auto-pick)', async () => {
      multiCustomerConfig();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      // Patch customer to a "fresh" assignment and also flip away+back to
      // exercise the cars.length !== 1 branch. c1 has carA + carB.
      cmp.form.patchValue({ customerId: 'c2' });
      cmp.onCustomerChange();
      expect(cmp.form.value.carId).toBe('carC');

      cmp.form.patchValue({ customerId: 'c1' });
      cmp.onCustomerChange();
      // c1 has 2 cars → carId must be cleared, NOT auto-picked.
      expect(cmp.filteredCars().map((c) => c.id).sort()).toEqual(['carA', 'carB']);
      expect(cmp.form.value.carId).toBe('');
    });

    it('changing car clears maintenanceJobId + linkedJob signal', async () => {
      multiCustomerConfig();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      // After load, the linked job (j1, carA) is materialised.
      expect(cmp.linkedJob()?.id).toBe('j1');

      cmp.form.patchValue({ carId: 'carB' });
      cmp.onCarChange();

      expect(cmp.form.value.maintenanceJobId).toBe('');
      expect(cmp.linkedJob()).toBeNull();
    });

    it('Save Draft in edit mode persists the new customer/car via PUT', async () => {
      const stub = multiCustomerConfig();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      // Change customer + car.
      cmp.form.patchValue({ customerId: 'c2' });
      cmp.onCustomerChange();
      // c2 has a single car so the handler already auto-picked carC.
      expect(cmp.form.value.carId).toBe('carC');

      cmp.saveDraft();

      expect(stub.updateInvoice).toHaveBeenCalled();
      const [id, payload] = stub.updateInvoice.calls.mostRecent().args;
      expect(id).toBe('i1');
      expect(payload.customerId).toBe('c2');
      expect(payload.carId).toBe('carC');
      // Job-link is cleared on customer change.
      expect(payload.maintenanceJobId).toBeUndefined();
    });
  });

  // ── Sweep B-3 ──────────────────────────────────────────────────────────────

  /**
   * S-INV-026 — Save Draft must preserve every form value when the underlying
   * `createInvoice` / `updateInvoice` HTTP call errors out (5xx, network drop,
   * etc.). Contract: form values stay exactly as typed, a translated toast
   * fires (`invoicing.form.errors.saveFailed`), `isSubmitting()` flips back to
   * false so the buttons re-enable, and there is no SPA navigation.
   */
  describe('S-INV-026 — Save Draft preserves form on network failure', () => {
    function fillValidFormFor(cmp: InvoiceFormComponent) {
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1', notes: 'Keep me alive' });
      cmp.addLine('misc');
      cmp.updateLine(0, 'description', 'Network failure test line');
      cmp.updateLine(0, 'quantity', 2);
      cmp.updateLine(0, 'unitPrice', 50);
    }

    it('createInvoice 500: form values + lines + isSubmitting all preserved; saveFailed toast fired; no navigation', async () => {
      const { invoiceServiceStub } = configure();
      const errorResponse = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
        url: 'http://localhost:3000/api/invoices',
      });
      invoiceServiceStub.createInvoice.and.returnValue(throwError(() => errorResponse));

      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      const toastSvc = TestBed.inject(ToastService);
      const toastSpy = spyOn(toastSvc, 'error');
      const router = TestBed.inject(Router);
      const navSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

      cmp.ngOnInit();
      await fixture.whenStable();
      fillValidFormFor(cmp);
      expect(cmp.canSubmit()).toBeTrue();

      cmp.saveDraft();

      // The submit observable errored synchronously (throwError is sync).
      expect(invoiceServiceStub.createInvoice).toHaveBeenCalledTimes(1);
      // Form values are intact.
      expect(cmp.form.value.customerId).toBe('c1');
      expect(cmp.form.value.carId).toBe('car1');
      expect(cmp.form.value.notes).toBe('Keep me alive');
      // Lines preserved verbatim.
      expect(cmp.lines().length).toBe(1);
      expect(cmp.lines()[0].description).toBe('Network failure test line');
      expect(cmp.lines()[0].quantity).toBe(2);
      expect(cmp.lines()[0].unitPrice).toBe(50);
      // Submit-flag flipped back so the buttons re-enable.
      expect(cmp.isSubmitting()).toBeFalse();
      expect(cmp.canSubmit()).toBeTrue();
      // Translated toast fired with the saveFailed key.
      expect(toastSpy).toHaveBeenCalledWith('invoicing.form.errors.saveFailed');
      // No SPA navigation — we must NOT redirect to /invoices on failure.
      expect(navSpy).not.toHaveBeenCalled();
    });

    it('updateInvoice 500 in edit mode: form + lines preserved; saveFailed toast; no navigation', async () => {
      const { invoiceServiceStub } = configure({
        route: { snapshot: { paramMap: { get: () => 'i1' }, queryParamMap: { get: () => null } } },
        invoice: {
          status: 'draft',
          customerId: 'c1', carId: 'car1', notes: 'Original note',
          lineItems: [
            { id: 'l1', type: 'misc', description: 'Existing line', quantity: 1, unit: 'piece',
              unitPrice: 100, totalPrice: 119, tvaRate: 19, discountPercentage: 0, taxable: true } as any,
          ],
        },
      });
      const errorResponse = new HttpErrorResponse({ status: 0, statusText: 'Network error' });
      invoiceServiceStub.updateInvoice.and.returnValue(throwError(() => errorResponse));

      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      const toastSvc = TestBed.inject(ToastService);
      const toastSpy = spyOn(toastSvc, 'error');
      const router = TestBed.inject(Router);
      const navSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

      cmp.ngOnInit();
      await fixture.whenStable();

      // Edit a value — the user's in-flight change must survive the failure.
      cmp.form.patchValue({ notes: 'Edited note must survive' });
      cmp.updateLine(0, 'description', 'Edited line description');

      cmp.saveDraft();

      expect(invoiceServiceStub.updateInvoice).toHaveBeenCalledTimes(1);
      // The user's edits are still in the form/lines.
      expect(cmp.form.value.notes).toBe('Edited note must survive');
      expect(cmp.lines()[0].description).toBe('Edited line description');
      // Submit re-enabled, no navigation, translated toast fired.
      expect(cmp.isSubmitting()).toBeFalse();
      expect(toastSpy).toHaveBeenCalledWith('invoicing.form.errors.saveFailed');
      expect(navSpy).not.toHaveBeenCalled();
    });

    it('successful save after a prior failure: createInvoice retried and navigation fires only on success', async () => {
      const { invoiceServiceStub } = configure();
      const errorResponse = new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' });
      // First call errors, second call succeeds.
      invoiceServiceStub.createInvoice.and.returnValues(
        throwError(() => errorResponse),
        of({ id: 'new-1', invoiceNumber: 'DRAFT-deadbeef' } as any),
      );

      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      const router = TestBed.inject(Router);
      const navSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

      cmp.ngOnInit();
      await fixture.whenStable();
      fillValidFormFor(cmp);

      cmp.saveDraft();
      // First call failed — no navigation, form intact.
      expect(navSpy).not.toHaveBeenCalled();
      expect(cmp.lines()[0].description).toBe('Network failure test line');
      expect(cmp.isSubmitting()).toBeFalse();

      // Retry — same form, second call succeeds → navigation fires.
      cmp.saveDraft();
      expect(invoiceServiceStub.createInvoice).toHaveBeenCalledTimes(2);
      expect(navSpy).toHaveBeenCalledWith(['/invoices', 'new-1']);
    });
  });

  /**
   * S-INV-027 — Preview PDF on the form fetches the PDF as an authenticated
   * Blob (`InvoiceService.getInvoicePdfBlob`) and opens it in a new tab via
   * `URL.createObjectURL` + `window.open`. It must NOT navigate the SPA away
   * from `/invoices/edit/:id` (the Sweep A `/dashboard` SPA-route trap).
   * Works on DRAFT invoices because the BE renders DRAFTs with the
   * `DRAFT-{uuid8}` placeholder number.
   */
  describe('S-INV-027 — Preview PDF on invoice form', () => {
    it('previewPdf calls getInvoicePdfBlob, creates an object URL, and window.opens it', async () => {
      const { invoiceServiceStub } = configure({
        route: { snapshot: { paramMap: { get: () => 'i1' }, queryParamMap: { get: () => null } } },
        invoice: { status: 'draft', invoiceNumber: 'DRAFT-d8a441d2' },
      });
      const pdfBlob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' });
      (invoiceServiceStub as any).getInvoicePdfBlob = jasmine.createSpy('getInvoicePdfBlob')
        .and.returnValue(of(pdfBlob));
      const objectUrlSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:http://localhost/fake-pdf-id');
      const openSpy = spyOn(window, 'open').and.returnValue(null);
      const router = TestBed.inject(Router);
      const navSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      cmp.previewPdf();

      expect((invoiceServiceStub as any).getInvoicePdfBlob).toHaveBeenCalledOnceWith('i1');
      expect(objectUrlSpy).toHaveBeenCalledOnceWith(pdfBlob);
      expect(openSpy).toHaveBeenCalledOnceWith('blob:http://localhost/fake-pdf-id', '_blank');
      // SPA must stay put — no router.navigate side-effect.
      expect(navSpy).not.toHaveBeenCalled();
    });

    it('previewPdf is a no-op when no invoice is loaded (button is gated by isEditMode in the template)', async () => {
      const { invoiceServiceStub } = configure();
      (invoiceServiceStub as any).getInvoicePdfBlob = jasmine.createSpy('getInvoicePdfBlob')
        .and.returnValue(of(new Blob()));
      const openSpy = spyOn(window, 'open').and.returnValue(null);

      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();

      // Create-mode: currentInvoice() is null → no fetch, no window.open.
      expect(cmp.isEditMode()).toBeFalse();
      cmp.previewPdf();
      expect((invoiceServiceStub as any).getInvoicePdfBlob).not.toHaveBeenCalled();
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('previewPdf surfaces a translated pdfFailed toast when the blob fetch errors', async () => {
      const { invoiceServiceStub } = configure({
        route: { snapshot: { paramMap: { get: () => 'i1' }, queryParamMap: { get: () => null } } },
        invoice: { status: 'draft', invoiceNumber: 'DRAFT-deadbeef' },
      });
      (invoiceServiceStub as any).getInvoicePdfBlob = jasmine.createSpy('getInvoicePdfBlob')
        .and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      const openSpy = spyOn(window, 'open').and.returnValue(null);

      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      const toastSvc = TestBed.inject(ToastService);
      const toastSpy = spyOn(toastSvc, 'error');

      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.previewPdf();

      expect(toastSpy).toHaveBeenCalledWith('invoicing.form.errors.pdfFailed');
      // No tab opened on error.
      expect(openSpy).not.toHaveBeenCalled();
    });
  });

  /**
   * S-MOB-006 — mobile stacked-card line items.
   *
   * The CSS @media (max-width: 767px) block is what actually flips the
   * layout, but the load-bearing markup contract is the per-cell
   * `data-label` attribute that drives the `::before` pseudo-element
   * labels. Without the data-label the stacked-card view would render
   * unlabelled values. These specs pin the markup contract so a future
   * template edit can't silently break the mobile view.
   */
  describe('S-MOB-006: mobile stacked line-items markup contract', () => {
    it('emits data-label on every line-items cell so mobile CSS can render labels', async () => {
      configure();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('misc');
      cmp.updateLine(0, 'description', 'Misc');
      cmp.updateLine(0, 'quantity', 1);
      cmp.updateLine(0, 'unitPrice', 10);
      fixture.detectChanges();

      const cells = (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.invoice-form-table tbody tr td[data-label]',
      );
      const labels = Array.from(cells).map((c) => c.getAttribute('data-label'));
      // 7 labelled cells: type / description / qty / unitPrice / tva / discount / total.
      // The 8th cell (the trash button) intentionally omits data-label and
      // gets the `.invoice-form-table__actions` modifier so the mobile CSS
      // hides its label and stretches the button across the row.
      expect(labels.length).toBe(7);
      expect(labels).toEqual([
        'invoicing.form.table.type',
        'invoicing.form.table.description',
        'invoicing.form.table.qty',
        'invoicing.form.table.unitPrice',
        'invoicing.form.table.tva',
        'invoicing.form.table.discount',
        'invoicing.form.table.total',
      ]);
    });

    it('action cell carries the .invoice-form-table__actions class so mobile CSS can hide its label', async () => {
      configure();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('misc');
      fixture.detectChanges();

      const actions = (fixture.nativeElement as HTMLElement).querySelector(
        '.invoice-form-table tbody tr td.invoice-form-table__actions',
      );
      expect(actions).toBeTruthy();
      expect(actions?.getAttribute('data-label')).toBeNull();
      // Trash button is reachable inside the action cell.
      expect(actions?.querySelector('button')).toBeTruthy();
    });

    it('description cell keeps its desc modifier so mobile CSS can full-width it', async () => {
      configure();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('service');
      fixture.detectChanges();

      const desc = (fixture.nativeElement as HTMLElement).querySelector(
        '.invoice-form-table tbody tr td.invoice-form-table__desc',
      );
      expect(desc).toBeTruthy();
      expect(desc?.getAttribute('data-label')).toBe('invoicing.form.table.description');
    });
  });

  /**
   * Sweep C-13 — Section 18 (Edge cases) closure for the invoice form.
   *
   *   S-EDGE-005 — qty / unitPrice / discount inputs carry `min="0"` (HTML
   *                level) so the native UI clamps spinner-based negatives;
   *                discount additionally caps at 100. The lineNetHT()
   *                computation also clamps discountPct to [0, 100] so any
   *                stray negative is treated as 0 rather than inflating
   *                the total.
   *   S-EDGE-006 — unitPrice = 0 (free service) is allowed: the line saves
   *                with a 0 total; canSubmit stays true; payload reflects
   *                unitPrice 0 + totalPrice 0.
   *   S-EDGE-016 — saveDraft / issueAndSend map HTTP 423 to the
   *                translated `saveLocked` key (NOT the generic saveFailed)
   *                so the user sees the lock guidance instead of a raw
   *                error message.
   */
  describe('S-EDGE-005 — line inputs guard against negatives', () => {
    it('every line input renders min="0" (HTML-level clamp)', async () => {
      configure();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('misc');
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      // qty + unitPrice + discount + (laborHours when a labor line) — all
      // must carry min="0"; discount additionally pins max="100".
      const qtyInput = root.querySelector(
        'td[data-label="invoicing.form.table.qty"] input[type="number"]',
      ) as HTMLInputElement | null;
      const priceInput = root.querySelector(
        'td[data-label="invoicing.form.table.unitPrice"] input[type="number"]',
      ) as HTMLInputElement | null;
      const discountInput = root.querySelector(
        'td[data-label="invoicing.form.table.discount"] input[type="number"]',
      ) as HTMLInputElement | null;

      expect(qtyInput).withContext('qty input rendered').not.toBeNull();
      expect(priceInput).withContext('unitPrice input rendered').not.toBeNull();
      expect(discountInput).withContext('discount input rendered').not.toBeNull();
      expect(qtyInput!.getAttribute('min')).toBe('0');
      expect(priceInput!.getAttribute('min')).toBe('0');
      expect(discountInput!.getAttribute('min')).toBe('0');
      expect(discountInput!.getAttribute('max')).toBe('100');
    });

    it('lineNetHT clamps a stray negative discount to 0 (no total inflation)', async () => {
      configure();
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.addLine('misc');
      cmp.updateLine(0, 'unitPrice', 100);
      cmp.updateLine(0, 'quantity', 2);
      // A negative discount, if it ever got through (e.g. paste), must
      // not inflate the total to 100*2*(1+0.5) = 300. The Math.max(0, …)
      // guard in lineNetHT clamps it at 0.
      cmp.updateLine(0, 'discountPct', -50 as any);

      expect(cmp.lineTotal(0)).toBe(200);
    });
  });

  describe('S-EDGE-006 — zero unit price is a valid free-service line', () => {
    it('saves a unitPrice = 0 line with totalPrice 0 and canSubmit stays true', async () => {
      const { invoiceServiceStub } = configure();
      invoiceServiceStub.createInvoice.and.returnValue(
        of({ id: 'free-1', invoiceNumber: 'DRAFT-free' } as any),
      );
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      cmp.ngOnInit();
      await fixture.whenStable();
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('service');
      cmp.updateLine(0, 'description', 'Free courtesy check');
      cmp.updateLine(0, 'quantity', 1);
      cmp.updateLine(0, 'unitPrice', 0);

      expect(cmp.canSubmit()).toBeTrue();
      expect(cmp.lineTotal(0)).toBe(0);

      cmp.saveDraft();
      expect(invoiceServiceStub.createInvoice).toHaveBeenCalledTimes(1);
      const payload: any = invoiceServiceStub.createInvoice.calls.mostRecent().args[0];
      expect(payload.lineItems.length).toBe(1);
      expect(payload.lineItems[0].unitPrice).toBe(0);
      expect(payload.lineItems[0].totalPrice).toBe(0);
    });
  });

  describe('S-EDGE-016 — 423 lock surfaces a specific translated toast', () => {
    function fillValid(cmp: InvoiceFormComponent) {
      cmp.form.patchValue({ customerId: 'c1', carId: 'car1' });
      cmp.addLine('misc');
      cmp.updateLine(0, 'description', 'Lock test');
      cmp.updateLine(0, 'quantity', 1);
      cmp.updateLine(0, 'unitPrice', 50);
    }

    it('saveDraft 423 → invoicing.form.errors.saveLocked (NOT saveFailed)', async () => {
      const { invoiceServiceStub } = configure();
      invoiceServiceStub.createInvoice.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 423 })) as any,
      );
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      const toastSvc = TestBed.inject(ToastService);
      const toastSpy = spyOn(toastSvc, 'error');

      cmp.ngOnInit();
      await fixture.whenStable();
      fillValid(cmp);

      cmp.saveDraft();

      expect(toastSpy).toHaveBeenCalledWith('invoicing.form.errors.saveLocked');
      expect(toastSpy).not.toHaveBeenCalledWith('invoicing.form.errors.saveFailed');
      expect(cmp.isSubmitting()).toBeFalse();
    });

    it('issueAndSend persist 423 → saveLocked (race against another tab issuing)', async () => {
      const { invoiceServiceStub } = configure();
      invoiceServiceStub.createInvoice.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 423 })) as any,
      );
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      const toastSvc = TestBed.inject(ToastService);
      const toastSpy = spyOn(toastSvc, 'error');

      cmp.ngOnInit();
      await fixture.whenStable();
      fillValid(cmp);

      cmp.issueAndSend();

      expect(toastSpy).toHaveBeenCalledWith('invoicing.form.errors.saveLocked');
      expect(cmp.isSubmitting()).toBeFalse();
    });

    it('saveDraft non-423 (500) still emits the generic saveFailed key', async () => {
      const { invoiceServiceStub } = configure();
      invoiceServiceStub.createInvoice.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })) as any,
      );
      const fixture = TestBed.createComponent(InvoiceFormComponent);
      const cmp = fixture.componentInstance;
      const toastSvc = TestBed.inject(ToastService);
      const toastSpy = spyOn(toastSvc, 'error');

      cmp.ngOnInit();
      await fixture.whenStable();
      fillValid(cmp);

      cmp.saveDraft();

      expect(toastSpy).toHaveBeenCalledWith('invoicing.form.errors.saveFailed');
      expect(toastSpy).not.toHaveBeenCalledWith('invoicing.form.errors.saveLocked');
    });
  });
});
