import { SubscriptionTierId } from './subscription.model';
import { UserRole } from './auth.model';

export interface TourStep {
  id: string;
  target: string; // CSS selector for the element to highlight
  title: string; // Translation key
  description: string; // Translation key
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  order: number;
  action?: TourAction;
  showNext?: boolean;
  showPrevious?: boolean;
  showSkip?: boolean;
}

export interface TourAction {
  type: 'navigate' | 'click' | 'scroll' | 'highlight';
  target?: string;
  route?: string;
}

export interface TourConfig {
  id: string;
  tier: SubscriptionTierId;
  role?: UserRole;
  steps: TourStep[];
  isCompleted?: boolean;
  lastStepIndex?: number;
}

export interface OnboardingProgress {
  userId: string;
  completedTours: string[];
  currentTour?: string;
  currentStep?: number;
  dismissedTours: string[];
  lastUpdated: Date;
}

export interface TourState {
  isActive: boolean;
  currentTour?: TourConfig;
  currentStepIndex: number;
  totalSteps: number;
}

export const TOUR_IDS = {
  SOLO_OWNER: 'solo-owner-tour',
  STARTER_OWNER: 'starter-owner-tour',
  STARTER_STAFF: 'starter-staff-tour',
  PROFESSIONAL_OWNER: 'professional-owner-tour',
  PROFESSIONAL_STAFF: 'professional-staff-tour',
  FEATURE_INVENTORY: 'feature-inventory-tour',
  FEATURE_REPORTS: 'feature-reports-tour',
  FEATURE_APPROVALS: 'feature-approvals-tour',
  UPGRADE_WHATS_NEW: 'upgrade-whats-new-tour'
} as const;

export type TourId = typeof TOUR_IDS[keyof typeof TOUR_IDS];
