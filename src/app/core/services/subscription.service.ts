import { Injectable, signal } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, delay } from 'rxjs/operators';
import {
  SubscriptionTier,
  SubscriptionStatus,
  TierComparison,
  SubscriptionTierId,
  CurrentUsage,
  FeatureConfig
} from '../models/subscription.model';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private readonly mockTiers: SubscriptionTier[] = [
    {
      id: 'solo',
      name: 'Solo',
      price: 500,
      currency: 'TND',
      features: [
        { key: 'basic_inventory', enabled: true },
        { key: 'customer_management', enabled: true },
        { key: 'basic_reports', enabled: true },
        { key: 'mobile_app', enabled: false, requiresUpgrade: 'starter' },
        { key: 'advanced_reports', enabled: false, requiresUpgrade: 'starter' },
        { key: 'team_collaboration', enabled: false, requiresUpgrade: 'professional' },
        { key: 'api_access', enabled: false, requiresUpgrade: 'professional' }
      ],
      limits: {
        users: 1,
        cars: 50,
        serviceBays: 2
      }
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 2000,
      currency: 'TND',
      features: [
        { key: 'basic_inventory', enabled: true },
        { key: 'customer_management', enabled: true },
        { key: 'basic_reports', enabled: true },
        { key: 'mobile_app', enabled: true },
        { key: 'advanced_reports', enabled: true },
        { key: 'email_notifications', enabled: true },
        { key: 'team_collaboration', enabled: false, requiresUpgrade: 'professional' },
        { key: 'api_access', enabled: false, requiresUpgrade: 'professional' }
      ],
      limits: {
        users: 5,
        cars: 200,
        serviceBays: 5
      },
      popular: true
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 1788,
      currency: 'TND',
      features: [
        { key: 'basic_inventory', enabled: true },
        { key: 'customer_management', enabled: true },
        { key: 'basic_reports', enabled: true },
        { key: 'mobile_app', enabled: true },
        { key: 'advanced_reports', enabled: true },
        { key: 'email_notifications', enabled: true },
        { key: 'team_collaboration', enabled: true },
        { key: 'api_access', enabled: true },
        { key: 'priority_support', enabled: true },
        { key: 'custom_integrations', enabled: true }
      ],
      limits: {
        users: null, // unlimited
        cars: null, // unlimited
        serviceBays: null // unlimited
      }
    }
  ];

  private readonly mockUsage: CurrentUsage = {
    users: 3,
    cars: 47,
    serviceBays: 2
  };

  private currentTierSubject = new BehaviorSubject<SubscriptionTierId>('starter');
  private loadingSubject = new BehaviorSubject<boolean>(false);

  // Signals for reactive state management
  isLoading = signal(false);
  currentTier = signal<SubscriptionTierId>('starter');

  constructor() {}

  /**
   * Get all available subscription tiers
   */
  getTiers(): Observable<SubscriptionTier[]> {
    this.setLoading(true);
    return of(this.mockTiers).pipe(
      delay(500), // Simulate API call
      map(tiers => {
        this.setLoading(false);
        return tiers;
      })
    );
  }

  /**
   * Get current subscription status
   */
  getCurrentSubscriptionStatus(): Observable<SubscriptionStatus> {
    this.setLoading(true);
    const currentTierId = this.currentTierSubject.value;
    const currentTier = this.mockTiers.find(tier => tier.id === currentTierId)!;
    
    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + 1);
    
    const daysUntilRenewal = Math.ceil(
      (renewalDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    const status: SubscriptionStatus = {
      currentTier,
      usage: this.mockUsage,
      renewalDate,
      isActive: true,
      daysUntilRenewal
    };

    return of(status).pipe(
      delay(300),
      map(status => {
        this.setLoading(false);
        return status;
      })
    );
  }

  /**
   * Get tier comparison data
   */
  getTierComparison(): Observable<TierComparison> {
    const currentTierId = this.currentTierSubject.value;
    let recommendedTierId: SubscriptionTierId | undefined;

    // Simple recommendation logic based on usage
    if (currentTierId === 'solo' && this.mockUsage.users > 1) {
      recommendedTierId = 'starter';
    } else if (currentTierId === 'starter' && this.mockUsage.users > 5) {
      recommendedTierId = 'professional';
    }

    const comparison: TierComparison = {
      tiers: this.mockTiers,
      currentTierId,
      recommendedTierId
    };

    return of(comparison).pipe(delay(200));
  }

  /**
   * Check if a specific feature is enabled
   */
  isFeatureEnabled(featureKey: string): Observable<boolean> {
    return this.getCurrentSubscriptionStatus().pipe(
      map(status => {
        const feature = status.currentTier.features.find(f => f.key === featureKey);
        return feature?.enabled || false;
      })
    );
  }

  /**
   * Check if user has access to a specific feature (alias for consistency)
   */
  hasFeature(featureKey: string): Observable<boolean> {
    return this.isFeatureEnabled(featureKey);
  }

  /**
   * Get required tier for a specific feature
   */
  getRequiredTier(featureKey: string): SubscriptionTierId | null {
    for (const tier of this.mockTiers) {
      const feature = tier.features.find(f => f.key === featureKey);
      if (feature && feature.enabled) {
        return tier.id;
      }
    }
    return null;
  }

  /**
   * Get the tier required to upgrade for a locked feature
   */
  getUpgradeTierForFeature(featureKey: string): SubscriptionTierId | null {
    const currentTierId = this.currentTierSubject.value;
    const currentTier = this.mockTiers.find(t => t.id === currentTierId);
    if (!currentTier) return null;

    const feature = currentTier.features.find(f => f.key === featureKey);
    return feature?.requiresUpgrade || null;
  }

  /**
   * Check if current usage exceeds limits
   */
  isUsageLimitExceeded(type: 'users' | 'cars' | 'serviceBays'): Observable<boolean> {
    return this.getCurrentSubscriptionStatus().pipe(
      map(status => {
        const limit = status.currentTier.limits[type];
        const usage = status.usage[type];
        
        // null limit means unlimited
        if (limit === null) return false;
        
        return usage >= limit;
      })
    );
  }

  /**
   * Get features not available in current tier
   */
  getLockedFeatures(): Observable<FeatureConfig[]> {
    return this.getCurrentSubscriptionStatus().pipe(
      map(status => {
        return status.currentTier.features.filter(feature => !feature.enabled);
      })
    );
  }

  /**
   * Check if upgrade is available from current tier
   */
  canUpgradeTo(tierId: SubscriptionTierId): Observable<boolean> {
    return this.getCurrentSubscriptionStatus().pipe(
      map(status => {
        const tierOrder: SubscriptionTierId[] = ['solo', 'starter', 'professional'];
        const currentIndex = tierOrder.indexOf(status.currentTier.id);
        const targetIndex = tierOrder.indexOf(tierId);
        
        return targetIndex > currentIndex;
      })
    );
  }

  /**
   * Get usage percentage for a specific limit
   */
  getUsagePercentage(limitType: keyof CurrentUsage): Observable<number> {
    return this.getCurrentSubscriptionStatus().pipe(
      map(status => {
        const usage = status.usage[limitType];
        const limit = status.currentTier.limits[limitType];
        
        if (limit === null) return 0; // Unlimited
        if (limit === 0) return 100;
        
        return Math.min((usage / limit) * 100, 100);
      })
    );
  }

  /**
   * Simulate tier upgrade (for testing)
   */
  upgradeTo(tierId: SubscriptionTierId): Observable<boolean> {
    this.setLoading(true);
    return of(true).pipe(
      delay(1000),
      map(success => {
        if (success) {
          this.currentTierSubject.next(tierId);
          this.currentTier.set(tierId);
        }
        this.setLoading(false);
        return success;
      })
    );
  }

  /**
   * Get recommended tier based on current usage
   */
  getRecommendedTier(): Observable<SubscriptionTier | null> {
    return this.getTierComparison().pipe(
      map(comparison => {
        if (!comparison.recommendedTierId) return null;
        return this.mockTiers.find(tier => tier.id === comparison.recommendedTierId) || null;
      })
    );
  }

  private setLoading(loading: boolean): void {
    this.isLoading.set(loading);
    this.loadingSubject.next(loading);
  }

  /**
   * Observable for loading state (for components using observables)
   */
  get loading$(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  /**
   * Observable for current tier changes
   */
  get currentTier$(): Observable<SubscriptionTierId> {
    return this.currentTierSubject.asObservable();
  }
}