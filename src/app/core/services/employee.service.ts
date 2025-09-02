import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { map, delay, switchMap } from 'rxjs/operators';
import { Employee, EmployeeFilters, EmployeeStats, EmployeePerformanceMetrics, EmployeeRole, EmployeeDepartment, EmployeeStatus } from '../models/employee.model';

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private mockEmployees: Employee[] = [
    {
      id: 'emp-001',
      employeeNumber: 'EMP001',
      personalInfo: {
        firstName: 'Karim',
        lastName: 'Mechanic',
        fullName: 'Karim Mechanic',
        phone: '+216 20 123 456',
        email: 'karim.mechanic@opauto.tn',
        address: '123 Rue de la Mecanique, Tunis',
        dateOfBirth: new Date('1985-03-15')
      },
      employment: {
        hireDate: new Date('2020-01-15'),
        role: 'senior-mechanic',
        department: 'mechanical',
        status: 'active',
        salary: 1200,
        contractType: 'full-time',
        workingHours: {
          monday: { isWorkingDay: true, startTime: '08:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
          tuesday: { isWorkingDay: true, startTime: '08:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
          wednesday: { isWorkingDay: true, startTime: '08:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
          thursday: { isWorkingDay: true, startTime: '08:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
          friday: { isWorkingDay: true, startTime: '08:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
          saturday: { isWorkingDay: true, startTime: '08:00', endTime: '14:00' },
          sunday: { isWorkingDay: false, startTime: '', endTime: '' }
        }
      },
      skills: {
        specialties: ['oil-change', 'inspection', 'engine', 'transmission'],
        certifications: ['ASE Master Technician', 'Automotive Diagnostics'],
        experienceLevel: 'senior',
        skillRating: 4.5
      },
      availability: {
        isAvailable: true,
        currentWorkload: 2,
        maxWorkload: 4
      },
      performance: {
        completedJobs: 245,
        averageJobDuration: 120,
        customerRating: 4.7,
        totalRevenue: 18500,
        efficiencyScore: 92
      },
      createdAt: new Date('2020-01-15'),
      updatedAt: new Date()
    },
    {
      id: 'emp-002',
      employeeNumber: 'EMP002',
      personalInfo: {
        firstName: 'Slim',
        lastName: 'Technician',
        fullName: 'Slim Technician',
        phone: '+216 25 789 012',
        email: 'slim.tech@opauto.tn',
        address: '456 Avenue Habib Bourguiba, Sfax',
        dateOfBirth: new Date('1990-07-22')
      },
      employment: {
        hireDate: new Date('2021-06-01'),
        role: 'junior-mechanic',
        department: 'mechanical',
        status: 'active',
        salary: 900,
        contractType: 'full-time',
        workingHours: {
          monday: { isWorkingDay: true, startTime: '08:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
          tuesday: { isWorkingDay: true, startTime: '08:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
          wednesday: { isWorkingDay: true, startTime: '08:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
          thursday: { isWorkingDay: true, startTime: '08:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
          friday: { isWorkingDay: true, startTime: '08:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
          saturday: { isWorkingDay: false, startTime: '', endTime: '' },
          sunday: { isWorkingDay: false, startTime: '', endTime: '' }
        }
      },
      skills: {
        specialties: ['brake-repair', 'transmission', 'electrical'],
        certifications: ['Brake Systems Certification'],
        experienceLevel: 'mid',
        skillRating: 3.8
      },
      availability: {
        isAvailable: true,
        currentWorkload: 1,
        maxWorkload: 3
      },
      performance: {
        completedJobs: 156,
        averageJobDuration: 95,
        customerRating: 4.3,
        totalRevenue: 12400,
        efficiencyScore: 85
      },
      createdAt: new Date('2021-06-01'),
      updatedAt: new Date()
    },
    {
      id: 'emp-003',
      employeeNumber: 'EMP003',
      personalInfo: {
        firstName: 'Hedi',
        lastName: 'Expert',
        fullName: 'Hedi Expert',
        phone: '+216 28 345 678',
        email: 'hedi.expert@opauto.tn',
        address: '789 Rue Ibn Khaldoun, Sousse',
        dateOfBirth: new Date('1978-11-10')
      },
      employment: {
        hireDate: new Date('2018-03-01'),
        role: 'senior-mechanic',
        department: 'bodywork',
        status: 'on-leave',
        salary: 1400,
        contractType: 'full-time',
        workingHours: {
          monday: { isWorkingDay: true, startTime: '07:00', endTime: '16:00', breakStart: '12:00', breakEnd: '13:00' },
          tuesday: { isWorkingDay: true, startTime: '07:00', endTime: '16:00', breakStart: '12:00', breakEnd: '13:00' },
          wednesday: { isWorkingDay: true, startTime: '07:00', endTime: '16:00', breakStart: '12:00', breakEnd: '13:00' },
          thursday: { isWorkingDay: true, startTime: '07:00', endTime: '16:00', breakStart: '12:00', breakEnd: '13:00' },
          friday: { isWorkingDay: true, startTime: '07:00', endTime: '16:00', breakStart: '12:00', breakEnd: '13:00' },
          saturday: { isWorkingDay: true, startTime: '08:00', endTime: '12:00' },
          sunday: { isWorkingDay: false, startTime: '', endTime: '' }
        }
      },
      skills: {
        specialties: ['bodywork', 'painting', 'tires', 'dent-repair'],
        certifications: ['Master Body Technician', 'Paint Certification', 'Frame Alignment'],
        experienceLevel: 'expert',
        skillRating: 4.9
      },
      availability: {
        isAvailable: false,
        currentWorkload: 0,
        maxWorkload: 5,
        unavailableUntil: new Date('2024-02-15'),
        unavailableReason: 'Medical Leave'
      },
      performance: {
        completedJobs: 420,
        averageJobDuration: 180,
        customerRating: 4.8,
        totalRevenue: 35200,
        efficiencyScore: 96
      },
      createdAt: new Date('2018-03-01'),
      updatedAt: new Date()
    },
    {
      id: 'emp-004',
      employeeNumber: 'EMP004',
      personalInfo: {
        firstName: 'Fatma',
        lastName: 'Admin',
        fullName: 'Fatma Admin',
        phone: '+216 22 567 890',
        email: 'fatma.admin@opauto.tn',
        address: '321 Avenue de la Liberte, Tunis',
        dateOfBirth: new Date('1982-05-08')
      },
      employment: {
        hireDate: new Date('2019-09-01'),
        role: 'admin',
        department: 'management',
        status: 'active',
        salary: 1600,
        contractType: 'full-time',
        workingHours: {
          monday: { isWorkingDay: true, startTime: '08:30', endTime: '17:30', breakStart: '12:30', breakEnd: '13:30' },
          tuesday: { isWorkingDay: true, startTime: '08:30', endTime: '17:30', breakStart: '12:30', breakEnd: '13:30' },
          wednesday: { isWorkingDay: true, startTime: '08:30', endTime: '17:30', breakStart: '12:30', breakEnd: '13:30' },
          thursday: { isWorkingDay: true, startTime: '08:30', endTime: '17:30', breakStart: '12:30', breakEnd: '13:30' },
          friday: { isWorkingDay: true, startTime: '08:30', endTime: '17:30', breakStart: '12:30', breakEnd: '13:30' },
          saturday: { isWorkingDay: false, startTime: '', endTime: '' },
          sunday: { isWorkingDay: false, startTime: '', endTime: '' }
        }
      },
      skills: {
        specialties: ['administration', 'customer-service', 'scheduling'],
        certifications: ['Management Certification', 'Customer Service Excellence'],
        experienceLevel: 'senior',
        skillRating: 4.6
      },
      availability: {
        isAvailable: true,
        currentWorkload: 1,
        maxWorkload: 2
      },
      performance: {
        completedJobs: 0,
        averageJobDuration: 0,
        customerRating: 4.9,
        totalRevenue: 0,
        efficiencyScore: 95
      },
      createdAt: new Date('2019-09-01'),
      updatedAt: new Date()
    }
  ];

  private employeesSubject = new BehaviorSubject<Employee[]>(this.mockEmployees);
  public employees$ = this.employeesSubject.asObservable();

  getEmployees(filters?: EmployeeFilters): Observable<Employee[]> {
    return this.employees$.pipe(
      map((employees: Employee[]) => this.applyFilters(employees, filters)),
      delay(200) // Simulate API delay
    );
  }

  getEmployeeById(id: string): Observable<Employee | null> {
    return this.employees$.pipe(
      map((employees: Employee[]) => employees.find((emp: Employee) => emp.id === id) || null),
      delay(100)
    );
  }

  createEmployee(employee: Partial<Employee>): Observable<Employee> {
    const newEmployee: Employee = {
      id: `emp-${Date.now()}`,
      employeeNumber: `EMP${String(this.employeesSubject.value.length + 1).padStart(3, '0')}`,
      ...employee,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Employee;

    const currentEmployees = this.employeesSubject.value;
    this.employeesSubject.next([...currentEmployees, newEmployee]);
    
    return of(newEmployee).pipe(delay(300));
  }

  updateEmployee(id: string, updates: Partial<Employee>): Observable<Employee> {
    const currentEmployees = this.employeesSubject.value;
    const employeeIndex = currentEmployees.findIndex((emp: Employee) => emp.id === id);
    
    if (employeeIndex === -1) {
      return throwError(() => new Error('Employee not found'));
    }

    const updatedEmployee = {
      ...currentEmployees[employeeIndex],
      ...updates,
      updatedAt: new Date()
    };

    const updatedEmployees = [...currentEmployees];
    updatedEmployees[employeeIndex] = updatedEmployee;
    this.employeesSubject.next(updatedEmployees);

    return of(updatedEmployee).pipe(delay(300));
  }

  deleteEmployee(id: string): Observable<boolean> {
    const currentEmployees = this.employeesSubject.value;
    const filteredEmployees = currentEmployees.filter((emp: Employee) => emp.id !== id);
    
    if (filteredEmployees.length === currentEmployees.length) {
      return throwError(() => new Error('Employee not found'));
    }

    this.employeesSubject.next(filteredEmployees);
    return of(true).pipe(delay(200));
  }

  getEmployeeStats(): Observable<EmployeeStats> {
    return this.employees$.pipe(
      map((employees: Employee[]) => {
        const stats: EmployeeStats = {
          totalEmployees: employees.length,
          activeEmployees: employees.filter((emp: Employee) => emp.employment.status === 'active').length,
          availableEmployees: employees.filter((emp: Employee) => emp.availability.isAvailable && emp.employment.status === 'active').length,
          onLeaveEmployees: employees.filter((emp: Employee) => emp.employment.status === 'on-leave').length,
          averageExperience: this.calculateAverageExperience(employees),
          totalSalaryExpense: employees
            .filter((emp: Employee) => emp.employment.status === 'active')
            .reduce((sum: number, emp: Employee) => sum + emp.employment.salary, 0),
          departmentDistribution: this.getDepartmentDistribution(employees),
          roleDistribution: this.getRoleDistribution(employees)
        };
        return stats;
      }),
      delay(150)
    );
  }

  getEmployeePerformance(employeeId: string, period: string = 'month'): Observable<EmployeePerformanceMetrics | null> {
    return this.employees$.pipe(
      map((employees: Employee[]) => {
        const employee = employees.find((emp: Employee) => emp.id === employeeId);
        if (!employee) return null;

        return {
          employeeId: employee.id,
          employeeName: employee.personalInfo.fullName,
          period,
          jobsCompleted: employee.performance.completedJobs,
          averageJobTime: employee.performance.averageJobDuration,
          customerSatisfaction: employee.performance.customerRating,
          revenue: employee.performance.totalRevenue,
          utilizationRate: (employee.availability.currentWorkload / employee.availability.maxWorkload) * 100,
          qualityScore: employee.performance.efficiencyScore
        };
      }),
      delay(200)
    );
  }

  updateEmployeeAvailability(id: string, isAvailable: boolean, reason?: string, unavailableUntil?: Date): Observable<Employee> {
    const currentEmployees = this.employeesSubject.value;
    const employee = currentEmployees.find(emp => emp.id === id);
    
    if (!employee) {
      return throwError(() => new Error('Employee not found'));
    }

    return this.updateEmployee(id, {
      availability: {
        ...employee.availability,
        isAvailable,
        unavailableReason: reason,
        unavailableUntil
      }
    });
  }

  updateEmployeeWorkload(id: string, workloadDelta: number): Observable<Employee> {
    const currentEmployees = this.employeesSubject.value;
    const employee = currentEmployees.find((emp: Employee) => emp.id === id);
    
    if (!employee) {
      return throwError(() => new Error('Employee not found'));
    }

    const newWorkload = Math.max(0, Math.min(employee.availability.maxWorkload, employee.availability.currentWorkload + workloadDelta));
    
    return this.updateEmployee(id, {
      availability: {
        ...employee.availability,
        currentWorkload: newWorkload
      }
    });
  }

  getAvailableEmployeesBySpecialty(specialty: string): Observable<Employee[]> {
    return this.employees$.pipe(
      map((employees: Employee[]) => employees.filter((emp: Employee) => 
        emp.availability.isAvailable && 
        emp.employment.status === 'active' &&
        emp.skills.specialties.includes(specialty) &&
        emp.availability.currentWorkload < emp.availability.maxWorkload
      )),
      delay(100)
    );
  }

  // Legacy compatibility method for existing Mechanic interface
  getMechanics(): Observable<any[]> {
    return this.employees$.pipe(
      map((employees: Employee[]) => employees
        .filter((emp: Employee) => emp.employment.department === 'mechanical' && emp.employment.status === 'active')
        .map((emp: Employee) => ({
          id: emp.id,
          name: emp.personalInfo.fullName,
          specialties: emp.skills.specialties,
          isAvailable: emp.availability.isAvailable,
          currentWorkload: emp.availability.currentWorkload
        }))
      )
    );
  }

  private applyFilters(employees: Employee[], filters?: EmployeeFilters): Employee[] {
    if (!filters) return employees;

    return employees.filter(employee => {
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        const searchableText = [
          employee.personalInfo.fullName,
          employee.personalInfo.email,
          employee.employeeNumber,
          employee.employment.role,
          employee.employment.department,
          ...employee.skills.specialties
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm)) return false;
      }

      if (filters.role && filters.role.length > 0 && !filters.role.includes(employee.employment.role)) {
        return false;
      }

      if (filters.department && filters.department.length > 0 && !filters.department.includes(employee.employment.department)) {
        return false;
      }

      if (filters.status && filters.status.length > 0 && !filters.status.includes(employee.employment.status)) {
        return false;
      }

      if (filters.experienceLevel && filters.experienceLevel.length > 0 && !filters.experienceLevel.includes(employee.skills.experienceLevel)) {
        return false;
      }

      if (filters.isAvailable !== undefined && employee.availability.isAvailable !== filters.isAvailable) {
        return false;
      }

      return true;
    });
  }

  private calculateAverageExperience(employees: Employee[]): number {
    if (employees.length === 0) return 0;
    
    const totalExperience = employees.reduce((sum, emp) => {
      const yearsOfService = new Date().getFullYear() - emp.employment.hireDate.getFullYear();
      return sum + yearsOfService;
    }, 0);
    
    return Math.round(totalExperience / employees.length * 10) / 10;
  }

  private getDepartmentDistribution(employees: Employee[]): { [key in EmployeeDepartment]: number } {
    const distribution = {
      management: 0,
      mechanical: 0,
      bodywork: 0,
      electrical: 0,
      service: 0
    };

    employees.forEach(emp => {
      distribution[emp.employment.department]++;
    });

    return distribution;
  }

  private getRoleDistribution(employees: Employee[]): { [key in EmployeeRole]: number } {
    const distribution = {
      admin: 0,
      'senior-mechanic': 0,
      'junior-mechanic': 0,
      apprentice: 0,
      'service-advisor': 0
    };

    employees.forEach(emp => {
      distribution[emp.employment.role]++;
    });

    return distribution;
  }
}