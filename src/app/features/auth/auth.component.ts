import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { LoginRequest, RegisterRequest, AuthError, ForgotPasswordRequest } from '../../core/models/auth.model';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      
      <!-- Background Pattern -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 dark:bg-blue-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-xl opacity-20 animate-pulse border-0"></div>
        <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-xl opacity-20 animate-pulse border-0" style="animation-delay: 2s;"></div>
        <div class="absolute top-40 left-40 w-80 h-80 bg-amber-400 dark:bg-amber-600 rounded-full mix-blend-multiply dark:mix-blend-screen blur-xl opacity-20 animate-pulse border-0" style="animation-delay: 4s;"></div>
      </div>

      <!-- Auth Card -->
      <div class="relative w-full max-w-md">
        <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-lg rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-8">
          
          <!-- Logo and Header -->
          <div class="text-center mb-8">
            <div class="mx-auto w-16 h-16 bg-blue-600 dark:bg-blue-500 rounded-xl flex items-center justify-center mb-4">
              <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">OpAuto</h1>
            <p class="text-gray-600 dark:text-gray-400">Garage Management System</p>
          </div>

          <!-- Mode Toggle -->
          <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-6">
            <button 
              type="button"
              class="flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200"
              [class]="!isRegisterMode() ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
              (click)="setMode(false)">
              Sign In
            </button>
            <button 
              type="button"
              class="flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200"
              [class]="isRegisterMode() ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
              (click)="setMode(true)">
              Register
            </button>
          </div>

          <!-- Error Message -->
          @if (errorMessage()) {
            <div class="mb-4 p-3 bg-red-50 dark:bg-red-900 dark:bg-opacity-50 border border-red-200 dark:border-red-700 rounded-lg">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p class="text-sm text-red-700 dark:text-red-300">{{ errorMessage() }}</p>
              </div>
            </div>
          }

          <!-- Login Form -->
          @if (!isRegisterMode()) {
            <form [formGroup]="loginForm" (ngSubmit)="onLogin()" class="space-y-4">
              
              <div>
                <label class="form-label">Email Address</label>
                <input 
                  type="email" 
                  class="form-input"
                  formControlName="email"
                  placeholder="Enter your email"
                  [class.border-red-500]="isFieldInvalid('email', loginForm)"
                  autocomplete="email">
                @if (isFieldInvalid('email', loginForm)) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Valid email is required</p>
                }
              </div>

              <div>
                <label class="form-label">Password</label>
                <div class="relative">
                  <input 
                    [type]="showPassword() ? 'text' : 'password'"
                    class="form-input pr-10"
                    formControlName="password"
                    placeholder="Enter your password"
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
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Password is required</p>
                }
              </div>

              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <input 
                    type="checkbox" 
                    id="rememberMe"
                    class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    formControlName="rememberMe">
                  <label for="rememberMe" class="ml-2 text-sm text-gray-600 dark:text-gray-400">Remember me</label>
                </div>
                
                <button 
                  type="button"
                  class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                  (click)="showForgotPassword()">
                  Forgot password?
                </button>
              </div>

              <button 
                type="submit"
                class="w-full btn-primary py-3"
                [disabled]="loginForm.invalid || isLoading()">
                @if (isLoading()) {
                  <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing In...
                } @else {
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In
                }
              </button>

            </form>
          }

          <!-- Registration Form -->
          @if (isRegisterMode()) {
            <form [formGroup]="registerForm" (ngSubmit)="onRegister()" class="space-y-4">
              
              <!-- Personal Information -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="form-label">Full Name</label>
                  <input 
                    type="text" 
                    class="form-input"
                    formControlName="name"
                    placeholder="Your full name"
                    [class.border-red-500]="isFieldInvalid('name', registerForm)"
                    autocomplete="name">
                  @if (isFieldInvalid('name', registerForm)) {
                    <p class="mt-1 text-sm text-red-600 dark:text-red-400">Name is required</p>
                  }
                </div>

                <div>
                  <label class="form-label">Phone Number</label>
                  <input 
                    type="tel" 
                    class="form-input"
                    formControlName="phoneNumber"
                    placeholder="+216 XX XXX XXX"
                    autocomplete="tel">
                </div>
              </div>

              <!-- Business Information -->
              <div>
                <label class="form-label">Garage Name</label>
                <input 
                  type="text" 
                  class="form-input"
                  formControlName="garageName"
                  placeholder="Your garage name"
                  [class.border-red-500]="isFieldInvalid('garageName', registerForm)"
                  autocomplete="organization">
                @if (isFieldInvalid('garageName', registerForm)) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Garage name is required</p>
                }
              </div>

              <!-- Account Information -->
              <div>
                <label class="form-label">Email Address</label>
                <input 
                  type="email" 
                  class="form-input"
                  formControlName="email"
                  placeholder="your.email@example.com"
                  [class.border-red-500]="isFieldInvalid('email', registerForm)"
                  autocomplete="email">
                @if (isFieldInvalid('email', registerForm)) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Valid email is required</p>
                }
              </div>

              <div>
                <label class="form-label">Password</label>
                <div class="relative">
                  <input 
                    [type]="showPassword() ? 'text' : 'password'"
                    class="form-input pr-10"
                    formControlName="password"
                    placeholder="Create a strong password"
                    [class.border-red-500]="isFieldInvalid('password', registerForm)"
                    autocomplete="new-password">
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
                @if (isFieldInvalid('password', registerForm)) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Password must be at least 6 characters</p>
                }
              </div>

              <div>
                <label class="form-label">Confirm Password</label>
                <div class="relative">
                  <input 
                    [type]="showConfirmPassword() ? 'text' : 'password'"
                    class="form-input pr-10"
                    formControlName="confirmPassword"
                    placeholder="Confirm your password"
                    [class.border-red-500]="isFieldInvalid('confirmPassword', registerForm) || hasPasswordMismatch()"
                    autocomplete="new-password">
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
                @if (isFieldInvalid('confirmPassword', registerForm)) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Please confirm your password</p>
                } @else if (hasPasswordMismatch()) {
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">Passwords do not match</p>
                }
              </div>

              <!-- Terms and Conditions -->
              <div class="flex items-start space-x-2">
                <input 
                  type="checkbox" 
                  id="acceptTerms"
                  class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  formControlName="acceptTerms"
                  [class.border-red-500]="isFieldInvalid('acceptTerms', registerForm)">
                <label for="acceptTerms" class="text-sm text-gray-600 dark:text-gray-400">
                  I agree to the 
                  <button type="button" class="text-blue-600 dark:text-blue-400 hover:underline" (click)="showTerms()">
                    Terms and Conditions
                  </button> 
                  and 
                  <button type="button" class="text-blue-600 dark:text-blue-400 hover:underline" (click)="showPrivacy()">
                    Privacy Policy
                  </button>
                </label>
              </div>
              @if (isFieldInvalid('acceptTerms', registerForm)) {
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">You must accept the terms and conditions</p>
              }

              <button 
                type="submit"
                class="w-full btn-primary py-3"
                [disabled]="registerForm.invalid || isLoading()">
                @if (isLoading()) {
                  <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Account...
                } @else {
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Create Account
                }
              </button>

            </form>
          }

          <!-- Demo Credentials -->
          @if (!isRegisterMode()) {
            <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-30 rounded-lg">
              <h3 class="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">Demo Credentials</h3>
              <div class="space-y-1 text-xs text-blue-700 dark:text-blue-400">
                <p><strong>Admin:</strong> admin&#64;opauto.tn / admin123</p>
                <p><strong>Mechanic:</strong> mechanic&#64;opauto.tn / mech123</p>
              </div>
            </div>
          }

          <!-- Footer -->
          <div class="mt-6 text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              OpAuto Garage Management System v1.0
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
          <div class="relative bg-white bg-opacity-95 dark:bg-gray-800 dark:bg-opacity-95 backdrop-blur-lg rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg max-w-md w-full">
            
            <!-- Header -->
            <div class="p-6 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Reset Password</h2>
                <button 
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  (click)="closeForgotPassword()">
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="p-6">
              <p class="text-gray-600 dark:text-gray-400 mb-4">
                Enter your email address and we'll send you instructions to reset your password.
              </p>
              
              <form [formGroup]="forgotPasswordForm" (ngSubmit)="onForgotPassword()">
                <div class="mb-4">
                  <label class="form-label">Email Address</label>
                  <input 
                    type="email" 
                    class="form-input"
                    formControlName="email"
                    placeholder="Enter your email"
                    [class.border-red-500]="isFieldInvalid('email', forgotPasswordForm)"
                    autocomplete="email">
                  @if (isFieldInvalid('email', forgotPasswordForm)) {
                    <p class="mt-1 text-sm text-red-600 dark:text-red-400">Valid email is required</p>
                  }
                </div>

                <div class="flex space-x-3">
                  <button 
                    type="button"
                    class="flex-1 btn-secondary"
                    (click)="closeForgotPassword()">
                    Cancel
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
                      Sending...
                    } @else {
                      Send Reset Link
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
    
    .form-input {
      display: block;
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      background-color: white;
      color: #111827;
      font-size: 0.875rem;
      transition: all 0.2s ease;
    }
    
    .form-input:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    
    .form-input::placeholder {
      color: #9ca3af;
    }
    
    .dark .form-input {
      background-color: #1f2937;
      border-color: #4b5563;
      color: #f9fafb;
    }
    
    .dark .form-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .dark .form-input::placeholder {
      color: #6b7280;
    }
    
    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.5rem;
      border: 1px solid transparent;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.5rem;
      color: white;
      background-color: #2563eb;
      gap: 0.5rem;
      transition: all 0.2s ease;
    }
    
    .btn-primary:hover:not(:disabled) {
      background-color: #1d4ed8;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    }
    
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.5rem;
      border: 1px solid #d1d5db;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.5rem;
      color: #374151;
      background-color: white;
      gap: 0.5rem;
      transition: all 0.2s ease;
    }
    
    .btn-secondary:hover:not(:disabled) {
      background-color: #f9fafb;
      transform: translateY(-1px);
    }
    
    .btn-secondary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    
    .dark .btn-secondary {
      border-color: #4b5563;
      color: #d1d5db;
      background-color: #1f2937;
    }
    
    .dark .btn-secondary:hover:not(:disabled) {
      background-color: #374151;
    }

    /* Enhanced glassmorphism effect */
    .backdrop-blur-lg {
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }

    /* Remove any borders from background elements */
    .blur-xl {
      filter: blur(20px);
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }

    .border-0 {
      border: 0 !important;
      outline: none !important;
    }

    /* Target background droplets specifically */
    .absolute.w-80.h-80 {
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      background-clip: padding-box !important;
    }

    /* Remove any potential white borders/outlines */
    .absolute.w-80.h-80::before,
    .absolute.w-80.h-80::after {
      display: none !important;
    }

    /* Smooth transitions */
    * {
      transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
    }
  `]
})
export class AuthComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();

  isRegisterMode = signal(false);
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
      email: ['', [Validators.required, Validators.email]],
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
        email: this.loginForm.get('email')?.value,
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