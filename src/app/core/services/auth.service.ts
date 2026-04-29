import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
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

const ACCESS_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'opauth_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    const token = this.getToken();
    const user = this.getUserFromStorage();

    if (token && user) {
      // Restore session optimistically. Normalize cached payload so legacy
      // shapes (uppercase role, firstName/lastName without name) match the
      // current User contract before any consumer reads it.
      const normalized = this.mapUserFromBackend(user);
      localStorage.setItem(USER_KEY, JSON.stringify(normalized));
      this.currentUserSubject.next(normalized);
      this.isAuthenticatedSubject.next(true);

      // Validate in background — if it fails, keep cached user (interceptor handles real expiry)
      this.http.get<any>('/auth/profile').pipe(
        catchError(() => of(null))
      ).subscribe(profile => {
        if (profile) {
          const fresh = this.mapUserFromBackend(profile);
          this.currentUserSubject.next(fresh);
          localStorage.setItem(USER_KEY, JSON.stringify(fresh));
        }
      });
    }
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    const isEmail = request.emailOrUsername.includes('@');
    const payload: any = { password: request.password };
    if (isEmail) {
      payload.email = request.emailOrUsername;
    } else {
      payload.username = request.emailOrUsername;
    }
    return this.http.post<any>('/auth/login', payload).pipe(
      map(response => this.buildAuthResponse(response)),
      tap(response => this.handleAuthSuccess(response)),
      catchError(err => throwError(() => ({
        code: 'INVALID_CREDENTIALS',
        message: AUTH_ERRORS['INVALID_CREDENTIALS']
      } as AuthError)))
    );
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    const nameParts = (request.name || '').trim().split(/\s+/);
    return this.http.post<any>('/auth/register', {
      email: request.email,
      password: request.password,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      garageName: request.garageName,
      phone: request.phoneNumber
    }).pipe(
      map(response => this.buildAuthResponse(response)),
      tap(response => this.handleAuthSuccess(response))
    );
  }

  /**
   * Called by the 401 interceptor.
   * Sends the stored refresh_token (long-lived) to get a new access_token + refresh_token pair.
   * This does NOT require a valid access token — the refresh endpoint is unguarded.
   */
  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }

    return this.http.post<any>('/auth/refresh', { refresh_token: refreshToken }).pipe(
      map(response => this.buildAuthResponse(response)),
      tap(response => this.storeTokens(response.token, response.refreshToken))
    );
  }

  logout(): Observable<boolean> {
    return of(true).pipe(
      tap(() => {
        this.clearAuthData();
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
      })
    );
  }

  forceLogout(): void {
    this.clearAuthData();
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  forgotPassword(_request: ForgotPasswordRequest): Observable<{ message: string }> {
    return throwError(() => ({ code: 'NOT_IMPLEMENTED', message: 'Password reset is not yet available' } as AuthError));
  }

  resetPassword(_request: ResetPasswordRequest): Observable<{ message: string }> {
    return throwError(() => ({ code: 'NOT_IMPLEMENTED', message: 'Password reset is not yet available' } as AuthError));
  }

  changePassword(request: ChangePasswordRequest): Observable<{ message: string }> {
    return this.http.post<any>('/auth/change-password', {
      currentPassword: request.currentPassword,
      newPassword: request.newPassword,
    }).pipe(
      map(() => ({ message: 'Password changed successfully' })),
      catchError(err => throwError(() => ({
        code: 'INVALID_CREDENTIALS',
        message: err?.error?.message || 'Current password is incorrect'
      } as AuthError)))
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
    if (!this.isOwner()) {
      return throwError(() => ({ code: 'UNAUTHORIZED', message: AUTH_ERRORS['UNAUTHORIZED'] } as AuthError));
    }
    return this.http.post<any>('/users', {
      username: request.username,
      password: request.password,
      name: request.name,
      role: 'STAFF',
      phoneNumber: request.phoneNumber
    }).pipe(
      map(backendUser => this.mapUserFromBackend(backendUser))
    );
  }

  getToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  // ── Private helpers ───────────────────────────────────

  private buildAuthResponse(response: any): AuthResponse {
    return {
      user: this.mapUserFromBackend(response.user),
      token: response.access_token,
      refreshToken: response.refresh_token || '',
      expiresIn: 3600
    };
  }

  private handleAuthSuccess(response: AuthResponse): void {
    this.storeTokens(response.token, response.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.currentUserSubject.next(response.user);
    this.isAuthenticatedSubject.next(true);
  }

  private storeTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  private mapUserFromBackend(b: any): User {
    return {
      id: b.id,
      email: b.email || undefined,
      username: b.username || undefined,
      name: b.firstName && b.lastName
        ? `${b.firstName} ${b.lastName}`
        : b.name || b.email || '',
      role: b.role === 'OWNER' || b.role === 'owner' ? UserRole.OWNER : UserRole.STAFF,
      garageName: b.garage?.name || b.garageName || '',
      phoneNumber: b.phone || b.phoneNumber,
      isActive: b.isActive ?? true,
      createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
      updatedAt: b.updatedAt ? new Date(b.updatedAt) : new Date(),
      lastLogin: b.lastLogin ? new Date(b.lastLogin) : undefined,
      subscriptionTier: b.subscriptionTier,
      preferences: b.preferences || {
        theme: 'system',
        language: 'en',
        notifications: { email: !!b.email, sms: false, browser: true },
        dashboardLayout: 'standard'
      }
    };
  }

  private getUserFromStorage(): User | null {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private clearAuthData(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // Clean legacy keys
    sessionStorage.removeItem('opauth_token');
    sessionStorage.removeItem('opauth_refresh_token');
    sessionStorage.removeItem('opauth_user');
  }
}
