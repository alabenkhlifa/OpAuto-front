import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
  Customer,
  CustomerStats,
  CustomerHistory,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerSearchFilters,
  CustomerSummary,
  CustomerAppointmentHistory,
  CustomerInvoiceHistory,
  CustomerCarHistory,
  CustomerStatus,
  ContactMethod,
  CustomerSortField
} from '../models/customer.model';
import { fromBackendEnum, toBackendEnum } from '../utils/enum-mapper';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private http = inject(HttpClient);

  private customersSubject = new BehaviorSubject<Customer[]>([]);
  public customers$ = this.customersSubject.asObservable();

  public searchQuery = signal<string>('');
  public selectedStatus = signal<string>('all');
  public selectedCity = signal<string>('all');

  // ---------------------------------------------------------------------------
  // Backend mapping
  // ---------------------------------------------------------------------------

  private mapFromBackend(b: any): Customer {
    const name = ((b.firstName || '') + ' ' + (b.lastName || '')).trim() || b.name || '';
    const cars: any[] = b.cars || [];
    const countData = b._count || {};

    return {
      id: b.id,
      name,
      phone: b.phone || '',
      email: b.email || undefined,
      address: b.address ? { street: b.address, city: '', postalCode: '', country: '' } : undefined,
      registrationDate: new Date(b.createdAt),
      lastVisitDate: b.updatedAt ? new Date(b.updatedAt) : undefined,
      totalCars: cars.length || 0,
      totalAppointments: countData.appointments ?? b.visitCount ?? 0,
      totalInvoices: countData.invoices ?? 0,
      totalSpent: b.totalSpent ?? 0,
      averageSpending: b.totalSpent && (countData.invoices || b.visitCount)
        ? b.totalSpent / (countData.invoices || b.visitCount || 1)
        : 0,
      status: fromBackendEnum(b.status) as CustomerStatus,
      notes: b.notes || undefined,
      preferredContactMethod: (b.preferredContactMethod as ContactMethod) || 'phone',
      loyaltyPoints: b.loyaltyPoints ?? 0,
      referralSource: b.referralSource || undefined,
      createdAt: new Date(b.createdAt),
      updatedAt: new Date(b.updatedAt)
    };
  }

  private mapToBackend(f: CreateCustomerRequest | UpdateCustomerRequest): any {
    const payload: any = {};

    if ('name' in f && f.name != null) {
      const parts = f.name.trim().split(/\s+/);
      payload.firstName = parts[0] || '';
      payload.lastName = parts.slice(1).join(' ') || '';
    }

    if ('phone' in f && f.phone != null) payload.phone = f.phone;
    if ('email' in f && f.email != null) payload.email = f.email;
    if ('notes' in f && f.notes != null) payload.notes = f.notes;
    if ('address' in f && f.address != null) {
      // Backend stores address as a single string
      payload.address = [f.address.street, f.address.city, f.address.postalCode, f.address.country]
        .filter(Boolean)
        .join(', ');
    }
    if ('status' in f && f.status != null) payload.status = toBackendEnum(f.status);

    return payload;
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  getCustomers(): Observable<Customer[]> {
    return this.http.get<any[]>('/customers').pipe(
      map(items => items.map(item => this.mapFromBackend(item))),
      tap(customers => this.customersSubject.next(customers))
    );
  }

  getCustomerById(customerId: string): Observable<Customer | undefined> {
    return this.http.get<any>(`/customers/${customerId}`).pipe(
      map(b => this.mapFromBackend(b))
    );
  }

  createCustomer(customerData: CreateCustomerRequest): Observable<Customer> {
    const body = this.mapToBackend(customerData);
    return this.http.post<any>('/customers', body).pipe(
      map(b => this.mapFromBackend(b)),
      tap(customer => {
        const current = this.customersSubject.value;
        this.customersSubject.next([customer, ...current]);
      })
    );
  }

  updateCustomer(customerId: string, updates: UpdateCustomerRequest): Observable<Customer> {
    const body = this.mapToBackend(updates);
    return this.http.put<any>(`/customers/${customerId}`, body).pipe(
      map(b => this.mapFromBackend(b)),
      tap(updated => {
        const current = this.customersSubject.value;
        const index = current.findIndex(c => c.id === customerId);
        if (index !== -1) {
          current[index] = updated;
          this.customersSubject.next([...current]);
        }
      })
    );
  }

  deleteCustomer(customerId: string): Observable<boolean> {
    return this.http.delete<void>(`/customers/${customerId}`).pipe(
      map(() => {
        const current = this.customersSubject.value;
        this.customersSubject.next(current.filter(c => c.id !== customerId));
        return true;
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Computed / local queries (operate on cached data)
  // ---------------------------------------------------------------------------

  getCustomerStats(): Observable<CustomerStats> {
    const customers = this.customersSubject.value;
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.status === 'active').length;
    const vipCustomers = customers.filter(c => c.status === 'vip').length;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const newCustomersThisMonth = customers.filter(c =>
      c.registrationDate.getMonth() === currentMonth &&
      c.registrationDate.getFullYear() === currentYear
    ).length;

    const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const averageCustomerValue = totalCustomers ? totalSpent / totalCustomers : 0;

    const topCustomers = [...customers]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5)
      .map(c => this.mapToCustomerSummary(c));

    const customersByStatus: Record<CustomerStatus, number> = {
      active: customers.filter(c => c.status === 'active').length,
      inactive: customers.filter(c => c.status === 'inactive').length,
      vip: customers.filter(c => c.status === 'vip').length,
      blocked: customers.filter(c => c.status === 'blocked').length
    };

    const recentCustomers = [...customers]
      .sort((a, b) => b.registrationDate.getTime() - a.registrationDate.getTime())
      .slice(0, 5)
      .map(c => this.mapToCustomerSummary(c));

    return of({
      totalCustomers,
      activeCustomers,
      vipCustomers,
      newCustomersThisMonth,
      averageCustomerValue,
      topCustomers,
      customersByStatus,
      recentCustomers
    });
  }

  searchCustomers(filters: CustomerSearchFilters): Observable<Customer[]> {
    let filtered = [...this.customersSubject.value];

    if (filters.query) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(query) ||
        customer.phone.includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.address?.city.toLowerCase().includes(query)
      );
    }

    if (filters.status) {
      filtered = filtered.filter(customer => customer.status === filters.status);
    }

    if (filters.city) {
      filtered = filtered.filter(customer => customer.address?.city === filters.city);
    }

    if (filters.registrationDateFrom) {
      filtered = filtered.filter(customer =>
        customer.registrationDate >= filters.registrationDateFrom!
      );
    }

    if (filters.registrationDateTo) {
      filtered = filtered.filter(customer =>
        customer.registrationDate <= filters.registrationDateTo!
      );
    }

    if (filters.minSpent !== undefined) {
      filtered = filtered.filter(customer => customer.totalSpent >= filters.minSpent!);
    }

    if (filters.maxSpent !== undefined) {
      filtered = filtered.filter(customer => customer.totalSpent <= filters.maxSpent!);
    }

    if (filters.hasEmail !== undefined) {
      filtered = filtered.filter(customer =>
        filters.hasEmail ? !!customer.email : !customer.email
      );
    }

    if (filters.sortBy) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (filters.sortBy) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'registrationDate':
            aValue = a.registrationDate.getTime();
            bValue = b.registrationDate.getTime();
            break;
          case 'lastVisitDate':
            aValue = a.lastVisitDate?.getTime() || 0;
            bValue = b.lastVisitDate?.getTime() || 0;
            break;
          case 'totalSpent':
            aValue = a.totalSpent;
            bValue = b.totalSpent;
            break;
          case 'totalAppointments':
            aValue = a.totalAppointments;
            bValue = b.totalAppointments;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return filters.sortOrder === 'desc' ? 1 : -1;
        if (aValue > bValue) return filters.sortOrder === 'desc' ? -1 : 1;
        return 0;
      });
    }

    return of(filtered);
  }

  getCustomerHistory(customerId: string): Observable<CustomerHistory> {
    return this.http.get<any>(`/customers/${customerId}`).pipe(
      map(b => {
        const appointments: CustomerAppointmentHistory[] = (b.appointments || []).map((a: any) => ({
          id: a.id,
          date: new Date(a.startTime || a.date),
          serviceName: a.serviceName || a.title || '',
          carMake: a.car?.make || '',
          carModel: a.car?.model || '',
          licensePlate: a.car?.licensePlate || '',
          status: fromBackendEnum(a.status),
          totalCost: a.totalCost ?? a.price ?? 0
        }));

        const invoices: CustomerInvoiceHistory[] = (b.invoices || []).map((inv: any) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber || inv.number || '',
          date: new Date(inv.createdAt || inv.date),
          amount: inv.totalAmount ?? inv.amount ?? 0,
          status: fromBackendEnum(inv.status),
          serviceName: inv.serviceName || '',
          dueDate: new Date(inv.dueDate || inv.createdAt)
        }));

        const cars: CustomerCarHistory[] = (b.cars || []).map((car: any) => ({
          id: car.id,
          licensePlate: car.licensePlate || '',
          make: car.make || '',
          model: car.model || '',
          year: car.year || 0,
          registrationDate: new Date(car.createdAt),
          lastServiceDate: car.updatedAt ? new Date(car.updatedAt) : undefined,
          totalServices: 0,
          totalSpent: 0
        }));

        return { appointments, invoices, cars };
      })
    );
  }

  getAvailableCities(): Observable<string[]> {
    const customers = this.customersSubject.value;
    const cities = [...new Set(customers
      .map(customer => customer.address?.city)
      .filter((city): city is string => !!city)
    )].sort();
    return of(cities);
  }

  getCustomersByStatus(status: CustomerStatus): Observable<Customer[]> {
    const filtered = this.customersSubject.value.filter(customer => customer.status === status);
    return of(filtered);
  }

  getTopCustomers(limit: number = 5): Observable<CustomerSummary[]> {
    const topCustomers = [...this.customersSubject.value]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit)
      .map(c => this.mapToCustomerSummary(c));
    return of(topCustomers);
  }

  getRecentCustomers(limit: number = 5): Observable<CustomerSummary[]> {
    const recentCustomers = [...this.customersSubject.value]
      .sort((a, b) => b.registrationDate.getTime() - a.registrationDate.getTime())
      .slice(0, limit)
      .map(c => this.mapToCustomerSummary(c));
    return of(recentCustomers);
  }

  updateCustomerStatus(customerId: string, status: CustomerStatus): Observable<Customer> {
    return this.updateCustomer(customerId, { status });
  }

  addLoyaltyPoints(customerId: string, points: number): Observable<Customer> {
    const customer = this.customersSubject.value.find(c => c.id === customerId);
    if (customer) {
      const newPoints = customer.loyaltyPoints + points;
      return this.updateCustomer(customerId, { loyaltyPoints: newPoints });
    }
    throw new Error('Customer not found');
  }

  getCustomerMetrics(customerId: string): Observable<any> {
    const customer = this.customersSubject.value.find(c => c.id === customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const monthsSinceRegistration = Math.floor(
      (new Date().getTime() - customer.registrationDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    const appointmentsPerMonth = customer.totalAppointments / Math.max(monthsSinceRegistration, 1);
    const revenuePerMonth = customer.totalSpent / Math.max(monthsSinceRegistration, 1);

    return of({
      customer,
      monthsSinceRegistration,
      appointmentsPerMonth: Math.round(appointmentsPerMonth * 10) / 10,
      revenuePerMonth: Math.round(revenuePerMonth * 100) / 100,
      loyaltyTier: this.getLoyaltyTier(customer.loyaltyPoints),
      nextTierProgress: this.getNextTierProgress(customer.loyaltyPoints)
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private mapToCustomerSummary(customer: Customer): CustomerSummary {
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      status: customer.status,
      totalSpent: customer.totalSpent,
      lastVisitDate: customer.lastVisitDate,
      totalCars: customer.totalCars
    };
  }

  private getLoyaltyTier(points: number): string {
    if (points >= 500) return 'Platinum';
    if (points >= 250) return 'Gold';
    if (points >= 100) return 'Silver';
    return 'Bronze';
  }

  private getNextTierProgress(points: number): { nextTier: string; pointsNeeded: number; progress: number } {
    if (points >= 500) {
      return { nextTier: 'Platinum', pointsNeeded: 0, progress: 100 };
    }
    if (points >= 250) {
      const pointsNeeded = 500 - points;
      const progress = (points - 250) / (500 - 250) * 100;
      return { nextTier: 'Platinum', pointsNeeded, progress };
    }
    if (points >= 100) {
      const pointsNeeded = 250 - points;
      const progress = (points - 100) / (250 - 100) * 100;
      return { nextTier: 'Gold', pointsNeeded, progress };
    }
    const pointsNeeded = 100 - points;
    const progress = points / 100 * 100;
    return { nextTier: 'Silver', pointsNeeded, progress };
  }
}
