import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TooltipDirective } from './tooltip.directive';
import { LanguageService } from '../../core/services/language.service';

@Component({
  standalone: true,
  imports: [TooltipDirective],
  template: `
    <!-- Basic tooltip -->
    <button id="basicTooltip" appTooltip="Save your changes">
      Save
    </button>

    <!-- Tooltip with position -->
    <button id="topTooltip" appTooltip="Top tooltip" tooltipPosition="top">
      Top
    </button>
    <button id="bottomTooltip" appTooltip="Bottom tooltip" tooltipPosition="bottom">
      Bottom
    </button>
    <button id="leftTooltip" appTooltip="Left tooltip" tooltipPosition="left">
      Left
    </button>
    <button id="rightTooltip" appTooltip="Right tooltip" tooltipPosition="right">
      Right
    </button>

    <!-- Tooltip with custom delay -->
    <button id="delayedTooltip" appTooltip="Delayed tooltip" [tooltipDelay]="500">
      Delayed
    </button>

    <!-- Empty tooltip -->
    <button id="emptyTooltip" [appTooltip]="''">
      Empty
    </button>

    <!-- Null tooltip -->
    <button id="nullTooltip" [appTooltip]="null">
      Null
    </button>
  `
})
class TestComponent {}

describe('TooltipDirective', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;
  let mockLanguageService: jasmine.SpyObj<LanguageService>;

  beforeEach(async () => {
    const languageServiceSpy = jasmine.createSpyObj('LanguageService', [
      'isRTL'
    ]);

    await TestBed.configureTestingModule({
      imports: [TestComponent],
      providers: [
        { provide: LanguageService, useValue: languageServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    mockLanguageService = TestBed.inject(LanguageService) as jasmine.SpyObj<LanguageService>;
    mockLanguageService.isRTL.and.returnValue(false);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Clean up any tooltips that might be left behind
    const tooltips = document.querySelectorAll('.tooltip-container');
    tooltips.forEach(tooltip => tooltip.remove());
  });

  describe('Basic Functionality', () => {
    it('should create tooltip on mouse enter', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#basicTooltip'));
      const buttonElement = button.nativeElement;

      // Trigger mouse enter
      buttonElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300); // Default delay

      // Check if tooltip is created
      const tooltip = document.querySelector('.tooltip-container');
      expect(tooltip).toBeTruthy();
      expect(tooltip?.textContent).toBe('Save your changes');
    }));

    it('should remove tooltip on mouse leave', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#basicTooltip'));
      const buttonElement = button.nativeElement;

      // Show tooltip
      buttonElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      let tooltip = document.querySelector('.tooltip-container');
      expect(tooltip).toBeTruthy();

      // Hide tooltip
      buttonElement.dispatchEvent(new MouseEvent('mouseleave'));
      tick(10);

      tooltip = document.querySelector('.tooltip-container');
      expect(tooltip).toBeFalsy();
    }));

    it('should hide tooltip on click', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#basicTooltip'));
      const buttonElement = button.nativeElement;

      // Show tooltip
      buttonElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      let tooltip = document.querySelector('.tooltip-container');
      expect(tooltip).toBeTruthy();

      // Click element
      buttonElement.click();
      tick(10);

      tooltip = document.querySelector('.tooltip-container');
      expect(tooltip).toBeFalsy();
    }));

    it('should not show tooltip for empty text', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#emptyTooltip'));
      const buttonElement = button.nativeElement;

      buttonElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      const tooltip = document.querySelector('.tooltip-container');
      expect(tooltip).toBeFalsy();
    }));

    it('should not show tooltip for null text', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#nullTooltip'));
      const buttonElement = button.nativeElement;

      buttonElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      const tooltip = document.querySelector('.tooltip-container');
      expect(tooltip).toBeFalsy();
    }));
  });

  describe('Positioning', () => {
    it('should apply top position class', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#topTooltip'));
      button.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      const tooltip = document.querySelector('.tooltip-container');
      expect(tooltip?.classList.contains('tooltip-top')).toBe(true);
    }));

    it('should apply bottom position class', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#bottomTooltip'));
      button.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      const tooltip = document.querySelector('.tooltip-container');
      expect(tooltip?.classList.contains('tooltip-bottom')).toBe(true);
    }));

    it('should apply left position class', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#leftTooltip'));
      button.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      const tooltip = document.querySelector('.tooltip-container');
      expect(tooltip?.classList.contains('tooltip-left')).toBe(true);
    }));

    it('should apply right position class', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#rightTooltip'));
      button.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      const tooltip = document.querySelector('.tooltip-container');
      expect(tooltip?.classList.contains('tooltip-right')).toBe(true);
    }));
  });

  describe('RTL Support', () => {
    it('should swap left/right positions in RTL mode', fakeAsync(() => {
      mockLanguageService.isRTL.and.returnValue(true);

      const button = fixture.debugElement.query(By.css('#leftTooltip'));
      button.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      const tooltip = document.querySelector('.tooltip-container');
      // In RTL, left should become right
      expect(tooltip?.classList.contains('tooltip-left')).toBe(true);
    }));

    it('should not swap top/bottom positions in RTL mode', fakeAsync(() => {
      mockLanguageService.isRTL.and.returnValue(true);

      const button = fixture.debugElement.query(By.css('#topTooltip'));
      button.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      const tooltip = document.querySelector('.tooltip-container');
      expect(tooltip?.classList.contains('tooltip-top')).toBe(true);
    }));
  });

  describe('Delay', () => {
    it('should respect custom delay', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#delayedTooltip'));
      button.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));

      // Should not appear before delay
      tick(300);
      let tooltip = document.querySelector('.tooltip-container');
      expect(tooltip).toBeFalsy();

      // Should appear after delay
      tick(200);
      tooltip = document.querySelector('.tooltip-container');
      expect(tooltip).toBeTruthy();
    }));

    it('should cancel tooltip if mouse leaves before delay', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#basicTooltip'));
      const buttonElement = button.nativeElement;

      buttonElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(150); // Half the default delay

      // Leave before tooltip shows
      buttonElement.dispatchEvent(new MouseEvent('mouseleave'));
      tick(200); // Complete the delay

      const tooltip = document.querySelector('.tooltip-container');
      expect(tooltip).toBeFalsy();
    }));
  });

  describe('Accessibility', () => {
    it('should add ARIA attributes when tooltip is shown', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#basicTooltip'));
      const buttonElement = button.nativeElement;

      buttonElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      expect(buttonElement.getAttribute('aria-describedby')).toBe('tooltip');

      const tooltip = document.querySelector('.tooltip-container');
      expect(tooltip?.getAttribute('role')).toBe('tooltip');
      expect(tooltip?.getAttribute('id')).toBe('tooltip');
    }));

    it('should remove ARIA attributes when tooltip is hidden', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#basicTooltip'));
      const buttonElement = button.nativeElement;

      // Show tooltip
      buttonElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      // Hide tooltip
      buttonElement.dispatchEvent(new MouseEvent('mouseleave'));
      tick(10);

      expect(buttonElement.getAttribute('aria-describedby')).toBeNull();
    }));
  });

  describe('Animation', () => {
    it('should add visible class for animation', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#basicTooltip'));
      button.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      const tooltip = document.querySelector('.tooltip-container');
      expect(tooltip?.classList.contains('tooltip-container')).toBe(true);

      // Wait for animation trigger
      tick(10);
      expect(tooltip?.classList.contains('tooltip-visible')).toBe(true);
    }));
  });

  describe('Cleanup', () => {
    it('should clean up on directive destroy', fakeAsync(() => {
      const button = fixture.debugElement.query(By.css('#basicTooltip'));
      button.nativeElement.dispatchEvent(new MouseEvent('mouseenter'));
      tick(300);

      let tooltip = document.querySelector('.tooltip-container');
      expect(tooltip).toBeTruthy();

      // Destroy component (which destroys directive)
      fixture.destroy();

      tooltip = document.querySelector('.tooltip-container');
      expect(tooltip).toBeFalsy();
    }));
  });
});
