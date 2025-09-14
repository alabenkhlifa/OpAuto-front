import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * Service for managing accessibility features across the application
 */
@Injectable({
  providedIn: 'root'
})
export class AccessibilityService {
  private document = inject(DOCUMENT);

  /**
   * Announce content to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcer = this.getOrCreateAnnouncer(priority);
    announcer.textContent = message;
    
    // Clear after announcement to allow re-announcements of the same message
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }

  /**
   * Announce feature lock status to screen readers
   */
  announceFeatureLock(featureName: string, requiredTier?: string | null): void {
    const message = requiredTier 
      ? `${featureName} feature is locked. ${requiredTier} tier required to unlock.`
      : `${featureName} feature is locked. Upgrade required to unlock.`;
    
    this.announce(message, 'assertive');
  }

  /**
   * Announce upgrade status to screen readers
   */
  announceUpgrade(tierName: string, success: boolean): void {
    const message = success 
      ? `Successfully upgraded to ${tierName} tier. New features are now available.`
      : `Failed to upgrade to ${tierName} tier. Please try again.`;
    
    this.announce(message, 'assertive');
  }

  /**
   * Set focus to an element, with fallback handling
   */
  setFocus(element: HTMLElement | null, options?: FocusOptions): boolean {
    if (!element) return false;

    try {
      element.focus(options);
      return this.document.activeElement === element;
    } catch (error) {
      console.warn('Failed to set focus:', error);
      return false;
    }
  }

  /**
   * Set focus to the first focusable element within a container
   */
  setFocusToFirst(container: HTMLElement): boolean {
    const focusableElement = this.getFirstFocusableElement(container);
    return this.setFocus(focusableElement);
  }

  /**
   * Set focus to the last focusable element within a container
   */
  setFocusToLast(container: HTMLElement): boolean {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return false;
    
    const lastElement = focusableElements[focusableElements.length - 1];
    return this.setFocus(lastElement);
  }

  /**
   * Get all focusable elements within a container
   */
  getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    const elements = Array.from(
      container.querySelectorAll<HTMLElement>(focusableSelectors)
    );

    return elements.filter(element => {
      return this.isElementVisible(element) && !this.isElementDisabled(element);
    });
  }

  /**
   * Get the first focusable element within a container
   */
  getFirstFocusableElement(container: HTMLElement): HTMLElement | null {
    const focusableElements = this.getFocusableElements(container);
    return focusableElements.length > 0 ? focusableElements[0] : null;
  }

  /**
   * Create a focus trap within a container (for modals)
   */
  createFocusTrap(container: HTMLElement): () => void {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return () => {};

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        // Shift + Tab: moving backwards
        if (this.document.activeElement === firstElement) {
          event.preventDefault();
          this.setFocus(lastElement);
        }
      } else {
        // Tab: moving forwards
        if (this.document.activeElement === lastElement) {
          event.preventDefault();
          this.setFocus(firstElement);
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Set initial focus
    this.setFocus(firstElement);

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Handle escape key to close modals/overlays
   */
  handleEscapeKey(callback: () => void): () => void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        callback();
      }
    };

    this.document.addEventListener('keydown', handleKeyDown);

    return () => {
      this.document.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Add keyboard navigation to a list of elements
   */
  addArrowKeyNavigation(
    container: HTMLElement, 
    itemSelector: string,
    options: {
      wrap?: boolean;
      orientation?: 'horizontal' | 'vertical' | 'both';
      onActivate?: (element: HTMLElement, index: number) => void;
    } = {}
  ): () => void {
    const { wrap = true, orientation = 'vertical', onActivate } = options;

    const handleKeyDown = (event: KeyboardEvent) => {
      const items = Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
      if (items.length === 0) return;

      const currentIndex = items.findIndex(item => item === this.document.activeElement);
      if (currentIndex === -1) return;

      let newIndex = currentIndex;
      let handled = false;

      switch (event.key) {
        case 'ArrowDown':
          if (orientation === 'vertical' || orientation === 'both') {
            newIndex = wrap ? (currentIndex + 1) % items.length : Math.min(currentIndex + 1, items.length - 1);
            handled = true;
          }
          break;
        case 'ArrowUp':
          if (orientation === 'vertical' || orientation === 'both') {
            newIndex = wrap ? (currentIndex - 1 + items.length) % items.length : Math.max(currentIndex - 1, 0);
            handled = true;
          }
          break;
        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'both') {
            newIndex = wrap ? (currentIndex + 1) % items.length : Math.min(currentIndex + 1, items.length - 1);
            handled = true;
          }
          break;
        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'both') {
            newIndex = wrap ? (currentIndex - 1 + items.length) % items.length : Math.max(currentIndex - 1, 0);
            handled = true;
          }
          break;
        case 'Home':
          newIndex = 0;
          handled = true;
          break;
        case 'End':
          newIndex = items.length - 1;
          handled = true;
          break;
        case 'Enter':
        case ' ':
          if (onActivate) {
            onActivate(items[currentIndex], currentIndex);
            handled = true;
          }
          break;
      }

      if (handled) {
        event.preventDefault();
        if (newIndex !== currentIndex) {
          this.setFocus(items[newIndex]);
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Check if an element is visible
   */
  private isElementVisible(element: HTMLElement): boolean {
    const style = getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  }

  /**
   * Check if an element is disabled
   */
  private isElementDisabled(element: HTMLElement): boolean {
    return element.hasAttribute('disabled') || 
           element.getAttribute('aria-disabled') === 'true';
  }

  /**
   * Get or create an aria-live announcer element
   */
  private getOrCreateAnnouncer(priority: 'polite' | 'assertive'): HTMLElement {
    const id = `aria-announcer-${priority}`;
    let announcer = this.document.getElementById(id);

    if (!announcer) {
      announcer = this.document.createElement('div');
      announcer.id = id;
      announcer.setAttribute('aria-live', priority);
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.position = 'absolute';
      announcer.style.left = '-10000px';
      announcer.style.width = '1px';
      announcer.style.height = '1px';
      announcer.style.overflow = 'hidden';

      this.document.body.appendChild(announcer);
    }

    return announcer;
  }

  /**
   * Check if user prefers reduced motion
   */
  prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Check if user is using high contrast mode
   */
  isHighContrastMode(): boolean {
    return window.matchMedia('(prefers-contrast: high)').matches;
  }

  /**
   * Add skip link for keyboard navigation
   */
  addSkipLink(targetId: string, linkText: string = 'Skip to main content'): void {
    const existingSkipLink = this.document.querySelector('.skip-link');
    if (existingSkipLink) return;

    const skipLink = this.document.createElement('a');
    skipLink.href = `#${targetId}`;
    skipLink.textContent = linkText;
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: #000;
      color: #fff;
      padding: 8px;
      z-index: 1000;
      text-decoration: none;
      transition: top 0.2s;
    `;

    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px';
    });

    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });

    this.document.body.insertBefore(skipLink, this.document.body.firstChild);
  }
}