import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { EmployeeService } from '../../core/services/employee.service';
import { Employee, EmployeeFilters, EmployeeStats } from '../../core/models/employee.model';
import { EmployeeCardComponent } from './components/employee-card.component';
import { EmployeeStatsComponent } from './components/employee-stats.component';
import { EmployeeFiltersComponent } from './components/employee-filters.component';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule,
    TranslatePipe,
    EmployeeCardComponent,
    EmployeeStatsComponent,
    EmployeeFiltersComponent
  ],
  template: `
    <div class="p-6 space-y-6">
      
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">
            {{ 'employees.title' | translate }}
          </h1>
          <p class="mt-1 text-sm text-gray-300">
            {{ 'employees.subtitle' | translate }}
          </p>
        </div>
        <div class="mt-4 sm:mt-0 flex space-x-3">
          <button 
            class="btn-filter-toggle"
            [class.active]="showFilters()"
            (click)="showFilters.set(!showFilters())">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span class="hidden sm:inline">{{ 'employees.filters.title' | translate }}</span>
          </button>
          <button 
            class="btn-primary"
            (click)="createNewEmployee()">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span class="hidden sm:inline">{{ 'employees.addEmployee' | translate }}</span>
          </button>
        </div>
      </div>

      <!-- Stats Overview -->
      <app-employee-stats [stats]="stats()"></app-employee-stats>

      <!-- Filters -->
      <app-employee-filters
        *ngIf="showFilters()"
        [filters]="filters()"
        (filtersChange)="onFiltersChange($event)">
      </app-employee-filters>

      <!-- Employees List -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-white">
            {{ 'employees.employeesCount' | translate: {count: filteredEmployees().length} }}
          </h2>
          
          <!-- View Toggle -->
          <div class="flex bg-gray-800/30 rounded-lg p-1">
            @for (view of viewOptions; track view.value) {
              <button
                class="px-3 py-1 text-sm font-medium rounded-md transition-colors"
                [class]="currentView() === view.value ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'"
                (click)="setView(view.value)">
                {{ 'employees.' + view.value | translate }}
              </button>
            }
          </div>
        </div>

        <!-- No Employees Message -->
        @if (filteredEmployees().length === 0) {
          <div class="text-center py-12">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-white">{{ 'employees.noEmployeesFound' | translate }}</h3>
            <p class="mt-1 text-sm text-gray-400">{{ 'employees.noEmployeesDescription' | translate }}</p>
            <div class="mt-6">
              <button class="btn-primary" (click)="createNewEmployee()">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                {{ 'employees.addEmployee' | translate }}
              </button>
            </div>
          </div>
        } @else {
          <!-- Employees Grid -->
          <div class="grid gap-4" [class]="currentView() === 'grid' ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'">
            @for (employee of filteredEmployees(); track employee.id) {
              <app-employee-card
                [employee]="employee"
                [view]="currentView()"
                (edit)="editEmployee($event)"
                (viewDetails)="viewEmployee($event)"
                (toggleAvailability)="toggleEmployeeAvailability($event)">
              </app-employee-card>
            }
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    /* Component uses global button classes from /src/styles/buttons.css */
  `]
})
export class EmployeesComponent implements OnInit {
  private employeeService = inject(EmployeeService);
  private router = inject(Router);

  // Signals
  employees = signal<Employee[]>([]);
  stats = signal<EmployeeStats | null>(null);
  filters = signal<EmployeeFilters>({});
  showFilters = signal(false);
  currentView = signal<'list' | 'grid'>('grid');
  loading = signal(false);

  // View options
  viewOptions = [
    { value: 'grid' as const, label: 'Grid' },
    { value: 'list' as const, label: 'List' }
  ];

  // Computed
  filteredEmployees = computed(() => {
    const employees = this.employees();
    const filterConfig = this.filters();
    return this.applyFilters(employees, filterConfig);
  });

  ngOnInit() {
    this.loadEmployees();
    this.loadStats();
  }

  private loadEmployees() {
    this.loading.set(true);
    this.employeeService.getEmployees(this.filters()).subscribe({
      next: (employees) => {
        this.employees.set(employees);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading employees:', error);
        this.loading.set(false);
      }
    });
  }

  private loadStats() {
    this.employeeService.getEmployeeStats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: (error) => console.error('Error loading stats:', error)
    });
  }

  private applyFilters(employees: Employee[], filters: EmployeeFilters): Employee[] {
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

  setView(view: 'list' | 'grid') {
    this.currentView.set(view);
  }

  onFiltersChange(newFilters: EmployeeFilters) {
    this.filters.set(newFilters);
    this.loadEmployees();
  }

  createNewEmployee() {
    this.router.navigate(['/employees/new']);
  }

  editEmployee(employeeId: string) {
    this.router.navigate(['/employees/edit', employeeId]);
  }

  viewEmployee(employeeId: string) {
    this.router.navigate(['/employees/details', employeeId]);
  }

  toggleEmployeeAvailability(event: { employeeId: string; isAvailable: boolean; reason?: string }) {
    this.employeeService.updateEmployeeAvailability(
      event.employeeId, 
      event.isAvailable, 
      event.reason
    ).subscribe({
      next: () => this.loadEmployees(),
      error: (error) => console.error('Error updating availability:', error)
    });
  }
}