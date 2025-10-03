import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { LoginRequest, RegisterRequest, AuthError, ForgotPasswordRequest } from '../../core/models/auth.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle.component';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe, LanguageToggleComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);">
      
      <!-- Background Pattern -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-20 -right-20 w-40 h-40 bg-blue-600 rounded-full opacity-10 blur-2xl"></div>
        <div class="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-600 rounded-full opacity-10 blur-2xl"></div>
        <div class="absolute top-20 left-20 w-40 h-40 bg-amber-600 rounded-full opacity-10 blur-2xl"></div>
      </div>

      <!-- Auth Card -->
      <div class="relative w-full max-w-md">
        <div class="glass-card p-8">
          
          <!-- Header with Logo and Language Selector -->
          <div class="relative mb-8">
            <!-- Language Selector - Positioned absolute top right -->
            <div class="absolute top-0 right-0">
              <app-language-toggle></app-language-toggle>
            </div>
            
            <!-- Logo and Title - Centered -->
            <div class="flex flex-col items-center">
              <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                </svg>
              </div>
              <div class="text-center">
                <h1 class="text-2xl font-bold text-white mb-2">{{ 'auth.title' | translate }}</h1>
                <p class="text-gray-300">{{ 'auth.subtitle' | translate }}</p>
              </div>
            </div>
          </div>

          <!-- Sign In Only - Registration Disabled -->
          <div class="backdrop-blur-sm bg-slate-800 bg-opacity-50 rounded-lg p-1 mb-6 border border-slate-700">
            <div class="py-3 px-4 text-sm font-semibold text-white text-center">
              <svg class="w-4 h-4 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              {{ 'auth.signIn' | translate }}
            </div>
          </div>

          <!-- Error Message -->
          @if (errorMessage()) {
            <div class="mb-4 p-3 backdrop-blur-sm bg-red-900 bg-opacity-30 border border-red-500 border-opacity-30 rounded-lg">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p class="text-sm text-red-200">{{ errorMessage() }}</p>
              </div>
            </div>
          }

          <!-- Login Form -->
          <form [formGroup]="loginForm" (ngSubmit)="onLogin()" class="space-y-4">
              
              <div>
                <label class="form-label">{{ 'auth.login.emailOrUsernameLabel' | translate }}</label>
                <input 
                  type="text" 
                  class="form-input"
                  formControlName="emailOrUsername"
                  placeholder="{{ 'auth.login.emailOrUsernamePlaceholder' | translate }}"
                  [class.border-red-500]="isFieldInvalid('emailOrUsername', loginForm)"
                  autocomplete="username">
                @if (isFieldInvalid('emailOrUsername', loginForm)) {
                  <p class="mt-1 text-sm text-red-400">{{ 'auth.login.emailOrUsernameRequired' | translate }}</p>
                }
              </div>

              <div>
                <label class="form-label">{{ 'auth.login.passwordLabel' | translate }}</label>
                <div class="relative">
                  <input 
                    [type]="showPassword() ? 'text' : 'password'"
                    class="form-input pr-10"
                    formControlName="password"
                    placeholder="{{ 'auth.login.passwordPlaceholder' | translate }}"
                    [class.border-red-500]="isFieldInvalid('password', loginForm)"
                    autocomplete="current-password">
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
                @if (isFieldInvalid('password', loginForm)) {
                  <p class="mt-1 text-sm text-red-400">{{ 'auth.login.passwordRequired' | translate }}</p>
                }
              </div>

              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <input 
                    type="checkbox" 
                    id="rememberMe"
                    class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    formControlName="rememberMe">
                  <label for="rememberMe" class="ml-2 text-sm text-gray-300">{{ 'auth.login.rememberMe' | translate }}</label>
                </div>
                
                <button 
                  type="button"
                  class="text-sm text-blue-400 hover:text-blue-300"
                  (click)="showForgotPassword()">
                  {{ 'auth.login.forgotPassword' | translate }}
                </button>
              </div>

              <button 
                type="submit"
                class="w-full btn-primary btn-lg flex items-center justify-center"
                [disabled]="loginForm.invalid || isLoading()">
                @if (isLoading()) {
                  <svg class="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{{ 'auth.login.signingIn' | translate }}</span>
                } @else {
                  <svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>{{ 'auth.signIn' | translate }}</span>
                }
              </button>

            </form>

          <!-- Demo Credentials -->
          <div class="mt-6 p-4 backdrop-blur-sm bg-blue-900 bg-opacity-20 border border-blue-500 border-opacity-30 rounded-lg">
            <h3 class="text-sm font-medium text-blue-300 mb-3">{{ 'auth.demo.title' | translate }}</h3>

            <!-- Solo Tier -->
            <div class="mb-3">
              <p class="text-xs font-semibold text-blue-400 mb-1">🔵 Solo (1 user, 50 cars)</p>
              <div class="text-xs text-blue-200 space-y-0.5 pl-3">
                <p><strong>Owner:</strong> solo&#64;opauto.tn / solo123</p>
              </div>
            </div>

            <!-- Starter Tier -->
            <div class="mb-3">
              <p class="text-xs font-semibold text-blue-400 mb-1">🟢 Starter (3 users, 200 cars)</p>
              <div class="text-xs text-blue-200 space-y-0.5 pl-3">
                <p><strong>Owner:</strong> starter&#64;opauto.tn / starter123</p>
                <p><strong>Staff:</strong> starter_staff1 / staff123</p>
                <p><strong>Staff:</strong> starter_staff2 / staff123</p>
              </div>
            </div>

            <!-- Professional Tier -->
            <div>
              <p class="text-xs font-semibold text-blue-400 mb-1">🟣 Professional (Unlimited)</p>
              <div class="text-xs text-blue-200 space-y-0.5 pl-3">
                <p><strong>Owner:</strong> pro&#64;opauto.tn / pro123</p>
                <p><strong>Mechanic:</strong> pro_mechanic1 / staff123</p>
                <p><strong>Receptionist:</strong> pro_receptionist / staff123</p>
                <p><strong>Inventory:</strong> pro_inventory / staff123</p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="mt-6 text-center">
            <p class="text-xs text-gray-400">
              {{ 'auth.footer.systemName' | translate }}
            </p>
          </div>

        </div>
      </div>
    </div>

    <!-- Forgot Password Modal -->
    @if (showForgotPasswordModal()) {
      <div class="fixed inset-0 z-50 overflow-y-auto">
        <div class="flex min-h-screen items-center justify-center p-4">
          
          <!-- Backdrop -->
          <div 
            class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
            (click)="closeForgotPassword()">
          </div>

          <!-- Modal Content -->
          <div class="relative glass-card backdrop-blur-lg rounded-xl max-w-md w-full">
            
            <!-- Header -->
            <div class="p-6 border-b border-slate-700 border-opacity-50">
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-white">{{ 'auth.forgotPassword.title' | translate }}</h2>
                <button 
                  class="text-gray-400 hover:text-gray-200"
                  (click)="closeForgotPassword()">
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="p-6">
              <p class="text-gray-300 mb-4">
                {{ 'auth.forgotPassword.description' | translate }}
              </p>
              
              <form [formGroup]="forgotPasswordForm" (ngSubmit)="onForgotPassword()">
                <div class="mb-4">
                  <label class="form-label">{{ 'auth.forgotPassword.emailLabel' | translate }}</label>
                  <input 
                    type="email" 
                    class="form-input"
                    formControlName="email"
                    placeholder="{{ 'auth.forgotPassword.emailPlaceholder' | translate }}"
                    [class.border-red-500]="isFieldInvalid('email', forgotPasswordForm)"
                    autocomplete="email">
                  @if (isFieldInvalid('email', forgotPasswordForm)) {
                    <p class="mt-1 text-sm text-red-400">{{ 'auth.forgotPassword.emailRequired' | translate }}</p>
                  }
                </div>

                <div class="flex space-x-3">
                  <button 
                    type="button"
                    class="flex-1 btn-secondary"
                    (click)="closeForgotPassword()">
                    {{ 'auth.forgotPassword.cancel' | translate }}
                  </button>
                  
                  <button 
                    type="submit"
                    class="flex-1 btn-primary"
                    [disabled]="forgotPasswordForm.invalid || isLoading()">
                    @if (isLoading()) {
                      <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {{ 'auth.forgotPassword.sending' | translate }}
                    } @else {
                      {{ 'auth.forgotPassword.sendResetLink' | translate }}
                    }
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Glass Card Effect */
    .glass-card {
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(75, 85, 99, 0.6);
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Form Elements */
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
      padding: 0.875rem 1rem;
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

    /* Enhanced glassmorphism backdrop */
    .backdrop-blur-lg {
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }

    /* Smooth transitions */
    * {
      transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease, transform 0.2s ease;
    }
  `]
})
export class AuthComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();

  isRegisterMode = signal(false); // Registration is now disabled
  isLoading = signal(false);
  errorMessage = signal<string>('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  showForgotPasswordModal = signal(false);

  loginForm!: FormGroup;
  registerForm!: FormGroup;
  forgotPasswordForm!: FormGroup;

  ngOnInit() {
    this.initializeForms();
    this.checkIfAlreadyAuthenticated();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForms() {
    this.loginForm = this.fb.group({
      emailOrUsername: ['', [Validators.required]],
      password: ['', [Validators.required]],
      rememberMe: [false]
    });

    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      garageName: ['', [Validators.required, Validators.minLength(2)]],
      phoneNumber: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    });

    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    // Add custom validator for password confirmation
    this.registerForm.get('confirmPassword')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.registerForm.get('confirmPassword')?.updateValueAndValidity({ emitEvent: false });
      });
  }

  private checkIfAlreadyAuthenticated() {
    this.authService.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isAuth => {
        if (isAuth) {
          this.router.navigate(['/dashboard']);
        }
      });
  }

  setMode(isRegister: boolean) {
    this.isRegisterMode.set(isRegister);
    this.errorMessage.set('');
    this.resetForms();
  }

  onLogin() {
    if (this.loginForm.valid && !this.isLoading()) {
      this.isLoading.set(true);
      this.errorMessage.set('');

      const loginRequest: LoginRequest = {
        emailOrUsername: this.loginForm.get('emailOrUsername')?.value,
        password: this.loginForm.get('password')?.value,
        rememberMe: this.loginForm.get('rememberMe')?.value
      };

      this.authService.login(loginRequest)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.isLoading.set(false);
            this.router.navigate(['/dashboard']);
          },
          error: (error: AuthError) => {
            this.isLoading.set(false);
            this.errorMessage.set(error.message);
          }
        });
    }
  }

  onRegister() {
    if (this.registerForm.valid && !this.isLoading()) {
      this.isLoading.set(true);
      this.errorMessage.set('');

      const registerRequest: RegisterRequest = {
        name: this.registerForm.get('name')?.value,
        garageName: this.registerForm.get('garageName')?.value,
        phoneNumber: this.registerForm.get('phoneNumber')?.value,
        email: this.registerForm.get('email')?.value,
        password: this.registerForm.get('password')?.value,
        confirmPassword: this.registerForm.get('confirmPassword')?.value,
        acceptTerms: this.registerForm.get('acceptTerms')?.value
      };

      this.authService.register(registerRequest)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.isLoading.set(false);
            this.router.navigate(['/dashboard']);
          },
          error: (error: AuthError) => {
            this.isLoading.set(false);
            this.errorMessage.set(error.message);
          }
        });
    }
  }

  onForgotPassword() {
    if (this.forgotPasswordForm.valid && !this.isLoading()) {
      this.isLoading.set(true);

      const request: ForgotPasswordRequest = {
        email: this.forgotPasswordForm.get('email')?.value
      };

      this.authService.forgotPassword(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.isLoading.set(false);
            this.closeForgotPassword();
            // Show success message
            this.errorMessage.set('');
            alert(response.message); // In a real app, use a proper notification service
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

  showForgotPassword() {
    this.showForgotPasswordModal.set(true);
    this.forgotPasswordForm.reset();
  }

  closeForgotPassword() {
    this.showForgotPasswordModal.set(false);
    this.errorMessage.set('');
  }

  showTerms() {
    // In a real app, show terms and conditions modal or navigate to terms page
    alert('Terms and Conditions would be displayed here');
  }

  showPrivacy() {
    // In a real app, show privacy policy modal or navigate to privacy page
    alert('Privacy Policy would be displayed here');
  }

  isFieldInvalid(fieldName: string, form: FormGroup): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  hasPasswordMismatch(): boolean {
    const password = this.registerForm.get('password')?.value;
    const confirmPassword = this.registerForm.get('confirmPassword')?.value;
    return !!(password && confirmPassword && password !== confirmPassword && 
              (this.registerForm.get('confirmPassword')?.dirty || this.registerForm.get('confirmPassword')?.touched));
  }

  private resetForms() {
    this.loginForm.reset({
      rememberMe: false
    });
    this.registerForm.reset({
      acceptTerms: false
    });
    this.showPassword.set(false);
    this.showConfirmPassword.set(false);
  }
}