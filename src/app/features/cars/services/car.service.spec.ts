import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { CarService, CarWithHistory } from './car.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { SubscriptionStatus, SubscriptionTier } from '../../../core/models/subscription.model';

describe('CarService', () => {
  let service: CarService;
  let httpMock: HttpTestingController;
  let mockSubscriptionService: jasmine.SpyObj<SubscriptionService>;

  const mockSoloTier: SubscriptionTier = {
    id: 'solo',
    name: 'Solo',
    price: 500,
    currency: 'TND',
    features: [],
    limits: {
      users: 1,
      cars: 50,
      serviceBays: 2
    }
  };

  const mockStarterTier: SubscriptionTier = {
    id: 'starter',
    name: 'Starter',
    price: 2000,
    currency: 'TND',
    features: [],
    limits: {
      users: 3,
      cars: 200,
      serviceBays: 2
    }
  };

  const mockProfessionalTier: SubscriptionTier = {
    id: 'professional',
    name: 'Professional',
    price: 6000,
    currency: 'TND',
    features: [],
    limits: {
      users: null,
      cars: null,
      serviceBays: null
    }
  };

  const createMockSubscriptionStatus = (tier: SubscriptionTier, carCount: number): SubscriptionStatus => ({
    currentTier: tier,
    usage: {
      users: 1,
      cars: carCount,
      serviceBays: 1
    },
    renewalDate: new Date(),
    isActive: true,
    daysUntilRenewal: 30
  });

  const mockBackendCar = {
    id: 'car1',
    licensePlate: 'TEST-123',
    make: 'BMW',
    model: 'X5',
    year: 2020,
    customerId: 'customer1',
    mileage: 45000,
    totalServices: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  beforeEach(() => {
    const spy = jasmine.createSpyObj('SubscriptionService', ['getCurrentSubscriptionStatus']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CarService,
        { provide: SubscriptionService, useValue: spy }
      ]
    });

    service = TestBed.inject(CarService);
    httpMock = TestBed.inject(HttpTestingController);
    mockSubscriptionService = TestBed.inject(SubscriptionService) as jasmine.SpyObj<SubscriptionService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('canCreateCar', () => {
    it('should return true (always allowed with current implementation)', (done) => {
      service.canCreateCar().subscribe({
        next: (result) => {
          expect(result.canCreate).toBe(true);
          expect(result.reason).toBeUndefined();
          done();
        }
      });
    });
  });

  describe('getCurrentCarCount', () => {
    it('should return the current number of cars', () => {
      const count = service.getCurrentCarCount();
      expect(count).toBeGreaterThanOrEqual(0);
      expect(typeof count).toBe('number');
    });
  });

  describe('getCars', () => {
    it('should return observable of cars array via HTTP', (done) => {
      service.getCars().subscribe({
        next: (cars) => {
          expect(Array.isArray(cars)).toBe(true);
          expect(cars.length).toBe(1);
          expect(cars[0].id).toBe('car1');
          done();
        }
      });

      const req = httpMock.expectOne('/cars');
      expect(req.request.method).toBe('GET');
      req.flush([mockBackendCar]);
    });
  });

  describe('getCarById', () => {
    it('should return car when found in cache', (done) => {
      // First load cars to populate the BehaviorSubject
      service.getCars().subscribe(() => {
        const car = service.getCarById('car1');
        expect(car).toBeDefined();
        if (car) {
          expect(car.id).toBe('car1');
        }
        done();
      });

      const req = httpMock.expectOne('/cars');
      req.flush([mockBackendCar]);
    });

    it('should return undefined when car not found', () => {
      const car = service.getCarById('nonexistent-id');
      expect(car).toBeUndefined();
    });
  });

  describe('getAvailableMakes', () => {
    it('should return array of unique makes from cached data', (done) => {
      service.getCars().subscribe(() => {
        const makes = service.getAvailableMakes();
        expect(Array.isArray(makes)).toBe(true);
        expect(makes.length).toBe(1);
        expect(makes[0]).toBe('BMW');
        done();
      });

      const req = httpMock.expectOne('/cars');
      req.flush([mockBackendCar]);
    });
  });

  describe('createCar', () => {
    it('should create car via HTTP', (done) => {
      const newCar: Omit<CarWithHistory, 'id'> = {
        licensePlate: 'NEW-123',
        make: 'Honda',
        model: 'Civic',
        year: 2021,
        customerId: 'customer2',
        currentMileage: 10000,
        totalServices: 0,
        serviceStatus: 'up-to-date'
      };

      service.createCar(newCar).subscribe({
        next: (car) => {
          expect(car).toBeDefined();
          expect(car.licensePlate).toBe('NEW-123');
          done();
        }
      });

      const req = httpMock.expectOne('/cars');
      expect(req.request.method).toBe('POST');
      req.flush({ ...mockBackendCar, id: 'car2', licensePlate: 'NEW-123', make: 'Honda', model: 'Civic' });
    });
  });
});
