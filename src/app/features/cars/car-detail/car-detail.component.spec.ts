import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { CarDetailComponent } from './car-detail.component';
import { CarService, CarWithHistory } from '../services/car.service';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { CustomerService } from '../../../core/services/customer.service';
import { TranslationService } from '../../../core/services/translation.service';
import { LanguageService } from '../../../core/services/language.service';
import { AiService } from '../../../core/services/ai.service';

const mkCar = (over: Partial<CarWithHistory> = {}): CarWithHistory => ({
  id: over.id ?? 'car-1',
  licensePlate: over.licensePlate ?? '123-TUN-1',
  make: over.make ?? 'Peugeot',
  model: over.model ?? '308',
  year: over.year ?? 2019,
  customerId: over.customerId ?? 'cust-1',
  currentMileage: over.currentMileage ?? 45000,
  serviceStatus: over.serviceStatus ?? 'up-to-date',
  totalServices: over.totalServices ?? 3,
  lastServiceDate: over.lastServiceDate,
  nextServiceDue: over.nextServiceDue,
});

describe('CarDetailComponent', () => {
  let fixture: ComponentFixture<CarDetailComponent>;
  let component: CarDetailComponent;
  let carService: jasmine.SpyObj<CarService>;
  let maintenanceService: jasmine.SpyObj<MaintenanceService>;
  let customerService: jasmine.SpyObj<CustomerService>;
  let router: jasmine.SpyObj<Router>;

  const setup = (routeId: string | null, cars: CarWithHistory[]) => {
    carService.getCars.and.returnValue(of(cars));
    maintenanceService.getMaintenanceJobs.and.returnValue(of([]));
    customerService.getCustomers.and.returnValue(of([
      { id: 'cust-1', firstName: 'Ali', lastName: 'Ben', phone: '+216', email: '', visits: 0 } as any,
    ]));

    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: {
          paramMap: convertToParamMap(routeId !== null ? { id: routeId } : {}),
        },
      },
    });

    fixture = TestBed.createComponent(CarDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    carService = jasmine.createSpyObj('CarService', ['getCars']);
    maintenanceService = jasmine.createSpyObj('MaintenanceService', ['getMaintenanceJobs']);
    customerService = jasmine.createSpyObj('CustomerService', ['getCustomers']);
    router = jasmine.createSpyObj('Router', ['navigate']);

    const aiService = jasmine.createSpyObj('AiService', ['predictMaintenance']);
    aiService.predictMaintenance.and.returnValue(of({ predictions: [], provider: 'template' }));
    const languageService = jasmine.createSpyObj('LanguageService', ['getCurrentLanguage']);
    languageService.getCurrentLanguage.and.returnValue('en');
    const translationService = jasmine.createSpyObj('TranslationService', ['instant']);
    translationService.instant.and.callFake((k: string) => k);
    (translationService as any).translations$ = of({});

    await TestBed.configureTestingModule({
      imports: [CarDetailComponent],
      providers: [
        { provide: CarService, useValue: carService },
        { provide: MaintenanceService, useValue: maintenanceService },
        { provide: CustomerService, useValue: customerService },
        { provide: Router, useValue: router },
        { provide: AiService, useValue: aiService },
        { provide: LanguageService, useValue: languageService },
        { provide: TranslationService, useValue: translationService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();
  });

  it('loads the car matching the route :id', () => {
    setup('car-1', [mkCar({ id: 'car-1' })]);
    expect(component.car()?.id).toBe('car-1');
    expect(component.notFound()).toBe(false);
    expect(component.isLoading()).toBe(false);
  });

  it('sets notFound when the car is not in the response', () => {
    setup('car-missing', [mkCar({ id: 'car-1' })]);
    expect(component.car()).toBeNull();
    expect(component.notFound()).toBe(true);
  });

  it('sets notFound when no :id is on the route', () => {
    setup(null, [mkCar({ id: 'car-1' })]);
    expect(component.notFound()).toBe(true);
  });

  it('resolves the owner name from the customer list', () => {
    setup('car-1', [mkCar({ id: 'car-1', customerId: 'cust-1' })]);
    expect(component.customerName()).toBe('Ali Ben');
  });

  it('navigates back to /cars on back()', () => {
    setup('car-1', [mkCar({ id: 'car-1' })]);
    component.back();
    expect(router.navigate).toHaveBeenCalledWith(['/cars']);
  });
});
