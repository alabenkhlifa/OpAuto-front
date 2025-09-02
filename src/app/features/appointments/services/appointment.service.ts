import { Injectable, signal } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { Appointment, AppointmentSlot, Car, Customer, Mechanic, GarageCapacity } from '../../../core/models/appointment.model';

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private appointmentsSubject = new BehaviorSubject<Appointment[]>([]);
  public appointments$ = this.appointmentsSubject.asObservable();
  
  public selectedDate = signal<Date>(new Date());
  public viewMode = signal<'day' | 'week' | 'month'>('day');

  // Mock data for development
  private mockAppointments: Appointment[] = [
    {
      id: '1',
      carId: 'car1',
      customerId: 'customer1', 
      mechanicId: 'mechanic1',
      serviceType: 'oil-change',
      serviceName: 'Oil Change & Filter Replacement',
      scheduledDate: new Date(2025, 7, 30, 8, 30),
      estimatedDuration: 90,
      status: 'scheduled',
      notes: 'Regular maintenance - customer requested synthetic oil',
      priority: 'medium',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2', 
      carId: 'car2',
      customerId: 'customer2',
      mechanicId: 'mechanic2',
      serviceType: 'brake-repair',
      serviceName: 'Front Brake Pads Replacement',
      scheduledDate: new Date(2025, 7, 30, 10, 0),
      estimatedDuration: 120,
      status: 'in-progress',
      notes: 'Customer reported squeaking noise',
      priority: 'high',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '3',
      carId: 'car3', 
      customerId: 'customer1',
      mechanicId: 'mechanic1',
      serviceType: 'inspection',
      serviceName: 'Annual Technical Inspection',
      scheduledDate: new Date(2025, 7, 30, 14, 30),
      estimatedDuration: 60,
      status: 'scheduled',
      priority: 'low',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '4',
      carId: 'car4',
      customerId: 'customer3',
      mechanicId: 'mechanic2',
      serviceType: 'engine',
      serviceName: 'Engine Diagnostic & Tune-up',
      scheduledDate: new Date(2025, 7, 30, 16, 0),
      estimatedDuration: 180,
      status: 'scheduled',
      notes: 'Check engine light is on',
      priority: 'high',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '5',
      carId: 'car5',
      customerId: 'customer4',
      mechanicId: 'mechanic1',
      serviceType: 'tires',
      serviceName: 'Tire Rotation & Balancing',
      scheduledDate: new Date(2025, 7, 31, 9, 0),
      estimatedDuration: 45,
      status: 'scheduled',
      priority: 'low',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  private mockCars: Car[] = [
    { id: 'car1', licensePlate: '123 TUN 2024', make: 'BMW', model: 'X5', year: 2020, customerId: 'customer1' },
    { id: 'car2', licensePlate: '456 TUN 2019', make: 'Honda', model: 'Civic', year: 2019, customerId: 'customer2' },
    { id: 'car3', licensePlate: '789 TUN 2021', make: 'Toyota', model: 'Camry', year: 2021, customerId: 'customer1' },
    { id: 'car4', licensePlate: '321 TUN 2022', make: 'Mercedes', model: 'C-Class', year: 2022, customerId: 'customer3' },
    { id: 'car5', licensePlate: '654 TUN 2020', make: 'Audi', model: 'A4', year: 2020, customerId: 'customer4' }
  ];

  private mockCustomers: Customer[] = [
    { id: 'customer1', name: 'Ahmed Ben Ali', phone: '+216-20-123-456', email: 'ahmed.benali@email.tn' },
    { id: 'customer2', name: 'Fatma Trabelsi', phone: '+216-25-789-123', email: 'fatma.trabelsi@email.tn' },
    { id: 'customer3', name: 'Mohamed Khemir', phone: '+216-22-456-789', email: 'mohamed.khemir@email.tn' },
    { id: 'customer4', name: 'Leila Mansouri', phone: '+216-28-654-321', email: 'leila.mansouri@email.tn' }
  ];

  private mockMechanics: Mechanic[] = [
    { id: 'mechanic1', name: 'Karim Mechanic', specialties: ['oil-change', 'inspection', 'engine'], isAvailable: true, currentWorkload: 2 },
    { id: 'mechanic2', name: 'Slim Technician', specialties: ['brake-repair', 'transmission', 'electrical'], isAvailable: true, currentWorkload: 1 },
    { id: 'mechanic3', name: 'Hedi Expert', specialties: ['bodywork', 'painting', 'tires'], isAvailable: false, currentWorkload: 3 }
  ];

  constructor() {
    this.appointmentsSubject.next(this.mockAppointments);
  }

  // Appointment CRUD operations
  getAppointments(): Observable<Appointment[]> {
    return this.appointments$;
  }

  getAppointmentsByDate(date: Date): Observable<Appointment[]> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const filtered = this.mockAppointments.filter(apt => 
      apt.scheduledDate >= dayStart && apt.scheduledDate <= dayEnd
    );
    return of(filtered);
  }

  createAppointment(appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Observable<Appointment> {
    const newAppointment: Appointment = {
      ...appointment,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.mockAppointments.push(newAppointment);
    this.appointmentsSubject.next([...this.mockAppointments]);
    return of(newAppointment);
  }

  updateAppointment(id: string, updates: Partial<Appointment>): Observable<Appointment> {
    const index = this.mockAppointments.findIndex(apt => apt.id === id);
    if (index !== -1) {
      this.mockAppointments[index] = {
        ...this.mockAppointments[index],
        ...updates,
        updatedAt: new Date()
      };
      this.appointmentsSubject.next([...this.mockAppointments]);
      return of(this.mockAppointments[index]);
    }
    throw new Error('Appointment not found');
  }

  deleteAppointment(id: string): Observable<boolean> {
    const index = this.mockAppointments.findIndex(apt => apt.id === id);
    if (index !== -1) {
      this.mockAppointments.splice(index, 1);
      this.appointmentsSubject.next([...this.mockAppointments]);
      return of(true);
    }
    return of(false);
  }

  // Slot management
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
    return this.mockAppointments.some(apt => {
      const aptStart = apt.scheduledDate;
      const aptEnd = new Date(aptStart.getTime() + apt.estimatedDuration * 60000);
      
      return (startTime < aptEnd && endTime > aptStart);
    });
  }

  // Helper data getters
  getCars(): Observable<Car[]> {
    return of(this.mockCars);
  }

  getCustomers(): Observable<Customer[]> {
    return of(this.mockCustomers);
  }

  getMechanics(): Observable<Mechanic[]> {
    return of(this.mockMechanics);
  }

  getGarageCapacity(): Observable<GarageCapacity> {
    return of({
      totalLifts: 5,
      availableLifts: 3,
      totalMechanics: 2,
      availableMechanics: 2,
      workingHours: {
        start: '08:00',
        end: '18:00'
      }
    });
  }

  // Search and filter
  searchAppointments(query: string): Observable<Appointment[]> {
    const filtered = this.mockAppointments.filter(apt => 
      apt.serviceName.toLowerCase().includes(query.toLowerCase()) ||
      apt.notes?.toLowerCase().includes(query.toLowerCase())
    );
    return of(filtered);
  }

  getAppointmentsByMechanic(mechanicId: string): Observable<Appointment[]> {
    const filtered = this.mockAppointments.filter(apt => apt.mechanicId === mechanicId);
    return of(filtered);
  }

  getAppointmentsByStatus(status: string): Observable<Appointment[]> {
    const filtered = this.mockAppointments.filter(apt => apt.status === status);
    return of(filtered);
  }

  // Helper methods to get related data
  getCarById(carId: string): Car | undefined {
    return this.mockCars.find(car => car.id === carId);
  }

  getCustomerById(customerId: string): Customer | undefined {
    return this.mockCustomers.find(customer => customer.id === customerId);
  }

  getMechanicById(mechanicId: string): Mechanic | undefined {
    return this.mockMechanics.find(mechanic => mechanic.id === mechanicId);
  }

  getCustomerByCar(carId: string): Customer | undefined {
    const car = this.getCarById(carId);
    return car ? this.getCustomerById(car.customerId) : undefined;
  }

  // Enhanced appointment data with related info
  getAppointmentWithDetails(appointmentId: string): Observable<any> {
    const appointment = this.mockAppointments.find(apt => apt.id === appointmentId);
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