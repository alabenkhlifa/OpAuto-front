import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';
import { UserRole } from '../models/auth.model';

const ACCESS_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'opauth_user';

describe('AuthService — cached user normalization', () => {
  let httpMock: HttpTestingController;

  function bootstrap(): { service: AuthService; httpMock: HttpTestingController } {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService],
    });
    const service = TestBed.inject(AuthService);
    return { service, httpMock: TestBed.inject(HttpTestingController) };
  }

  afterEach(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    if (httpMock) {
      try { httpMock.verify(); } catch { /* swallow — some tests don't issue requests */ }
    }
    TestBed.resetTestingModule();
  });

  it('normalizes a legacy uppercase OWNER role from cached storage', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'fake-token');
    localStorage.setItem(USER_KEY, JSON.stringify({
      id: '1',
      email: 'owner@autotech.tn',
      firstName: 'Owner',
      lastName: 'Test',
      role: 'OWNER',
      garageId: '1',
    }));

    const { service, httpMock: hm } = bootstrap();
    httpMock = hm;

    const user = await firstValueFrom(service.currentUser$);
    expect(user).toBeTruthy();
    expect(user!.role).toBe(UserRole.OWNER);
    expect(user!.role).toBe('owner');
    expect(user!.name).toBe('Owner Test');

    const stored = JSON.parse(localStorage.getItem(USER_KEY)!);
    expect(stored.role).toBe('owner');
    expect(stored.name).toBe('Owner Test');

    // Drain the background /auth/profile call so HttpTestingController.verify() passes.
    httpMock.expectOne('/auth/profile').flush(null, { status: 401, statusText: 'Unauthorized' });
  });

  it('normalizes a legacy uppercase STAFF role from cached storage', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'fake-token');
    localStorage.setItem(USER_KEY, JSON.stringify({
      id: '2',
      username: 'mohamed',
      firstName: 'Mohamed',
      lastName: 'Trabelsi',
      role: 'STAFF',
      garageId: '1',
    }));

    const { service, httpMock: hm } = bootstrap();
    httpMock = hm;

    const user = await firstValueFrom(service.currentUser$);
    expect(user!.role).toBe(UserRole.STAFF);
    expect(user!.role).toBe('staff');
    expect(user!.name).toBe('Mohamed Trabelsi');

    httpMock.expectOne('/auth/profile').flush(null, { status: 401, statusText: 'Unauthorized' });
  });

  it('keeps an already-normalized cached user idempotent', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'fake-token');
    localStorage.setItem(USER_KEY, JSON.stringify({
      id: '1',
      email: 'owner@autotech.tn',
      name: 'Ala Ben Khlifa',
      role: 'owner',
      garageName: 'AutoTech',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      preferences: {
        theme: 'system',
        language: 'en',
        notifications: { email: true, sms: false, browser: true },
        dashboardLayout: 'standard',
      },
    }));

    const { service, httpMock: hm } = bootstrap();
    httpMock = hm;

    const user = await firstValueFrom(service.currentUser$);
    expect(user!.role).toBe(UserRole.OWNER);
    expect(user!.name).toBe('Ala Ben Khlifa');
    expect(user!.garageName).toBe('AutoTech');

    httpMock.expectOne('/auth/profile').flush(null, { status: 401, statusText: 'Unauthorized' });
  });

  it('does nothing when no cached user is present', async () => {
    const { service, httpMock: hm } = bootstrap();
    httpMock = hm;

    const user = await firstValueFrom(service.currentUser$);
    expect(user).toBeNull();
    httpMock.expectNone('/auth/profile');
  });

  it('updateCurrentUser merges a backend payload, broadcasts, and persists', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'fake-token');
    localStorage.setItem(USER_KEY, JSON.stringify({
      id: '1',
      email: 'owner@autotech.tn',
      name: 'Old Name',
      role: 'owner',
      garageName: 'AutoTech',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));

    const { service, httpMock: hm } = bootstrap();
    httpMock = hm;
    httpMock.expectOne('/auth/profile').flush(null, { status: 401, statusText: 'Unauthorized' });

    const broadcast: Array<string | undefined> = [];
    service.currentUser$.subscribe(u => broadcast.push(u?.name));

    const fresh = service.updateCurrentUser({
      id: '1',
      email: 'owner@autotech.tn',
      firstName: 'New',
      lastName: 'Name',
      role: 'OWNER',
    });

    expect(fresh!.name).toBe('New Name');
    expect(fresh!.role).toBe(UserRole.OWNER);
    expect(broadcast[broadcast.length - 1]).toBe('New Name');

    const stored = JSON.parse(localStorage.getItem(USER_KEY)!);
    expect(stored.name).toBe('New Name');
    expect(stored.role).toBe('owner');
    // garageName from prior state should survive — payload didn't carry it
    expect(stored.garageName).toBe('AutoTech');
  });

  it('updateCurrentUser is a no-op when given null', async () => {
    const { service, httpMock: hm } = bootstrap();
    httpMock = hm;
    expect(service.updateCurrentUser(null)).toBeNull();
  });
});
