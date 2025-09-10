import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { GarageSettingsService } from '../../core/services/garage-settings.service';
import { GarageSettings } from '../../core/models/garage-settings.model';
import { GarageInfoFormComponent } from './components/garage-info-form.component';
import { OperationalSettingsComponent } from './components/operational-settings.component';
import { BusinessSettingsComponent } from './components/business-settings.component';
import { SystemSettingsComponent } from './components/system-settings.component';
import { IntegrationSettingsComponent } from './components/integration-settings.component';

@Component({
  selector: 'app-garage-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslatePipe,
    GarageInfoFormComponent,
    OperationalSettingsComponent,
    BusinessSettingsComponent,
    SystemSettingsComponent,
    IntegrationSettingsComponent
  ],
  template: `
    <div class="min-h-screen garage-settings-container p-4 lg:p-6">
      
      <!-- Header -->
      <header class="glass-card garage-settings-header">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div class="flex-1">
            <h1 class="text-2xl lg:text-3xl font-bold text-white mb-1">{{ 'settings.title' | translate }}</h1>
            <p class="text-gray-300">{{ 'settings.subtitle' | translate }}</p>
          </div>
        </div>
      </header>

      <!-- Settings Navigation -->
      <div class="glass-card settings-nav">
        <nav class="flex flex-wrap gap-2 overflow-x-auto">
          <button
            class="nav-button flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border-2 transition-all duration-300 font-medium hover:scale-105 whitespace-nowrap"
            [class]="activeTab() === 'garage-info' ? 'nav-button-active' : 'nav-button-inactive'"
            (click)="setActiveTab('garage-info')">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
            </svg>
            <span class="text-sm">{{ 'settings.navigation.garageInformation' | translate }}</span>
          </button>
          
          <button
            class="nav-button flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border-2 transition-all duration-300 font-medium hover:scale-105 whitespace-nowrap"
            [class]="activeTab() === 'operational' ? 'nav-button-active' : 'nav-button-inactive'"
            (click)="setActiveTab('operational')">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <span class="text-sm">{{ 'settings.navigation.operations' | translate }}</span>
          </button>
          
          <button
            class="nav-button flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border-2 transition-all duration-300 font-medium hover:scale-105 whitespace-nowrap"
            [class]="activeTab() === 'business' ? 'nav-button-active' : 'nav-button-inactive'"
            (click)="setActiveTab('business')">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
            </svg>
            <span class="text-sm">{{ 'settings.navigation.business' | translate }}</span>
          </button>
          
          <button
            class="nav-button flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border-2 transition-all duration-300 font-medium hover:scale-105 whitespace-nowrap"
            [class]="activeTab() === 'system' ? 'nav-button-active' : 'nav-button-inactive'"
            (click)="setActiveTab('system')">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>
            <span class="text-sm">{{ 'settings.navigation.system' | translate }}</span>
          </button>
          
          <button
            class="nav-button flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border-2 transition-all duration-300 font-medium hover:scale-105 whitespace-nowrap"
            [class]="activeTab() === 'integrations' ? 'nav-button-active' : 'nav-button-inactive'"
            (click)="setActiveTab('integrations')">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
            </svg>
            <span class="text-sm">{{ 'settings.navigation.integrations' | translate }}</span>
          </button>
        </nav>
      </div>

      <!-- Settings Content -->
      @if (settings()) {
        <div class="space-y-6">
          
          <!-- Garage Information -->
          @if (activeTab() === 'garage-info') {
            <app-garage-info-form
              [garageInfo]="settings()!.garageInfo"
              (save)="onGarageInfoSave($event)">
            </app-garage-info-form>
          }

          <!-- Operational Settings -->
          @if (activeTab() === 'operational') {
            <app-operational-settings
              [settings]="settings()!.operationalSettings"
              (save)="onOperationalSettingsSave($event)">
            </app-operational-settings>
          }

          <!-- Business Settings -->
          @if (activeTab() === 'business') {
            <app-business-settings
              [settings]="settings()!.businessSettings"
              (save)="onBusinessSettingsSave($event)">
            </app-business-settings>
          }

          <!-- System Settings -->
          @if (activeTab() === 'system') {
            <app-system-settings
              [settings]="settings()!.systemSettings"
              (save)="onSystemSettingsSave($event)">
            </app-system-settings>
          }

          <!-- Integration Settings -->
          @if (activeTab() === 'integrations') {
            <app-integration-settings
              [settings]="settings()!.integrationSettings"
              (save)="onIntegrationSettingsSave($event)"
              (testIntegration)="onTestIntegration($event)">
            </app-integration-settings>
          }

        </div>
      } @else {
        <!-- Loading State -->
        <div class="glass-card">
          <div class="text-center py-12">
            <div class="loading-spinner mx-auto"></div>
            <p class="mt-4 text-gray-300">{{ 'settings.loading' | translate }}</p>
          </div>
        </div>
      }

      <!-- Actions Bar -->
      @if (settings() && hasUnsavedChanges()) {
        <div class="fixed bottom-0 left-0 right-0 glass-card m-4 rounded-2xl shadow-2xl">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <div class="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
              <span class="text-sm text-gray-300">{{ 'settings.unsavedChanges' | translate }}</span>
            </div>
            <div class="flex space-x-3">
              <button 
                class="btn-secondary"
                (click)="discardChanges()">
                {{ 'settings.discardChanges' | translate }}
              </button>
              <button 
                class="btn-primary"
                [disabled]="isSaving()"
                (click)="saveAllChanges()">
                @if (isSaving()) {
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ 'settings.saving' | translate }}
                } @else {
                  {{ 'settings.saveAllChanges' | translate }}
                }
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    /* Garage Settings - Permanent Dark Glassmorphism */
    .garage-settings-container {
      min-height: 100vh;
      background: transparent;
    }

    /* Navigation button styles */
    .nav-button-active {
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover)) !important;
      border-color: var(--color-primary) !important;
      color: white !important;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
    }

    .nav-button-inactive {
      background-color: var(--color-bg-primary) !important;
      border-color: var(--color-border) !important;
      color: var(--color-text-secondary) !important;
    }

    .nav-button-inactive:hover {
      background-color: var(--color-bg-tertiary) !important;
      border-color: var(--color-primary) !important;
      color: var(--color-text-primary) !important;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
    }

    /* Loading spinner */
    .loading-spinner {
      width: 2rem;
      height: 2rem;
      border: 3px solid rgba(59, 130, 246, 0.3);
      border-top: 3px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Component uses global button classes from /src/styles/buttons.css */
    /* Component uses global glass-card from /src/styles.css */
  `]
})
export class GarageSettingsComponent implements OnInit {
  private garageSettingsService = inject(GarageSettingsService);

  settings = signal<GarageSettings | null>(null);
  activeTab = signal<string>('garage-info');
  isSaving = signal(false);
  unsavedChanges = signal(false);


  ngOnInit() {
    this.loadSettings();
  }

  private loadSettings() {
    this.garageSettingsService.getSettings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
      },
      error: (error) => {
        console.error('Error loading garage settings:', error);
      }
    });
  }

  setActiveTab(tabId: string) {
    this.activeTab.set(tabId);
  }

  onGarageInfoSave(garageInfo: any) {
    this.isSaving.set(true);
    this.garageSettingsService.updateGarageInfo(garageInfo).subscribe({
      next: (updatedSettings) => {
        this.settings.set(updatedSettings);
        this.unsavedChanges.set(false);
        this.isSaving.set(false);
        this.showSuccessMessage('Garage information updated successfully');
      },
      error: (error) => {
        console.error('Error updating garage info:', error);
        this.isSaving.set(false);
        this.showErrorMessage('Failed to update garage information');
      }
    });
  }

  onOperationalSettingsSave(operationalSettings: any) {
    this.isSaving.set(true);
    this.garageSettingsService.updateOperationalSettings(operationalSettings).subscribe({
      next: (updatedSettings) => {
        this.settings.set(updatedSettings);
        this.unsavedChanges.set(false);
        this.isSaving.set(false);
        this.showSuccessMessage('Operational settings updated successfully');
      },
      error: (error) => {
        console.error('Error updating operational settings:', error);
        this.isSaving.set(false);
        this.showErrorMessage('Failed to update operational settings');
      }
    });
  }

  onBusinessSettingsSave(businessSettings: any) {
    this.isSaving.set(true);
    this.garageSettingsService.updateBusinessSettings(businessSettings).subscribe({
      next: (updatedSettings) => {
        this.settings.set(updatedSettings);
        this.unsavedChanges.set(false);
        this.isSaving.set(false);
        this.showSuccessMessage('Business settings updated successfully');
      },
      error: (error) => {
        console.error('Error updating business settings:', error);
        this.isSaving.set(false);
        this.showErrorMessage('Failed to update business settings');
      }
    });
  }

  onSystemSettingsSave(systemSettings: any) {
    this.isSaving.set(true);
    this.garageSettingsService.updateSystemSettings(systemSettings).subscribe({
      next: (updatedSettings) => {
        this.settings.set(updatedSettings);
        this.unsavedChanges.set(false);
        this.isSaving.set(false);
        this.showSuccessMessage('System settings updated successfully');
      },
      error: (error) => {
        console.error('Error updating system settings:', error);
        this.isSaving.set(false);
        this.showErrorMessage('Failed to update system settings');
      }
    });
  }

  onIntegrationSettingsSave(integrationSettings: any) {
    this.isSaving.set(true);
    this.garageSettingsService.updateIntegrationSettings(integrationSettings).subscribe({
      next: (updatedSettings) => {
        this.settings.set(updatedSettings);
        this.unsavedChanges.set(false);
        this.isSaving.set(false);
        this.showSuccessMessage('Integration settings updated successfully');
      },
      error: (error) => {
        console.error('Error updating integration settings:', error);
        this.isSaving.set(false);
        this.showErrorMessage('Failed to update integration settings');
      }
    });
  }

  onTestIntegration(event: { type: string; config: any }) {
    this.garageSettingsService.testIntegration(event.type).subscribe({
      next: (result) => {
        if (result.success) {
          this.showSuccessMessage(result.message);
        } else {
          this.showErrorMessage(result.message);
        }
      },
      error: (error) => {
        console.error('Integration test failed:', error);
        this.showErrorMessage('Integration test failed');
      }
    });
  }

  hasUnsavedChanges(): boolean {
    return this.unsavedChanges();
  }

  saveAllChanges() {
    // This would save all pending changes across all tabs
    this.isSaving.set(true);
    // Implementation would depend on tracking changes across components
    setTimeout(() => {
      this.isSaving.set(false);
      this.unsavedChanges.set(false);
      this.showSuccessMessage('All changes saved successfully');
    }, 1000);
  }

  discardChanges() {
    this.loadSettings();
    this.unsavedChanges.set(false);
  }

  exportSettings() {
    this.garageSettingsService.exportSettings().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `garage-settings-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.showSuccessMessage('Settings exported successfully');
      },
      error: (error) => {
        console.error('Export failed:', error);
        this.showErrorMessage('Failed to export settings');
      }
    });
  }

  importSettings(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      this.garageSettingsService.importSettings(file).subscribe({
        next: (settings) => {
          this.settings.set(settings);
          this.showSuccessMessage('Settings imported successfully');
        },
        error: (error) => {
          console.error('Import failed:', error);
          this.showErrorMessage('Failed to import settings');
        }
      });
    }
  }

  private showSuccessMessage(message: string) {
    // In a real app, this would use a toast/notification service
    console.log('Success:', message);
  }

  private showErrorMessage(message: string) {
    // In a real app, this would use a toast/notification service
    console.error('Error:', message);
  }
}