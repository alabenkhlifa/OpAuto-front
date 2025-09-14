import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { CarsComponent } from './cars.component';
import { CarService, CarWithHistory } from './services/car.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { SubscriptionStatus, SubscriptionTier } from '../../core/models/subscription.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

describe('CarsComponent', () => {
  let component: CarsComponent;
  let fixture: ComponentFixture<CarsComponent>;
  let mockCarService: jasmine.SpyObj<CarService>;
  let mockSubscriptionService: jasmine.SpyObj<SubscriptionService>;
  let mockRouter: jasmine.SpyObj<Router>;

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

  const mockCars: CarWithHistory[] = [
    {
      id: 'car1',
      licensePlate: '123 TUN 2024',
      make: 'BMW',
      model: 'X5',
      year: 2020,
      customerId: 'customer1',
      currentMileage: 45000,
      totalServices: 8,
      serviceStatus: 'up-to-date'
    },
    {
      id: 'car2',
      licensePlate: '456 TUN 2019',
      make: 'Honda',
      model: 'Civic',
      year: 2019,
      customerId: 'customer2',
      currentMileage: 78000,
      totalServices: 12,
      serviceStatus: 'due-soon'
    }
  ];

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

  beforeEach(async () => {
    const carServiceSpy = jasmine.createSpyObj('CarService', [
      'getCars',
      'getCustomerById',
      'getAvailableMakes'
    ]);
    const subscriptionServiceSpy = jasmine.createSpyObj('SubscriptionService', [
      'getCurrentSubscriptionStatus'
    ]);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [CarsComponent],
      providers: [
        { provide: CarService, useValue: carServiceSpy },
        { provide: SubscriptionService, useValue: subscriptionServiceSpy },
        { provide: Router, useValue: routerSpy },
        TranslatePipe
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CarsComponent);
    component = fixture.componentInstance;
    mockCarService = TestBed.inject(CarService) as jasmine.SpyObj<CarService>;
    mockSubscriptionService = TestBed.inject(SubscriptionService) as jasmine.SpyObj<SubscriptionService>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    // Setup default mock returns
    mockCarService.getCars.and.returnValue(of(mockCars));
    mockCarService.getAvailableMakes.and.returnValue(['BMW', 'Honda']);
    mockCarService.getCustomerById.and.returnValue({ id: 'customer1', name: 'Test Customer', phone: '+216-20-123-456', email: 'test@example.com' });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Car Limit Functionality', () => {
    it('should display current car count and limit for Solo tier', () => {
      const mockStatus = createMockSubscriptionStatus(mockSoloTier, 47);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));
      mockCarService.getCars.and.returnValue(of(mockCars.slice(0, 2))); // 2 cars

      component.ngOnInit();
      fixture.detectChanges();

      expect(component.currentCarCount()).toBe(2);
      expect(component.carLimit()).toBe(50);
      expect(component.carLimitDisplay()).toBe('2/50');
      expect(component.currentTier()).toBe('Solo');
    });

    it('should show near limit warning when at 90% capacity', () => {
      const mockStatus = createMockSubscriptionStatus(mockSoloTier, 45);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));
      
      // Create 45 cars to simulate near limit
      const nearLimitCars = Array(45).fill(null).map((_, i) => ({
        ...mockCars[0],
        id: `car${i + 1}`,
        licensePlate: `${i + 1} TUN 2024`
      }));
      mockCarService.getCars.and.returnValue(of(nearLimitCars));

      component.ngOnInit();
      fixture.detectChanges();

      expect(component.isNearLimit()).toBe(true);
      expect(component.isAtCarLimit()).toBe(false);
      expect(component.remainingCars()).toBe(5);
    });

    it('should disable Add Car button when at limit', () => {
      const mockStatus = createMockSubscriptionStatus(mockSoloTier, 50);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));
      
      // Create 50 cars to simulate limit reached
      const limitCars = Array(50).fill(null).map((_, i) => ({
        ...mockCars[0],
        id: `car${i + 1}`,
        licensePlate: `${i + 1} TUN 2024`
      }));
      mockCarService.getCars.and.returnValue(of(limitCars));

      component.ngOnInit();
      fixture.detectChanges();

      expect(component.isAtCarLimit()).toBe(true);
      expect(component.isNearLimit()).toBe(true);
    });

    it('should show unlimited for Professional tier', () => {
      const mockStatus = createMockSubscriptionStatus(mockProfessionalTier, 1000);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));
      
      const manyCars = Array(100).fill(null).map((_, i) => ({
        ...mockCars[0],
        id: `car${i + 1}`,
        licensePlate: `${i + 1} TUN 2024`
      }));
      mockCarService.getCars.and.returnValue(of(manyCars));

      component.ngOnInit();
      fixture.detectChanges();

      expect(component.currentCarCount()).toBe(100);
      expect(component.carLimit()).toBeNull();
      expect(component.carLimitDisplay()).toBe('100/∞');
      expect(component.currentTier()).toBe('Professional');
      expect(component.isAtCarLimit()).toBe(false);
      expect(component.isNearLimit()).toBe(false);
    });
  });

  describe('openRegistrationForm', () => {
    it('should show upgrade prompt when at car limit', () => {
      const mockStatus = createMockSubscriptionStatus(mockSoloTier, 50);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));
      
      const limitCars = Array(50).fill(null).map((_, i) => ({
        ...mockCars[0],
        id: `car${i + 1}`
      }));
      mockCarService.getCars.and.returnValue(of(limitCars));

      component.ngOnInit();
      component.openRegistrationForm();

      expect(component.showUpgradePrompt()).toBe(true);
      expect(component.showRegistrationForm()).toBe(false);
    });

    it('should open registration form when under limit', () => {
      const mockStatus = createMockSubscriptionStatus(mockSoloTier, 30);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));
      mockCarService.getCars.and.returnValue(of(mockCars));

      component.ngOnInit();
      component.openRegistrationForm();

      expect(component.showRegistrationForm()).toBe(true);
      expect(component.showUpgradePrompt()).toBe(false);
    });
  });

  describe('getUpgradeMessage', () => {
    it('should return correct message for Solo tier', () => {
      const mockStatus = createMockSubscriptionStatus(mockSoloTier, 50);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));
      mockCarService.getCars.and.returnValue(of(Array(50).fill(mockCars[0])));

      component.ngOnInit();
      
      const message = component.getUpgradeMessage();
      expect(message).toContain('Solo plan allows up to 50 vehicles');
      expect(message).toContain('Upgrade to Starter');
    });

    it('should return correct message for Starter tier', () => {
      const mockStatus = createMockSubscriptionStatus(mockStarterTier, 200);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));
      mockCarService.getCars.and.returnValue(of(Array(200).fill(mockCars[0])));

      component.ngOnInit();
      
      const message = component.getUpgradeMessage();
      expect(message).toContain('Starter plan allows up to 200 vehicles');
      expect(message).toContain('Upgrade to Professional for unlimited');
    });
  });

  describe('getNextTier', () => {
    it('should return starter for solo tier', () => {
      const mockStatus = createMockSubscriptionStatus(mockSoloTier, 30);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

      component.ngOnInit();
      
      expect(component.getNextTier()).toBe('starter');
    });

    it('should return professional for starter tier', () => {
      const mockStatus = createMockSubscriptionStatus(mockStarterTier, 100);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

      component.ngOnInit();
      
      expect(component.getNextTier()).toBe('professional');
    });

    it('should return null for professional tier', () => {
      const mockStatus = createMockSubscriptionStatus(mockProfessionalTier, 500);
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));

      component.ngOnInit();
      
      expect(component.getNextTier()).toBeNull();
    });
  });

  describe('onUpgradeRequested', () => {
    it('should navigate to subscription page and close upgrade prompt', () => {
      component.showUpgradePrompt.set(true);
      
      component.onUpgradeRequested();
      
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/subscription']);
      expect(component.showUpgradePrompt()).toBe(false);
    });
  });

  describe('statusCounts', () => {
    it('should calculate status counts correctly', () => {
      mockCarService.getCars.and.returnValue(of(mockCars));

      component.ngOnInit();
      
      const counts = component.statusCounts();
      expect(counts.total).toBe(2);
      expect(counts.upToDate).toBe(1);
      expect(counts.dueSoon).toBe(1);
      expect(counts.overdue).toBe(0);
    });
  });
});