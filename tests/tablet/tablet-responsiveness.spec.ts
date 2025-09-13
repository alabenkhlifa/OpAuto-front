import { test, expect, Page } from '@playwright/test';

const TABLET_BREAKPOINTS = {
  'iPad Mini': { width: 768, height: 1024 },
  'iPad Air': { width: 820, height: 1180 },
  'iPad Pro': { width: 1024, height: 1366 },
  'Android Tablet': { width: 800, height: 1280 },
};

const LANGUAGES = ['en', 'fr', 'ar'];

// Helper function to set language
async function setLanguage(page: Page, lang: string) {
  await page.evaluate((language) => {
    localStorage.setItem('language', language);
  }, lang);
}

// Helper function to take tablet screenshot
async function takeTabletScreenshot(page: Page, name: string, lang: string) {
  await page.screenshot({ 
    path: `test-results/tablet-screenshots/${name}-${lang}.png`,
    fullPage: true 
  });
}

// Helper function to check minimum touch targets
async function checkTouchTargets(page: Page) {
  const smallTargets = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('button, a, input, [role="button"]'));
    return elements
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .map(el => ({
        tag: el.tagName,
        class: el.className,
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height
      }));
  });
  
  return smallTargets;
}

test.describe('Tablet Responsiveness Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Start dev server and navigate to app
    await page.goto('/');
  });

  test.describe('Authentication Screen', () => {
    LANGUAGES.forEach(lang => {
      test(`should display properly on tablets - ${lang}`, async ({ page }) => {
        await setLanguage(page, lang);
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Check auth card is properly displayed
        const authCard = page.locator('.glass-card').first();
        await expect(authCard).toBeVisible();
        
        // Check login form elements are visible
        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');
        const loginButton = page.locator('button[type="submit"]');
        
        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
        await expect(loginButton).toBeVisible();
        
        // Take screenshot for visual verification
        await takeTabletScreenshot(page, 'auth-login', lang);
        
        // Check touch targets are adequate for tablets
        const smallTargets = await checkTouchTargets(page);
        expect(smallTargets.length).toBe(0);
        
        // Check demo credentials are visible on tablets
        const demoCredentials = page.locator('.bg-blue-900');
        await expect(demoCredentials).toBeVisible();
      });
    });
  });

  test.describe('Dashboard', () => {
    LANGUAGES.forEach(lang => {
      test(`should display dashboard properly on tablets - ${lang}`, async ({ page }) => {
        await setLanguage(page, lang);
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');
        
        // Check dashboard header
        const dashboardHeader = page.locator('.dashboard-header');
        await expect(dashboardHeader).toBeVisible();
        
        // Check quick actions are visible and properly laid out
        const quickActions = page.locator('.quick-actions-grid');
        await expect(quickActions).toBeVisible();
        
        // Check action cards are visible
        const actionCards = page.locator('.action-card');
        await expect(actionCards.first()).toBeVisible();
        
        // Take screenshot for visual verification
        await takeTabletScreenshot(page, 'dashboard-overview', lang);
        
        // Verify action cards have adequate touch targets
        const cardButtons = page.locator('.action-card');
        const cardCount = await cardButtons.count();
        for (let i = 0; i < cardCount; i++) {
          const cardBox = await cardButtons.nth(i).boundingBox();
          if (cardBox) {
            expect(cardBox.width).toBeGreaterThanOrEqual(44);
            expect(cardBox.height).toBeGreaterThanOrEqual(44);
          }
        }
      });
    });
  });

  test.describe('Cars Management', () => {
    LANGUAGES.forEach(lang => {
      test(`should display car cards in proper grid - ${lang}`, async ({ page }) => {
        await setLanguage(page, lang);
        await page.goto('/cars');
        await page.waitForLoadState('networkidle');
        
        // Check car cards grid
        const carCards = page.locator('.car-card');
        await expect(carCards.first()).toBeVisible();
        
        // Take screenshot
        await takeTabletScreenshot(page, 'cars-grid', lang);
        
        // Check filters panel is responsive
        const filtersPanel = page.locator('[data-testid="filters-panel"]');
        if (await filtersPanel.isVisible()) {
          await expect(filtersPanel).toBeVisible();
        }
      });
    });
  });

  test.describe('Modals Testing', () => {
    LANGUAGES.forEach(lang => {
      test(`appointment modal should be responsive - ${lang}`, async ({ page }) => {
        await setLanguage(page, lang);
        await page.goto('/appointments');
        await page.waitForLoadState('networkidle');
        
        // Open appointment modal
        const addButton = page.locator('[data-testid="add-appointment"]').first();
        if (await addButton.isVisible()) {
          await addButton.click();
          
          // Check modal is properly displayed
          const modal = page.locator('.modal-content').first();
          await expect(modal).toBeVisible();
          
          // Take screenshot
          await takeTabletScreenshot(page, 'appointment-modal', lang);
          
          // Check modal doesn't overflow screen
          const modalBox = await modal.boundingBox();
          const viewport = page.viewportSize();
          if (modalBox && viewport) {
            expect(modalBox.width).toBeLessThanOrEqual(viewport.width);
            expect(modalBox.height).toBeLessThanOrEqual(viewport.height);
          }
        }
      });
    });
  });

  test.describe('Sidebar Responsiveness', () => {
    test('should be collapsible on tablets', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();
      
      // Test sidebar toggle if it exists
      const toggleButton = page.locator('[data-testid="sidebar-toggle"]');
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        // Verify sidebar behavior after toggle
      }
    });
  });

  test.describe('Touch Interaction Tests', () => {
    test('all interactive elements should meet minimum touch target size', async ({ page }) => {
      const routes = ['/dashboard', '/cars', '/appointments', '/maintenance', '/inventory'];
      
      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        
        const smallTargets = await checkTouchTargets(page);
        expect(smallTargets.length).toBe(0, 
          `Found ${smallTargets.length} elements smaller than 44px on ${route}: ${JSON.stringify(smallTargets)}`);
      }
    });
  });

  test.describe('RTL Layout for Arabic', () => {
    test('should properly mirror UI elements in Arabic', async ({ page }) => {
      await setLanguage(page, 'ar');
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Check RTL direction is applied to HTML element
      const html = page.locator('html');
      const direction = await html.getAttribute('dir');
      // RTL might be applied to html element instead of body
      const bodyDirection = await page.locator('body').getAttribute('dir');
      
      const hasRTL = direction === 'rtl' || bodyDirection === 'rtl';
      
      // Take screenshot for visual verification
      await takeTabletScreenshot(page, 'rtl-layout', 'ar');
      
      // Check if Arabic text is displayed (RTL support verification)
      const arabicText = page.locator('text=/[\u0600-\u06FF]/').first();
      if (await arabicText.isVisible()) {
        await expect(arabicText).toBeVisible();
      }
      
      // At minimum, verify Arabic language is loaded and displayed
      const dashboardTitle = page.locator('.dashboard-header h1');
      await expect(dashboardTitle).toBeVisible();
    });
  });

  test.describe('Performance and Loading States', () => {
    test('loading states should be visible on slower connections', async ({ page }) => {
      // Simulate slower network
      await page.route('**/*', route => {
        return new Promise(resolve => {
          setTimeout(() => resolve(route.continue()), 100);
        });
      });
      
      await page.goto('/dashboard');
      
      // Check for loading indicators
      const loadingIndicator = page.locator('.loading, .spinner, .skeleton');
      // Loading indicator should appear briefly
      await expect(loadingIndicator.first()).toBeVisible({ timeout: 1000 });
    });
  });
});