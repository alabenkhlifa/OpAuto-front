import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { map, delay, switchMap } from 'rxjs/operators';
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
import { SubscriptionService } from './subscription.service';
import { SubscriptionTierId } from '../models/subscription.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private mockUsers: User[] = [
    {
      id: 'user-001',
      email: 'ala@opauto.tn',
      firstName: 'Ala',
      lastName: 'Ben Khlifa',
      fullName: 'Ala Ben Khlifa',
      role: 'owner',
      status: 'active',
      joinedAt: new Date('2023-01-01'),
      lastActiveAt: new Date(),
      permissions: {
        canManageUsers: true,
        canManageSettings: true,
        canViewReports: true,
        canManageInventory: true,
        canManageAppointments: true,
        canManageInvoices: true,
        canManageMaintenance: true
      }
    },
    {
      id: 'user-002',
      email: 'sarah@opauto.tn',
      firstName: 'Sarah',
      lastName: 'Manager',
      fullName: 'Sarah Manager',
      role: 'admin',
      status: 'active',
      joinedAt: new Date('2023-02-15'),
      lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      invitedBy: 'user-001',
      permissions: {
        canManageUsers: true,
        canManageSettings: false,
        canViewReports: true,
        canManageInventory: true,
        canManageAppointments: true,
        canManageInvoices: true,
        canManageMaintenance: true
      }
    }
  ];

  private mockInvitations: UserInvitation[] = [
    {
      id: 'inv-001',
      email: 'new.user@example.com',
      role: 'mechanic',
      invitedBy: 'user-001',
      invitedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
      status: 'pending',
      token: 'mock-invitation-token'
    }
  ];

  private usersSubject = new BehaviorSubject<User[]>(this.mockUsers);
  private invitationsSubject = new BehaviorSubject<UserInvitation[]>(this.mockInvitations);

  public users$ = this.usersSubject.asObservable();
  public invitations$ = this.invitationsSubject.asObservable();

  constructor(private subscriptionService: SubscriptionService) {}

  getUsers(filters?: UserFilters): Observable<User[]> {
    return this.users$.pipe(
      map((users: User[]) => this.applyFilters(users, filters)),
      delay(200)
    );
  }

  getUserById(id: string): Observable<User | null> {
    return this.users$.pipe(
      map((users: User[]) => users.find((user: User) => user.id === id) || null),
      delay(100)
    );
  }

  getCurrentUser(): Observable<User | null> {
    // In real app, this would get current authenticated user
    return this.getUserById('user-001');
  }

  getUserStats(): Observable<UserStats> {
    return this.users$.pipe(
      switchMap(users => 
        this.subscriptionService.getCurrentSubscriptionStatus().pipe(
          map(subscriptionStatus => {
            const stats: UserStats = {
              totalUsers: users.length,
              activeUsers: users.filter(u => u.status === 'active').length,
              pendingUsers: this.mockInvitations.filter(inv => inv.status === 'pending').length,
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
                current: subscriptionStatus.currentTier,
                limits: this.calculateUserLimits(users.length, subscriptionStatus.currentTier)
              }
            };
            return stats;
          })
        )
      ),
      delay(150)
    );
  }

  getUserLimits(): Observable<UserLimits> {
    return this.users$.pipe(
      switchMap(users =>
        this.subscriptionService.getCurrentSubscriptionStatus().pipe(
          map(subscriptionStatus => this.calculateUserLimits(users.length, subscriptionStatus.currentTier))
        )
      )
    );
  }

  inviteUser(request: InviteUserRequest): Observable<UserInvitation> {
    return this.getUserLimits().pipe(
      switchMap(limits => {
        if (!limits.canAddUser) {
          return throwError(() => new Error('User limit reached for current tier'));
        }

        const newInvitation: UserInvitation = {
          id: `inv-${Date.now()}`,
          email: request.email,
          role: request.role,
          invitedBy: 'user-001', // Current user ID
          invitedAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          status: 'pending',
          token: `mock-token-${Date.now()}`
        };

        const currentInvitations = this.invitationsSubject.value;
        this.invitationsSubject.next([...currentInvitations, newInvitation]);

        return of(newInvitation).pipe(delay(300));
      })
    );
  }

  resendInvitation(invitationId: string): Observable<UserInvitation> {
    const currentInvitations = this.invitationsSubject.value;
    const invitationIndex = currentInvitations.findIndex(inv => inv.id === invitationId);
    
    if (invitationIndex === -1) {
      return throwError(() => new Error('Invitation not found'));
    }

    const updatedInvitation = {
      ...currentInvitations[invitationIndex],
      invitedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending' as const
    };

    const updatedInvitations = [...currentInvitations];
    updatedInvitations[invitationIndex] = updatedInvitation;
    this.invitationsSubject.next(updatedInvitations);

    return of(updatedInvitation).pipe(delay(200));
  }

  cancelInvitation(invitationId: string): Observable<boolean> {
    const currentInvitations = this.invitationsSubject.value;
    const invitationIndex = currentInvitations.findIndex(inv => inv.id === invitationId);
    
    if (invitationIndex === -1) {
      return throwError(() => new Error('Invitation not found'));
    }

    const updatedInvitation = {
      ...currentInvitations[invitationIndex],
      status: 'cancelled' as const
    };

    const updatedInvitations = [...currentInvitations];
    updatedInvitations[invitationIndex] = updatedInvitation;
    this.invitationsSubject.next(updatedInvitations);

    return of(true).pipe(delay(200));
  }

  updateUserRole(userId: string, newRole: UserRole): Observable<User> {
    const currentUsers = this.usersSubject.value;
    const userIndex = currentUsers.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return throwError(() => new Error('User not found'));
    }

    const updatedUser = {
      ...currentUsers[userIndex],
      role: newRole,
      permissions: this.getPermissionsForRole(newRole)
    };

    const updatedUsers = [...currentUsers];
    updatedUsers[userIndex] = updatedUser;
    this.usersSubject.next(updatedUsers);

    return of(updatedUser).pipe(delay(300));
  }

  updateUserStatus(userId: string, newStatus: UserStatus): Observable<User> {
    const currentUsers = this.usersSubject.value;
    const userIndex = currentUsers.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return throwError(() => new Error('User not found'));
    }

    const updatedUser = {
      ...currentUsers[userIndex],
      status: newStatus
    };

    const updatedUsers = [...currentUsers];
    updatedUsers[userIndex] = updatedUser;
    this.usersSubject.next(updatedUsers);

    return of(updatedUser).pipe(delay(300));
  }

  removeUser(userId: string): Observable<boolean> {
    const currentUsers = this.usersSubject.value;
    const user = currentUsers.find(u => u.id === userId);
    
    if (!user) {
      return throwError(() => new Error('User not found'));
    }

    if (user.role === 'owner') {
      return throwError(() => new Error('Cannot remove owner'));
    }

    const filteredUsers = currentUsers.filter(u => u.id !== userId);
    this.usersSubject.next(filteredUsers);
    
    return of(true).pipe(delay(200));
  }

  private applyFilters(users: User[], filters?: UserFilters): User[] {
    if (!filters) return users;

    return users.filter(user => {
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        const searchableText = [
          user.fullName,
          user.email,
          user.role
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm)) return false;
      }

      if (filters.role && filters.role.length > 0 && !filters.role.includes(user.role)) {
        return false;
      }

      if (filters.status && filters.status.length > 0 && !filters.status.includes(user.status)) {
        return false;
      }

      if (filters.joinedAfter && user.joinedAt < filters.joinedAfter) {
        return false;
      }

      if (filters.joinedBefore && user.joinedAt > filters.joinedBefore) {
        return false;
      }

      return true;
    });
  }

  private calculateUserLimits(currentCount: number, tier: any): UserLimits {
    const limit = tier.limits.users;
    const canAddUser = limit === null || currentCount < limit;
    
    let nextTier;
    if (tier.id === 'solo') {
      nextTier = { 
        id: 'starter' as const,
        name: 'Starter', 
        price: 2000,
        currency: 'TND',
        limits: { users: 3, cars: 200, serviceBays: 2 },
        features: []
      };
    } else if (tier.id === 'starter') {
      nextTier = { 
        id: 'professional' as const,
        name: 'Professional',
        price: 6000,
        currency: 'TND', 
        limits: { users: null, cars: null, serviceBays: null },
        features: []
      };
    }

    return {
      current: currentCount,
      limit,
      canAddUser,
      nextTier
    };
  }

  private getPermissionsForRole(role: UserRole) {
    switch (role) {
      case 'owner':
        return {
          canManageUsers: true,
          canManageSettings: true,
          canViewReports: true,
          canManageInventory: true,
          canManageAppointments: true,
          canManageInvoices: true,
          canManageMaintenance: true
        };
      case 'admin':
        return {
          canManageUsers: true,
          canManageSettings: false,
          canViewReports: true,
          canManageInventory: true,
          canManageAppointments: true,
          canManageInvoices: true,
          canManageMaintenance: true
        };
      case 'mechanic':
        return {
          canManageUsers: false,
          canManageSettings: false,
          canViewReports: false,
          canManageInventory: true,
          canManageAppointments: true,
          canManageInvoices: false,
          canManageMaintenance: true
        };
      case 'viewer':
        return {
          canManageUsers: false,
          canManageSettings: false,
          canViewReports: true,
          canManageInventory: false,
          canManageAppointments: false,
          canManageInvoices: false,
          canManageMaintenance: false
        };
    }
  }
}