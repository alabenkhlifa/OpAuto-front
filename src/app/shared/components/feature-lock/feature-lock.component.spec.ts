import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FeatureLockComponent } from './feature-lock.component';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('FeatureLockComponent', () => {
  let component: FeatureLockComponent;
  let fixture: ComponentFixture<FeatureLockComponent>;
  let mockSubscriptionService: jasmine.SpyObj<SubscriptionService>;

  beforeEach(async () => {
    const subscriptionServiceSpy = jasmine.createSpyObj('SubscriptionService', [
      'isFeatureEnabled',
      'getUpgradeTierForFeature'
    ]);

    await TestBed.configureTestingModule({
      imports: [FeatureLockComponent],
      providers: [
        { provide: SubscriptionService, useValue: subscriptionServiceSpy },
        { provide: TranslatePipe, useValue: { transform: (key: string) => key } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureLockComponent);
    component = fixture.componentInstance;
    mockSubscriptionService = TestBed.inject(SubscriptionService) as jasmine.SpyObj<SubscriptionService>;
  });

  describe('Component Creation', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have default configuration', () => {
      expect(component.config).toEqual({ feature: '', showUpgradeButton: true });
      expect(component.feature).toBe('');
      expect(component.showUpgradeButton).toBe(true);
      expect(component.showOverlay).toBe(true);
    });
  });

  describe('Feature Checking', () => {
    it('should identify locked feature', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(false));
      component.feature = 'photo_upload';
      
      fixture.detectChanges();
      
      expect(component.isLocked()).toBe(true);
    });

    it('should identify unlocked feature', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(true));
      component.feature = 'basic_inventory';
      
      fixture.detectChanges();
      
      expect(component.isLocked()).toBe(false);
    });

    it('should handle empty feature key', () => {
      component.feature = '';
      
      fixture.detectChanges();
      
      expect(component.isLocked()).toBe(false);
    });
  });

  describe('Template Rendering', () => {
    it('should show content when feature is unlocked', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(true));
      component.feature = 'basic_inventory';
      
      fixture.detectChanges();
      
      const overlay = fixture.debugElement.query(By.css('.feature-lock-overlay'));
      expect(overlay).toBeFalsy();
    });

    it('should show lock overlay when feature is locked', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(false));
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');
      component.feature = 'photo_upload';
      component.showOverlay = true;
      
      fixture.detectChanges();
      
      const overlay = fixture.debugElement.query(By.css('.feature-lock-overlay'));
      expect(overlay).toBeTruthy();
    });

    it('should show lock icon in overlay', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(false));
      component.feature = 'photo_upload';
      component.showOverlay = true;
      
      fixture.detectChanges();
      
      const lockIcon = fixture.debugElement.query(By.css('.lock-icon svg'));
      expect(lockIcon).toBeTruthy();
    });

    it('should show upgrade button when configured', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(false));
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');
      component.feature = 'photo_upload';
      component.showUpgradeButton = true;
      component.showOverlay = true;
      
      fixture.detectChanges();
      
      const upgradeButton = fixture.debugElement.query(By.css('.upgrade-cta'));
      expect(upgradeButton).toBeTruthy();
    });

    it('should hide upgrade button when configured', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(false));
      component.feature = 'photo_upload';
      component.config = { feature: 'photo_upload', showUpgradeButton: false };
      component.showOverlay = true;
      
      fixture.detectChanges();
      
      const upgradeButton = fixture.debugElement.query(By.css('.upgrade-cta'));
      expect(upgradeButton).toBeFalsy();
    });
  });

  describe('Lock Messages', () => {
    it('should return custom message when provided', () => {
      component.customMessage = 'Custom lock message';
      
      const message = component.getLockMessage();
      
      expect(message).toBe('Custom lock message');
    });

    it('should return config custom message when provided', () => {
      component.config = { feature: 'test', customMessage: 'Config custom message' };
      
      const message = component.getLockMessage();
      
      expect(message).toBe('Config custom message');
    });

    it('should return tier-specific message when tier is available', () => {
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');
      component.feature = 'photo_upload';
      
      const message = component.getLockMessage();
      
      expect(message).toBe('tiers.featureLockedWithTier');
    });

    it('should return generic message when no tier is specified', () => {
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue(null);
      component.feature = 'photo_upload';
      
      const message = component.getLockMessage();
      
      expect(message).toBe('tiers.featureLocked');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for overlay', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(false));
      component.feature = 'photo_upload';
      component.title = 'Photo Upload';
      component.showOverlay = true;
      
      fixture.detectChanges();
      
      const overlay = fixture.debugElement.query(By.css('.feature-lock-overlay'));
      expect(overlay.attributes['role']).toBe('dialog');
      expect(overlay.attributes['aria-modal']).toBe('true');
      expect(overlay.attributes['aria-label']).toContain('Photo Upload');
    });

    it('should have proper ARIA label for upgrade button', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(false));
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');
      component.feature = 'photo_upload';
      component.showOverlay = true;
      
      fixture.detectChanges();
      
      const upgradeButton = fixture.debugElement.query(By.css('.upgrade-cta'));
      expect(upgradeButton.attributes['aria-label']).toContain('professional');
    });

    it('should be focusable', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(false));
      component.feature = 'photo_upload';
      component.showOverlay = true;
      
      fixture.detectChanges();
      
      const overlay = fixture.debugElement.query(By.css('.feature-lock-overlay'));
      expect(overlay.attributes['tabindex']).toBe('0');
    });
  });

  describe('Event Handling', () => {
    it('should emit upgrade event when button is clicked', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(false));
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');
      component.feature = 'photo_upload';
      component.showOverlay = true;
      
      spyOn(component.upgradeClicked, 'emit');
      
      fixture.detectChanges();
      
      const upgradeButton = fixture.debugElement.query(By.css('.upgrade-cta'));
      upgradeButton.triggerEventHandler('click', null);
      
      expect(component.upgradeClicked.emit).toHaveBeenCalledWith({
        feature: 'photo_upload',
        requiredTier: 'professional'
      });
    });
  });

  describe('Configuration Handling', () => {
    it('should use config feature over direct feature input', () => {
      component.config = { feature: 'config_feature' };
      component.feature = 'direct_feature';
      
      const featureKey = component['getFeatureKey']();
      
      expect(featureKey).toBe('config_feature');
    });

    it('should use config required tier', () => {
      component.config = { feature: 'test', requiredTier: 'starter' };
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');
      
      const requiredTier = component.getRequiredTierName();
      
      expect(requiredTier).toBe('starter');
    });
  });

  describe('Programmatic Methods', () => {
    it('should return observable for feature access', () => {
      mockSubscriptionService.hasFeature.and.returnValue(of(true));
      component.feature = 'basic_inventory';
      
      component.hasFeatureAccess().subscribe(hasAccess => {
        expect(hasAccess).toBe(true);
      });
      
      expect(mockSubscriptionService.hasFeature).toHaveBeenCalledWith('basic_inventory');
    });

    it('should return upgrade tier info', () => {
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');
      component.feature = 'photo_upload';
      
      const tierInfo = component.getUpgradeTierInfo();
      
      expect(tierInfo.tier).toBe('professional');
      expect(tierInfo.name).toBe('professional');
    });

    it('should handle empty feature key gracefully', () => {
      component.feature = '';
      
      component.hasFeatureAccess().subscribe(hasAccess => {
        expect(hasAccess).toBe(true);
      });
    });
  });

  describe('CSS Classes', () => {
    it('should apply feature-locked class when feature is locked', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(false));
      component.feature = 'photo_upload';
      
      fixture.detectChanges();
      
      const container = fixture.debugElement.query(By.css('.feature-container'));
      expect(container.classes['feature-locked']).toBe(true);
    });

    it('should not apply feature-locked class when feature is unlocked', () => {
      mockSubscriptionService.isFeatureEnabled.and.returnValue(of(true));
      component.feature = 'basic_inventory';
      
      fixture.detectChanges();
      
      const container = fixture.debugElement.query(By.css('.feature-container'));
      expect(container.classes['feature-locked']).toBeFalsy();
    });
  });
});