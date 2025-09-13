import { Page, expect } from '@playwright/test';
import { TranslationTestUtils, SupportedLanguage } from './translation-utils';

/**
 * Screen-specific translation testing utilities
 */

export class AuthScreenTestUtils extends TranslationTestUtils {
  constructor(page: Page) {
    super(page);
  }

  async testLoginFormTranslations(): Promise<void> {
    await this.verifyFormTranslations();
    
    // Verify specific auth elements
    await expect(this.page.locator('input[type="email"]')).toHaveAttribute('placeholder');
    await expect(this.page.locator('input[type="password"]')).toHaveAttribute('placeholder');
    
    // Check login button
    const loginButton = this.page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
    await expect(loginButton).toBeVisible();
    
    // Check forgot password link
    const forgotPasswordLink = this.page.locator('a:has-text("Forgot"), button:has-text("Forgot")').first();
    if (await forgotPasswordLink.count() > 0) {
      await expect(forgotPasswordLink).toBeVisible();
    }
  }

  async testRegistrationFormTranslations(): Promise<void> {
    // Navigate to registration if available
    const registerLink = this.page.locator('a:has-text("Register"), button:has-text("Register")').first();
    if (await registerLink.count() > 0) {
      await registerLink.click();
      await this.page.waitForLoadState('networkidle');
    }

    await this.verifyFormTranslations();
    
    // Verify registration specific fields
    const nameInput = this.page.locator('input[name*="name"], input[placeholder*="name" i]').first();
    if (await nameInput.count() > 0) {
      await expect(nameInput).toHaveAttribute('placeholder');
    }
  }
}

export class DashboardTestUtils extends TranslationTestUtils {
  constructor(page: Page) {
    super(page);
  }

  async testMetricsCardsTranslations(): Promise<void> {
    // Look for common dashboard metric cards
    const metricCards = this.page.locator('[class*="card"], [class*="metric"], [class*="stat"]');
    const cardCount = await metricCards.count();
    
    for (let i = 0; i < cardCount; i++) {
      const card = metricCards.nth(i);
      const text = await card.textContent();
      
      if (text && text.trim()) {
        expect(text.trim()).not.toBe('');
      }
    }
  }

  async testQuickActionsTranslations(): Promise<void> {
    const quickActionButtons = this.page.locator('[class*="quick-action"], [class*="action-button"]');
    await this.verifyButtonTranslations();
  }
}

export class NavigationTestUtils extends TranslationTestUtils {
  constructor(page: Page) {
    super(page);
  }

  async testSidebarTranslations(): Promise<void> {
    const sidebar = this.page.locator('nav, [class*="sidebar"], [class*="navigation"]').first();
    
    if (await sidebar.count() > 0) {
      const navLinks = sidebar.locator('a, button[role="menuitem"]');
      const linkCount = await navLinks.count();
      
      for (let i = 0; i < linkCount; i++) {
        const link = navLinks.nth(i);
        const text = await link.textContent();
        
        if (text && text.trim()) {
          expect(text.trim()).not.toBe('');
        }
      }
    }
  }

  async testLanguageToggleTranslations(): Promise<void> {
    const languageToggle = this.page.locator('[class*="language"], [class*="lang"], select[name*="language"]');
    
    if (await languageToggle.count() > 0) {
      const options = languageToggle.locator('option').first();
      if (await options.count() > 0) {
        await expect(options).toBeVisible();
      }
    }
  }
}

export class TableTestUtils extends TranslationTestUtils {
  constructor(page: Page) {
    super(page);
  }

  async testTableHeaderTranslations(tableSelector: string = 'table'): Promise<void> {
    const table = this.page.locator(tableSelector);
    
    if (await table.count() > 0) {
      const headers = table.locator('th');
      const headerCount = await headers.count();
      
      for (let i = 0; i < headerCount; i++) {
        const header = headers.nth(i);
        const text = await header.textContent();
        
        if (text && text.trim()) {
          expect(text.trim()).not.toBe('');
        }
      }
    }
  }

  async testTableActionsTranslations(): Promise<void> {
    const actionButtons = this.page.locator('table button, [class*="table"] button, [class*="action"]');
    await this.verifyButtonTranslations();
  }
}

export class ModalTestUtils extends TranslationTestUtils {
  constructor(page: Page) {
    super(page);
  }

  async testModalTranslations(modalSelector: string = '[role="dialog"], [class*="modal"]'): Promise<void> {
    const modal = this.page.locator(modalSelector);
    
    if (await modal.count() > 0) {
      // Check modal title
      const modalTitle = modal.locator('h1, h2, h3, [class*="title"], [class*="header"]').first();
      if (await modalTitle.count() > 0) {
        const titleText = await modalTitle.textContent();
        if (titleText && titleText.trim()) {
          expect(titleText.trim()).not.toBe('');
        }
      }

      // Check modal form if present
      const modalForm = modal.locator('form');
      if (await modalForm.count() > 0) {
        await this.verifyFormTranslations('form');
      }

      // Check modal buttons
      const modalButtons = modal.locator('button');
      const buttonCount = await modalButtons.count();
      
      for (let i = 0; i < buttonCount; i++) {
        const button = modalButtons.nth(i);
        const text = await button.textContent();
        
        if (text && text.trim()) {
          expect(text.trim()).not.toBe('');
        }
      }
    }
  }
}

export class FilterTestUtils extends TranslationTestUtils {
  constructor(page: Page) {
    super(page);
  }

  async testFilterTranslations(): Promise<void> {
    const filterElements = this.page.locator('[class*="filter"], [class*="search"]');
    
    // Test filter labels
    const filterLabels = filterElements.locator('label');
    const labelCount = await filterLabels.count();
    
    for (let i = 0; i < labelCount; i++) {
      const label = filterLabels.nth(i);
      const text = await label.textContent();
      
      if (text && text.trim()) {
        expect(text.trim()).not.toBe('');
      }
    }

    // Test dropdown options
    const selectElements = filterElements.locator('select');
    const selectCount = await selectElements.count();
    
    for (let i = 0; i < selectCount; i++) {
      const select = selectElements.nth(i);
      const options = select.locator('option');
      const optionCount = await options.count();
      
      for (let j = 0; j < optionCount; j++) {
        const option = options.nth(j);
        const text = await option.textContent();
        
        if (text && text.trim()) {
          expect(text.trim()).not.toBe('');
        }
      }
    }
  }
}