import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ThemeService } from '../../../core/services/theme.service';
import { AppointmentService } from '../services/appointment.service';
import { Appointment, Car, Customer, Mechanic } from '../../../core/models/appointment.model';

@Component({
  selector: 'app-appointment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <!-- Modal Overlay -->
    <div class="modal-overlay" (click)="closeModal()">
      <!-- Modal Content -->
      <div class="modal-content" (click)="$event.stopPropagation()">
        
        <!-- Modal Header -->
        <header class="modal-header">
          <div class="modal-title-section">
            <h2 class="modal-title">{{ editMode() ? 'Edit' : 'New' }} Appointment</h2>
            <p class="modal-subtitle">Schedule a service appointment</p>
          </div>
          <button class="modal-close-btn" (click)="closeModal()">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <!-- Modal Body -->
        <form [formGroup]="appointmentForm" class="modal-form">
          
          <!-- Car Selection -->
          <div class="form-section">
            <h3 class="section-title">Vehicle Information</h3>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">Car</label>
                <select class="form-select" formControlName="carId">
                  <option value="">Select a car</option>
                  @for (car of cars(); track car.id) {
                    <option [value]="car.id">{{ car.make }} {{ car.model }} - {{ car.licensePlate }}</option>
                  }
                </select>
              </div>
              <button type="button" class="quick-add-btn" title="Quick add car">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Service Details -->
          <div class="form-section">
            <h3 class="section-title">Service Details</h3>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">Service Type</label>
                <select class="form-select" formControlName="serviceType">
                  <option value="">Select service</option>
                  <option value="oil-change">Oil Change</option>
                  <option value="brake-repair">Brake Repair</option>
                  <option value="inspection">Inspection</option>
                  <option value="transmission">Transmission</option>
                  <option value="engine">Engine Work</option>
                  <option value="tires">Tire Service</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Duration (min)</label>
                <input type="number" class="form-input" formControlName="estimatedDuration" min="15" max="480" step="15">
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Service Name</label>
              <input type="text" class="form-input" formControlName="serviceName" placeholder="e.g., Oil Change & Filter Replacement">
            </div>
          </div>

          <!-- Schedule Details -->
          <div class="form-section">
            <h3 class="section-title">Schedule</h3>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" class="form-input" formControlName="scheduledDate">
              </div>
              <div class="form-group">
                <label class="form-label">Time</label>
                <select class="form-select" formControlName="scheduledTime">
                  <option value="">Select time</option>
                  <option value="08:00">8:00 AM</option>
                  <option value="08:30">8:30 AM</option>
                  <option value="09:00">9:00 AM</option>
                  <option value="09:30">9:30 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="10:30">10:30 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="11:30">11:30 AM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="14:30">2:30 PM</option>
                  <option value="15:00">3:00 PM</option>
                  <option value="15:30">3:30 PM</option>
                  <option value="16:00">4:00 PM</option>
                  <option value="16:30">4:30 PM</option>
                  <option value="17:00">5:00 PM</option>
                </select>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">Assigned Mechanic</label>
                <select class="form-select" formControlName="mechanicId">
                  <option value="">Auto-assign</option>
                  @for (mechanic of mechanics(); track mechanic.id) {
                    <option [value]="mechanic.id">{{ mechanic.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Priority</label>
                <select class="form-select" formControlName="priority">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div class="form-section">
            <div class="form-group">
              <label class="form-label">Notes (Optional)</label>
              <textarea class="form-textarea" formControlName="notes" 
                       placeholder="Additional notes about the service..."
                       rows="3"></textarea>
            </div>
          </div>

        </form>

        <!-- Modal Footer -->
        <footer class="modal-footer">
          <button type="button" class="modal-btn secondary" (click)="closeModal()">
            Cancel
          </button>
          <button type="button" class="modal-btn primary" 
                  [disabled]="!appointmentForm.valid || isSubmitting()"
                  (click)="saveAppointment()">
            <span *ngIf="!isSubmitting()">{{ editMode() ? 'Update' : 'Schedule' }} Appointment</span>
            <span *ngIf="isSubmitting()" class="flex items-center gap-2">
              <div class="submit-spinner"></div>
              Saving...
            </span>
          </button>
        </footer>

      </div>
    </div>
  `,
  styles: [`
    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .modal-content {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 20px;
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    @media (prefers-color-scheme: dark) {
      .modal-content {
        background: rgba(15, 23, 42, 0.95) !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 2rem 2rem 1rem 2rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    @media (prefers-color-scheme: dark) {
      .modal-header {
        border-bottom-color: rgba(255, 255, 255, 0.2) !important;
      }
    }

    .modal-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 0.25rem 0;
    }

    @media (prefers-color-scheme: dark) {
      .modal-title {
        color: #ffffff !important;
      }
    }

    .modal-subtitle {
      color: #6b7280;
      font-size: 0.875rem;
      margin: 0;
    }

    @media (prefers-color-scheme: dark) {
      .modal-subtitle {
        color: #d1d5db !important;
      }
    }

    .modal-close-btn {
      width: 2.5rem;
      height: 2.5rem;
      border: none;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #6b7280;
      transition: all 0.2s ease;
    }

    @media (prefers-color-scheme: dark) {
      .modal-close-btn {
        background: rgba(255, 255, 255, 0.1) !important;
        color: #d1d5db !important;
      }
    }

    .modal-close-btn:hover {
      background: rgba(0, 0, 0, 0.1);
      transform: scale(1.05);
    }

    @media (prefers-color-scheme: dark) {
      .modal-close-btn:hover {
        background: rgba(255, 255, 255, 0.2) !important;
      }
    }

    /* Form Styles */
    .modal-form {
      padding: 2rem;
    }

    .form-section {
      margin-bottom: 2rem;
    }

    .section-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #374151;
      margin: 0 0 1rem 0;
    }

    @media (prefers-color-scheme: dark) {
      .section-title {
        color: #ffffff !important;
      }
    }

    .form-row {
      display: flex;
      gap: 1rem;
      align-items: end;
    }

    @media (max-width: 767px) {
      .form-row {
        flex-direction: column;
        align-items: stretch;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    @media (prefers-color-scheme: dark) {
      .form-label {
        color: #d1d5db !important;
      }
    }

    .form-input,
    .form-select,
    .form-textarea {
      padding: 0.75rem;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.5);
      color: #1f2937;
      font-size: 0.875rem;
      transition: all 0.2s ease;
    }

    @media (prefers-color-scheme: dark) {
      .form-input,
      .form-select,
      .form-textarea {
        background: rgba(255, 255, 255, 0.1) !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
        color: #ffffff !important;
      }
    }

    .form-input:focus,
    .form-select:focus,
    .form-textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .quick-add-btn {
      width: 2.5rem;
      height: 2.5rem;
      border: 1px dashed rgba(0, 0, 0, 0.2);
      background: transparent;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #6b7280;
      transition: all 0.2s ease;
    }

    @media (prefers-color-scheme: dark) {
      .quick-add-btn {
        border-color: rgba(255, 255, 255, 0.3) !important;
        color: #d1d5db !important;
      }
    }

    .quick-add-btn:hover {
      border-color: #3b82f6;
      color: #3b82f6;
      background: rgba(59, 130, 246, 0.05);
    }

    /* Modal Footer */
    .modal-footer {
      display: flex;
      gap: 1rem;
      padding: 1.5rem 2rem 2rem 2rem;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }

    @media (prefers-color-scheme: dark) {
      .modal-footer {
        border-top-color: rgba(255, 255, 255, 0.2) !important;
      }
    }

    @media (max-width: 767px) {
      .modal-footer {
        flex-direction: column;
      }
    }

    .modal-btn {
      flex: 1;
      padding: 0.875rem 1.5rem;
      border-radius: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .modal-btn.secondary {
      background: transparent;
      border: 1px solid rgba(0, 0, 0, 0.1);
      color: #6b7280;
    }

    @media (prefers-color-scheme: dark) {
      .modal-btn.secondary {
        border-color: rgba(255, 255, 255, 0.2) !important;
        color: #d1d5db !important;
      }
    }

    .modal-btn.primary {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      border: none;
      color: white;
    }

    .modal-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .submit-spinner {
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class AppointmentModalComponent {
  private fb = inject(FormBuilder);
  private appointmentService = inject(AppointmentService);
  public themeService = inject(ThemeService);

  // Outputs
  closed = output<void>();
  saved = output<Appointment>();

  // Signals
  editMode = signal(false);
  isSubmitting = signal(false);
  cars = signal<Car[]>([]);
  customers = signal<Customer[]>([]);
  mechanics = signal<Mechanic[]>([]);

  // Form
  appointmentForm: FormGroup = this.fb.group({
    carId: ['', Validators.required],
    serviceType: ['', Validators.required],
    serviceName: ['', Validators.required],
    scheduledDate: [new Date().toISOString().split('T')[0], Validators.required],
    scheduledTime: ['', Validators.required],
    estimatedDuration: [60, [Validators.required, Validators.min(15)]],
    mechanicId: [''],
    priority: ['medium', Validators.required],
    notes: ['']
  });

  constructor() {
    this.loadFormData();
  }

  private loadFormData(): void {
    // Load cars
    this.appointmentService.getCars().subscribe(cars => {
      this.cars.set(cars);
    });

    // Load customers  
    this.appointmentService.getCustomers().subscribe(customers => {
      this.customers.set(customers);
    });

    // Load mechanics
    this.appointmentService.getMechanics().subscribe(mechanics => {
      this.mechanics.set(mechanics);
    });
  }

  saveAppointment(): void {
    if (this.appointmentForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);
      
      const formValue = this.appointmentForm.value;
      
      // Combine date and time
      const scheduledDateTime = new Date(formValue.scheduledDate);
      const [hours, minutes] = formValue.scheduledTime.split(':').map(Number);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      const appointmentData = {
        carId: formValue.carId,
        customerId: 'customer1', // This would be derived from car selection
        mechanicId: formValue.mechanicId || 'mechanic1', // Auto-assign if not selected
        serviceType: formValue.serviceType,
        serviceName: formValue.serviceName,
        scheduledDate: scheduledDateTime,
        estimatedDuration: formValue.estimatedDuration,
        status: 'scheduled' as const,
        priority: formValue.priority,
        notes: formValue.notes || undefined
      };

      this.appointmentService.createAppointment(appointmentData).subscribe({
        next: (appointment) => {
          this.saved.emit(appointment);
          this.closeModal();
          this.isSubmitting.set(false);
        },
        error: (error) => {
          console.error('Failed to save appointment:', error);
          this.isSubmitting.set(false);
        }
      });
    }
  }

  closeModal(): void {
    this.closed.emit();
  }
}