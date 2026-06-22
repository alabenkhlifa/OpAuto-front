import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { CarRegistrationFormComponent } from './car-registration-form.component';
import { CarService, CarWithHistory } from '../services/car.service';
import { CustomerService } from '../../../core/services/customer.service';
import { Customer } from '../../../core/models/customer.model';
import { TranslationService } from '../../../core/services/translation.service';
import { ToastService } from '../../../shared/services/toast.service';

describe('CarRegistrationFormComponent', () => {
  let component: CarRegistrationFormComponent;
  let fixture: ComponentFixture<CarRegistrationFormComponent>;
  let carService: jasmine.SpyObj<CarService>;
  let customerService: jasmine.SpyObj<CustomerService>;

  const createdCustomer: Customer = {
    id: 'customer-real-id',
    name: 'Test Customer',
    phone: '+21612345678',
    email: 'test@example.com',
    registrationDate: new Date(),
    totalCars: 0,
    totalAppointments: 0,
    totalInvoices: 0,
    totalSpent: 0,
    averageSpending: 0,
    status: 'active',
    preferredContactMethod: 'phone',
    loyaltyPoints: 0,
    smsOptIn: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const createdCar: CarWithHistory = {
    id: 'car-id',
    licensePlate: '123-TUN-456',
    make: 'Mini',
    model: 'F65',
    year: 2017,
    customerId: createdCustomer.id,
    currentMileage: 15000,
    totalServices: 0,
    serviceStatus: 'up-to-date'
  };

  beforeEach(async () => {
    carService = jasmine.createSpyObj<CarService>('CarService', ['createCar']);
    customerService = jasmine.createSpyObj<CustomerService>('CustomerService', [
      'getCustomers',
      'createCustomer'
    ]);
    customerService.getCustomers.and.returnValue(of([]));

    const translationService = jasmine.createSpyObj<TranslationService>(
      'TranslationService',
      ['getCurrentTranslations', 'instant', 'forceReloadTranslations'],
      { translations$: new BehaviorSubject({}) }
    );
    translationService.getCurrentTranslations.and.returnValue({
      cars: {
        currentMileageRequired: 'Current Mileage Required *',
        chooseCustomer: 'Choose Customer',
        addVehicleToGarage: 'Add Vehicle to Garage'
      }
    });
    translationService.instant.and.callFake((key: string) => key);

    const toastService = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [CarRegistrationFormComponent],
      providers: [
        { provide: CarService, useValue: carService },
        { provide: CustomerService, useValue: customerService },
        { provide: TranslationService, useValue: translationService },
        { provide: ToastService, useValue: toastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CarRegistrationFormComponent);
    component = fixture.componentInstance;
  });

  it('creates a real customer before creating a car for the new customer flow', () => {
    customerService.createCustomer.and.returnValue(of(createdCustomer));
    carService.createCar.and.returnValue(of(createdCar));

    component.carForm.patchValue({
      licensePlate: createdCar.licensePlate,
      make: createdCar.make,
      model: createdCar.model,
      year: createdCar.year,
      currentMileage: createdCar.currentMileage,
      customerType: 'new',
      customerName: createdCustomer.name,
      customerPhone: createdCustomer.phone,
      customerEmail: createdCustomer.email
    });

    component.onSubmit();

    expect(customerService.createCustomer).toHaveBeenCalledOnceWith({
      name: createdCustomer.name,
      phone: createdCustomer.phone,
      email: createdCustomer.email,
      preferredContactMethod: 'phone',
      smsOptIn: true
    });
    expect(carService.createCar).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      customerId: createdCustomer.id,
      licensePlate: createdCar.licensePlate,
      make: createdCar.make,
      model: createdCar.model
    }));
  });

  it('requires a selected customer in the initial existing customer flow', () => {
    expect(component.carForm.valid).toBeFalse();
    expect(component.customerId?.hasError('required')).toBeTrue();
  });
});
