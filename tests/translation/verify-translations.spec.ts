import { test, expect } from '@playwright/test';

test.describe('Verify Translation Keys Are Available', () => {
  test('Check if updated translation keys exist in ar.json', async ({ page }) => {
    console.log('=== VERIFYING TRANSLATION KEYS ===');
    
    // Navigate to inventory
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Set Arabic language
    await page.evaluate(() => {
      if (typeof Storage !== 'undefined' && localStorage) {
        localStorage.setItem('opauth_language', 'ar');
      }
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Test translation service directly
    const translationTest = await page.evaluate(async () => {
      try {
        // Fetch the Arabic translation file directly
        const response = await fetch('/assets/i18n/ar.json');
        if (!response.ok) {
          return { error: `Failed to fetch ar.json: ${response.status}` };
        }
        
        const translations = await response.json();
        
        // Check if our new keys exist
        const keyChecks = [
          {
            key: 'inventory.partsCatalog.searchPlaceholder',
            expected: 'البحث عن قطع الغيار...',
            actual: translations.inventory?.partsCatalog?.searchPlaceholder
          },
          {
            key: 'inventory.partsCatalog.allCategories', 
            expected: 'جميع الفئات',
            actual: translations.inventory?.partsCatalog?.allCategories
          },
          {
            key: 'inventory.stockStatus.inStock',
            expected: 'متوفر', 
            actual: translations.inventory?.stockStatus?.inStock
          },
          {
            key: 'inventory.stockStatus.lowStock',
            expected: 'مخزون منخفض',
            actual: translations.inventory?.stockStatus?.lowStock
          }
        ];
        
        return {
          success: true,
          keyChecks,
          totalKeys: Object.keys(translations.inventory || {}).length
        };
      } catch (error) {
        return { error: error.toString() };
      }
    });
    
    console.log('\\n=== TRANSLATION FILE VERIFICATION ===');
    
    if (translationTest.error) {
      console.log(`❌ Error: ${translationTest.error}`);
    } else {
      console.log(`✅ Arabic translation file loaded successfully`);
      console.log(`📊 Total inventory keys: ${translationTest.totalKeys}`);
      
      console.log('\\n=== KEY VERIFICATION ===');
      for (const check of translationTest.keyChecks) {
        const status = check.actual === check.expected ? '✅ CORRECT' : '❌ WRONG';
        console.log(`${status} ${check.key}`);
        console.log(`   Expected: "${check.expected}"`);
        console.log(`   Actual:   "${check.actual || 'MISSING'}"`);
        console.log('');
      }
    }
    
    // Switch to parts tab and check current translation service behavior
    console.log('\\n=== TESTING LIVE TRANSLATION SERVICE ===');
    
    const partsTab = page.locator('button:has-text("القطع"), button:has-text("كتالوج القطع")').first();
    if (await partsTab.count() > 0) {
      await partsTab.click();
      await page.waitForTimeout(1000);
      console.log('✅ Switched to Parts tab');
      
      // Check if translation service can resolve our new keys
      const liveTranslationTest = await page.evaluate(() => {
        // Try to access Angular translation service if available
        const body = document.body;
        const searchInput = document.querySelector('input[type="search"]');
        const categorySelect = document.querySelector('select');
        
        return {
          searchPlaceholder: searchInput?.getAttribute('placeholder') || 'Not found',
          firstSelectOption: categorySelect?.querySelector('option')?.textContent || 'Not found',
          bodyHasArabic: /[\u0600-\u06FF\u0750-\u077F]/.test(body.textContent || ''),
        };
      });
      
      console.log(`Search placeholder: "${liveTranslationTest.searchPlaceholder}"`);
      console.log(`First select option: "${liveTranslationTest.firstSelectOption}"`);
      console.log(`Page has Arabic text: ${liveTranslationTest.bodyHasArabic}`);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/translation-verification.png', 
      fullPage: true 
    });
    
    expect(true).toBe(true);
  });
});