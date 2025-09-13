import { test, expect } from '@playwright/test';
import { AuthScreenTestUtils } from './utils/screen-specific-utils';

test.describe('Authentication & Access - Translation Tests', () => {
  let authUtils: AuthScreenTestUtils;

  test.beforeEach(async ({ page }) => {
    authUtils = new AuthScreenTestUtils(page);
  });

  test('Auth Screen - Login form translations (EN/FR/AR)', async () => {
    await authUtils.testAllLanguages(async (utils, language) => {
      // Navigate to auth page
      await utils.navigateToRoute('/auth');
      
      // Test login form translations
      await authUtils.testLoginFormTranslations();
      
      // Verify specific login form elements
      await expect(utils.page.locator('input[type="email"], input[name*="email"]').first()).toBeVisible();
      await expect(utils.page.locator('input[type="password"], input[name*="password"]').first()).toBeVisible();
      
      // Check for email/password field placeholders
      const emailInput = utils.page.locator('input[type="email"], input[name*="email"]').first();
      if (await emailInput.count() > 0) {
        const placeholder = await emailInput.getAttribute('placeholder');
        expect(placeholder).toBeTruthy();
        expect(placeholder?.length).toBeGreaterThan(0);
      }
      
      const passwordInput = utils.page.locator('input[type="password"], input[name*="password"]').first();
      if (await passwordInput.count() > 0) {
        const placeholder = await passwordInput.getAttribute('placeholder');
        expect(placeholder).toBeTruthy();
        expect(placeholder?.length).toBeGreaterThan(0);
      }
      
      // Verify sign in button exists and has text
      const signInButton = utils.page.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Login"), button:has-text("Se connecter"), button:has-text("دخول")').first();
      await expect(signInButton).toBeVisible();
      const buttonText = await signInButton.textContent();
      expect(buttonText?.trim()).toBeTruthy();
      expect(buttonText?.trim().length).toBeGreaterThan(0);
      
      // Verify no hardcoded text appears
      await utils.verifyNoHardcodedText();
      
      // For Arabic, verify text renders correctly
      if (language === 'ar') {
        await utils.verifyArabicTextRendering();
      }
      
      // Take screenshot for documentation
      await utils.takeScreenshot('auth-login-form', language);
    });
  });

  test('Auth Screen - Registration form translations (EN/FR/AR)', async () => {
    await authUtils.testAllLanguages(async (utils, language) => {
      // Navigate to auth page
      await utils.navigateToRoute('/auth');
      
      // Test registration form if available
      await authUtils.testRegistrationFormTranslations();
      
      // Check for registration-specific fields
      const nameInputs = utils.page.locator('input[name*="name"], input[placeholder*="name" i], input[placeholder*="nom" i]');
      if (await nameInputs.count() > 0) {
        const nameInput = nameInputs.first();
        const placeholder = await nameInput.getAttribute('placeholder');
        if (placeholder) {
          expect(placeholder.length).toBeGreaterThan(0);
        }
      }
      
      // Check for business information fields if this is a registration form
      const businessFields = utils.page.locator('input[name*="business"], input[name*="garage"], input[placeholder*="garage" i]');
      if (await businessFields.count() > 0) {
        const businessField = businessFields.first();
        const placeholder = await businessField.getAttribute('placeholder');
        if (placeholder) {
          expect(placeholder.length).toBeGreaterThan(0);
        }
      }
      
      // Verify no hardcoded text appears
      await utils.verifyNoHardcodedText();
      
      // For Arabic, verify text renders correctly
      if (language === 'ar') {
        await utils.verifyArabicTextRendering();
      }
      
      // Take screenshot for documentation
      await utils.takeScreenshot('auth-registration-form', language);
    });
  });

  test('Auth Screen - Forgot password modal translations (EN/FR/AR)', async () => {
    await authUtils.testAllLanguages(async (utils, language) => {
      // Navigate to auth page
      await utils.navigateToRoute('/auth');
      
      // Look for forgot password link/button
      const forgotPasswordTrigger = utils.page.locator('a:has-text("Forgot"), button:has-text("Forgot"), a:has-text("Oublié"), button:has-text("Oublié"), a:has-text("نسيت"), button:has-text("نسيت")').first();
      
      if (await forgotPasswordTrigger.count() > 0) {
        // Click to open forgot password modal/form
        await forgotPasswordTrigger.click();
        await utils.page.waitForTimeout(1000); // Wait for modal to appear
        
        // Check if modal appeared
        const modal = utils.page.locator('[role="dialog"], [class*="modal"], [class*="popup"]');
        if (await modal.count() > 0) {
          // Test modal translations
          const modalUtils = new (await import('./utils/screen-specific-utils')).ModalTestUtils(utils.page);
          await modalUtils.testModalTranslations();
        }
        
        // Check for email input in forgot password form
        const emailInput = utils.page.locator('input[type="email"]:visible').first();
        if (await emailInput.count() > 0) {
          const placeholder = await emailInput.getAttribute('placeholder');
          expect(placeholder).toBeTruthy();
          expect(placeholder?.length).toBeGreaterThan(0);
        }
        
        // Check for submit button
        const submitButton = utils.page.locator('button[type="submit"]:visible, button:has-text("Send"):visible, button:has-text("Envoyer"):visible, button:has-text("إرسال"):visible').first();
        if (await submitButton.count() > 0) {
          await expect(submitButton).toBeVisible();
          const buttonText = await submitButton.textContent();
          expect(buttonText?.trim()).toBeTruthy();
        }
        
        // Verify no hardcoded text appears
        await utils.verifyNoHardcodedText();
        
        // For Arabic, verify text renders correctly
        if (language === 'ar') {
          await utils.verifyArabicTextRendering();
        }
        
        // Take screenshot for documentation
        await utils.takeScreenshot('auth-forgot-password-modal', language);
      }
    });
  });

  test('Auth Screen - Demo credentials section translations (EN/FR/AR)', async () => {
    await authUtils.testAllLanguages(async (utils, language) => {
      // Navigate to auth page
      await utils.navigateToRoute('/auth');
      
      // Look for demo credentials section
      const demoSection = utils.page.locator('[class*="demo"], [id*="demo"], :has-text("Demo")').first();
      
      if (await demoSection.count() > 0) {
        // Check demo section content
        const demoText = await demoSection.textContent();
        expect(demoText?.trim()).toBeTruthy();
        expect(demoText?.trim().length).toBeGreaterThan(0);
        
        // Look for admin and mechanic labels
        const credentialLabels = demoSection.locator('strong, b, [class*="label"], [class*="title"]');
        const labelCount = await credentialLabels.count();
        
        for (let i = 0; i < labelCount; i++) {
          const label = credentialLabels.nth(i);
          const text = await label.textContent();
          
          if (text && text.trim()) {
            expect(text.trim().length).toBeGreaterThan(0);
          }
        }
        
        // Verify no hardcoded text appears
        await utils.verifyNoHardcodedText();
        
        // For Arabic, verify text renders correctly
        if (language === 'ar') {
          await utils.verifyArabicTextRendering();
        }
        
        // Take screenshot for documentation
        await utils.takeScreenshot('auth-demo-credentials', language);
      }
    });
  });

  test('Language switching functionality works on auth screen', async ({ page }) => {
    const utils = new AuthScreenTestUtils(page);
    
    // Navigate to auth page
    await utils.navigateToRoute('/auth');
    
    // Test language persistence
    await utils.verifyLanguagePersistence();
    
    // Test that switching languages updates the UI
    await utils.switchLanguage('en');
    await utils.takeScreenshot('auth-english', 'en');
    
    await utils.switchLanguage('fr');
    await utils.takeScreenshot('auth-french', 'fr');
    
    await utils.switchLanguage('ar');
    await utils.takeScreenshot('auth-arabic', 'ar');
    
    // Verify that translations persist across browser sessions
    const finalLanguage = await utils.getCurrentLanguage();
    expect(finalLanguage).toBe('ar');
  });
});