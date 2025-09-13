import { test, expect } from '@playwright/test';

test.describe('Debug Parts Translations with Hard Refresh', () => {
  test('Test Parts translations after forcing translation reload', async ({ page }) => {
    console.log('=== TESTING PARTS TRANSLATIONS WITH HARD REFRESH ===');
    
    // Clear all browser data to force fresh translation load
    await page.goto('about:blank');
    await page.evaluate(() => {
      if (typeof Storage !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
    });
    
    // Set language to Arabic first, then navigate
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => {
      localStorage.setItem('opauth_language', 'ar');
    });
    
    // Hard refresh to force translation reload
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // Give more time for translations to load
    
    // Switch to Parts tab
    const partsTab = page.locator('button:has-text("القطع"), button:has-text("كتالوج القطع")').first();
    if (await partsTab.count() > 0) {
      await partsTab.click();
      await page.waitForTimeout(2000);
      console.log('✅ Successfully switched to Parts tab');
    }
    
    // Check specific translation keys that should now be translated
    const translationChecks = await page.evaluate(() => {
      const results = [];
      
      // Check search placeholder
      const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]');
      if (searchInput) {
        const placeholder = searchInput.getAttribute('placeholder') || '';
        results.push({
          element: 'search_placeholder',
          text: placeholder,
          isTranslated: !placeholder.includes('inventory.') && placeholder.includes('البحث'),
          expected: 'البحث عن قطع الغيار...'
        });
      }
      
      // Check dropdown options for "All Categories"
      const categoryOptions = document.querySelectorAll('select option');
      for (const option of categoryOptions) {
        const text = option.textContent?.trim() || '';
        if (text.includes('inventory.partsCatalog.allCategories') || text === 'All Categories' || text.includes('جميع الفئات')) {
          results.push({
            element: 'category_dropdown',
            text: text,
            isTranslated: text === 'جميع الفئات',
            expected: 'جميع الفئات'
          });
          break;
        }
      }
      
      // Check stock status options
      for (const option of categoryOptions) {
        const text = option.textContent?.trim() || '';
        if (text.includes('inventory.stockStatus.inStock') || text === 'In Stock' || text.includes('متوفر')) {
          results.push({
            element: 'stock_status',
            text: text,
            isTranslated: text === 'متوفر',
            expected: 'متوفر'
          });
          break;
        }
      }
      
      return results;
    });
    
    console.log('\\n=== TRANSLATION VERIFICATION ===');
    let translatedCount = 0;
    let totalCount = translationChecks.length;
    
    for (const check of translationChecks) {
      const status = check.isTranslated ? '✅ TRANSLATED' : '❌ NOT TRANSLATED';
      console.log(`${status} [${check.element}]: "${check.text}" (expected: "${check.expected}")`);
      if (check.isTranslated) translatedCount++;
    }
    
    console.log(`\\n=== RESULTS ===`);
    console.log(`Translated: ${translatedCount}/${totalCount} elements`);
    console.log(`Translation success rate: ${Math.round((translatedCount/totalCount) * 100)}%`);
    
    // Take a screenshot for visual inspection
    await page.screenshot({ 
      path: 'test-results/parts-translations-after-refresh.png', 
      fullPage: true 
    });
    
    // Test should pass regardless - this is for debugging
    expect(true).toBe(true);
  });
});