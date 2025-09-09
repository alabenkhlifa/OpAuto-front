import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
            <div class="form-row car-selection-row">
              <div class="form-group flex-1">
                <label class="form-label">Car</label>
                <select class="form-select" formControlName="carId">
                  <option value="">Select a car</option>
                  @for (car of cars(); track car.id) {
                    <option [value]="car.id">{{ car.make }} {{ car.model }} - {{ car.licensePlate }}</option>
                  }
                </select>
              </div>
              <button type="button" class="quick-add-btn" title="Quick add car" (click)="openQuickAddCar()">
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
    /* Dark Glassmorphism Modal Styles - Permanent Theme */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: overlayFadeIn 0.2s ease-out;
    }

    @keyframes overlayFadeIn {
      from { opacity: 0; backdrop-filter: blur(0px); }
      to { opacity: 1; backdrop-filter: blur(8px); }
    }

    .modal-content {
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
      animation: modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes modalSlideIn {
      from { 
        opacity: 0; 
        transform: translateY(20px) scale(0.95); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0) scale(1); 
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 2rem 2rem 1rem 2rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .modal-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 0.25rem 0;
    }

    .modal-subtitle {
      color: #d1d5db;
      font-size: 0.875rem;
      margin: 0;
    }

    .modal-close-btn {
      width: 2.5rem;
      height: 2.5rem;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #d1d5db;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .modal-close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.05);
      color: #ffffff;
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
      color: #ffffff;
      margin: 0 0 1rem 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .section-title:before {
      content: '';
      width: 4px;
      height: 1.5rem;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      border-radius: 2px;
    }

    .form-row {
      display: flex;
      gap: 1rem;
      align-items: flex-end;
    }
    
    /* Special alignment for car selection row with quick-add button */
    .car-selection-row {
      align-items: flex-end;
    }
    
    .car-selection-row .form-group {
      margin-bottom: 0;
    }
    
    .car-selection-row .quick-add-btn {
      width: 3.125rem;
      height: 3.125rem;
      margin-bottom: 0;
      flex-shrink: 0;
      /* Position the button to align with the bottom of the select input */
      align-self: flex-end;
    }

    @media (max-width: 767px) {
      .form-row {
        flex-direction: column;
        align-items: stretch;
      }
      
      /* Keep car selection row horizontal on mobile */
      .car-selection-row {
        flex-direction: row !important;
        align-items: end !important;
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
      color: #d1d5db;
    }

    .form-input,
    .form-select,
    .form-textarea {
      padding: 0.875rem 1rem;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      color: #ffffff;
      font-size: 0.875rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .form-input::placeholder,
    .form-textarea::placeholder {
      color: #9ca3af;
    }

    .form-input:focus,
    .form-select:focus,
    .form-textarea:focus {
      outline: none;
      border-color: #3b82f6;
      background: rgba(255, 255, 255, 0.1);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
      transform: translateY(-1px);
    }

    .form-input:hover:not(:focus),
    .form-select:hover:not(:focus),
    .form-textarea:hover:not(:focus) {
      border-color: rgba(255, 255, 255, 0.3);
      background-color: rgba(255, 255, 255, 0.08);
    }

    /* Ensure select arrows remain visible on hover */
    .form-select:hover:not(:focus) {
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 0.75rem center;
      background-repeat: no-repeat;
      background-size: 1.5em 1.5em;
    }

    /* Ensure calendar icons remain visible on hover - use exact same icon */
    .form-input[type="date"]:hover:not(:focus) {
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='1.5'%3e%3cpath d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'/%3e%3c/svg%3e");
      background-position: right 0.75rem center;
      background-repeat: no-repeat;
      background-size: 1.25em 1.25em;
    }

    .quick-add-btn {
      width: 3.125rem; /* Match form input height */
      height: 3.125rem; /* Match form input height */
      border: 1px dashed rgba(255, 255, 255, 0.3);
      background: transparent;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #d1d5db;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0; /* Prevent button from shrinking */
    }

    .quick-add-btn:hover {
      border-color: #3b82f6;
      border-style: solid;
      color: #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      transform: scale(1.05);
    }

    /* Modal Footer */
    .modal-footer {
      display: flex;
      gap: 1rem;
      padding: 1.5rem 2rem 2rem 2rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    @media (max-width: 767px) {
      .modal-footer {
        flex-direction: column;
      }
    }

    .modal-btn {
      flex: 1;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      backdrop-filter: blur(10px);
    }

    .modal-btn.secondary {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #d1d5db;
    }

    .modal-btn.secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .modal-btn.primary {
      background: linear-gradient(135deg, #059669, #047857);
      border: 1px solid #059669;
      color: white;
      box-shadow: 0 4px 15px rgba(5, 150, 105, 0.3);
    }

    .modal-btn.primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #047857, #065f46);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(5, 150, 105, 0.4);
    }

    .modal-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
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

    /* Custom scrollbar for modal */
    .modal-content::-webkit-scrollbar {
      width: 6px;
    }

    .modal-content::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }

    .modal-content::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
    }

    .modal-content::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    /* Fix select dropdown arrow positioning and calendar icon styling */
    .form-select {
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 0.75rem center;
      background-repeat: no-repeat;
      background-size: 1.5em 1.5em;
      padding-right: 2.5rem;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
    }

    /* Date input calendar icon styling - hide native and use custom white icon */
    .form-input[type="date"] {
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='1.5'%3e%3cpath d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'/%3e%3c/svg%3e");
      background-position: right 0.75rem center;
      background-repeat: no-repeat;
      background-size: 1.25em 1.25em;
      padding-right: 2.5rem;
    }

    /* Make the entire date field clickable by expanding the calendar picker indicator */
    .form-input[type="date"]::-webkit-calendar-picker-indicator {
      opacity: 0;
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
      margin: 0;
      padding: 0;
    }

    /* Alternative approach for other browsers */
    .form-input[type="date"]::-moz-calendar-picker-indicator {
      display: none;
    }
  `]
})
export class AppointmentModalComponent {
  private fb = inject(FormBuilder);
  private appointmentService = inject(AppointmentService);
  private router = inject(Router);

  // Outputs
  closed = output<void>();
  saved = output<Appointment>();

  // Signals
  editMode = signal(false);
  isSubmitting = signal(false);
  cars = signal<Car[]>([]);
  customers = signal<Customer[]>([]);
  mechanics = signal<Mechanic[]>([]);
  currentAppointmentId = signal<string | null>(null);

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

      // Choose create or update based on edit mode
      const operation = this.editMode() && this.currentAppointmentId() 
        ? this.appointmentService.updateAppointment(this.currentAppointmentId()!, appointmentData)
        : this.appointmentService.createAppointment(appointmentData);

      operation.subscribe({
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
    this.editMode.set(false);
    this.currentAppointmentId.set(null);
    this.appointmentForm.reset();
    this.closed.emit();
  }

  // Method to set appointment for editing
  setEditAppointment(appointment: Appointment): void {
    this.editMode.set(true);
    this.currentAppointmentId.set(appointment.id);
    
    // Convert scheduled date to form format
    const scheduledDate = new Date(appointment.scheduledDate);
    const dateStr = scheduledDate.toISOString().split('T')[0];
    const timeStr = scheduledDate.toTimeString().slice(0, 5);

    this.appointmentForm.patchValue({
      carId: appointment.carId,
      serviceType: appointment.serviceType,
      serviceName: appointment.serviceName,
      scheduledDate: dateStr,
      scheduledTime: timeStr,
      estimatedDuration: appointment.estimatedDuration,
      mechanicId: appointment.mechanicId,
      priority: appointment.priority,
      notes: appointment.notes || ''
    });
  }

  openQuickAddCar(): void {
    // Close the appointment modal and navigate to cars management screen
    this.closeModal();
    this.router.navigate(['/cars']);
  }
}