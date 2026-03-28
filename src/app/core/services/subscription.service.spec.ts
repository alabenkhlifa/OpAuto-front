import { TestBed } from '@angular/core/testing';
import { SubscriptionService } from './subscription.service';
import { ModuleService } from './module.service';
import { SubscriptionTierId, SubscriptionStatus, TierComparison } from '../models/subscription.model';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(() => {
    const moduleServiceSpy = jasmine.createSpyObj('ModuleService', ['hasModuleAccess', 'loadActiveModules']);

    TestBed.configureTestingModule({
      providers: [
        { provide: ModuleService, useValue: moduleServiceSpy }
      ]
    });
    service = TestBed.inject(SubscriptionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTiers', () => {
    it('should return all subscription tiers', (done) => {
      service.getTiers().subscribe(tiers => {
        expect(tiers).toBeTruthy();
        expect(tiers.length).toBe(3);
        expect(tiers.map(t => t.id)).toEqual(['solo', 'starter', 'professional']);
        done();
      });
    });

    it('should return tiers with correct properties', (done) => {
      service.getTiers().subscribe(tiers => {
        const soloTier = tiers.find(t => t.id === 'solo');
        expect(soloTier).toBeDefined();
        expect(soloTier?.name).toBe('Solo');
        expect(soloTier?.price).toBe(500);
        expect(soloTier?.currency).toBe('TND');
        expect(soloTier?.limits.users).toBe(1);
        expect(soloTier?.limits.cars).toBe(50);
        expect(soloTier?.limits.serviceBays).toBe(1);
        done();
      });
    });

    it('should return professional tier with unlimited limits', (done) => {
      service.getTiers().subscribe(tiers => {
        const proTier = tiers.find(t => t.id === 'professional');
        expect(proTier).toBeDefined();
        expect(proTier?.limits.users).toBeNull();
        expect(proTier?.limits.cars).toBeNull();
        expect(proTier?.limits.serviceBays).toBeNull();
        done();
      });
    });
  });

  describe('getCurrentSubscriptionStatus', () => {
    it('should return current subscription status', (done) => {
      service.getCurrentSubscriptionStatus().subscribe(status => {
        expect(status).toBeTruthy();
        expect(status.currentTier).toBeDefined();
        expect(status.usage).toBeDefined();
        expect(status.renewalDate).toBeInstanceOf(Date);
        expect(status.isActive).toBe(true);
        expect(status.daysUntilRenewal).toBeGreaterThan(0);
        done();
      });
    });

    it('should return correct usage statistics', (done) => {
      service.getCurrentSubscriptionStatus().subscribe(status => {
        expect(status.usage.users).toBe(0);
        expect(status.usage.cars).toBe(0);
        expect(status.usage.serviceBays).toBe(0);
        done();
      });
    });
  });

  describe('getTierComparison', () => {
    it('should return tier comparison with current tier', (done) => {
      service.getTierComparison().subscribe(comparison => {
        expect(comparison).toBeTruthy();
        expect(comparison.tiers.length).toBe(3);
        expect(comparison.currentTierId).toBe('professional');
        done();
      });
    });

    it('should provide recommendation when appropriate', (done) => {
      service.getTierComparison().subscribe(comparison => {
        expect(comparison.recommendedTierId).toBeUndefined();
        done();
      });
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled features on current tier', (done) => {
      service.isFeatureEnabled('basic_inventory').subscribe(enabled => {
        expect(enabled).toBe(true);
        done();
      });
    });

    it('should return true for all features with module system', (done) => {
      service.isFeatureEnabled('team_collaboration').subscribe(enabled => {
        expect(enabled).toBe(true);
        done();
      });
    });
  });

  describe('getUsagePercentage', () => {
    it('should return 0 with module-based system', (done) => {
      service.getUsagePercentage('users').subscribe(percentage => {
        expect(percentage).toBe(0);
        done();
      });
    });

    it('should return 0 for unlimited resources', (done) => {
      service.upgradeTo('professional').subscribe(() => {
        service.getUsagePercentage('users').subscribe(percentage => {
          expect(percentage).toBe(0);
          done();
        });
      });
    });

    it('should return 0 for cars usage percentage', (done) => {
      service.getUsagePercentage('cars').subscribe(percentage => {
        expect(percentage).toBe(0);
        done();
      });
    });
  });

  describe('upgradeTo', () => {
    it('should successfully upgrade to a higher tier', (done) => {
      service.upgradeTo('professional').subscribe(success => {
        expect(success).toBe(true);

        // Verify the tier was actually changed
        service.getCurrentSubscriptionStatus().subscribe(status => {
          expect(status.currentTier.id).toBe('professional');
          done();
        });
      });
    });

    it('should update the current tier signal', (done) => {
      service.upgradeTo('solo').subscribe(() => {
        expect(service.currentTier()).toBe('solo');
        done();
      });
    });
  });

  describe('getRecommendedTier', () => {
    it('should return null when no recommendation is available', (done) => {
      service.getRecommendedTier().subscribe(tier => {
        expect(tier).toBeNull();
        done();
      });
    });
  });

  describe('hasFeature', () => {
    it('should be an alias for isFeatureEnabled', (done) => {
      service.hasFeature('customer_management').subscribe(hasFeature => {
        service.isFeatureEnabled('customer_management').subscribe(isEnabled => {
          expect(hasFeature).toBe(isEnabled);
          done();
        });
      });
    });
  });

  describe('getRequiredTier', () => {
    it('should return solo for any feature with module system', () => {
      const requiredTier = service.getRequiredTier('basic_inventory');
      expect(requiredTier).toBe('solo');
    });

    it('should return solo for advanced features with module system', () => {
      const requiredTier = service.getRequiredTier('team_collaboration');
      expect(requiredTier).toBe('solo');
    });

    it('should return solo for non-existent features with module system', () => {
      const requiredTier = service.getRequiredTier('non_existent_feature');
      expect(requiredTier).toBe('solo');
    });
  });

  describe('getUpgradeTierForFeature', () => {
    it('should return null with module-based system', () => {
      const upgradeTier = service.getUpgradeTierForFeature('team_collaboration');
      expect(upgradeTier).toBeNull();
    });

    it('should return null for already enabled features', () => {
      const upgradeTier = service.getUpgradeTierForFeature('customer_management');
      expect(upgradeTier).toBeNull();
    });
  });

  describe('isUsageLimitExceeded', () => {
    it('should return false when usage is within limits', (done) => {
      service.isUsageLimitExceeded('users').subscribe(exceeded => {
        expect(exceeded).toBe(false);
        done();
      });
    });

    it('should return false for unlimited resources', (done) => {
      service.upgradeTo('professional').subscribe(() => {
        service.isUsageLimitExceeded('users').subscribe(exceeded => {
          expect(exceeded).toBe(false);
          done();
        });
      });
    });
  });

  describe('getLockedFeatures', () => {
    it('should return empty array with module-based system', (done) => {
      service.getLockedFeatures().subscribe(lockedFeatures => {
        expect(lockedFeatures.length).toBe(0);
        done();
      });
    });
  });

  describe('canUpgradeTo', () => {
    it('should return false with module-based system', (done) => {
      service.canUpgradeTo('professional').subscribe(canUpgrade => {
        expect(canUpgrade).toBe(false);
        done();
      });
    });

    it('should not allow downgrade to lower tier', (done) => {
      service.canUpgradeTo('solo').subscribe(canUpgrade => {
        expect(canUpgrade).toBe(false);
        done();
      });
    });
  });

  describe('loading state', () => {
    it('should have correct initial loading state', () => {
      expect(service.isLoading()).toBe(false);
    });

    it('should set loading state during operations', () => {
      let loadingAfterComplete = true;
      service.getTiers().subscribe(() => {
        // Loading should be false after operation completes
        loadingAfterComplete = service.isLoading();
      });
      expect(loadingAfterComplete).toBe(false);
    });
  });

  describe('observables', () => {
    it('should provide loading observable', (done) => {
      service.loading$.subscribe(loading => {
        expect(typeof loading).toBe('boolean');
        done();
      });
    });

    it('should provide current tier observable', (done) => {
      service.currentTier$.subscribe(tierId => {
        expect(['solo', 'starter', 'professional']).toContain(tierId);
        done();
      });
    });
  });
});
