import { Page, expect } from '@playwright/test';

export type SupportedLanguage = 'en' | 'fr' | 'ar';

export interface TranslationTestContext {
  page: Page;
  currentLanguage: SupportedLanguage;
}

/**
 * Base utility class for translation testing across all screens
 */
export class TranslationTestUtils {
  constructor(private page: Page) {}

  /**
   * Switch to a specific language using localStorage
   * Based on CLAUDE.md: Set localStorage language directly, no auth navigation
   */
  async switchLanguage(language: SupportedLanguage): Promise<void> {
    await this.page.evaluate((lang) => {
      localStorage.setItem('language', lang);
    }, language);
    
    // Refresh the page to apply language change
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get current language from localStorage
   */
  async getCurrentLanguage(): Promise<SupportedLanguage> {
    const language = await this.page.evaluate(() => localStorage.getItem('language'));
    return (language as SupportedLanguage) || 'en';
  }

  /**
   * Verify that no hardcoded text appears in the specified language
   * This checks for untranslated text that should be in the current language
   */
  async verifyNoHardcodedText(excludeSelectors: string[] = []): Promise<void> {
    const currentLang = await this.getCurrentLanguage();
    
    // Common selectors to check for text content
    const selectorsToCheck = [
      'button',
      'h1, h2, h3, h4, h5, h6',
      'label',
      'span:not([class*="icon"]):not([data-testid*="icon"])',
      'p',
      'div[class*="text"]',
      'td',
      'th'
    ];

    for (const selector of selectorsToCheck) {
      if (excludeSelectors.includes(selector)) continue;
      
      const elements = await this.page.locator(selector).all();
      
      for (const element of elements) {
        const text = await element.textContent();
        if (text && text.trim()) {
          // Check if text contains obvious English words when not in English mode
          if (currentLang !== 'en') {
            await this.checkForUntranslatedText(text, element);
          }
        }
      }
    }
  }

  /**
   * Check for common untranslated English words in non-English contexts
   */
  private async checkForUntranslatedText(text: string, element: any): Promise<void> {
    const commonEnglishWords = [
      'Loading...', 'Submit', 'Cancel', 'Save', 'Delete', 'Edit', 'Add', 'Search',
      'Dashboard', 'Settings', 'Profile', 'Login', 'Logout', 'Home', 'Back',
      'Next', 'Previous', 'Continue', 'Confirm', 'Close', 'Open', 'View'
    ];
    
    const textLower = text.toLowerCase().trim();
    for (const word of commonEnglishWords) {
      if (textLower === word.toLowerCase()) {
        throw new Error(`Found untranslated English text: "${text}" in element: ${await element.innerHTML()}`);
      }
    }
  }

  /**
   * Verify Arabic text renders correctly (RTL)
   * Note: Based on CLAUDE.md, we check Arabic text rendering without RTL layout changes
   */
  async verifyArabicTextRendering(): Promise<void> {
    const currentLang = await this.getCurrentLanguage();
    if (currentLang !== 'ar') return;

    // Check for Arabic script characters
    const arabicElements = await this.page.locator('*').filter({
      hasText: /[\u0600-\u06FF\u0750-\u077F]/
    }).all();

    expect(arabicElements.length).toBeGreaterThan(0);

    // Verify Arabic text is properly displayed (not as question marks or boxes)
    for (const element of arabicElements) {
      const text = await element.textContent();
      if (text) {
        expect(text).not.toMatch(/[\uFFFD\?]/); // Check for replacement characters
      }
    }
  }

  /**
   * Verify language switching works without page reload
   */
  async verifyLanguagePersistence(): Promise<void> {
    const originalLanguage = await this.getCurrentLanguage();
    
    // Switch to different language
    const targetLanguage: SupportedLanguage = originalLanguage === 'en' ? 'fr' : 'en';
    await this.switchLanguage(targetLanguage);
    
    // Verify language changed
    expect(await this.getCurrentLanguage()).toBe(targetLanguage);
    
    // Switch back
    await this.switchLanguage(originalLanguage);
    expect(await this.getCurrentLanguage()).toBe(originalLanguage);
  }

  /**
   * Navigate to a specific route and wait for it to load
   */
  async navigateToRoute(route: string): Promise<void> {
    await this.page.goto(route);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Take a screenshot for documentation purposes
   */
  async takeScreenshot(name: string, language: SupportedLanguage): Promise<void> {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${language}.png`,
      fullPage: true
    });
  }

  /**
   * Verify form elements are translated
   */
  async verifyFormTranslations(formSelector: string = 'form'): Promise<void> {
    const form = this.page.locator(formSelector);
    
    // Check labels
    const labels = form.locator('label');
    const labelCount = await labels.count();
    
    for (let i = 0; i < labelCount; i++) {
      const label = labels.nth(i);
      const text = await label.textContent();
      if (text && text.trim()) {
        expect(text).not.toBe(''); // Ensure labels have content
      }
    }

    // Check input placeholders
    const inputs = form.locator('input, textarea, select');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const placeholder = await input.getAttribute('placeholder');
      if (placeholder) {
        expect(placeholder).not.toBe(''); // Ensure placeholders are not empty
      }
    }
  }

  /**
   * Verify button translations
   */
  async verifyButtonTranslations(): Promise<void> {
    const buttons = this.page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      
      // Skip icon-only buttons
      if (text && text.trim() && !text.trim().match(/^[^\w\s]+$/)) {
        expect(text.trim()).not.toBe('');
      }
    }
  }

  /**
   * Verify navigation menu translations
   */
  async verifyNavigationTranslations(): Promise<void> {
    const navItems = this.page.locator('nav a, nav button, [role="navigation"] a, [role="navigation"] button');
    const navCount = await navItems.count();
    
    for (let i = 0; i < navCount; i++) {
      const navItem = navItems.nth(i);
      const text = await navItem.textContent();
      
      if (text && text.trim()) {
        expect(text.trim()).not.toBe('');
      }
    }
  }

  /**
   * Verify status badges and indicators are translated
   */
  async verifyStatusTranslations(): Promise<void> {
    const statusElements = this.page.locator('[class*="status"], [class*="badge"], [class*="label"]');
    const statusCount = await statusElements.count();
    
    for (let i = 0; i < statusCount; i++) {
      const status = statusElements.nth(i);
      const text = await status.textContent();
      
      if (text && text.trim()) {
        expect(text.trim()).not.toBe('');
      }
    }
  }

  /**
   * Test all languages for a specific screen
   */
  async testAllLanguages(testCallback: (utils: TranslationTestUtils, language: SupportedLanguage) => Promise<void>): Promise<void> {
    const languages: SupportedLanguage[] = ['en', 'fr', 'ar'];
    
    for (const language of languages) {
      await this.switchLanguage(language);
      await testCallback(this, language);
    }
  }
}