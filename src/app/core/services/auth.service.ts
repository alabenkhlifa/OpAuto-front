import { Injectable } from '@angular/core';
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
    // Clear any existing auth data for demo purposes and initialize
    this.clearAuthData();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    // Simulate API call with validation
    return this.validateLoginCredentials(request).pipe(
      delay(1500),
      tap(response => {
        this.storeAuthData(response, request.rememberMe);
        this.currentUserSubject.next(response.user);
        this.isAuthenticatedSubject.next(true);
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

  isAdmin(): boolean {
    return this.hasRole(UserRole.ADMIN);
  }

  private validateLoginCredentials(request: LoginRequest): Observable<AuthResponse> {
    // Mock validation
    const mockUsers = [
      { email: 'admin@opauto.tn', password: 'admin123', name: 'Ahmed Ben Salah', role: UserRole.ADMIN, garageName: 'OpAuto Garage Tunis' },
      { email: 'mechanic@opauto.tn', password: 'mech123', name: 'Fatma Slimani', role: UserRole.MECHANIC, garageName: 'OpAuto Garage Tunis' }
    ];

    const user = mockUsers.find(u => u.email === request.email && u.password === request.password);
    
    if (!user) {
      return throwError(() => ({
        code: 'INVALID_CREDENTIALS',
        message: AUTH_ERRORS['INVALID_CREDENTIALS']
      } as AuthError));
    }

    const authUser: User = {
      id: `user_${Date.now()}`,
      email: user.email,
      name: user.name,
      role: user.role,
      garageName: user.garageName,
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
      lastLogin: new Date(),
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
      user: authUser,
      token: `mock_token_${Date.now()}`,
      refreshToken: `mock_refresh_${Date.now()}`,
      expiresIn: 3600
    };

    return of(authResponse);
  }

  private validateRegistrationData(request: RegisterRequest): Observable<AuthResponse> {
    // Mock validation
    if (request.email === 'admin@opauto.tn') {
      return throwError(() => ({
        code: 'EMAIL_ALREADY_EXISTS',
        message: AUTH_ERRORS['EMAIL_ALREADY_EXISTS']
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
      role: UserRole.ADMIN, // First user is always admin
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