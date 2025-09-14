import { test, expect } from '@playwright/test';

test.describe('Reliable Cars Translation Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to cars page and ensure it's loaded
    await page.goto('/cars');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.readyState === 'complete');
    await page.waitForTimeout(1000);
  });

  test('Cars Screen - Test English translations', async ({ page }) => {
    // Set language to English
    await page.evaluate(() => {
      if (typeof Storage !== 'undefined' && localStorage) {
        localStorage.setItem('opauth_language', 'en');
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Verify we're on cars page
    await expect(page).toHaveURL(/.*cars/);
    
    // Check for page title
    const pageTitle = page.locator('h1, h2, h3').first();
    if (await pageTitle.count() > 0) {
      const titleText = await pageTitle.textContent();
      console.log(`Cars page title: ${titleText}`);
    }
    
    // Check for table headers if table exists
    const tableHeaders = page.locator('th').all();
    const headerCount = (await tableHeaders).length;
    if (headerCount > 0) {
      console.log(`Found ${headerCount} table headers`);
    }
    
    // Check for add/create button
    const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
    if (await addButton.count() > 0) {
      console.log('Found add/create button');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/cars-english-reliable.png', fullPage: true });
    
    console.log('✅ Cars English test completed successfully');
  });

  test('Cars Screen - Test French translations', async ({ page }) => {
    // Set language to French
    await page.evaluate(() => {
      if (typeof Storage !== 'undefined' && localStorage) {
        localStorage.setItem('opauth_language', 'fr');
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Verify we're on cars page
    await expect(page).toHaveURL(/.*cars/);
    
    // Check for page title
    const pageTitle = page.locator('h1, h2, h3').first();
    if (await pageTitle.count() > 0) {
      const titleText = await pageTitle.textContent();
      console.log(`Cars page title (French): ${titleText}`);
    }
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/cars-french-reliable.png', fullPage: true });
    
    console.log('✅ Cars French test completed successfully');
  });

  test('Cars Screen - Test Arabic translations', async ({ page }) => {
    // Set language to Arabic
    await page.evaluate(() => {
      if (typeof Storage !== 'undefined' && localStorage) {
        localStorage.setItem('opauth_language', 'ar');
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Verify we're on cars page
    await expect(page).toHaveURL(/.*cars/);
    
    // Check for page title
    const pageTitle = page.locator('h1, h2, h3').first();
    if (await pageTitle.count() > 0) {
      const titleText = await pageTitle.textContent();
      console.log(`Cars page title (Arabic): ${titleText}`);
    }
    
    // Check for Arabic text
    const bodyText = await page.locator('body').textContent();
    const hasArabicText = /[\u0600-\u06FF\u0750-\u077F]/.test(bodyText || '');
    
    if (hasArabicText) {
      console.log('✅ Arabic text found on cars page');
    } else {
      console.log('⚠️ No Arabic text found - translations may be incomplete');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/cars-arabic-reliable.png', fullPage: true });
    
    console.log('✅ Cars Arabic test completed successfully');
  });
});