import { test, expect } from '@playwright/test';

test.describe('Debug Arabic Translation Tests', () => {
  test('Debug - Detailed Arabic text investigation', async ({ page }) => {
    // Navigate to auth page and ensure it's loaded
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.readyState === 'complete');
    await page.waitForTimeout(2000);

    console.log('=== DEBUGGING ARABIC TRANSLATION LOADING ===');

    // Test 1: Check if translation service is loaded
    const hasTranslationService = await page.evaluate(() => {
      // Check if Angular and translation-related globals exist
      return {
        hasAngular: typeof window !== 'undefined' && (window as any).ng !== undefined,
        hasLocalStorage: typeof localStorage !== 'undefined',
        currentLang: localStorage.getItem('language'),
        bodyContent: document.body.textContent?.substring(0, 200) || 'No body content'
      };
    });
    
    console.log('Translation Service Check:', hasTranslationService);

    // Test 2: Set Arabic language and check immediate effect
    console.log('\n=== SETTING LANGUAGE TO ARABIC ===');
    await page.evaluate(() => {
      localStorage.setItem('language', 'ar');
    });
    
    // Wait and reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give more time for translations to load
    
    // Test 3: Check DOM content after Arabic language set
    const postArabicCheck = await page.evaluate(() => {
      return {
        currentLang: localStorage.getItem('language'),
        bodyText: document.body.textContent || 'No body text',
        htmlDir: document.documentElement.getAttribute('dir'),
        htmlLang: document.documentElement.getAttribute('lang'),
        hasArabicChars: /[\u0600-\u06FF\u0750-\u077F]/.test(document.body.textContent || ''),
        firstArabicText: (document.body.textContent || '').match(/[\u0600-\u06FF\u0750-\u077F]+[^\u0600-\u06FF\u0750-\u077F]*[\u0600-\u06FF\u0750-\u077F]*/)?.[0] || 'None found'
      };
    });
    
    console.log('Post-Arabic Check:', postArabicCheck);
    
    // Test 4: Check specific elements that should have Arabic text
    const elementChecks = await page.evaluate(() => {
      const checks = [];
      
      // Check common elements for Arabic text
      const selectors = ['h1', 'h2', 'h3', 'button', 'label', 'span', 'p', 'div'];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (let i = 0; i < Math.min(elements.length, 5); i++) {
          const element = elements[i];
          const text = element.textContent?.trim();
          if (text && text.length > 0) {
            const hasArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(text);
            if (hasArabic || text.length < 50) { // Log short text or Arabic text
              checks.push({
                selector: `${selector}[${i}]`,
                text: text.substring(0, 100),
                hasArabic,
                tagName: element.tagName
              });
            }
          }
        }
      }
      
      return checks;
    });
    
    console.log('\n=== ELEMENT CONTENT CHECK ===');
    elementChecks.forEach(check => {
      const status = check.hasArabic ? '✅ HAS ARABIC' : '⚠️  No Arabic';
      console.log(`${status} ${check.selector}: "${check.text}"`);
    });
    
    // Test 5: Check if i18n JSON is accessible
    const i18nCheck = await page.evaluate(async () => {
      try {
        // Try to fetch the Arabic i18n file directly
        const response = await fetch('/assets/i18n/ar.json');
        if (response.ok) {
          const arabicTranslations = await response.json();
          return {
            accessible: true,
            hasAuthTranslations: !!arabicTranslations.auth,
            sampleTranslation: arabicTranslations.auth?.title || 'Not found',
            commonSaveTranslation: arabicTranslations.common?.save || 'Not found'
          };
        } else {
          return { accessible: false, error: `HTTP ${response.status}` };
        }
      } catch (error) {
        return { accessible: false, error: error.toString() };
      }
    });
    
    console.log('\n=== I18N FILE CHECK ===');
    console.log('Arabic i18n file:', i18nCheck);
    
    // Test 6: Check network requests for i18n
    const networkRequests = await page.evaluate(() => {
      // This is a basic check - in a real app we'd need to monitor network tab
      return {
        currentUrl: window.location.href,
        baseHref: document.querySelector('base')?.getAttribute('href') || 'Not set'
      };
    });
    
    console.log('\n=== NETWORK INFO ===');
    console.log('Network info:', networkRequests);
    
    // Take a screenshot for visual inspection
    await page.screenshot({ 
      path: 'test-results/arabic-debug-screenshot.png', 
      fullPage: true 
    });
    
    // Test 7: Try to manually set some Arabic text to verify rendering
    await page.evaluate(() => {
      // Create a test div with Arabic text
      const testDiv = document.createElement('div');
      testDiv.id = 'arabic-test';
      testDiv.style.cssText = 'position: fixed; top: 10px; left: 10px; background: red; color: white; padding: 10px; z-index: 9999;';
      testDiv.textContent = 'اختبار النص العربي - Arabic Test Text';
      document.body.appendChild(testDiv);
    });
    
    // Take another screenshot with the test Arabic text
    await page.screenshot({ 
      path: 'test-results/arabic-debug-with-test-text.png', 
      fullPage: true 
    });
    
    // Final verification
    const finalCheck = await page.evaluate(() => {
      const testDiv = document.getElementById('arabic-test');
      return {
        testDivExists: !!testDiv,
        testDivText: testDiv?.textContent || 'Not found',
        testDivVisible: testDiv ? window.getComputedStyle(testDiv).display !== 'none' : false
      };
    });
    
    console.log('\n=== FINAL VERIFICATION ===');
    console.log('Arabic test div:', finalCheck);
    
    // The test passes regardless - this is for debugging
    expect(true).toBe(true);
  });
});