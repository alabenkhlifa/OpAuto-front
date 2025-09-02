import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { EmployeeService } from '../../../core/services/employee.service';
import { Employee, EmployeeRole, EmployeeDepartment, EmployeeStatus, ContractType, ExperienceLevel } from '../../../core/models/employee.model';

@Component({
  selector: 'app-employee-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center space-x-2 mb-2">
          <button 
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            (click)="goBack()">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ isEditMode ? 'Edit Employee' : 'Add New Employee' }}
          </h1>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ isEditMode ? 'Update employee information and settings' : 'Enter employee details and work configuration' }}
        </p>
      </div>

      <!-- Form -->
      <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700">
        <form [formGroup]="employeeForm" (ngSubmit)="onSubmit()">
          
          <!-- Personal Information -->
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">First Name *</label>
                <input 
                  type="text" 
                  class="form-input"
                  formControlName="firstName"
                  [class.border-red-500]="isFieldInvalid('firstName')">
                @if (isFieldInvalid('firstName')) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">First name is required</p>
                }
              </div>
              
              <div>
                <label class="form-label">Last Name *</label>
                <input 
                  type="text" 
                  class="form-input"
                  formControlName="lastName"
                  [class.border-red-500]="isFieldInvalid('lastName')">
                @if (isFieldInvalid('lastName')) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Last name is required</p>
                }
              </div>
              
              <div>
                <label class="form-label">Phone *</label>
                <input 
                  type="tel" 
                  class="form-input"
                  formControlName="phone"
                  placeholder="+216 20 123 456"
                  [class.border-red-500]="isFieldInvalid('phone')">
                @if (isFieldInvalid('phone')) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Phone number is required</p>
                }
              </div>
              
              <div>
                <label class="form-label">Email *</label>
                <input 
                  type="email" 
                  class="form-input"
                  formControlName="email"
                  placeholder="employee@opauto.tn"
                  [class.border-red-500]="isFieldInvalid('email')">
                @if (isFieldInvalid('email')) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Valid email is required</p>
                }
              </div>
              
              <div class="md:col-span-2">
                <label class="form-label">Address</label>
                <input 
                  type="text" 
                  class="form-input"
                  formControlName="address"
                  placeholder="Street address, city">
              </div>
              
              <div>
                <label class="form-label">Date of Birth</label>
                <input 
                  type="date" 
                  class="form-input"
                  formControlName="dateOfBirth">
              </div>
            </div>
          </div>

          <!-- Employment Information -->
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Employment Details</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">Role *</label>
                <select 
                  class="form-select"
                  formControlName="role"
                  [class.border-red-500]="isFieldInvalid('role')">
                  <option value="">Select role</option>
                  @for (role of roleOptions; track role.value) {
                    <option [value]="role.value">{{ role.label }}</option>
                  }
                </select>
                @if (isFieldInvalid('role')) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Role is required</p>
                }
              </div>
              
              <div>
                <label class="form-label">Department *</label>
                <select 
                  class="form-select"
                  formControlName="department"
                  [class.border-red-500]="isFieldInvalid('department')">
                  <option value="">Select department</option>
                  @for (dept of departmentOptions; track dept.value) {
                    <option [value]="dept.value">{{ dept.label }}</option>
                  }
                </select>
                @if (isFieldInvalid('department')) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Department is required</p>
                }
              </div>
              
              <div>
                <label class="form-label">Contract Type *</label>
                <select 
                  class="form-select"
                  formControlName="contractType"
                  [class.border-red-500]="isFieldInvalid('contractType')">
                  <option value="">Select type</option>
                  @for (contract of contractOptions; track contract.value) {
                    <option [value]="contract.value">{{ contract.label }}</option>
                  }
                </select>
                @if (isFieldInvalid('contractType')) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Contract type is required</p>
                }
              </div>
              
              <div>
                <label class="form-label">Monthly Salary (TND) *</label>
                <input 
                  type="number" 
                  class="form-input"
                  formControlName="salary"
                  min="0"
                  step="50"
                  [class.border-red-500]="isFieldInvalid('salary')">
                @if (isFieldInvalid('salary')) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Salary is required</p>
                }
              </div>
              
              <div>
                <label class="form-label">Hire Date *</label>
                <input 
                  type="date" 
                  class="form-input"
                  formControlName="hireDate"
                  [class.border-red-500]="isFieldInvalid('hireDate')">
                @if (isFieldInvalid('hireDate')) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Hire date is required</p>
                }
              </div>
              
              <div>
                <label class="form-label">Status *</label>
                <select 
                  class="form-select"
                  formControlName="status"
                  [class.border-red-500]="isFieldInvalid('status')">
                  <option value="">Select status</option>
                  @for (status of statusOptions; track status.value) {
                    <option [value]="status.value">{{ status.label }}</option>
                  }
                </select>
                @if (isFieldInvalid('status')) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Status is required</p>
                }
              </div>
            </div>
          </div>

          <!-- Skills & Experience -->
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Skills & Experience</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">Experience Level *</label>
                <select 
                  class="form-select"
                  formControlName="experienceLevel"
                  [class.border-red-500]="isFieldInvalid('experienceLevel')">
                  <option value="">Select level</option>
                  @for (level of experienceOptions; track level.value) {
                    <option [value]="level.value">{{ level.label }}</option>
                  }
                </select>
                @if (isFieldInvalid('experienceLevel')) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Experience level is required</p>
                }
              </div>
              
              <div>
                <label class="form-label">Skill Rating (1-5)</label>
                <input 
                  type="number" 
                  class="form-input"
                  formControlName="skillRating"
                  min="1"
                  max="5"
                  step="0.1">
              </div>
              
              <div class="md:col-span-2">
                <label class="form-label">Specialties</label>
                <div class="space-y-2">
                  @for (specialty of specialtyOptions; track specialty.value) {
                    <label class="flex items-center">
                      <input 
                        type="checkbox" 
                        class="form-checkbox"
                        [value]="specialty.value"
                        (change)="onSpecialtyChange(specialty.value, $event)">
                      <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{{ specialty.label }}</span>
                    </label>
                  }
                </div>
              </div>
              
              <div class="md:col-span-2">
                <label class="form-label">Certifications (one per line)</label>
                <textarea 
                  class="form-textarea"
                  formControlName="certifications"
                  rows="3"
                  placeholder="Enter each certification on a new line">
                </textarea>
              </div>
            </div>
          </div>

          <!-- Availability -->
          <div class="p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Availability Settings</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">Maximum Workload</label>
                <input 
                  type="number" 
                  class="form-input"
                  formControlName="maxWorkload"
                  min="1"
                  max="10">
              </div>
              
              <div>
                <label class="flex items-center">
                  <input 
                    type="checkbox" 
                    class="form-checkbox"
                    formControlName="isAvailable">
                  <span class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Currently Available</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl flex justify-end space-x-3">
            <button 
              type="button"
              class="btn-secondary"
              (click)="goBack()">
              Cancel
            </button>
            <button 
              type="submit"
              class="btn-primary"
              [disabled]="employeeForm.invalid || isSubmitting()">
              @if (isSubmitting()) {
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ isEditMode ? 'Updating...' : 'Creating...' }}
              } @else {
                {{ isEditMode ? 'Update Employee' : 'Create Employee' }}
              }
            </button>
          </div>

        </form>
      </div>

    </div>
  `,
  styles: [`
    .form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      margin-bottom: 0.25rem;
    }
    
    .dark .form-label {
      color: #d1d5db;
    }
    
    .form-input, .form-select, .form-textarea {
      display: block;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      background-color: white;
      color: #111827;
      font-size: 0.875rem;
    }
    
    .form-input:focus, .form-select:focus, .form-textarea:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    
    .form-checkbox {
      width: 1rem;
      height: 1rem;
      color: #2563eb;
      border-radius: 0.25rem;
      border: 1px solid #d1d5db;
    }
    
    .dark .form-input, .dark .form-select, .dark .form-textarea {
      background-color: #1f2937;
      border-color: #4b5563;
      color: #f9fafb;
    }
    
    .dark .form-input:focus, .dark .form-select:focus, .dark .form-textarea:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .dark .form-checkbox {
      background-color: #1f2937;
      border-color: #4b5563;
    }
    
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
    
    .btn-primary:hover:not(:disabled) {
      background-color: #1d4ed8;
    }
    
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border: 1px solid #d1d5db;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.375rem;
      color: #374151;
      background-color: white;
    }
    
    .btn-secondary:hover {
      background-color: #f9fafb;
    }
    
    .dark .btn-secondary {
      border-color: #4b5563;
      color: #d1d5db;
      background-color: #1f2937;
    }
    
    .dark .btn-secondary:hover {
      background-color: #374151;
    }
  `]
})
export class EmployeeFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private employeeService = inject(EmployeeService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  employeeForm!: FormGroup;
  isSubmitting = signal(false);
  isEditMode = false;
  employeeId: string | null = null;

  roleOptions = [
    { value: 'admin', label: 'Administrator' },
    { value: 'senior-mechanic', label: 'Senior Mechanic' },
    { value: 'junior-mechanic', label: 'Junior Mechanic' },
    { value: 'apprentice', label: 'Apprentice' },
    { value: 'service-advisor', label: 'Service Advisor' }
  ];

  departmentOptions = [
    { value: 'management', label: 'Management' },
    { value: 'mechanical', label: 'Mechanical' },
    { value: 'bodywork', label: 'Bodywork' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'service', label: 'Service' }
  ];

  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'on-leave', label: 'On Leave' }
  ];

  contractOptions = [
    { value: 'full-time', label: 'Full Time' },
    { value: 'part-time', label: 'Part Time' },
    { value: 'contract', label: 'Contract' },
    { value: 'apprentice', label: 'Apprentice' }
  ];

  experienceOptions = [
    { value: 'entry', label: 'Entry Level' },
    { value: 'junior', label: 'Junior' },
    { value: 'mid', label: 'Mid Level' },
    { value: 'senior', label: 'Senior' },
    { value: 'expert', label: 'Expert' }
  ];

  specialtyOptions = [
    { value: 'oil-change', label: 'Oil Change' },
    { value: 'inspection', label: 'Vehicle Inspection' },
    { value: 'engine', label: 'Engine Repair' },
    { value: 'transmission', label: 'Transmission' },
    { value: 'brake-repair', label: 'Brake Repair' },
    { value: 'electrical', label: 'Electrical Systems' },
    { value: 'bodywork', label: 'Bodywork' },
    { value: 'painting', label: 'Painting' },
    { value: 'tires', label: 'Tire Service' },
    { value: 'air-conditioning', label: 'Air Conditioning' },
    { value: 'suspension', label: 'Suspension' },
    { value: 'diagnostics', label: 'Vehicle Diagnostics' }
  ];

  selectedSpecialties = signal<string[]>([]);

  ngOnInit() {
    this.initializeForm();
    this.checkEditMode();
  }

  private initializeForm() {
    this.employeeForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s-()]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      address: [''],
      dateOfBirth: [''],
      role: ['', Validators.required],
      department: ['', Validators.required],
      contractType: ['', Validators.required],
      salary: [0, [Validators.required, Validators.min(0)]],
      hireDate: ['', Validators.required],
      status: ['active', Validators.required],
      experienceLevel: ['junior', Validators.required],
      skillRating: [3.0, [Validators.min(1), Validators.max(5)]],
      certifications: [''],
      maxWorkload: [3, [Validators.min(1), Validators.max(10)]],
      isAvailable: [true]
    });
  }

  private checkEditMode() {
    this.employeeId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.employeeId;

    if (this.isEditMode && this.employeeId) {
      this.loadEmployee(this.employeeId);
    }
  }

  private loadEmployee(id: string) {
    this.employeeService.getEmployeeById(id).subscribe({
      next: (employee) => {
        if (employee) {
          this.populateForm(employee);
        }
      },
      error: (error) => {
        console.error('Error loading employee:', error);
        this.router.navigate(['/employees']);
      }
    });
  }

  private populateForm(employee: Employee) {
    this.employeeForm.patchValue({
      firstName: employee.personalInfo.firstName,
      lastName: employee.personalInfo.lastName,
      phone: employee.personalInfo.phone,
      email: employee.personalInfo.email,
      address: employee.personalInfo.address,
      dateOfBirth: employee.personalInfo.dateOfBirth?.toISOString().split('T')[0],
      role: employee.employment.role,
      department: employee.employment.department,
      contractType: employee.employment.contractType,
      salary: employee.employment.salary,
      hireDate: employee.employment.hireDate.toISOString().split('T')[0],
      status: employee.employment.status,
      experienceLevel: employee.skills.experienceLevel,
      skillRating: employee.skills.skillRating,
      certifications: employee.skills.certifications.join('\n'),
      maxWorkload: employee.availability.maxWorkload,
      isAvailable: employee.availability.isAvailable
    });

    this.selectedSpecialties.set([...employee.skills.specialties]);
  }

  onSpecialtyChange(specialty: string, event: any) {
    const isChecked = event.target.checked;
    const current = this.selectedSpecialties();

    if (isChecked) {
      this.selectedSpecialties.set([...current, specialty]);
    } else {
      this.selectedSpecialties.set(current.filter(s => s !== specialty));
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.employeeForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSubmit() {
    if (this.employeeForm.valid) {
      this.isSubmitting.set(true);
      const formValue = this.employeeForm.value;

      const employeeData: Partial<Employee> = {
        personalInfo: {
          firstName: formValue.firstName,
          lastName: formValue.lastName,
          fullName: `${formValue.firstName} ${formValue.lastName}`,
          phone: formValue.phone,
          email: formValue.email,
          address: formValue.address || '',
          dateOfBirth: formValue.dateOfBirth ? new Date(formValue.dateOfBirth) : new Date()
        },
        employment: {
          hireDate: new Date(formValue.hireDate),
          role: formValue.role,
          department: formValue.department,
          status: formValue.status,
          salary: formValue.salary,
          contractType: formValue.contractType,
          workingHours: this.getDefaultWorkingHours()
        },
        skills: {
          specialties: this.selectedSpecialties(),
          certifications: formValue.certifications ? formValue.certifications.split('\n').filter((cert: string) => cert.trim()) : [],
          experienceLevel: formValue.experienceLevel,
          skillRating: formValue.skillRating || 3.0
        },
        availability: {
          isAvailable: formValue.isAvailable,
          currentWorkload: 0,
          maxWorkload: formValue.maxWorkload
        },
        performance: {
          completedJobs: 0,
          averageJobDuration: 0,
          customerRating: 0,
          totalRevenue: 0,
          efficiencyScore: 0
        }
      };

      const operation = this.isEditMode 
        ? this.employeeService.updateEmployee(this.employeeId!, employeeData)
        : this.employeeService.createEmployee(employeeData);

      operation.subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.router.navigate(['/employees']);
        },
        error: (error) => {
          console.error('Error saving employee:', error);
          this.isSubmitting.set(false);
        }
      });
    }
  }

  private getDefaultWorkingHours() {
    const defaultDay = { isWorkingDay: true, startTime: '08:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' };
    const weekend = { isWorkingDay: false, startTime: '', endTime: '' };
    
    return {
      monday: defaultDay,
      tuesday: defaultDay,
      wednesday: defaultDay,
      thursday: defaultDay,
      friday: defaultDay,
      saturday: { ...defaultDay, endTime: '14:00' },
      sunday: weekend
    };
  }

  goBack() {
    this.router.navigate(['/employees']);
  }
}