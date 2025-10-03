export interface User {
  id: string;
  email?: string;
  username?: string;
  name: string;
  role: UserRole;
  garageName: string;
  phoneNumber?: string;
  avatar?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  preferences?: UserPreferences;
  subscriptionTier?: 'solo' | 'starter' | 'professional';
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'fr' | 'tn';
  notifications: {
    email: boolean;
    sms: boolean;
    browser: boolean;
  };
  dashboardLayout: 'standard' | 'compact';
}

export interface LoginRequest {
  emailOrUsername: string; // Can be email for owner or username for staff
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  garageName: string;
  phoneNumber?: string;
  acceptTerms: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export enum UserRole {
  OWNER = 'owner', // Garage owner - the only one with email and can create accounts
  STAFF = 'staff'  // Staff member - uses username instead of email
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.OWNER]: 'Owner',
  [UserRole.STAFF]: 'Staff'
};

export interface AuthError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface CreateStaffRequest {
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  role: UserRole;
  phoneNumber?: string;
}

export const AUTH_ERRORS: Record<string, string> = {
  'INVALID_CREDENTIALS': 'Invalid username/email or password',
  'EMAIL_ALREADY_EXISTS': 'An account with this email already exists',
  'USERNAME_ALREADY_EXISTS': 'An account with this username already exists',
  'EMAIL_NOT_FOUND': 'No account found with this email address',
  'USERNAME_NOT_FOUND': 'No account found with this username',
  'WEAK_PASSWORD': 'Password must be at least 8 characters with uppercase, lowercase, and numbers',
  'INVALID_EMAIL': 'Please enter a valid email address',
  'INVALID_USERNAME': 'Username must be 3-20 characters and contain only letters, numbers, and underscores',
  'ACCOUNT_LOCKED': 'Account has been locked due to too many failed login attempts',
  'SESSION_EXPIRED': 'Your session has expired. Please log in again',
  'NETWORK_ERROR': 'Network error. Please check your connection and try again',
  'SERVER_ERROR': 'Server error. Please try again later',
  'UNAUTHORIZED': 'You are not authorized to perform this action'
};