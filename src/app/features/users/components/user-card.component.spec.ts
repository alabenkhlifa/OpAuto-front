import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserCardComponent } from './user-card.component';
import { User } from '../../../core/models/user.model';

describe('UserCardComponent', () => {
  let component: UserCardComponent;
  let fixture: ComponentFixture<UserCardComponent>;

  const mockUser: User = {
    id: 'user-001',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    role: 'admin',
    status: 'active',
    joinedAt: new Date('2024-01-01'),
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
  };

  const mockOwner: User = {
    ...mockUser,
    id: 'owner-001',
    role: 'owner',
    permissions: {
      canManageUsers: true,
      canManageSettings: true,
      canViewReports: true,
      canManageInventory: true,
      canManageAppointments: true,
      canManageInvoices: true,
      canManageMaintenance: true
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(UserCardComponent);
    component = fixture.componentInstance;
    component.user = mockUser;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('canManageUser', () => {
    it('should return false when current user is null', () => {
      component.currentUser = null;
      expect(component.canManageUser()).toBe(false);
    });

    it('should return false when user is owner', () => {
      component.user = mockOwner;
      component.currentUser = mockOwner;
      expect(component.canManageUser()).toBe(false);
    });

    it('should return true when current user is owner and target is not owner', () => {
      component.currentUser = mockOwner;
      component.user = mockUser;
      expect(component.canManageUser()).toBe(true);
    });

    it('should return true when current user is admin', () => {
      component.currentUser = { ...mockUser, role: 'admin' };
      component.user = { ...mockUser, id: 'user-002', role: 'mechanic' };
      expect(component.canManageUser()).toBe(true);
    });

    it('should return false when current user is mechanic', () => {
      component.currentUser = { ...mockUser, role: 'mechanic' };
      component.user = { ...mockUser, id: 'user-002', role: 'viewer' };
      expect(component.canManageUser()).toBe(false);
    });
  });

  describe('getRoleBadgeClass', () => {
    it('should return primary for owner role', () => {
      expect(component.getRoleBadgeClass('owner')).toBe('primary');
    });

    it('should return success for admin role', () => {
      expect(component.getRoleBadgeClass('admin')).toBe('success');
    });

    it('should return info for mechanic role', () => {
      expect(component.getRoleBadgeClass('mechanic')).toBe('info');
    });

    it('should return secondary for viewer role', () => {
      expect(component.getRoleBadgeClass('viewer')).toBe('secondary');
    });

    it('should return secondary for unknown role', () => {
      expect(component.getRoleBadgeClass('unknown' as any)).toBe('secondary');
    });
  });

  describe('getStatusBadgeClass', () => {
    it('should return success for active status', () => {
      expect(component.getStatusBadgeClass('active')).toBe('success');
    });

    it('should return warning for pending status', () => {
      expect(component.getStatusBadgeClass('pending')).toBe('warning');
    });

    it('should return secondary for inactive status', () => {
      expect(component.getStatusBadgeClass('inactive')).toBe('secondary');
    });

    it('should return danger for suspended status', () => {
      expect(component.getStatusBadgeClass('suspended')).toBe('danger');
    });
  });

  describe('getActivePermissions', () => {
    it('should return list of active permissions', () => {
      const permissions = component.getActivePermissions();
      
      expect(permissions).toContain('manageUsers');
      expect(permissions).toContain('viewReports');
      expect(permissions).toContain('manageInventory');
      expect(permissions).toContain('manageAppointments');
      expect(permissions.length).toBeLessThanOrEqual(4); // Limited to 4 for space
    });

    it('should return empty array for viewer with no permissions', () => {
      component.user = {
        ...mockUser,
        role: 'viewer',
        permissions: {
          canManageUsers: false,
          canManageSettings: false,
          canViewReports: false,
          canManageInventory: false,
          canManageAppointments: false,
          canManageInvoices: false,
          canManageMaintenance: false
        }
      };
      
      const permissions = component.getActivePermissions();
      expect(permissions.length).toBe(0);
    });
  });

  describe('role change', () => {
    it('should emit role change event', () => {
      spyOn(component.updateRole, 'emit');
      spyOn(component.showActions, 'set');
      
      component.changeRole('mechanic');
      
      expect(component.updateRole.emit).toHaveBeenCalledWith({
        userId: mockUser.id,
        role: 'mechanic'
      });
      expect(component.showActions.set).toHaveBeenCalledWith(false);
    });
  });

  describe('status change', () => {
    it('should emit status change event', () => {
      spyOn(component.updateStatus, 'emit');
      spyOn(component.showActions, 'set');
      
      component.changeStatus('inactive');
      
      expect(component.updateStatus.emit).toHaveBeenCalledWith({
        userId: mockUser.id,
        status: 'inactive'
      });
      expect(component.showActions.set).toHaveBeenCalledWith(false);
    });
  });

  describe('user removal', () => {
    it('should emit remove event when confirmed', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      spyOn(component.removeUser, 'emit');
      spyOn(component.showActions, 'set');
      
      component.confirmRemoveUser();
      
      expect(window.confirm).toHaveBeenCalledWith(`Are you sure you want to remove ${mockUser.fullName} from your team?`);
      expect(component.removeUser.emit).toHaveBeenCalledWith(mockUser.id);
      expect(component.showActions.set).toHaveBeenCalledWith(false);
    });

    it('should not emit remove event when not confirmed', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      spyOn(component.removeUser, 'emit');
      spyOn(component.showActions, 'set');
      
      component.confirmRemoveUser();
      
      expect(component.removeUser.emit).not.toHaveBeenCalled();
      expect(component.showActions.set).toHaveBeenCalledWith(false);
    });
  });

  describe('template rendering', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should display user information', () => {
      const compiled = fixture.nativeElement;
      
      expect(compiled.textContent).toContain(mockUser.fullName);
      expect(compiled.textContent).toContain(mockUser.email);
    });

    it('should show user initials when no avatar', () => {
      const compiled = fixture.nativeElement;
      const initialsElement = compiled.querySelector('.text-white.text-sm.font-medium');
      
      expect(initialsElement.textContent.trim()).toBe('JD'); // John Doe initials
    });

    it('should display role and status badges', () => {
      const compiled = fixture.nativeElement;
      const badges = compiled.querySelectorAll('.badge');
      
      expect(badges.length).toBeGreaterThanOrEqual(2); // Role and status badges
    });
  });
});