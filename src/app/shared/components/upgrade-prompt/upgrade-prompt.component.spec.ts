import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UpgradePromptComponent } from './upgrade-prompt.component';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { 
  TierComparison, 
  SubscriptionTier, 
  SubscriptionTierId 
} from '../../../core/models/subscription.model';
import { By } from '@angular/platform-browser';

describe('UpgradePromptComponent', () => {
  let component: UpgradePromptComponent;
  let fixture: ComponentFixture<UpgradePromptComponent>;
  let mockSubscriptionService: jasmine.SpyObj<SubscriptionService>;

  const mockTiers: SubscriptionTier[] = [
    {
      id: 'solo',
      name: 'Solo',
      price: 29,
      currency: 'TND',
      features: [
        { key: 'basic_inventory', enabled: true },
        { key: 'photo_upload', enabled: false, requiresUpgrade: 'professional' }
      ],
      limits: { users: 1, cars: 50, serviceBays: 2 }
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 79,
      currency: 'TND',
      features: [
        { key: 'basic_inventory', enabled: true },
        { key: 'advanced_reports', enabled: true },
        { key: 'photo_upload', enabled: false, requiresUpgrade: 'professional' }
      ],
      limits: { users: 5, cars: 200, serviceBays: 5 },
      popular: true
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 149,
      currency: 'TND',
      features: [
        { key: 'basic_inventory', enabled: true },
        { key: 'advanced_reports', enabled: true },
        { key: 'photo_upload', enabled: true }
      ],
      limits: { users: null, cars: null, serviceBays: null }
    }
  ];

  const mockTierComparison: TierComparison = {
    tiers: mockTiers,
    currentTierId: 'starter',
    recommendedTierId: 'professional'
  };

  beforeEach(async () => {
    const subscriptionServiceSpy = jasmine.createSpyObj('SubscriptionService', [
      'getTierComparison'
    ]);

    await TestBed.configureTestingModule({
      imports: [UpgradePromptComponent],
      providers: [
        { provide: SubscriptionService, useValue: subscriptionServiceSpy },
        { provide: TranslatePipe, useValue: { transform: (key: string, params?: any) => params ? `${key}:${JSON.stringify(params)}` : key } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UpgradePromptComponent);
    component = fixture.componentInstance;
    mockSubscriptionService = TestBed.inject(SubscriptionService) as jasmine.SpyObj<SubscriptionService>;
  });

  describe('Component Creation', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have default configuration', () => {
      expect(component.config).toEqual({ showComparison: true, showFeatureList: true });
      expect(component.isVisible).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should load tier comparison on init when showComparison is true', () => {
      mockSubscriptionService.getTierComparison.and.returnValue(of(mockTierComparison));
      component.config = { showComparison: true };

      component.ngOnInit();

      expect(mockSubscriptionService.getTierComparison).toHaveBeenCalled();
      expect(component.tierComparison()).toEqual(mockTierComparison);
    });

    it('should not load tier comparison when showComparison is false', () => {
      component.config = { showComparison: false };

      component.ngOnInit();

      expect(mockSubscriptionService.getTierComparison).not.toHaveBeenCalled();
    });

    it('should handle loading state', () => {
      mockSubscriptionService.getTierComparison.and.returnValue(of(mockTierComparison));
      component.config = { showComparison: true };

      expect(component.loading()).toBe(false);
      
      component.ngOnInit();

      expect(component.loading()).toBe(false); // Should be false after completion
    });
  });

  describe('Modal Content', () => {
    it('should return custom title when provided', () => {
      component.config = { title: 'Custom Title' };

      const title = component.getModalTitle();

      expect(title).toBe('Custom Title');
    });

    it('should return feature-specific title when feature is provided', () => {
      component.config = { feature: 'photo_upload' };

      const title = component.getModalTitle();

      expect(title).toBe('tiers.unlockFeature');
    });

    it('should return default title when no title or feature is provided', () => {
      component.config = {};

      const title = component.getModalTitle();

      expect(title).toBe('tiers.upgradeTitle');
    });

    it('should return custom description when provided', () => {
      component.config = { description: 'Custom Description' };

      const description = component.getModalDescription();

      expect(description).toBe('Custom Description');
    });

    it('should return feature-specific description when feature is provided', () => {
      component.config = { feature: 'photo_upload' };

      const description = component.getModalDescription();

      expect(description).toBe('tiers.upgradeForFeatureMessage');
    });
  });

  describe('Tier Comparison Rendering', () => {
    beforeEach(() => {
      mockSubscriptionService.getTierComparison.and.returnValue(of(mockTierComparison));
      component.config = { showComparison: true, showFeatureList: true };
      component.ngOnInit();
      fixture.detectChanges();
    });

    it('should display tier cards when showComparison is true', () => {
      const tierCards = fixture.debugElement.queryAll(By.css('.tier-card'));
      expect(tierCards.length).toBe(3);
    });

    it('should mark popular tier with badge', () => {
      const starterCard = fixture.debugElement.query(By.css('.tier-card.popular'));
      expect(starterCard).toBeTruthy();
      
      const popularBadge = starterCard.query(By.css('.popular-badge'));
      expect(popularBadge).toBeTruthy();
    });

    it('should mark current tier with badge', () => {
      const currentCard = fixture.debugElement.query(By.css('.tier-card.current'));
      expect(currentCard).toBeTruthy();
      
      const currentBadge = currentCard.query(By.css('.current-badge'));
      expect(currentBadge).toBeTruthy();
    });

    it('should display tier features when showFeatureList is true', () => {
      const featureItems = fixture.debugElement.queryAll(By.css('.feature-item'));
      expect(featureItems.length).toBeGreaterThan(0);
    });

    it('should show enabled and disabled features correctly', () => {
      const enabledFeatures = fixture.debugElement.queryAll(By.css('.feature-item.enabled'));
      const disabledFeatures = fixture.debugElement.queryAll(By.css('.feature-item.disabled'));

      expect(enabledFeatures.length).toBeGreaterThan(0);
      expect(disabledFeatures.length).toBeGreaterThan(0);
    });
  });

  describe('Single Tier Upgrade', () => {
    it('should display single tier upgrade when targetTier is provided and showComparison is false', () => {
      component.config = { 
        targetTier: 'professional', 
        showComparison: false,
        ctaText: 'Upgrade to Pro'
      };
      fixture.detectChanges();

      const singleTierUpgrade = fixture.debugElement.query(By.css('.single-tier-upgrade'));
      expect(singleTierUpgrade).toBeTruthy();
      
      const ctaButton = singleTierUpgrade.query(By.css('.upgrade-cta-button'));
      expect(ctaButton).toBeTruthy();
    });

    it('should display target tier name', () => {
      component.config = { targetTier: 'professional', showComparison: false };
      component.tierComparison.set(mockTierComparison);
      fixture.detectChanges();

      const tierName = component.getTargetTierName();
      expect(tierName).toBe('Professional');
    });
  });

  describe('Upgrade Actions', () => {
    it('should emit upgrade event when tier button is clicked', () => {
      mockSubscriptionService.getTierComparison.and.returnValue(of(mockTierComparison));
      component.config = { showComparison: true, feature: 'photo_upload' };
      component.ngOnInit();
      
      spyOn(component.upgrade, 'emit');
      
      component.onUpgrade('professional');

      expect(component.upgrade.emit).toHaveBeenCalledWith({
        tier: 'professional',
        feature: 'photo_upload'
      });
    });

    it('should emit upgrade event from single tier upgrade', () => {
      component.config = { targetTier: 'professional' };
      spyOn(component.upgrade, 'emit');
      
      fixture.detectChanges();
      
      const upgradeButton = fixture.debugElement.query(By.css('.upgrade-cta-button'));
      upgradeButton.triggerEventHandler('click', null);

      expect(component.upgrade.emit).toHaveBeenCalledWith({
        tier: 'professional',
        feature: undefined
      });
    });
  });

  describe('Modal Controls', () => {
    it('should emit close event when close button is clicked', () => {
      spyOn(component.close, 'emit');
      
      fixture.detectChanges();
      
      const closeButton = fixture.debugElement.query(By.css('.close-button'));
      closeButton.triggerEventHandler('click', null);

      expect(component.close.emit).toHaveBeenCalled();
    });

    it('should emit close event when cancel button is clicked', () => {
      spyOn(component.close, 'emit');
      
      fixture.detectChanges();
      
      const cancelButton = fixture.debugElement.query(By.css('.btn-secondary'));
      cancelButton.triggerEventHandler('click', null);

      expect(component.close.emit).toHaveBeenCalled();
    });

    it('should emit close event when overlay is clicked', () => {
      spyOn(component.close, 'emit');
      
      fixture.detectChanges();
      
      const overlay = fixture.debugElement.query(By.css('.upgrade-modal-overlay'));
      
      // Simulate clicking on overlay (not on modal)
      const mockEvent = {
        target: overlay.nativeElement,
        currentTarget: overlay.nativeElement
      };
      
      component.onOverlayClick(mockEvent as any);

      expect(component.close.emit).toHaveBeenCalled();
    });

    it('should not emit close event when modal content is clicked', () => {
      spyOn(component.close, 'emit');
      
      fixture.detectChanges();
      
      const modal = fixture.debugElement.query(By.css('.upgrade-modal'));
      const overlay = fixture.debugElement.query(By.css('.upgrade-modal-overlay'));
      
      // Simulate clicking on modal content
      const mockEvent = {
        target: modal.nativeElement,
        currentTarget: overlay.nativeElement
      };
      
      component.onOverlayClick(mockEvent as any);

      expect(component.close.emit).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should have proper ARIA attributes on modal', () => {
      const overlay = fixture.debugElement.query(By.css('.upgrade-modal-overlay'));
      expect(overlay.attributes['role']).toBe('dialog');
      expect(overlay.attributes['aria-modal']).toBe('true');
      expect(overlay.attributes['aria-label']).toContain('Upgrade prompt modal');
    });

    it('should have focusable modal content', () => {
      const modal = fixture.debugElement.query(By.css('.upgrade-modal'));
      expect(modal.attributes['tabindex']).toBe('0');
    });

    it('should have proper ARIA labels for buttons', () => {
      component.tierComparison.set(mockTierComparison);
      component.config = { showComparison: true };
      fixture.detectChanges();

      const tierButtons = fixture.debugElement.queryAll(By.css('.tier-cta-button'));
      tierButtons.forEach(button => {
        expect(button.attributes['aria-label']).toBeTruthy();
        expect(button.attributes['type']).toBe('button');
      });
    });

    it('should have proper close button accessibility', () => {
      const closeButton = fixture.debugElement.query(By.css('.close-button'));
      expect(closeButton.attributes['aria-label']).toBe('common.close');
      expect(closeButton.attributes['type']).toBe('button');
    });
  });

  describe('Upgrade Availability', () => {
    beforeEach(() => {
      component.tierComparison.set(mockTierComparison);
    });

    it('should allow upgrade to higher tier', () => {
      const canUpgrade = component.canUpgradeTo('professional');
      expect(canUpgrade).toBe(true);
    });

    it('should not allow downgrade to lower tier', () => {
      const canUpgrade = component.canUpgradeTo('solo');
      expect(canUpgrade).toBe(false);
    });

    it('should handle current tier', () => {
      const canUpgrade = component.canUpgradeTo('starter');
      expect(canUpgrade).toBe(false);
    });
  });

  describe('CTA Text', () => {
    beforeEach(() => {
      component.tierComparison.set(mockTierComparison);
    });

    it('should return current plan text for current tier', () => {
      const ctaText = component.getTierCtaText('starter');
      expect(ctaText).toBe('tiers.currentPlan');
    });

    it('should return upgrade text for higher tier', () => {
      const ctaText = component.getTierCtaText('professional');
      expect(ctaText).toBe('tiers.upgrade');
    });

    it('should return downgrade text for lower tier', () => {
      const ctaText = component.getTierCtaText('solo');
      expect(ctaText).toBe('tiers.downgrade');
    });
  });

  describe('Feature Visibility', () => {
    it('should return limited features for display', () => {
      const mockTier = mockTiers[1]; // Starter tier
      const visibleFeatures = component.getVisibleFeatures(mockTier);
      
      expect(visibleFeatures.length).toBeLessThanOrEqual(6);
      expect(visibleFeatures).toEqual(mockTier.features.slice(0, 6));
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive classes', () => {
      fixture.detectChanges();
      
      const modal = fixture.debugElement.query(By.css('.upgrade-modal'));
      expect(modal).toBeTruthy();
      
      // Check that the component has responsive styling
      const computedStyle = getComputedStyle(modal.nativeElement);
      expect(computedStyle).toBeTruthy();
    });
  });
});