import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { EmployeeService } from '../../../core/services/employee.service';
import { Employee, EmployeePerformanceMetrics } from '../../../core/models/employee.model';

@Component({
  selector: 'app-employee-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (employee()) {
      <div class="p-6 max-w-6xl mx-auto space-y-6">
        
        <!-- Header -->
        <div class="flex items-center space-x-2 mb-6">
          <button 
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            (click)="goBack()">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div class="flex-1">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ employee()!.personalInfo.fullName }}
            </h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ employee()!.employeeNumber }} • {{ getRoleLabel(employee()!.employment.role) }}
            </p>
          </div>
          <button 
            class="btn-primary"
            (click)="editEmployee()">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Employee
          </button>
        </div>

        <!-- Overview Cards -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Personal Information -->
          <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h2>
            
            <div class="space-y-3">
              <div class="flex items-center space-x-3 mb-4">
                <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xl">
                  {{ getInitials(employee()!.personalInfo.fullName) }}
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">{{ employee()!.personalInfo.fullName }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ employee()!.employeeNumber }}</p>
                </div>
              </div>
              
              <div class="space-y-2">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">Email:</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ employee()!.personalInfo.email }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">Phone:</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ employee()!.personalInfo.phone }}</span>
                </div>
                @if (employee()!.personalInfo.address) {
                  <div class="flex justify-between">
                    <span class="text-sm text-gray-500 dark:text-gray-400">Address:</span>
                    <span class="text-sm font-medium text-gray-900 dark:text-white text-right">{{ employee()!.personalInfo.address }}</span>
                  </div>
                }
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ getAge(employee()!.personalInfo.dateOfBirth) }} years</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Employment Details -->
          <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Employment Details</h2>
            
            <div class="space-y-3">
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Role:</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ getRoleLabel(employee()!.employment.role) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Department:</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ getDepartmentLabel(employee()!.employment.department) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" [class]="getStatusClasses(employee()!.employment.status)">
                  {{ getStatusLabel(employee()!.employment.status) }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Contract:</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ getContractLabel(employee()!.employment.contractType) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Salary:</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatCurrency(employee()!.employment.salary) }}/month</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Hire Date:</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ employee()!.employment.hireDate | date:'mediumDate' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Years of Service:</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ getYearsOfService(employee()!.employment.hireDate) }} years</span>
              </div>
            </div>
          </div>

          <!-- Availability Status -->
          <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Availability</h2>
            
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                <div class="flex items-center">
                  <div class="w-3 h-3 rounded-full mr-2" [class]="getAvailabilityColor(employee()!.availability.isAvailable)"></div>
                  <span class="text-sm font-medium" [class]="getAvailabilityTextColor(employee()!.availability.isAvailable)">
                    {{ employee()!.availability.isAvailable ? 'Available' : 'Unavailable' }}
                  </span>
                </div>
              </div>
              
              @if (!employee()!.availability.isAvailable && employee()!.availability.unavailableReason) {
                <div>
                  <span class="text-sm text-gray-500 dark:text-gray-400">Reason:</span>
                  <p class="text-sm font-medium text-gray-900 dark:text-white mt-1">{{ employee()!.availability.unavailableReason }}</p>
                  @if (employee()!.availability.unavailableUntil) {
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Until: {{ employee()!.availability.unavailableUntil | date:'short' }}</p>
                  }
                </div>
              }

              <div>
                <div class="flex justify-between text-sm mb-2">
                  <span class="text-gray-500 dark:text-gray-400">Current Workload</span>
                  <span class="font-medium text-gray-900 dark:text-white">{{ employee()!.availability.currentWorkload }}/{{ employee()!.availability.maxWorkload }}</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div class="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all" 
                       [style.width.%]="getWorkloadPercentage()"></div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Skills & Performance -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <!-- Skills & Certifications -->
          <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Skills & Certifications</h2>
            
            <div class="space-y-4">
              <div>
                <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Experience Level</h3>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                  {{ getExperienceLabel(employee()!.skills.experienceLevel) }}
                </span>
              </div>
              
              <div>
                <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Skill Rating</h3>
                <div class="flex items-center space-x-2">
                  <div class="flex text-yellow-400">
                    @for (star of getStarArray(employee()!.skills.skillRating); track $index) {
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    }
                  </div>
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ employee()!.skills.skillRating.toFixed(1) }}/5</span>
                </div>
              </div>
              
              <div>
                <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Specialties</h3>
                <div class="flex flex-wrap gap-2">
                  @for (specialty of employee()!.skills.specialties; track specialty) {
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                      {{ getSpecialtyLabel(specialty) }}
                    </span>
                  }
                </div>
              </div>
              
              @if (employee()!.skills.certifications.length > 0) {
                <div>
                  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Certifications</h3>
                  <div class="space-y-1">
                    @for (cert of employee()!.skills.certifications; track cert) {
                      <div class="flex items-center">
                        <svg class="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span class="text-sm text-gray-900 dark:text-white">{{ cert }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Performance Metrics -->
          <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h2>
            
            <div class="space-y-4">
              <!-- Jobs Completed -->
              <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div class="flex items-center">
                  <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                    <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Jobs Completed</span>
                </div>
                <span class="text-lg font-semibold text-gray-900 dark:text-white">{{ employee()!.performance.completedJobs }}</span>
              </div>

              <!-- Customer Rating -->
              <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div class="flex items-center">
                  <div class="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center mr-3">
                    <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Customer Rating</span>
                </div>
                <span class="text-lg font-semibold text-gray-900 dark:text-white">{{ employee()!.performance.customerRating.toFixed(1) }}/5</span>
              </div>

              <!-- Total Revenue -->
              <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div class="flex items-center">
                  <div class="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                    <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Total Revenue</span>
                </div>
                <span class="text-lg font-semibold text-gray-900 dark:text-white">{{ formatCurrency(employee()!.performance.totalRevenue) }}</span>
              </div>

              <!-- Efficiency Score -->
              <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div class="flex items-center">
                  <div class="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                    <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Efficiency Score</span>
                </div>
                <span class="text-lg font-semibold text-gray-900 dark:text-white">{{ employee()!.performance.efficiencyScore }}%</span>
              </div>

              <!-- Average Job Duration -->
              <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div class="flex items-center">
                  <div class="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                    <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Avg. Job Duration</span>
                </div>
                <span class="text-lg font-semibold text-gray-900 dark:text-white">{{ formatDuration(employee()!.performance.averageJobDuration) }}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Working Schedule -->
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Working Schedule</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-7 gap-4">
            @for (day of getWeekDays(); track day.key) {
              <div class="text-center">
                <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ day.label }}</h3>
                @if (day.schedule.isWorkingDay) {
                  <div class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <p>{{ day.schedule.startTime }} - {{ day.schedule.endTime }}</p>
                    @if (day.schedule.breakStart && day.schedule.breakEnd) {
                      <p class="text-gray-500 dark:text-gray-500">Break: {{ day.schedule.breakStart }} - {{ day.schedule.breakEnd }}</p>
                    }
                  </div>
                } @else {
                  <span class="text-xs text-gray-500 dark:text-gray-500">Off Day</span>
                }
              </div>
            }
          </div>
        </div>

      </div>
    } @else {
      <div class="p-6 text-center">
        <div class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        <p class="mt-2 text-gray-500 dark:text-gray-400">Loading employee details...</p>
      </div>
    }
  `,
  styles: [`
    .btn-primary {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border: 1px solid transparent;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.375rem;
      color: white;
      background-color: #2563eb;
      gap: 0.5rem;
    }
    
    .btn-primary:hover {
      background-color: #1d4ed8;
    }
  `]
})
export class EmployeeDetailsComponent implements OnInit {
  private employeeService = inject(EmployeeService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  employee = signal<Employee | null>(null);
  loading = signal(true);

  ngOnInit() {
    const employeeId = this.route.snapshot.paramMap.get('id');
    if (employeeId) {
      this.loadEmployee(employeeId);
    } else {
      this.router.navigate(['/employees']);
    }
  }

  private loadEmployee(id: string) {
    this.employeeService.getEmployeeById(id).subscribe({
      next: (employee) => {
        this.employee.set(employee);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading employee:', error);
        this.loading.set(false);
        this.router.navigate(['/employees']);
      }
    });
  }

  getInitials(fullName: string): string {
    return fullName.split(' ').map(name => name.charAt(0)).join('').toUpperCase().slice(0, 2);
  }

  getAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  getYearsOfService(hireDate: Date): number {
    const today = new Date();
    const hire = new Date(hireDate);
    const years = today.getFullYear() - hire.getFullYear();
    const monthDiff = today.getMonth() - hire.getMonth();
    return monthDiff < 0 || (monthDiff === 0 && today.getDate() < hire.getDate()) ? years - 1 : years;
  }

  getRoleLabel(role: string): string {
    const labels = {
      'admin': 'Administrator',
      'senior-mechanic': 'Senior Mechanic',
      'junior-mechanic': 'Junior Mechanic',
      'apprentice': 'Apprentice',
      'service-advisor': 'Service Advisor'
    };
    return labels[role as keyof typeof labels] || role;
  }

  getDepartmentLabel(department: string): string {
    const labels = {
      'management': 'Management',
      'mechanical': 'Mechanical',
      'bodywork': 'Bodywork',
      'electrical': 'Electrical',
      'service': 'Service'
    };
    return labels[department as keyof typeof labels] || department;
  }

  getStatusLabel(status: string): string {
    const labels = {
      'active': 'Active',
      'inactive': 'Inactive',
      'on-leave': 'On Leave',
      'terminated': 'Terminated'
    };
    return labels[status as keyof typeof labels] || status;
  }

  getStatusClasses(status: string): string {
    const classes = {
      'active': 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300',
      'inactive': 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
      'on-leave': 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300',
      'terminated': 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
    };
    return classes[status as keyof typeof classes] || classes.inactive;
  }

  getContractLabel(contractType: string): string {
    const labels = {
      'full-time': 'Full Time',
      'part-time': 'Part Time',
      'contract': 'Contract',
      'apprentice': 'Apprentice'
    };
    return labels[contractType as keyof typeof labels] || contractType;
  }

  getExperienceLabel(level: string): string {
    const labels = {
      'entry': 'Entry Level',
      'junior': 'Junior',
      'mid': 'Mid Level',
      'senior': 'Senior',
      'expert': 'Expert'
    };
    return labels[level as keyof typeof labels] || level;
  }

  getSpecialtyLabel(specialty: string): string {
    const labels = {
      'oil-change': 'Oil Change',
      'inspection': 'Vehicle Inspection',
      'engine': 'Engine Repair',
      'transmission': 'Transmission',
      'brake-repair': 'Brake Repair',
      'electrical': 'Electrical Systems',
      'bodywork': 'Bodywork',
      'painting': 'Painting',
      'tires': 'Tire Service',
      'air-conditioning': 'Air Conditioning',
      'suspension': 'Suspension',
      'diagnostics': 'Vehicle Diagnostics'
    };
    return labels[specialty as keyof typeof labels] || specialty;
  }

  getAvailabilityColor(isAvailable: boolean): string {
    return isAvailable ? 'bg-green-500' : 'bg-red-500';
  }

  getAvailabilityTextColor(isAvailable: boolean): string {
    return isAvailable ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300';
  }

  getWorkloadPercentage(): number {
    const emp = this.employee();
    if (!emp || emp.availability.maxWorkload === 0) return 0;
    return Math.round((emp.availability.currentWorkload / emp.availability.maxWorkload) * 100);
  }

  getStarArray(rating: number): number[] {
    return Array(Math.floor(rating)).fill(0);
  }

  getWeekDays() {
    const emp = this.employee();
    if (!emp) return [];

    return [
      { key: 'monday', label: 'Mon', schedule: emp.employment.workingHours.monday },
      { key: 'tuesday', label: 'Tue', schedule: emp.employment.workingHours.tuesday },
      { key: 'wednesday', label: 'Wed', schedule: emp.employment.workingHours.wednesday },
      { key: 'thursday', label: 'Thu', schedule: emp.employment.workingHours.thursday },
      { key: 'friday', label: 'Fri', schedule: emp.employment.workingHours.friday },
      { key: 'saturday', label: 'Sat', schedule: emp.employment.workingHours.saturday },
      { key: 'sunday', label: 'Sun', schedule: emp.employment.workingHours.sunday }
    ];
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  }

  editEmployee() {
    this.router.navigate(['/employees/edit', this.employee()?.id]);
  }

  goBack() {
    this.router.navigate(['/employees']);
  }
}