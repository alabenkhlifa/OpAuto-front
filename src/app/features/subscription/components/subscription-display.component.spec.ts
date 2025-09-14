import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { SubscriptionDisplayComponent } from './subscription-display.component';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { 
  SubscriptionStatus, 
  SubscriptionTier, 
  TierComparison, 
  FeatureConfig 
} from '../../../core/models/subscription.model';

describe('SubscriptionDisplayComponent', () => {
  let component: SubscriptionDisplayComponent;
  let fixture: ComponentFixture<SubscriptionDisplayComponent>;
  let mockSubscriptionService: jasmine.SpyObj<SubscriptionService>;
  let mockLanguageService: jasmine.SpyObj<LanguageService>;

  const mockTier: SubscriptionTier = {
    id: 'starter',
    name: 'Starter',
    price: 79,
    currency: 'TND',
    features: [
      { key: 'basic_inventory', enabled: true },
      { key: 'customer_management', enabled: true },
      { key: 'team_collaboration', enabled: false, requiresUpgrade: 'professional' }
    ],
    limits: { users: 5, cars: 200, serviceBays: 5 },
    popular: true
  };

  const mockStatus: SubscriptionStatus = {
    currentTier: mockTier,
    usage: { users: 3, cars: 47, serviceBays: 2 },
    renewalDate: new Date('2025-10-14'),
    isActive: true,
    daysUntilRenewal: 30
  };

  const mockComparison: TierComparison = {
    tiers: [mockTier],
    currentTierId: 'starter',
    recommendedTierId: 'professional'
  };

  beforeEach(async () => {
    const subscriptionSpy = jasmine.createSpyObj('SubscriptionService', [
      'getCurrentSubscriptionStatus',
      'getTierComparison',
      'upgradeTo'
    ], {
      isLoading: signal(false)
    });

    const languageSpy = jasmine.createSpyObj('LanguageService', [
      'getCurrentLanguage',
      'isRTL'
    ]);

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        SubscriptionDisplayComponent,
        TranslatePipe
      ],
      providers: [
        { provide: SubscriptionService, useValue: subscriptionSpy },
        { provide: LanguageService, useValue: languageSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionDisplayComponent);
    component = fixture.componentInstance;
    mockSubscriptionService = TestBed.inject(SubscriptionService) as jasmine.SpyObj<SubscriptionService>;
    mockLanguageService = TestBed.inject(LanguageService) as jasmine.SpyObj<LanguageService>;

    // Setup default mock returns
    mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus));
    mockSubscriptionService.getTierComparison.and.returnValue(of(mockComparison));
    mockSubscriptionService.upgradeTo.and.returnValue(of(true));
    mockLanguageService.getCurrentLanguage.and.returnValue('en');
    mockLanguageService.isRTL.and.returnValue(false);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load subscription data on init', () => {
    fixture.detectChanges();
    
    expect(mockSubscriptionService.getCurrentSubscriptionStatus).toHaveBeenCalled();
    expect(mockSubscriptionService.getTierComparison).toHaveBeenCalled();
    expect(component.subscriptionStatus()).toEqual(mockStatus);
    expect(component.tierComparison()).toEqual(mockComparison);
  });

  it('should display loading state', () => {
    (mockSubscriptionService as any).isLoading = jasmine.createSpy().and.returnValue(signal(true));
    fixture.detectChanges();
    
    const loadingElement = fixture.debugElement.nativeElement.querySelector('.loading-container');
    expect(loadingElement).toBeTruthy();
  });

  it('should format currency correctly', () => {
    mockLanguageService.getCurrentLanguage.and.returnValue('en');
    const formatted = component.formatCurrency(79);
    expect(formatted).toContain('79');
  });

  it('should format date correctly', () => {
    mockLanguageService.getCurrentLanguage.and.returnValue('en');
    const date = new Date('2025-10-14');
    const formatted = component.formatDate(date);
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });

  it('should calculate usage statistics', () => {
    component.subscriptionStatus.set(mockStatus);
    const stats = component.getUsageStats();
    
    expect(stats.length).toBe(3);
    
    const userStat = stats.find(s => s.type === 'users');
    expect(userStat).toBeDefined();
    expect(userStat?.current).toBe(3);
    expect(userStat?.limit).toBe(5);
    expect(userStat?.percentage).toBe(60);
  });

  it('should handle unlimited limits in usage statistics', () => {
    const unlimitedTier: SubscriptionTier = {
      ...mockTier,
      id: 'professional',
      limits: { users: null, cars: null, serviceBays: null }
    };
    
    const statusWithUnlimited: SubscriptionStatus = {
      ...mockStatus,
      currentTier: unlimitedTier
    };
    
    component.subscriptionStatus.set(statusWithUnlimited);
    const stats = component.getUsageStats();
    
    const userStat = stats.find(s => s.type === 'users');
    expect(userStat?.limit).toBeNull();
    expect(userStat?.percentage).toBe(0);
  });

  it('should get correct tier badge class', () => {
    expect(component.getTierBadgeClass('solo')).toBe('tier-badge solo');
    expect(component.getTierBadgeClass('starter')).toBe('tier-badge starter');
    expect(component.getTierBadgeClass('professional')).toBe('tier-badge professional');
  });

  it('should get correct tier card class for current tier', () => {
    component.tierComparison.set(mockComparison);
    const cardClass = component.getTierCardClass(mockTier);
    expect(cardClass).toBe('current');
  });

  it('should get correct tier card class for recommended tier', () => {
    const recommendedTier: SubscriptionTier = {
      ...mockTier,
      id: 'professional'
    };
    
    component.tierComparison.set(mockComparison);
    const cardClass = component.getTierCardClass(recommendedTier);
    expect(cardClass).toBe('recommended');
  });

  it('should get correct feature item class', () => {
    const enabledFeature: FeatureConfig = { key: 'test', enabled: true };
    const disabledFeature: FeatureConfig = { key: 'test', enabled: false };
    
    expect(component.getFeatureItemClass(enabledFeature)).toBe('enabled');
    expect(component.getFeatureItemClass(disabledFeature)).toBe('disabled');
  });

  it('should get correct feature icon class', () => {
    const enabledFeature: FeatureConfig = { key: 'test', enabled: true };
    const disabledFeature: FeatureConfig = { key: 'test', enabled: false };
    
    expect(component.getFeatureIconClass(enabledFeature)).toBe('enabled');
    expect(component.getFeatureIconClass(disabledFeature)).toBe('disabled');
  });

  it('should get correct progress class based on percentage', () => {
    expect(component.getProgressClass(50)).toBe('low');
    expect(component.getProgressClass(80)).toBe('medium');
    expect(component.getProgressClass(95)).toBe('high');
  });

  it('should get correct usage text class based on percentage', () => {
    expect(component.getUsageTextClass(50)).toBe('text-green-400');
    expect(component.getUsageTextClass(80)).toBe('text-yellow-400');
    expect(component.getUsageTextClass(95)).toBe('text-red-400');
  });

  it('should get correct renewal status class based on days left', () => {
    expect(component.getRenewalStatusClass(15)).toBe('text-green-400');
    expect(component.getRenewalStatusClass(5)).toBe('text-yellow-400');
    expect(component.getRenewalStatusClass(2)).toBe('text-red-400');
  });

  it('should handle upgrade successfully', () => {
    spyOn(component, 'loadSubscriptionData' as any);
    
    component.upgradeTo('professional');
    
    expect(mockSubscriptionService.upgradeTo).toHaveBeenCalledWith('professional');
  });

  it('should reload data after successful upgrade', () => {
    const loadDataSpy = spyOn<any>(component, 'loadSubscriptionData');
    
    component.upgradeTo('professional');
    
    // Since the observable returns true, loadSubscriptionData should be called
    expect(loadDataSpy).toHaveBeenCalled();
  });

  it('should handle RTL layout', () => {
    mockLanguageService.isRTL.and.returnValue(true);
    
    // Recreate component to pick up the new RTL value
    const newFixture = TestBed.createComponent(SubscriptionDisplayComponent);
    const newComponent = newFixture.componentInstance;
    
    expect(newComponent.isRtl()).toBe(true);
  });

  describe('trackBy functions', () => {
    it('should track usage items by type', () => {
      const item = { type: 'users', label: 'Users', current: 3, limit: 5, percentage: 60 };
      expect(component.trackByUsageType(0, item)).toBe('users');
    });

    it('should track features by key', () => {
      const feature: FeatureConfig = { key: 'test_feature', enabled: true };
      expect(component.trackByFeatureKey(0, feature)).toBe('test_feature');
    });

    it('should track tiers by id', () => {
      expect(component.trackByTierId(0, mockTier)).toBe('starter');
    });
  });

  describe('percentage calculation', () => {
    it('should calculate percentage correctly for limited resources', () => {
      const percentage = component['calculatePercentage'](3, 5);
      expect(percentage).toBe(60);
    });

    it('should return 0 for unlimited resources', () => {
      const percentage = component['calculatePercentage'](100, null);
      expect(percentage).toBe(0);
    });

    it('should cap percentage at 100', () => {
      const percentage = component['calculatePercentage'](10, 5);
      expect(percentage).toBe(100);
    });

    it('should handle zero limit', () => {
      const percentage = component['calculatePercentage'](1, 0);
      expect(percentage).toBe(100);
    });
  });

  describe('data loading error handling', () => {
    it('should handle subscription status loading errors gracefully', () => {
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(
        throwError(() => new Error('Network error'))
      );
      
      fixture.detectChanges();
      
      // Component should not crash
      expect(component).toBeTruthy();
    });

    it('should handle tier comparison loading errors gracefully', () => {
      mockSubscriptionService.getTierComparison.and.returnValue(
        throwError(() => new Error('Network error'))
      );
      
      fixture.detectChanges();
      
      // Component should not crash
      expect(component).toBeTruthy();
    });
  });

  describe('component integration', () => {
    it('should render current plan information when data is loaded', () => {
      fixture.detectChanges();
      
      const compiled = fixture.debugElement.nativeElement;
      expect(compiled.querySelector('.current-subscription')).toBeTruthy();
    });

    it('should render tier comparison when data is loaded', () => {
      fixture.detectChanges();
      
      const compiled = fixture.debugElement.nativeElement;
      expect(compiled.querySelector('.tier-comparison')).toBeTruthy();
    });
  });
});