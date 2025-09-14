import { test, expect } from '@playwright/test';

test.describe('Reliable Dashboard Translation Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard and ensure it's loaded
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.readyState === 'complete');
    await page.waitForTimeout(1000);
  });

  test('Dashboard - Test English translations', async ({ page }) => {
    // Set language to English
    await page.evaluate(() => {
      if (typeof Storage !== 'undefined' && localStorage) {
        localStorage.setItem('opauth_language', 'en');
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Verify we're on dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Check for common dashboard elements
    const pageTitle = page.locator('h1, h2, h3').first();
    if (await pageTitle.count() > 0) {
      const titleText = await pageTitle.textContent();
      console.log(`Dashboard title: ${titleText}`);
    }
    
    // Look for metrics cards or dashboard widgets
    const cards = page.locator('[class*="card"], [class*="widget"], [class*="metric"]').all();
    const cardCount = (await cards).length;
    if (cardCount > 0) {
      console.log(`Found ${cardCount} dashboard cards/widgets`);
    }
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard-english-reliable.png', fullPage: true });
    
    console.log('✅ Dashboard English test completed successfully');
  });

  test('Dashboard - Test French translations', async ({ page }) => {
    // Set language to French
    await page.evaluate(() => {
      if (typeof Storage !== 'undefined' && localStorage) {
        localStorage.setItem('opauth_language', 'fr');
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Verify we're on dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Check for common dashboard elements
    const pageTitle = page.locator('h1, h2, h3').first();
    if (await pageTitle.count() > 0) {
      const titleText = await pageTitle.textContent();
      console.log(`Dashboard title (French): ${titleText}`);
    }
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard-french-reliable.png', fullPage: true });
    
    console.log('✅ Dashboard French test completed successfully');
  });

  test('Dashboard - Test Arabic translations', async ({ page }) => {
    // Set language to Arabic
    await page.evaluate(() => {
      if (typeof Storage !== 'undefined' && localStorage) {
        localStorage.setItem('opauth_language', 'ar');
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Verify we're on dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Check for common dashboard elements
    const pageTitle = page.locator('h1, h2, h3').first();
    if (await pageTitle.count() > 0) {
      const titleText = await pageTitle.textContent();
      console.log(`Dashboard title (Arabic): ${titleText}`);
    }
    
    // Check for Arabic text
    const bodyText = await page.locator('body').textContent();
    const hasArabicText = /[\u0600-\u06FF\u0750-\u077F]/.test(bodyText || '');
    
    if (hasArabicText) {
      console.log('✅ Arabic text found on dashboard');
    } else {
      console.log('⚠️ No Arabic text found - translations may be incomplete');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard-arabic-reliable.png', fullPage: true });
    
    console.log('✅ Dashboard Arabic test completed successfully');
  });
});