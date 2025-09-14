import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { FeatureGateDirective } from './feature-gate.directive';
import { SubscriptionService } from '../../core/services/subscription.service';

@Component({
  template: `
    <!-- Test template for hide mode -->
    <div id="hideTest" *featureGate="'photo_upload'">
      Feature content
    </div>

    <!-- Test template for disable mode -->
    <button id="disableTest" 
            *featureGate="'sms_notifications'; mode: 'disable'" 
            type="button">
      Send SMS
    </button>

    <!-- Test template for show mode with context -->
    <div id="showTest" 
         *featureGate="'api_access'; mode: 'show'; let enabled; let locked = isLocked">
      <span *ngIf="enabled">API is enabled</span>
      <span *ngIf="locked">API is locked</span>
    </div>

    <!-- Test template with else clause -->
    <div id="elseTest" 
         *featureGate="'team_collaboration'; else: lockedTemplate">
      Team features available
    </div>
    <ng-template #lockedTemplate>
      <div id="lockedContent">Team features locked</div>
    </ng-template>

    <!-- Test template with then clause -->
    <div id="thenTest" 
         *featureGate="'basic_inventory'; then: enabledTemplate; else: disabledTemplate">
    </div>
    <ng-template #enabledTemplate>
      <div id="enabledContent">Inventory enabled</div>
    </ng-template>
    <ng-template #disabledTemplate>
      <div id="disabledContent">Inventory disabled</div>
    </ng-template>
  `
})
class TestComponent {}

describe('FeatureGateDirective', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;
  let mockSubscriptionService: jasmine.SpyObj<SubscriptionService>;

  beforeEach(async () => {
    const subscriptionServiceSpy = jasmine.createSpyObj('SubscriptionService', [
      'hasFeature',
      'getUpgradeTierForFeature'
    ]);

    await TestBed.configureTestingModule({
      imports: [FeatureGateDirective],
      declarations: [TestComponent],
      providers: [
        { provide: SubscriptionService, useValue: subscriptionServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    mockSubscriptionService = TestBed.inject(SubscriptionService) as jasmine.SpyObj<SubscriptionService>;
  });

  describe('Hide Mode (Default)', () => {
    it('should show content when feature is enabled', () => {
      mockSubscriptionService.hasFeature.and.returnValue(of(true));
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue(null);

      fixture.detectChanges();

      const element = fixture.debugElement.query(By.css('#hideTest'));
      expect(element).toBeTruthy();
      expect(element.nativeElement.textContent.trim()).toBe('Feature content');
    });

    it('should hide content when feature is disabled', () => {
      mockSubscriptionService.hasFeature.and.returnValue(of(false));
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');

      fixture.detectChanges();

      const element = fixture.debugElement.query(By.css('#hideTest'));
      expect(element).toBeFalsy();
    });

    it('should show else template when feature is disabled', () => {
      mockSubscriptionService.hasFeature.and.callFake((feature: string) => {
        return feature === 'team_collaboration' ? of(false) : of(true);
      });
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');

      fixture.detectChanges();

      const mainContent = fixture.debugElement.query(By.css('#elseTest'));
      const lockedContent = fixture.debugElement.query(By.css('#lockedContent'));

      expect(mainContent).toBeFalsy();
      expect(lockedContent).toBeTruthy();
      expect(lockedContent.nativeElement.textContent.trim()).toBe('Team features locked');
    });

    it('should show then template when feature is enabled', () => {
      mockSubscriptionService.hasFeature.and.callFake((feature: string) => {
        return feature === 'basic_inventory' ? of(true) : of(false);
      });
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue(null);

      fixture.detectChanges();

      const enabledContent = fixture.debugElement.query(By.css('#enabledContent'));
      const disabledContent = fixture.debugElement.query(By.css('#disabledContent'));

      expect(enabledContent).toBeTruthy();
      expect(disabledContent).toBeFalsy();
      expect(enabledContent.nativeElement.textContent.trim()).toBe('Inventory enabled');
    });
  });

  describe('Disable Mode', () => {
    it('should show enabled element when feature is enabled', () => {
      mockSubscriptionService.hasFeature.and.callFake((feature: string) => {
        return feature === 'sms_notifications' ? of(true) : of(false);
      });
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue(null);

      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('#disableTest'));
      expect(button).toBeTruthy();
      expect(button.nativeElement.disabled).toBe(false);
      expect(button.nativeElement.classList.contains('feature-locked')).toBe(false);
    });

    it('should show disabled element when feature is locked', () => {
      mockSubscriptionService.hasFeature.and.callFake((feature: string) => {
        return feature === 'sms_notifications' ? of(false) : of(true);
      });
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');

      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('#disableTest'));
      expect(button).toBeTruthy();
      expect(button.nativeElement.disabled).toBe(true);
      expect(button.nativeElement.classList.contains('feature-locked')).toBe(true);
      expect(button.nativeElement.getAttribute('aria-disabled')).toBe('true');
    });

    it('should add accessibility attributes when disabled', () => {
      mockSubscriptionService.hasFeature.and.callFake((feature: string) => {
        return feature === 'sms_notifications' ? of(false) : of(true);
      });
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');

      fixture.detectChanges();

      const button = fixture.debugElement.query(By.css('#disableTest'));
      const ariaLabel = button.nativeElement.getAttribute('aria-label');

      expect(ariaLabel).toContain('Feature locked');
      expect(ariaLabel).toContain('professional');
    });
  });

  describe('Show Mode', () => {
    it('should always show content and provide context variables', () => {
      mockSubscriptionService.hasFeature.and.callFake((feature: string) => {
        return feature === 'api_access' ? of(true) : of(false);
      });
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue(null);

      fixture.detectChanges();

      const container = fixture.debugElement.query(By.css('#showTest'));
      expect(container).toBeTruthy();
      
      // Should show "API is enabled" since the feature is enabled
      expect(container.nativeElement.textContent).toContain('API is enabled');
      expect(container.nativeElement.textContent).not.toContain('API is locked');
    });

    it('should provide correct context when feature is locked', () => {
      mockSubscriptionService.hasFeature.and.callFake((feature: string) => {
        return feature === 'api_access' ? of(false) : of(true);
      });
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');

      fixture.detectChanges();

      const container = fixture.debugElement.query(By.css('#showTest'));
      expect(container).toBeTruthy();
      
      // Should show "API is locked" since the feature is locked
      expect(container.nativeElement.textContent).not.toContain('API is enabled');
      expect(container.nativeElement.textContent).toContain('API is locked');
    });
  });

  describe('Event Emission', () => {
    it('should emit blocked event when feature is locked', () => {
      let blockedEvent: any = null;
      
      // Get directive instance
      const directiveElements = fixture.debugElement.queryAll(By.directive(FeatureGateDirective));
      const hideTestDirective = directiveElements.find(el => 
        el.nativeElement.id === 'hideTest' || el.parent?.nativeElement.id === 'hideTest'
      );

      if (hideTestDirective) {
        const directive = hideTestDirective.injector.get(FeatureGateDirective);
        directive.blocked.subscribe(event => blockedEvent = event);
      }

      mockSubscriptionService.hasFeature.and.returnValue(of(false));
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('professional');

      fixture.detectChanges();

      expect(blockedEvent).toBeTruthy();
      expect(blockedEvent.feature).toBe('photo_upload');
      expect(blockedEvent.requiredTier).toBe('professional');
    });

    it('should not emit blocked event when feature is enabled', () => {
      let blockedEvent: any = null;
      
      // Get directive instance
      const directiveElements = fixture.debugElement.queryAll(By.directive(FeatureGateDirective));
      const hideTestDirective = directiveElements.find(el => 
        el.nativeElement.id === 'hideTest' || el.parent?.nativeElement.id === 'hideTest'
      );

      if (hideTestDirective) {
        const directive = hideTestDirective.injector.get(FeatureGateDirective);
        directive.blocked.subscribe(event => blockedEvent = event);
      }

      mockSubscriptionService.hasFeature.and.returnValue(of(true));
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue(null);

      fixture.detectChanges();

      expect(blockedEvent).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing feature input', () => {
      // Create a component with missing feature
      const emptyFixture = TestBed.createComponent(TestComponent);
      spyOn(console, 'warn');

      // Manually create directive with empty feature
      const directive = new FeatureGateDirective(
        emptyFixture.debugElement.query(By.css('div'))?.injector.get(TestBed.inject) as any,
        emptyFixture.debugElement.query(By.css('div'))?.injector.get(TestBed.inject) as any,
        mockSubscriptionService,
        emptyFixture.debugElement.query(By.css('div'))?.nativeElement,
        emptyFixture.debugElement.query(By.css('div'))?.injector.get(TestBed.inject) as any
      );

      directive.feature = '';
      directive.ngOnInit();

      expect(console.warn).toHaveBeenCalledWith('FeatureGateDirective: feature input is required');
    });
  });

  describe('Context Variables', () => {
    it('should provide correct context properties', () => {
      mockSubscriptionService.hasFeature.and.returnValue(of(false));
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue('starter');

      fixture.detectChanges();

      const directiveElements = fixture.debugElement.queryAll(By.directive(FeatureGateDirective));
      const showTestDirective = directiveElements.find(el => 
        el.nativeElement.id === 'showTest' || el.parent?.nativeElement.id === 'showTest'
      );

      if (showTestDirective) {
        const directive = showTestDirective.injector.get(FeatureGateDirective);
        const context = directive['context'];

        expect(context.$implicit).toBe(false);
        expect(context.isLocked).toBe(true);
        expect(context.requiredTier).toBe('starter');
        expect(context.canUpgrade).toBe(true);
      }
    });

    it('should handle null required tier', () => {
      mockSubscriptionService.hasFeature.and.returnValue(of(true));
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue(null);

      fixture.detectChanges();

      const directiveElements = fixture.debugElement.queryAll(By.directive(FeatureGateDirective));
      const showTestDirective = directiveElements.find(el => 
        el.nativeElement.id === 'showTest' || el.parent?.nativeElement.id === 'showTest'
      );

      if (showTestDirective) {
        const directive = showTestDirective.injector.get(FeatureGateDirective);
        const context = directive['context'];

        expect(context.$implicit).toBe(true);
        expect(context.isLocked).toBe(false);
        expect(context.requiredTier).toBeNull();
        expect(context.canUpgrade).toBe(false);
      }
    });
  });

  describe('Static Methods', () => {
    it('should provide static feature checking method', async () => {
      mockSubscriptionService.hasFeature.and.returnValue(of(true));
      mockSubscriptionService.getUpgradeTierForFeature.and.returnValue(null);

      const result = await FeatureGateDirective.checkFeature('test_feature', mockSubscriptionService);

      expect(result.$implicit).toBe(true);
      expect(result.isLocked).toBe(false);
      expect(result.requiredTier).toBeNull();
      expect(result.canUpgrade).toBe(false);
    });
  });
});