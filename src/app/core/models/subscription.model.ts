export type SubscriptionTierId = 'solo' | 'starter' | 'professional';

export interface FeatureConfig {
  key: string;
  enabled: boolean;
  requiresUpgrade?: 'starter' | 'professional';
}

export interface SubscriptionLimits {
  users: number | null; // null = unlimited
  cars: number | null;
  serviceBays: number | null;
}

export interface SubscriptionTier {
  id: SubscriptionTierId;
  name: string;
  price: number;
  currency: string;
  features: FeatureConfig[];
  limits: SubscriptionLimits;
  popular?: boolean;
}

export interface CurrentUsage {
  users: number;
  cars: number;
  serviceBays: number;
}

export interface SubscriptionStatus {
  currentTier: SubscriptionTier;
  usage: CurrentUsage;
  renewalDate: Date;
  isActive: boolean;
  daysUntilRenewal: number;
}

export interface TierComparison {
  tiers: SubscriptionTier[];
  currentTierId: SubscriptionTierId;
  recommendedTierId?: SubscriptionTierId;
}