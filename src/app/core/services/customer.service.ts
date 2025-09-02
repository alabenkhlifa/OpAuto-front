import { Injectable, signal, computed } from '@angular/core';
import { Observable, of, BehaviorSubject, map, combineLatest } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private customersSubject = new BehaviorSubject<Customer[]>([]);
  public customers$ = this.customersSubject.asObservable();
  
  public searchQuery = signal<string>('');
  public selectedStatus = signal<string>('all');
  public selectedCity = signal<string>('all');

  private mockCustomers: Customer[] = [
    {
      id: 'customer1',
      name: 'Ahmed Ben Ali',
      phone: '+216-20-123-456',
      email: 'ahmed.benali@email.tn',
      address: {
        street: '15 Avenue Bourguiba',
        city: 'Tunis',
        postalCode: '1000',
        country: 'Tunisia'
      },
      registrationDate: new Date(2024, 0, 15),
      lastVisitDate: new Date(2025, 6, 15),
      totalCars: 2,
      totalAppointments: 15,
      totalInvoices: 12,
      totalSpent: 2850.50,
      averageSpending: 237.54,
      status: 'vip',
      notes: 'Loyal customer since 2024. Prefers morning appointments.',
      preferredContactMethod: 'phone',
      loyaltyPoints: 285,
      referralSource: 'Facebook',
      createdAt: new Date(2024, 0, 15),
      updatedAt: new Date(2025, 6, 15)
    },
    {
      id: 'customer2',
      name: 'Fatma Trabelsi',
      phone: '+216-25-789-123',
      email: 'fatma.trabelsi@email.tn',
      address: {
        street: '42 Rue de la République',
        city: 'Sfax',
        postalCode: '3000',
        country: 'Tunisia'
      },
      registrationDate: new Date(2024, 2, 22),
      lastVisitDate: new Date(2025, 5, 20),
      totalCars: 1,
      totalAppointments: 8,
      totalInvoices: 7,
      totalSpent: 1650.75,
      averageSpending: 235.82,
      status: 'active',
      notes: 'Works in healthcare. Flexible with scheduling.',
      preferredContactMethod: 'email',
      loyaltyPoints: 165,
      referralSource: 'Friend referral',
      createdAt: new Date(2024, 2, 22),
      updatedAt: new Date(2025, 5, 20)
    },
    {
      id: 'customer3',
      name: 'Mohamed Khemir',
      phone: '+216-22-456-789',
      email: 'mohamed.khemir@email.tn',
      address: {
        street: '78 Avenue Habib Bourguiba',
        city: 'Sousse',
        postalCode: '4000',
        country: 'Tunisia'
      },
      registrationDate: new Date(2024, 4, 10),
      lastVisitDate: new Date(2025, 7, 1),
      totalCars: 1,
      totalAppointments: 3,
      totalInvoices: 3,
      totalSpent: 890.25,
      averageSpending: 296.75,
      status: 'active',
      notes: 'Business owner, prefers luxury car services.',
      preferredContactMethod: 'whatsapp',
      loyaltyPoints: 89,
      referralSource: 'Google Search',
      createdAt: new Date(2024, 4, 10),
      updatedAt: new Date(2025, 7, 1)
    },
    {
      id: 'customer4',
      name: 'Leila Mansouri',
      phone: '+216-28-654-321',
      email: 'leila.mansouri@email.tn',
      address: {
        street: '23 Rue Ibn Khaldoun',
        city: 'Tunis',
        postalCode: '1002',
        country: 'Tunisia'
      },
      registrationDate: new Date(2024, 7, 5),
      lastVisitDate: new Date(2025, 6, 25),
      totalCars: 1,
      totalAppointments: 5,
      totalInvoices: 5,
      totalSpent: 1320.00,
      averageSpending: 264.00,
      status: 'active',
      notes: 'Teacher, prefers afternoon appointments after work.',
      preferredContactMethod: 'phone',
      loyaltyPoints: 132,
      referralSource: 'Colleague referral',
      createdAt: new Date(2024, 7, 5),
      updatedAt: new Date(2025, 6, 25)
    },
    {
      id: 'customer5',
      name: 'Youssef Hammami',
      phone: '+216-29-987-654',
      email: 'youssef.hammami@email.tn',
      registrationDate: new Date(2025, 0, 12),
      totalCars: 1,
      totalAppointments: 1,
      totalInvoices: 1,
      totalSpent: 125.50,
      averageSpending: 125.50,
      status: 'active',
      notes: 'New customer, first service completed.',
      preferredContactMethod: 'sms',
      loyaltyPoints: 13,
      referralSource: 'Walk-in',
      createdAt: new Date(2025, 0, 12),
      updatedAt: new Date(2025, 0, 12)
    },
    {
      id: 'customer6',
      name: 'Samira Bouzid',
      phone: '+216-24-321-987',
      registrationDate: new Date(2023, 11, 8),
      lastVisitDate: new Date(2024, 8, 15),
      totalCars: 2,
      totalAppointments: 25,
      totalInvoices: 20,
      totalSpent: 4250.80,
      averageSpending: 212.54,
      status: 'inactive',
      notes: 'Former regular customer. Has not visited in 6+ months.',
      preferredContactMethod: 'phone',
      loyaltyPoints: 425,
      referralSource: 'Family referral',
      createdAt: new Date(2023, 11, 8),
      updatedAt: new Date(2024, 8, 15)
    }
  ];

  constructor() {
    this.customersSubject.next(this.mockCustomers);
  }

  getCustomers(): Observable<Customer[]> {
    return this.customers$;
  }

  getCustomerById(customerId: string): Observable<Customer | undefined> {
    return of(this.mockCustomers.find(customer => customer.id === customerId));
  }

  getCustomerStats(): Observable<CustomerStats> {
    const totalCustomers = this.mockCustomers.length;
    const activeCustomers = this.mockCustomers.filter(c => c.status === 'active').length;
    const vipCustomers = this.mockCustomers.filter(c => c.status === 'vip').length;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const newCustomersThisMonth = this.mockCustomers.filter(c => 
      c.registrationDate.getMonth() === currentMonth && 
      c.registrationDate.getFullYear() === currentYear
    ).length;

    const totalSpent = this.mockCustomers.reduce((sum, c) => sum + c.totalSpent, 0);
    const averageCustomerValue = totalSpent / totalCustomers;

    const topCustomers = [...this.mockCustomers]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5)
      .map(c => this.mapToCustomerSummary(c));

    const customersByStatus: Record<CustomerStatus, number> = {
      active: this.mockCustomers.filter(c => c.status === 'active').length,
      inactive: this.mockCustomers.filter(c => c.status === 'inactive').length,
      vip: this.mockCustomers.filter(c => c.status === 'vip').length,
      blocked: this.mockCustomers.filter(c => c.status === 'blocked').length
    };

    const recentCustomers = [...this.mockCustomers]
      .sort((a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime())
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
    let filtered = [...this.mockCustomers];

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
    const mockAppointments: CustomerAppointmentHistory[] = [
      {
        id: 'app1',
        date: new Date(2025, 6, 15),
        serviceName: 'Oil Change & Filter',
        carMake: 'BMW',
        carModel: 'X5',
        licensePlate: '123 TUN 2024',
        status: 'completed',
        totalCost: 85.50
      },
      {
        id: 'app2',
        date: new Date(2025, 5, 20),
        serviceName: 'Brake System Check',
        carMake: 'Toyota',
        carModel: 'Camry',
        licensePlate: '789 TUN 2021',
        status: 'completed',
        totalCost: 245.75
      }
    ];

    const mockInvoices: CustomerInvoiceHistory[] = [
      {
        id: 'inv1',
        invoiceNumber: 'INV-2025-001',
        date: new Date(2025, 6, 15),
        amount: 85.50,
        status: 'paid',
        serviceName: 'Oil Change & Filter',
        dueDate: new Date(2025, 6, 29)
      },
      {
        id: 'inv2',
        invoiceNumber: 'INV-2025-002',
        date: new Date(2025, 5, 20),
        amount: 245.75,
        status: 'paid',
        serviceName: 'Brake System Check',
        dueDate: new Date(2025, 6, 4)
      }
    ];

    const mockCars: CustomerCarHistory[] = [
      {
        id: 'car1',
        licensePlate: '123 TUN 2024',
        make: 'BMW',
        model: 'X5',
        year: 2020,
        registrationDate: new Date(2024, 0, 15),
        lastServiceDate: new Date(2025, 6, 15),
        totalServices: 8,
        totalSpent: 1425.50
      },
      {
        id: 'car3',
        licensePlate: '789 TUN 2021',
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        registrationDate: new Date(2024, 8, 10),
        lastServiceDate: new Date(2025, 4, 10),
        totalServices: 5,
        totalSpent: 1425.00
      }
    ];

    return of({
      appointments: mockAppointments,
      invoices: mockInvoices,
      cars: mockCars
    });
  }

  createCustomer(customerData: CreateCustomerRequest): Observable<Customer> {
    const newCustomer: Customer = {
      id: Date.now().toString(),
      ...customerData,
      registrationDate: new Date(),
      totalCars: 0,
      totalAppointments: 0,
      totalInvoices: 0,
      totalSpent: 0,
      averageSpending: 0,
      status: 'active',
      loyaltyPoints: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.mockCustomers.push(newCustomer);
    this.customersSubject.next([...this.mockCustomers]);
    return of(newCustomer);
  }

  updateCustomer(customerId: string, updates: UpdateCustomerRequest): Observable<Customer> {
    const index = this.mockCustomers.findIndex(customer => customer.id === customerId);
    if (index !== -1) {
      this.mockCustomers[index] = {
        ...this.mockCustomers[index],
        ...updates,
        updatedAt: new Date()
      };
      this.customersSubject.next([...this.mockCustomers]);
      return of(this.mockCustomers[index]);
    }
    throw new Error('Customer not found');
  }

  deleteCustomer(customerId: string): Observable<boolean> {
    const index = this.mockCustomers.findIndex(customer => customer.id === customerId);
    if (index !== -1) {
      this.mockCustomers.splice(index, 1);
      this.customersSubject.next([...this.mockCustomers]);
      return of(true);
    }
    return of(false);
  }

  getAvailableCities(): Observable<string[]> {
    const cities = [...new Set(this.mockCustomers
      .map(customer => customer.address?.city)
      .filter((city): city is string => !!city)
    )].sort();
    return of(cities);
  }

  getCustomersByStatus(status: CustomerStatus): Observable<Customer[]> {
    const filtered = this.mockCustomers.filter(customer => customer.status === status);
    return of(filtered);
  }

  getTopCustomers(limit: number = 5): Observable<CustomerSummary[]> {
    const topCustomers = [...this.mockCustomers]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit)
      .map(c => this.mapToCustomerSummary(c));
    return of(topCustomers);
  }

  getRecentCustomers(limit: number = 5): Observable<CustomerSummary[]> {
    const recentCustomers = [...this.mockCustomers]
      .sort((a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime())
      .slice(0, limit)
      .map(c => this.mapToCustomerSummary(c));
    return of(recentCustomers);
  }

  updateCustomerStatus(customerId: string, status: CustomerStatus): Observable<Customer> {
    return this.updateCustomer(customerId, { status });
  }

  addLoyaltyPoints(customerId: string, points: number): Observable<Customer> {
    const customer = this.mockCustomers.find(c => c.id === customerId);
    if (customer) {
      const newPoints = customer.loyaltyPoints + points;
      return this.updateCustomer(customerId, { loyaltyPoints: newPoints });
    }
    throw new Error('Customer not found');
  }

  getCustomerMetrics(customerId: string): Observable<any> {
    const customer = this.mockCustomers.find(c => c.id === customerId);
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