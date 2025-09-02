export interface User {
  id: string;
  email: string;
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
  email: string;
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
  ADMIN = 'admin',
  MECHANIC = 'mechanic',
  RECEPTIONIST = 'receptionist'
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.MECHANIC]: 'Mechanic',
  [UserRole.RECEPTIONIST]: 'Receptionist'
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

export const AUTH_ERRORS: Record<string, string> = {
  'INVALID_CREDENTIALS': 'Invalid email or password',
  'EMAIL_ALREADY_EXISTS': 'An account with this email already exists',
  'EMAIL_NOT_FOUND': 'No account found with this email address',
  'WEAK_PASSWORD': 'Password must be at least 8 characters with uppercase, lowercase, and numbers',
  'INVALID_EMAIL': 'Please enter a valid email address',
  'ACCOUNT_LOCKED': 'Account has been locked due to too many failed login attempts',
  'SESSION_EXPIRED': 'Your session has expired. Please log in again',
  'NETWORK_ERROR': 'Network error. Please check your connection and try again',
  'SERVER_ERROR': 'Server error. Please try again later'
};