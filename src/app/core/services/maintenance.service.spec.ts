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

  it('falls back to top-level b.customerId when the car is not embedded', () => {
    let received: any;
    service.getMaintenanceJob('job-1').subscribe((j) => (received = j));

    httpMock.expectOne('/maintenance/job-1').flush(
      backendJob({ customerId: 'top-level-customer', car: undefined }),
    );

    expect(received.customerId).toBe('top-level-customer');
  });
});
