import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { CarService } from '../../cars/services/car.service';
import { EmployeeService } from '../../../core/services/employee.service';
import { MaintenanceJob, MaintenanceTask, ServiceType } from '../../../core/models/maintenance.model';
import { Car } from '../../../core/models/appointment.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-maintenance-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      
      <!-- Header -->
      <div class="glass-card mb-6">
        <div class="flex items-start space-x-6">
          <button 
            class="p-3 text-gray-500 hover:text-gray-900 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200"
            (click)="goBack()">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div class="flex-1">
            <h1 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {{ isEditMode() ? ('maintenance.new.editTitle' | translate) : ('maintenance.new.title' | translate) }}
            </h1>
            <div class="bg-gray-100 rounded-lg p-4">
              <div class="flex items-center space-x-3">
                <svg class="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <p class="text-lg font-medium text-blue-600">
                  {{ 'maintenance.new.subtitle' | translate }}
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
          <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ 'maintenance.new.basicInfo' | translate }}</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <!-- Car Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-600 mb-1">
                {{ 'maintenance.new.vehicle' | translate }} *
              </label>
              <select 
                formControlName="carId"
                class="form-select"
                [class.border-red-500]="isFieldInvalid('carId')">
                <option value="">{{ 'maintenance.new.selectVehicle' | translate }}</option>
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
              <label class="block text-sm font-medium text-gray-600 mb-1">
                {{ 'maintenance.new.assignedMechanic' | translate }} *
              </label>
              <select 
                formControlName="mechanicId"
                class="form-select"
                [class.border-red-500]="isFieldInvalid('mechanicId')">
                <option value="">{{ 'maintenance.new.selectMechanic' | translate }}</option>
                @for (mechanic of mechanics(); track mechanic.id) {
                  <option [value]="mechanic.id">{{ mechanic.name }}</option>
                }
              </select>
              @if (isFieldInvalid('mechanicId')) {
                <p class="mt-1 text-sm text-red-400">Mechanic is required</p>
              }
            </div>

            <!-- Job Title -->
            <div>
              <label class="block text-sm font-medium text-gray-600 mb-1">
                {{ 'maintenance.new.jobTitle' | translate }} *
              </label>
              <input 
                type="text"
                formControlName="jobTitle"
                [placeholder]="'maintenance.new.jobTitlePlaceholder' | translate"
                class="form-input"
                [class.border-red-500]="isFieldInvalid('jobTitle')">
              @if (isFieldInvalid('jobTitle')) {
                <p class="mt-1 text-sm text-red-400">Job title is required</p>
              }
            </div>

            <!-- Priority -->
            <div>
              <label class="block text-sm font-medium text-gray-600 mb-1">
                {{ 'maintenance.new.priority' | translate }} *
              </label>
              <select 
                formControlName="priority"
                class="form-select"
                [class.border-red-500]="isFieldInvalid('priority')">
                <option value="low">{{ 'maintenance.priority.low' | translate }}</option>
                <option value="medium">{{ 'maintenance.priority.medium' | translate }}</option>
                <option value="high">{{ 'maintenance.priority.high' | translate }}</option>
                <option value="urgent">{{ 'maintenance.priority.urgent' | translate }}</option>
              </select>
            </div>

            <!-- Current Mileage -->
            <div>
              <label class="block text-sm font-medium text-gray-600 mb-1">
                {{ 'maintenance.new.currentMileage' | translate }} *
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
              <label class="block text-sm font-medium text-gray-600 mb-1">
                {{ 'maintenance.new.estimatedCost' | translate }}
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
            <label class="block text-sm font-medium text-gray-600 mb-1">
              {{ 'maintenance.new.description' | translate }} *
            </label>
            <textarea 
              formControlName="description"
              rows="3"
              [placeholder]="'maintenance.new.descriptionPlaceholder' | translate"
              class="form-textarea"
              [class.border-red-500]="isFieldInvalid('description')">
            </textarea>
            @if (isFieldInvalid('description')) {
              <p class="mt-1 text-sm text-red-400">Description is required</p>
            }
          </div>

          <!-- Notes -->
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-600 mb-1">
              {{ 'maintenance.new.additionalNotes' | translate }}
            </label>
            <textarea 
              formControlName="notes"
              rows="2"
              [placeholder]="'maintenance.new.additionalNotesPlaceholder' | translate"
              class="form-textarea">
            </textarea>
          </div>

        </div>

        <!-- Tasks -->
        <div class="glass-card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">{{ 'maintenance.new.tasks' | translate }}</h2>
            <button 
              type="button"
              class="btn-secondary text-sm"
              (click)="addTask()">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              {{ 'maintenance.new.addTask' | translate }}
            </button>
          </div>

          <div formArrayName="tasks" class="space-y-4">
            @for (task of tasks.controls; track $index; let i = $index) {
              <div [formGroupName]="i" class="p-4 border border-gray-200 rounded-lg">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">
                      Task Name *
                    </label>
                    <input 
                      type="text"
                      formControlName="name"
                      placeholder="e.g., Replace brake pads"
                      class="form-input text-sm">
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-600 mb-1">
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
                  <label class="block text-sm font-medium text-gray-600 mb-1">
                    Task Description
                  </label>
                  <textarea
                    formControlName="description"
                    rows="2"
                    placeholder="Detailed description of what needs to be done..."
                    class="form-textarea text-sm">
                  </textarea>
                </div>

                <div class="mt-3">
                  <label class="block text-sm font-medium text-gray-600 mb-1">
                    {{ 'maintenance.new.taskStatus' | translate }}
                  </label>
                  <select formControlName="status" class="form-select text-sm">
                    <option value="pending">{{ 'maintenance.new.taskStatusPending' | translate }}</option>
                    <option value="in-progress">{{ 'maintenance.new.taskStatusInProgress' | translate }}</option>
                    <option value="completed">{{ 'maintenance.new.taskStatusCompleted' | translate }}</option>
                  </select>
                </div>
              </div>
            }
          </div>

          @if (tasks.length === 0) {
            <div class="text-center py-8 text-gray-500">
              <p class="text-sm">{{ 'maintenance.new.noTasks' | translate }}</p>
            </div>
          }

        </div>

        <!-- Form Actions -->
        <div class="flex items-center justify-end space-x-4 pt-6">
          <button 
            type="button"
            class="btn-secondary"
            (click)="goBack()">
            {{ 'maintenance.new.cancel' | translate }}
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
              {{ isEditMode() ? ('maintenance.new.updateJob' | translate) : ('maintenance.new.createJob' | translate) }}
            }
          </button>
        </div>

      </form>

    </div>
  `,
  styles: [``]
})
export class MaintenanceFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private maintenanceService = inject(MaintenanceService);
  private carService = inject(CarService);
  private employeeService = inject(EmployeeService);
  private toast = inject(ToastService);

  maintenanceForm!: FormGroup;
  cars = signal<Car[]>([]);
  serviceTypes = signal<ServiceType[]>([]);
  mechanics = signal<{ id: string; name: string }[]>([]);
  isSubmitting = signal(false);
  jobId = signal<string | null>(null);
  isEditMode = signal(false);
  private originalTaskIds = new Set<string>();

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

    // Load real employees for mechanic picker
    this.employeeService.getEmployees().subscribe({
      next: (employees) => {
        this.mechanics.set(
          employees
            .filter(e => e.availability.isAvailable)
            .map(e => ({ id: e.id, name: `${e.personalInfo.firstName} ${e.personalInfo.lastName}`.trim() }))
        );
      },
      error: (error) => console.error('Error loading mechanics:', error)
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
    this.originalTaskIds.clear();
    job.tasks.forEach(task => {
      tasksArray.push(this.createTaskFormGroup(task));
      this.originalTaskIds.add(task.id);
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
      const selectedMechanic = this.mechanics().find(m => m.id === formValue.mechanicId);

      const jobData: Partial<MaintenanceJob> = {
        ...formValue,
        licensePlate: selectedCar?.licensePlate || '',
        customerName: 'Customer Name', // Would get from customer service
        mechanicName: selectedMechanic?.name || '',
        carDetails: selectedCar ? `${selectedCar.year} ${selectedCar.make} ${selectedCar.model}` : '',
        customerId: selectedCar?.customerId || '',
        photos: [],
        approvalRequests: [],
      };
      // Only set default status on create; preserve existing status on edit
      if (!this.isEditMode()) {
        jobData.status = 'waiting';
      }

      const operation = this.isEditMode()
        ? this.maintenanceService.updateMaintenanceJob(this.jobId()!, jobData)
        : this.maintenanceService.createMaintenanceJob(jobData);

      operation.subscribe({
        next: (saved) => {
          this.syncTasks(saved.id, formValue.tasks || []).then(() => {
            this.toast.success(this.isEditMode() ? 'Maintenance job updated successfully' : 'Maintenance job created successfully');
            this.isSubmitting.set(false);
            this.goBack();
          });
        },
        error: (error) => {
          console.error('Error saving job:', error);
          this.toast.error(this.isEditMode() ? 'Failed to update maintenance job' : 'Failed to create maintenance job');
          this.isSubmitting.set(false);
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private async syncTasks(jobId: string, formTasks: any[]): Promise<void> {
    const currentIds = new Set<string>();
    for (const t of formTasks) {
      const looksLikeServerId = t.id && !String(t.id).startsWith('task-');
      const payload = {
        title: t.name,
        description: t.description || undefined,
        estimatedMinutes: t.estimatedTime,
        isCompleted: t.status === 'completed',
      };
      if (looksLikeServerId && this.originalTaskIds.has(t.id)) {
        await this.maintenanceService.updateTask(jobId, t.id, payload).toPromise().catch(() => {});
        currentIds.add(t.id);
      } else {
        const created: any = await this.maintenanceService.addTask(jobId, payload).toPromise().catch(() => null);
        if (created?.id) currentIds.add(created.id);
      }
    }
    for (const oldId of this.originalTaskIds) {
      if (!currentIds.has(oldId)) {
        await this.maintenanceService.deleteTask(jobId, oldId).toPromise().catch(() => {});
      }
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