import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  TourConfig,
  TourStep,
  TourState,
  OnboardingProgress,
  TOUR_IDS,
  TourId
} from '../models/onboarding.model';
import { SubscriptionTierId } from '../models/subscription.model';
import { UserRole } from '../models/auth.model';
import { AuthService } from './auth.service';
import { SubscriptionService } from './subscription.service';
import { SidebarService } from './sidebar.service';

@Injectable({
  providedIn: 'root'
})
export class OnboardingService {
  private authService = inject(AuthService);
  private subscriptionService = inject(SubscriptionService);
  private sidebarService = inject(SidebarService);

  private readonly STORAGE_KEY = 'opauth_onboarding_progress';

  private tourStateSubject = new BehaviorSubject<TourState>({
    isActive: false,
    currentStepIndex: 0,
    totalSteps: 0
  });

  tourState$ = this.tourStateSubject.asObservable();
  currentStep = signal<TourStep | null>(null);

  private tourConfigs: Map<TourId, TourConfig> = new Map();

  constructor() {
    this.initializeTourConfigs();
  }

  private initializeTourConfigs(): void {
    // Solo Owner Tour
    this.tourConfigs.set(TOUR_IDS.SOLO_OWNER, {
      id: TOUR_IDS.SOLO_OWNER,
      tier: 'solo',
      role: UserRole.OWNER,
      steps: [
        {
          id: 'welcome',
          target: 'body',
          title: 'onboarding.solo.welcome.title',
          description: 'onboarding.solo.welcome.description',
          placement: 'center',
          order: 1,
          showNext: true,
          showSkip: true
        },
        {
          id: 'dashboard-overview',
          target: '.dashboard-metrics',
          title: 'onboarding.solo.dashboard.title',
          description: 'onboarding.solo.dashboard.description',
          placement: 'bottom',
          order: 2,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'add-car',
          target: '[data-tour="add-car"]',
          title: 'onboarding.solo.addCar.title',
          description: 'onboarding.solo.addCar.description',
          placement: 'bottom',
          order: 3,
          action: { type: 'navigate', route: '/cars' },
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'maintenance',
          target: '[data-tour="maintenance"]',
          title: 'onboarding.solo.maintenance.title',
          description: 'onboarding.solo.maintenance.description',
          placement: 'bottom',
          order: 4,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'invoicing',
          target: '[data-tour="invoices"]',
          title: 'onboarding.solo.invoicing.title',
          description: 'onboarding.solo.invoicing.description',
          placement: 'right',
          order: 5,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'notifications',
          target: '[data-tour="notifications"]',
          title: 'onboarding.solo.notifications.title',
          description: 'onboarding.solo.notifications.description',
          placement: 'bottom',
          order: 6,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'upgrade-prompt',
          target: '.subscription-card',
          title: 'onboarding.solo.upgrade.title',
          description: 'onboarding.solo.upgrade.description',
          placement: 'center',
          order: 7,
          showPrevious: true
        }
      ]
    });

    // Starter Owner Tour
    this.tourConfigs.set(TOUR_IDS.STARTER_OWNER, {
      id: TOUR_IDS.STARTER_OWNER,
      tier: 'starter',
      role: UserRole.OWNER,
      steps: [
        {
          id: 'welcome',
          target: 'body',
          title: 'onboarding.starter.welcome.title',
          description: 'onboarding.starter.welcome.description',
          placement: 'center',
          order: 1,
          showNext: true,
          showSkip: true
        },
        {
          id: 'dashboard',
          target: '.dashboard-metrics',
          title: 'onboarding.starter.dashboard.title',
          description: 'onboarding.starter.dashboard.description',
          placement: 'bottom',
          order: 2,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'multi-user',
          target: '[data-tour="employees"]',
          title: 'onboarding.starter.multiUser.title',
          description: 'onboarding.starter.multiUser.description',
          placement: 'right',
          order: 3,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'approvals',
          target: '[data-tour="approvals"]',
          title: 'onboarding.starter.approvals.title',
          description: 'onboarding.starter.approvals.description',
          placement: 'right',
          order: 4,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'email-notifications',
          target: '[data-tour="settings"]',
          title: 'onboarding.starter.emailNotifications.title',
          description: 'onboarding.starter.emailNotifications.description',
          placement: 'right',
          order: 5,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'customer-history',
          target: '[data-tour="customers"]',
          title: 'onboarding.starter.customerHistory.title',
          description: 'onboarding.starter.customerHistory.description',
          placement: 'right',
          order: 6,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'reports',
          target: '[data-tour="reports"]',
          title: 'onboarding.starter.reports.title',
          description: 'onboarding.starter.reports.description',
          placement: 'right',
          order: 7,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'upgrade-pro',
          target: '.subscription-card',
          title: 'onboarding.starter.upgradePro.title',
          description: 'onboarding.starter.upgradePro.description',
          placement: 'center',
          order: 8,
          showPrevious: true
        }
      ]
    });

    // Starter Staff Tour
    this.tourConfigs.set(TOUR_IDS.STARTER_STAFF, {
      id: TOUR_IDS.STARTER_STAFF,
      tier: 'starter',
      role: UserRole.STAFF,
      steps: [
        {
          id: 'welcome-staff',
          target: 'body',
          title: 'onboarding.staff.welcome.title',
          description: 'onboarding.staff.welcome.description',
          placement: 'center',
          order: 1,
          showNext: true,
          showSkip: true
        },
        {
          id: 'dashboard-staff',
          target: '.dashboard-metrics',
          title: 'onboarding.staff.dashboard.title',
          description: 'onboarding.staff.dashboard.description',
          placement: 'bottom',
          order: 2,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'maintenance-staff',
          target: '[data-tour="maintenance"]',
          title: 'onboarding.staff.maintenance.title',
          description: 'onboarding.staff.maintenance.description',
          placement: 'bottom',
          order: 3,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'approvals-request',
          target: '.approval-button',
          title: 'onboarding.staff.approvalRequest.title',
          description: 'onboarding.staff.approvalRequest.description',
          placement: 'bottom',
          order: 4,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'profile-staff',
          target: '[data-tour="profile"]',
          title: 'onboarding.staff.profile.title',
          description: 'onboarding.staff.profile.description',
          placement: 'left',
          order: 5,
          showPrevious: true
        }
      ]
    });

    // Professional Owner Tour
    this.tourConfigs.set(TOUR_IDS.PROFESSIONAL_OWNER, {
      id: TOUR_IDS.PROFESSIONAL_OWNER,
      tier: 'professional',
      role: UserRole.OWNER,
      steps: [
        {
          id: 'welcome-pro',
          target: 'body',
          title: 'onboarding.professional.welcome.title',
          description: 'onboarding.professional.welcome.description',
          placement: 'center',
          order: 1,
          showNext: true,
          showSkip: true
        },
        {
          id: 'dashboard-pro',
          target: '.dashboard-metrics',
          title: 'onboarding.professional.dashboard.title',
          description: 'onboarding.professional.dashboard.description',
          placement: 'bottom',
          order: 2,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'inventory',
          target: '[data-tour="inventory"]',
          title: 'onboarding.professional.inventory.title',
          description: 'onboarding.professional.inventory.description',
          placement: 'right',
          order: 3,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'photo-docs',
          target: '.photo-upload',
          title: 'onboarding.professional.photoDocs.title',
          description: 'onboarding.professional.photoDocs.description',
          placement: 'top',
          order: 4,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'advanced-reports',
          target: '[data-tour="reports"]',
          title: 'onboarding.professional.advancedReports.title',
          description: 'onboarding.professional.advancedReports.description',
          placement: 'right',
          order: 5,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'sms-notifications',
          target: '[data-tour="settings"]',
          title: 'onboarding.professional.smsNotifications.title',
          description: 'onboarding.professional.smsNotifications.description',
          placement: 'right',
          order: 6,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'data-export',
          target: '.export-button',
          title: 'onboarding.professional.dataExport.title',
          description: 'onboarding.professional.dataExport.description',
          placement: 'bottom',
          order: 7,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'unlimited-features',
          target: 'body',
          title: 'onboarding.professional.unlimitedFeatures.title',
          description: 'onboarding.professional.unlimitedFeatures.description',
          placement: 'center',
          order: 8,
          showPrevious: true
        }
      ]
    });

    // Professional Staff Tour (same as Starter Staff with mentions of pro features)
    this.tourConfigs.set(TOUR_IDS.PROFESSIONAL_STAFF, {
      id: TOUR_IDS.PROFESSIONAL_STAFF,
      tier: 'professional',
      role: UserRole.STAFF,
      steps: [
        {
          id: 'welcome-staff-pro',
          target: 'body',
          title: 'onboarding.staff.welcome.title',
          description: 'onboarding.staff.welcome.description',
          placement: 'center',
          order: 1,
          showNext: true,
          showSkip: true
        },
        {
          id: 'dashboard-staff-pro',
          target: '.dashboard-metrics',
          title: 'onboarding.staff.dashboard.title',
          description: 'onboarding.staff.dashboard.description',
          placement: 'bottom',
          order: 2,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'maintenance-staff-pro',
          target: '[data-tour="maintenance"]',
          title: 'onboarding.staff.maintenance.title',
          description: 'onboarding.staff.maintenance.description',
          placement: 'bottom',
          order: 3,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'photo-staff',
          target: '.photo-upload',
          title: 'onboarding.staff.photoUpload.title',
          description: 'onboarding.staff.photoUpload.description',
          placement: 'top',
          order: 4,
          showNext: true,
          showPrevious: true,
          showSkip: true
        },
        {
          id: 'profile-staff-pro',
          target: '[data-tour="profile"]',
          title: 'onboarding.staff.profile.title',
          description: 'onboarding.staff.profile.description',
          placement: 'left',
          order: 5,
          showPrevious: true
        }
      ]
    });
  }

  /**
   * Start a tour based on user's tier and role
   */
  startTourForCurrentUser(): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const tier = this.subscriptionService.currentTier();
    const role = user.role;

    const tourId = this.getTourIdForUser(tier, role);
    if (tourId) {
      this.startTour(tourId);
    }
  }

  /**
   * Start a specific tour by ID
   */
  startTour(tourId: TourId): void {
    const config = this.tourConfigs.get(tourId);
    if (!config) {
      console.error(`Tour config not found for: ${tourId}`);
      return;
    }

    const progress = this.getProgress();

    // Check if tour was already completed or dismissed
    if (progress.completedTours.includes(tourId) || progress.dismissedTours.includes(tourId)) {
      return;
    }

    // On mobile, minimize sidebar at the start of the tour
    if (this.isMobile()) {
      this.sidebarService.closeMobileMenu();
    }

    // Start from last saved step or beginning
    const startStep = progress.currentTour === tourId ? (progress.currentStep || 0) : 0;

    this.tourStateSubject.next({
      isActive: true,
      currentTour: config,
      currentStepIndex: startStep,
      totalSteps: config.steps.length
    });

    this.currentStep.set(config.steps[startStep]);
    this.saveProgress({ currentTour: tourId, currentStep: startStep });
  }

  /**
   * Go to next step
   */
  nextStep(): void {
    const state = this.tourStateSubject.value;
    if (!state.currentTour || !state.isActive) return;

    const nextIndex = state.currentStepIndex + 1;

    if (nextIndex >= state.currentTour.steps.length) {
      this.completeTour();
      return;
    }

    // Check if we're moving past the "add-car" step on mobile
    const currentStep = state.currentTour.steps[state.currentStepIndex];
    const nextStep = state.currentTour.steps[nextIndex];

    if (this.isMobile() && currentStep.id === 'add-car' && nextStep) {
      // Expand sidebar after "add-car" step for navigation items
      this.sidebarService.openMobileMenu();
    }

    this.tourStateSubject.next({
      ...state,
      currentStepIndex: nextIndex
    });

    this.currentStep.set(state.currentTour.steps[nextIndex]);
    this.saveProgress({
      currentTour: state.currentTour.id,
      currentStep: nextIndex
    });
  }

  /**
   * Go to previous step
   */
  previousStep(): void {
    const state = this.tourStateSubject.value;
    if (!state.currentTour || !state.isActive || state.currentStepIndex === 0) return;

    const prevIndex = state.currentStepIndex - 1;

    // Check if we're moving back to or before the "add-car" step on mobile
    const prevStep = state.currentTour.steps[prevIndex];

    if (this.isMobile() && prevStep.id === 'add-car') {
      // Minimize sidebar when going back to "add-car" or earlier
      this.sidebarService.closeMobileMenu();
    }

    this.tourStateSubject.next({
      ...state,
      currentStepIndex: prevIndex
    });

    this.currentStep.set(state.currentTour.steps[prevIndex]);
    this.saveProgress({
      currentTour: state.currentTour.id,
      currentStep: prevIndex
    });
  }

  /**
   * Skip/dismiss current tour
   */
  skipTour(): void {
    const state = this.tourStateSubject.value;
    if (!state.currentTour) return;

    const progress = this.getProgress();
    progress.dismissedTours.push(state.currentTour.id);
    progress.currentTour = undefined;
    progress.currentStep = undefined;
    progress.lastUpdated = new Date();

    this.saveProgressToStorage(progress);
    this.endTour();

    // Close sidebar on mobile after tour is dismissed
    if (this.isMobile()) {
      this.sidebarService.closeMobileMenu();
    }
  }

  /**
   * Complete current tour
   */
  completeTour(): void {
    const state = this.tourStateSubject.value;
    if (!state.currentTour) return;

    const progress = this.getProgress();
    if (!progress.completedTours.includes(state.currentTour.id)) {
      progress.completedTours.push(state.currentTour.id);
    }
    progress.currentTour = undefined;
    progress.currentStep = undefined;
    progress.lastUpdated = new Date();

    this.saveProgressToStorage(progress);
    this.endTour();

    // Close sidebar on mobile after tour is completed
    if (this.isMobile()) {
      this.sidebarService.closeMobileMenu();
    }
  }

  /**
   * Restart a specific tour (from settings)
   */
  restartTour(tourId: TourId): void {
    const progress = this.getProgress();

    // Remove from completed and dismissed lists
    progress.completedTours = progress.completedTours.filter(id => id !== tourId);
    progress.dismissedTours = progress.dismissedTours.filter(id => id !== tourId);
    progress.currentTour = undefined;
    progress.currentStep = undefined;

    this.saveProgressToStorage(progress);
    this.startTour(tourId);
  }

  /**
   * Check if tour has been completed
   */
  isTourCompleted(tourId: TourId): boolean {
    const progress = this.getProgress();
    return progress.completedTours.includes(tourId);
  }

  /**
   * Check if tour has been dismissed
   */
  isTourDismissed(tourId: TourId): boolean {
    const progress = this.getProgress();
    return progress.dismissedTours.includes(tourId);
  }

  /**
   * Check if user should see tour (first time, not completed, not dismissed)
   */
  shouldShowTour(tourId: TourId): boolean {
    return !this.isTourCompleted(tourId) && !this.isTourDismissed(tourId);
  }

  /**
   * Get tour configuration
   */
  getTourConfig(tourId: TourId): TourConfig | undefined {
    return this.tourConfigs.get(tourId);
  }

  /**
   * Get appropriate tour ID based on tier and role
   */
  private getTourIdForUser(tier: SubscriptionTierId, role: UserRole): TourId | null {
    if (role === UserRole.STAFF) {
      // Staff tours are same for Starter and Professional
      return tier === 'solo' ? null :
             tier === 'starter' ? TOUR_IDS.STARTER_STAFF :
             TOUR_IDS.PROFESSIONAL_STAFF;
    }

    // Owner tours
    switch (tier) {
      case 'solo':
        return TOUR_IDS.SOLO_OWNER;
      case 'starter':
        return TOUR_IDS.STARTER_OWNER;
      case 'professional':
        return TOUR_IDS.PROFESSIONAL_OWNER;
      default:
        return null;
    }
  }

  /**
   * End current tour
   */
  private endTour(): void {
    this.tourStateSubject.next({
      isActive: false,
      currentStepIndex: 0,
      totalSteps: 0
    });
    this.currentStep.set(null);
  }

  /**
   * Get progress from localStorage
   */
  private getProgress(): OnboardingProgress {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        return this.getDefaultProgress();
      }

      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return this.getDefaultProgress();
      }

      const progress = JSON.parse(stored);

      // Ensure it's for the current user
      if (progress.userId !== user.id) {
        return this.getDefaultProgress();
      }

      return progress;
    } catch (error) {
      console.error('Error loading onboarding progress:', error);
      return this.getDefaultProgress();
    }
  }

  /**
   * Save progress to localStorage
   */
  private saveProgress(update: Partial<OnboardingProgress>): void {
    const progress = this.getProgress();
    Object.assign(progress, update);
    progress.lastUpdated = new Date();
    this.saveProgressToStorage(progress);
  }

  /**
   * Save progress object to storage
   */
  private saveProgressToStorage(progress: OnboardingProgress): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving onboarding progress:', error);
    }
  }

  /**
   * Get default progress object
   */
  private getDefaultProgress(): OnboardingProgress {
    const user = this.authService.getCurrentUser();
    return {
      userId: user?.id || '',
      completedTours: [],
      dismissedTours: [],
      lastUpdated: new Date()
    };
  }

  /**
   * Reset all progress (for testing)
   */
  resetAllProgress(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.endTour();
  }

  /**
   * Check if on mobile device
   */
  private isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }
}
