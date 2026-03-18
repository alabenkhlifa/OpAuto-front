import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { map, tap, switchMap } from 'rxjs/operators';
import {
  User,
  UserRole,
  UserStatus,
  UserInvitation,
  UserStats,
  UserFilters,
  InviteUserRequest,
  UserLimits
} from '../models/user.model';
import { fromBackendEnum, toBackendEnum } from '../utils/enum-mapper';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);

  private usersSubject = new BehaviorSubject<User[]>([]);
  private invitationsSubject = new BehaviorSubject<UserInvitation[]>([]);

  public users$ = this.usersSubject.asObservable();
  public invitations$ = this.invitationsSubject.asObservable();

  getUsers(filters?: UserFilters): Observable<User[]> {
    return this.http.get<any[]>('/users').pipe(
      map(users => users.map(u => this.mapFromBackend(u))),
      tap(users => this.usersSubject.next(users)),
      map(users => this.applyFilters(users, filters))
    );
  }

  getUserById(id: string): Observable<User | null> {
    return this.http.get<any>(`/users/${id}`).pipe(
      map(u => u ? this.mapFromBackend(u) : null)
    );
  }

  getCurrentUser(): Observable<User | null> {
    return this.http.get<any>('/auth/profile').pipe(
      map(u => u ? this.mapFromBackend(u) : null)
    );
  }

  getUserStats(): Observable<UserStats> {
    const users = this.usersSubject.value;
    const stats: UserStats = {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === 'active').length,
      pendingUsers: 0,
      roleDistribution: {
        owner: users.filter(u => u.role === 'owner').length,
        admin: users.filter(u => u.role === 'admin').length,
        mechanic: users.filter(u => u.role === 'mechanic').length,
        viewer: users.filter(u => u.role === 'viewer').length
      },
      recentJoins: users
        .filter(u => u.joinedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())
        .slice(0, 5),
      tierInfo: {
        current: { id: 'professional' as const, name: 'Professional', price: 0, currency: 'TND', features: [], limits: { users: null, cars: null, serviceBays: null } },
        limits: { current: users.length, limit: null, canAddUser: true }
      }
    };
    return of(stats);
  }

  getUserLimits(): Observable<UserLimits> {
    return of({
      current: this.usersSubject.value.length,
      limit: null,
      canAddUser: true
    });
  }

  inviteUser(request: InviteUserRequest): Observable<UserInvitation> {
    return this.http.post<any>('/users', {
      email: request.email,
      role: toBackendEnum(request.role),
      firstName: request.email.split('@')[0],
      lastName: ''
    }).pipe(
      map(u => {
        const invitation: UserInvitation = {
          id: u.id || `inv-${Date.now()}`,
          email: request.email,
          role: request.role,
          invitedBy: 'current-user',
          invitedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'pending',
          token: ''
        };
        const current = this.invitationsSubject.value;
        this.invitationsSubject.next([...current, invitation]);
        return invitation;
      })
    );
  }

  resendInvitation(invitationId: string): Observable<UserInvitation> {
    const current = this.invitationsSubject.value;
    const index = current.findIndex(inv => inv.id === invitationId);
    if (index === -1) return throwError(() => new Error('Invitation not found'));

    const updated = {
      ...current[index],
      invitedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending' as const
    };
    const updatedList = [...current];
    updatedList[index] = updated;
    this.invitationsSubject.next(updatedList);
    return of(updated);
  }

  cancelInvitation(invitationId: string): Observable<boolean> {
    const current = this.invitationsSubject.value;
    const index = current.findIndex(inv => inv.id === invitationId);
    if (index === -1) return throwError(() => new Error('Invitation not found'));

    const updated = { ...current[index], status: 'cancelled' as const };
    const updatedList = [...current];
    updatedList[index] = updated;
    this.invitationsSubject.next(updatedList);
    return of(true);
  }

  updateUserRole(userId: string, newRole: UserRole): Observable<User> {
    return this.http.put<any>(`/users/${userId}`, { role: toBackendEnum(newRole) }).pipe(
      map(u => this.mapFromBackend(u)),
      tap(updated => {
        const current = this.usersSubject.value;
        const index = current.findIndex(u => u.id === userId);
        if (index !== -1) {
          const updatedList = [...current];
          updatedList[index] = updated;
          this.usersSubject.next(updatedList);
        }
      })
    );
  }

  updateUserStatus(userId: string, newStatus: UserStatus): Observable<User> {
    return this.http.put<any>(`/users/${userId}`, { isActive: newStatus === 'active' }).pipe(
      map(u => this.mapFromBackend(u)),
      tap(updated => {
        const current = this.usersSubject.value;
        const index = current.findIndex(u => u.id === userId);
        if (index !== -1) {
          const updatedList = [...current];
          updatedList[index] = updated;
          this.usersSubject.next(updatedList);
        }
      })
    );
  }

  removeUser(userId: string): Observable<boolean> {
    const user = this.usersSubject.value.find(u => u.id === userId);
    if (!user) return throwError(() => new Error('User not found'));
    if (user.role === 'owner') return throwError(() => new Error('Cannot remove owner'));

    return this.http.delete<void>(`/users/${userId}`).pipe(
      map(() => {
        const filtered = this.usersSubject.value.filter(u => u.id !== userId);
        this.usersSubject.next(filtered);
        return true;
      })
    );
  }

  private mapFromBackend(b: any): User {
    return {
      id: b.id,
      email: b.email || '',
      firstName: b.firstName || '',
      lastName: b.lastName || '',
      fullName: b.firstName && b.lastName ? `${b.firstName} ${b.lastName}` : (b.name || b.email || ''),
      role: this.mapRole(b.role),
      status: b.isActive === false ? 'inactive' : 'active',
      joinedAt: new Date(b.createdAt || b.joinedAt),
      lastActiveAt: b.lastActiveAt ? new Date(b.lastActiveAt) : new Date(),
      invitedBy: b.invitedBy,
      permissions: this.getPermissionsForRole(this.mapRole(b.role))
    };
  }

  private mapRole(backendRole: string): UserRole {
    const role = (backendRole || '').toUpperCase();
    if (role === 'OWNER') return 'owner';
    if (role === 'ADMIN' || role === 'MANAGER') return 'admin';
    if (role === 'MECHANIC' || role === 'STAFF') return 'mechanic';
    return 'viewer';
  }

  private applyFilters(users: User[], filters?: UserFilters): User[] {
    if (!filters) return users;

    return users.filter(user => {
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        const searchableText = [user.fullName, user.email, user.role].join(' ').toLowerCase();
        if (!searchableText.includes(searchTerm)) return false;
      }
      if (filters.role && filters.role.length > 0 && !filters.role.includes(user.role)) return false;
      if (filters.status && filters.status.length > 0 && !filters.status.includes(user.status)) return false;
      if (filters.joinedAfter && user.joinedAt < filters.joinedAfter) return false;
      if (filters.joinedBefore && user.joinedAt > filters.joinedBefore) return false;
      return true;
    });
  }

  private getPermissionsForRole(role: UserRole) {
    switch (role) {
      case 'owner':
        return { canManageUsers: true, canManageSettings: true, canViewReports: true, canManageInventory: true, canManageAppointments: true, canManageInvoices: true, canManageMaintenance: true };
      case 'admin':
        return { canManageUsers: true, canManageSettings: false, canViewReports: true, canManageInventory: true, canManageAppointments: true, canManageInvoices: true, canManageMaintenance: true };
      case 'mechanic':
        return { canManageUsers: false, canManageSettings: false, canViewReports: false, canManageInventory: true, canManageAppointments: true, canManageInvoices: false, canManageMaintenance: true };
      case 'viewer':
        return { canManageUsers: false, canManageSettings: false, canViewReports: true, canManageInventory: false, canManageAppointments: false, canManageInvoices: false, canManageMaintenance: false };
    }
  }
}
