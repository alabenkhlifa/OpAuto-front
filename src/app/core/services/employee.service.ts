import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Employee, EmployeeFilters, EmployeeStats, EmployeePerformanceMetrics, EmployeeRole, EmployeeDepartment, EmployeeStatus, WorkingSchedule } from '../models/employee.model';
import { fromBackendEnum, toBackendEnum } from '../utils/enum-mapper';

// Backend role → frontend role
const ROLE_FROM_BACKEND: Record<string, EmployeeRole> = {
  'MECHANIC': 'mechanic',
  'ELECTRICIAN': 'electrician',
  'BODYWORK_SPECIALIST': 'bodywork-specialist',
  'TIRE_SPECIALIST': 'tire-specialist',
  'MANAGER': 'manager',
  'APPRENTICE': 'apprentice',
  'RECEPTIONIST': 'receptionist',
};

// Frontend role → backend role
const ROLE_TO_BACKEND: Record<EmployeeRole, string> = {
  'admin': 'MANAGER',
  'manager': 'MANAGER',
  'senior-mechanic': 'MECHANIC',
  'junior-mechanic': 'MECHANIC',
  'mechanic': 'MECHANIC',
  'electrician': 'ELECTRICIAN',
  'bodywork-specialist': 'BODYWORK_SPECIALIST',
  'tire-specialist': 'TIRE_SPECIALIST',
  'apprentice': 'APPRENTICE',
  'receptionist': 'RECEPTIONIST',
  'service-advisor': 'RECEPTIONIST',
};

function mapBackendRole(backendRole: string): EmployeeRole {
  return ROLE_FROM_BACKEND[backendRole] || 'mechanic';
}

function defaultWorkingHours(): WorkingSchedule {
  const workDay = { isWorkingDay: true, startTime: '08:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' };
  const offDay = { isWorkingDay: false, startTime: '', endTime: '' };
  return {
    monday: { ...workDay },
    tuesday: { ...workDay },
    wednesday: { ...workDay },
    thursday: { ...workDay },
    friday: { ...workDay },
    saturday: { ...offDay },
    sunday: { ...offDay },
  };
}

function mapFromBackend(b: any): Employee {
  return {
    id: b.id,
    employeeNumber: b.employeeNumber || `EMP${String(b.id).padStart(3, '0')}`,
    personalInfo: {
      firstName: b.firstName,
      lastName: b.lastName,
      fullName: b.firstName + ' ' + b.lastName,
      phone: b.phone || '',
      email: b.email || '',
      address: b.address || '',
      dateOfBirth: b.dateOfBirth ? new Date(b.dateOfBirth) : new Date(),
    },
    employment: {
      role: mapBackendRole(b.role),
      department: fromBackendEnum(b.department) as EmployeeDepartment,
      status: fromBackendEnum(b.status) as EmployeeStatus,
      salary: (b.hourlyRate || 0) * 160,
      hireDate: new Date(b.hireDate),
      contractType: 'full-time',
      workingHours: defaultWorkingHours(),
    },
    skills: {
      specialties: b.skills || [],
      experienceLevel: 'mid',
      skillRating: 0,
      certifications: [],
    },
    availability: {
      isAvailable: b.status === 'ACTIVE',
      currentWorkload: 0,
      maxWorkload: 4,
    },
    performance: {
      completedJobs: 0,
      averageJobDuration: 0,
      customerRating: 0,
      totalRevenue: 0,
      efficiencyScore: 0,
    },
    createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
    updatedAt: b.updatedAt ? new Date(b.updatedAt) : new Date(),
  };
}

function mapToBackend(f: Partial<Employee>): any {
  const payload: any = {};

  if (f.personalInfo) {
    if (f.personalInfo.firstName) payload.firstName = f.personalInfo.firstName;
    if (f.personalInfo.lastName) payload.lastName = f.personalInfo.lastName;
    if (f.personalInfo.email) payload.email = f.personalInfo.email;
    if (f.personalInfo.phone) payload.phone = f.personalInfo.phone;
  }

  if (f.employment) {
    if (f.employment.role) payload.role = ROLE_TO_BACKEND[f.employment.role] || 'MECHANIC';
    if (f.employment.department) payload.department = toBackendEnum(f.employment.department);
    if (f.employment.status) payload.status = toBackendEnum(f.employment.status);
    if (f.employment.salary != null) payload.hourlyRate = f.employment.salary / 160;
    if (f.employment.hireDate) payload.hireDate = f.employment.hireDate;
  }

  if (f.skills?.specialties) {
    payload.skills = f.skills.specialties;
  }

  return payload;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private http = inject(HttpClient);

  private employeesSubject = new BehaviorSubject<Employee[]>([]);
  public employees$ = this.employeesSubject.asObservable();

  getEmployees(filters?: EmployeeFilters): Observable<Employee[]> {
    return this.http.get<any[]>('/employees').pipe(
      map((items: any[]) => items.map(mapFromBackend)),
      tap(employees => this.employeesSubject.next(employees)),
      map((employees: Employee[]) => this.applyFilters(employees, filters))
    );
  }

  getEmployeeById(id: string): Observable<Employee | null> {
    return this.http.get<any>(`/employees/${id}`).pipe(
      map((b: any) => b ? mapFromBackend(b) : null)
    );
  }

  createEmployee(employee: Partial<Employee>): Observable<Employee> {
    const payload = mapToBackend(employee);
    return this.http.post<any>('/employees', payload).pipe(
      map((b: any) => mapFromBackend(b)),
      tap((created: Employee) => {
        const current = this.employeesSubject.value;
        this.employeesSubject.next([...current, created]);
      })
    );
  }

  updateEmployee(id: string, updates: Partial<Employee>): Observable<Employee> {
    const payload = mapToBackend(updates);
    return this.http.put<any>(`/employees/${id}`, payload).pipe(
      map((b: any) => mapFromBackend(b)),
      tap((updated: Employee) => {
        const current = this.employeesSubject.value;
        const idx = current.findIndex(e => e.id === id);
        if (idx !== -1) {
          const next = [...current];
          next[idx] = updated;
          this.employeesSubject.next(next);
        }
      })
    );
  }

  deleteEmployee(id: string): Observable<boolean> {
    return this.http.delete<void>(`/employees/${id}`).pipe(
      tap(() => {
        const current = this.employeesSubject.value;
        this.employeesSubject.next(current.filter(e => e.id !== id));
      }),
      map(() => true)
    );
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
      })
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
      })
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
      ))
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
    const distribution: { [key in EmployeeDepartment]: number } = {
      management: 0,
      mechanical: 0,
      bodywork: 0,
      electrical: 0,
      service: 0,
      'tire-alignment': 0,
    };

    employees.forEach(emp => {
      distribution[emp.employment.department]++;
    });

    return distribution;
  }

  private getRoleDistribution(employees: Employee[]): { [key in EmployeeRole]: number } {
    const distribution: { [key in EmployeeRole]: number } = {
      admin: 0,
      manager: 0,
      'senior-mechanic': 0,
      'junior-mechanic': 0,
      mechanic: 0,
      electrician: 0,
      'bodywork-specialist': 0,
      'tire-specialist': 0,
      apprentice: 0,
      receptionist: 0,
      'service-advisor': 0,
    };

    employees.forEach(emp => {
      distribution[emp.employment.role]++;
    });

    return distribution;
  }
}
