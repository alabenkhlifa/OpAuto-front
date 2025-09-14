import { Injectable, signal, inject } from '@angular/core';
import { Observable, of, BehaviorSubject, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Car, Customer } from '../../../core/models/appointment.model';
import { SubscriptionService } from '../../../core/services/subscription.service';

export interface CarWithHistory extends Car {
  lastServiceDate?: Date;
  nextServiceDue?: Date;
  totalServices: number;
  currentMileage: number;
  serviceStatus: 'up-to-date' | 'due-soon' | 'overdue';
  lastServiceType?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CarService {
  private subscriptionService = inject(SubscriptionService);
  
  private carsSubject = new BehaviorSubject<CarWithHistory[]>([]);
  public cars$ = this.carsSubject.asObservable();
  
  public searchQuery = signal<string>('');
  public selectedMake = signal<string>('all');
  public selectedStatus = signal<string>('all');

  private mockCars: CarWithHistory[] = [
    {
      id: 'car1',
      licensePlate: '123 TUN 2024',
      make: 'BMW',
      model: 'X5',
      year: 2020,
      customerId: 'customer1',
      lastServiceDate: new Date(2025, 6, 15),
      nextServiceDue: new Date(2025, 9, 15),
      totalServices: 8,
      currentMileage: 45000,
      serviceStatus: 'up-to-date',
      lastServiceType: 'Oil Change & Filter'
    },
    {
      id: 'car2',
      licensePlate: '456 TUN 2019',
      make: 'Honda',
      model: 'Civic',
      year: 2019,
      customerId: 'customer2',
      lastServiceDate: new Date(2025, 5, 20),
      nextServiceDue: new Date(2025, 8, 20),
      totalServices: 12,
      currentMileage: 78000,
      serviceStatus: 'due-soon',
      lastServiceType: 'Brake System Check'
    },
    {
      id: 'car3',
      licensePlate: '789 TUN 2021',
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
      customerId: 'customer1',
      lastServiceDate: new Date(2025, 4, 10),
      nextServiceDue: new Date(2025, 7, 10),
      totalServices: 5,
      currentMileage: 32000,
      serviceStatus: 'overdue',
      lastServiceType: 'Annual Inspection'
    },
    {
      id: 'car4',
      licensePlate: '321 TUN 2022',
      make: 'Mercedes',
      model: 'C-Class',
      year: 2022,
      customerId: 'customer3',
      lastServiceDate: new Date(2025, 7, 1),
      nextServiceDue: new Date(2025, 10, 1),
      totalServices: 3,
      currentMileage: 15000,
      serviceStatus: 'up-to-date',
      lastServiceType: 'Routine Maintenance'
    },
    {
      id: 'car5',
      licensePlate: '654 TUN 2020',
      make: 'Audi',
      model: 'A4',
      year: 2020,
      customerId: 'customer4',
      lastServiceDate: new Date(2025, 6, 25),
      nextServiceDue: new Date(2025, 9, 25),
      totalServices: 7,
      currentMileage: 52000,
      serviceStatus: 'up-to-date',
      lastServiceType: 'Tire Rotation'
    },
    {
      id: 'car6',
      licensePlate: '147 TUN 2018',
      make: 'Peugeot',
      model: '308',
      year: 2018,
      customerId: 'customer2',
      lastServiceDate: new Date(2025, 3, 15),
      nextServiceDue: new Date(2025, 6, 15),
      totalServices: 15,
      currentMileage: 95000,
      serviceStatus: 'overdue',
      lastServiceType: 'Engine Diagnostics'
    }
  ];

  private mockCustomers: Customer[] = [
    { id: 'customer1', name: 'Ahmed Ben Ali', phone: '+216-20-123-456', email: 'ahmed.benali@email.tn' },
    { id: 'customer2', name: 'Fatma Trabelsi', phone: '+216-25-789-123', email: 'fatma.trabelsi@email.tn' },
    { id: 'customer3', name: 'Mohamed Khemir', phone: '+216-22-456-789', email: 'mohamed.khemir@email.tn' },
    { id: 'customer4', name: 'Leila Mansouri', phone: '+216-28-654-321', email: 'leila.mansouri@email.tn' }
  ];

  constructor() {
    this.carsSubject.next(this.mockCars);
  }

  getCars(): Observable<CarWithHistory[]> {
    return this.cars$;
  }

  getCarById(carId: string): CarWithHistory | undefined {
    return this.mockCars.find(car => car.id === carId);
  }

  getCustomerById(customerId: string): Customer | undefined {
    return this.mockCustomers.find(customer => customer.id === customerId);
  }

  getCarsByCustomer(customerId: string): Observable<CarWithHistory[]> {
    const filtered = this.mockCars.filter(car => car.customerId === customerId);
    return of(filtered);
  }

  getCarsByMake(make: string): Observable<CarWithHistory[]> {
    const filtered = this.mockCars.filter(car => car.make.toLowerCase() === make.toLowerCase());
    return of(filtered);
  }

  getCarsByStatus(status: string): Observable<CarWithHistory[]> {
    const filtered = this.mockCars.filter(car => car.serviceStatus === status);
    return of(filtered);
  }

  searchCars(query: string): Observable<CarWithHistory[]> {
    const filtered = this.mockCars.filter(car =>
      car.licensePlate.toLowerCase().includes(query.toLowerCase()) ||
      car.make.toLowerCase().includes(query.toLowerCase()) ||
      car.model.toLowerCase().includes(query.toLowerCase()) ||
      this.getCustomerById(car.customerId)?.name.toLowerCase().includes(query.toLowerCase())
    );
    return of(filtered);
  }

  getAvailableMakes(): string[] {
    return [...new Set(this.mockCars.map(car => car.make))].sort();
  }

  createCar(car: Omit<CarWithHistory, 'id'>): Observable<CarWithHistory> {
    return this.subscriptionService.getCurrentSubscriptionStatus().pipe(
      switchMap(status => {
        const currentCount = this.mockCars.length;
        const limit = status.currentTier.limits.cars;
        
        // Check if we're at the limit
        if (limit !== null && currentCount >= limit) {
          return throwError({
            error: 'CAR_LIMIT_EXCEEDED',
            message: `Vehicle limit of ${limit} reached for ${status.currentTier.name} tier`,
            currentCount,
            limit,
            tier: status.currentTier.name
          });
        }
        
        const newCar: CarWithHistory = {
          ...car,
          id: Date.now().toString()
        };
        
        this.mockCars.push(newCar);
        this.carsSubject.next([...this.mockCars]);
        return of(newCar);
      })
    );
  }

  canCreateCar(): Observable<{canCreate: boolean, reason?: string}> {
    return this.subscriptionService.getCurrentSubscriptionStatus().pipe(
      map(status => {
        const currentCount = this.mockCars.length;
        const limit = status.currentTier.limits.cars;
        
        if (limit === null) {
          return { canCreate: true };
        }
        
        if (currentCount >= limit) {
          return { 
            canCreate: false, 
            reason: `Vehicle limit of ${limit} reached for ${status.currentTier.name} tier`
          };
        }
        
        return { canCreate: true };
      })
    );
  }

  getCurrentCarCount(): number {
    return this.mockCars.length;
  }

  updateCar(carId: string, updates: Partial<CarWithHistory>): Observable<CarWithHistory> {
    const index = this.mockCars.findIndex(car => car.id === carId);
    if (index !== -1) {
      this.mockCars[index] = { ...this.mockCars[index], ...updates };
      this.carsSubject.next([...this.mockCars]);
      return of(this.mockCars[index]);
    }
    throw new Error('Car not found');
  }

  deleteCar(carId: string): Observable<boolean> {
    const index = this.mockCars.findIndex(car => car.id === carId);
    if (index !== -1) {
      this.mockCars.splice(index, 1);
      this.carsSubject.next([...this.mockCars]);
      return of(true);
    }
    return of(false);
  }
}