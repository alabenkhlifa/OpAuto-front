import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { CarService } from '../../cars/services/car.service';
import { MaintenanceJob, MaintenanceTask, ServiceType } from '../../../core/models/maintenance.model';
import { Car } from '../../../core/models/appointment.model';

@Component({
  selector: 'app-maintenance-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      
      <!-- Header -->
      <div class="glass-card mb-6">
        <div class="flex items-start space-x-6">
          <button 
            class="p-3 text-gray-400 hover:text-white transition-colors bg-gray-800/50 rounded-lg hover:bg-gray-700/50"
            (click)="goBack()">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div class="flex-1">
            <h1 class="text-3xl lg:text-4xl font-bold text-white mb-2">
              {{ isEditMode() ? 'Edit Maintenance Job' : 'New Maintenance Job' }}
            </h1>
            <div class="bg-gray-800/30 rounded-lg p-4 backdrop-filter backdrop-blur-sm">
              <div class="flex items-center space-x-3">
                <svg class="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <p class="text-lg font-medium text-blue-300">
                  {{ isEditMode() ? 'Update job details and tasks' : 'Create a new maintenance or repair job' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Form -->
      <form [formGroup]="maintenanceForm" (ngSubmit)="onSubmit()" class="space-y-6">
        
        <!-- Basic Information -->
        <div class="glass-card">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <!-- Car Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">
                Vehicle *
              </label>
              <select 
                formControlName="carId"
                class="form-select"
                [class.border-red-500]="isFieldInvalid('carId')">
                <option value="">Select a vehicle</option>
                @for (car of cars(); track car.id) {
                  <option [value]="car.id">{{ car.licensePlate }} - {{ car.make }} {{ car.model }}</option>
                }
              </select>
              @if (isFieldInvalid('carId')) {
                <p class="mt-1 text-sm text-red-400">Vehicle is required</p>
              }
            </div>

            <!-- Mechanic Assignment -->
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">
                Assigned Mechanic *
              </label>
              <select 
                formControlName="mechanicId"
                class="form-select"
                [class.border-red-500]="isFieldInvalid('mechanicId')">
                <option value="">Select a mechanic</option>
                @for (mechanic of mechanics; track mechanic.id) {
                  <option [value]="mechanic.id">{{ mechanic.name }}</option>
                }
              </select>
              @if (isFieldInvalid('mechanicId')) {
                <p class="mt-1 text-sm text-red-400">Mechanic is required</p>
              }
            </div>

            <!-- Job Title -->
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">
                Job Title *
              </label>
              <input 
                type="text"
                formControlName="jobTitle"
                placeholder="e.g., Brake Repair, Oil Change"
                class="form-input"
                [class.border-red-500]="isFieldInvalid('jobTitle')">
              @if (isFieldInvalid('jobTitle')) {
                <p class="mt-1 text-sm text-red-400">Job title is required</p>
              }
            </div>

            <!-- Priority -->
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">
                Priority *
              </label>
              <select 
                formControlName="priority"
                class="form-select"
                [class.border-red-500]="isFieldInvalid('priority')">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <!-- Current Mileage -->
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">
                Current Mileage (km) *
              </label>
              <input 
                type="number"
                formControlName="currentMileage"
                placeholder="85000"
                min="0"
                max="999999"
                class="form-input"
                [class.border-red-500]="isFieldInvalid('currentMileage')">
              @if (isFieldInvalid('currentMileage')) {
                <p class="mt-1 text-sm text-red-400">Valid mileage is required</p>
              }
            </div>

            <!-- Estimated Cost -->
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">
                Estimated Cost (TND)
              </label>
              <input 
                type="number"
                formControlName="estimatedCost"
                placeholder="150"
                min="0"
                step="0.01"
                class="form-input">
            </div>

          </div>

          <!-- Description -->
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-300 mb-1">
              Description *
            </label>
            <textarea 
              formControlName="description"
              rows="3"
              placeholder="Describe the issue, symptoms, or maintenance required..."
              class="form-textarea"
              [class.border-red-500]="isFieldInvalid('description')">
            </textarea>
            @if (isFieldInvalid('description')) {
              <p class="mt-1 text-sm text-red-400">Description is required</p>
            }
          </div>

          <!-- Notes -->
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-300 mb-1">
              Additional Notes
            </label>
            <textarea 
              formControlName="notes"
              rows="2"
              placeholder="Any additional information or special instructions..."
              class="form-textarea">
            </textarea>
          </div>

        </div>

        <!-- Tasks -->
        <div class="glass-card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Tasks</h2>
            <button 
              type="button"
              class="btn-secondary text-sm"
              (click)="addTask()">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Task
            </button>
          </div>

          <div formArrayName="tasks" class="space-y-4">
            @for (task of tasks.controls; track $index; let i = $index) {
              <div [formGroupName]="i" class="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">
                      Task Name *
                    </label>
                    <input 
                      type="text"
                      formControlName="name"
                      placeholder="e.g., Replace brake pads"
                      class="form-input text-sm">
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">
                      Estimated Time (min)
                    </label>
                    <input 
                      type="number"
                      formControlName="estimatedTime"
                      placeholder="60"
                      min="5"
                      max="480"
                      class="form-input text-sm">
                  </div>

                  <div class="flex items-end">
                    <button 
                      type="button"
                      class="w-full btn-danger text-sm py-2"
                      (click)="removeTask(i)">
                      Remove
                    </button>
                  </div>

                </div>

                <div class="mt-3">
                  <label class="block text-sm font-medium text-gray-300 mb-1">
                    Task Description
                  </label>
                  <textarea 
                    formControlName="description"
                    rows="2"
                    placeholder="Detailed description of what needs to be done..."
                    class="form-textarea text-sm">
                  </textarea>
                </div>
              </div>
            }
          </div>

          @if (tasks.length === 0) {
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
              <p class="text-sm">No tasks added yet. Click "Add Task" to get started.</p>
            </div>
          }

        </div>

        <!-- Form Actions -->
        <div class="flex items-center justify-end space-x-4 pt-6">
          <button 
            type="button"
            class="btn-secondary"
            (click)="goBack()">
            Cancel
          </button>
          <button 
            type="submit"
            class="btn-primary"
            [disabled]="maintenanceForm.invalid || isSubmitting()">
            @if (isSubmitting()) {
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            } @else {
              {{ isEditMode() ? 'Update Job' : 'Create Job' }}
            }
          </button>
        </div>

      </form>

    </div>
  `,
  styles: [`
    /* Dark glassmorphism card styling */
    .glass-card {
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(75, 85, 99, 0.6);
      border-radius: 20px;
      padding: 1.5rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      margin-bottom: 1rem;
    }

    .glass-card:hover {
      background: rgba(31, 41, 55, 0.98);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8);
      border-color: rgba(59, 130, 246, 0.7);
      transform: translateY(-2px);
    }

    /* Button styling to match other screens */
    .btn-primary {
      background: linear-gradient(135deg, #059669, #047857);
      border: 1px solid #059669;
      color: white !important;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(20px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(5, 150, 105, 0.3);
    }

    .btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #047857, #065f46);
      box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4);
      transform: translateY(-1px);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    
    .btn-secondary {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(29, 78, 216, 0.8));
      border: 1px solid rgba(59, 130, 246, 0.6);
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(20px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    }

    .btn-secondary:hover {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(29, 78, 216, 0.9));
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
      transform: translateY(-1px);
    }
    
    .btn-danger {
      background: linear-gradient(135deg, #dc2626, #991b1b);
      border: 1px solid #dc2626;
      color: white !important;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 600;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(20px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(220, 38, 38, 0.3);
    }

    .btn-danger:hover {
      background: linear-gradient(135deg, #991b1b, #7f1d1d);
      box-shadow: 0 6px 20px rgba(220, 38, 38, 0.4);
      transform: translateY(-1px);
    }

    /* Fix text colors for permanent dark theme */
    .glass-card h2,
    .glass-card .text-gray-900 {
      color: #ffffff !important;
    }

    .glass-card .text-gray-500,
    .glass-card .text-gray-400 {
      color: #9ca3af !important;
    }

    .glass-card .text-gray-700,
    .glass-card .text-gray-600 {
      color: #d1d5db !important;
    }
  `]
})
export class MaintenanceFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private maintenanceService = inject(MaintenanceService);
  private carService = inject(CarService);

  maintenanceForm!: FormGroup;
  cars = signal<Car[]>([]);
  serviceTypes = signal<ServiceType[]>([]);
  isSubmitting = signal(false);
  jobId = signal<string | null>(null);
  isEditMode = signal(false);

  mechanics = [
    { id: 'mechanic-001', name: 'Mohamed Trabelsi' },
    { id: 'mechanic-002', name: 'Ali Sassi' },
    { id: 'mechanic-003', name: 'Ahmed Bouzid' }
  ];

  ngOnInit() {
    this.initializeForm();
    this.loadData();
    this.checkEditMode();
  }

  private initializeForm() {
    this.maintenanceForm = this.fb.group({
      carId: ['', Validators.required],
      mechanicId: ['', Validators.required],
      jobTitle: ['', Validators.required],
      description: ['', Validators.required],
      priority: ['medium', Validators.required],
      currentMileage: [0, [Validators.required, Validators.min(0)]],
      estimatedCost: [0, [Validators.min(0)]],
      estimatedDuration: [60, [Validators.min(5)]],
      notes: [''],
      tasks: this.fb.array([])
    });
  }

  private loadData() {
    // Load cars
    this.carService.getCars().subscribe({
      next: (cars) => this.cars.set(cars),
      error: (error) => console.error('Error loading cars:', error)
    });

    // Load service types
    this.maintenanceService.getServiceTypes().subscribe({
      next: (serviceTypes) => this.serviceTypes.set(serviceTypes),
      error: (error) => console.error('Error loading service types:', error)
    });
  }

  private checkEditMode() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.jobId.set(id);
      this.isEditMode.set(true);
      this.loadMaintenanceJob(id);
    }
  }

  private loadMaintenanceJob(id: string) {
    this.maintenanceService.getMaintenanceJob(id).subscribe({
      next: (job) => {
        if (job) {
          this.populateForm(job);
        } else {
          console.error('Job not found');
          this.goBack();
        }
      },
      error: (error) => {
        console.error('Error loading job:', error);
        this.goBack();
      }
    });
  }

  private populateForm(job: MaintenanceJob) {
    this.maintenanceForm.patchValue({
      carId: job.carId,
      mechanicId: job.mechanicId,
      jobTitle: job.jobTitle,
      description: job.description,
      priority: job.priority,
      currentMileage: job.currentMileage,
      estimatedCost: job.estimatedCost,
      estimatedDuration: job.estimatedDuration,
      notes: job.notes
    });

    // Populate tasks
    const tasksArray = this.tasks;
    tasksArray.clear();
    job.tasks.forEach(task => {
      tasksArray.push(this.createTaskFormGroup(task));
    });
  }

  get tasks() {
    return this.maintenanceForm.get('tasks') as FormArray;
  }

  addTask() {
    this.tasks.push(this.createTaskFormGroup());
  }

  removeTask(index: number) {
    this.tasks.removeAt(index);
  }

  private createTaskFormGroup(task?: MaintenanceTask): FormGroup {
    return this.fb.group({
      id: [task?.id || this.generateTaskId()],
      name: [task?.name || '', Validators.required],
      description: [task?.description || ''],
      status: [task?.status || 'pending'],
      estimatedTime: [task?.estimatedTime || 30, [Validators.min(5), Validators.max(480)]],
      assignedMechanicId: [task?.assignedMechanicId || '']
    });
  }

  onSubmit() {
    if (this.maintenanceForm.valid) {
      this.isSubmitting.set(true);
      
      const formValue = this.maintenanceForm.value;
      const selectedCar = this.cars().find(car => car.id === formValue.carId);
      const selectedMechanic = this.mechanics.find(m => m.id === formValue.mechanicId);

      const jobData: Partial<MaintenanceJob> = {
        ...formValue,
        licensePlate: selectedCar?.licensePlate || '',
        customerName: 'Customer Name', // Would get from customer service
        mechanicName: selectedMechanic?.name || '',
        carDetails: selectedCar ? `${selectedCar.year} ${selectedCar.make} ${selectedCar.model}` : '',
        customerId: selectedCar?.customerId || '',
        photos: [],
        approvalRequests: [],
        status: 'waiting'
      };

      const operation = this.isEditMode() 
        ? this.maintenanceService.updateMaintenanceJob(this.jobId()!, jobData)
        : this.maintenanceService.createMaintenanceJob(jobData);

      operation.subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.goBack();
        },
        error: (error) => {
          console.error('Error saving job:', error);
          this.isSubmitting.set(false);
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.maintenanceForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  private markFormGroupTouched() {
    Object.keys(this.maintenanceForm.controls).forEach(key => {
      const control = this.maintenanceForm.get(key);
      control?.markAsTouched();
    });
  }

  private generateTaskId(): string {
    return 'task-' + Math.random().toString(36).substr(2, 9);
  }

  goBack() {
    this.router.navigate(['/maintenance/active']);
  }
}