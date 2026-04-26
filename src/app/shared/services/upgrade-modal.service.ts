import { Injectable, ComponentRef, ViewContainerRef, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { SubscriptionService } from '../../core/services/subscription.service';
import { SubscriptionTierId } from '../../core/models/subscription.model';
import { UpgradePromptComponent, UpgradePromptConfig } from '../components/upgrade-prompt/upgrade-prompt.component';

export interface UpgradeContext {
  feature: string;
  title: string;
  subtitle: string;
  requiredTier: SubscriptionTierId;
  benefits: string[];
  testimonial?: {
    text: string;
    author: string;
    business: string;
  };
  ctaText: string;
  icon: string;
}

export interface UpgradeModalResult {
  action: 'upgrade' | 'close' | 'cancel';
  tier?: SubscriptionTierId;
  feature?: string;
}

/**
 * Context-aware upgrade modal configurations for different features
 */
export const UPGRADE_CONTEXTS: Record<string, UpgradeContext> = {
  photo_upload: {
    feature: 'photos_documentation',
    title: 'upgrade.photoTitle',
    subtitle: 'upgrade.photoSubtitle',
    requiredTier: 'professional',
    benefits: [
      'upgrade.photoBenefit1', // "Document service quality with before/after photos"
      'upgrade.photoBenefit2', // "Build customer trust with visual evidence"
      'upgrade.photoBenefit3', // "Protect against disputes with photo documentation"
      'upgrade.photoBenefit4', // "Professional presentation for estimates"
      'upgrade.photoBenefit5'  // "Organize photos by service category"
    ],
    testimonial: {
      text: 'upgrade.photoTestimonial',
      author: 'Ahmed Ben Ali',
      business: 'Garage Elite, Tunis'
    },
    ctaText: 'upgrade.upgradeToPro',
    icon: 'camera'
  },
  
  user_limit: {
    feature: 'multi_user',
    title: 'upgrade.teamTitle',
    subtitle: 'upgrade.teamSubtitle',
    requiredTier: 'starter',
    benefits: [
      'upgrade.teamBenefit1', // "Add unlimited team members"
      'upgrade.teamBenefit2', // "Collaborate effectively on jobs"
      'upgrade.teamBenefit3', // "Assign specific responsibilities"
      'upgrade.teamBenefit4', // "Track individual performance"
      'upgrade.teamBenefit5'  // "Manage user permissions"
    ],
    testimonial: {
      text: 'upgrade.teamTestimonial',
      author: 'Fatima Zahra',
      business: 'Auto Service Pro, Sfax'
    },
    ctaText: 'upgrade.expandTeam',
    icon: 'users'
  },

  car_limit: {
    feature: 'unlimited_cars',
    title: 'upgrade.vehicleTitle',
    subtitle: 'upgrade.vehicleSubtitle',
    requiredTier: 'starter',
    benefits: [
      'upgrade.vehicleBenefit1', // "Manage unlimited vehicles"
      'upgrade.vehicleBenefit2', // "Scale your business without limits"
      'upgrade.vehicleBenefit3', // "Better organization and tracking"
      'upgrade.vehicleBenefit4', // "Complete service history"
      'upgrade.vehicleBenefit5'  // "Customer fleet management"
    ],
    testimonial: {
      text: 'upgrade.vehicleTestimonial',
      author: 'Mohamed Amine',
      business: 'Fleet Solutions, Tunis'
    },
    ctaText: 'upgrade.manageMore',
    icon: 'car'
  },

  sms_notifications: {
    feature: 'sms_notifications',
    title: 'upgrade.smsTitle',
    subtitle: 'upgrade.smsSubtitle',
    requiredTier: 'professional',
    benefits: [
      'upgrade.smsBenefit1', // "Send appointment reminders"
      'upgrade.smsBenefit2', // "Notify customers when service is ready"
      'upgrade.smsBenefit3', // "Reduce no-shows significantly"
      'upgrade.smsBenefit4', // "Professional communication"
      'upgrade.smsBenefit5'  // "Automated SMS workflows"
    ],
    testimonial: {
      text: 'upgrade.smsTestimonial',
      author: 'Karim Bouazizi',
      business: 'Quick Fix Garage, Sousse'
    },
    ctaText: 'upgrade.enableSMS',
    icon: 'message-circle'
  },

  inventory_management: {
    feature: 'inventory_management',
    title: 'upgrade.inventoryTitle',
    subtitle: 'upgrade.inventorySubtitle',
    requiredTier: 'professional',
    benefits: [
      'upgrade.inventoryBenefit1', // "Track parts and supplies"
      'upgrade.inventoryBenefit2', // "Low stock alerts"
      'upgrade.inventoryBenefit3', // "Vendor management"
      'upgrade.inventoryBenefit4', // "Cost tracking and margins"
      'upgrade.inventoryBenefit5'  // "Integration with invoicing"
    ],
    testimonial: {
      text: 'upgrade.inventoryTestimonial',
      author: 'Nadia Triki',
      business: 'Parts & Service Center, Monastir'
    },
    ctaText: 'upgrade.manageInventory',
    icon: 'package'
  }
};

@Injectable({
  providedIn: 'root'
})
export class UpgradeModalService {
  private subscriptionService = inject(SubscriptionService);
  private modalRef?: ComponentRef<UpgradePromptComponent>;
  private viewContainer?: ViewContainerRef;
  private resultSubject = new Subject<UpgradeModalResult>();

  /**
   * Set the view container for creating modal components
   */
  setViewContainer(viewContainer: ViewContainerRef): void {
    this.viewContainer = viewContainer;
  }

  /**
   * Show context-aware upgrade prompt based on feature
   */
  showUpgradePrompt(
    contextKey: string, 
    additionalData?: Partial<UpgradeContext>
  ): Observable<UpgradeModalResult> {
    if (!this.viewContainer) {
      console.error('UpgradeModalService: ViewContainer not set. Call setViewContainer() first.');
      return new Observable(observer => {
        observer.error(new Error('ViewContainer not available'));
      });
    }

    // Close any existing modal
    this.closeModal();

    const modalData = this.buildModalData(contextKey, additionalData);
    if (!modalData) {
      return new Observable(observer => {
        observer.error(new Error(`Unknown upgrade context: ${contextKey}`));
      });
    }

    // Create the modal component
    this.modalRef = this.viewContainer.createComponent(UpgradePromptComponent);
    this.modalRef.instance.config = modalData;
    this.modalRef.instance.isVisible = true;

    // Set up event handlers
    this.modalRef.instance.upgrade.subscribe((event) => {
      this.resultSubject.next({
        action: 'upgrade',
        tier: event.tier,
        feature: event.feature
      });
      this.closeModal();
    });

    this.modalRef.instance.close.subscribe(() => {
      this.resultSubject.next({
        action: 'close'
      });
      this.closeModal();
    });

    return this.resultSubject.asObservable();
  }

  /**
   * Show upgrade prompt for specific feature limitation
   */
  showFeatureLimitationPrompt(featureKey: string): Observable<UpgradeModalResult> {
    const contextKey = this.getContextKeyForFeature(featureKey);
    return this.showUpgradePrompt(contextKey);
  }

  /**
   * Show upgrade prompt for usage limit exceeded
   */
  showUsageLimitPrompt(limitType: 'users' | 'cars' | 'serviceBays'): Observable<UpgradeModalResult> {
    const contextMap = {
      users: 'user_limit',
      cars: 'car_limit',
      serviceBays: 'car_limit' // Service bays are part of vehicle management
    };

    return this.showUpgradePrompt(contextMap[limitType]);
  }

  /**
   * Close the current modal
   */
  closeModal(): void {
    if (this.modalRef) {
      this.modalRef.destroy();
      this.modalRef = undefined;
    }
  }

  /**
   * Check if modal is currently open
   */
  isModalOpen(): boolean {
    return !!this.modalRef;
  }

  /**
   * Build modal configuration data based on context
   */
  private buildModalData(
    contextKey: string, 
    additionalData?: Partial<UpgradeContext>
  ): UpgradePromptConfig | null {
    const context = UPGRADE_CONTEXTS[contextKey];
    if (!context) return null;

    // Merge additional data if provided
    const mergedContext = { ...context, ...additionalData };

    // Get current tier to calculate pricing
    const currentTier = this.subscriptionService.currentTier();
    
    return {
      feature: mergedContext.feature,
      targetTier: mergedContext.requiredTier,
      title: mergedContext.title,
      description: mergedContext.subtitle,
      showComparison: true,
      showFeatureList: true,
      ctaText: mergedContext.ctaText,
      // Add context-specific data for the component to use
      contextData: {
        benefits: mergedContext.benefits,
        testimonial: mergedContext.testimonial,
        icon: mergedContext.icon,
        currentTier
      }
    };
  }

  /**
   * Map feature keys to context keys
   */
  private getContextKeyForFeature(featureKey: string): string {
    const featureToContextMap: Record<string, string> = {
      'photos_documentation': 'photo_upload',
      'multi_user': 'user_limit',
      'unlimited_users': 'user_limit',
      'unlimited_cars': 'car_limit',
      'sms_notifications': 'sms_notifications',
      'inventory_management': 'inventory_management'
    };

    return featureToContextMap[featureKey] || 'photo_upload'; // Default fallback
  }

  /**
   * Get context configuration for a specific key
   */
  getContext(contextKey: string): UpgradeContext | null {
    return UPGRADE_CONTEXTS[contextKey] || null;
  }

  /**
   * Get all available contexts
   */
  getAllContexts(): Record<string, UpgradeContext> {
    return { ...UPGRADE_CONTEXTS };
  }

  /**
   * Calculate pricing difference between tiers
   */
  calculatePricingDifference(
    currentTier: SubscriptionTierId, 
    targetTier: SubscriptionTierId
  ): Observable<{ 
    currentPrice: number; 
    newPrice: number; 
    difference: number; 
    monthlyDifference: number; 
  }> {
    return this.subscriptionService.getTiers().pipe(
      map(tiers => {
        const current = tiers.find(t => t.id === currentTier);
        const target = tiers.find(t => t.id === targetTier);
        
        if (!current || !target) {
          return {
            currentPrice: 0,
            newPrice: 0,
            difference: 0,
            monthlyDifference: 0
          };
        }

        const difference = target.price - current.price;
        const monthlyDifference = Math.round(difference / 12);

        return {
          currentPrice: current.price,
          newPrice: target.price,
          difference,
          monthlyDifference
        };
      })
    );
  }

  /**
   * Get upgrade recommendation based on current usage and blocked feature
   */
  getUpgradeRecommendation(blockedFeature: string): Observable<{
    recommendedTier: SubscriptionTierId;
    reason: string;
    benefits: string[];
    urgency: 'low' | 'medium' | 'high';
  }> {
    const context = this.getContextKeyForFeature(blockedFeature);
    const upgradeContext = UPGRADE_CONTEXTS[context];
    
    if (!upgradeContext) {
      return new Observable(observer => {
        observer.error(new Error(`No upgrade context for feature: ${blockedFeature}`));
      });
    }

    return this.subscriptionService.getCurrentSubscriptionStatus().pipe(
      map(status => {
        // Determine urgency based on current usage and limits
        let urgency: 'low' | 'medium' | 'high' = 'low';
        
        // High urgency if user is close to limits
        if (status.currentTier.id === 'solo') {
          const userUsage = status.usage.users / (status.currentTier.limits.users || 1);
          const carUsage = status.usage.cars / (status.currentTier.limits.cars || 50);
          
          if (userUsage > 0.8 || carUsage > 0.8) {
            urgency = 'high';
          } else if (userUsage > 0.6 || carUsage > 0.6) {
            urgency = 'medium';
          }
        }

        return {
          recommendedTier: upgradeContext.requiredTier,
          reason: upgradeContext.subtitle,
          benefits: upgradeContext.benefits,
          urgency
        };
      })
    );
  }
}