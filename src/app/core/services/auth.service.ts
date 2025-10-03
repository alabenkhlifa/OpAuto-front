import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { delay, map, tap } from 'rxjs/operators';
import { 
  User, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  CreateStaffRequest,
  UserRole,
  AuthError,
  AUTH_ERRORS 
} from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEYS = {
    TOKEN: 'opauth_token',
    REFRESH_TOKEN: 'opauth_refresh_token',
    USER: 'opauth_user',
    REMEMBER_ME: 'opauth_remember_me'
  };

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    // Load persisted auth data from storage instead of clearing it
    const user = this.getUserFromStorage();
    const hasToken = this.hasValidToken();

    if (user && hasToken) {
      this.currentUserSubject.next(user);
      this.isAuthenticatedSubject.next(true);
    } else {
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
    }
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.validateLoginCredentials(request).pipe(
      delay(1500),
      tap(response => {
        this.storeAuthData(response, request.rememberMe);
        this.currentUserSubject.next(response.user);
        this.isAuthenticatedSubject.next(true);
        
        if (response.user.subscriptionTier) {
          setTimeout(() => {
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'opauth_user',
              newValue: JSON.stringify(response.user),
              storageArea: request.rememberMe ? localStorage : sessionStorage
            }));
          }, 0);
        }
      })
    );
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    // Simulate API call with validation
    return this.validateRegistrationData(request).pipe(
      delay(2000),
      tap(response => {
        this.storeAuthData(response, false);
        this.currentUserSubject.next(response.user);
        this.isAuthenticatedSubject.next(true);
      })
    );
  }

  logout(): Observable<boolean> {
    return of(true).pipe(
      delay(300),
      tap(() => {
        this.clearAuthData();
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
      })
    );
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<{ message: string }> {
    // Simulate password reset email
    const mockEmails = ['admin@example.com', 'mechanic@example.com'];
    
    if (!mockEmails.includes(request.email)) {
      return throwError(() => ({
        code: 'EMAIL_NOT_FOUND',
        message: AUTH_ERRORS['EMAIL_NOT_FOUND']
      } as AuthError));
    }

    return of({ message: 'Password reset instructions sent to your email' }).pipe(delay(1000));
  }

  resetPassword(request: ResetPasswordRequest): Observable<{ message: string }> {
    // Simulate password reset
    if (request.password !== request.confirmPassword) {
      return throwError(() => ({
        code: 'PASSWORDS_DONT_MATCH',
        message: 'Passwords do not match'
      } as AuthError));
    }

    return of({ message: 'Password reset successfully' }).pipe(delay(1000));
  }

  changePassword(request: ChangePasswordRequest): Observable<{ message: string }> {
    // Simulate password change
    if (request.newPassword !== request.confirmPassword) {
      return throwError(() => ({
        code: 'PASSWORDS_DONT_MATCH',
        message: 'New passwords do not match'
      } as AuthError));
    }

    if (request.currentPassword === 'wrongpassword') {
      return throwError(() => ({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password is incorrect'
      } as AuthError));
    }

    return of({ message: 'Password changed successfully' }).pipe(delay(1000));
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem(this.STORAGE_KEYS.REFRESH_TOKEN);
    
    if (!refreshToken) {
      return throwError(() => ({
        code: 'NO_REFRESH_TOKEN',
        message: 'No refresh token available'
      } as AuthError));
    }

    // Simulate token refresh
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) {
      return throwError(() => ({
        code: 'NO_USER',
        message: 'No user data available'
      } as AuthError));
    }

    const authResponse: AuthResponse = {
      user: currentUser,
      token: `mock_token_${Date.now()}`,
      refreshToken: `mock_refresh_${Date.now()}`,
      expiresIn: 3600
    };

    return of(authResponse).pipe(
      delay(500),
      tap(response => {
        this.storeAuthData(response, true);
      })
    );
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  hasRole(role: UserRole): boolean {
    const user = this.getCurrentUser();
    return user ? user.role === role : false;
  }

  isOwner(): boolean {
    return this.hasRole(UserRole.OWNER);
  }

  isStaff(): boolean {
    return this.hasRole(UserRole.STAFF);
  }

  createStaffAccount(request: CreateStaffRequest): Observable<User> {
    // Only owner can create staff accounts
    if (!this.isOwner()) {
      return throwError(() => ({
        code: 'UNAUTHORIZED',
        message: AUTH_ERRORS['UNAUTHORIZED']
      } as AuthError));
    }

    // Validate request
    if (request.password !== request.confirmPassword) {
      return throwError(() => ({
        code: 'PASSWORDS_DONT_MATCH',
        message: 'Passwords do not match'
      } as AuthError));
    }

    // Validate username
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(request.username)) {
      return throwError(() => ({
        code: 'INVALID_USERNAME',
        message: AUTH_ERRORS['INVALID_USERNAME']
      } as AuthError));
    }

    // Create new staff user
    const newStaffUser: User = {
      id: `user_${Date.now()}`,
      username: request.username,
      name: request.name,
      role: request.role,
      garageName: this.getCurrentUser()?.garageName || 'OpAuto Garage',
      phoneNumber: request.phoneNumber,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        theme: 'system',
        language: 'en',
        notifications: {
          email: false, // Staff don't have email
          sms: false,
          browser: true
        },
        dashboardLayout: 'standard'
      }
    };

    return of(newStaffUser).pipe(delay(1000));
  }

  private validateLoginCredentials(request: LoginRequest): Observable<AuthResponse> {
    const mockUsers = [
      // SOLO TIER - 1 Owner only
      { 
        email: 'solo@opauto.tn', 
        username: null, 
        password: 'solo123', 
        name: 'Mohammed Karim', 
        role: UserRole.OWNER, 
        garageName: 'Garage Solo Mécanique',
        subscriptionTier: 'solo'
      },
      
      // STARTER TIER - 1 Owner + 2 Staff
      { 
        email: 'starter@opauto.tn', 
        username: null, 
        password: 'starter123', 
        name: 'Ahmed Ben Salah', 
        role: UserRole.OWNER, 
        garageName: 'Garage Starter Auto',
        subscriptionTier: 'starter'
      },
      { 
        email: null, 
        username: 'starter_staff1', 
        password: 'staff123', 
        name: 'Sara Mansouri', 
        role: UserRole.STAFF, 
        garageName: 'Garage Starter Auto',
        subscriptionTier: 'starter'
      },
      { 
        email: null, 
        username: 'starter_staff2', 
        password: 'staff123', 
        name: 'Youssef Trabelsi', 
        role: UserRole.STAFF, 
        garageName: 'Garage Starter Auto',
        subscriptionTier: 'starter'
      },
      
      // PROFESSIONAL TIER - 1 Owner + 5 Staff
      { 
        email: 'pro@opauto.tn', 
        username: null, 
        password: 'pro123', 
        name: 'Karim Gharbi', 
        role: UserRole.OWNER, 
        garageName: 'Garage Professional Motors',
        subscriptionTier: 'professional'
      },
      { 
        email: null, 
        username: 'pro_mechanic1', 
        password: 'staff123', 
        name: 'Fatma Slimani', 
        role: UserRole.STAFF, 
        garageName: 'Garage Professional Motors',
        subscriptionTier: 'professional'
      },
      { 
        email: null, 
        username: 'pro_mechanic2', 
        password: 'staff123', 
        name: 'Ali Bouzid', 
        role: UserRole.STAFF, 
        garageName: 'Garage Professional Motors',
        subscriptionTier: 'professional'
      },
      { 
        email: null, 
        username: 'pro_mechanic3', 
        password: 'staff123', 
        name: 'Leila Mabrouk', 
        role: UserRole.STAFF, 
        garageName: 'Garage Professional Motors',
        subscriptionTier: 'professional'
      },
      { 
        email: null, 
        username: 'pro_receptionist', 
        password: 'staff123', 
        name: 'Nadia Hamdi', 
        role: UserRole.STAFF, 
        garageName: 'Garage Professional Motors',
        subscriptionTier: 'professional'
      },
      { 
        email: null, 
        username: 'pro_inventory', 
        password: 'staff123', 
        name: 'Hichem Louati', 
        role: UserRole.STAFF, 
        garageName: 'Garage Professional Motors',
        subscriptionTier: 'professional'
      }
    ];

    // Check if input is email or username
    const isEmail = request.emailOrUsername.includes('@');
    const user = mockUsers.find(u => {
      if (isEmail) {
        return u.email === request.emailOrUsername && u.password === request.password;
      } else {
        return u.username === request.emailOrUsername && u.password === request.password;
      }
    });
    
    if (!user) {
      return throwError(() => ({
        code: 'INVALID_CREDENTIALS',
        message: AUTH_ERRORS['INVALID_CREDENTIALS']
      } as AuthError));
    }

    const authUser: User = {
      id: `user_${Date.now()}`,
      email: user.email || undefined,
      username: user.username || undefined,
      name: user.name,
      role: user.role,
      garageName: user.garageName,
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
      lastLogin: new Date(),
      subscriptionTier: (user as any).subscriptionTier,
      preferences: {
        theme: 'system',
        language: 'en',
        notifications: {
          email: !!user.email,
          sms: false,
          browser: true
        },
        dashboardLayout: 'standard'
      }
    };

    const authResponse: AuthResponse = {
      user: authUser,
      token: `mock_token_${Date.now()}`,
      refreshToken: `mock_refresh_${Date.now()}`,
      expiresIn: 3600
    };

    return of(authResponse);
  }

  private validateRegistrationData(request: RegisterRequest): Observable<AuthResponse> {
    // Public registration is disabled - only for initial owner setup
    // Check if owner already exists (in real app, check database)
    const ownerExists = false; // In mock, assume no owner exists initially
    
    if (ownerExists) {
      return throwError(() => ({
        code: 'UNAUTHORIZED',
        message: 'Public registration is disabled. Contact your garage owner to create an account.'
      } as AuthError));
    }

    if (request.password !== request.confirmPassword) {
      return throwError(() => ({
        code: 'PASSWORDS_DONT_MATCH',
        message: 'Passwords do not match'
      } as AuthError));
    }

    if (!request.acceptTerms) {
      return throwError(() => ({
        code: 'TERMS_NOT_ACCEPTED',
        message: 'You must accept the terms and conditions'
      } as AuthError));
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      email: request.email,
      name: request.name,
      role: UserRole.OWNER, // First registration is always the owner
      garageName: request.garageName,
      phoneNumber: request.phoneNumber,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        theme: 'system',
        language: 'en',
        notifications: {
          email: true,
          sms: false,
          browser: true
        },
        dashboardLayout: 'standard'
      }
    };

    const authResponse: AuthResponse = {
      user: newUser,
      token: `mock_token_${Date.now()}`,
      refreshToken: `mock_refresh_${Date.now()}`,
      expiresIn: 3600
    };

    return of(authResponse);
  }

  private storeAuthData(authResponse: AuthResponse, rememberMe?: boolean) {
    const storage = rememberMe ? localStorage : sessionStorage;
    
    storage.setItem(this.STORAGE_KEYS.TOKEN, authResponse.token);
    storage.setItem(this.STORAGE_KEYS.REFRESH_TOKEN, authResponse.refreshToken);
    storage.setItem(this.STORAGE_KEYS.USER, JSON.stringify(authResponse.user));
    
    if (rememberMe) {
      localStorage.setItem(this.STORAGE_KEYS.REMEMBER_ME, 'true');
    }
  }

  private clearAuthData() {
    // Clear from both storages
    [localStorage, sessionStorage].forEach(storage => {
      Object.values(this.STORAGE_KEYS).forEach(key => {
        storage.removeItem(key);
      });
    });
  }

  private getUserFromStorage(): User | null {
    try {
      // Check localStorage first, then sessionStorage
      let userData = localStorage.getItem(this.STORAGE_KEYS.USER);
      if (!userData) {
        userData = sessionStorage.getItem(this.STORAGE_KEYS.USER);
      }
      
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  }

  private hasValidToken(): boolean {
    const token = localStorage.getItem(this.STORAGE_KEYS.TOKEN) || 
                  sessionStorage.getItem(this.STORAGE_KEYS.TOKEN);
    return !!token;
  }

  private checkTokenExpiration() {
    // In a real app, you'd decode the JWT and check expiration
    // For now, just simulate token validation
    const token = localStorage.getItem(this.STORAGE_KEYS.TOKEN) || 
                  sessionStorage.getItem(this.STORAGE_KEYS.TOKEN);
    
    if (token && !this.getUserFromStorage()) {
      this.clearAuthData();
      this.isAuthenticatedSubject.next(false);
    }
  }
}