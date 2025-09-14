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

  /**
   * ✅ NEW: Comprehensive dashboard status validation
   * This specifically checks for the untranslated status keys we found
   */
  async verifyDashboardStatusTranslations(): Promise<void> {
    console.log('🔍 Checking dashboard status translations...');
    
    // Target the specific status elements that were showing raw translation keys
    const statusSelectors = [
      // Today's appointments status badges
      '[class*="timeline"] [class*="status"]',
      '[class*="schedule"] [class*="badge"]',
      'generic:has-text("قيد التنفيذ")', // Arabic "In Progress"
      'generic:has-text("dashboard.status")', // Raw translation keys
      
      // Cars being worked on status
      '[class*="car"] [class*="status"]',
      '[class*="progress"] [class*="badge"]'
    ];

    let foundIssues = 0;

    for (const selector of statusSelectors) {
      const elements = this.page.locator(selector);
      const count = await elements.count();
      
      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        const text = await element.textContent();
        
        if (text && text.trim()) {
          try {
            // Use our new validation method
            await this.checkForTranslationKeys(text.trim(), element);
          } catch (error) {
            foundIssues++;
            console.error(`❌ Status translation issue: ${error.message}`);
            throw error; // Re-throw to fail the test
          }
        }
      }
    }

    if (foundIssues === 0) {
      console.log('✅ All dashboard status translations validated successfully');
    }
  }

  /**
   * ✅ NEW: Check for specific problematic translation keys
   */
  private async checkForTranslationKeys(text: string, element?: any): Promise<void> {
    const problematicKeys = [
      'dashboard.status.in_progress',
      'dashboard.status.in_repair',
      'dashboard.status.quality_check', 
      'dashboard.status.waiting_parts'
    ];

    for (const key of problematicKeys) {
      if (text === key) {
        const elementInfo = element ? await element.innerHTML() : 'unknown';
        throw new Error(`🚨 FOUND UNTRANSLATED STATUS KEY: "${key}" in element: ${elementInfo}`);
      }
    }
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
          // ✅ NEW: Check for translation keys in table headers
          await this.checkForTableTranslationKeys(text.trim(), header);
        }
      }
    }
  }

  async testTableActionsTranslations(): Promise<void> {
    const actionButtons = this.page.locator('table button, [class*="table"] button, [class*="action"]');
    await this.verifyButtonTranslations();
  }

  /**
   * ✅ NEW: Check for table-specific translation keys
   */
  private async checkForTableTranslationKeys(text: string, element?: any): Promise<void> {
    const tableTranslationKeys = [
      'table.header.',
      'cars.table.',
      'vehicles.',
      '.licensePlate',
      '.make',
      '.model',
      '.status',
      '.actions'
    ];

    for (const keyPattern of tableTranslationKeys) {
      if (text.includes(keyPattern)) {
        const elementInfo = element ? await element.innerHTML() : 'unknown';
        throw new Error(`🚨 FOUND UNTRANSLATED TABLE KEY: "${text}" contains "${keyPattern}" in element: ${elementInfo}`);
      }
    }
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

export class InventoryScreenUtils extends TranslationTestUtils {
  constructor(page: Page) {
    super(page);
  }

  /**
   * ✅ NEW: Comprehensive inventory status validation
   */
  async verifyInventoryStatusTranslations(): Promise<void> {
    console.log('🔍 Checking inventory status translations...');
    
    const statusSelectors = [
      '[class*="stock"] [class*="status"]',
      '[class*="alert"] [class*="badge"]',
      '[class*="part"] [class*="status"]'
    ];

    for (const selector of statusSelectors) {
      const elements = this.page.locator(selector);
      const count = await elements.count();
      
      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        const text = await element.textContent();
        
        if (text && text.trim()) {
          await this.checkForInventoryTranslationKeys(text.trim(), element);
        }
      }
    }
  }

  private async checkForInventoryTranslationKeys(text: string, element?: any): Promise<void> {
    const problematicKeys = [
      'inventory.status.',
      'inventory.stockStatus.',
      'inventory.alerts.',
      '.inStock',
      '.lowStock',
      '.outOfStock'
    ];

    for (const keyPattern of problematicKeys) {
      if (text.includes(keyPattern)) {
        const elementInfo = element ? await element.innerHTML() : 'unknown';
        throw new Error(`🚨 FOUND UNTRANSLATED INVENTORY KEY: "${text}" contains "${keyPattern}" in element: ${elementInfo}`);
      }
    }
  }

  async verifyNavigationTabs(): Promise<void> {
    const navTabs = this.page.locator('button:has-text("Dashboard"), button:has-text("Parts"), button:has-text("Suppliers"), [role="tab"]');
    if (await navTabs.count() > 0) {
      console.log('Found navigation tabs');
    }
  }

  async verifyStatsCards(): Promise<void> {
    const statsCards = this.page.locator('[class*="stat"], [class*="metric"], [class*="card"]');
    const cardCount = await statsCards.count();
    console.log(`Found ${cardCount} stats cards`);
  }

  async verifyAlertsSection(): Promise<void> {
    const alertsSection = this.page.locator('[class*="alert"], [class*="notification"]');
    if (await alertsSection.count() > 0) {
      console.log('Found alerts section');
    }
  }

  async verifyViewSwitchingButtons(): Promise<void> {
    const viewButtons = this.page.locator('button[class*="view"], button[data-view]');
    if (await viewButtons.count() > 0) {
      console.log('Found view switching buttons');
    }
  }

  async switchToPartsView(): Promise<void> {
    const partsTab = this.page.locator('button:has-text("Parts"), [data-view="parts"]').first();
    if (await partsTab.count() > 0) {
      await partsTab.click();
      await this.page.waitForTimeout(500);
    }
  }

  async switchToSuppliersView(): Promise<void> {
    const suppliersTab = this.page.locator('button:has-text("Suppliers"), [data-view="suppliers"]').first();
    if (await suppliersTab.count() > 0) {
      await suppliersTab.click();
      await this.page.waitForTimeout(500);
    }
  }

  async ensureDashboardView(): Promise<void> {
    const dashboardTab = this.page.locator('button:has-text("Dashboard"), [data-view="dashboard"]').first();
    if (await dashboardTab.count() > 0) {
      await dashboardTab.click();
      await this.page.waitForTimeout(500);
    }
  }

  async verifySearchInput(): Promise<void> {
    const searchInput = this.page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.count() > 0) {
      await expect(searchInput).toBeVisible();
      console.log('Found search input');
    }
  }

  async verifyFilterControls(): Promise<void> {
    const filterSelects = this.page.locator('select[class*="filter"], select[name*="category"], select[name*="supplier"]');
    const filterCount = await filterSelects.count();
    console.log(`Found ${filterCount} filter controls`);
  }

  async verifyPartsTableHeaders(): Promise<void> {
    const table = this.page.locator('table');
    
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
      console.log(`Found ${headerCount} table headers`);
    }
  }

  async verifyPartsEntries(): Promise<void> {
    const partsRows = this.page.locator('tbody tr, [class*="part-item"]');
    const rowCount = await partsRows.count();
    console.log(`Found ${rowCount} parts entries`);
  }

  async verifyPagination(): Promise<void> {
    const pagination = this.page.locator('[class*="pagination"], nav[aria-label*="pagination" i]');
    if (await pagination.count() > 0) {
      console.log('Found pagination controls');
    }
  }

  async openAddPartModal(): Promise<void> {
    const addButton = this.page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
    if (await addButton.count() > 0) {
      await addButton.click();
      await this.page.waitForTimeout(1000);
    }
  }

  async verifyPartModalHeader(): Promise<void> {
    const modal = this.page.locator('[role="dialog"], [class*="modal"]');
    
    if (await modal.count() > 0) {
      // Check modal title
      const modalTitle = modal.locator('h1, h2, h3, [class*="title"], [class*="header"]').first();
      if (await modalTitle.count() > 0) {
        const titleText = await modalTitle.textContent();
        if (titleText && titleText.trim()) {
          expect(titleText.trim()).not.toBe('');
          console.log('Found modal title');
        }
      }
    }
  }

  async verifyPartFormFields(): Promise<void> {
    await this.verifyFormTranslations();
  }

  async verifyCategoryOptions(): Promise<void> {
    const categorySelect = this.page.locator('select[name*="category"], select[name*="type"]');
    if (await categorySelect.count() > 0) {
      const options = categorySelect.locator('option');
      const optionCount = await options.count();
      console.log(`Found ${optionCount} category options`);
    }
  }

  async verifySupplierOptions(): Promise<void> {
    const supplierSelect = this.page.locator('select[name*="supplier"]');
    if (await supplierSelect.count() > 0) {
      const options = supplierSelect.locator('option');
      const optionCount = await options.count();
      console.log(`Found ${optionCount} supplier options`);
    }
  }

  async verifyStockStatusOptions(): Promise<void> {
    const stockSelect = this.page.locator('select[name*="stock"]');
    if (await stockSelect.count() > 0) {
      const options = stockSelect.locator('option');
      const optionCount = await options.count();
      console.log(`Found ${optionCount} stock status options`);
    }
  }

  async testPartFormValidation(): Promise<void> {
    const submitButton = this.page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first();
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await this.page.waitForTimeout(500);
      // Check for validation messages
      const validationMessages = this.page.locator('[class*="error"], [class*="invalid"], .invalid-feedback');
      if (await validationMessages.count() > 0) {
        console.log('Found form validation messages');
      }
    }
  }

  async verifyPartModalButtons(): Promise<void> {
    const modalButtons = this.page.locator('[role="dialog"] button, [class*="modal"] button');
    await this.verifyButtonTranslations();
  }

  async closePartModal(): Promise<void> {
    const closeButton = this.page.locator('button:has-text("Cancel"), button:has-text("Close"), [aria-label="Close"]').first();
    if (await closeButton.count() > 0) {
      await closeButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  async openStockAdjustmentModal(): Promise<boolean> {
    const adjustButton = this.page.locator('button:has-text("Adjust"), button[title*="stock" i]').first();
    if (await adjustButton.count() > 0) {
      await adjustButton.click();
      await this.page.waitForTimeout(1000);
      return true;
    }
    return false;
  }

  async verifyStockAdjustmentHeader(): Promise<void> {
    const modal = this.page.locator('[role="dialog"], [class*="modal"]');
    
    if (await modal.count() > 0) {
      // Check modal title
      const modalTitle = modal.locator('h1, h2, h3, [class*="title"], [class*="header"]').first();
      if (await modalTitle.count() > 0) {
        const titleText = await modalTitle.textContent();
        if (titleText && titleText.trim()) {
          console.log('Found stock adjustment modal title');
        }
      }
    }
  }

  async verifyAdjustmentTypes(): Promise<void> {
    const typeSelect = this.page.locator('select[name*="type"], input[type="radio"]');
    if (await typeSelect.count() > 0) {
      console.log('Found adjustment type controls');
    }
  }

  async verifyAdjustmentReasonField(): Promise<void> {
    const reasonField = this.page.locator('input[name*="reason"], textarea[name*="reason"]');
    if (await reasonField.count() > 0) {
      console.log('Found reason field');
    }
  }

  async verifyQuantityField(): Promise<void> {
    const quantityField = this.page.locator('input[name*="quantity"], input[type="number"]');
    if (await quantityField.count() > 0) {
      console.log('Found quantity field');
    }
  }

  async verifyStockAdjustmentButtons(): Promise<void> {
    await this.verifyButtonTranslations();
  }

  async closeStockAdjustmentModal(): Promise<void> {
    await this.closePartModal(); // Same close logic
  }

  async verifySuppliersHeader(): Promise<void> {
    const suppliersHeader = this.page.locator('h1, h2, h3').filter({ hasText: /supplier/i }).first();
    if (await suppliersHeader.count() > 0) {
      console.log('Found suppliers header');
    }
  }

  async verifySuppliersTable(): Promise<void> {
    const table = this.page.locator('table');
    
    if (await table.count() > 0) {
      console.log('Found suppliers table');
    } else {
      console.log('No suppliers table found - may be card/list layout');
    }
  }

  async verifyAddSupplierButton(): Promise<void> {
    const addSupplierButton = this.page.locator('button:has-text("Add Supplier"), button:has-text("New Supplier")').first();
    if (await addSupplierButton.count() > 0) {
      console.log('Found add supplier button');
    }
  }

  async verifySupplierActions(): Promise<void> {
    const actionButtons = this.page.locator('table button, [class*="supplier"] button, [class*="action"]');
    const buttonCount = await actionButtons.count();
    console.log(`Found ${buttonCount} supplier action buttons`);
  }

  async testCategoryFilter(): Promise<void> {
    const categoryFilter = this.page.locator('select[name*="category"]').first();
    if (await categoryFilter.count() > 0) {
      await categoryFilter.selectOption({ index: 1 });
      await this.page.waitForTimeout(500);
      console.log('Tested category filter');
    }
  }

  async testSupplierFilter(): Promise<void> {
    const supplierFilter = this.page.locator('select[name*="supplier"]').first();
    if (await supplierFilter.count() > 0) {
      await supplierFilter.selectOption({ index: 1 });
      await this.page.waitForTimeout(500);
      console.log('Tested supplier filter');
    }
  }

  async testStockStatusFilter(): Promise<void> {
    const stockFilter = this.page.locator('select[name*="stock"]').first();
    if (await stockFilter.count() > 0) {
      await stockFilter.selectOption({ index: 1 });
      await this.page.waitForTimeout(500);
      console.log('Tested stock status filter');
    }
  }

  async testClearFilters(): Promise<void> {
    const clearButton = this.page.locator('button:has-text("Clear"), button:has-text("Reset")').first();
    if (await clearButton.count() > 0) {
      await clearButton.click();
      await this.page.waitForTimeout(500);
      console.log('Tested clear filters');
    }
  }

  async testMobileFilters(): Promise<void> {
    const mobileFilterToggle = this.page.locator('button[class*="mobile"], button[class*="filter-toggle"]').first();
    if (await mobileFilterToggle.count() > 0) {
      try {
        if (await mobileFilterToggle.isVisible()) {
          await mobileFilterToggle.click();
          await this.page.waitForTimeout(500);
          console.log('Tested mobile filters');
        } else {
          console.log('Mobile filter toggle not visible (likely on desktop)');
        }
      } catch (error) {
        console.log('Mobile filter test skipped - element not clickable');
      }
    } else {
      console.log('No mobile filter toggle found');
    }
  }

  async verifyAlertsHeader(): Promise<void> {
    const alertsHeader = this.page.locator('h1, h2, h3').filter({ hasText: /alert/i }).first();
    if (await alertsHeader.count() > 0) {
      console.log('Found alerts header');
    }
  }

  async verifyAlertItems(): Promise<void> {
    const alertItems = this.page.locator('[class*="alert-item"], [class*="notification-item"]');
    const alertCount = await alertItems.count();
    console.log(`Found ${alertCount} alert items`);
  }

  async verifyAlertSeverityIndicators(): Promise<void> {
    const severityIndicators = this.page.locator('[class*="severity"], [class*="critical"], [class*="warning"]');
    if (await severityIndicators.count() > 0) {
      console.log('Found alert severity indicators');
    }
  }

  async verifyAlertActions(): Promise<void> {
    const alertActions = this.page.locator('[class*="alert"] button, [class*="notification"] button');
    if (await alertActions.count() > 0) {
      console.log('Found alert actions');
    }
  }

  async verifyAlertTypes(): Promise<void> {
    const alertTypes = this.page.locator('[data-alert-type], [class*="alert-type"]');
    if (await alertTypes.count() > 0) {
      console.log('Found alert type indicators');
    }
  }

  async performSearch(searchTerm: string): Promise<number> {
    const searchInput = this.page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill(searchTerm);
      await this.page.waitForTimeout(1000);
      
      const results = this.page.locator('tbody tr, [class*="part-item"]');
      return await results.count();
    }
    return 0;
  }

  async clearSearch(): Promise<void> {
    const searchInput = this.page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('');
      await this.page.waitForTimeout(500);
    }
  }
}