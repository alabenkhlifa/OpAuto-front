import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { InvoiceService } from './invoice.service';
import {
  CreateInvoiceRequest,
  InvoiceLineItem,
  UpdateInvoiceRequest,
} from '../models/invoice.model';

/**
 * Regression tests for the FE↔BE contract used when saving DRAFT invoices.
 *
 * Locks in:
 *   - `mapToBackend` strips fields the BE rejects under
 *     `whitelist + forbidNonWhitelisted` (status, currency, taxRate, etc.).
 *   - Per-line `tvaRate`/`partId`/`serviceCode`/`mechanicId`/`laborHours`
 *     flow through; FE-only fields (`unit`, `totalPrice`, `taxable`) do not.
 *   - `discountPercentage` on the FE is renamed to `discountPct` on the wire.
 *   - `updateInvoice` includes `status` (mapped via `toBackendEnum`).
 *   - `mapFromBackend` accepts the BE shape (`total`, `tvaRate`, `discountPct`).
 */
describe('InvoiceService', () => {
  let service: InvoiceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InvoiceService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(InvoiceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── Helpers ─────────────────────────────────────────────────────

  function makeFeLineItem(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
    return {
      id: 'li-1',
      type: 'service',
      description: 'Oil change',
      quantity: 1,
      unit: 'service',
      unitPrice: 100,
      totalPrice: 100,
      taxable: true,
      tvaRate: 19,
      ...overrides,
    } as InvoiceLineItem;
  }

  function makeBackendInvoiceShape(overrides: any = {}) {
    return {
      id: 'inv-1',
      invoiceNumber: 'DRAFT-abc12345',
      customerId: 'c1',
      carId: 'car1',
      status: 'DRAFT',
      currency: 'TND',
      subtotal: 100,
      taxAmount: 19,
      discount: 0,
      total: 119,
      dueDate: '2026-05-30T00:00:00.000Z',
      notes: null,
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
      lineItems: [],
      payments: [],
      ...overrides,
    };
  }

  // ── createInvoice — top-level payload shape ─────────────────────

  describe('createInvoice — payload shape', () => {
    it('POSTs only whitelisted top-level fields (customerId, carId, dueDate, notes, lineItems)', () => {
      const request: CreateInvoiceRequest = {
        customerId: 'c1',
        carId: 'car1',
        appointmentId: 'appt-1',          // must NOT be sent
        issueDate: new Date('2026-04-30'), // must NOT be sent
        dueDate: new Date('2026-05-30'),
        status: 'draft',                   // must NOT be sent (create path)
        currency: 'TND',                   // must NOT be sent
        taxRate: 19,                       // must NOT be sent
        discountPercentage: 0,             // must NOT be sent
        paidAmount: 0,                     // must NOT be sent
        paymentTerms: 'Net 30',            // must NOT be sent
        createdBy: 'user-1',               // must NOT be sent
        paymentMethod: 'cash',             // must NOT be sent
        lineItems: [makeFeLineItem()],
        notes: 'hello',
      } as any;

      service.createInvoice(request).subscribe();

      const req = httpMock.expectOne('/invoices');
      expect(req.request.method).toBe('POST');

      const body = req.request.body;
      const allowed = ['customerId', 'carId', 'dueDate', 'notes', 'lineItems'];
      const forbidden = [
        'status',
        'issueDate',
        'currency',
        'taxRate',
        'discountPercentage',
        'paidAmount',
        'paymentTerms',
        'createdBy',
        'paymentMethod',
        'appointmentId',
      ];

      for (const f of forbidden) {
        expect(body[f]).toBeUndefined();
      }
      for (const k of Object.keys(body)) {
        // discount + discountReason + discountApprovedBy are also allowed but optional
        expect(['discount', 'discountReason', 'discountApprovedBy', ...allowed]).toContain(k);
      }
      expect(body.customerId).toBe('c1');
      expect(body.carId).toBe('car1');
      expect(body.notes).toBe('hello');
      // dueDate is serialized to ISO string
      expect(typeof body.dueDate).toBe('string');
      expect(body.dueDate).toMatch(/2026-05-30T/);

      req.flush(makeBackendInvoiceShape());
    });

    it('passes optional discount fields through when set', () => {
      const request = {
        customerId: 'c1',
        carId: 'car1',
        dueDate: new Date('2026-05-30'),
        discount: 25,
        discountReason: 'Loyalty',
        discountApprovedBy: 'owner-1',
        lineItems: [makeFeLineItem()],
      } as any;

      service.createInvoice(request).subscribe();

      const req = httpMock.expectOne('/invoices');
      expect(req.request.body.discount).toBe(25);
      expect(req.request.body.discountReason).toBe('Loyalty');
      expect(req.request.body.discountApprovedBy).toBe('owner-1');

      req.flush(makeBackendInvoiceShape());
    });
  });

  // ── createInvoice — per-line payload shape ──────────────────────

  describe('createInvoice — line item shape', () => {
    it('lineItems[0] contains only the fields the BE DTO declares', () => {
      const request = {
        customerId: 'c1',
        carId: 'car1',
        dueDate: new Date('2026-05-30'),
        lineItems: [
          makeFeLineItem({
            type: 'part',
            description: 'Brake pads',
            quantity: 2,
            unit: 'each',                  // FE-only — must be stripped
            unitPrice: 50,
            totalPrice: 119,               // FE-only — must be stripped
            taxable: true,                 // FE-only — must be stripped
            tvaRate: 19,
            partId: 'part-001',
            serviceCode: 'BRAKE_SERVICE',
            mechanicId: 'mech-001',
            laborHours: 1.5,
            discountPercentage: 10,        // FE field — must be renamed to discountPct
          }),
        ],
      } as any;

      service.createInvoice(request).subscribe();

      const req = httpMock.expectOne('/invoices');
      const line = req.request.body.lineItems[0];

      const allowed = [
        'description',
        'quantity',
        'unitPrice',
        'type',
        'tvaRate',
        'partId',
        'serviceCode',
        'mechanicId',
        'laborHours',
        'discountPct',
      ];
      for (const k of Object.keys(line)) {
        expect(allowed).toContain(k);
      }

      // FE-only fields must NOT survive the mapper
      expect(line.unit).toBeUndefined();
      expect(line.totalPrice).toBeUndefined();
      expect(line.taxable).toBeUndefined();
      expect(line.discountPercentage).toBeUndefined();

      // Required + new BE fields are present with the right values
      expect(line.description).toBe('Brake pads');
      expect(line.quantity).toBe(2);
      expect(line.unitPrice).toBe(50);
      expect(line.type).toBe('part');
      expect(line.tvaRate).toBe(19);
      expect(line.partId).toBe('part-001');
      expect(line.serviceCode).toBe('BRAKE_SERVICE');
      expect(line.mechanicId).toBe('mech-001');
      expect(line.laborHours).toBe(1.5);
      expect(line.discountPct).toBe(10);

      req.flush(makeBackendInvoiceShape());
    });

    it('omits optional line fields entirely when undefined (no `null` leaks)', () => {
      const minimalLine: InvoiceLineItem = {
        id: 'li-1',
        type: 'service',
        description: 'Diagnostic',
        quantity: 1,
        unit: 'service',
        unitPrice: 80,
        totalPrice: 80,
        taxable: true,
      } as InvoiceLineItem;

      service.createInvoice({
        customerId: 'c1',
        carId: 'car1',
        dueDate: new Date('2026-05-30'),
        lineItems: [minimalLine],
      } as any).subscribe();

      const req = httpMock.expectOne('/invoices');
      const line = req.request.body.lineItems[0];

      // Required trio always present.
      expect(line).toEqual(
        jasmine.objectContaining({ description: 'Diagnostic', quantity: 1, unitPrice: 80 }),
      );
      // No optional keys leak through as undefined or null.
      expect('tvaRate' in line).toBeFalse();
      expect('partId' in line).toBeFalse();
      expect('mechanicId' in line).toBeFalse();
      expect('laborHours' in line).toBeFalse();
      expect('discountPct' in line).toBeFalse();

      req.flush(makeBackendInvoiceShape());
    });
  });

  // ── updateInvoice — status flows through ────────────────────────

  describe('updateInvoice — status mapping', () => {
    it('PUT body INCLUDES status (mapped via toBackendEnum) when set on input', () => {
      // Seed cache so the tap() handler doesn't throw.
      (service as any).invoicesSubject.next([
        { id: 'inv-1', status: 'draft' } as any,
      ]);

      const updates: UpdateInvoiceRequest = {
        status: 'cancelled' as any,
        notes: 'Customer cancelled',
      };

      service.updateInvoice('inv-1', updates).subscribe();

      const req = httpMock.expectOne('/invoices/inv-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.status).toBe('CANCELLED'); // toBackendEnum upper + underscore
      expect(req.request.body.notes).toBe('Customer cancelled');

      req.flush(makeBackendInvoiceShape({ id: 'inv-1', status: 'CANCELLED' }));
    });

    it('PUT body OMITS status when not provided', () => {
      (service as any).invoicesSubject.next([
        { id: 'inv-1', status: 'draft' } as any,
      ]);

      service.updateInvoice('inv-1', { notes: 'just a note' } as any).subscribe();

      const req = httpMock.expectOne('/invoices/inv-1');
      expect('status' in req.request.body).toBeFalse();
      expect(req.request.body.notes).toBe('just a note');

      req.flush(makeBackendInvoiceShape({ id: 'inv-1' }));
    });
  });

  // ── mapFromBackend round-trip ───────────────────────────────────

  describe('mapFromBackend — round-trip with backend field names', () => {
    it('translates total / tvaRate / discountPct → totalPrice / tvaRate / discountPercentage', () => {
      let received: any;
      service.fetchInvoiceById('inv-1').subscribe((inv) => (received = inv));

      const req = httpMock.expectOne('/invoices/inv-1');
      req.flush(
        makeBackendInvoiceShape({
          lineItems: [
            {
              id: 'li-1',
              type: 'part',
              description: 'Brake pads',
              quantity: 2,
              unitPrice: 50,
              total: 119,        // BE name — must populate FE totalPrice
              tvaRate: 19,       // BE name — must populate FE tvaRate
              discountPct: 10,   // BE name — must populate FE discountPercentage
              partId: 'part-001',
              serviceCode: 'BRAKE',
              mechanicId: 'mech-1',
              laborHours: 1.5,
            },
          ],
        }),
      );

      expect(received).toBeDefined();
      const li = received.lineItems[0];
      expect(li.totalPrice).toBe(119);
      expect(li.tvaRate).toBe(19);
      expect(li.discountPercentage).toBe(10);
      expect(li.partId).toBe('part-001');
      expect(li.serviceCode).toBe('BRAKE');
      expect(li.mechanicId).toBe('mech-1');
      expect(li.laborHours).toBe(1.5);
      // taxable derives from tvaRate > 0
      expect(li.taxable).toBeTrue();
    });

    it('exposes maintenanceJobId and quoteId from the backend payload (BUG-099)', () => {
      let received: any;
      service.fetchInvoiceById('inv-1').subscribe((inv) => (received = inv));

      const req = httpMock.expectOne('/invoices/inv-1');
      req.flush(
        makeBackendInvoiceShape({
          maintenanceJobId: 'job-123',
          quoteId: 'quote-456',
        }),
      );

      expect(received.maintenanceJobId).toBe('job-123');
      expect(received.quoteId).toBe('quote-456');
    });

    it('leaves maintenanceJobId / quoteId undefined when the backend omits them', () => {
      let received: any;
      service.fetchInvoiceById('inv-1').subscribe((inv) => (received = inv));

      const req = httpMock.expectOne('/invoices/inv-1');
      req.flush(makeBackendInvoiceShape());

      expect(received.maintenanceJobId).toBeUndefined();
      expect(received.quoteId).toBeUndefined();
    });

    // ── BUG-106 — Sweep C-10 (S-I18N-001/002) ───────────────────────
    // BE persists `InvoiceLineItem.type` as a free-form string (`labor | part | service`
    // per the schema comment). Legacy rows can land uppercase (`SERVICE`).
    // The detail HTML binds `('invoicing.form.lineTypes.' + li.type) | translate`
    // and only ships keys for the lowercase variants — uppercase types miss the
    // dictionary and surface as the raw key in the FR/AR walks.
    // mapFromBackend now lower-cases `li.type` so the i18n binding always hits.
    it('lowercases line item type to match the FE LineItemType enum (BUG-106)', () => {
      let received: any;
      service.fetchInvoiceById('inv-1').subscribe((inv) => (received = inv));

      const req = httpMock.expectOne('/invoices/inv-1');
      req.flush(
        makeBackendInvoiceShape({
          lineItems: [
            { id: 'li-1', type: 'SERVICE', description: 'A', quantity: 1, unitPrice: 10, total: 10 },
            { id: 'li-2', type: 'Part',    description: 'B', quantity: 1, unitPrice: 10, total: 10 },
            { id: 'li-3', type: 'labor',   description: 'C', quantity: 1, unitPrice: 10, total: 10 },
            { id: 'li-4',                  description: 'D', quantity: 1, unitPrice: 10, total: 10 }, // missing type
          ],
        }),
      );

      expect(received.lineItems[0].type).toBe('service');
      expect(received.lineItems[1].type).toBe('part');
      expect(received.lineItems[2].type).toBe('labor');
      expect(received.lineItems[3].type).toBe('misc');
    });

    it('falls back to legacy totalPrice when backend response uses the old field name', () => {
      let received: any;
      service.fetchInvoiceById('inv-1').subscribe((inv) => (received = inv));

      const req = httpMock.expectOne('/invoices/inv-1');
      req.flush(
        makeBackendInvoiceShape({
          lineItems: [
            {
              id: 'li-1',
              description: 'Legacy',
              quantity: 1,
              unitPrice: 80,
              totalPrice: 95.2, // legacy field name
            },
          ],
        }),
      );

      expect(received.lineItems[0].totalPrice).toBe(95.2);
    });
  });

  /**
   * S-EDGE-017 — addPayment must NOT throw a RangeError when the caller
   * passes an Invalid Date (e.g. `new Date('')` from a blank input).
   * Pre-fix the body construction did
   *
   *   payment.paymentDate instanceof Date ? payment.paymentDate.toISOString() : ...
   *
   * which failed because `new Date('')` IS a Date instance — but its
   * `.toISOString()` throws. The fix `isNaN(.getTime())` falls back to
   * the current timestamp so the request still posts.
   */
  describe('S-EDGE-017 — addPayment defensive date handling', () => {
    it('falls back to "now" when paymentDate is an Invalid Date instance', () => {
      let posted: any;
      service
        .addPayment({
          invoiceId: 'inv-1',
          amount: 50,
          method: 'cash',
          // new Date('') is a Date object whose getTime() is NaN.
          paymentDate: new Date('') as any,
          processedBy: 'u1',
        })
        .subscribe();

      const req = httpMock.expectOne('/invoices/inv-1/payments');
      posted = req.request.body;
      // No RangeError was thrown above — assertion implicit. Body
      // contains a valid ISO string (8601 ends with `Z`).
      expect(typeof posted.paymentDate).toBe('string');
      expect(posted.paymentDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // Must not be the empty string (i.e. fallback fired).
      expect(posted.paymentDate.length).toBeGreaterThan(10);

      req.flush({
        id: 'pay-1',
        invoiceId: 'inv-1',
        amount: 50,
        method: 'CASH',
        paymentDate: posted.paymentDate,
        createdAt: '2026-05-02T10:00:00Z',
      });
      // The success branch fires `refreshInvoice` which GETs the invoice;
      // flush a stub so the request doesn't leak into afterEach verify().
      const refresh = httpMock.expectOne('/invoices/inv-1');
      refresh.flush(makeBackendInvoiceShape());
    });

    it('passes a valid Date through as ISO string (happy path)', () => {
      const dt = new Date('2026-04-15T12:30:00Z');
      service
        .addPayment({
          invoiceId: 'inv-1',
          amount: 80,
          method: 'card',
          paymentDate: dt,
          processedBy: 'u1',
        })
        .subscribe();

      const req = httpMock.expectOne('/invoices/inv-1/payments');
      expect(req.request.body.paymentDate).toBe(dt.toISOString());
      req.flush({
        id: 'pay-2',
        invoiceId: 'inv-1',
        amount: 80,
        method: 'CARD',
        paymentDate: dt.toISOString(),
        createdAt: '2026-05-02T10:00:00Z',
      });
      // Flush the refresh GET that addPayment triggers via tap().
      const refresh = httpMock.expectOne('/invoices/inv-1');
      refresh.flush(makeBackendInvoiceShape());
    });
  });
});
