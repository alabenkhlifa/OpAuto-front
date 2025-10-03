import {
  Directive,
  Input,
  ElementRef,
  Renderer2,
  HostListener,
  OnDestroy,
  inject
} from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Tooltip directive that shows contextual help on hover
 *
 * Features:
 * - Glassmorphism styling matching OpAuto design system
 * - RTL-aware positioning
 * - Accessible with ARIA attributes
 * - Smooth animations
 * - Auto-positioning to stay within viewport
 *
 * Usage examples:
 *
 * // Basic tooltip
 * <button appTooltip="Save your changes">Save</button>
 *
 * // With custom position
 * <span appTooltip="Professional tier required" tooltipPosition="right">
 *   🔒 Advanced Reports
 * </span>
 *
 * // Disabled tooltip
 * <div [appTooltip]="null">No tooltip</div>
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') tooltipText: string | null = null;
  @Input('tooltipPosition') position: TooltipPosition = 'top';
  @Input('tooltipDelay') delay: number = 300; // ms delay before showing

  private tooltipElement: HTMLElement | null = null;
  private showTimeout: any;
  private readonly elementRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly languageService = inject(LanguageService);

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (!this.tooltipText || this.tooltipText.trim() === '') {
      return;
    }

    // Clear any existing timeout
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }

    // Show tooltip after delay
    this.showTimeout = setTimeout(() => {
      this.show();
    }, this.delay);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    // Clear timeout if mouse leaves before tooltip shows
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    this.hide();
  }

  @HostListener('click')
  onClick(): void {
    // Hide tooltip when element is clicked
    this.hide();
  }

  ngOnDestroy(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }
    this.hide();
  }

  private show(): void {
    if (this.tooltipElement) {
      return; // Tooltip already visible
    }

    // Create tooltip element
    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.addClass(this.tooltipElement, 'tooltip-container');
    this.renderer.addClass(this.tooltipElement, `tooltip-${this.position}`);

    // Add text content
    const textNode = this.renderer.createText(this.tooltipText!);
    this.renderer.appendChild(this.tooltipElement, textNode);

    // Add to body
    this.renderer.appendChild(document.body, this.tooltipElement);

    // Position the tooltip
    this.positionTooltip();

    // Add ARIA attributes
    const hostElement = this.elementRef.nativeElement;
    this.renderer.setAttribute(hostElement, 'aria-describedby', 'tooltip');
    this.renderer.setAttribute(this.tooltipElement, 'id', 'tooltip');
    this.renderer.setAttribute(this.tooltipElement, 'role', 'tooltip');

    // Trigger animation
    setTimeout(() => {
      if (this.tooltipElement) {
        this.renderer.addClass(this.tooltipElement, 'tooltip-visible');
      }
    }, 10);
  }

  private hide(): void {
    if (!this.tooltipElement) {
      return;
    }

    // Remove ARIA attributes
    const hostElement = this.elementRef.nativeElement;
    this.renderer.removeAttribute(hostElement, 'aria-describedby');

    // Remove tooltip element
    this.renderer.removeChild(document.body, this.tooltipElement);
    this.tooltipElement = null;
  }

  private positionTooltip(): void {
    if (!this.tooltipElement) {
      return;
    }

    const hostElement = this.elementRef.nativeElement;
    const hostRect = hostElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    const isRTL = this.languageService.isRTL();

    const offset = 8; // Gap between element and tooltip
    let top = 0;
    let left = 0;

    // Calculate position based on requested position
    let calculatedPosition = this.position;

    // For RTL, swap left/right
    if (isRTL) {
      if (calculatedPosition === 'left') {
        calculatedPosition = 'right';
      } else if (calculatedPosition === 'right') {
        calculatedPosition = 'left';
      }
    }

    switch (calculatedPosition) {
      case 'top':
        top = hostRect.top - tooltipRect.height - offset;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = hostRect.bottom + offset;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.left - tooltipRect.width - offset;
        break;
      case 'right':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.right + offset;
        break;
    }

    // Keep tooltip within viewport bounds
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 8;

    // Adjust horizontal position
    if (left < padding) {
      left = padding;
    } else if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }

    // Adjust vertical position
    if (top < padding) {
      top = padding;
    } else if (top + tooltipRect.height > viewportHeight - padding) {
      top = viewportHeight - tooltipRect.height - padding;
    }

    // Apply position
    this.renderer.setStyle(this.tooltipElement, 'top', `${top + window.scrollY}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left + window.scrollX}px`);
  }
}
