import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { PricingPageComponent } from './pricing-page.component';
import { SubscriptionService } from '../../core/services/subscription.service';
import { LanguageService } from '../../core/services/language.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

describe('PricingPageComponent', () => {
  let component: PricingPageComponent;
  let fixture: ComponentFixture<PricingPageComponent>;
  let mockSubscriptionService: jasmine.SpyObj<SubscriptionService>;
  let mockLanguageService: jasmine.SpyObj<LanguageService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const subscriptionServiceSpy = jasmine.createSpyObj('SubscriptionService', ['getCurrentSubscriptionStatus']);
    const languageServiceSpy = jasmine.createSpyObj('LanguageService', ['getCurrentLanguage', 'isRTL']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [PricingPageComponent],
      providers: [
        { provide: SubscriptionService, useValue: subscriptionServiceSpy },
        { provide: LanguageService, useValue: languageServiceSpy },
        { provide: Router, useValue: routerSpy },
        TranslatePipe
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PricingPageComponent);
    component = fixture.componentInstance;
    mockSubscriptionService = TestBed.inject(SubscriptionService) as jasmine.SpyObj<SubscriptionService>;
    mockLanguageService = TestBed.inject(LanguageService) as jasmine.SpyObj<LanguageService>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    // Setup default mock returns
    mockLanguageService.getCurrentLanguage.and.returnValue('en');
    mockLanguageService.isRTL.and.returnValue(false);
    mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of({
      currentTier: { id: 'starter' },
      usage: { users: 1, cars: 25, serviceBays: 1 },
      renewalDate: new Date(),
      daysUntilRenewal: 30
    } as any));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Tier Configuration', () => {
    it('should have three pricing tiers defined', () => {
      expect(component.tiers).toBeDefined();
      expect(component.tiers.length).toBe(3);
    });

    it('should have correct tier IDs', () => {
      const tierIds = component.tiers.map(tier => tier.id);
      expect(tierIds).toEqual(['solo', 'starter', 'professional']);
    });

    it('should have correct pricing for each tier', () => {
      const prices = component.tiers.map(tier => tier.price);
      expect(prices).toEqual([500, 2000, 6000]);
    });

    it('should have correct monthly equivalents', () => {
      const monthlyPrices = component.tiers.map(tier => tier.monthlyEquivalent);
      expect(monthlyPrices).toEqual([42, 167, 500]);
    });

    it('should mark starter tier as popular', () => {
      const popularTier = component.tiers.find(tier => tier.popular);
      expect(popularTier?.id).toBe('starter');
    });

    it('should have correct ROI percentages', () => {
      const roiPercentages = component.tiers.map(tier => tier.roiPercentage);
      expect(roiPercentages).toEqual(['3.5-5%', '1.1-1.7%', '1.25-2%']);
    });
  });

  describe('Feature Comparison', () => {
    it('should have feature comparisons defined', () => {
      expect(component.featureComparisons).toBeDefined();
      expect(component.featureComparisons.length).toBeGreaterThan(0);
    });

    it('should include key features in comparison', () => {
      const featureKeys = component.featureComparisons.map(feature => feature.key);
      expect(featureKeys).toContain('users');
      expect(featureKeys).toContain('cars');
      expect(featureKeys).toContain('photos');
      expect(featureKeys).toContain('sms');
    });

    it('should have correct user limits', () => {
      const usersFeature = component.featureComparisons.find(f => f.key === 'users');
      expect(usersFeature?.solo.value).toBe('1');
      expect(usersFeature?.starter.value).toBe('3');
      expect(usersFeature?.professional.value).toBe('unlimited');
    });

    it('should have correct car limits', () => {
      const carsFeature = component.featureComparisons.find(f => f.key === 'cars');
      expect(carsFeature?.solo.value).toBe('50');
      expect(carsFeature?.starter.value).toBe('200');
      expect(carsFeature?.professional.value).toBe('unlimited');
    });
  });

  describe('FAQ Configuration', () => {
    it('should have FAQ items defined', () => {
      expect(component.faqs).toBeDefined();
      expect(component.faqs.length).toBe(6);
    });

    it('should include essential FAQ topics', () => {
      const faqKeys = component.faqs.map(faq => faq.key);
      expect(faqKeys).toContain('billing');
      expect(faqKeys).toContain('cancellation');
      expect(faqKeys).toContain('upgrade');
      expect(faqKeys).toContain('support');
    });
  });

  describe('Price Formatting', () => {
    beforeEach(() => {
      mockLanguageService.getCurrentLanguage.and.returnValue('en');
    });

    it('should format prices correctly', () => {
      const formatted = component.formatPrice(500);
      expect(formatted).toBe('500 TND');
    });

    it('should format large prices correctly', () => {
      const formatted = component.formatPrice(2000);
      expect(formatted).toBe('2,000 TND');
    });

    it('should handle zero price', () => {
      const formatted = component.formatPrice(0);
      expect(formatted).toBe('0 TND');
    });
  });

  describe('Feature Display Value', () => {
    it('should return ✗ for excluded features', () => {
      const result = component.getFeatureDisplayValue({ value: false, included: false });
      expect(result).toBe('✗');
    });

    it('should return ✓ for included boolean features', () => {
      const result = component.getFeatureDisplayValue({ value: true, included: true });
      expect(result).toBe('✓');
    });

    it('should return ✗ for false boolean features', () => {
      const result = component.getFeatureDisplayValue({ value: false, included: true });
      expect(result).toBe('✗');
    });

    it('should return translation key for unlimited features', () => {
      const result = component.getFeatureDisplayValue({ value: 'unlimited', included: true });
      expect(result).toBe('common.unlimited');
    });

    it('should return string value for numeric features', () => {
      const result = component.getFeatureDisplayValue({ value: 50, included: true });
      expect(result).toBe('50');
    });
  });

  describe('Tier Selection', () => {
    it('should navigate to subscription page with upgrade parameter', () => {
      component.selectTier('professional');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/subscription'], {
        queryParams: { upgrade: 'professional' }
      });
    });

    it('should navigate with correct tier ID', () => {
      component.selectTier('solo');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/subscription'], {
        queryParams: { upgrade: 'solo' }
      });
    });
  });

  describe('Current Tier Detection', () => {
    it('should set current tier from subscription service', () => {
      const mockStatus = {
        currentTier: { id: 'starter' },
        usage: { users: 2, cars: 50, serviceBays: 1 },
        renewalDate: new Date(),
        daysUntilRenewal: 30
      };
      
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(mockStatus as any));
      
      component.ngOnInit();
      
      expect(component.currentTier()).toBe('starter');
    });

    it('should handle null subscription status', () => {
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(null as any));
      
      component.ngOnInit();
      
      // Should use default value
      expect(component.currentTier()).toBe('starter');
    });
  });

  describe('RTL Support', () => {
    it('should detect RTL languages', () => {
      mockLanguageService.isRTL.and.returnValue(true);
      
      fixture.detectChanges();
      
      expect(component.isRtl()).toBe(true);
    });

    it('should detect LTR languages', () => {
      mockLanguageService.isRTL.and.returnValue(false);
      
      fixture.detectChanges();
      
      expect(component.isRtl()).toBe(false);
    });
  });

  describe('TrackBy Functions', () => {
    it('should track tiers by ID', () => {
      const tier = { id: 'solo', name: 'Solo' };
      const result = component.trackByTierId(0, tier as any);
      expect(result).toBe('solo');
    });

    it('should track features by key', () => {
      const feature = { key: 'users', value: 1, included: true };
      const result = component.trackByFeatureKey(0, feature);
      expect(result).toBe('users');
    });
  });

  describe('Component Integration', () => {
    it('should initialize with default values', () => {
      fixture.detectChanges();
      
      expect(component.tiers.length).toBe(3);
      expect(component.featureComparisons.length).toBeGreaterThan(0);
      expect(component.faqs.length).toBe(6);
    });

    it('should handle subscription service errors gracefully', () => {
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of(null as any));
      
      expect(() => {
        fixture.detectChanges();
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for tier cards', () => {
      fixture.detectChanges();
      
      const tierCards = fixture.nativeElement.querySelectorAll('.tier-card');
      tierCards.forEach((card: HTMLElement) => {
        expect(card.getAttribute('aria-label')).toContain('pricing tier option');
      });
    });

    it('should have proper table roles for feature comparison', () => {
      fixture.detectChanges();
      
      const table = fixture.nativeElement.querySelector('.comparison-table');
      expect(table?.getAttribute('role')).toBe('table');
      
      const headerCells = fixture.nativeElement.querySelectorAll('th[role="columnheader"]');
      expect(headerCells.length).toBeGreaterThan(0);
    });

    it('should have aria-hidden for decorative icons', () => {
      fixture.detectChanges();
      
      const icons = fixture.nativeElement.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive CSS classes', () => {
      fixture.detectChanges();
      
      const pricingGrid = fixture.nativeElement.querySelector('.pricing-grid');
      expect(pricingGrid).toBeTruthy();
      
      const tierCards = fixture.nativeElement.querySelectorAll('.tier-card');
      expect(tierCards.length).toBe(3);
    });
  });

  describe('Value Propositions', () => {
    it('should have value propositions for each tier', () => {
      component.tiers.forEach(tier => {
        expect(tier.valueProps).toBeDefined();
        expect(tier.valueProps.length).toBeGreaterThan(0);
      });
    });

    it('should have appropriate value props for solo tier', () => {
      const soloTier = component.tiers.find(t => t.id === 'solo');
      expect(soloTier?.valueProps).toContain('independent');
      expect(soloTier?.valueProps).toContain('mobile');
    });

    it('should have appropriate value props for starter tier', () => {
      const starterTier = component.tiers.find(t => t.id === 'starter');
      expect(starterTier?.valueProps).toContain('smallteam');
      expect(starterTier?.valueProps).toContain('growing');
    });

    it('should have appropriate value props for professional tier', () => {
      const professionalTier = component.tiers.find(t => t.id === 'professional');
      expect(professionalTier?.valueProps).toContain('large');
      expect(professionalTier?.valueProps).toContain('enterprise');
    });
  });
});