import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CarService, CarWithHistory } from './car.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { SubscriptionStatus, SubscriptionTier } from '../../../core/models/subscription.model';

describe('CarService', () => {
  let service: CarService;
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

  const mockCar: Omit<CarWithHistory, 'id'> = {
    licensePlate: 'TEST-123',
    make: 'BMW',
    model: 'X5',
    year: 2020,
    customerId: 'customer1',
    currentMileage: 45000,
    totalServices: 0,
    serviceStatus: 'up-to-date'
  };

  beforeEach(() => {
    const spy = jasmine.createSpyObj('SubscriptionService', ['getCurrentSubscriptionStatus']);

    TestBed.configureTestingModule({
      providers: [
        CarService,
        { provide: SubscriptionService, useValue: spy }
      ]
    });

    service = TestBed.inject(CarService);
    mockSubscriptionService = TestBed.inject(SubscriptionService) as jasmine.SpyObj<SubscriptionService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Car Limit Validation', () => {
    it('should allow creating car when under Solo limit (50 cars)', (done) => {
      const mockStatus = createMockSubscriptionStatus(mockSoloTier, 30);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

      service.createCar(mockCar).subscribe({
        next: (car) => {
          expect(car).toBeDefined();
          expect(car.licensePlate).toBe('TEST-123');
          done();
        },
        error: () => {
          fail('Should not error when under limit');
          done();
        }
      });
    });

    it('should prevent creating car when at Solo limit (50 cars)', (done) => {
      const mockStatus = createMockSubscriptionStatus(mockSoloTier, 50);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

      service.createCar(mockCar).subscribe({
        next: () => {
          fail('Should not succeed when at limit');
          done();
        },
        error: (error) => {
          expect(error.error).toBe('CAR_LIMIT_EXCEEDED');
          expect(error.message).toContain('Vehicle limit of 50 reached');
          expect(error.tier).toBe('Solo');
          done();
        }
      });
    });

    it('should allow creating car when under Starter limit (200 cars)', (done) => {
      const mockStatus = createMockSubscriptionStatus(mockStarterTier, 150);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

      service.createCar(mockCar).subscribe({
        next: (car) => {
          expect(car).toBeDefined();
          expect(car.licensePlate).toBe('TEST-123');
          done();
        },
        error: () => {
          fail('Should not error when under limit');
          done();
        }
      });
    });

    it('should prevent creating car when at Starter limit (200 cars)', (done) => {
      const mockStatus = createMockSubscriptionStatus(mockStarterTier, 200);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

      service.createCar(mockCar).subscribe({
        next: () => {
          fail('Should not succeed when at limit');
          done();
        },
        error: (error) => {
          expect(error.error).toBe('CAR_LIMIT_EXCEEDED');
          expect(error.message).toContain('Vehicle limit of 200 reached');
          expect(error.tier).toBe('Starter');
          done();
        }
      });
    });

    it('should allow creating car with Professional tier (unlimited)', (done) => {
      const mockStatus = createMockSubscriptionStatus(mockProfessionalTier, 500);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

      service.createCar(mockCar).subscribe({
        next: (car) => {
          expect(car).toBeDefined();
          expect(car.licensePlate).toBe('TEST-123');
          done();
        },
        error: () => {
          fail('Should not error with unlimited tier');
          done();
        }
      });
    });
  });

  describe('canCreateCar', () => {
    it('should return true when under Solo limit', (done) => {
      const mockStatus = createMockSubscriptionStatus(mockSoloTier, 30);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

      service.canCreateCar().subscribe({
        next: (result) => {
          expect(result.canCreate).toBe(true);
          expect(result.reason).toBeUndefined();
          done();
        }
      });
    });

    it('should return false when at Solo limit', (done) => {
      const mockStatus = createMockSubscriptionStatus(mockSoloTier, 50);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

      service.canCreateCar().subscribe({
        next: (result) => {
          expect(result.canCreate).toBe(false);
          expect(result.reason).toContain('Vehicle limit of 50 reached');
          done();
        }
      });
    });

    it('should return true when under Starter limit', (done) => {
      const mockStatus = createMockSubscriptionStatus(mockStarterTier, 150);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

      service.canCreateCar().subscribe({
        next: (result) => {
          expect(result.canCreate).toBe(true);
          expect(result.reason).toBeUndefined();
          done();
        }
      });
    });

    it('should return false when at Starter limit', (done) => {
      const mockStatus = createMockSubscriptionStatus(mockStarterTier, 200);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

      service.canCreateCar().subscribe({
        next: (result) => {
          expect(result.canCreate).toBe(false);
          expect(result.reason).toContain('Vehicle limit of 200 reached');
          done();
        }
      });
    });

    it('should return true for Professional tier (unlimited)', (done) => {
      const mockStatus = createMockSubscriptionStatus(mockProfessionalTier, 1000);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

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
    it('should return observable of cars array', (done) => {
      service.getCars().subscribe({
        next: (cars) => {
          expect(Array.isArray(cars)).toBe(true);
          expect(cars.length).toBeGreaterThanOrEqual(0);
          done();
        }
      });
    });
  });

  describe('getCarById', () => {
    it('should return car when found', () => {
      const car = service.getCarById('car1');
      expect(car).toBeDefined();
      if (car) {
        expect(car.id).toBe('car1');
      }
    });

    it('should return undefined when car not found', () => {
      const car = service.getCarById('nonexistent-id');
      expect(car).toBeUndefined();
    });
  });

  describe('getAvailableMakes', () => {
    it('should return array of unique makes', () => {
      const makes = service.getAvailableMakes();
      expect(Array.isArray(makes)).toBe(true);
      expect(makes.length).toBeGreaterThan(0);
      
      // Check that all items are strings and unique
      const uniqueMakes = new Set(makes);
      expect(uniqueMakes.size).toBe(makes.length);
      makes.forEach(make => {
        expect(typeof make).toBe('string');
        expect(make.length).toBeGreaterThan(0);
      });
    });
  });
});