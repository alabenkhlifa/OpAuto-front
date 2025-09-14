import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { UsersComponent } from './users.component';
import { UserService } from '../../core/services/user.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { User, UserStats, UserLimits } from '../../core/models/user.model';

describe('UsersComponent', () => {
  let component: UsersComponent;
  let fixture: ComponentFixture<UsersComponent>;
  let mockUserService: jasmine.SpyObj<UserService>;
  let mockSubscriptionService: jasmine.SpyObj<SubscriptionService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const mockUsers: User[] = [
    {
      id: 'user-001',
      email: 'owner@test.com',
      firstName: 'Owner',
      lastName: 'User',
      fullName: 'Owner User',
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
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
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
      fullName: 'Admin User',
      role: 'admin',
      status: 'active',
      joinedAt: new Date(),
      lastActiveAt: new Date(),
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

  const mockStats: UserStats = {
    totalUsers: 2,
    activeUsers: 2,
    pendingUsers: 1,
    roleDistribution: {
      owner: 1,
      admin: 1,
      mechanic: 0,
      viewer: 0
    },
    recentJoins: [],
    tierInfo: {
      current: {
        id: 'starter',
        name: 'Starter',
        price: 79,
        currency: 'TND',
        limits: { users: 5, cars: 200, serviceBays: 5 },
        features: []
      },
      limits: {
        current: 2,
        limit: 5,
        canAddUser: true,
        nextTier: {
          id: 'professional',
          name: 'Professional',
          price: 149,
          currency: 'TND',
          limits: { users: null, cars: null, serviceBays: null },
          features: []
        }
      }
    }
  };

  const mockLimits: UserLimits = {
    current: 2,
    limit: 5,
    canAddUser: true,
    nextTier: {
      id: 'professional',
      name: 'Professional',
      price: 149,
      currency: 'TND',
      limits: { users: null, cars: null, serviceBays: null },
      features: []
    }
  };

  beforeEach(async () => {
    const userSpy = jasmine.createSpyObj('UserService', [
      'getUsers',
      'getCurrentUser',
      'getUserStats',
      'getUserLimits',
      'inviteUser',
      'updateUserRole',
      'updateUserStatus',
      'removeUser',
      'resendInvitation',
      'cancelInvitation'
    ]);
    
    const subscriptionSpy = jasmine.createSpyObj('SubscriptionService', [
      'getTierComparison',
      'upgradeTo'
    ]);
    
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [UsersComponent],
      providers: [
        { provide: UserService, useValue: userSpy },
        { provide: SubscriptionService, useValue: subscriptionSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    mockUserService = TestBed.inject(UserService) as jasmine.SpyObj<UserService>;
    mockSubscriptionService = TestBed.inject(SubscriptionService) as jasmine.SpyObj<SubscriptionService>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    // Setup default mock returns
    mockUserService.getUsers.and.returnValue(of(mockUsers));
    mockUserService.getCurrentUser.and.returnValue(of(mockUsers[0]));
    mockUserService.getUserStats.and.returnValue(of(mockStats));
    mockUserService.getUserLimits.and.returnValue(of(mockLimits));
    (mockUserService as any).invitations$ = of([]);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load data on init', () => {
    component.ngOnInit();
    
    expect(mockUserService.getUsers).toHaveBeenCalled();
    expect(mockUserService.getCurrentUser).toHaveBeenCalled();
    expect(mockUserService.getUserStats).toHaveBeenCalled();
    expect(mockUserService.getUserLimits).toHaveBeenCalled();
  });

  it('should set users signal when data is loaded', () => {
    component.ngOnInit();
    
    expect(component.users()).toEqual(mockUsers);
    expect(component.stats()).toEqual(mockStats);
    expect(component.userLimits()).toEqual(mockLimits);
  });

  describe('User filtering', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should filter users by search term', () => {
      component.onSearchChange('Owner');
      
      const filtered = component.filteredUsers();
      expect(filtered.length).toBe(1);
      expect(filtered[0].fullName).toContain('Owner');
    });

    it('should return all users when search term is empty', () => {
      component.onSearchChange('');
      
      const filtered = component.filteredUsers();
      expect(filtered.length).toBe(mockUsers.length);
    });

    it('should filter by email', () => {
      component.onSearchChange('admin@test.com');
      
      const filtered = component.filteredUsers();
      expect(filtered.length).toBe(1);
      expect(filtered[0].email).toBe('admin@test.com');
    });
  });

  describe('User invitation', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should open invite modal when user can add users', () => {
      spyOn(component.showInviteModal, 'set');
      
      component.openInviteModal();
      
      expect(component.showInviteModal.set).toHaveBeenCalledWith(true);
    });

    it('should show upgrade prompt when user limit reached', () => {
      // Mock limit reached scenario
      const limitReachedLimits: UserLimits = {
        current: 5,
        limit: 5,
        canAddUser: false,
        nextTier: mockLimits.nextTier
      };
      
      component.userLimits.set(limitReachedLimits);
      spyOn(component, 'showUpgradePrompt');
      
      component.openInviteModal();
      
      expect(component.showUpgradePrompt).toHaveBeenCalled();
    });

    it('should invite user successfully', () => {
      const inviteRequest = {
        email: 'newuser@test.com',
        role: 'mechanic' as const,
        firstName: 'New',
        lastName: 'User'
      };
      
      mockUserService.inviteUser.and.returnValue(of({
        id: 'inv-001',
        email: inviteRequest.email,
        role: inviteRequest.role,
        invitedBy: 'user-001',
        invitedAt: new Date(),
        expiresAt: new Date(),
        status: 'pending',
        token: 'mock-token'
      }));
      
      spyOn(component.showInviteModal, 'set');
      
      component.inviteUser(inviteRequest);
      
      expect(mockUserService.inviteUser).toHaveBeenCalledWith(inviteRequest);
      expect(component.showInviteModal.set).toHaveBeenCalledWith(false);
    });

    it('should handle invitation error when limit exceeded', () => {
      const inviteRequest = {
        email: 'newuser@test.com',
        role: 'mechanic' as const
      };
      
      mockUserService.inviteUser.and.returnValue(
        throwError(() => new Error('User limit reached for current tier'))
      );
      
      spyOn(component, 'showUpgradePrompt');
      
      component.inviteUser(inviteRequest);
      
      expect(component.showUpgradePrompt).toHaveBeenCalled();
    });
  });

  describe('User management', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should update user role', () => {
      mockUserService.updateUserRole.and.returnValue(of({
        ...mockUsers[1],
        role: 'mechanic'
      }));
      
      spyOn(component, 'loadData' as any);
      
      component.updateUserRole('user-002', 'mechanic');
      
      expect(mockUserService.updateUserRole).toHaveBeenCalledWith('user-002', 'mechanic');
      expect(component['loadData']).toHaveBeenCalled();
    });

    it('should update user status', () => {
      mockUserService.updateUserStatus.and.returnValue(of({
        ...mockUsers[1],
        status: 'inactive'
      }));
      
      spyOn(component, 'loadData' as any);
      
      component.updateUserStatus('user-002', 'inactive');
      
      expect(mockUserService.updateUserStatus).toHaveBeenCalledWith('user-002', 'inactive');
      expect(component['loadData']).toHaveBeenCalled();
    });

    it('should remove user with confirmation', () => {
      mockUserService.removeUser.and.returnValue(of(true));
      spyOn(window, 'confirm').and.returnValue(true);
      spyOn(component, 'loadData' as any);
      
      component.removeUser('user-002');
      
      expect(window.confirm).toHaveBeenCalled();
      expect(mockUserService.removeUser).toHaveBeenCalledWith('user-002');
      expect(component['loadData']).toHaveBeenCalled();
    });

    it('should not remove user if not confirmed', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      
      component.removeUser('user-002');
      
      expect(mockUserService.removeUser).not.toHaveBeenCalled();
    });
  });

  describe('Upgrade flow', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should show upgrade prompt with tier comparison', () => {
      const mockComparison = {
        tiers: [
          mockStats.tierInfo.current,
          mockLimits.nextTier!
        ],
        currentTierId: 'starter' as const,
        recommendedTierId: 'professional' as const
      };
      
      mockSubscriptionService.getTierComparison.and.returnValue(of(mockComparison));
      spyOn(component.showUpgradeModal, 'set');
      spyOn(component.upgradePromptData, 'set');
      
      component.showUpgradePrompt();
      
      expect(mockSubscriptionService.getTierComparison).toHaveBeenCalled();
      expect(component.showUpgradeModal.set).toHaveBeenCalledWith(true);
      expect(component.upgradePromptData.set).toHaveBeenCalled();
    });

    it('should handle upgrade successfully', () => {
      mockSubscriptionService.upgradeTo.and.returnValue(of(true));
      spyOn(component.showUpgradeModal, 'set');
      spyOn(component, 'loadData' as any);
      
      component.handleUpgrade('professional');
      
      expect(mockSubscriptionService.upgradeTo).toHaveBeenCalledWith('professional');
      expect(component.showUpgradeModal.set).toHaveBeenCalledWith(false);
      expect(component['loadData']).toHaveBeenCalled();
    });
  });

  describe('Invitation management', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should resend invitation', () => {
      mockUserService.resendInvitation.and.returnValue(of({
        id: 'inv-001',
        email: 'test@test.com',
        role: 'mechanic',
        invitedBy: 'user-001',
        invitedAt: new Date(),
        expiresAt: new Date(),
        status: 'pending',
        token: 'new-token'
      }));
      
      spyOn(component, 'loadData' as any);
      
      component.resendInvitation('inv-001');
      
      expect(mockUserService.resendInvitation).toHaveBeenCalledWith('inv-001');
      expect(component['loadData']).toHaveBeenCalled();
    });

    it('should cancel invitation', () => {
      mockUserService.cancelInvitation.and.returnValue(of(true));
      spyOn(component, 'loadData' as any);
      
      component.cancelInvitation('inv-001');
      
      expect(mockUserService.cancelInvitation).toHaveBeenCalledWith('inv-001');
      expect(component['loadData']).toHaveBeenCalled();
    });
  });

  it('should calculate upgrade benefits correctly', () => {
    const benefits = component['getUpgradeBenefits']('starter', 'professional');
    
    expect(benefits).toContain('Unlimited team members');
    expect(benefits).toContain('Team collaboration tools');
    expect(benefits).toContain('API access');
  });
});