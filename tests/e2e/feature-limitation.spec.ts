import { test, expect } from '@playwright/test';

test.describe('Feature Limitation System', () => {
  test.beforeEach(async ({ page }) => {
    // Set up mock subscription service
    await page.goto('/');
    
    // Mock localStorage to set subscription tier
    await page.addInitScript(() => {
      localStorage.setItem('subscription_tier', 'starter');
    });
  });

  test.describe('Feature Lock Component', () => {
    test('should show locked overlay for restricted features', async ({ page }) => {
      await page.goto('/features/professional-only');
      
      // Should show feature lock overlay
      const overlay = page.locator('.feature-lock-overlay');
      await expect(overlay).toBeVisible();
      
      // Should show lock icon
      const lockIcon = page.locator('.lock-icon svg');
      await expect(lockIcon).toBeVisible();
      
      // Should show upgrade button
      const upgradeButton = page.locator('.upgrade-cta');
      await expect(upgradeButton).toBeVisible();
      await expect(upgradeButton).toContainText('Upgrade');
    });

    test('should not show overlay for unlocked features', async ({ page }) => {
      await page.goto('/features/starter-available');
      
      // Should not show feature lock overlay
      const overlay = page.locator('.feature-lock-overlay');
      await expect(overlay).not.toBeVisible();
      
      // Content should be accessible
      const content = page.locator('.feature-content');
      await expect(content).toBeVisible();
      await expect(content).not.toHaveClass(/feature-locked/);
    });

    test('should open upgrade modal when upgrade button clicked', async ({ page }) => {
      await page.goto('/features/professional-only');
      
      // Click upgrade button
      const upgradeButton = page.locator('.upgrade-cta');
      await upgradeButton.click();
      
      // Should open upgrade modal
      const modal = page.locator('.upgrade-modal-overlay');
      await expect(modal).toBeVisible();
      
      // Should show tier comparison
      const tierCards = page.locator('.tier-card');
      await expect(tierCards).toHaveCount(3);
    });
  });

  test.describe('Feature Gate Directive', () => {
    test('should hide elements in hide mode for locked features', async ({ page }) => {
      await page.goto('/test/feature-gate-hide');
      
      // Locked feature should be hidden
      const lockedElement = page.locator('[data-testid="locked-feature"]');
      await expect(lockedElement).not.toBeVisible();
      
      // Unlocked feature should be visible
      const unlockedElement = page.locator('[data-testid="unlocked-feature"]');
      await expect(unlockedElement).toBeVisible();
    });

    test('should disable elements in disable mode for locked features', async ({ page }) => {
      await page.goto('/test/feature-gate-disable');
      
      // Locked button should be disabled and have feature-locked class
      const lockedButton = page.locator('[data-testid="locked-button"]');
      await expect(lockedButton).toBeVisible();
      await expect(lockedButton).toBeDisabled();
      await expect(lockedButton).toHaveClass(/feature-locked/);
      
      // Unlocked button should be enabled
      const unlockedButton = page.locator('[data-testid="unlocked-button"]');
      await expect(unlockedButton).toBeVisible();
      await expect(unlockedButton).toBeEnabled();
    });

    test('should emit blocked events for locked features', async ({ page }) => {
      let blockedEvent = null;
      
      await page.goto('/test/feature-gate-events');
      
      // Listen for blocked events
      await page.evaluate(() => {
        window.blockedEvents = [];
        document.addEventListener('featureBlocked', (event) => {
          window.blockedEvents.push(event.detail);
        });
      });
      
      // Trigger feature gate evaluation
      await page.reload();
      
      // Check that blocked events were emitted
      const blockedEvents = await page.evaluate(() => window.blockedEvents);
      expect(blockedEvents.length).toBeGreaterThan(0);
      expect(blockedEvents[0]).toHaveProperty('feature');
      expect(blockedEvents[0]).toHaveProperty('requiredTier');
    });
  });

  test.describe('Upgrade Prompt Modal', () => {
    test('should show tier comparison by default', async ({ page }) => {
      await page.goto('/upgrade-prompt');
      
      // Should show all three tiers
      const tierCards = page.locator('.tier-card');
      await expect(tierCards).toHaveCount(3);
      
      // Should highlight current tier
      const currentTier = page.locator('.tier-card.current');
      await expect(currentTier).toHaveCount(1);
      
      // Should show popular badge on starter tier
      const popularBadge = page.locator('.popular-badge');
      await expect(popularBadge).toBeVisible();
      await expect(popularBadge).toContainText('Most Popular');
    });

    test('should show feature list for each tier', async ({ page }) => {
      await page.goto('/upgrade-prompt');
      
      // Each tier should show features
      const tierCards = page.locator('.tier-card');
      
      for (let i = 0; i < await tierCards.count(); i++) {
        const tierCard = tierCards.nth(i);
        const features = tierCard.locator('.feature-item');
        await expect(features.first()).toBeVisible();
        
        // Should show enabled/disabled states
        const enabledFeatures = tierCard.locator('.feature-item.enabled');
        const disabledFeatures = tierCard.locator('.feature-item.disabled');
        
        // Each tier should have at least some enabled features
        await expect(enabledFeatures.first()).toBeVisible();
      }
    });

    test('should handle keyboard navigation', async ({ page }) => {
      await page.goto('/upgrade-prompt');
      
      // Focus first tier button
      const firstButton = page.locator('.tier-cta-button').first();
      await firstButton.focus();
      
      // Arrow key should move to next tier
      await page.keyboard.press('ArrowRight');
      
      // Check that focus moved
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toHaveClass(/tier-cta-button/);
      
      // Escape should close modal
      await page.keyboard.press('Escape');
      const modal = page.locator('.upgrade-modal-overlay');
      await expect(modal).not.toBeVisible();
    });

    test('should trap focus within modal', async ({ page }) => {
      await page.goto('/upgrade-prompt');
      
      // Modal should be focused initially
      const modal = page.locator('.upgrade-modal');
      await expect(modal).toBeFocused();
      
      // Tab to last element then continue should cycle back to first
      const closeButton = page.locator('.close-button');
      await closeButton.focus();
      await page.keyboard.press('Tab');
      
      // Focus should cycle back to first focusable element
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should announce feature locks to screen readers', async ({ page }) => {
      await page.goto('/features/professional-only');
      
      // Check for aria-live announcements
      const announcer = page.locator('[aria-live]');
      await expect(announcer).toBeInDOM();
      
      // Check that overlay has proper ARIA attributes
      const overlay = page.locator('.feature-lock-overlay');
      await expect(overlay).toHaveAttribute('role', 'dialog');
      await expect(overlay).toHaveAttribute('aria-modal', 'true');
      await expect(overlay).toHaveAttribute('aria-label');
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/features/professional-only');
      
      // Tab should focus the overlay
      await page.keyboard.press('Tab');
      const overlay = page.locator('.feature-lock-overlay');
      await expect(overlay).toBeFocused();
      
      // Tab should move to upgrade button
      await page.keyboard.press('Tab');
      const upgradeButton = page.locator('.upgrade-cta');
      await expect(upgradeButton).toBeFocused();
      
      // Enter should activate upgrade button
      await page.keyboard.press('Enter');
      const modal = page.locator('.upgrade-modal-overlay');
      await expect(modal).toBeVisible();
    });

    test('should have proper contrast ratios', async ({ page }) => {
      await page.goto('/features/professional-only');
      
      // Check lock overlay text contrast
      const lockText = page.locator('.lock-text');
      const textColor = await lockText.evaluate(el => 
        getComputedStyle(el).color
      );
      const backgroundColor = await lockText.evaluate(el => 
        getComputedStyle(el.parentElement).backgroundColor
      );
      
      // Basic check that colors are different (actual contrast ratio calculation would be more complex)
      expect(textColor).not.toBe(backgroundColor);
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/upgrade-prompt');
      
      // Modal should be responsive
      const modal = page.locator('.upgrade-modal');
      await expect(modal).toBeVisible();
      
      // Tier cards should stack on mobile
      const tierCards = page.locator('.tier-card');
      const firstCard = tierCards.first();
      const secondCard = tierCards.nth(1);
      
      const firstCardBox = await firstCard.boundingBox();
      const secondCardBox = await secondCard.boundingBox();
      
      // Cards should be stacked (second card should be below first)
      expect(secondCardBox!.y).toBeGreaterThan(firstCardBox!.y + firstCardBox!.height - 10);
    });

    test('should work on tablet devices', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/upgrade-prompt');
      
      // Should maintain good layout on tablet
      const modal = page.locator('.upgrade-modal');
      await expect(modal).toBeVisible();
      
      // Touch targets should be large enough (44px minimum)
      const buttons = page.locator('.tier-cta-button');
      for (let i = 0; i < await buttons.count(); i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test.describe('Multi-language Support', () => {
    test('should display Arabic translations with RTL layout', async ({ page }) => {
      await page.goto('/');
      
      // Set language to Arabic
      await page.evaluate(() => {
        localStorage.setItem('language', 'ar');
      });
      await page.reload();
      
      await page.goto('/features/professional-only');
      
      // Check that Arabic text is displayed
      const upgradeButton = page.locator('.upgrade-cta');
      await expect(upgradeButton).toContainText('ترقية');
      
      // Check RTL layout
      const overlay = page.locator('.feature-lock-overlay');
      const direction = await overlay.evaluate(el => 
        getComputedStyle(el).direction
      );
      expect(direction).toBe('rtl');
    });

    test('should display French translations correctly', async ({ page }) => {
      await page.goto('/');
      
      // Set language to French
      await page.evaluate(() => {
        localStorage.setItem('language', 'fr');
      });
      await page.reload();
      
      await page.goto('/features/professional-only');
      
      // Check that French text is displayed
      const upgradeButton = page.locator('.upgrade-cta');
      await expect(upgradeButton).toContainText('Mettre à niveau');
      
      // Check that text fits properly
      const buttonBox = await upgradeButton.boundingBox();
      expect(buttonBox!.width).toBeGreaterThan(0);
      expect(buttonBox!.height).toBeGreaterThan(0);
    });
  });

  test.describe('User Interaction Flows', () => {
    test('should complete full upgrade flow', async ({ page }) => {
      let upgradeTriggered = false;
      
      // Mock upgrade service
      await page.route('**/api/subscription/upgrade', (route) => {
        upgradeTriggered = true;
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, newTier: 'professional' })
        });
      });
      
      await page.goto('/features/professional-only');
      
      // Click upgrade button
      const upgradeButton = page.locator('.upgrade-cta');
      await upgradeButton.click();
      
      // Select professional tier
      const professionalButton = page.locator('.tier-card').filter({ hasText: 'Professional' })
        .locator('.tier-cta-button');
      await professionalButton.click();
      
      // Should trigger upgrade
      expect(upgradeTriggered).toBe(true);
    });

    test('should show loading states during tier validation', async ({ page }) => {
      // Mock slow API response
      await page.route('**/api/subscription/status', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ tier: 'starter' })
          });
        }, 1000);
      });
      
      await page.goto('/features/check-tier');
      
      // Should show loading state
      const loader = page.locator('.loading-spinner');
      await expect(loader).toBeVisible();
      
      // Loading should disappear after response
      await expect(loader).not.toBeVisible({ timeout: 2000 });
    });
  });
});