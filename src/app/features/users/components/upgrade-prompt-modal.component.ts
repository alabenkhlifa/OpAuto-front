import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { UpgradePrompt } from '../../../core/models/user.model';

@Component({
  selector: 'app-upgrade-prompt-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        
        <!-- Background overlay -->
        <div class="fixed inset-0 bg-black/75 transition-opacity" (click)="onClose()"></div>

        <!-- Modal -->
        <div class="relative inline-block transform overflow-hidden rounded-lg bg-gray-800 px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6 sm:align-middle border border-gray-600">
          
          <!-- Header -->
          <div class="text-center mb-6">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100/10 mb-4">
              <svg class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-white mb-2">
              {{ 'tiers.upgradeRequired' | translate }}
            </h3>
            <p class="text-gray-300">
              {{ 'tiers.upgradeToAddMoreUsers' | translate }}
            </p>
          </div>

          <!-- Current vs New Tier Comparison -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            
            <!-- Current Tier -->
            <div class="border border-gray-600 rounded-lg p-4">
              <div class="text-center mb-4">
                <h4 class="text-lg font-semibold text-gray-300">{{ 'tiers.currentPlan' | translate }}</h4>
                <div class="text-2xl font-bold text-white mt-2 capitalize">
                  {{ 'tiers.' + upgradePrompt.currentTier.id | translate }}
                </div>
                <div class="text-gray-400">
                  {{ upgradePrompt.currentTier.price }} {{ upgradePrompt.currentTier.currency }}/{{ 'common.month' | translate }}
                </div>
              </div>
              
              <!-- Current Tier Limits -->
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-400">{{ 'users.maxUsers' | translate }}</span>
                  <span class="text-white">
                    {{ upgradePrompt.currentTier.limits.users || '∞' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Suggested Tier -->
            <div class="border-2 border-blue-500 rounded-lg p-4 relative">
              <div class="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span class="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                  {{ 'tiers.recommended' | translate }}
                </span>
              </div>
              
              <div class="text-center mb-4">
                <h4 class="text-lg font-semibold text-blue-400">{{ 'tiers.upgradeTo' | translate }}</h4>
                <div class="text-2xl font-bold text-white mt-2 capitalize">
                  {{ 'tiers.' + upgradePrompt.suggestedTier.id | translate }}
                </div>
                <div class="text-gray-300">
                  {{ upgradePrompt.suggestedTier.price }} {{ upgradePrompt.suggestedTier.currency }}/{{ 'common.month' | translate }}
                </div>
                <div class="text-sm text-blue-400 mt-1">
                  +{{ upgradePrompt.priceComparison.additionalCost }} {{ upgradePrompt.suggestedTier.currency }}/{{ 'common.month' | translate }}
                </div>
              </div>
              
              <!-- New Tier Limits -->
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-400">{{ 'users.maxUsers' | translate }}</span>
                  <span class="text-blue-400 font-medium">
                    {{ upgradePrompt.suggestedTier.limits.users ? upgradePrompt.suggestedTier.limits.users : ('tiers.unlimited' | translate) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Benefits -->
          @if (upgradePrompt.benefits.length > 0) {
            <div class="mb-6">
              <h4 class="text-lg font-semibold text-white mb-3">
                {{ 'tiers.whatsIncluded' | translate }}
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                @for (benefit of upgradePrompt.benefits; track benefit) {
                  <div class="flex items-center text-sm text-gray-300">
                    <svg class="w-4 h-4 text-green-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    {{ benefit }}
                  </div>
                }
              </div>
            </div>
          }

          <!-- Upgrade CTA -->
          <div class="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-blue-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="text-sm text-blue-300">
                {{ 'tiers.upgradeMessage' | translate }}
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-between items-center">
            <button
              type="button"
              class="text-gray-400 hover:text-white text-sm"
              (click)="onClose()">
              {{ 'tiers.maybeLater' | translate }}
            </button>
            
            <div class="flex space-x-3">
              <button
                type="button"
                class="btn-secondary"
                (click)="onClose()">
                {{ 'common.cancel' | translate }}
              </button>
              <button
                type="button"
                class="btn-primary"
                [disabled]="upgrading()"
                (click)="onUpgrade()">
                @if (upgrading()) {
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ 'tiers.upgrading' | translate }}
                } @else {
                  {{ 'tiers.upgradeNow' | translate }}
                }
              </button>
            </div>
          </div>

          <!-- Note -->
          <div class="mt-4 text-center text-xs text-gray-500">
            {{ 'tiers.upgradeNote' | translate }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Component uses global classes from /src/styles/ */
  `]
})
export class UpgradePromptModalComponent {
  @Input({ required: true }) upgradePrompt!: UpgradePrompt;
  @Output() close = new EventEmitter<void>();
  @Output() upgrade = new EventEmitter<string>();

  upgrading = signal(false);

  onClose() {
    this.close.emit();
  }

  onUpgrade() {
    this.upgrading.set(true);
    
    // Simulate upgrade process
    setTimeout(() => {
      this.upgrade.emit(this.upgradePrompt.suggestedTier.id);
      this.upgrading.set(false);
    }, 2000);
  }
}