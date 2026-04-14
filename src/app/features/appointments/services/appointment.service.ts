import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Appointment, AppointmentSlot, Car, Customer, Mechanic, GarageCapacity } from '../../../core/models/appointment.model';
import { fromBackendEnum, toBackendEnum } from '../../../core/utils/enum-mapper';

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private http = inject(HttpClient);

  private appointmentsSubject = new BehaviorSubject<Appointment[]>([]);
  public appointments$ = this.appointmentsSubject.asObservable();

  public selectedDate = signal<Date>(new Date());
  public viewMode = signal<'day' | 'week' | 'month'>('day');

  // Cached data from backend for sync lookups
  private cachedCars: Car[] = [];
  private cachedCustomers: Customer[] = [];
  private cachedMechanics: Mechanic[] = [];

  // --- Backend mapping helpers ---

  private mapFromBackend(b: any): Appointment {
    const scheduledDate = new Date(b.startTime || b.scheduledDate);
    const estimatedDuration = b.estimatedDuration ||
      this.calculateFromTimes(b.startTime, b.endTime);

    return {
      id: b.id,
      carId: b.carId,
      customerId: b.customerId,
      mechanicId: b.employeeId || b.mechanicId,
      serviceName: b.title || b.serviceName,
      serviceType: b.type || b.serviceType,
      scheduledDate,
      estimatedDuration,
      status: fromBackendEnum(b.status) as Appointment['status'],
      notes: b.notes,
      priority: b.priority || 'medium',
      createdAt: new Date(b.createdAt),
      updatedAt: new Date(b.updatedAt),
    };
  }

  private mapToBackend(f: Partial<Appointment>): any {
    const payload: any = {};

    if (f.serviceName !== undefined) payload.title = f.serviceName;
    if (f.serviceType !== undefined) payload.type = f.serviceType;
    if (f.scheduledDate !== undefined) {
      const start = f.scheduledDate instanceof Date ? f.scheduledDate : new Date(f.scheduledDate);
      payload.startTime = start.toISOString();
      if (f.estimatedDuration !== undefined) {
        payload.endTime = new Date(start.getTime() + f.estimatedDuration * 60000).toISOString();
      }
    }
    if (f.mechanicId) payload.employeeId = f.mechanicId;
    if (f.carId !== undefined) payload.carId = f.carId;
    if (f.customerId !== undefined) payload.customerId = f.customerId;
    if (f.status !== undefined) payload.status = toBackendEnum(f.status);
    if (f.priority !== undefined) payload.priority = f.priority;
    if (f.notes !== undefined) payload.notes = f.notes;

    return payload;
  }

  private calculateFromTimes(startTime: string | undefined, endTime: string | undefined): number {
    if (!startTime || !endTime) return 60;
    const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    const minutes = Math.round(diffMs / 60000);
    return minutes > 0 ? minutes : 60;
  }

  // --- Appointment CRUD operations ---

  getAppointments(): Observable<Appointment[]> {
    return this.http.get<any[]>('/appointments').pipe(
      map(items => items.map(b => this.mapFromBackend(b))),
      tap(appointments => this.appointmentsSubject.next(appointments))
    );
  }

  getAppointmentsByDate(date: Date): Observable<Appointment[]> {
    const dateStr = date.toISOString().split('T')[0];
    return this.http.get<any[]>('/appointments', { params: { date: dateStr } }).pipe(
      map(items => items.map(b => this.mapFromBackend(b)))
    );
  }

  createAppointment(appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Observable<Appointment> {
    const body = this.mapToBackend(appointment as Partial<Appointment>);
    return this.http.post<any>('/appointments', body).pipe(
      map(b => this.mapFromBackend(b)),
      tap(created => {
        const current = this.appointmentsSubject.value;
        this.appointmentsSubject.next([...current, created]);
      })
    );
  }

  updateAppointment(id: string, updates: Partial<Appointment>): Observable<Appointment> {
    const body = this.mapToBackend(updates);
    return this.http.put<any>(`/appointments/${id}`, body).pipe(
      map(b => this.mapFromBackend(b)),
      tap(updated => {
        const current = this.appointmentsSubject.value;
        const index = current.findIndex(apt => apt.id === id);
        if (index !== -1) {
          current[index] = updated;
          this.appointmentsSubject.next([...current]);
        }
      })
    );
  }

  deleteAppointment(id: string): Observable<boolean> {
    return this.http.delete<void>(`/appointments/${id}`).pipe(
      map(() => {
        const current = this.appointmentsSubject.value;
        const index = current.findIndex(apt => apt.id === id);
        if (index !== -1) {
          current.splice(index, 1);
          this.appointmentsSubject.next([...current]);
        }
        return true;
      })
    );
  }

  // --- Slot management ---

  getAvailableSlots(date: Date, duration: number): Observable<AppointmentSlot[]> {
    const slots: AppointmentSlot[] = [];
    const dayStart = new Date(date);
    dayStart.setHours(8, 0, 0, 0); // 8 AM start

    for (let hour = 8; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(dayStart);
        slotStart.setHours(hour, minute, 0, 0);
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotStart.getMinutes() + duration);

        const isAvailable = !this.isSlotConflict(slotStart, slotEnd);

        slots.push({
          startTime: slotStart,
          endTime: slotEnd,
          isAvailable
        });
      }
    }

    return of(slots);
  }

  private isSlotConflict(startTime: Date, endTime: Date): boolean {
    return this.appointmentsSubject.value.some(apt => {
      const aptStart = apt.scheduledDate;
      const aptEnd = new Date(aptStart.getTime() + apt.estimatedDuration * 60000);

      return (startTime < aptEnd && endTime > aptStart);
    });
  }

  // --- Helper data getters (wired to backend) ---

  getCars(): Observable<Car[]> {
    return this.http.get<Car[]>('/cars').pipe(
      tap(cars => this.cachedCars = cars)
    );
  }

  getCustomers(): Observable<Customer[]> {
    return this.http.get<any[]>('/customers').pipe(
      map(customers => customers.map(c => ({
        id: c.id,
        name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        phone: c.phone || '',
        email: c.email,
      } as Customer))),
      tap(customers => this.cachedCustomers = customers)
    );
  }

  getMechanics(): Observable<Mechanic[]> {
    return this.http.get<any[]>('/employees').pipe(
      map(employees => employees.map(e => ({
        id: e.id,
        name: e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim(),
        specialties: e.specialties || e.skills || [],
        isAvailable: e.isAvailable ?? true,
        currentWorkload: e.currentWorkload ?? 0,
      } as Mechanic))),
      tap(mechanics => this.cachedMechanics = mechanics)
    );
  }

  getGarageCapacity(): Observable<GarageCapacity> {
    return this.http.get<GarageCapacity>('/garage-settings/capacity');
  }

  // --- Search and filter (using cached subject) ---

  searchAppointments(query: string): Observable<Appointment[]> {
    const filtered = this.appointmentsSubject.value.filter(apt =>
      apt.serviceName.toLowerCase().includes(query.toLowerCase()) ||
      apt.notes?.toLowerCase().includes(query.toLowerCase())
    );
    return of(filtered);
  }

  getAppointmentsByMechanic(mechanicId: string): Observable<Appointment[]> {
    const filtered = this.appointmentsSubject.value.filter(apt => apt.mechanicId === mechanicId);
    return of(filtered);
  }

  getAppointmentsByStatus(status: string): Observable<Appointment[]> {
    const filtered = this.appointmentsSubject.value.filter(apt => apt.status === status);
    return of(filtered);
  }

  // --- Sync helper methods (use cached data) ---

  getCarById(carId: string): Car | undefined {
    return this.cachedCars.find(car => car.id === carId);
  }

  getCustomerById(customerId: string): Customer | undefined {
    return this.cachedCustomers.find(customer => customer.id === customerId);
  }

  getMechanicById(mechanicId: string): Mechanic | undefined {
    return this.cachedMechanics.find(mechanic => mechanic.id === mechanicId);
  }

  getCustomerByCar(carId: string): Customer | undefined {
    const car = this.getCarById(carId);
    return car ? this.getCustomerById(car.customerId) : undefined;
  }

  // --- Enhanced appointment data with related info ---

  getAppointmentWithDetails(appointmentId: string): Observable<any> {
    const appointment = this.appointmentsSubject.value.find(apt => apt.id === appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    const car = this.getCarById(appointment.carId);
    const customer = this.getCustomerById(appointment.customerId);
    const mechanic = this.getMechanicById(appointment.mechanicId);

    return of({
      ...appointment,
      car,
      customer,
      mechanic
    });
  }
}
