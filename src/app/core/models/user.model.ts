export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  joinedAt: Date;
  lastActiveAt: Date;
  invitedBy?: string;
  permissions: UserPermissions;
}

export type UserRole = 'owner' | 'admin' | 'mechanic' | 'viewer';
export type UserStatus = 'active' | 'pending' | 'inactive' | 'suspended';

export interface UserPermissions {
  canManageUsers: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canManageInventory: boolean;
  canManageAppointments: boolean;
  canManageInvoices: boolean;
  canManageMaintenance: boolean;
}

export interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  invitedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  token: string;
}

export interface UserLimits {
  current: number;
  limit: number | null; // null means unlimited
  canAddUser: boolean;
  nextTier?: SubscriptionTier;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  roleDistribution: {
    [key in UserRole]: number;
  };
  recentJoins: User[];
  tierInfo: {
    current: SubscriptionTier;
    limits: UserLimits;
  };
}

export interface UserFilters {
  searchTerm?: string;
  role?: UserRole[];
  status?: UserStatus[];
  joinedAfter?: Date;
  joinedBefore?: Date;
}

export interface InviteUserRequest {
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  message?: string;
}

export interface UpgradePrompt {
  currentTier: SubscriptionTier;
  suggestedTier: SubscriptionTier;
  benefits: string[];
  priceComparison: {
    currentPrice: number;
    newPrice: number;
    additionalCost: number;
  };
}

// Import existing subscription types
import { SubscriptionTier, SubscriptionTierId } from './subscription.model';