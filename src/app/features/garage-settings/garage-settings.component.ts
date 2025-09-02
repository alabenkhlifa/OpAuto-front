import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
    GarageInfoFormComponent,
    OperationalSettingsComponent,
    BusinessSettingsComponent,
    SystemSettingsComponent,
    IntegrationSettingsComponent
  ],
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          Garage Settings
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure your garage operations, business rules, and system preferences
        </p>
      </div>

      <!-- Settings Navigation -->
      <div class="mb-6">
        <nav class="flex space-x-8 overflow-x-auto">
          @for (tab of settingsTabs; track tab.id) {
            <button
              class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors"
              [class]="activeTab() === tab.id ? 
                'border-blue-500 text-blue-600 dark:text-blue-400' : 
                'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'"
              (click)="setActiveTab(tab.id)">
              <div class="flex items-center space-x-2">
                <svg class="w-4 h-4" [innerHTML]="tab.icon"></svg>
                <span>{{ tab.label }}</span>
              </div>
            </button>
          }
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
        <div class="text-center py-12">
          <div class="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p class="mt-2 text-gray-500 dark:text-gray-400">Loading settings...</p>
        </div>
      }

      <!-- Actions Bar -->
      @if (settings() && hasUnsavedChanges()) {
        <div class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg">
          <div class="max-w-7xl mx-auto flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <div class="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span class="text-sm text-gray-600 dark:text-gray-400">You have unsaved changes</span>
            </div>
            <div class="flex space-x-3">
              <button 
                class="btn-secondary"
                (click)="discardChanges()">
                Discard Changes
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
                  Saving...
                } @else {
                  Save All Changes
                }
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .btn-primary {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border: 1px solid transparent;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.375rem;
      color: white;
      background-color: #2563eb;
      gap: 0.5rem;
    }
    
    .btn-primary:hover:not(:disabled) {
      background-color: #1d4ed8;
    }
    
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      border: 1px solid #d1d5db;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 0.375rem;
      color: #374151;
      background-color: white;
      gap: 0.5rem;
    }
    
    .btn-secondary:hover {
      background-color: #f9fafb;
    }
    
    .dark .btn-secondary {
      border-color: #4b5563;
      color: #d1d5db;
      background-color: #1f2937;
    }
    
    .dark .btn-secondary:hover {
      background-color: #374151;
    }
  `]
})
export class GarageSettingsComponent implements OnInit {
  private garageSettingsService = inject(GarageSettingsService);

  settings = signal<GarageSettings | null>(null);
  activeTab = signal<string>('garage-info');
  isSaving = signal(false);
  unsavedChanges = signal(false);

  settingsTabs = [
    {
      id: 'garage-info',
      label: 'Garage Information',
      icon: '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>'
    },
    {
      id: 'operational',
      label: 'Operations',
      icon: '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>'
    },
    {
      id: 'business',
      label: 'Business',
      icon: '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>'
    },
    {
      id: 'system',
      label: 'System',
      icon: '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>'
    },
    {
      id: 'integrations',
      label: 'Integrations',
      icon: '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>'
    }
  ];

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