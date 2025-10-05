import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnboardingService } from '../../../core/services/onboarding.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TourStep } from '../../../core/models/onboarding.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-onboarding-tour',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './onboarding-tour.component.html',
  styleUrl: './onboarding-tour.component.css'
})
export class OnboardingTourComponent implements OnInit, OnDestroy {
  private onboardingService = inject(OnboardingService);
  private translationService = inject(TranslationService);

  private tourSubscription?: Subscription;

  isActive = signal(false);
  currentStep = signal<TourStep | null>(null);
  currentStepIndex = signal(0);
  totalSteps = signal(0);
  progress = signal(0);

  // Tooltip positioning
  tooltipStyle = signal<any>({});
  arrowStyle = signal<any>({});
  spotlightStyle = signal<any>({});

  hasNext = computed(() => {
    const step = this.currentStep();
    return step?.showNext ?? true;
  });

  hasPrevious = computed(() => {
    const step = this.currentStep();
    const index = this.currentStepIndex();
    return (step?.showPrevious ?? true) && index > 0;
  });

  canSkip = computed(() => {
    const step = this.currentStep();
    return step?.showSkip ?? true;
  });

  constructor() {
    // React to step changes and update positioning
    effect(() => {
      const step = this.onboardingService.currentStep();
      if (step) {
        this.currentStep.set(step);
        setTimeout(() => this.updatePosition(), 100);
      }
    });
  }

  ngOnInit(): void {
    this.tourSubscription = this.onboardingService.tourState$.subscribe(state => {
      this.isActive.set(state.isActive);
      this.currentStepIndex.set(state.currentStepIndex);
      this.totalSteps.set(state.totalSteps);

      if (state.totalSteps > 0) {
        this.progress.set(((state.currentStepIndex + 1) / state.totalSteps) * 100);
      }

      if (state.isActive && state.currentTour) {
        this.currentStep.set(state.currentTour.steps[state.currentStepIndex]);
      }
    });

    // Update position on window resize
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.updatePosition.bind(this));
    }
  }

  ngOnDestroy(): void {
    this.cleanupTargetElement();

    if (this.tourSubscription) {
      this.tourSubscription.unsubscribe();
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.updatePosition.bind(this));
    }
  }

  onNext(): void {
    this.cleanupTargetElement();
    this.onboardingService.nextStep();
  }

  onPrevious(): void {
    this.cleanupTargetElement();
    this.onboardingService.previousStep();
  }

  onSkip(): void {
    this.cleanupTargetElement();
    this.onboardingService.skipTour();
  }

  onComplete(): void {
    this.cleanupTargetElement();
    this.onboardingService.completeTour();
  }

  private cleanupTargetElement(): void {
    const step = this.currentStep();
    if (step && step.target) {
      const targetElement = document.querySelector(step.target) as HTMLElement;
      if (targetElement) {
        targetElement.style.position = '';
        targetElement.style.zIndex = '';
      }
    }

    // Restore overflow on sidebar
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    if (sidebar) {
      sidebar.style.overflow = '';
    }
  }

  private updatePosition(): void {
    const step = this.currentStep();
    if (!step) return;

    if (step.placement === 'center') {
      this.tooltipStyle.set({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '500px',
        zIndex: '10001'
      });
      this.arrowStyle.set({ display: 'none' });
      this.spotlightStyle.set({ display: 'none' });
      return;
    }

    const targetElement = document.querySelector(step.target);
    if (!targetElement) {
      console.warn(`Target element not found: ${step.target}`);
      // Fallback to center
      this.tooltipStyle.set({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '500px',
        zIndex: '10001'
      });
      this.arrowStyle.set({ display: 'none' });
      this.spotlightStyle.set({ display: 'none' });
      return;
    }

    // Force a reflow to ensure accurate measurements
    targetElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    let rect = targetElement.getBoundingClientRect();
    const padding = 6; // Padding around the highlighted element

    // Elevate the target element above the blocking overlay
    (targetElement as HTMLElement).style.position = 'relative';
    (targetElement as HTMLElement).style.zIndex = '10000';

    // Remove overflow hidden from sidebar to allow spotlight to show properly
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    if (sidebar) {
      sidebar.style.overflow = 'visible';
    }

    // Get computed style to account for all borders and padding
    const computedStyle = window.getComputedStyle(targetElement as HTMLElement);

    // Check if this is a nav-item in the sidebar - if so, extend to full sidebar width
    let fullWidth = rect.width;
    let leftPosition = rect.left;

    if ((targetElement as HTMLElement).classList.contains('nav-item')) {
      // For nav items, extend the highlight to the full sidebar width
      const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
      if (sidebarRect) {
        fullWidth = sidebarRect.width;
        leftPosition = sidebarRect.left;
      }
    }

    const fullHeight = rect.height;

    // Set spotlight position to highlight the entire element including all padding/borders
    this.spotlightStyle.set({
      top: `${rect.top - padding}px`,
      left: `${leftPosition - padding}px`,
      width: `${fullWidth + (padding * 2)}px`,
      height: `${fullHeight + (padding * 2)}px`,
      display: 'block',
      boxSizing: 'border-box'
    });

    const isMobile = window.innerWidth < 1024;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = isMobile ? Math.min(viewportWidth - 32, 360) : 360;
    const tooltipHeight = 200; // Approximate
    const offset = 16; // Space between target and tooltip
    const arrowSize = 12;
    const margin = 16; // Margin from viewport edges

    let style: any = {
      position: 'fixed',
      maxWidth: `${tooltipWidth}px`,
      zIndex: '10001'
    };

    let arrow: any = {
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid'
    };

    // On mobile, prefer bottom placement for better visibility
    let placement = isMobile && (step.placement === 'left' || step.placement === 'right')
      ? 'bottom'
      : step.placement;

    switch (placement) {
      case 'top':
        style.left = `${rect.left + rect.width / 2}px`;
        style.top = `${rect.top - offset}px`;
        style.transform = 'translate(-50%, -100%)';

        arrow.bottom = `-${arrowSize}px`;
        arrow.left = '50%';
        arrow.transform = 'translateX(-50%)';
        arrow.borderWidth = `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`;
        arrow.borderColor = 'rgba(15, 23, 42, 0.95) transparent transparent transparent';
        break;

      case 'bottom':
        style.left = `${rect.left + rect.width / 2}px`;
        style.top = `${rect.bottom + offset}px`;
        style.transform = 'translateX(-50%)';

        arrow.top = `-${arrowSize}px`;
        arrow.left = '50%';
        arrow.transform = 'translateX(-50%)';
        arrow.borderWidth = `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`;
        arrow.borderColor = 'transparent transparent rgba(15, 23, 42, 0.95) transparent';
        break;

      case 'left':
        style.left = `${rect.left - offset}px`;
        style.top = `${rect.top + rect.height / 2}px`;
        style.transform = 'translate(-100%, -50%)';

        arrow.right = `-${arrowSize}px`;
        arrow.top = '50%';
        arrow.transform = 'translateY(-50%)';
        arrow.borderWidth = `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`;
        arrow.borderColor = 'transparent transparent transparent rgba(15, 23, 42, 0.95)';
        break;

      case 'right':
        style.left = `${rect.right + offset}px`;
        style.top = `${rect.top + rect.height / 2}px`;
        style.transform = 'translateY(-50%)';

        arrow.left = `-${arrowSize}px`;
        arrow.top = '50%';
        arrow.transform = 'translateY(-50%)';
        arrow.borderWidth = `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`;
        arrow.borderColor = 'transparent rgba(15, 23, 42, 0.95) transparent transparent';
        break;
    }

    // Adjust position to keep tooltip within viewport bounds
    const tooltipRect = this.calculateTooltipRect(style, tooltipWidth, tooltipHeight);

    if (tooltipRect.right > viewportWidth - margin) {
      const overflow = tooltipRect.right - (viewportWidth - margin);
      style.left = `${parseFloat(style.left) - overflow}px`;
    }

    if (tooltipRect.left < margin) {
      style.left = `${margin}px`;
      style.transform = style.transform.replace('translateX(-50%)', '');
    }

    if (tooltipRect.bottom > viewportHeight - margin) {
      const overflow = tooltipRect.bottom - (viewportHeight - margin);
      style.top = `${parseFloat(style.top) - overflow}px`;
    }

    if (tooltipRect.top < margin) {
      style.top = `${margin}px`;
      style.transform = style.transform.replace('translateY(-50%)', '').replace('translate(-50%, -100%)', 'translateX(-50%)');
    }

    this.tooltipStyle.set(style);
    this.arrowStyle.set(arrow);

    // Highlight target element
    this.highlightElement(targetElement);
  }

  private calculateTooltipRect(style: any, width: number, height: number): { top: number; left: number; right: number; bottom: number } {
    let left = parseFloat(style.left);
    let top = parseFloat(style.top);

    // Adjust for transforms
    if (style.transform.includes('translateX(-50%)')) {
      left -= width / 2;
    }
    if (style.transform.includes('translateY(-50%)')) {
      top -= height / 2;
    }
    if (style.transform.includes('translate(-50%, -100%)')) {
      left -= width / 2;
      top -= height;
    }
    if (style.transform.includes('translate(-100%, -50%)')) {
      left -= width;
      top -= height / 2;
    }

    return {
      top,
      left,
      right: left + width,
      bottom: top + height
    };
  }

  private highlightElement(element: Element): void {
    // Remove previous highlights
    document.querySelectorAll('.tour-highlight').forEach(el => {
      el.classList.remove('tour-highlight');
    });

    // Add highlight to current element
    element.classList.add('tour-highlight');
  }

  getStepTitle(): string {
    const step = this.currentStep();
    if (!step) return '';
    return this.translationService.instant(step.title);
  }

  getStepDescription(): string {
    const step = this.currentStep();
    if (!step) return '';
    return this.translationService.instant(step.description);
  }

  isRTL(): boolean {
    return false; // RTL not supported
  }
}
