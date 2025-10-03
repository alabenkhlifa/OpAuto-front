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

    const rect = targetElement.getBoundingClientRect();
    const padding = 8; // Padding around the highlighted element

    // Elevate the target element above the blocking overlay
    (targetElement as HTMLElement).style.position = 'relative';
    (targetElement as HTMLElement).style.zIndex = '10000';

    // Set spotlight position to highlight the target element
    this.spotlightStyle.set({
      top: `${rect.top - padding}px`,
      left: `${rect.left - padding}px`,
      width: `${rect.width + padding * 2}px`,
      height: `${rect.height + padding * 2}px`
    });
    const tooltipWidth = 360;
    const tooltipHeight = 200; // Approximate
    const offset = 16; // Space between target and tooltip
    const arrowSize = 12;

    let style: any = {
      position: 'fixed',
      maxWidth: `${tooltipWidth}px`,
      zIndex: '10000'
    };

    let arrow: any = {
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid'
    };

    switch (step.placement) {
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

    this.tooltipStyle.set(style);
    this.arrowStyle.set(arrow);

    // Highlight target element
    this.highlightElement(targetElement);
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
