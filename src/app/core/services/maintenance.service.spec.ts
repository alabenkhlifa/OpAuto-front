import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { MaintenanceService } from './maintenance.service';

/**
 * BUG-098 — `mapFromBackend` must derive `customerId` from `b.car.customerId`
 * when the BE payload nests it (jobs always belong to a (customer, car) pair
 * via the car). Reading `b.customerId` alone returned undefined and silently
 * cleared the invoice-form's customer field on "Pull from job".
 */
describe('MaintenanceService — mapFromBackend', () => {
  let service: MaintenanceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MaintenanceService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MaintenanceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function backendJob(overrides: any = {}) {
    return {
      id: 'job-1',
      carId: 'car-1',
      title: 'Oil change',
      status: 'PENDING',
      priority: 'medium',
      estimatedCost: 0,
      createdAt: '2026-04-30T10:00:00.000Z',
      updatedAt: '2026-04-30T10:00:00.000Z',
      tasks: [],
      photos: [],
      approvals: [],
      ...overrides,
    };
  }

  it('reads customerId from b.car.customerId when the BE nests it (BUG-098)', () => {
    let received: any;
    service.getMaintenanceJob('job-1').subscribe((j) => (received = j));

    httpMock.expectOne('/maintenance/job-1').flush(
      backendJob({
        customerId: undefined,
        car: {
          id: 'car-1',
          customerId: 'customer-from-car',
          licensePlate: 'AB-123',
          make: 'Toyota',
          model: 'Yaris',
          year: 2020,
        },
      }),
    );

    expect(received.customerId).toBe('customer-from-car');
  });

  it('prefers b.car.customerId over a top-level b.customerId fallback', () => {
    let received: any;
    service.getMaintenanceJob('job-1').subscribe((j) => (received = j));

    httpMock.expectOne('/maintenance/job-1').flush(
      backendJob({
        customerId: 'top-level-customer',
        car: { id: 'car-1', customerId: 'customer-from-car' },
      }),
    );

    expect(received.customerId).toBe('customer-from-car');
  });

  it('reads customerId from b.car.customer.id when the BE embeds a customer object', () => {
    let received: any;
    service.getMaintenanceJob('job-1').subscribe((j) => (received = j));

    httpMock.expectOne('/maintenance/job-1').flush(
      backendJob({
        customerId: undefined,
        car: {
          id: 'car-1',
          customer: { id: 'customer-from-car-customer' },
        },
      }),
    );

    expect(received.customerId).toBe('customer-from-car-customer');
  });

  it('falls back to top-level b.customerId when the car is not embedded', () => {
    let received: any;
    service.getMaintenanceJob('job-1').subscribe((j) => (received = j));

    httpMock.expectOne('/maintenance/job-1').flush(
      backendJob({ customerId: 'top-level-customer', car: undefined }),
    );

    expect(received.customerId).toBe('top-level-customer');
  });

  it('maps job parts and timeline from /maintenance/:id response', () => {
    let received: any;
    service.getMaintenanceJob('job-1').subscribe((job) => (received = job));

    httpMock.expectOne('/maintenance/job-1').flush(
      backendJob({
        parts: [
          { id: 'part-1', name: 'Brake pad', partNumber: 'BP-001', quantity: 2, unitPrice: 15, supplier: 'AutoParts' },
          { id: 'part-2', name: 'Disc', partNumber: 'DS-002', quantity: 1, unitPrice: 55, totalPrice: 55 },
        ],
        timelineEvents: [
          { id: 'event-1', type: 'job-created', label: 'Created', occurredAt: '2026-06-01T10:00:00Z' },
          { id: 'event-2', type: 'approval', message: 'Owner sent request', occurredAt: '2026-06-01T11:00:00Z' },
        ],
      }),
    );

    expect(received.parts?.length).toBe(2);
    expect(received.parts[0].name).toBe('Brake pad');
    expect(received.parts[1].totalPrice).toBe(55);
    expect(received.timelineEvents[0].type).toBe('job-created');
    expect(received.timelineEvents[1].description).toBe('Owner sent request');
  });

  it('posts part creation to /maintenance/:id/parts', () => {
    let created: any;
    service.addJobPart('job-1', {
      name: 'Brake pad',
      quantity: 2,
      unitPrice: 15,
      partNumber: 'BP-001',
      supplier: 'AutoParts',
      notes: '',
    }).subscribe((part) => (created = part));

    const req = httpMock.expectOne('/maintenance/job-1/parts');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(
      jasmine.objectContaining({
        name: 'Brake pad',
        quantity: 2,
        unitPrice: 15,
        partNumber: 'BP-001',
        supplier: 'AutoParts',
      }),
    );

    req.flush({ id: 'part-1', name: 'Brake pad', quantity: 2, unitPrice: 15 });

    expect(created.id).toBe('part-1');
    expect(created.name).toBe('Brake pad');
  });

  it('posts part updates to /maintenance/:id/parts/:partId', () => {
    let updated: any;
    service.updateJobPart('job-1', 'part-1', {
      name: 'Brake pad',
      quantity: 3,
      unitPrice: 16,
      partNumber: 'BP-001',
      supplier: 'AutoParts',
      notes: 'Adjusted',
    }).subscribe((part) => (updated = part));

    const req = httpMock.expectOne('/maintenance/job-1/parts/part-1');
    expect(req.request.method).toBe('PUT');
    req.flush({ id: 'part-1', name: 'Brake pad', quantity: 3, unitPrice: 16, notes: 'Adjusted' });

    expect(updated.quantity).toBe(3);
    expect(updated.unitPrice).toBe(16);
    expect(updated.notes).toBe('Adjusted');
  });

  it('posts owner response to public approval token endpoint', () => {
    let summary: any;
    service.respondToPublicApproval('public-token', {
      decision: 'approved',
      channel: 'email',
    }).subscribe((nextSummary) => (summary = nextSummary));

    const req = httpMock.expectOne('/public/job-approvals/public-token/response');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ decision: 'approved', channel: 'email' });

    req.flush({
      token: 'public-token',
      jobId: 'job-1',
      request: {
        id: 'approval-1',
        status: 'approved',
        description: 'Replace brake pad',
      },
      status: 'approved',
    });

    expect(summary.status).toBe('approved');
    expect(summary.request.status).toBe('approved');
  });

  it('loads public approval summary from /public/job-approvals/:token', () => {
    let summary: any;
    service.getPublicApprovalSummary('public-token').subscribe((nextSummary) => (summary = nextSummary));

    const req = httpMock.expectOne('/public/job-approvals/public-token');
    expect(req.request.method).toBe('GET');
    req.flush({
      token: 'public-token',
      jobId: 'job-1',
      request: { id: 'approval-1', status: 'pending', description: 'Replace brake pad' },
    });

    expect(summary.token).toBe('public-token');
    expect(summary.request.status).toBe('pending');
    expect(summary.status).toBe('pending');
  });
});
