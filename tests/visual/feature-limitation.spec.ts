import { test, expect } from '@playwright/test';

test.describe('Feature Limitation Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport for screenshots
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Mock consistent data for visual stability
    await page.addInitScript(() => {
      localStorage.setItem('subscription_tier', 'starter');
      localStorage.setItem('language', 'en');
    });
    
    await page.goto('/');
  });

  test.describe('Feature Lock Component Screenshots', () => {
    test('feature lock overlay - desktop', async ({ page }) => {
      await page.goto('/demo/feature-lock');
      
      // Wait for component to load
      await page.waitForSelector('.feature-lock-overlay');
      
      // Take screenshot of locked feature
      await expect(page.locator('.feature-locked-demo')).toHaveScreenshot('feature-lock-overlay-desktop.png');
    });

    test('feature lock overlay - mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/demo/feature-lock');
      
      await page.waitForSelector('.feature-lock-overlay');
      
      // Mobile screenshot
      await expect(page.locator('.feature-locked-demo')).toHaveScreenshot('feature-lock-overlay-mobile.png');
    });

    test('feature lock overlay - tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/demo/feature-lock');
      
      await page.waitForSelector('.feature-lock-overlay');
      
      // Tablet screenshot
      await expect(page.locator('.feature-locked-demo')).toHaveScreenshot('feature-lock-overlay-tablet.png');
    });

    test('feature lock with different tier badges', async ({ page }) => {
      await page.goto('/demo/tier-badges');
      
      // Wait for all badges to load
      await page.waitForSelector('.badge-tier-solo');
      await page.waitForSelector('.badge-tier-starter');
      await page.waitForSelector('.badge-tier-professional');
      
      // Screenshot of all tier badges
      await expect(page.locator('.tier-badges-demo')).toHaveScreenshot('tier-badges-comparison.png');
    });
  });

  test.describe('Upgrade Prompt Modal Screenshots', () => {
    test('upgrade prompt modal - full view', async ({ page }) => {
      await page.goto('/demo/upgrade-prompt');
      
      // Open modal
      await page.click('[data-testid="open-upgrade-modal"]');
      await page.waitForSelector('.upgrade-modal-overlay');
      
      // Full modal screenshot
      await expect(page.locator('.upgrade-modal-overlay')).toHaveScreenshot('upgrade-modal-full.png');
    });

    test('upgrade prompt modal - tier comparison', async ({ page }) => {
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      await page.waitForSelector('.tier-cards');
      
      // Focus on tier comparison section
      await expect(page.locator('.tier-comparison')).toHaveScreenshot('tier-comparison-cards.png');
    });

    test('upgrade prompt modal - mobile view', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      await page.waitForSelector('.upgrade-modal-overlay');
      
      // Mobile modal screenshot
      await expect(page.locator('.upgrade-modal-overlay')).toHaveScreenshot('upgrade-modal-mobile.png');
    });

    test('single tier upgrade prompt', async ({ page }) => {
      await page.goto('/demo/single-tier-upgrade');
      await page.click('[data-testid="open-single-upgrade"]');
      await page.waitForSelector('.single-tier-upgrade');
      
      // Single tier upgrade screenshot
      await expect(page.locator('.single-tier-upgrade')).toHaveScreenshot('single-tier-upgrade.png');
    });
  });

  test.describe('Feature Gate Directive Screenshots', () => {
    test('feature gate - hide mode', async ({ page }) => {
      await page.goto('/demo/feature-gate-hide');
      await page.waitForLoadState('networkidle');
      
      // Screenshot showing hidden vs visible features
      await expect(page.locator('.feature-gate-demo')).toHaveScreenshot('feature-gate-hide-mode.png');
    });

    test('feature gate - disable mode', async ({ page }) => {
      await page.goto('/demo/feature-gate-disable');
      await page.waitForLoadState('networkidle');
      
      // Screenshot showing disabled vs enabled features
      await expect(page.locator('.feature-gate-demo')).toHaveScreenshot('feature-gate-disable-mode.png');
    });

    test('feature gate - with tooltips', async ({ page }) => {
      await page.goto('/demo/feature-gate-tooltips');
      
      // Hover to show tooltip
      await page.hover('[data-testid="locked-feature-tooltip"]');
      await page.waitForSelector('.tooltip', { state: 'visible' });
      
      // Screenshot with tooltip visible
      await expect(page).toHaveScreenshot('feature-gate-tooltip.png');
    });
  });

  test.describe('Multi-language Visual Tests', () => {
    test('feature lock - Arabic RTL', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('language', 'ar');
      });
      await page.reload();
      
      await page.goto('/demo/feature-lock');
      await page.waitForSelector('.feature-lock-overlay');
      
      // Screenshot of Arabic RTL layout
      await expect(page.locator('.feature-locked-demo')).toHaveScreenshot('feature-lock-arabic-rtl.png');
    });

    test('upgrade modal - French translations', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('language', 'fr');
      });
      await page.reload();
      
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      await page.waitForSelector('.upgrade-modal-overlay');
      
      // Screenshot of French translations
      await expect(page.locator('.upgrade-modal')).toHaveScreenshot('upgrade-modal-french.png');
    });

    test('tier badges - all languages', async ({ page }) => {
      const languages = ['en', 'fr', 'ar'];
      
      for (const lang of languages) {
        await page.evaluate((language) => {
          localStorage.setItem('language', language);
        }, lang);
        await page.reload();
        
        await page.goto('/demo/tier-badges');
        await page.waitForSelector('.tier-badges-demo');
        
        // Screenshot for each language
        await expect(page.locator('.tier-badges-demo'))
          .toHaveScreenshot(`tier-badges-${lang}.png`);
      }
    });
  });

  test.describe('Dark Theme Screenshots', () => {
    test('feature lock - dark glassmorphism', async ({ page }) => {
      // Ensure dark theme
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      
      await page.goto('/demo/feature-lock');
      await page.waitForSelector('.feature-lock-overlay');
      
      // Dark theme screenshot
      await expect(page.locator('.feature-locked-demo')).toHaveScreenshot('feature-lock-dark-theme.png');
    });

    test('upgrade modal - glassmorphism effects', async ({ page }) => {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      await page.waitForSelector('.upgrade-modal-overlay');
      
      // Dark theme modal with glassmorphism
      await expect(page.locator('.upgrade-modal')).toHaveScreenshot('upgrade-modal-glassmorphism.png');
    });
  });

  test.describe('Interactive State Screenshots', () => {
    test('tier cards - hover states', async ({ page }) => {
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      await page.waitForSelector('.tier-card');
      
      // Hover over professional tier card
      await page.hover('.tier-card:has-text("Professional")');
      
      // Screenshot with hover effect
      await expect(page.locator('.tier-cards')).toHaveScreenshot('tier-cards-hover-state.png');
    });

    test('upgrade buttons - focus states', async ({ page }) => {
      await page.goto('/demo/upgrade-prompt');
      await page.click('[data-testid="open-upgrade-modal"]');
      
      // Focus on upgrade button
      await page.focus('.tier-cta-button:first-child');
      
      // Screenshot with focus ring
      await expect(page.locator('.tier-cards')).toHaveScreenshot('tier-cards-focus-state.png');
    });

    test('feature lock - loading state', async ({ page }) => {
      // Mock slow loading
      await page.route('**/api/subscription/check', (route) => {
        setTimeout(() => {
          route.fulfill({ status: 200, body: '{"locked": true}' });
        }, 1000);
      });
      
      await page.goto('/demo/feature-lock-loading');
      
      // Screenshot of loading state
      await expect(page.locator('.feature-loading-demo')).toHaveScreenshot('feature-lock-loading.png');
    });
  });

  test.describe('Edge Cases Screenshots', () => {
    test('feature lock - long tier names', async ({ page }) => {
      await page.goto('/demo/long-tier-names');
      await page.waitForSelector('.feature-lock-overlay');
      
      // Test with very long tier names
      await expect(page.locator('.feature-locked-demo')).toHaveScreenshot('feature-lock-long-names.png');
    });

    test('upgrade modal - many features', async ({ page }) => {
      await page.goto('/demo/many-features');
      await page.click('[data-testid="open-upgrade-modal"]');
      await page.waitForSelector('.tier-features');
      
      // Test with many features in list
      await expect(page.locator('.tier-card:first-child')).toHaveScreenshot('tier-card-many-features.png');
    });

    test('feature lock - minimal content', async ({ page }) => {
      await page.goto('/demo/minimal-lock');
      await page.waitForSelector('.feature-lock-overlay');
      
      // Test minimal lock overlay
      await expect(page.locator('.minimal-lock-demo')).toHaveScreenshot('feature-lock-minimal.png');
    });
  });

  test.describe('Responsive Breakpoint Screenshots', () => {
    const breakpoints = [
      { name: 'mobile-small', width: 320, height: 568 },
      { name: 'mobile', width: 375, height: 667 },
      { name: 'mobile-large', width: 414, height: 896 },
      { name: 'tablet-portrait', width: 768, height: 1024 },
      { name: 'tablet-landscape', width: 1024, height: 768 },
      { name: 'desktop-small', width: 1280, height: 720 },
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'desktop-large', width: 1920, height: 1080 }
    ];

    for (const breakpoint of breakpoints) {
      test(`upgrade modal - ${breakpoint.name}`, async ({ page }) => {
        await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
        
        await page.goto('/demo/upgrade-prompt');
        await page.click('[data-testid="open-upgrade-modal"]');
        await page.waitForSelector('.upgrade-modal-overlay');
        
        // Screenshot at each breakpoint
        await expect(page.locator('.upgrade-modal-overlay'))
          .toHaveScreenshot(`upgrade-modal-${breakpoint.name}.png`);
      });
    }
  });
});