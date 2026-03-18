import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FeatureLockComponent } from './feature-lock.component';
import { ModuleService } from '../../../core/services/module.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { By } from '@angular/platform-browser';

describe('FeatureLockComponent', () => {
  let component: FeatureLockComponent;
  let fixture: ComponentFixture<FeatureLockComponent>;
  let mockModuleService: jasmine.SpyObj<ModuleService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const moduleServiceSpy = jasmine.createSpyObj('ModuleService', [
      'hasModuleAccess'
    ]);

    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [FeatureLockComponent],
      providers: [
        { provide: ModuleService, useValue: moduleServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: TranslatePipe, useValue: { transform: (key: string) => key } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureLockComponent);
    component = fixture.componentInstance;
    mockModuleService = TestBed.inject(ModuleService) as jasmine.SpyObj<ModuleService>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  describe('Component Creation', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should have default configuration', () => {
      expect(component.config).toEqual({ feature: '', showUpgradeButton: true });
      expect(component.feature).toBe('');
      expect(component.showUpgradeButton).toBe(true);
      expect(component.shouldShowOverlay()).toBe(true);
    });
  });

  describe('Feature Checking', () => {
    it('should identify locked feature when module access is denied', () => {
      mockModuleService.hasModuleAccess.and.returnValue(false);
      component.moduleId = 'inventory';

      fixture.detectChanges();

      expect(component.isLocked()).toBe(true);
    });

    it('should identify unlocked feature when module access is granted', () => {
      mockModuleService.hasModuleAccess.and.returnValue(true);
      component.moduleId = 'dashboard';

      fixture.detectChanges();

      expect(component.isLocked()).toBe(false);
    });

    it('should handle missing moduleId', () => {
      component.moduleId = undefined;

      fixture.detectChanges();

      expect(component.isLocked()).toBe(false);
    });
  });

  describe('Template Rendering', () => {
    it('should show content when module is accessible', () => {
      mockModuleService.hasModuleAccess.and.returnValue(true);
      component.moduleId = 'dashboard';

      fixture.detectChanges();

      const overlay = fixture.debugElement.query(By.css('.feature-lock-overlay'));
      expect(overlay).toBeFalsy();
    });

    it('should show lock overlay when module is not accessible', () => {
      mockModuleService.hasModuleAccess.and.returnValue(false);
      component.moduleId = 'inventory';
      component.showOverlayInput = true;

      fixture.detectChanges();

      const overlay = fixture.debugElement.query(By.css('.feature-lock-overlay'));
      expect(overlay).toBeTruthy();
    });

    it('should show lock icon in overlay', () => {
      mockModuleService.hasModuleAccess.and.returnValue(false);
      component.moduleId = 'inventory';
      component.showOverlayInput = true;

      fixture.detectChanges();

      const lockIcon = fixture.debugElement.query(By.css('.lock-icon svg'));
      expect(lockIcon).toBeTruthy();
    });

    it('should show upgrade button when configured', () => {
      mockModuleService.hasModuleAccess.and.returnValue(false);
      component.moduleId = 'inventory';
      component.showUpgradeButton = true;
      component.showOverlayInput = true;

      fixture.detectChanges();

      const upgradeButton = fixture.debugElement.query(By.css('.upgrade-cta'));
      expect(upgradeButton).toBeTruthy();
    });

    it('should hide upgrade button when configured', () => {
      mockModuleService.hasModuleAccess.and.returnValue(false);
      component.moduleId = 'inventory';
      component.config = { feature: 'inventory_management', showUpgradeButton: false };
      component.showOverlayInput = true;

      fixture.detectChanges();

      const upgradeButton = fixture.debugElement.query(By.css('.upgrade-cta'));
      expect(upgradeButton).toBeFalsy();
    });
  });

  describe('Lock Messages', () => {
    it('should return custom message when provided', () => {
      component.customMessage = 'Custom lock message';

      const message = component.getLockMessage();

      expect(message).toBe('Custom lock message');
    });

    it('should return config custom message when provided', () => {
      component.config = { feature: 'test', customMessage: 'Config custom message' };

      const message = component.getLockMessage();

      expect(message).toBe('Config custom message');
    });

    it('should return module-specific message when moduleId is set', () => {
      component.moduleId = 'inventory';

      const message = component.getLockMessage();

      expect(message).toBe('modules.featureLockedWithModule');
    });

    it('should return generic message when no moduleId is specified', () => {
      component.moduleId = undefined;

      const message = component.getLockMessage();

      expect(message).toBe('modules.featureLocked');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for overlay', () => {
      mockModuleService.hasModuleAccess.and.returnValue(false);
      component.moduleId = 'inventory';
      component.title = 'Inventory Management';
      component.showOverlayInput = true;

      fixture.detectChanges();

      const overlay = fixture.debugElement.query(By.css('.feature-lock-overlay'));
      expect(overlay.attributes['role']).toBe('dialog');
      expect(overlay.attributes['aria-modal']).toBe('true');
      expect(overlay.attributes['aria-label']).toContain('Inventory Management');
    });

    it('should have proper ARIA label for upgrade button', () => {
      mockModuleService.hasModuleAccess.and.returnValue(false);
      component.moduleId = 'inventory';
      component.showOverlayInput = true;

      fixture.detectChanges();

      const upgradeButton = fixture.debugElement.query(By.css('.upgrade-cta'));
      expect(upgradeButton.attributes['aria-label']).toContain('Inventory');
    });

    it('should be focusable', () => {
      mockModuleService.hasModuleAccess.and.returnValue(false);
      component.moduleId = 'inventory';
      component.showOverlayInput = true;

      fixture.detectChanges();

      const overlay = fixture.debugElement.query(By.css('.feature-lock-overlay'));
      expect(overlay.attributes['tabindex']).toBe('0');
    });
  });

  describe('Event Handling', () => {
    it('should emit upgrade event when button is clicked', () => {
      mockModuleService.hasModuleAccess.and.returnValue(false);
      component.moduleId = 'inventory';
      component.feature = 'inventory_management';
      component.showOverlayInput = true;

      spyOn(component.upgradeClicked, 'emit');

      fixture.detectChanges();

      const upgradeButton = fixture.debugElement.query(By.css('.upgrade-cta'));
      upgradeButton.triggerEventHandler('click', null);

      expect(component.upgradeClicked.emit).toHaveBeenCalledWith({
        feature: 'inventory_management',
        moduleId: 'inventory'
      });
    });

    it('should navigate to /modules when upgrade is clicked', () => {
      mockModuleService.hasModuleAccess.and.returnValue(false);
      component.moduleId = 'inventory';
      component.showOverlayInput = true;

      fixture.detectChanges();

      const upgradeButton = fixture.debugElement.query(By.css('.upgrade-cta'));
      upgradeButton.triggerEventHandler('click', null);

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/modules']);
    });
  });

  describe('Configuration Handling', () => {
    it('should use config feature over direct feature input', () => {
      component.config = { feature: 'config_feature' };
      component.feature = 'direct_feature';

      const featureKey = component['getFeatureKey']();

      expect(featureKey).toBe('config_feature');
    });

    it('should use config moduleId over direct moduleId input', () => {
      component.config = { feature: 'test', moduleId: 'calendar' };
      component.moduleId = 'inventory';

      const moduleId = component['getModuleId']();

      expect(moduleId).toBe('calendar');
    });
  });

  describe('Programmatic Methods', () => {
    it('should return true for feature access when module is active', () => {
      mockModuleService.hasModuleAccess.and.returnValue(true);
      component.moduleId = 'dashboard';

      const hasAccess = component.hasFeatureAccess();

      expect(hasAccess).toBe(true);
      expect(mockModuleService.hasModuleAccess).toHaveBeenCalledWith('dashboard');
    });

    it('should return false for feature access when module is inactive', () => {
      mockModuleService.hasModuleAccess.and.returnValue(false);
      component.moduleId = 'inventory';

      const hasAccess = component.hasFeatureAccess();

      expect(hasAccess).toBe(false);
    });

    it('should return module info', () => {
      component.moduleId = 'inventory';

      const moduleInfo = component.getModuleInfo();

      expect(moduleInfo.moduleId).toBe('inventory');
      expect(moduleInfo.name).toBe('Inventory');
    });

    it('should handle missing moduleId gracefully', () => {
      component.moduleId = undefined;

      const hasAccess = component.hasFeatureAccess();

      expect(hasAccess).toBe(true);
    });
  });

  describe('CSS Classes', () => {
    it('should apply feature-locked class when module is locked', () => {
      mockModuleService.hasModuleAccess.and.returnValue(false);
      component.moduleId = 'inventory';

      fixture.detectChanges();

      const container = fixture.debugElement.query(By.css('.feature-container'));
      expect(container.classes['feature-locked']).toBe(true);
    });

    it('should not apply feature-locked class when module is accessible', () => {
      mockModuleService.hasModuleAccess.and.returnValue(true);
      component.moduleId = 'dashboard';

      fixture.detectChanges();

      const container = fixture.debugElement.query(By.css('.feature-container'));
      expect(container.classes['feature-locked']).toBeFalsy();
    });
  });
});
