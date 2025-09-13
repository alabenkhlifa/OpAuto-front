import { test, expect } from '@playwright/test';
import { DashboardTestUtils } from './utils/screen-specific-utils';

test.describe('Dashboard Status Translation Validation - Critical Test', () => {
  let dashboardUtils: DashboardTestUtils;

  test.beforeEach(async ({ page }) => {
    dashboardUtils = new DashboardTestUtils(page);
  });

  test('CRITICAL: Dashboard must NOT show raw translation keys for status badges', async () => {
    console.log('🚨 RUNNING CRITICAL TRANSLATION VALIDATION');
    
    // Test all three languages for translation key issues
    const languages = ['en', 'fr', 'ar'] as const;
    
    for (const language of languages) {
      console.log(`\n🔍 Testing ${language.toUpperCase()} for translation key leaks...`);
      
      // Switch to language
      await dashboardUtils.switchLanguage(language);
      await dashboardUtils.navigateToRoute('/dashboard');
      
      // Look for ALL text in the page and check for translation keys
      const pageText = await dashboardUtils.page.locator('body').textContent();
      
      // Critical translation keys that were found showing as raw text
      const criticalMissingKeys = [
        'dashboard.status.in_progress',
        'dashboard.status.in_repair', 
        'dashboard.status.quality_check',
        'dashboard.status.waiting_parts'
      ];
      
      console.log(`📝 Page text length: ${pageText?.length || 0} characters`);
      
      // Check each critical key
      for (const key of criticalMissingKeys) {
        if (pageText?.includes(key)) {
          // Take screenshot for evidence
          await dashboardUtils.takeScreenshot(`FAILED-translation-key-${key}-${language}`, language);
          
          console.error(`❌ CRITICAL FAILURE: Found raw translation key "${key}" in ${language} version`);
          console.error(`📍 This means the translation system is not working properly`);
          
          // Find the specific element containing the key for debugging
          const elementWithKey = dashboardUtils.page.locator(`text="${key}"`).first();
          if (await elementWithKey.count() > 0) {
            const elementHTML = await elementWithKey.innerHTML();
            console.error(`🔍 Element containing key: ${elementHTML}`);
          }
          
          throw new Error(`🚨 TRANSLATION SYSTEM FAILURE: Raw key "${key}" found in ${language} dashboard instead of translated text`);
        } else {
          console.log(`✅ Key "${key}" properly translated in ${language}`);
        }
      }
      
      // Additional validation: Check common status areas
      await dashboardUtils.verifyDashboardStatusTranslations();
      
      console.log(`✅ ${language.toUpperCase()} dashboard translation validation passed`);
    }
    
    console.log('\n🎉 ALL LANGUAGES PASSED - No translation key leaks detected');
  });

  test('VALIDATION: All dashboard status elements should have proper translations', async () => {
    const languages = ['en', 'fr', 'ar'] as const;
    
    for (const language of languages) {
      await dashboardUtils.switchLanguage(language);
      await dashboardUtils.navigateToRoute('/dashboard');
      
      // Find all status-related elements
      const statusElements = await dashboardUtils.page.locator('[class*="status"], [class*="badge"], generic').all();
      
      for (const element of statusElements) {
        const text = await element.textContent();
        if (text && text.trim()) {
          // Status text should not be empty and should not contain dots (translation key pattern)
          expect(text.trim()).not.toBe('');
          
          // If it contains dots, it should not be a translation key format
          if (text.includes('.')) {
            const isDotSeparatedKey = /^[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/.test(text.trim());
            if (isDotSeparatedKey) {
              throw new Error(`Translation key detected as display text: "${text.trim()}" in ${language}`);
            }
          }
        }
      }
    }
  });

  test('DIAGNOSTIC: Log all dashboard text for translation analysis', async () => {
    const languages = ['en', 'fr', 'ar'] as const;
    
    for (const language of languages) {
      console.log(`\n=== ${language.toUpperCase()} DASHBOARD TEXT ANALYSIS ===`);
      
      await dashboardUtils.switchLanguage(language);
      await dashboardUtils.navigateToRoute('/dashboard');
      
      // Get all text elements and log them
      const textElements = await dashboardUtils.page.locator('*').filter({ hasText: /.+/ }).all();
      
      const uniqueTexts = new Set<string>();
      
      for (const element of textElements) {
        const text = await element.textContent();
        if (text && text.trim() && !uniqueTexts.has(text.trim())) {
          uniqueTexts.add(text.trim());
          
          // Check if it looks like a translation key
          const looksLikeKey = /^[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*$/.test(text.trim());
          if (looksLikeKey) {
            console.log(`🚨 POSSIBLE TRANSLATION KEY: "${text.trim()}"`);
          } else if (text.trim().length < 50) { // Only log shorter texts to avoid spam
            console.log(`📝 TEXT: "${text.trim()}"`);
          }
        }
      }
      
      console.log(`📊 Found ${uniqueTexts.size} unique text elements in ${language}`);
    }
  });
});