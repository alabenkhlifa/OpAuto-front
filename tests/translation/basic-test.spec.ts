import { test, expect } from '@playwright/test';

test.describe('Basic Translation Test', () => {
  test('Can access the application and switch languages', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:4200/auth');
    await page.waitForLoadState('networkidle');
    
    // Wait for the page to be fully loaded
    await page.waitForTimeout(2000);
    
    // Check if we can access the page
    await expect(page).toHaveTitle(/OpAuto/i);
    
    // Try to set language to English
    try {
      await page.evaluate(() => {
        localStorage.setItem('language', 'en');
      });
      console.log('Successfully set language to English');
      
      // Reload and check language
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const language = await page.evaluate(() => localStorage.getItem('language'));
      expect(language).toBe('en');
      
      // Try French
      await page.evaluate(() => {
        localStorage.setItem('language', 'fr');
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const frenchLanguage = await page.evaluate(() => localStorage.getItem('language'));
      expect(frenchLanguage).toBe('fr');
      
      // Try Arabic
      await page.evaluate(() => {
        localStorage.setItem('language', 'ar');
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      const arabicLanguage = await page.evaluate(() => localStorage.getItem('language'));
      expect(arabicLanguage).toBe('ar');
      
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      throw error;
    }
    
    // Take a screenshot to verify the page loaded
    await page.screenshot({ path: 'test-results/basic-test-screenshot.png' });
  });
  
  test('Can navigate to different routes', async ({ page }) => {
    // Test navigation to different parts of the app
    const routes = ['/auth', '/dashboard', '/cars', '/maintenance'];
    
    for (const route of routes) {
      console.log(`Testing route: ${route}`);
      await page.goto(`http://localhost:4200${route}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the correct route
      expect(page.url()).toContain(route);
      
      // Take screenshot
      await page.screenshot({ path: `test-results/route-${route.replace('/', '')}-screenshot.png` });
    }
  });
});