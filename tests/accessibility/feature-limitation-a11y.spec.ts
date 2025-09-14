import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Feature Limitation Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Set consistent state for testing
    await page.addInitScript(() => {
      localStorage.setItem('subscription_tier', 'starter');
      localStorage.setItem('language', 'en');
    });
  });

  test.describe('FeatureLock Component Accessibility', () => {
    test('feature lock overlay should be accessible', async ({ page }) => {
      await page.goto('/demo/feature-lock');
      await page.waitForSelector('.feature-lock-overlay');
      
      // Run axe accessibility tests
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('.feature-lock-overlay')
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('feature lock should have proper ARIA attributes', async ({ page }) => {
      await page.goto('/demo/feature-lock');
      const overlay = page.locator('.feature-lock-overlay');
      
      // Check required ARIA attributes
      await expect(overlay).toHaveAttribute('role', 'dialog');
      await expect(overlay).toHaveAttribute('aria-modal', 'true');
      await expect(overlay).toHaveAttribute('aria-label');
      await expect(overlay).toHaveAttribute('tabindex', '0');
      
      // Check button accessibility
      const upgradeButton = overlay.locator('.upgrade-cta');
      await expect(upgradeButton).toHaveAttribute('type', 'button');
      await expect(upgradeButton).toHaveAttribute('aria-label');
    });

    test('feature lock should support keyboard navigation', async ({ page }) => {
      await page.goto('/demo/feature-lock');
      
      // Tab should focus the overlay
      await page.keyboard.press('Tab');
      const overlay = page.locator('.feature-lock-overlay');
      await expect(overlay).toBeFocused();
      
      // Tab again should focus upgrade button
      await page.keyboard.press('Tab');
      const upgradeButton = page.locator('.upgrade-cta');
      await expect(upgradeButton).toBeFocused();
      
      // Enter should activate button
      await page.keyboard.press('Enter');
      // Should open upgrade modal
      const modal = page.locator('.upgrade-modal-overlay');
      await expect(modal).toBeVisible();
    });

    test('feature lock should announce to screen readers', async ({ page }) => {
      await page.goto('/demo/feature-lock');
      
      // Check for aria-live regions
      const announcer = page.locator('[aria-live]');
      await expect(announcer).toBeInDOM();
      
      // Check that announcements are made (would need screen reader testing for full validation)
      const ariaLive = await announcer.getAttribute('aria-live');
      expect(['polite', 'assertive']).toContain(ariaLive);
    });

    test('feature lock should handle high contrast mode', async ({ page }) => {
      // Simulate high contrast mode
      await page.emulateMedia({ prefersColorScheme: 'dark' });
      await page.addStyleTag({
        content: `
          @media (prefers-contrast: high) {
            .feature-lock-overlay { 
              border: 2px solid white !important;
              background: black !important;
              color: white !important;
            }
          }
        `
      });
      
      await page.goto('/demo/feature-lock');
      
      // Run accessibility scan with high contrast
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('.feature-lock-overlay')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('UpgradePrompt Modal Accessibility', () => {
    test('upgrade modal should be fully accessible', async ({ page }) => {
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      await page.waitForSelector('.upgrade-modal-overlay');
      
      // Full modal accessibility scan
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('.upgrade-modal-overlay')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('upgrade modal should trap focus correctly', async ({ page }) => {
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      
      // Modal should receive focus
      const modal = page.locator('.upgrade-modal');
      await expect(modal).toBeFocused();
      
      // Find all focusable elements
      const focusableElements = await page.locator('.upgrade-modal').locator(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      ).all();
      
      expect(focusableElements.length).toBeGreaterThan(0);
      
      // Tab through all elements
      for (let i = 0; i < focusableElements.length; i++) {
        await page.keyboard.press('Tab');
        // Focus should stay within modal
        const focusedElement = page.locator(':focus');
        const isInModal = await focusedElement.evaluate(el => 
          el.closest('.upgrade-modal') !== null
        );
        expect(isInModal).toBe(true);
      }
      
      // Tab after last element should cycle back to first
      await page.keyboard.press('Tab');
      const firstFocusable = focusableElements[0];
      await expect(firstFocusable).toBeFocused();
    });

    test('upgrade modal should support arrow key navigation', async ({ page }) => {
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      
      // Focus first tier button
      const tierButtons = page.locator('.tier-cta-button');
      await tierButtons.first().focus();
      
      // Right arrow should move to next button
      await page.keyboard.press('ArrowRight');
      await expect(tierButtons.nth(1)).toBeFocused();
      
      // Left arrow should move back
      await page.keyboard.press('ArrowLeft');
      await expect(tierButtons.first()).toBeFocused();
      
      // Home should go to first
      await tierButtons.nth(1).focus();
      await page.keyboard.press('Home');
      await expect(tierButtons.first()).toBeFocused();
      
      // End should go to last
      await page.keyboard.press('End');
      await expect(tierButtons.last()).toBeFocused();
    });

    test('upgrade modal should support escape key', async ({ page }) => {
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      
      const modal = page.locator('.upgrade-modal-overlay');
      await expect(modal).toBeVisible();
      
      // Escape should close modal
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();
    });

    test('tier cards should have proper labeling', async ({ page }) => {
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      
      const tierCards = page.locator('.tier-card');
      const cardCount = await tierCards.count();
      
      for (let i = 0; i < cardCount; i++) {
        const card = tierCards.nth(i);
        const button = card.locator('.tier-cta-button');
        
        // Each tier button should have aria-label
        await expect(button).toHaveAttribute('aria-label');
        await expect(button).toHaveAttribute('type', 'button');
        
        // Popular/current badges should have proper labels
        const badges = card.locator('.popular-badge, .current-badge');
        if (await badges.count() > 0) {
          // Badges should be properly labeled or have aria-hidden
          const badge = badges.first();
          const hasAriaLabel = await badge.getAttribute('aria-label');
          const isHidden = await badge.getAttribute('aria-hidden');
          expect(hasAriaLabel || isHidden).toBeTruthy();
        }
      }
    });
  });

  test.describe('FeatureGate Directive Accessibility', () => {
    test('feature gate should maintain accessibility in disable mode', async ({ page }) => {
      await page.goto('/demo/feature-gate-disable');
      
      // Run accessibility scan on disabled elements
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('.feature-gate-demo')
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
      
      // Check disabled elements have proper attributes
      const disabledElements = page.locator('.feature-locked');
      const elementCount = await disabledElements.count();
      
      for (let i = 0; i < elementCount; i++) {
        const element = disabledElements.nth(i);
        await expect(element).toHaveAttribute('aria-disabled', 'true');
        await expect(element).toHaveAttribute('aria-label');
      }
    });

    test('feature gate should handle screen reader announcements', async ({ page }) => {
      await page.goto('/demo/feature-gate-announcements');
      
      // Check that blocked features trigger announcements
      const announcer = page.locator('[aria-live="assertive"]');
      await expect(announcer).toBeInDOM();
      
      // Trigger feature gate evaluation
      await page.reload();
      
      // Announcer should have content (in real scenario, would be populated)
      // This is a placeholder for actual screen reader testing
      expect(await announcer.isVisible()).toBe(true);
    });
  });

  test.describe('Multi-language Accessibility', () => {
    test('Arabic RTL should maintain accessibility', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('language', 'ar');
      });
      await page.reload();
      
      await page.goto('/demo/feature-lock');
      await page.waitForSelector('.feature-lock-overlay');
      
      // Check RTL accessibility
      const overlay = page.locator('.feature-lock-overlay');
      const direction = await overlay.evaluate(el => getComputedStyle(el).direction);
      expect(direction).toBe('rtl');
      
      // Run accessibility scan on RTL layout
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('.feature-lock-overlay')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('language switching should preserve accessibility', async ({ page }) => {
      const languages = ['en', 'fr', 'ar'];
      
      for (const lang of languages) {
        await page.evaluate((language) => {
          localStorage.setItem('language', language);
        }, lang);
        await page.reload();
        
        await page.goto('/demo/upgrade-prompt');
        await page.click('[data-testid="open-upgrade-modal"]');
        
        // Each language should pass accessibility tests
        const accessibilityScanResults = await new AxeBuilder({ page })
          .include('.upgrade-modal')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze();
        
        expect(accessibilityScanResults.violations).toEqual([]);
      }
    });
  });

  test.describe('Color Contrast and Visual Accessibility', () => {
    test('should meet color contrast requirements', async ({ page }) => {
      await page.goto('/demo/feature-lock');
      
      // Run color contrast specific tests
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('.feature-lock-overlay')
        .withTags(['wcag2aa'])
        .withRules(['color-contrast'])
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should work with forced colors mode', async ({ page }) => {
      // Simulate forced colors mode (high contrast)
      await page.emulateMedia({ forcedColors: 'active' });
      
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      
      // Should still be accessible in forced colors mode
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('.upgrade-modal')
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should work with reduced motion preferences', async ({ page }) => {
      await page.emulateMedia({ prefersReducedMotion: 'reduce' });
      
      await page.goto('/demo/feature-lock');
      
      // Check that animations are reduced/disabled
      const overlay = page.locator('.feature-lock-overlay');
      const transition = await overlay.evaluate(el => 
        getComputedStyle(el).transitionDuration
      );
      
      // Should have no or very short transitions when reduced motion is preferred
      expect(parseFloat(transition.replace('s', ''))).toBeLessThanOrEqual(0.1);
    });
  });

  test.describe('Touch and Mobile Accessibility', () => {
    test('should have proper touch targets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      
      // Check touch target sizes (minimum 44px)
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();
        
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
      
      // Run mobile accessibility scan
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('.upgrade-modal')
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });

  test.describe('Screen Reader Simulation', () => {
    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      
      // Check heading hierarchy
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      
      if (headingCount > 0) {
        // Should have logical heading structure
        const accessibilityScanResults = await new AxeBuilder({ page })
          .include('.upgrade-modal')
          .withRules(['heading-order'])
          .analyze();
        
        expect(accessibilityScanResults.violations).toEqual([]);
      }
    });

    test('should have proper landmark structure', async ({ page }) => {
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      
      // Check for proper landmarks and regions
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('.upgrade-modal')
        .withRules(['region'])
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have descriptive link and button text', async ({ page }) => {
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      
      // Check that all interactive elements have accessible names
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('.upgrade-modal')
        .withRules(['button-name', 'link-name'])
        .analyze();
      
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });
});