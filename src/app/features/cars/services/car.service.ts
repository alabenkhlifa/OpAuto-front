import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Car, Customer } from '../../../core/models/appointment.model';
import { fromBackendEnum } from '../../../core/utils/enum-mapper';

export interface CarWithHistory extends Car {
  lastServiceDate?: Date;
  nextServiceDue?: Date;
  totalServices: number;
  currentMileage: number;
  serviceStatus: 'up-to-date' | 'due-soon' | 'overdue';
  lastServiceType?: string;
}

interface BackendCar {
  id: string;
  customerId: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
  licensePlate: string;
  color?: string;
  mileage?: number;
  engineType?: string;
  transmission?: string;
  lastServiceDate?: string;
  nextServiceDate?: string;
  notes?: string;
  totalServices?: number;
  createdAt: string;
  updatedAt: string;
  customer?: { firstName: string; lastName: string };
}

@Injectable({
  providedIn: 'root'
})
export class CarService {
  private http = inject(HttpClient);

  private carsSubject = new BehaviorSubject<CarWithHistory[]>([]);
  public cars$ = this.carsSubject.asObservable();

  public searchQuery = signal<string>('');
  public selectedMake = signal<string>('all');
  public selectedStatus = signal<string>('all');

  private mapFromBackend(b: BackendCar): CarWithHistory {
    return {
      id: b.id,
      licensePlate: b.licensePlate,
      make: b.make,
      model: b.model,
      year: b.year,
      customerId: b.customerId,
      currentMileage: b.mileage || 0,
      serviceStatus: 'up-to-date',
      totalServices: b.totalServices || 0,
      lastServiceDate: b.lastServiceDate ? new Date(b.lastServiceDate) : undefined,
      nextServiceDue: b.nextServiceDate ? new Date(b.nextServiceDate) : undefined,
    };
  }

  private mapToBackend(f: Partial<CarWithHistory>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (f.licensePlate !== undefined) payload['licensePlate'] = f.licensePlate;
    if (f.make !== undefined) payload['make'] = f.make;
    if (f.model !== undefined) payload['model'] = f.model;
    if (f.year !== undefined) payload['year'] = f.year;
    if (f.customerId !== undefined) payload['customerId'] = f.customerId;
    if (f.currentMileage !== undefined) payload['mileage'] = f.currentMileage;
    return payload;
  }

  getCars(): Observable<CarWithHistory[]> {
    return this.http.get<BackendCar[]>('/cars').pipe(
      map(list => list.map(b => this.mapFromBackend(b))),
      tap(cars => this.carsSubject.next(cars))
    );
  }

  getCarById(carId: string): CarWithHistory | undefined {
    return this.carsSubject.value.find(car => car.id === carId);
  }

  getCustomerById(customerId: string): Customer | undefined {
    // No longer maintained locally; callers should use CustomerService
    return undefined;
  }

  getCarsByCustomer(customerId: string): Observable<CarWithHistory[]> {
    return this.http.get<BackendCar[]>('/cars', { params: { customerId } }).pipe(
      map(list => list.map(b => this.mapFromBackend(b)))
    );
  }

  getCarsByMake(make: string): Observable<CarWithHistory[]> {
    const filtered = this.carsSubject.value.filter(
      car => car.make.toLowerCase() === make.toLowerCase()
    );
    return of(filtered);
  }

  getCarsByStatus(status: string): Observable<CarWithHistory[]> {
    const filtered = this.carsSubject.value.filter(car => car.serviceStatus === status);
    return of(filtered);
  }

  searchCars(query: string): Observable<CarWithHistory[]> {
    const q = query.toLowerCase();
    const filtered = this.carsSubject.value.filter(car =>
      car.licensePlate.toLowerCase().includes(q) ||
      car.make.toLowerCase().includes(q) ||
      car.model.toLowerCase().includes(q)
    );
    return of(filtered);
  }

  getAvailableMakes(): string[] {
    return [...new Set(this.carsSubject.value.map(car => car.make))].sort();
  }

  createCar(car: Omit<CarWithHistory, 'id'>): Observable<CarWithHistory> {
    return this.http.post<BackendCar>('/cars', this.mapToBackend(car as CarWithHistory)).pipe(
      map(b => this.mapFromBackend(b)),
      tap(created => {
        this.carsSubject.next([...this.carsSubject.value, created]);
      })
    );
  }

  canCreateCar(): Observable<{ canCreate: boolean; reason?: string }> {
    return of({ canCreate: true });
  }

  getCurrentCarCount(): number {
    return this.carsSubject.value.length;
  }

  updateCar(carId: string, updates: Partial<CarWithHistory>): Observable<CarWithHistory> {
    return this.http.put<BackendCar>(`/cars/${carId}`, this.mapToBackend(updates)).pipe(
      map(b => this.mapFromBackend(b)),
      tap(updated => {
        const cars = this.carsSubject.value.map(c => (c.id === carId ? updated : c));
        this.carsSubject.next(cars);
      })
    );
  }

  deleteCar(carId: string): Observable<boolean> {
    return this.http.delete<void>(`/cars/${carId}`).pipe(
      map(() => {
        const cars = this.carsSubject.value.filter(c => c.id !== carId);
        this.carsSubject.next(cars);
        return true;
      })
    );
  }
}
