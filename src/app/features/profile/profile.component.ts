import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService, SupportedLanguage } from '../../core/services/language.service';
import { User, ChangePasswordRequest, AuthError, UserRole, USER_ROLE_LABELS } from '../../core/models/auth.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      
      <!-- Header -->
      <div class="max-w-4xl mx-auto mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
            <p class="text-gray-600 dark:text-gray-400 mt-1">Manage your account and preferences</p>
          </div>
          <button 
            class="btn-secondary flex items-center gap-2"
            (click)="goBack()">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      </div>

      <div class="max-w-4xl mx-auto">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Profile Card -->
          <div class="lg:col-span-1">
            <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-lg rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-6">
              
              <!-- Avatar Section -->
              <div class="text-center mb-6">
                <div class="mx-auto w-24 h-24 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-4">
                  @if (currentUser()?.avatar) {
                    <img [src]="currentUser()?.avatar" [alt]="currentUser()?.name" class="w-24 h-24 rounded-full object-cover">
                  } @else {
                    <span class="text-2xl font-bold text-white">{{ getInitials() }}</span>
                  }
                </div>
                
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ currentUser()?.name }}</h2>
                <p class="text-blue-600 dark:text-blue-400 font-medium">{{ getRoleLabel() }}</p>
                <p class="text-gray-600 dark:text-gray-400 text-sm mt-1">{{ currentUser()?.garageName }}</p>
              </div>

              <!-- Quick Stats -->
              <div class="space-y-3">
                <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span class="text-gray-600 dark:text-gray-400 text-sm">Member Since</span>
                  <span class="text-gray-900 dark:text-white text-sm font-medium">{{ formatDate(currentUser()?.createdAt) }}</span>
                </div>
                <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span class="text-gray-600 dark:text-gray-400 text-sm">Last Login</span>
                  <span class="text-gray-900 dark:text-white text-sm font-medium">{{ formatDate(currentUser()?.lastLogin) }}</span>
                </div>
                <div class="flex justify-between items-center py-2">
                  <span class="text-gray-600 dark:text-gray-400 text-sm">Account Status</span>
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                        [class]="currentUser()?.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'">
                    {{ currentUser()?.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </div>
              </div>

              <!-- Logout Button -->
              <button 
                class="w-full mt-6 btn-secondary flex items-center justify-center gap-2"
                (click)="logout()">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H4a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>

          <!-- Settings Panel -->
          <div class="lg:col-span-2">
            <div class="bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 backdrop-blur-lg rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl">
              
              <!-- Tab Navigation -->
              <div class="flex border-b border-gray-200 dark:border-gray-700 rounded-t-2xl overflow-hidden">
                <button 
                  class="flex-1 py-4 px-6 text-sm font-medium transition-all duration-200"
                  [class]="activeTab() === 'profile' ? 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-50 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'"
                  (click)="setActiveTab('profile')">
                  <div class="flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </div>
                </button>
                
                <button 
                  class="flex-1 py-4 px-6 text-sm font-medium transition-all duration-200"
                  [class]="activeTab() === 'preferences' ? 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-50 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'"
                  (click)="setActiveTab('preferences')">
                  <div class="flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                    </svg>
                    Preferences
                  </div>
                </button>
                
                <button 
                  class="flex-1 py-4 px-6 text-sm font-medium transition-all duration-200"
                  [class]="activeTab() === 'security' ? 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-50 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'"
                  (click)="setActiveTab('security')">
                  <div class="flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Security
                  </div>
                </button>
              </div>

              <!-- Tab Content -->
              <div class="p-6">
                
                <!-- Profile Tab -->
                @if (activeTab() === 'profile') {
                  <form [formGroup]="profileForm" (ngSubmit)="onUpdateProfile()" class="space-y-6">
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="form-label">Full Name</label>
                        <input 
                          type="text" 
                          class="form-input"
                          formControlName="name"
                          placeholder="Enter your full name"
                          [class.border-red-500]="isFieldInvalid('name', profileForm)">
                        @if (isFieldInvalid('name', profileForm)) {
                          <p class="mt-1 text-sm text-red-600 dark:text-red-400">Name is required</p>
                        }
                      </div>

                      <div>
                        <label class="form-label">Email Address</label>
                        <input 
                          type="email" 
                          class="form-input"
                          formControlName="email"
                          placeholder="Enter your email"
                          [class.border-red-500]="isFieldInvalid('email', profileForm)">
                        @if (isFieldInvalid('email', profileForm)) {
                          <p class="mt-1 text-sm text-red-600 dark:text-red-400">Valid email is required</p>
                        }
                      </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="form-label">Phone Number</label>
                        <input 
                          type="tel" 
                          class="form-input"
                          formControlName="phoneNumber"
                          placeholder="+216 XX XXX XXX">
                      </div>

                      <div>
                        <label class="form-label">Garage Name</label>
                        <input 
                          type="text" 
                          class="form-input"
                          formControlName="garageName"
                          placeholder="Enter garage name"
                          [class.border-red-500]="isFieldInvalid('garageName', profileForm)">
                        @if (isFieldInvalid('garageName', profileForm)) {
                          <p class="mt-1 text-sm text-red-600 dark:text-red-400">Garage name is required</p>
                        }
                      </div>
                    </div>

                    <!-- Profile Actions -->
                    <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button 
                        type="button"
                        class="btn-secondary"
                        (click)="resetProfileForm()">
                        Reset
                      </button>
                      <button 
                        type="submit"
                        class="btn-primary"
                        [disabled]="profileForm.invalid || isLoading()">
                        @if (isLoading()) {
                          <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Updating...
                        } @else {
                          Update Profile
                        }
                      </button>
                    </div>
                  </form>
                }

                <!-- Preferences Tab -->
                @if (activeTab() === 'preferences') {
                  <form [formGroup]="preferencesForm" (ngSubmit)="onUpdatePreferences()" class="space-y-6">
                    
                    <!-- Theme Settings -->
                    <div>
                      <label class="form-label">Theme Preference</label>
                      <div class="grid grid-cols-3 gap-3 mt-2">
                        <button 
                          type="button"
                          class="p-3 border rounded-lg transition-all duration-200 flex flex-col items-center space-y-2"
                          [class]="getThemeButtonClass('light')"
                          (click)="setTheme('light')">
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <span class="text-xs font-medium">Light</span>
                        </button>
                        
                        <button 
                          type="button"
                          class="p-3 border rounded-lg transition-all duration-200 flex flex-col items-center space-y-2"
                          [class]="getThemeButtonClass('dark')"
                          (click)="setTheme('dark')">
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                          </svg>
                          <span class="text-xs font-medium">Dark</span>
                        </button>
                        
                        <button 
                          type="button"
                          class="p-3 border rounded-lg transition-all duration-200 flex flex-col items-center space-y-2"
                          [class]="getThemeButtonClass('system')"
                          (click)="setTheme('system')">
                          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span class="text-xs font-medium">System</span>
                        </button>
                      </div>
                    </div>

                    <!-- Language Settings -->
                    <div>
                      <label class="form-label">Language</label>
                      <select class="form-input" formControlName="language">
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                        <option value="ar">العربية</option>
                      </select>
                    </div>

                    <!-- Dashboard Layout -->
                    <div>
                      <label class="form-label">Dashboard Layout</label>
                      <div class="grid grid-cols-2 gap-3 mt-2">
                        <button 
                          type="button"
                          class="p-4 border rounded-lg transition-all duration-200 flex flex-col items-center space-y-2"
                          [class]="getLayoutButtonClass('standard')"
                          (click)="setDashboardLayout('standard')">
                          <div class="w-8 h-6 bg-gray-300 dark:bg-gray-600 rounded flex flex-col space-y-1 p-1">
                            <div class="h-1 bg-blue-500 rounded"></div>
                            <div class="h-1 bg-gray-400 rounded"></div>
                            <div class="h-1 bg-gray-400 rounded"></div>
                          </div>
                          <span class="text-xs font-medium">Standard</span>
                        </button>
                        
                        <button 
                          type="button"
                          class="p-4 border rounded-lg transition-all duration-200 flex flex-col items-center space-y-2"
                          [class]="getLayoutButtonClass('compact')"
                          (click)="setDashboardLayout('compact')">
                          <div class="w-8 h-6 bg-gray-300 dark:bg-gray-600 rounded flex flex-col space-y-0.5 p-1">
                            <div class="h-0.5 bg-blue-500 rounded"></div>
                            <div class="h-0.5 bg-gray-400 rounded"></div>
                            <div class="h-0.5 bg-gray-400 rounded"></div>
                            <div class="h-0.5 bg-gray-400 rounded"></div>
                            <div class="h-0.5 bg-gray-400 rounded"></div>
                          </div>
                          <span class="text-xs font-medium">Compact</span>
                        </button>
                      </div>
                    </div>

                    <!-- Notification Settings -->
                    <div>
                      <label class="form-label">Notifications</label>
                      <div class="space-y-3 mt-2">
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="text-sm font-medium text-gray-900 dark:text-white">Email Notifications</p>
                            <p class="text-xs text-gray-600 dark:text-gray-400">Receive notifications via email</p>
                          </div>
                          <label class="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              class="sr-only peer"
                              formControlName="emailNotifications">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="text-sm font-medium text-gray-900 dark:text-white">SMS Notifications</p>
                            <p class="text-xs text-gray-600 dark:text-gray-400">Receive notifications via SMS</p>
                          </div>
                          <label class="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              class="sr-only peer"
                              formControlName="smsNotifications">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="text-sm font-medium text-gray-900 dark:text-white">Browser Notifications</p>
                            <p class="text-xs text-gray-600 dark:text-gray-400">Receive notifications in browser</p>
                          </div>
                          <label class="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              class="sr-only peer"
                              formControlName="browserNotifications">
                            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <!-- Preferences Actions -->
                    <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button 
                        type="button"
                        class="btn-secondary"
                        (click)="resetPreferencesForm()">
                        Reset
                      </button>
                      <button 
                        type="submit"
                        class="btn-primary"
                        [disabled]="preferencesForm.invalid || isLoading()">
                        @if (isLoading()) {
                          <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        } @else {
                          Save Preferences
                        }
                      </button>
                    </div>
                  </form>
                }

                <!-- Security Tab -->
                @if (activeTab() === 'security') {
                  <form [formGroup]="passwordForm" (ngSubmit)="onChangePassword()" class="space-y-6">
                    
                    <div class="bg-amber-50 dark:bg-amber-900 dark:bg-opacity-30 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-6">
                      <div class="flex items-start">
                        <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <h3 class="text-sm font-medium text-amber-800 dark:text-amber-300">Security Reminder</h3>
                          <p class="text-sm text-amber-700 dark:text-amber-400 mt-1">Use a strong password with at least 8 characters, including uppercase, lowercase, and numbers.</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label class="form-label">Current Password</label>
                      <div class="relative">
                        <input 
                          [type]="showCurrentPassword() ? 'text' : 'password'"
                          class="form-input pr-10"
                          formControlName="currentPassword"
                          placeholder="Enter current password"
                          [class.border-red-500]="isFieldInvalid('currentPassword', passwordForm)">
                        <button 
                          type="button"
                          class="absolute inset-y-0 right-0 pr-3 flex items-center"
                          (click)="toggleCurrentPasswordVisibility()">
                          <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            @if (showCurrentPassword()) {
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            } @else {
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            }
                          </svg>
                        </button>
                      </div>
                      @if (isFieldInvalid('currentPassword', passwordForm)) {
                        <p class="mt-1 text-sm text-red-600 dark:text-red-400">Current password is required</p>
                      }
                    </div>

                    <div>
                      <label class="form-label">New Password</label>
                      <div class="relative">
                        <input 
                          [type]="showNewPassword() ? 'text' : 'password'"
                          class="form-input pr-10"
                          formControlName="newPassword"
                          placeholder="Enter new password"
                          [class.border-red-500]="isFieldInvalid('newPassword', passwordForm)">
                        <button 
                          type="button"
                          class="absolute inset-y-0 right-0 pr-3 flex items-center"
                          (click)="toggleNewPasswordVisibility()">
                          <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            @if (showNewPassword()) {
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            } @else {
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            }
                          </svg>
                        </button>
                      </div>
                      @if (isFieldInvalid('newPassword', passwordForm)) {
                        <p class="mt-1 text-sm text-red-600 dark:text-red-400">Password must be at least 6 characters</p>
                      }
                    </div>

                    <div>
                      <label class="form-label">Confirm New Password</label>
                      <div class="relative">
                        <input 
                          [type]="showConfirmNewPassword() ? 'text' : 'password'"
                          class="form-input pr-10"
                          formControlName="confirmPassword"
                          placeholder="Confirm new password"
                          [class.border-red-500]="isFieldInvalid('confirmPassword', passwordForm) || hasNewPasswordMismatch()">
                        <button 
                          type="button"
                          class="absolute inset-y-0 right-0 pr-3 flex items-center"
                          (click)="toggleConfirmNewPasswordVisibility()">
                          <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            @if (showConfirmNewPassword()) {
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            } @else {
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            }
                          </svg>
                        </button>
                      </div>
                      @if (isFieldInvalid('confirmPassword', passwordForm)) {
                        <p class="mt-1 text-sm text-red-600 dark:text-red-400">Please confirm your password</p>
                      } @else if (hasNewPasswordMismatch()) {
                        <p class="mt-1 text-sm text-red-600 dark:text-red-400">Passwords do not match</p>
                      }
                    </div>

                    <!-- Security Actions -->
                    <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button 
                        type="button"
                        class="btn-secondary"
                        (click)="resetPasswordForm()">
                        Reset
                      </button>
                      <button 
                        type="submit"
                        class="btn-primary"
                        [disabled]="passwordForm.invalid || isLoading()">
                        @if (isLoading()) {
                          <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Changing...
                        } @else {
                          Change Password
                        }
                      </button>
                    </div>
                  </form>
                }

              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Success Message -->
      @if (successMessage()) {
        <div class="fixed bottom-4 right-4 z-50">
          <div class="bg-green-50 dark:bg-green-900 dark:bg-opacity-50 border border-green-200 dark:border-green-700 rounded-lg p-4 shadow-lg backdrop-blur-lg">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-sm font-medium text-green-800 dark:text-green-300">{{ successMessage() }}</p>
            </div>
          </div>
        </div>
      }

      <!-- Error Message -->
      @if (errorMessage()) {
        <div class="fixed bottom-4 right-4 z-50">
          <div class="bg-red-50 dark:bg-red-900 dark:bg-opacity-50 border border-red-200 dark:border-red-700 rounded-lg p-4 shadow-lg backdrop-blur-lg">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p class="text-sm font-medium text-red-800 dark:text-red-300">{{ errorMessage() }}</p>
            </div>
          </div>
        </div>
      }
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

    /* Smooth transitions */
    * {
      transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
    }
  `]
})
export class ProfileComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private languageService = inject(LanguageService);
  private destroy$ = new Subject<void>();

  activeTab = signal<'profile' | 'preferences' | 'security'>('profile');
  currentUser = signal<User | null>(null);
  isLoading = signal(false);
  errorMessage = signal<string>('');
  successMessage = signal<string>('');

  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmNewPassword = signal(false);

  profileForm!: FormGroup;
  preferencesForm!: FormGroup;
  passwordForm!: FormGroup;

  ngOnInit() {
    this.initializeForms();
    this.loadCurrentUser();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForms() {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: [''],
      garageName: ['', [Validators.required, Validators.minLength(2)]]
    });

    this.preferencesForm = this.fb.group({
      theme: ['system'],
      language: ['en'],
      dashboardLayout: ['standard'],
      emailNotifications: [true],
      smsNotifications: [false],
      browserNotifications: [true]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    });
  }

  private loadCurrentUser() {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          this.currentUser.set(user);
          this.populateForms(user);
        } else {
          this.router.navigate(['/auth']);
        }
      });

    // Also listen to language changes from the language toggle
    this.languageService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(language => {
        this.preferencesForm.patchValue({ language }, { emitEvent: false });
      });
  }

  private populateForms(user: User) {
    this.profileForm.patchValue({
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber || '',
      garageName: user.garageName
    });

    if (user.preferences) {
      this.preferencesForm.patchValue({
        theme: user.preferences.theme,
        language: user.preferences.language || this.languageService.getCurrentLanguage(),
        dashboardLayout: user.preferences.dashboardLayout,
        emailNotifications: user.preferences.notifications.email,
        smsNotifications: user.preferences.notifications.sms,
        browserNotifications: user.preferences.notifications.browser
      });
    } else {
      // Set current language if no preferences exist
      this.preferencesForm.patchValue({
        language: this.languageService.getCurrentLanguage()
      });
    }
  }

  setActiveTab(tab: 'profile' | 'preferences' | 'security') {
    this.activeTab.set(tab);
    this.clearMessages();
  }

  onUpdateProfile() {
    if (this.profileForm.valid && !this.isLoading()) {
      this.isLoading.set(true);
      this.clearMessages();

      // In a real app, this would call an API
      setTimeout(() => {
        this.isLoading.set(false);
        this.successMessage.set('Profile updated successfully');
        this.clearSuccessMessage();
      }, 1000);
    }
  }

  onUpdatePreferences() {
    if (this.preferencesForm.valid && !this.isLoading()) {
      this.isLoading.set(true);
      this.clearMessages();

      // Update language service with new language preference
      const newLanguage = this.preferencesForm.get('language')?.value as SupportedLanguage;
      if (newLanguage !== this.languageService.getCurrentLanguage()) {
        this.languageService.setLanguage(newLanguage);
      }

      // In a real app, this would call an API to save all preferences
      setTimeout(() => {
        this.isLoading.set(false);
        this.successMessage.set('Preferences saved successfully');
        this.clearSuccessMessage();
      }, 1000);
    }
  }

  onChangePassword() {
    if (this.passwordForm.valid && !this.isLoading()) {
      this.isLoading.set(true);
      this.clearMessages();

      const request: ChangePasswordRequest = {
        currentPassword: this.passwordForm.get('currentPassword')?.value,
        newPassword: this.passwordForm.get('newPassword')?.value,
        confirmPassword: this.passwordForm.get('confirmPassword')?.value
      };

      this.authService.changePassword(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.isLoading.set(false);
            this.successMessage.set(response.message);
            this.passwordForm.reset();
            this.clearSuccessMessage();
          },
          error: (error: AuthError) => {
            this.isLoading.set(false);
            this.errorMessage.set(error.message);
            this.clearErrorMessage();
          }
        });
    }
  }

  setTheme(theme: 'light' | 'dark' | 'system') {
    this.preferencesForm.patchValue({ theme });
  }

  setDashboardLayout(layout: 'standard' | 'compact') {
    this.preferencesForm.patchValue({ dashboardLayout: layout });
  }

  getThemeButtonClass(theme: string): string {
    const isSelected = this.preferencesForm.get('theme')?.value === theme;
    return isSelected 
      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-50 text-blue-600 dark:text-blue-400'
      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700';
  }

  getLayoutButtonClass(layout: string): string {
    const isSelected = this.preferencesForm.get('dashboardLayout')?.value === layout;
    return isSelected 
      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-50 text-blue-600 dark:text-blue-400'
      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700';
  }

  toggleCurrentPasswordVisibility() {
    this.showCurrentPassword.set(!this.showCurrentPassword());
  }

  toggleNewPasswordVisibility() {
    this.showNewPassword.set(!this.showNewPassword());
  }

  toggleConfirmNewPasswordVisibility() {
    this.showConfirmNewPassword.set(!this.showConfirmNewPassword());
  }

  isFieldInvalid(fieldName: string, form: FormGroup): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  hasNewPasswordMismatch(): boolean {
    const newPassword = this.passwordForm.get('newPassword')?.value;
    const confirmPassword = this.passwordForm.get('confirmPassword')?.value;
    return !!(newPassword && confirmPassword && newPassword !== confirmPassword && 
              (this.passwordForm.get('confirmPassword')?.dirty || this.passwordForm.get('confirmPassword')?.touched));
  }

  resetProfileForm() {
    const user = this.currentUser();
    if (user) {
      this.populateForms(user);
    }
  }

  resetPreferencesForm() {
    const user = this.currentUser();
    if (user) {
      this.populateForms(user);
    }
  }

  resetPasswordForm() {
    this.passwordForm.reset();
    this.showCurrentPassword.set(false);
    this.showNewPassword.set(false);
    this.showConfirmNewPassword.set(false);
  }

  getInitials(): string {
    const user = this.currentUser();
    if (!user?.name) return 'U';
    
    return user.name
      .split(' ')
      .map(part => part.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  getRoleLabel(): string {
    const user = this.currentUser();
    return user?.role ? USER_ROLE_LABELS[user.role] : 'User';
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  logout() {
    this.authService.logout()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.router.navigate(['/auth']);
      });
  }

  private clearMessages() {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  private clearSuccessMessage() {
    setTimeout(() => {
      this.successMessage.set('');
    }, 3000);
  }

  private clearErrorMessage() {
    setTimeout(() => {
      this.errorMessage.set('');
    }, 5000);
  }
}