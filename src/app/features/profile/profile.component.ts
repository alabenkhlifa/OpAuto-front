import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { User, ChangePasswordRequest, AuthError, UserRole, USER_ROLE_LABELS } from '../../core/models/auth.model';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="min-h-screen p-6">
      <!-- Header -->
      <div class="glass-card mb-6">
        <div>
          <h1 class="text-3xl font-bold text-white">{{ 'profile.title' | translate }}</h1>
          <p class="text-gray-300 mt-1">{{ 'profile.subtitle' | translate }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Profile Card -->
        <div class="lg:col-span-1">
          <div class="glass-card">
            <!-- Avatar Section -->
            <div class="text-center mb-6">
              <div class="mx-auto w-24 h-24 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mb-4">
                @if (currentUser()?.avatar) {
                  <img [src]="currentUser()?.avatar" [alt]="currentUser()?.name" class="w-24 h-24 rounded-full object-cover">
                } @else {
                  <span class="text-2xl font-bold text-white">{{ getInitials() }}</span>
                }
              </div>

              <h2 class="text-xl font-semibold text-white">{{ currentUser()?.name }}</h2>
              <p class="text-blue-400 font-medium">{{ getRoleLabel() }}</p>
              <p class="text-gray-300 text-sm mt-1">{{ currentUser()?.garageName }}</p>
            </div>

            <!-- Quick Stats -->
            <div class="space-y-3">
              <div class="flex justify-between items-center py-2 border-b border-white/10">
                <span class="text-gray-300 text-sm">{{ 'profile.memberSince' | translate }}</span>
                <span class="text-white text-sm font-medium">{{ formatDate(currentUser()?.createdAt) }}</span>
              </div>
              <div class="flex justify-between items-center py-2 border-b border-white/10">
                <span class="text-gray-300 text-sm">{{ 'profile.lastLogin' | translate }}</span>
                <span class="text-white text-sm font-medium">{{ formatDate(currentUser()?.lastLogin) }}</span>
              </div>
              <div class="flex justify-between items-center py-2">
                <span class="text-gray-300 text-sm">{{ 'profile.accountStatus' | translate }}</span>
                <span [class]="currentUser()?.isActive ? 'badge badge-active' : 'badge badge-inactive'">
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
              {{ 'profile.signOut' | translate }}
            </button>
          </div>
        </div>

        <!-- Settings Panel -->
        <div class="lg:col-span-2">
          <div class="glass-card">
            <!-- Tab Navigation -->
            <div class="flex border-b border-white/10 rounded-t-2xl overflow-hidden mb-6">
              <button
                class="nav-button flex-1 py-4 px-6 text-sm font-medium transition-all duration-200"
                [class]="activeTab() === 'profile' ? 'nav-button-active' : 'nav-button-inactive'"
                (click)="setActiveTab('profile')">
                <div class="flex items-center justify-center gap-2">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {{ 'profile.tabs.profile' | translate }}
                </div>
              </button>

              <button
                class="nav-button flex-1 py-4 px-6 text-sm font-medium transition-all duration-200"
                [class]="activeTab() === 'preferences' ? 'nav-button-active' : 'nav-button-inactive'"
                (click)="setActiveTab('preferences')">
                <div class="flex items-center justify-center gap-2">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                  {{ 'profile.tabs.preferences' | translate }}
                </div>
              </button>

              <button
                class="nav-button flex-1 py-4 px-6 text-sm font-medium transition-all duration-200"
                [class]="activeTab() === 'security' ? 'nav-button-active' : 'nav-button-inactive'"
                (click)="setActiveTab('security')">
                <div class="flex items-center justify-center gap-2">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {{ 'profile.tabs.security' | translate }}
                </div>
              </button>
            </div>

            <!-- Tab Content -->
            <div>

                <!-- Profile Tab -->
                @if (activeTab() === 'profile') {
                  <form [formGroup]="profileForm" (ngSubmit)="onUpdateProfile()" class="space-y-6">

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="form-label">{{ 'profile.profileForm.fullName' | translate }}</label>
                        <input
                          type="text"
                          class="form-input"
                          formControlName="name"
                          placeholder="Enter your full name"
                          [class.border-red-500]="isFieldInvalid('name', profileForm)">
                        @if (isFieldInvalid('name', profileForm)) {
                          <p class="mt-1 text-sm text-red-400">{{ 'profile.profileForm.fullNameRequired' | translate }}</p>
                        }
                      </div>

                      <div>
                        <label class="form-label">{{ 'profile.profileForm.emailAddress' | translate }}</label>
                        <input
                          type="email"
                          class="form-input"
                          formControlName="email"
                          placeholder="Enter your email"
                          [class.border-red-500]="isFieldInvalid('email', profileForm)">
                        @if (isFieldInvalid('email', profileForm)) {
                          <p class="mt-1 text-sm text-red-400">{{ 'profile.profileForm.emailRequired' | translate }}</p>
                        }
                      </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label class="form-label">{{ 'profile.profileForm.phoneNumber' | translate }}</label>
                        <input
                          type="tel"
                          class="form-input"
                          formControlName="phoneNumber"
                          placeholder="+216 XX XXX XXX">
                      </div>

                      <div>
                        <label class="form-label">{{ 'profile.profileForm.garageName' | translate }}</label>
                        <input
                          type="text"
                          class="form-input"
                          formControlName="garageName"
                          placeholder="Enter garage name"
                          [class.border-red-500]="isFieldInvalid('garageName', profileForm)">
                        @if (isFieldInvalid('garageName', profileForm)) {
                          <p class="mt-1 text-sm text-red-400">{{ 'profile.profileForm.garageNameRequired' | translate }}</p>
                        }
                      </div>
                    </div>

                    <!-- Profile Actions -->
                    <div class="flex justify-end space-x-3 pt-4 border-t border-white/10">
                      <button
                        type="button"
                        class="btn-secondary"
                        (click)="resetProfileForm()">
                        {{ 'profile.buttons.reset' | translate }}
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
                          {{ 'profile.loadingStates.updating' | translate }}
                        } @else {
                          {{ 'profile.buttons.updateProfile' | translate }}
                        }
                      </button>
                    </div>
                  </form>
                }

                <!-- Preferences Tab -->
                @if (activeTab() === 'preferences') {
                  <form [formGroup]="preferencesForm" (ngSubmit)="onUpdatePreferences()" class="space-y-6">

                    <!-- Notification Settings -->
                    <div>
                      <label class="form-label">{{ 'profile.preferences.notifications' | translate }}</label>
                      <div class="space-y-3 mt-2">
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="text-sm font-medium text-white">{{ 'profile.preferences.emailNotifications' | translate }}</p>
                            <p class="text-xs text-gray-400">{{ 'profile.preferences.emailNotificationsDescription' | translate }}</p>
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
                            <p class="text-sm font-medium text-white">{{ 'profile.preferences.smsNotifications' | translate }}</p>
                            <p class="text-xs text-gray-400">{{ 'profile.preferences.smsNotificationsDescription' | translate }}</p>
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
                            <p class="text-sm font-medium text-white">{{ 'profile.preferences.browserNotifications' | translate }}</p>
                            <p class="text-xs text-gray-400">{{ 'profile.preferences.browserNotificationsDescription' | translate }}</p>
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
                    <div class="flex justify-end space-x-3 pt-4 border-t border-white/10">
                      <button
                        type="button"
                        class="btn-secondary"
                        (click)="resetPreferencesForm()">
                        {{ 'profile.buttons.reset' | translate }}
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
                          {{ 'profile.loadingStates.saving' | translate }}
                        } @else {
                          {{ 'profile.buttons.savePreferences' | translate }}
                        }
                      </button>
                    </div>
                  </form>
                }

                <!-- Security Tab -->
                @if (activeTab() === 'security') {
                  <form [formGroup]="passwordForm" (ngSubmit)="onChangePassword()" class="space-y-6">

                    <div class="bg-amber-900/30 border border-amber-700 rounded-lg p-4 mb-6">
                      <div class="flex items-start">
                        <svg class="w-5 h-5 text-amber-400 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <h3 class="text-sm font-medium text-amber-300">{{ 'profile.security.securityReminderTitle' | translate }}</h3>
                          <p class="text-sm text-amber-400 mt-1">{{ 'profile.security.securityReminder' | translate }}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label class="form-label">{{ 'profile.security.currentPassword' | translate }}</label>
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
                        <p class="mt-1 text-sm text-red-400">{{ 'profile.security.currentPasswordRequired' | translate }}</p>
                      }
                    </div>

                    <div>
                      <label class="form-label">{{ 'profile.security.newPassword' | translate }}</label>
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
                        <p class="mt-1 text-sm text-red-400">{{ 'profile.security.newPasswordMinLength' | translate }}</p>
                      }
                    </div>

                    <div>
                      <label class="form-label">{{ 'profile.security.confirmPassword' | translate }}</label>
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
                        <p class="mt-1 text-sm text-red-400">{{ 'profile.security.confirmPasswordRequired' | translate }}</p>
                      } @else if (hasNewPasswordMismatch()) {
                        <p class="mt-1 text-sm text-red-400">{{ 'profile.security.passwordsMismatch' | translate }}</p>
                      }
                    </div>

                    <!-- Security Actions -->
                    <div class="flex justify-end space-x-3 pt-4 border-t border-white/10">
                      <button
                        type="button"
                        class="btn-secondary"
                        (click)="resetPasswordForm()">
                        {{ 'profile.buttons.reset' | translate }}
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
                          {{ 'profile.loadingStates.changing' | translate }}
                        } @else {
                          {{ 'profile.buttons.changePassword' | translate }}
                        }
                      </button>
                    </div>
                  </form>
                }

            </div>
          </div>
        </div>
      </div>

      <!-- Success Message -->
      @if (successMessage()) {
        <div class="fixed bottom-4 right-4 z-50">
          <div class="bg-green-900/50 border border-green-700 rounded-lg p-4 shadow-lg backdrop-blur-lg">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-sm font-medium text-green-300">{{ successMessage() }}</p>
            </div>
          </div>
        </div>
      }

      <!-- Error Message -->
      @if (errorMessage()) {
        <div class="fixed bottom-4 right-4 z-50">
          <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 shadow-lg backdrop-blur-lg">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p class="text-sm font-medium text-red-300">{{ errorMessage() }}</p>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    /* Component uses global glass-card, form, and button classes */
    .glass-card {
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(75, 85, 99, 0.6);
      border-radius: 20px;
      padding: 1.5rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .glass-card:hover {
      background: rgba(31, 41, 55, 0.98);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8);
      border-color: rgba(59, 130, 246, 0.7);
      transform: translateY(-2px);
    }

    .nav-button-active {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(29, 78, 216, 0.8));
      border-color: rgba(59, 130, 246, 0.6);
      color: white;
      box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
    }

    .nav-button-inactive {
      background-color: rgba(31, 41, 55, 0.6);
      border-color: rgba(75, 85, 99, 0.4);
      color: #9ca3af;
    }

    .nav-button-inactive:hover {
      background-color: rgba(31, 41, 55, 0.8);
      border-color: rgba(59, 130, 246, 0.4);
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
    }

    .toggle-button {
      position: relative;
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border: 2px solid;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s ease;
      cursor: pointer;
      min-width: 120px;
      justify-content: center;
    }
  `]
})
export class ProfileComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
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
        emailNotifications: user.preferences.notifications.email,
        smsNotifications: user.preferences.notifications.sms,
        browserNotifications: user.preferences.notifications.browser
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
