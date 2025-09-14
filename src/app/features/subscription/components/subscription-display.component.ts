import { Component, OnInit, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

import { SubscriptionService } from '../../../core/services/subscription.service';
import { LanguageService } from '../../../core/services/language.service';
import {
  SubscriptionStatus,
  SubscriptionTier,
  TierComparison,
  FeatureConfig
} from '../../../core/models/subscription.model';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-subscription-display',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="subscription-display" [attr.dir]="isRtl() ? 'rtl' : 'ltr'">

      <!-- Loading State -->
      <div *ngIf="isLoading()" class="loading-container">
        <div class="glass-card">
          <div class="loading-content">
            <div class="loading-bar loading-bar-lg"></div>
            <div class="loading-bar loading-bar-md"></div>
            <div class="loading-bar loading-bar-md"></div>
          </div>
        </div>
      </div>

      <!-- Current Subscription Overview -->
      <div *ngIf="!isLoading() && subscriptionStatus()" class="current-subscription">
        <div class="glass-card">
          <div class="current-header">
            <div class="tier-info">
              <div class="tier-badge" [ngClass]="getTierBadgeClass(subscriptionStatus()!.currentTier.id)">
                {{ subscriptionStatus()!.currentTier.name | translate }}
              </div>
              <div class="tier-details">
                <h2 class="tier-title">
                  {{ 'subscription.current_plan' | translate }}
                </h2>
                <p class="tier-price">
                  {{ formatCurrency(subscriptionStatus()!.currentTier.price) }}
                  {{ 'subscription.per_year' | translate }}
                </p>
              </div>
            </div>

            <div class="renewal-info" [class.rtl-align]="isRtl()">
              <p class="renewal-label">
                {{ 'subscription.next_billing' | translate }}
              </p>
              <p class="renewal-date">
                {{ formatDate(subscriptionStatus()!.renewalDate) }}
              </p>
              <p class="renewal-days" [ngClass]="getRenewalStatusClass(subscriptionStatus()!.daysUntilRenewal)">
                {{ subscriptionStatus()!.daysUntilRenewal }} {{ 'subscription.days_left' | translate }}
              </p>
            </div>
          </div>

          <!-- Usage Statistics -->
          <div class="usage-stats">
            <div class="usage-item" *ngFor="let usage of getUsageStats(); trackBy: trackByUsageType">
              <div class="usage-header">
                <span class="usage-label">{{ usage.label | translate }}</span>
                <span class="usage-numbers">
                  {{ usage.current }} / {{ usage.limit === null ? ('subscription.unlimited' | translate) : usage.limit }}
                </span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="usage.percentage" [ngClass]="getProgressClass(usage.percentage)"></div>
              </div>
              <div class="usage-percent" [ngClass]="getUsageTextClass(usage.percentage)">
                {{ usage.percentage }}% {{ 'subscription.used' | translate }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Features Overview -->
      <div *ngIf="!isLoading() && subscriptionStatus()" class="features-overview">
        <div class="glass-card">
          <h3 class="features-title">
            {{ 'subscription.included_features' | translate }}
          </h3>

          <div class="features-grid">
            <div
              *ngFor="let feature of subscriptionStatus()!.currentTier.features; trackBy: trackByFeatureKey"
              class="feature-item"
              [ngClass]="getFeatureItemClass(feature)"
            >
              <div class="feature-icon" [ngClass]="getFeatureIconClass(feature)">
                <svg *ngIf="feature.enabled" class="icon" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
                <svg *ngIf="!feature.enabled" class="icon" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
              </div>

              <div class="feature-content">
                <span class="feature-name">{{ ('subscription.features.' + feature.key) | translate }}</span>
                <div *ngIf="!feature.enabled && feature.requiresUpgrade" class="upgrade-hint">
                  {{ 'subscription.upgrade_to' | translate }} {{ feature.requiresUpgrade | translate }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tier Comparison -->
      <div *ngIf="!isLoading() && tierComparison()" class="tier-comparison">
        <div class="glass-card">
          <h3 class="comparison-title">
            {{ 'subscription.compare_plans' | translate }}
          </h3>

          <div class="comparison-grid">
            <div
              *ngFor="let tier of tierComparison()!.tiers; trackBy: trackByTierId"
              class="tier-card"
              [ngClass]="getTierCardClass(tier)"
            >
              <div class="tier-header">
                <div class="tier-badge" [ngClass]="getTierBadgeClass(tier.id)">
                  {{ tier.name | translate }}
                </div>
                <div *ngIf="tier.popular" class="popular-badge">
                  {{ 'subscription.most_popular' | translate }}
                </div>
                <div class="tier-pricing">
                  <span class="price-amount">{{ formatCurrency(tier.price) }}</span>
                  <span class="price-period">{{ 'subscription.per_year' | translate }}</span>
                </div>
              </div>

              <div class="tier-features">
                <ul class="feature-list">
                  <li
                    *ngFor="let feature of tier.features.slice(0, 5); trackBy: trackByFeatureKey"
                    class="feature-list-item"
                    [ngClass]="feature.enabled ? 'enabled' : 'disabled'"
                  >
                    <div class="feature-check" [ngClass]="feature.enabled ? 'enabled' : 'disabled'">
                      <svg *ngIf="feature.enabled" class="check-icon" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                      </svg>
                      <svg *ngIf="!feature.enabled" class="x-icon" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                      </svg>
                    </div>
                    {{ ('subscription.features.' + feature.key) | translate }}
                  </li>
                </ul>
              </div>

              <div class="tier-footer">
                <!-- Current Plan -->
                <div
                  *ngIf="tier.id === tierComparison()!.currentTierId"
                  class="current-plan-indicator"
                >
                  {{ 'subscription.current_plan' | translate }}
                </div>
                
                <!-- Upgrade Button -->
                <button
                  *ngIf="tier.id !== tierComparison()!.currentTierId && isUpgradeTier(tier.id)"
                  class="btn-primary upgrade-btn"
                  [disabled]="isLoading()"
                  (click)="changeTier(tier.id)"
                  [attr.aria-label]="('subscription.upgrade_to' | translate) + ' ' + (tier.name | translate)"
                >
                  {{ 'subscription.upgrade_to' | translate }} {{ tier.name | translate }}
                </button>
                
                <!-- Downgrade Button (when allowed) -->
                <button
                  *ngIf="tier.id !== tierComparison()!.currentTierId && isDowngradeTier(tier.id) && canDowngradeToTier(tier.id)"
                  class="btn-secondary downgrade-btn"
                  [disabled]="isLoading()"
                  (click)="changeTier(tier.id)"
                  [attr.aria-label]="('subscription.downgrade_to' | translate) + ' ' + (tier.name | translate)"
                >
                  {{ 'subscription.downgrade_to' | translate }} {{ tier.name | translate }}
                </button>
                
                <!-- Blocked Downgrade Indicator -->
                <div
                  *ngIf="tier.id !== tierComparison()!.currentTierId && isDowngradeTier(tier.id) && !canDowngradeToTier(tier.id)"
                  class="downgrade-blocked"
                >
                  <div class="blocked-indicator">
                    <svg class="block-icon" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="blocked-text">{{ 'subscription.downgrade_blocked' | translate }}</span>
                  </div>
                  <button
                    class="btn-tertiary btn-sm blocked-details-btn"
                    (click)="showDowngradeBlockedDetails(tier.id)"
                  >
                    {{ 'subscription.why_blocked' | translate }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subscription-display {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .loading-container {
      min-height: 16rem;
    }

    .loading-content {
      padding: 1.5rem;
    }

    .loading-bar {
      background: rgba(75, 85, 99, 0.6);
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      animation: pulse 1.5s ease-in-out infinite;
    }

    .loading-bar-lg {
      height: 1.5rem;
    }

    .loading-bar-md {
      height: 1rem;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .current-subscription {
      margin-bottom: 1.5rem;
    }

    .glass-card {
      backdrop-filter: blur(20px);
      background: rgba(31, 41, 55, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    .current-header {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .tier-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .tier-badge {
      padding: 0.5rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .tier-badge.solo {
      background: rgba(59, 130, 246, 0.8);
      color: white;
    }

    .tier-badge.starter {
      background: rgba(34, 197, 94, 0.8);
      color: white;
    }

    .tier-badge.professional {
      background: rgba(245, 158, 11, 0.8);
      color: black;
    }

    .tier-title {
      font-size: 1.5rem;
      font-weight: bold;
      color: white;
      margin: 0;
    }

    .tier-price {
      color: rgba(209, 213, 219, 1);
      margin: 0.25rem 0 0 0;
    }

    .renewal-info {
      text-align: right;
    }

    .renewal-info.rtl-align {
      text-align: left;
    }

    .renewal-label {
      font-size: 0.875rem;
      color: rgba(156, 163, 175, 1);
      margin: 0;
    }

    .renewal-date {
      color: white;
      font-weight: 500;
      margin: 0.25rem 0;
    }

    .renewal-days {
      font-size: 0.875rem;
      margin: 0;
    }

    .usage-stats {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .usage-item {
      background: rgba(31, 41, 55, 0.4);
      padding: 1rem;
      border-radius: 12px;
    }

    .usage-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .usage-label {
      color: rgba(209, 213, 219, 1);
      font-size: 0.875rem;
    }

    .usage-numbers {
      color: white;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .progress-bar {
      width: 100%;
      background: rgba(75, 85, 99, 1);
      border-radius: 9999px;
      height: 0.5rem;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .progress-fill {
      height: 100%;
      transition: all 0.3s ease-out;
    }

    .progress-fill.low {
      background: rgba(34, 197, 94, 1);
    }

    .progress-fill.medium {
      background: rgba(245, 158, 11, 1);
    }

    .progress-fill.high {
      background: rgba(239, 68, 68, 1);
    }

    .usage-percent {
      font-size: 0.75rem;
    }

    .text-green-400 {
      color: rgba(74, 222, 128, 1);
    }

    .text-yellow-400 {
      color: rgba(251, 191, 36, 1);
    }

    .text-red-400 {
      color: rgba(248, 113, 113, 1);
    }

    .features-overview {
      margin-bottom: 1.5rem;
    }

    .features-title {
      font-size: 1.25rem;
      font-weight: bold;
      color: white;
      margin: 0 0 1rem 0;
    }

    .features-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: 12px;
    }

    .feature-item.enabled {
      background: rgba(31, 41, 55, 0.5);
    }

    .feature-item.disabled {
      background: rgba(17, 24, 39, 0.3);
    }

    .feature-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    .feature-icon.enabled {
      color: rgba(74, 222, 128, 1);
    }

    .feature-icon.disabled {
      color: rgba(107, 114, 128, 1);
    }

    .icon {
      width: 100%;
      height: 100%;
    }

    .feature-content {
      flex: 1;
    }

    .feature-name {
      color: white;
    }

    .upgrade-hint {
      font-size: 0.75rem;
      color: rgba(96, 165, 250, 1);
      margin-top: 0.25rem;
    }

    .comparison-title {
      font-size: 1.25rem;
      font-weight: bold;
      color: white;
      margin: 0 0 1rem 0;
    }

    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .tier-card {
      background: rgba(31, 41, 55, 0.6);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 0;
      overflow: hidden;
    }

    .tier-card.current {
      border-color: rgba(59, 130, 246, 0.5);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
    }

    .tier-card.recommended {
      border-color: rgba(34, 197, 94, 0.5);
      box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.5);
    }

    .tier-header {
      padding: 1rem;
      text-align: center;
    }

    .popular-badge {
      background: rgba(34, 197, 94, 0.8);
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      margin-bottom: 0.5rem;
      display: inline-block;
    }

    .tier-pricing {
      color: white;
    }

    .price-amount {
      font-size: 1.5rem;
      font-weight: bold;
    }

    .price-period {
      font-size: 0.875rem;
      color: rgba(156, 163, 175, 1);
      margin-left: 0.5rem;
    }

    .tier-features {
      padding: 1rem;
    }

    .feature-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .feature-list-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }

    .feature-list-item.enabled {
      color: rgba(209, 213, 219, 1);
    }

    .feature-list-item.disabled {
      color: rgba(107, 114, 128, 1);
    }

    .feature-check {
      width: 1rem;
      height: 1rem;
    }

    .feature-check.enabled {
      color: rgba(74, 222, 128, 1);
    }

    .feature-check.disabled {
      color: rgba(107, 114, 128, 1);
    }

    .check-icon, .x-icon {
      width: 100%;
      height: 100%;
    }

    .tier-footer {
      padding: 1rem;
    }

    .upgrade-btn {
      width: 100%;
    }

    .current-plan-indicator {
      background: rgba(59, 130, 246, 0.8);
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      text-align: center;
      font-weight: 500;
    }

    .downgrade-btn {
      width: 100%;
      background: rgba(156, 163, 175, 0.8);
      border: 1px solid rgba(156, 163, 175, 0.3);
    }

    .downgrade-btn:hover {
      background: rgba(156, 163, 175, 1);
      border-color: rgba(156, 163, 175, 0.5);
    }

    .downgrade-blocked {
      padding: 0.75rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      text-align: center;
    }

    .blocked-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .block-icon {
      width: 1.25rem;
      height: 1.25rem;
      color: rgba(239, 68, 68, 1);
    }

    .blocked-text {
      color: rgba(239, 68, 68, 1);
      font-size: 0.875rem;
      font-weight: 500;
    }

    .blocked-details-btn {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      color: rgba(156, 163, 175, 1);
      border: 1px solid rgba(156, 163, 175, 0.3);
    }

    .blocked-details-btn:hover {
      color: white;
      border-color: rgba(156, 163, 175, 0.5);
    }

    /* Responsive styles */
    @media (min-width: 768px) {
      .current-header {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }

      .tier-info {
        margin-bottom: 0;
      }

      .usage-stats {
        grid-template-columns: repeat(3, 1fr);
      }

      .features-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 1024px) {
      .comparison-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
  `]
})
export class SubscriptionDisplayComponent implements OnInit {
  // Signals for reactive state
  subscriptionStatus = signal<SubscriptionStatus | null>(null);
  tierComparison = signal<TierComparison | null>(null);
  isLoading = computed(() => this.subscriptionService.isLoading());
  isRtl = computed(() => this.languageService.isRTL());

  constructor(
    private subscriptionService: SubscriptionService,
    private languageService: LanguageService
  ) {
    // Load subscription data
    this.loadSubscriptionData();
  }

  ngOnInit(): void {
    // Additional initialization if needed
  }

  private loadSubscriptionData(): void {
    // Load current subscription status
    this.subscriptionService.getCurrentSubscriptionStatus()
      .pipe(takeUntilDestroyed())
      .subscribe(status => {
        this.subscriptionStatus.set(status);
      });

    // Load tier comparison
    this.subscriptionService.getTierComparison()
      .pipe(takeUntilDestroyed())
      .subscribe(comparison => {
        this.tierComparison.set(comparison);
      });
  }

  upgradeTo(tierId: string): void {
    this.subscriptionService.upgradeTo(tierId as any)
      .pipe(takeUntilDestroyed())
      .subscribe(success => {
        if (success) {
          // Reload data after successful upgrade
          this.loadSubscriptionData();
        }
      });
  }

  changeTier(tierId: string): void {
    this.subscriptionService.canChangeTo(tierId as any)
      .pipe(takeUntilDestroyed())
      .subscribe(({ canChange, reasons, isUpgrade }) => {
        if (canChange) {
          this.subscriptionService.upgradeTo(tierId as any)
            .pipe(takeUntilDestroyed())
            .subscribe(success => {
              if (success) {
                this.loadSubscriptionData();
              }
            });
        } else {
          // Show blocked reasons
          this.showChangeBlockedDialog(tierId, reasons, isUpgrade);
        }
      });
  }

  isUpgradeTier(tierId: string): boolean {
    const comparison = this.tierComparison();
    if (!comparison) return false;
    
    const tierOrder = ['solo', 'starter', 'professional'];
    const currentIndex = tierOrder.indexOf(comparison.currentTierId);
    const targetIndex = tierOrder.indexOf(tierId);
    
    return targetIndex > currentIndex;
  }

  isDowngradeTier(tierId: string): boolean {
    const comparison = this.tierComparison();
    if (!comparison) return false;
    
    const tierOrder = ['solo', 'starter', 'professional'];
    const currentIndex = tierOrder.indexOf(comparison.currentTierId);
    const targetIndex = tierOrder.indexOf(tierId);
    
    return targetIndex < currentIndex;
  }

  canDowngradeToTier(tierId: string): boolean {
    // This will be populated by the subscription service check
    // For now, we'll use a simple logic but this should be reactive
    const status = this.subscriptionStatus();
    if (!status) return false;
    
    const tierOrder = ['solo', 'starter', 'professional'];
    const targetTier = this.getTargetTierLimits(tierId);
    if (!targetTier) return false;
    
    // Check if current usage exceeds target tier limits
    if (targetTier.users !== null && status.usage.users > targetTier.users) return false;
    if (targetTier.cars !== null && status.usage.cars > targetTier.cars) return false;
    if (targetTier.serviceBays !== null && status.usage.serviceBays > targetTier.serviceBays) return false;
    
    return true;
  }

  private getTargetTierLimits(tierId: string) {
    const comparison = this.tierComparison();
    if (!comparison) return null;
    
    const targetTier = comparison.tiers.find(t => t.id === tierId);
    return targetTier?.limits || null;
  }

  showDowngradeBlockedDetails(tierId: string): void {
    this.subscriptionService.canDowngradeTo(tierId as any)
      .pipe(takeUntilDestroyed())
      .subscribe(({ canDowngrade, reasons }) => {
        if (!canDowngrade) {
          this.showDowngradeBlockedDialog(tierId, reasons);
        }
      });
  }

  private showChangeBlockedDialog(tierId: string, reasons: string[], isUpgrade: boolean): void {
    // This would typically open a modal or show a toast with the blocking reasons
    // For now, we'll use a simple alert (should be replaced with proper UI)
    const action = isUpgrade ? 'upgrade' : 'downgrade';
    const message = reasons.map(r => r).join('\n'); // Translation keys would be translated here
    alert(`Cannot ${action} to ${tierId}:\n${message}`);
  }

  private showDowngradeBlockedDialog(tierId: string, reasons: string[]): void {
    const message = reasons.map(r => r).join('\n'); // Translation keys would be translated here  
    alert(`Cannot downgrade to ${tierId}:\n${message}`);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat(this.languageService.getCurrentLanguage(), {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat(this.languageService.getCurrentLanguage(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  getUsageStats() {
    const status = this.subscriptionStatus();
    if (!status) return [];

    return [
      {
        type: 'users',
        label: 'subscription.usage.users',
        current: status.usage.users,
        limit: status.currentTier.limits.users,
        percentage: this.calculatePercentage(status.usage.users, status.currentTier.limits.users)
      },
      {
        type: 'cars',
        label: 'subscription.usage.cars',
        current: status.usage.cars,
        limit: status.currentTier.limits.cars,
        percentage: this.calculatePercentage(status.usage.cars, status.currentTier.limits.cars)
      },
      {
        type: 'serviceBays',
        label: 'subscription.usage.service_bays',
        current: status.usage.serviceBays,
        limit: status.currentTier.limits.serviceBays,
        percentage: this.calculatePercentage(status.usage.serviceBays, status.currentTier.limits.serviceBays)
      }
    ];
  }

  private calculatePercentage(current: number, limit: number | null): number {
    if (limit === null) return 0; // Unlimited
    if (limit === 0) return 100;
    return Math.min((current / limit) * 100, 100);
  }

  getTierBadgeClass(tierId: string): string {
    return `tier-badge ${tierId}`;
  }

  getTierCardClass(tier: SubscriptionTier): string {
    const comparison = this.tierComparison();
    if (!comparison) return '';

    const classes = [];
    if (tier.id === comparison.currentTierId) {
      classes.push('current');
    }
    if (tier.id === comparison.recommendedTierId) {
      classes.push('recommended');
    }
    return classes.join(' ');
  }

  getFeatureItemClass(feature: FeatureConfig): string {
    return feature.enabled ? 'enabled' : 'disabled';
  }

  getFeatureIconClass(feature: FeatureConfig): string {
    return feature.enabled ? 'enabled' : 'disabled';
  }

  getProgressClass(percentage: number): string {
    if (percentage < 70) return 'low';
    if (percentage < 90) return 'medium';
    return 'high';
  }

  getUsageTextClass(percentage: number): string {
    if (percentage < 70) return 'text-green-400';
    if (percentage < 90) return 'text-yellow-400';
    return 'text-red-400';
  }

  getRenewalStatusClass(daysLeft: number): string {
    if (daysLeft > 7) return 'text-green-400';
    if (daysLeft > 3) return 'text-yellow-400';
    return 'text-red-400';
  }

  // TrackBy functions for performance
  trackByUsageType(index: number, item: any): string {
    return item.type;
  }

  trackByFeatureKey(index: number, item: FeatureConfig): string {
    return item.key;
  }

  trackByTierId(index: number, item: SubscriptionTier): string {
    return item.id;
  }
}
