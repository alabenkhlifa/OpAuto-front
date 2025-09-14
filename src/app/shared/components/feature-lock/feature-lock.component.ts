import { Component, Input, Output, EventEmitter, computed, signal, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { SubscriptionTierId } from '../../../core/models/subscription.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AccessibilityService } from '../../services/accessibility.service';

export interface FeatureLockConfig {
  feature: string;
  requiredTier?: SubscriptionTierId;
  title?: string;
  description?: string;
  showUpgradeButton?: boolean;
  customMessage?: string;
}

@Component({
  selector: 'app-feature-lock',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="feature-container" [class.feature-locked]="isLocked()">
      <ng-content></ng-content>
      
      @if (isLocked() && shouldShowOverlay()) {
        <div class="feature-lock-overlay" 
             role="dialog" 
             aria-modal="true"
             [attr.aria-label]="getLockAriaLabel()"
             tabindex="0">
          
          <div class="lock-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 10V8C6 5.79086 7.79086 4 10 4H14C16.2091 4 18 5.79086 18 8V10M6 10H18M6 10C4.89543 10 4 10.8954 4 12V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V12C20 10.8954 19.1046 10 18 10" 
                    stroke="currentColor" 
                    stroke-width="2" 
                    stroke-linecap="round" 
                    stroke-linejoin="round"/>
            </svg>
          </div>
          
          <div class="lock-text">
            {{ getLockMessage() | translate }}
          </div>
          
          @if (config.showUpgradeButton !== false) {
            <button 
              class="upgrade-cta"
              (click)="onUpgradeClick()"
              [attr.aria-label]="getUpgradeAriaLabel()"
              type="button">
              {{ 'tiers.upgrade' | translate }}
            </button>
          }
          
          @if (config.showUpgradeButton !== false && getRequiredTierName()) {
            <div class="tier-info">
              {{ 'tiers.availableIn' | translate: { tier: getRequiredTierName() } }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .feature-container {
      position: relative;
    }
    
    .tier-info {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-top: 0.25rem;
      text-align: center;
    }
  `]
})
export class FeatureLockComponent implements OnInit, OnDestroy {
  @Input() config: FeatureLockConfig = { feature: '', showUpgradeButton: true };
  @Input() feature: string = '';
  @Input() requiredTier?: SubscriptionTierId;
  @Input() title?: string;
  @Input() description?: string;
  @Input() showUpgradeButton: boolean = true;
  @Input() customMessage?: string;
  @Input() showOverlayInput: boolean = true;
  
  @Output() upgradeClicked = new EventEmitter<{ feature: string; requiredTier?: SubscriptionTierId }>();

  // Computed signals for reactive state
  isLocked = computed(() => {
    const featureKey = this.getFeatureKey();
    if (!featureKey) return false;
    
    // For demo purposes, we'll use a simple check
    // In real implementation, this would be connected to the subscription service
    return !this.subscriptionService.isFeatureEnabled(featureKey);
  });

  private loadingSignal = signal(false);
  private escapeKeyHandler?: () => void;
  
  constructor(
    private subscriptionService: SubscriptionService,
    private accessibilityService: AccessibilityService,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    // Set up escape key handler for overlay
    if (this.isLocked() && this.showOverlayInput) {
      this.escapeKeyHandler = this.accessibilityService.handleEscapeKey(() => {
        // Focus back to the main content when overlay is dismissed via keyboard
        this.accessibilityService.announce('Feature lock overlay dismissed', 'polite');
      });
    }

    // Announce feature lock status to screen readers when component initializes
    if (this.isLocked()) {
      const featureName = this.config?.title || this.title || this.getFeatureKey();
      const requiredTier = this.getRequiredTierName();
      this.accessibilityService.announceFeatureLock(featureName, requiredTier);
    }
  }

  ngOnDestroy(): void {
    if (this.escapeKeyHandler) {
      this.escapeKeyHandler();
    }
  }

  private getFeatureKey(): string {
    return this.config?.feature || this.feature || '';
  }

  shouldShowOverlay(): boolean {
    return this.showOverlayInput;
  }

  getLockMessage(): string {
    if (this.config?.customMessage) return this.config.customMessage;
    if (this.customMessage) return this.customMessage;
    
    const requiredTier = this.getRequiredTierName();
    if (requiredTier) {
      return 'tiers.featureLockedWithTier';
    }
    
    return 'tiers.featureLocked';
  }

  getLockAriaLabel(): string {
    const featureName = this.config?.title || this.title || this.getFeatureKey();
    return `Feature ${featureName} is locked. Upgrade required.`;
  }

  getUpgradeAriaLabel(): string {
    const requiredTier = this.getRequiredTierName();
    return requiredTier 
      ? `Upgrade to ${requiredTier} to unlock this feature`
      : 'Upgrade your plan to unlock this feature';
  }

  getRequiredTierName(): string | null {
    const tier = this.config?.requiredTier || this.requiredTier;
    if (tier) return tier;
    
    const featureKey = this.getFeatureKey();
    if (!featureKey) return null;
    
    return this.subscriptionService.getUpgradeTierForFeature(featureKey);
  }

  onUpgradeClick(): void {
    const featureKey = this.getFeatureKey();
    const requiredTier = this.getRequiredTierName() as SubscriptionTierId;
    
    // Announce the upgrade action to screen readers
    const tierName = requiredTier || 'a higher tier';
    this.accessibilityService.announce(`Opening upgrade dialog for ${tierName}`, 'polite');
    
    this.upgradeClicked.emit({
      feature: featureKey,
      requiredTier
    });
  }

  // Method to check feature access (for programmatic use)
  hasFeatureAccess(): Observable<boolean> {
    const featureKey = this.getFeatureKey();
    if (!featureKey) return new Observable(observer => observer.next(true));
    
    return this.subscriptionService.hasFeature(featureKey);
  }

  // Method to get upgrade tier info (for programmatic use)
  getUpgradeTierInfo(): { tier: SubscriptionTierId | null; name: string | null } {
    const tier = this.getRequiredTierName() as SubscriptionTierId;
    return {
      tier,
      name: tier
    };
  }
}