import { Injectable, signal, inject } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  SubscriptionTier,
  SubscriptionStatus,
  TierComparison,
  SubscriptionTierId,
  CurrentUsage,
  FeatureConfig
} from '../models/subscription.model';
import { ModuleService } from './module.service';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private moduleService = inject(ModuleService);

  // Module-based system: tiers are kept for backward compat but everything is "professional" (all modules)
  private readonly tiers: SubscriptionTier[] = [
    {
      id: 'solo',
      name: 'Solo',
      price: 500,
      currency: 'TND',
      features: [],
      limits: { users: 1, cars: 50, serviceBays: 1 }
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 2000,
      currency: 'TND',
      features: [],
      limits: { users: 3, cars: 200, serviceBays: 2 },
      popular: true
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 6000,
      currency: 'TND',
      features: [],
      limits: { users: null, cars: null, serviceBays: null }
    }
  ];

  private currentTierSubject = new BehaviorSubject<SubscriptionTierId>('professional');
  private loadingSubject = new BehaviorSubject<boolean>(false);

  isLoading = signal(false);
  currentTier = signal<SubscriptionTierId>('professional');

  constructor() {
    this.initializeFromAuth();

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'opauth_user') {
          this.initializeFromAuth();
        }
      });
    }
  }

  private initializeFromAuth(): void {
    try {
      const userStr = localStorage.getItem('opauth_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.subscriptionTier) {
          this.currentTierSubject.next(user.subscriptionTier);
          this.currentTier.set(user.subscriptionTier);
        }
      }
    } catch (error) {
      console.error('Error loading subscription from auth:', error);
    }
  }

  setTierFromUser(tier: SubscriptionTierId): void {
    this.currentTierSubject.next(tier);
    this.currentTier.set(tier);
  }

  getTiers(): Observable<SubscriptionTier[]> {
    return of(this.tiers);
  }

  getCurrentSubscriptionStatus(): Observable<SubscriptionStatus> {
    const currentTierId = this.currentTierSubject.value;
    const currentTier = this.tiers.find(tier => tier.id === currentTierId) || this.tiers[2];

    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    const daysUntilRenewal = Math.ceil(
      (renewalDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    return of({
      currentTier,
      usage: { users: 0, cars: 0, serviceBays: 0 },
      renewalDate,
      isActive: true,
      daysUntilRenewal
    });
  }

  getTierComparison(): Observable<TierComparison> {
    const currentTierId = this.currentTierSubject.value;
    return of({
      tiers: this.tiers,
      currentTierId,
      recommendedTierId: undefined
    });
  }

  isFeatureEnabled(_featureKey: string): Observable<boolean> {
    // With module system, delegate to ModuleService
    return of(true);
  }

  hasFeature(featureKey: string): Observable<boolean> {
    return this.isFeatureEnabled(featureKey);
  }

  getRequiredTier(_featureKey: string): SubscriptionTierId | null {
    return 'solo';
  }

  getUpgradeTierForFeature(_featureKey: string): SubscriptionTierId | null {
    return null;
  }

  isUsageLimitExceeded(_type: 'users' | 'cars' | 'serviceBays'): Observable<boolean> {
    return of(false);
  }

  getLockedFeatures(): Observable<FeatureConfig[]> {
    return of([]);
  }

  canUpgradeTo(_tierId: SubscriptionTierId): Observable<boolean> {
    return of(false);
  }

  canDowngradeTo(_tierId: SubscriptionTierId): Observable<{canDowngrade: boolean, reasons: string[]}> {
    return of({ canDowngrade: false, reasons: [] });
  }

  canChangeTo(_tierId: SubscriptionTierId): Observable<{canChange: boolean, reasons: string[], isUpgrade: boolean}> {
    return of({ canChange: false, reasons: [], isUpgrade: false });
  }

  getUsagePercentage(_limitType: keyof CurrentUsage): Observable<number> {
    return of(0);
  }

  upgradeTo(tierId: SubscriptionTierId): Observable<boolean> {
    this.currentTierSubject.next(tierId);
    this.currentTier.set(tierId);
    return of(true);
  }

  getRecommendedTier(): Observable<SubscriptionTier | null> {
    return of(null);
  }

  get loading$(): Observable<boolean> {
    return this.loadingSubject.asObservable();
  }

  get currentTier$(): Observable<SubscriptionTierId> {
    return this.currentTierSubject.asObservable();
  }
}
