import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { User, UserRole, CreateStaffRequest, AuthError, USER_ROLE_LABELS } from '../../core/models/auth.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-staff-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-white mb-2">{{ 'staff.title' | translate }}</h1>
        <p class="text-gray-300">{{ 'staff.subtitle' | translate }}</p>
      </div>

      <!-- Add New Staff Button -->
      <button 
        (click)="toggleAddForm()"
        class="btn-primary mb-6">
        <svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        {{ 'staff.addNew' | translate }}
      </button>

      <!-- Add Staff Form -->
      @if (showAddForm()) {
        <div class="glass-card p-6 mb-6">
          <h2 class="text-lg font-semibold text-white mb-4">{{ 'staff.createAccount' | translate }}</h2>
          
          <form [formGroup]="staffForm" (ngSubmit)="onCreateStaff()" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <!-- Full Name -->
            <div>
              <label class="form-label">{{ 'staff.form.fullName' | translate }}</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="name"
                placeholder="{{ 'staff.form.fullNamePlaceholder' | translate }}"
                [class.border-red-500]="isFieldInvalid('name')">
              @if (isFieldInvalid('name')) {
                <p class="mt-1 text-sm text-red-400">{{ 'staff.form.nameRequired' | translate }}</p>
              }
            </div>

            <!-- Username -->
            <div>
              <label class="form-label">{{ 'staff.form.username' | translate }}</label>
              <input 
                type="text" 
                class="form-input"
                formControlName="username"
                placeholder="{{ 'staff.form.usernamePlaceholder' | translate }}"
                [class.border-red-500]="isFieldInvalid('username')">
              @if (isFieldInvalid('username')) {
                <p class="mt-1 text-sm text-red-400">{{ 'staff.form.usernameRequired' | translate }}</p>
              }
            </div>

            <!-- Role -->
            <div>
              <label class="form-label">{{ 'staff.form.role' | translate }}</label>
              <select 
                class="form-input"
                formControlName="role"
                [class.border-red-500]="isFieldInvalid('role')">
                <option value="">{{ 'staff.form.selectRole' | translate }}</option>
                <option value="admin">{{ 'staff.roles.admin' | translate }}</option>
                <option value="mechanic">{{ 'staff.roles.mechanic' | translate }}</option>
                <option value="receptionist">{{ 'staff.roles.receptionist' | translate }}</option>
              </select>
              @if (isFieldInvalid('role')) {
                <p class="mt-1 text-sm text-red-400">{{ 'staff.form.roleRequired' | translate }}</p>
              }
            </div>

            <!-- Phone Number -->
            <div>
              <label class="form-label">{{ 'staff.form.phone' | translate }}</label>
              <input 
                type="tel" 
                class="form-input"
                formControlName="phoneNumber"
                placeholder="{{ 'staff.form.phonePlaceholder' | translate }}">
            </div>

            <!-- Password -->
            <div>
              <label class="form-label">{{ 'staff.form.password' | translate }}</label>
              <div class="relative">
                <input 
                  [type]="showPassword() ? 'text' : 'password'"
                  class="form-input pr-10"
                  formControlName="password"
                  placeholder="{{ 'staff.form.passwordPlaceholder' | translate }}"
                  [class.border-red-500]="isFieldInvalid('password')">
                <button 
                  type="button"
                  class="absolute inset-y-0 right-0 pr-3 flex items-center"
                  (click)="togglePasswordVisibility()">
                  <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    @if (showPassword()) {
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    } @else {
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    }
                  </svg>
                </button>
              </div>
              @if (isFieldInvalid('password')) {
                <p class="mt-1 text-sm text-red-400">{{ 'staff.form.passwordMinLength' | translate }}</p>
              }
            </div>

            <!-- Confirm Password -->
            <div>
              <label class="form-label">{{ 'staff.form.confirmPassword' | translate }}</label>
              <div class="relative">
                <input 
                  [type]="showConfirmPassword() ? 'text' : 'password'"
                  class="form-input pr-10"
                  formControlName="confirmPassword"
                  placeholder="{{ 'staff.form.confirmPasswordPlaceholder' | translate }}"
                  [class.border-red-500]="isFieldInvalid('confirmPassword') || hasPasswordMismatch()">
                <button 
                  type="button"
                  class="absolute inset-y-0 right-0 pr-3 flex items-center"
                  (click)="toggleConfirmPasswordVisibility()">
                  <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    @if (showConfirmPassword()) {
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    } @else {
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    }
                  </svg>
                </button>
              </div>
              @if (isFieldInvalid('confirmPassword')) {
                <p class="mt-1 text-sm text-red-400">{{ 'staff.form.confirmPasswordRequired' | translate }}</p>
              } @else if (hasPasswordMismatch()) {
                <p class="mt-1 text-sm text-red-400">{{ 'staff.form.passwordMismatch' | translate }}</p>
              }
            </div>

            <!-- Error Message -->
            @if (errorMessage()) {
              <div class="md:col-span-2">
                <div class="p-3 backdrop-blur-sm bg-red-900 bg-opacity-30 border border-red-500 border-opacity-30 rounded-lg">
                  <div class="flex items-start">
                    <svg class="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p class="text-sm text-red-200">{{ errorMessage() }}</p>
                  </div>
                </div>
              </div>
            }

            <!-- Success Message -->
            @if (successMessage()) {
              <div class="md:col-span-2">
                <div class="p-3 backdrop-blur-sm bg-green-900 bg-opacity-30 border border-green-500 border-opacity-30 rounded-lg">
                  <div class="flex items-start">
                    <svg class="w-5 h-5 text-green-400 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-sm text-green-200">{{ successMessage() }}</p>
                  </div>
                </div>
              </div>
            }

            <!-- Buttons -->
            <div class="md:col-span-2 flex gap-3">
              <button 
                type="submit"
                class="btn-primary"
                [disabled]="staffForm.invalid || isLoading()">
                @if (isLoading()) {
                  <svg class="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ 'staff.form.creating' | translate }}
                } @else {
                  {{ 'staff.form.create' | translate }}
                }
              </button>
              
              <button 
                type="button"
                class="btn-secondary"
                (click)="cancelAdd()">
                {{ 'staff.form.cancel' | translate }}
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Staff List -->
      <div class="glass-card overflow-hidden">
        <table class="w-full">
          <thead>
            <tr class="border-b border-slate-700">
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                {{ 'staff.table.name' | translate }}
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                {{ 'staff.table.username' | translate }}
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                {{ 'staff.table.role' | translate }}
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                {{ 'staff.table.phone' | translate }}
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                {{ 'staff.table.status' | translate }}
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                {{ 'staff.table.actions' | translate }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-700">
            @for (staff of staffMembers(); track staff.id) {
              <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-white">
                  {{ staff.name }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {{ staff.username || '-' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="badge" [ngClass]="getRoleBadgeClass(staff.role)">
                    {{ getRoleLabel(staff.role) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {{ staff.phoneNumber || '-' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  @if (staff.isActive) {
                    <span class="badge badge-success">{{ 'staff.status.active' | translate }}</span>
                  } @else {
                    <span class="badge badge-danger">{{ 'staff.status.inactive' | translate }}</span>
                  }
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button class="text-blue-400 hover:text-blue-300 mr-3">
                    {{ 'staff.actions.edit' | translate }}
                  </button>
                  <button class="text-red-400 hover:text-red-300">
                    {{ 'staff.actions.delete' | translate }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-400">
                  {{ 'staff.noStaff' | translate }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #ffffff;
      margin-bottom: 0.5rem;
    }
    
    .form-input {
      display: block;
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid rgba(75, 85, 99, 0.4);
      border-radius: 12px;
      background: rgba(31, 41, 55, 0.6);
      backdrop-filter: blur(10px);
      color: #ffffff;
      font-size: 0.875rem;
      transition: all 0.2s ease;
    }
    
    .form-input:focus {
      outline: none;
      border-color: rgba(59, 130, 246, 0.6);
      background: rgba(31, 41, 55, 0.8);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .form-input::placeholder {
      color: #9ca3af;
    }

    select.form-input {
      appearance: none;
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 0.5rem center;
      background-repeat: no-repeat;
      background-size: 1.5em 1.5em;
      padding-right: 2.5rem;
    }
  `]
})
export class StaffManagementComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();

  showAddForm = signal(false);
  isLoading = signal(false);
  errorMessage = signal<string>('');
  successMessage = signal<string>('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  
  staffMembers = signal<User[]>([]);
  staffForm!: FormGroup;

  ngOnInit() {
    this.initializeForm();
    this.loadStaffMembers();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm() {
    this.staffForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_]{3,20}$/)]],
      role: ['', [Validators.required]],
      phoneNumber: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  private loadStaffMembers() {
    // Mock data - in real app, fetch from backend
    const mockStaff: User[] = [
      {
        id: '1',
        username: 'admin_user',
        name: 'Sara Mansouri',
        role: UserRole.ADMIN,
        garageName: 'OpAuto Garage Tunis',
        phoneNumber: '+216 98 765 432',
        isActive: true,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: '2',
        username: 'mechanic1',
        name: 'Fatma Slimani',
        role: UserRole.MECHANIC,
        garageName: 'OpAuto Garage Tunis',
        phoneNumber: '+216 55 123 456',
        isActive: true,
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-01')
      },
      {
        id: '3',
        username: 'reception1',
        name: 'Karim Hamdi',
        role: UserRole.RECEPTIONIST,
        garageName: 'OpAuto Garage Tunis',
        phoneNumber: '+216 22 333 444',
        isActive: true,
        createdAt: new Date('2024-02-15'),
        updatedAt: new Date('2024-02-15')
      }
    ];
    
    this.staffMembers.set(mockStaff);
  }

  toggleAddForm() {
    this.showAddForm.set(!this.showAddForm());
    if (this.showAddForm()) {
      this.staffForm.reset();
      this.errorMessage.set('');
      this.successMessage.set('');
    }
  }

  cancelAdd() {
    this.showAddForm.set(false);
    this.staffForm.reset();
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  onCreateStaff() {
    if (this.staffForm.valid && !this.isLoading()) {
      this.isLoading.set(true);
      this.errorMessage.set('');
      this.successMessage.set('');

      const request: CreateStaffRequest = {
        name: this.staffForm.get('name')?.value,
        username: this.staffForm.get('username')?.value,
        role: this.staffForm.get('role')?.value as UserRole,
        phoneNumber: this.staffForm.get('phoneNumber')?.value,
        password: this.staffForm.get('password')?.value,
        confirmPassword: this.staffForm.get('confirmPassword')?.value
      };

      this.authService.createStaffAccount(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (newStaff) => {
            this.isLoading.set(false);
            this.successMessage.set('Staff account created successfully!');
            this.staffMembers.update(members => [...members, newStaff]);
            
            // Reset form after 2 seconds
            setTimeout(() => {
              this.showAddForm.set(false);
              this.staffForm.reset();
              this.successMessage.set('');
            }, 2000);
          },
          error: (error: AuthError) => {
            this.isLoading.set(false);
            this.errorMessage.set(error.message);
          }
        });
    }
  }

  togglePasswordVisibility() {
    this.showPassword.set(!this.showPassword());
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.staffForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  hasPasswordMismatch(): boolean {
    const password = this.staffForm.get('password')?.value;
    const confirmPassword = this.staffForm.get('confirmPassword')?.value;
    return !!(password && confirmPassword && password !== confirmPassword && 
              (this.staffForm.get('confirmPassword')?.dirty || this.staffForm.get('confirmPassword')?.touched));
  }

  getRoleBadgeClass(role: UserRole): string {
    switch(role) {
      case UserRole.OWNER:
        return 'badge-primary';
      case UserRole.ADMIN:
        return 'badge-warning';
      case UserRole.MECHANIC:
        return 'badge-info';
      case UserRole.RECEPTIONIST:
        return 'badge-secondary';
      default:
        return 'badge-secondary';
    }
  }

  getRoleLabel(role: UserRole): string {
    return USER_ROLE_LABELS[role] || role;
  }
}