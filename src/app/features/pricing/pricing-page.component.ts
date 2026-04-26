import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, computed, signal, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { SubscriptionService } from '../../core/services/subscription.service';
import { LanguageService } from '../../core/services/language.service';
import { TranslationService } from '../../core/services/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

interface PricingTier {
  id: string;
  name: string;
  price: number;
  monthlyEquivalent: number;
  popular: boolean;
  targetRevenue: string;
  roiPercentage: string;
  features: {
    key: string;
    value: string | number | boolean;
    included: boolean;
  }[];
  valueProps: string[];
}

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pricing-page" [attr.dir]="isRtl() ? 'rtl' : 'ltr'">
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-container">
          <div class="hero-content">
            <h1 class="hero-title">
              {{ 'pricing.hero.title' | translate }}
            </h1>
            <p class="hero-subtitle">
              {{ 'pricing.hero.subtitle' | translate }}
            </p>
            <div class="hero-benefits">
              <div class="benefit-pill">
                <span class="benefit-icon">✓</span>
                {{ 'pricing.hero.benefit1' | translate }}
              </div>
              <div class="benefit-pill">
                <span class="benefit-icon">✓</span>
                {{ 'pricing.hero.benefit2' | translate }}
              </div>
              <div class="benefit-pill">
                <span class="benefit-icon">✓</span>
                {{ 'pricing.hero.benefit3' | translate }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Pricing Cards Section -->
      <section class="pricing-section">
        <div class="section-container">
          <div class="pricing-header">
            <h2 class="section-title">
              {{ 'pricing.plans.title' | translate }}
            </h2>
            <p class="section-subtitle">
              {{ 'pricing.plans.subtitle' | translate }}
            </p>
          </div>

          <div class="pricing-grid">
            <div
              *ngFor="let tier of tiers; trackBy: trackByTierId"
              class="tier-card glass-card"
              [class.popular-tier]="tier.popular"
              [class.current-plan]="currentTier() === tier.id"
              [attr.aria-label]="(tier.name | translate) + ' ' + ('pricing.tierCard' | translate)"
            >
              <!-- Popular Badge -->
              <div *ngIf="tier.popular" class="popular-badge">
                {{ 'pricing.mostPopular' | translate }}
              </div>

              <!-- Tier Header -->
              <div class="tier-header">
                <h3 class="tier-name">{{ ('tiers.' + tier.id) | translate }}</h3>
                <div class="tier-pricing">
                  <div class="price-container">
                    <span class="price-amount" [attr.aria-label]="formatPrice(tier.price) + ' ' + ('pricing.perYear' | translate)">
                      {{ formatPrice(tier.price) }}
                    </span>
                    <span class="price-period">{{ 'pricing.perYear' | translate }}</span>
                  </div>
                  <div class="monthly-equivalent">
                    ~{{ formatPrice(tier.monthlyEquivalent) }}/{{ 'pricing.month' | translate }}
                  </div>
                </div>
              </div>

              <!-- ROI Section -->
              <div class="roi-section">
                <div class="roi-item">
                  <span class="roi-label">{{ 'pricing.targetRevenue' | translate }}:</span>
                  <span class="roi-value">{{ tier.targetRevenue }}</span>
                </div>
                <div class="roi-item highlight">
                  <span class="roi-label">{{ 'pricing.costAsPercentage' | translate }}:</span>
                  <span class="roi-value">{{ tier.roiPercentage }}</span>
                </div>
              </div>

              <!-- Value Propositions -->
              <div class="value-props">
                <h4 class="value-props-title">{{ 'pricing.perfectFor' | translate }}:</h4>
                <ul class="value-props-list">
                  <li *ngFor="let prop of tier.valueProps" class="value-prop-item">
                    {{ ('pricing.valueProps.' + tier.id + '.' + prop) | translate }}
                  </li>
                </ul>
              </div>

              <!-- Features List -->
              <div class="features-section">
                <h4 class="features-title">{{ 'pricing.included' | translate }}:</h4>
                <ul class="features-list">
                  <li
                    *ngFor="let feature of tier.features; trackBy: trackByFeatureKey"
                    class="feature-item"
                    [class.included]="feature.included"
                    [class.excluded]="!feature.included"
                  >
                    <div class="feature-icon" [attr.aria-hidden]="true">
                      <svg *ngIf="feature.included" class="check-icon" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                      </svg>
                      <svg *ngIf="!feature.included" class="x-icon" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                      </svg>
                    </div>
                    <span class="feature-text">
                      {{ ('pricing.features.' + feature.key) | translate }}
                      <span *ngIf="feature.value !== true && feature.value !== false" class="feature-value">
                        ({{ feature.value === 'unlimited' ? ('common.unlimited' | translate) : feature.value }})
                      </span>
                    </span>
                  </li>
                </ul>
              </div>

              <!-- CTA Button -->
              <div class="tier-footer">
                <button
                  *ngIf="currentTier() === tier.id"
                  class="btn-secondary tier-cta"
                  disabled
                  [attr.aria-label]="'pricing.currentPlan' | translate"
                >
                  {{ 'pricing.currentPlan' | translate }}
                </button>
                <button
                  *ngIf="currentTier() !== tier.id"
                  class="btn-primary tier-cta"
                  (click)="selectTier(tier.id)"
                  [attr.aria-label]="('pricing.choosePlan' | translate) + ' ' + (tier.name | translate)"
                >
                  {{ 'pricing.choosePlan' | translate }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Feature Comparison Table -->
      <section class="comparison-section">
        <div class="section-container">
          <h2 class="section-title">
            {{ 'pricing.featureComparison' | translate }}
          </h2>
          
          <div class="comparison-table-container glass-card">
            <div class="table-wrapper">
              <table class="comparison-table" role="table" [attr.aria-label]="'pricing.featureComparisonTable' | translate">
                <thead>
                  <tr role="row">
                    <th role="columnheader" class="feature-col">{{ 'pricing.featuresLabel' | translate }}</th>
                    <th role="columnheader" class="tier-col solo">{{ 'tiers.solo' | translate }}</th>
                    <th role="columnheader" class="tier-col starter">{{ 'tiers.starter' | translate }}</th>
                    <th role="columnheader" class="tier-col professional">{{ 'tiers.professional' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr role="row" *ngFor="let comparison of featureComparisons">
                    <td role="cell" class="feature-name">{{ ('pricing.features.' + comparison.key) | translate }}</td>
                    <td role="cell" class="tier-value" [class.included]="comparison.solo.included">
                      <span class="value-text">{{ getFeatureDisplayValue(comparison.solo) | translate }}</span>
                    </td>
                    <td role="cell" class="tier-value" [class.included]="comparison.starter.included">
                      <span class="value-text">{{ getFeatureDisplayValue(comparison.starter) | translate }}</span>
                    </td>
                    <td role="cell" class="tier-value" [class.included]="comparison.professional.included">
                      <span class="value-text">{{ getFeatureDisplayValue(comparison.professional) | translate }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ Section -->
      <section class="faq-section">
        <div class="section-container">
          <h2 class="section-title">
            {{ 'pricing.faq.title' | translate }}
          </h2>
          
          <div class="faq-grid">
            <div *ngFor="let faq of faqs; let i = index" class="faq-card glass-card">
              <h3 class="faq-question">
                {{ ('pricing.faq.' + faq.key + '.question') | translate }}
              </h3>
              <p class="faq-answer">
                {{ ('pricing.faq.' + faq.key + '.answer') | translate }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Trust & Contact Section -->
      <section class="trust-section">
        <div class="section-container">
          <div class="trust-grid">
            <!-- Trust Indicators -->
            <div class="trust-card glass-card">
              <h3 class="trust-title">
                {{ 'pricing.trust.title' | translate }}
              </h3>
              <div class="trust-indicators">
                <div class="trust-item">
                  <div class="trust-icon security">🔒</div>
                  <div class="trust-content">
                    <h4 class="trust-item-title">{{ 'pricing.trust.security.title' | translate }}</h4>
                    <p class="trust-item-desc">{{ 'pricing.trust.security.description' | translate }}</p>
                  </div>
                </div>
                <div class="trust-item">
                  <div class="trust-icon uptime">⚡</div>
                  <div class="trust-content">
                    <h4 class="trust-item-title">{{ 'pricing.trust.uptime.title' | translate }}</h4>
                    <p class="trust-item-desc">{{ 'pricing.trust.uptime.description' | translate }}</p>
                  </div>
                </div>
                <div class="trust-item">
                  <div class="trust-icon support">💬</div>
                  <div class="trust-content">
                    <h4 class="trust-item-title">{{ 'pricing.trust.support.title' | translate }}</h4>
                    <p class="trust-item-desc">{{ 'pricing.trust.support.description' | translate }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Contact Information -->
            <div class="contact-card glass-card">
              <h3 class="contact-title">
                {{ 'pricing.contact.title' | translate }}
              </h3>
              <p class="contact-description">
                {{ 'pricing.contact.description' | translate }}
              </p>
              <div class="contact-methods">
                <button class="btn-secondary contact-btn">
                  <span class="contact-icon">📧</span>
                  {{ 'pricing.contact.email' | translate }}
                </button>
                <button class="btn-tertiary contact-btn">
                  <span class="contact-icon">📞</span>
                  {{ 'pricing.contact.phone' | translate }}
                </button>
              </div>
              <div class="enterprise-note">
                <p class="enterprise-text">
                  {{ 'pricing.contact.enterprise' | translate }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./pricing-page.component.css']
})
export class PricingPageComponent implements OnInit, OnDestroy {
  // Signals for reactive state
  currentTier = signal<string>('starter'); // Default for demo
  isRtl = computed(() => this.languageService.isRTL());
  
  private translationSubscription?: Subscription;

  // Pricing tiers configuration
  tiers: PricingTier[] = [
    {
      id: 'solo',
      name: 'Solo',
      price: 500,
      monthlyEquivalent: 42,
      popular: false,
      targetRevenue: '800-1,200 TND/month',
      roiPercentage: '3.5-5%',
      features: [
        { key: 'users', value: 1, included: true },
        { key: 'cars', value: 50, included: true },
        { key: 'appointments', value: 'unlimited', included: true },
        { key: 'textLogs', value: true, included: true },
        { key: 'photos', value: false, included: false },
        { key: 'sms', value: false, included: false },
        { key: 'inventory', value: false, included: false },
        { key: 'reporting', value: 'basic', included: true }
      ],
      valueProps: ['independent', 'mobile', 'homebased', 'singleowner']
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 2000,
      monthlyEquivalent: 167,
      popular: true,
      targetRevenue: '10,000-15,000 TND/month',
      roiPercentage: '1.1-1.7%',
      features: [
        { key: 'users', value: 3, included: true },
        { key: 'cars', value: 200, included: true },
        { key: 'appointments', value: 'unlimited', included: true },
        { key: 'textLogs', value: true, included: true },
        { key: 'photos', value: false, included: false },
        { key: 'sms', value: false, included: false },
        { key: 'inventory', value: false, included: false },
        { key: 'reporting', value: 'advanced', included: true },
        { key: 'approvals', value: true, included: true }
      ],
      valueProps: ['smallteam', 'growing', 'neighborhood', 'coordination']
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 6000,
      monthlyEquivalent: 500,
      popular: false,
      targetRevenue: '25,000-40,000 TND/month',
      roiPercentage: '1.25-2%',
      features: [
        { key: 'users', value: 'unlimited', included: true },
        { key: 'cars', value: 'unlimited', included: true },
        { key: 'appointments', value: 'unlimited', included: true },
        { key: 'textLogs', value: true, included: true },
        { key: 'photos', value: true, included: true },
        { key: 'sms', value: true, included: true },
        { key: 'inventory', value: true, included: true },
        { key: 'reporting', value: 'premium', included: true },
        { key: 'approvals', value: true, included: true },
        { key: 'export', value: true, included: true }
      ],
      valueProps: ['large', 'multibay', 'inventory', 'enterprise']
    }
  ];

  // Feature comparison for table
  featureComparisons = [
    {
      key: 'users',
      solo: { value: '1', included: true },
      starter: { value: '3', included: true },
      professional: { value: 'unlimited', included: true }
    },
    {
      key: 'cars',
      solo: { value: '50', included: true },
      starter: { value: '200', included: true },
      professional: { value: 'unlimited', included: true }
    },
    {
      key: 'photos',
      solo: { value: false, included: false },
      starter: { value: false, included: false },
      professional: { value: true, included: true }
    },
    {
      key: 'sms',
      solo: { value: false, included: false },
      starter: { value: false, included: false },
      professional: { value: true, included: true }
    },
    {
      key: 'inventory',
      solo: { value: false, included: false },
      starter: { value: false, included: false },
      professional: { value: true, included: true }
    },
    {
      key: 'reporting',
      solo: { value: 'basic', included: true },
      starter: { value: 'advanced', included: true },
      professional: { value: 'premium', included: true }
    }
  ];

  // FAQ items
  faqs = [
    { key: 'billing' },
    { key: 'cancellation' },
    { key: 'upgrade' },
    { key: 'support' },
    { key: 'customization' },
    { key: 'data' }
  ];

  private http = inject(HttpClient);

  constructor(
    private subscriptionService: SubscriptionService,
    private languageService: LanguageService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    // Load current tier if user is logged in
    this.loadCurrentTier();
  }

  ngOnInit(): void {
    // Load pricing translations manually
    this.loadPricingTranslations();
    
    // Ensure translations are loaded when component initializes
    this.translationSubscription = this.translationService.translations$.subscribe(() => {
      this.cdr.markForCheck();
    });
  }
  
  private loadPricingTranslations(): void {
    // Directly embed pricing translations to bypass file loading issues
    const pricingTranslations = {
      "navigation": {
        "pricing": "Pricing"
      },
      "common": {
        "unlimited": "Unlimited"
      },
      "pricing": {
        "hero": {
          "title": "Choose the Perfect Plan for Your Garage",
          "subtitle": "Transparent pricing designed for Tunisian garages. From solo mechanics to large operations, we have a plan that fits your business.",
          "benefit1": "14-day free trial",
          "benefit2": "Cancel anytime",
          "benefit3": "No setup fees"
        },
        "plans": {
          "title": "Simple, Transparent Pricing",
          "subtitle": "All plans include our core features with different limits to match your business size"
        },
        "mostPopular": "Most Popular",
        "currentPlan": "Current Plan",
        "choosePlan": "Choose Plan",
        "perYear": "/year",
        "month": "month",
        "targetRevenue": "Target Revenue",
        "costAsPercentage": "Cost as % of Revenue",
        "perfectFor": "Perfect for",
        "included": "What's included",
        "featureComparison": "Compare All Features",
        "featureComparisonTable": "Feature comparison table showing all plans",
        "tierCard": "pricing tier option",
        "valueProps": {
          "solo": {
            "independent": "Independent mechanics",
            "mobile": "Mobile mechanics",
            "homebased": "Home-based operations",
            "singleowner": "Single-owner garages"
          },
          "starter": {
            "smallteam": "Small teams (1-3 employees)",
            "growing": "Growing neighborhood garages",
            "neighborhood": "Established local garages",
            "coordination": "Need team coordination"
          },
          "professional": {
            "large": "Large garages (4+ employees)",
            "multibay": "Multi-bay operations",
            "inventory": "Complex inventory needs",
            "enterprise": "Enterprise-level features"
          }
        },
        "featuresLabel": "Features",
        "features": {
          "users": "User Accounts",
          "cars": "Car Database",
          "appointments": "Appointments",
          "textLogs": "Text-based Logs",
          "photos": "Photo Documentation",
          "sms": "SMS Notifications",
          "inventory": "Inventory Management",
          "reporting": "Reporting & Analytics",
          "approvals": "Internal Approvals",
          "export": "Data Export"
        },
        "faq": {
          "title": "Frequently Asked Questions",
          "billing": {
            "question": "How does billing work?",
            "answer": "All plans are billed annually upfront. We accept bank transfers, checks, and Poste Tunisienne payments. Prices are locked for 2-year commitments."
          },
          "cancellation": {
            "question": "Can I cancel anytime?",
            "answer": "Yes, you can cancel at any time. We offer a 14-day trial period with full refund if not satisfied. No cancellation fees."
          },
          "upgrade": {
            "question": "Can I upgrade my plan?",
            "answer": "Absolutely! You can upgrade to a higher tier anytime. We'll pro-rate the billing and you get immediate access to new features."
          },
          "support": {
            "question": "What support is included?",
            "answer": "Solo: Email support (48h response), Starter: Email support (24h response), Professional: Priority email + phone support (4h response)."
          },
          "customization": {
            "question": "Do you offer custom solutions?",
            "answer": "Yes! For larger operations with specific needs, we offer custom pricing and features. Contact us to discuss your requirements."
          },
          "data": {
            "question": "What about my data?",
            "answer": "Your data is always yours. We provide data export capabilities and guarantee 99.9% uptime. All data is securely encrypted and backed up daily."
          }
        },
        "trust": {
          "title": "Why Choose OpAuto?",
          "security": {
            "title": "Bank-level Security",
            "description": "256-bit SSL encryption, daily backups, and SOC 2 compliance ensure your data is always safe."
          },
          "uptime": {
            "title": "99.9% Uptime",
            "description": "Reliable cloud infrastructure with guaranteed uptime and 24/7 monitoring for peace of mind."
          },
          "support": {
            "title": "Local Support",
            "description": "Tunisian-based support team that understands your business needs and local regulations."
          }
        },
        "contact": {
          "title": "Need Help Choosing?",
          "description": "Our team is here to help you find the perfect plan for your garage. Get personalized recommendations based on your specific needs.",
          "email": "Email Us",
          "phone": "Call Us",
          "enterprise": "Enterprise customers: Contact us for volume discounts and custom features"
        }
      },
      "tiers": {
        "solo": "Solo",
        "starter": "Starter",
        "professional": "Professional"
      }
    };
    
    // Merge pricing translations into the main translations
    const currentTranslations = (this.translationService as any).translationsSubject.value;
    const mergedTranslations = {
      ...currentTranslations,
      ...pricingTranslations
    };
    (this.translationService as any).translationsSubject.next(mergedTranslations);
    this.cdr.markForCheck();
  }
  
  ngOnDestroy(): void {
    if (this.translationSubscription) {
      this.translationSubscription.unsubscribe();
    }
  }

  private loadCurrentTier(): void {
    try {
      this.subscriptionService.getCurrentSubscriptionStatus()
        ?.subscribe(status => {
          if (status) {
            this.currentTier.set(status.currentTier.id);
          }
        });
    } catch (error) {
      // Gracefully handle subscription service errors
      console.warn('Could not load current tier:', error);
    }
  }

  selectTier(tierId: string): void {
    // Navigate to subscription/upgrade page with selected tier
    this.router.navigate(['/subscription'], { 
      queryParams: { upgrade: tierId } 
    });
  }

  formatPrice(amount: number): string {
    return new Intl.NumberFormat(this.languageService.getCurrentLanguage(), {
      style: 'decimal',
      minimumFractionDigits: 0
    }).format(amount) + ' TND';
  }

  getFeatureDisplayValue(feature: { value: any; included: boolean }): string {
    if (!feature.included) {
      return '✗';
    }
    
    if (feature.value === true) {
      return '✓';
    }
    
    if (feature.value === false) {
      return '✗';
    }
    
    if (feature.value === 'unlimited') {
      return 'common.unlimited';
    }
    
    return feature.value.toString();
  }

  // TrackBy functions for performance
  trackByTierId(index: number, tier: PricingTier): string {
    return tier.id;
  }

  trackByFeatureKey(index: number, feature: any): string {
    return feature.key;
  }
}