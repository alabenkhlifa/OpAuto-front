import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UserService } from './user.service';
import { SubscriptionService } from './subscription.service';
import { User, UserRole, UserStats, InviteUserRequest } from '../models/user.model';

describe('UserService', () => {
  let service: UserService;
  let mockSubscriptionService: jasmine.SpyObj<SubscriptionService>;

  beforeEach(() => {
    const subscriptionSpy = jasmine.createSpyObj('SubscriptionService', ['getCurrentSubscriptionStatus']);
    
    TestBed.configureTestingModule({
      providers: [
        UserService,
        { provide: SubscriptionService, useValue: subscriptionSpy }
      ]
    });
    
    service = TestBed.inject(UserService);
    mockSubscriptionService = TestBed.inject(SubscriptionService) as jasmine.SpyObj<SubscriptionService>;
    
    // Setup default mock response
    mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of({
      currentTier: {
        id: 'starter',
        name: 'Starter',
        price: 79,
        currency: 'TND',
        limits: { users: 5, cars: 200, serviceBays: 5 },
        features: []
      },
      usage: { users: 2, cars: 10, serviceBays: 1 },
      renewalDate: new Date(),
      isActive: true,
      daysUntilRenewal: 30
    }));
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getUsers', () => {
    it('should return users list', (done) => {
      service.getUsers().subscribe(users => {
        expect(users).toBeDefined();
        expect(users.length).toBeGreaterThan(0);
        expect(users[0].id).toBeDefined();
        expect(users[0].email).toBeDefined();
        expect(users[0].role).toBeDefined();
        done();
      });
    });

    it('should filter users by search term', (done) => {
      const filters = { searchTerm: 'Ala' };
      service.getUsers(filters).subscribe(users => {
        expect(users.length).toBe(1);
        expect(users[0].fullName).toContain('Ala');
        done();
      });
    });

    it('should filter users by role', (done) => {
      const filters = { role: ['owner'] as UserRole[] };
      service.getUsers(filters).subscribe(users => {
        expect(users.length).toBe(1);
        expect(users[0].role).toBe('owner');
        done();
      });
    });
  });

  describe('getUserLimits', () => {
    it('should return user limits for starter tier', (done) => {
      service.getUserLimits().subscribe(limits => {
        expect(limits.current).toBe(2); // Based on mock data
        expect(limits.limit).toBe(5); // Starter tier limit
        expect(limits.canAddUser).toBe(true);
        expect(limits.nextTier).toBeDefined();
        expect(limits.nextTier?.id).toBe('professional');
        done();
      });
    });

    it('should handle unlimited tier correctly', (done) => {
      // Mock professional tier (unlimited)
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of({
        currentTier: {
          id: 'professional',
          name: 'Professional',
          price: 149,
          currency: 'TND',
          limits: { users: null, cars: null, serviceBays: null },
          features: []
        },
        usage: { users: 2, cars: 10, serviceBays: 1 },
        renewalDate: new Date(),
        isActive: true,
        daysUntilRenewal: 30
      }));

      service.getUserLimits().subscribe(limits => {
        expect(limits.limit).toBeNull();
        expect(limits.canAddUser).toBe(true);
        expect(limits.nextTier).toBeUndefined();
        done();
      });
    });

    it('should prevent adding users when limit reached', (done) => {
      // Mock starter tier with 5 users (at limit)
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of({
        currentTier: {
          id: 'starter',
          name: 'Starter',
          price: 79,
          currency: 'TND',
          limits: { users: 5, cars: 200, serviceBays: 5 },
          features: []
        },
        usage: { users: 5, cars: 10, serviceBays: 1 },
        renewalDate: new Date(),
        isActive: true,
        daysUntilRenewal: 30
      }));

      // Add 3 more mock users to reach the limit
      (service as any).mockUsers = [
        ...(service as any).mockUsers,
        { id: 'user-003', email: 'test3@test.com', role: 'mechanic' },
        { id: 'user-004', email: 'test4@test.com', role: 'mechanic' },
        { id: 'user-005', email: 'test5@test.com', role: 'mechanic' }
      ];

      service.getUserLimits().subscribe(limits => {
        expect(limits.current).toBe(5);
        expect(limits.limit).toBe(5);
        expect(limits.canAddUser).toBe(false);
        done();
      });
    });
  });

  describe('inviteUser', () => {
    it('should successfully invite user when within limits', (done) => {
      const inviteRequest: InviteUserRequest = {
        email: 'newuser@test.com',
        role: 'mechanic' as UserRole,
        firstName: 'New',
        lastName: 'User'
      };

      service.inviteUser(inviteRequest).subscribe(invitation => {
        expect(invitation).toBeDefined();
        expect(invitation.email).toBe(inviteRequest.email);
        expect(invitation.role).toBe(inviteRequest.role);
        expect(invitation.status).toBe('pending');
        done();
      });
    });

    it('should reject invitation when user limit reached', (done) => {
      // Mock solo tier (1 user limit)
      mockSubscriptionService.getCurrentSubscriptionStatus.and.returnValue(of({
        currentTier: {
          id: 'solo',
          name: 'Solo',
          price: 29,
          currency: 'TND',
          limits: { users: 1, cars: 50, serviceBays: 2 },
          features: []
        },
        usage: { users: 1, cars: 5, serviceBays: 1 },
        renewalDate: new Date(),
        isActive: true,
        daysUntilRenewal: 30
      }));

      const inviteRequest: InviteUserRequest = {
        email: 'newuser@test.com',
        role: 'mechanic' as UserRole
      };

      service.inviteUser(inviteRequest).subscribe({
        next: () => fail('Should have thrown error'),
        error: (error) => {
          expect(error.message).toContain('User limit reached');
          done();
        }
      });
    });
  });

  describe('getUserStats', () => {
    it('should return comprehensive user statistics', (done) => {
      service.getUserStats().subscribe(stats => {
        expect(stats).toBeDefined();
        expect(stats.totalUsers).toBeGreaterThan(0);
        expect(stats.activeUsers).toBeGreaterThan(0);
        expect(stats.roleDistribution).toBeDefined();
        expect(stats.tierInfo).toBeDefined();
        expect(stats.tierInfo.current).toBeDefined();
        expect(stats.tierInfo.limits).toBeDefined();
        done();
      });
    });

    it('should calculate role distribution correctly', (done) => {
      service.getUserStats().subscribe(stats => {
        expect(stats.roleDistribution.owner).toBe(1);
        expect(stats.roleDistribution.admin).toBe(1);
        expect(stats.roleDistribution.mechanic).toBe(0);
        expect(stats.roleDistribution.viewer).toBe(0);
        done();
      });
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', (done) => {
      service.updateUserRole('user-002', 'mechanic').subscribe(updatedUser => {
        expect(updatedUser.role).toBe('mechanic');
        expect(updatedUser.permissions.canManageUsers).toBe(false);
        expect(updatedUser.permissions.canManageInventory).toBe(true);
        done();
      });
    });

    it('should return error for non-existent user', (done) => {
      service.updateUserRole('non-existent', 'admin').subscribe({
        next: () => fail('Should have thrown error'),
        error: (error) => {
          expect(error.message).toBe('User not found');
          done();
        }
      });
    });
  });

  describe('removeUser', () => {
    it('should remove user successfully', (done) => {
      service.removeUser('user-002').subscribe(result => {
        expect(result).toBe(true);
        done();
      });
    });

    it('should prevent removing owner', (done) => {
      service.removeUser('user-001').subscribe({
        next: () => fail('Should have thrown error'),
        error: (error) => {
          expect(error.message).toBe('Cannot remove owner');
          done();
        }
      });
    });
  });

  describe('permission system', () => {
    it('should assign correct permissions for admin role', () => {
      const permissions = (service as any).getPermissionsForRole('admin');
      expect(permissions.canManageUsers).toBe(true);
      expect(permissions.canManageSettings).toBe(false);
      expect(permissions.canViewReports).toBe(true);
    });

    it('should assign correct permissions for mechanic role', () => {
      const permissions = (service as any).getPermissionsForRole('mechanic');
      expect(permissions.canManageUsers).toBe(false);
      expect(permissions.canManageInventory).toBe(true);
      expect(permissions.canManageMaintenance).toBe(true);
    });

    it('should assign correct permissions for viewer role', () => {
      const permissions = (service as any).getPermissionsForRole('viewer');
      expect(permissions.canManageUsers).toBe(false);
      expect(permissions.canViewReports).toBe(true);
      expect(permissions.canManageInventory).toBe(false);
    });
  });
});