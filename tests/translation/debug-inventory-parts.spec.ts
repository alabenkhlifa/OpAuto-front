import { test, expect } from '@playwright/test';

test.describe('Debug Inventory Parts Tab Content', () => {
  test('Debug - Investigate Parts tab content and translations', async ({ page }) => {
    // Navigate to inventory page
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.readyState === 'complete');
    await page.waitForTimeout(2000);

    console.log('=== DEBUGGING INVENTORY PARTS TAB ===');

    // Test Arabic language on Parts tab
    await page.evaluate(() => {
      localStorage.setItem('opauth_language', 'ar');
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    console.log('\n=== CHECKING INITIAL DASHBOARD VIEW ===');
    const initialBodyText = await page.locator('body').textContent();
    const hasInitialArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(initialBodyText || '');
    console.log(`Initial view has Arabic: ${hasInitialArabic}`);
    
    // Look for navigation tabs/buttons
    console.log('\n=== LOOKING FOR NAVIGATION TABS ===');
    const possibleTabs = [
      'button:has-text("Parts")',
      'button:has-text("القطع")', // Arabic for Parts
      'button:has-text("Pièces")', // French for Parts
      '[data-view="parts"]',
      'button[role="tab"]',
      'nav button',
      '.nav-tab',
      '.tab-button'
    ];
    
    for (const selector of possibleTabs) {
      const elements = await page.locator(selector).count();
      if (elements > 0) {
        const texts = await page.locator(selector).allTextContents();
        console.log(`Found ${elements} elements with selector "${selector}": ${JSON.stringify(texts)}`);
      }
    }
    
    // Try to click on Parts tab
    console.log('\n=== ATTEMPTING TO SWITCH TO PARTS TAB ===');
    const partsTabSelectors = [
      'button:has-text("Parts")',
      'button:has-text("القطع")',
      '[data-view="parts"]',
      'button[role="tab"]:nth-child(2)', // Often the second tab
      'nav button:nth-child(2)'
    ];
    
    let partsTabFound = false;
    for (const selector of partsTabSelectors) {
      const tab = page.locator(selector).first();
      if (await tab.count() > 0) {
        try {
          await tab.click();
          await page.waitForTimeout(2000);
          console.log(`Successfully clicked parts tab with selector: ${selector}`);
          partsTabFound = true;
          break;
        } catch (error) {
          console.log(`Failed to click parts tab with selector ${selector}: ${error}`);
        }
      }
    }
    
    if (!partsTabFound) {
      console.log('No parts tab found, checking if we\'re already on parts view');
    }
    
    console.log('\n=== CHECKING PARTS CONTENT ===');
    
    // Look for parts-specific content
    const partsContent = await page.evaluate(() => {
      const checks = [];
      
      // Look for table headers that might indicate parts
      const tableHeaders = document.querySelectorAll('th');
      for (const header of tableHeaders) {
        const text = header.textContent?.trim();
        if (text && text.length > 0) {
          checks.push({
            type: 'table_header',
            text: text,
            hasArabic: /[\u0600-\u06FF\u0750-\u077F]/.test(text)
          });
        }
      }
      
      // Look for search inputs
      const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="search" i]');
      for (const input of searchInputs) {
        const placeholder = input.getAttribute('placeholder');
        if (placeholder) {
          checks.push({
            type: 'search_placeholder',
            text: placeholder,
            hasArabic: /[\u0600-\u06FF\u0750-\u077F]/.test(placeholder)
          });
        }
      }
      
      // Look for filter dropdowns
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        const options = select.querySelectorAll('option');
        for (const option of options) {
          const text = option.textContent?.trim();
          if (text && text !== '' && text !== 'all') {
            checks.push({
              type: 'select_option',
              text: text,
              hasArabic: /[\u0600-\u06FF\u0750-\u077F]/.test(text)
            });
          }
        }
      }
      
      // Look for parts data in table rows
      const tableRows = document.querySelectorAll('tbody tr');
      for (let i = 0; i < Math.min(tableRows.length, 5); i++) {
        const row = tableRows[i];
        const text = row.textContent?.trim();
        if (text && text.length > 10) {
          checks.push({
            type: 'table_row',
            text: text.substring(0, 100),
            hasArabic: /[\u0600-\u06FF\u0750-\u077F]/.test(text)
          });
        }
      }
      
      // Look for any cards or items that might be parts
      const cards = document.querySelectorAll('[class*="card"], [class*="item"], [class*="part"]');
      for (let i = 0; i < Math.min(cards.length, 5); i++) {
        const card = cards[i];
        const text = card.textContent?.trim();
        if (text && text.length > 10) {
          checks.push({
            type: 'card_content',
            text: text.substring(0, 100),
            hasArabic: /[\u0600-\u06FF\u0750-\u077F]/.test(text)
          });
        }
      }
      
      return checks;
    });
    
    console.log('\n=== PARTS CONTENT ANALYSIS ===');
    let arabicContentFound = false;
    
    partsContent.forEach(item => {
      const status = item.hasArabic ? '✅ ARABIC' : '⚠️  English/Other';
      console.log(`${status} [${item.type}]: "${item.text}"`);
      if (item.hasArabic) arabicContentFound = true;
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total content items checked: ${partsContent.length}`);
    console.log(`Arabic content found: ${arabicContentFound}`);
    
    // Check current URL and view state
    const currentState = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyHasArabic: /[\u0600-\u06FF\u0750-\u077F]/.test(document.body.textContent || ''),
        currentView: document.querySelector('[data-view].active')?.getAttribute('data-view') || 'unknown'
      };
    });
    
    console.log('\n=== CURRENT STATE ===');
    console.log('Current state:', currentState);
    
    // Take screenshots for visual inspection
    await page.screenshot({ 
      path: 'test-results/inventory-parts-debug.png', 
      fullPage: true 
    });
    
    console.log('\n=== COMPLETED PARTS TAB INVESTIGATION ===');
    
    expect(true).toBe(true); // This test always passes - it's for debugging
  });
});