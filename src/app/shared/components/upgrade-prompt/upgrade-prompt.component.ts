import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal, computed, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { 
  SubscriptionTier, 
  SubscriptionTierId, 
  TierComparison 
} from '../../../core/models/subscription.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AccessibilityService } from '../../services/accessibility.service';

export interface UpgradePromptConfig {
  feature?: string;
  targetTier?: SubscriptionTierId;
  title?: string;
  description?: string;
  showComparison?: boolean;
  showFeatureList?: boolean;
  ctaText?: string;
}

@Component({
  selector: 'app-upgrade-prompt',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="upgrade-modal-overlay" 
         (click)="onOverlayClick($event)"
         role="dialog"
         aria-modal="true"
         [attr.aria-label]="getModalAriaLabel()">
      
      <div class="upgrade-modal glass-card" 
           #modalContent
           (click)="$event.stopPropagation()"
           tabindex="0">
        
        <!-- Modal Header -->
        <div class="modal-header">
          <h3 class="modal-title">
            {{ getModalTitle() | translate }}
          </h3>
          <button 
            class="close-button"
            (click)="onClose()"
            [attr.aria-label]="'common.close' | translate"
            type="button">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="modal-body">
          <div class="upgrade-description">
            {{ getModalDescription() | translate }}
          </div>

          @if (config.showComparison && tierComparison()) {
            <div class="tier-comparison">
              <h4 class="comparison-title">
                {{ 'tiers.choosePlan' | translate }}
              </h4>
              
              <div class="tier-cards">
                @for (tier of tierComparison()?.tiers; track tier.id) {
                  <div class="tier-card"
                       [class.current]="tier.id === tierComparison()?.currentTierId"
                       [class.recommended]="tier.id === tierComparison()?.recommendedTierId"
                       [class.popular]="tier.popular">
                    
                    @if (tier.popular) {
                      <div class="popular-badge badge badge-upgrade">
                        {{ 'tiers.popular' | translate }}
                      </div>
                    }
                    
                    @if (tier.id === tierComparison()?.currentTierId) {
                      <div class="current-badge badge badge-tier-starter">
                        {{ 'tiers.current' | translate }}
                      </div>
                    }
                    
                    <div class="tier-header">
                      <h5 class="tier-name">{{ tier.name }}</h5>
                      <div class="tier-price">
                        <span class="price">{{ tier.price }}</span>
                        <span class="currency">{{ tier.currency }}</span>
                        <span class="period">/{{ 'tiers.month' | translate }}</span>
                      </div>
                    </div>

                    @if (config.showFeatureList) {
                      <div class="tier-features">
                        @for (feature of getVisibleFeatures(tier); track feature.key) {
                          <div class="feature-item"
                               [class.enabled]="feature.enabled"
                               [class.disabled]="!feature.enabled">
                            <div class="feature-icon">
                              @if (feature.enabled) {
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                              } @else {
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                                </svg>
                              }
                            </div>
                            <span class="feature-text">
                              {{ ('features.' + feature.key) | translate }}
                            </span>
                          </div>
                        }
                      </div>
                    }

                    <button 
                      class="tier-cta-button"
                      [class.btn-primary]="canUpgradeTo(tier.id)"
                      [class.btn-secondary]="tier.id === tierComparison()?.currentTierId"
                      [class.btn-tertiary]="!canUpgradeTo(tier.id) && tier.id !== tierComparison()?.currentTierId"
                      [disabled]="!canUpgradeTo(tier.id) && tier.id !== tierComparison()?.currentTierId"
                      (click)="onUpgrade(tier.id)"
                      [attr.aria-label]="getTierCtaAriaLabel(tier)"
                      type="button">
                      {{ getTierCtaText(tier.id) | translate }}
                    </button>
                  </div>
                }
              </div>
            </div>
          } @else if (targetTier()) {
            <!-- Single tier upgrade prompt -->
            <div class="single-tier-upgrade">
              <div class="tier-highlight">
                <h4 class="tier-name">{{ getTargetTierName() }}</h4>
                <div class="tier-benefits">
                  <p>{{ 'tiers.upgradeMessage' | translate: { tier: getTargetTierName() } }}</p>
                </div>
              </div>
              
              <button 
                class="upgrade-cta-button btn-primary"
                (click)="onUpgrade(targetTier()!)"
                [attr.aria-label]="getSingleUpgradeAriaLabel()"
                type="button">
                {{ config.ctaText || 'tiers.upgradeNow' | translate }}
              </button>
            </div>
          }
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <button 
            class="btn-secondary"
            (click)="onClose()"
            type="button">
            {{ 'common.cancel' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
  host: {
    '(keydown)': 'onKeyDown($event)'
  },
  styles: [`
    .upgrade-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .upgrade-modal {
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      border-radius: 16px;
      position: relative;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid rgba(75, 85, 99, 0.3);
    }

    .modal-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }

    .close-button {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 8px;
      transition: all 0.2s ease;
    }

    .close-button:hover {
      color: #ffffff;
      background: rgba(75, 85, 99, 0.3);
    }

    .close-button svg {
      width: 1.5rem;
      height: 1.5rem;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .upgrade-description {
      font-size: 1rem;
      color: #d1d5db;
      margin-bottom: 2rem;
      line-height: 1.6;
    }

    .tier-comparison {
      margin-bottom: 2rem;
    }

    .comparison-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 1.5rem;
      text-align: center;
    }

    .tier-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .tier-card {
      background: rgba(31, 41, 55, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(75, 85, 99, 0.4);
      border-radius: 16px;
      padding: 1.5rem;
      position: relative;
      transition: all 0.3s ease;
    }

    .tier-card.popular {
      border-color: rgba(168, 85, 247, 0.5);
      transform: scale(1.05);
    }

    .tier-card.current {
      border-color: rgba(34, 197, 94, 0.5);
    }

    .popular-badge {
      position: absolute;
      top: -0.5rem;
      left: 50%;
      transform: translateX(-50%);
    }

    .current-badge {
      position: absolute;
      top: -0.5rem;
      right: 1rem;
    }

    .tier-header {
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .tier-name {
      font-size: 1.5rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.5rem;
    }

    .tier-price {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 0.25rem;
    }

    .price {
      font-size: 2rem;
      font-weight: 800;
      color: #ffffff;
    }

    .currency, .period {
      font-size: 1rem;
      color: #9ca3af;
    }

    .tier-features {
      margin-bottom: 2rem;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(75, 85, 99, 0.2);
    }

    .feature-item:last-child {
      border-bottom: none;
    }

    .feature-icon {
      width: 1.25rem;
      height: 1.25rem;
      flex-shrink: 0;
    }

    .feature-item.enabled .feature-icon {
      color: #22c55e;
    }

    .feature-item.disabled .feature-icon {
      color: #9ca3af;
    }

    .feature-text {
      font-size: 0.875rem;
      color: #d1d5db;
    }

    .feature-item.disabled .feature-text {
      color: #9ca3af;
      text-decoration: line-through;
    }

    .tier-cta-button {
      width: 100%;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .single-tier-upgrade {
      text-align: center;
      padding: 2rem;
      background: rgba(31, 41, 55, 0.6);
      border-radius: 12px;
      margin-bottom: 2rem;
    }

    .tier-highlight .tier-name {
      font-size: 1.5rem;
      font-weight: 700;
      color: #f59e0b;
      margin-bottom: 1rem;
    }

    .tier-benefits {
      color: #d1d5db;
      margin-bottom: 2rem;
      line-height: 1.6;
    }

    .upgrade-cta-button {
      padding: 1rem 2rem;
      font-size: 1.125rem;
      border-radius: 12px;
      font-weight: 700;
    }

    .modal-footer {
      padding: 1.5rem;
      border-top: 1px solid rgba(75, 85, 99, 0.3);
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
    }

    @media (max-width: 640px) {
      .upgrade-modal-overlay {
        padding: 0.5rem;
      }

      .tier-cards {
        grid-template-columns: 1fr;
      }

      .tier-card.popular {
        transform: none;
      }

      .modal-header {
        padding: 1rem;
      }

      .modal-body {
        padding: 1rem;
      }

      .modal-footer {
        padding: 1rem;
      }
    }
  `]
})
export class UpgradePromptComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('modalContent') modalContent?: ElementRef<HTMLElement>;
  @Input() config: UpgradePromptConfig = { showComparison: true, showFeatureList: true };
  @Input() isVisible: boolean = false;
  
  @Output() upgrade = new EventEmitter<{ tier: SubscriptionTierId; feature?: string }>();
  @Output() close = new EventEmitter<void>();

  tierComparison = signal<TierComparison | null>(null);
  loading = signal(false);
  
  targetTier = computed(() => this.config.targetTier);

  private focusTrapCleanup?: () => void;
  private escapeKeyHandler?: () => void;
  private previousActiveElement?: HTMLElement;

  constructor(
    private subscriptionService: SubscriptionService,
    private accessibilityService: AccessibilityService,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    if (this.config.showComparison) {
      this.loadTierComparison();
    }

    // Store the previously focused element
    this.previousActiveElement = document.activeElement as HTMLElement;

    // Set up escape key handler
    this.escapeKeyHandler = this.accessibilityService.handleEscapeKey(() => {
      this.onClose();
    });

    // Announce modal opening
    this.accessibilityService.announce('Upgrade options dialog opened', 'assertive');
  }

  ngAfterViewInit(): void {
    if (this.modalContent) {
      // Set up focus trap
      this.focusTrapCleanup = this.accessibilityService.createFocusTrap(
        this.modalContent.nativeElement
      );
    }
  }

  ngOnDestroy(): void {
    if (this.focusTrapCleanup) {
      this.focusTrapCleanup();
    }

    if (this.escapeKeyHandler) {
      this.escapeKeyHandler();
    }

    // Restore focus to previously focused element
    if (this.previousActiveElement) {
      this.accessibilityService.setFocus(this.previousActiveElement);
    }
  }

  private loadTierComparison(): void {
    this.loading.set(true);
    this.subscriptionService.getTierComparison().subscribe({
      next: (comparison) => {
        this.tierComparison.set(comparison);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  getModalTitle(): string {
    if (this.config.title) return this.config.title;
    if (this.config.feature) return 'tiers.unlockFeature';
    return 'tiers.upgradeTitle';
  }

  getModalDescription(): string {
    if (this.config.description) return this.config.description;
    if (this.config.feature) return 'tiers.upgradeForFeatureMessage';
    return 'tiers.upgradeMessage';
  }

  getModalAriaLabel(): string {
    return `Upgrade prompt modal: ${this.getModalTitle()}`;
  }

  getTargetTierName(): string {
    const tierId = this.targetTier();
    if (!tierId) return '';
    
    const comparison = this.tierComparison();
    const tier = comparison?.tiers.find(t => t.id === tierId);
    return tier?.name || tierId;
  }

  getVisibleFeatures(tier: SubscriptionTier) {
    // Show first 6 features for UI clarity
    return tier.features.slice(0, 6);
  }

  canUpgradeTo(tierId: SubscriptionTierId): boolean {
    const comparison = this.tierComparison();
    if (!comparison) return false;
    
    const tierOrder: SubscriptionTierId[] = ['solo', 'starter', 'professional'];
    const currentIndex = tierOrder.indexOf(comparison.currentTierId);
    const targetIndex = tierOrder.indexOf(tierId);
    
    return targetIndex > currentIndex;
  }

  getTierCtaText(tierId: SubscriptionTierId): string {
    const comparison = this.tierComparison();
    if (tierId === comparison?.currentTierId) return 'tiers.currentPlan';
    if (this.canUpgradeTo(tierId)) return 'tiers.upgrade';
    return 'tiers.downgrade';
  }

  getTierCtaAriaLabel(tier: SubscriptionTier): string {
    return `${this.getTierCtaText(tier.id)} to ${tier.name} plan`;
  }

  getSingleUpgradeAriaLabel(): string {
    return `Upgrade to ${this.getTargetTierName()} plan`;
  }

  onUpgrade(tierId: SubscriptionTierId): void {
    // Announce upgrade action
    const tierName = this.tierComparison()?.tiers.find(t => t.id === tierId)?.name || tierId;
    this.accessibilityService.announce(`Initiating upgrade to ${tierName} tier`, 'assertive');
    
    this.upgrade.emit({
      tier: tierId,
      feature: this.config.feature
    });
  }

  onClose(): void {
    // Announce modal closing
    this.accessibilityService.announce('Upgrade dialog closed', 'polite');
    this.close.emit();
  }

  onKeyDown(event: KeyboardEvent): void {
    // Handle tier card navigation with arrow keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const tierButtons = this.elementRef.nativeElement.querySelectorAll('.tier-cta-button');
      const currentIndex = Array.from(tierButtons).findIndex(button => 
        button === document.activeElement
      );

      if (currentIndex !== -1) {
        event.preventDefault();
        let newIndex = currentIndex;

        switch (event.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            newIndex = (currentIndex + 1) % tierButtons.length;
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            newIndex = (currentIndex - 1 + tierButtons.length) % tierButtons.length;
            break;
        }

        this.accessibilityService.setFocus(tierButtons[newIndex] as HTMLElement);
      }
    }
  }

  onOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}