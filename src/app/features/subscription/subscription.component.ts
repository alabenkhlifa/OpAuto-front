import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SubscriptionDisplayComponent } from './components/subscription-display.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [
    CommonModule,
    SubscriptionDisplayComponent,
    TranslatePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="subscription-page">
      <div class="page-container">
        <!-- Header -->
        <div class="page-header">
          <h1 class="page-title">
            {{ 'subscription.title' | translate }}
          </h1>
          <p class="page-subtitle">
            {{ 'subscription.subtitle' | translate }}
          </p>
        </div>

        <!-- Subscription Display Component -->
        <app-subscription-display></app-subscription-display>

        <!-- Additional Information -->
        <div class="info-section">
          <div class="glass-card">
            <h3 class="section-title">
              {{ 'subscription.why_upgrade.title' | translate }}
            </h3>
            <div class="benefits-grid">
              <div class="benefit-item">
                <div class="benefit-icon growth">🚀</div>
                <h4 class="benefit-title">
                  {{ 'subscription.benefits.growth.title' | translate }}
                </h4>
                <p class="benefit-description">
                  {{ 'subscription.benefits.growth.description' | translate }}
                </p>
              </div>
              <div class="benefit-item">
                <div class="benefit-icon efficiency">💼</div>
                <h4 class="benefit-title">
                  {{ 'subscription.benefits.efficiency.title' | translate }}
                </h4>
                <p class="benefit-description">
                  {{ 'subscription.benefits.efficiency.description' | translate }}
                </p>
              </div>
              <div class="benefit-item">
                <div class="benefit-icon insights">📊</div>
                <h4 class="benefit-title">
                  {{ 'subscription.benefits.insights.title' | translate }}
                </h4>
                <p class="benefit-description">
                  {{ 'subscription.benefits.insights.description' | translate }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- FAQ Section -->
        <div class="faq-section">
          <div class="glass-card">
            <h3 class="section-title centered">
              {{ 'subscription.faq.title' | translate }}
            </h3>
            <div class="faq-list">
              <div class="faq-item">
                <h4 class="faq-question">
                  {{ 'subscription.faq.billing.question' | translate }}
                </h4>
                <p class="faq-answer">
                  {{ 'subscription.faq.billing.answer' | translate }}
                </p>
              </div>
              <div class="faq-item">
                <h4 class="faq-question">
                  {{ 'subscription.faq.cancellation.question' | translate }}
                </h4>
                <p class="faq-answer">
                  {{ 'subscription.faq.cancellation.answer' | translate }}
                </p>
              </div>
              <div class="faq-item">
                <h4 class="faq-question">
                  {{ 'subscription.faq.support.question' | translate }}
                </h4>
                <p class="faq-answer">
                  {{ 'subscription.faq.support.answer' | translate }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Contact Section -->
        <div class="contact-section">
          <div class="glass-card contact-card">
            <h3 class="section-title">
              {{ 'subscription.contact.title' | translate }}
            </h3>
            <p class="contact-description">
              {{ 'subscription.contact.description' | translate }}
            </p>
            <div class="contact-buttons">
              <button class="btn-secondary">
                {{ 'subscription.contact.email' | translate }}
              </button>
              <button class="btn-tertiary">
                {{ 'subscription.contact.phone' | translate }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subscription-page {
      min-height: 100vh;
      background: linear-gradient(135deg, rgba(17, 24, 39, 1) 0%, rgba(31, 41, 55, 1) 50%, rgba(30, 64, 175, 1) 100%);
      padding: 1rem;
    }

    .page-container {
      max-width: 80rem;
      margin: 0 auto;
    }

    .page-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .page-title {
      font-size: 2.5rem;
      font-weight: bold;
      color: white;
      margin: 0 0 1rem 0;
    }

    .page-subtitle {
      font-size: 1.25rem;
      color: rgba(209, 213, 219, 1);
      max-width: 48rem;
      margin: 0 auto;
    }

    .glass-card {
      backdrop-filter: blur(20px);
      background: rgba(31, 41, 55, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    .info-section {
      margin: 3rem 0;
      text-align: center;
    }

    .section-title {
      font-size: 1.5rem;
      font-weight: bold;
      color: white;
      margin: 0 0 1rem 0;
    }

    .section-title.centered {
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .benefits-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
      margin-top: 1.5rem;
    }

    .benefit-item {
      text-align: center;
    }

    .benefit-icon {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .benefit-icon.growth {
      color: rgba(96, 165, 250, 1);
    }

    .benefit-icon.efficiency {
      color: rgba(74, 222, 128, 1);
    }

    .benefit-icon.insights {
      color: rgba(251, 191, 36, 1);
    }

    .benefit-title {
      color: white;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
    }

    .benefit-description {
      color: rgba(209, 213, 219, 1);
      font-size: 0.875rem;
      margin: 0;
    }

    .faq-section {
      margin: 3rem 0;
    }

    .faq-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .faq-item {
      border-bottom: 1px solid rgba(75, 85, 99, 1);
      padding-bottom: 1rem;
    }

    .faq-question {
      color: white;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
    }

    .faq-answer {
      color: rgba(209, 213, 219, 1);
      font-size: 0.875rem;
      margin: 0;
    }

    .contact-section {
      margin: 3rem 0;
      text-align: center;
    }

    .contact-card {
      max-width: 32rem;
      margin: 0 auto;
    }

    .contact-description {
      color: rgba(209, 213, 219, 1);
      margin: 0 0 1.5rem 0;
    }

    .contact-buttons {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      justify-content: center;
    }

    /* Responsive styles */
    @media (min-width: 768px) {
      .page-title {
        font-size: 3rem;
      }

      .subscription-page {
        padding: 1.5rem;
      }

      .benefits-grid {
        grid-template-columns: repeat(3, 1fr);
      }

      .contact-buttons {
        flex-direction: row;
      }
    }

    @media (min-width: 1024px) {
      .subscription-page {
        padding: 2rem;
      }
    }
  `]
})
export class SubscriptionComponent {}