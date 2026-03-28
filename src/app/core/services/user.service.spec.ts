import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { UserService } from './user.service';
import { SubscriptionService } from './subscription.service';
import { User, UserRole, UserStats, InviteUserRequest } from '../models/user.model';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;
  let mockSubscriptionService: jasmine.SpyObj<SubscriptionService>;

  const mockBackendUsers = [
    {
      id: 'user-001',
      email: 'ala@test.com',
      firstName: 'Ala',
      lastName: 'Ben',
      role: 'OWNER',
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'user-002',
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ];

  beforeEach(() => {
    const subscriptionSpy = jasmine.createSpyObj('SubscriptionService', ['getCurrentSubscriptionStatus']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        UserService,
        { provide: SubscriptionService, useValue: subscriptionSpy }
      ]
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
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

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getUsers', () => {
    it('should return users list', (done) => {
      service.getUsers().subscribe(users => {
        expect(users).toBeDefined();
        expect(users.length).toBe(2);
        expect(users[0].id).toBeDefined();
        expect(users[0].email).toBeDefined();
        expect(users[0].role).toBeDefined();
        done();
      });

      const req = httpMock.expectOne('/users');
      expect(req.request.method).toBe('GET');
      req.flush(mockBackendUsers);
    });

    it('should filter users by search term', (done) => {
      const filters = { searchTerm: 'Ala' };
      service.getUsers(filters).subscribe(users => {
        expect(users.length).toBe(1);
        expect(users[0].fullName).toContain('Ala');
        done();
      });

      const req = httpMock.expectOne('/users');
      req.flush(mockBackendUsers);
    });

    it('should filter users by role', (done) => {
      const filters = { role: ['owner'] as UserRole[] };
      service.getUsers(filters).subscribe(users => {
        expect(users.length).toBe(1);
        expect(users[0].role).toBe('owner');
        done();
      });

      const req = httpMock.expectOne('/users');
      req.flush(mockBackendUsers);
    });
  });

  describe('getUserLimits', () => {
    it('should return user limits based on current users', (done) => {
      service.getUserLimits().subscribe(limits => {
        expect(limits.current).toBe(0); // No users loaded yet
        expect(limits.limit).toBeNull();
        expect(limits.canAddUser).toBe(true);
        done();
      });
    });
  });

  describe('inviteUser', () => {
    it('should successfully invite user via HTTP', (done) => {
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

      const req = httpMock.expectOne('/users');
      expect(req.request.method).toBe('POST');
      req.flush({ id: 'new-user-id', email: 'newuser@test.com' });
    });
  });

  describe('getUserStats', () => {
    it('should return comprehensive user statistics', (done) => {
      // First load users to populate internal state
      service.getUsers().subscribe(() => {
        service.getUserStats().subscribe(stats => {
          expect(stats).toBeDefined();
          expect(stats.totalUsers).toBe(2);
          expect(stats.activeUsers).toBe(2);
          expect(stats.roleDistribution).toBeDefined();
          expect(stats.tierInfo).toBeDefined();
          expect(stats.tierInfo.current).toBeDefined();
          expect(stats.tierInfo.limits).toBeDefined();
          done();
        });
      });

      const req = httpMock.expectOne('/users');
      req.flush(mockBackendUsers);
    });

    it('should calculate role distribution correctly', (done) => {
      service.getUsers().subscribe(() => {
        service.getUserStats().subscribe(stats => {
          expect(stats.roleDistribution.owner).toBe(1);
          expect(stats.roleDistribution.admin).toBe(1);
          expect(stats.roleDistribution.mechanic).toBe(0);
          expect(stats.roleDistribution.viewer).toBe(0);
          done();
        });
      });

      const req = httpMock.expectOne('/users');
      req.flush(mockBackendUsers);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role via HTTP', (done) => {
      // Load users first
      service.getUsers().subscribe(() => {
        service.updateUserRole('user-002', 'mechanic').subscribe(updatedUser => {
          expect(updatedUser).toBeDefined();
          expect(updatedUser.role).toBe('mechanic');
          done();
        });

        const putReq = httpMock.expectOne('/users/user-002');
        expect(putReq.request.method).toBe('PUT');
        putReq.flush({ ...mockBackendUsers[1], role: 'MECHANIC' });
      });

      const getReq = httpMock.expectOne('/users');
      getReq.flush(mockBackendUsers);
    });
  });

  describe('removeUser', () => {
    it('should remove user via HTTP', (done) => {
      // Load users first so the user exists in the BehaviorSubject
      service.getUsers().subscribe(() => {
        service.removeUser('user-002').subscribe(result => {
          expect(result).toBe(true);
          done();
        });

        const deleteReq = httpMock.expectOne('/users/user-002');
        expect(deleteReq.request.method).toBe('DELETE');
        deleteReq.flush(null);
      });

      const getReq = httpMock.expectOne('/users');
      getReq.flush(mockBackendUsers);
    });

    it('should prevent removing owner', (done) => {
      // Load users first
      service.getUsers().subscribe(() => {
        service.removeUser('user-001').subscribe({
          next: () => fail('Should have thrown error'),
          error: (error) => {
            expect(error.message).toBe('Cannot remove owner');
            done();
          }
        });
      });

      const getReq = httpMock.expectOne('/users');
      getReq.flush(mockBackendUsers);
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
