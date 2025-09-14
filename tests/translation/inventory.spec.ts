import { test, expect } from '@playwright/test';
import { TranslationTestUtils } from './utils/translation-utils';
import { InventoryScreenUtils } from './utils/screen-specific-utils';

test.describe('Inventory & Parts Management - Translation Tests', () => {
  let utils: TranslationTestUtils;
  let inventoryUtils: InventoryScreenUtils;

  test.beforeEach(async ({ page }) => {
    utils = new TranslationTestUtils(page);
    inventoryUtils = new InventoryScreenUtils(page);
    await utils.navigateToRoute('/inventory');
  });

  test('Inventory Dashboard - Inventory stats and alerts translations (EN/FR/AR)', async ({ page }) => {
    await utils.testAllLanguages(async (testUtils, language) => {
      console.log(`Testing inventory dashboard in ${language.toUpperCase()}`);
      
      // Test navigation tabs (Dashboard, Parts, Suppliers)
      await inventoryUtils.verifyNavigationTabs();
      
      // Test inventory stats cards
      await inventoryUtils.verifyStatsCards();
      
      // Test alerts section
      await inventoryUtils.verifyAlertsSection();
      
      // Test view switching buttons
      await inventoryUtils.verifyViewSwitchingButtons();
      
      await testUtils.takeScreenshot('inventory-dashboard', language);
    });
  });

  test('Parts Listing - Parts table and search translations (EN/FR/AR)', async ({ page }) => {
    await utils.testAllLanguages(async (testUtils, language) => {
      console.log(`Testing parts listing in ${language.toUpperCase()}`);
      
      // Switch to parts view
      await inventoryUtils.switchToPartsView();
      
      // Test search functionality
      await inventoryUtils.verifySearchInput();
      
      // Test filter options
      await inventoryUtils.verifyFilterControls();
      
      // Test parts table headers
      await inventoryUtils.verifyPartsTableHeaders();
      
      // Test parts entries and stock status badges
      await inventoryUtils.verifyPartsEntries();
      
      // ✅ NEW: Enhanced inventory status validation
      await inventoryUtils.verifyInventoryStatusTranslations();
      
      // Test pagination if present
      await inventoryUtils.verifyPagination();
      
      await testUtils.takeScreenshot('inventory-parts-list', language);
    });
  });

  test('Add/Edit Part Modal - Form fields and validation messages (EN/FR/AR)', async ({ page }) => {
    await utils.testAllLanguages(async (testUtils, language) => {
      console.log(`Testing add/edit part modal in ${language.toUpperCase()}`);
      
      // Switch to parts view
      await inventoryUtils.switchToPartsView();
      
      // Click Add Part button
      await inventoryUtils.openAddPartModal();
      
      // Test modal header and title
      await inventoryUtils.verifyPartModalHeader();
      
      // Test form fields
      await inventoryUtils.verifyPartFormFields();
      
      // Test category dropdown options
      await inventoryUtils.verifyCategoryOptions();
      
      // Test supplier dropdown options
      await inventoryUtils.verifySupplierOptions();
      
      // Test stock status options
      await inventoryUtils.verifyStockStatusOptions();
      
      // Test form validation by submitting empty form
      await inventoryUtils.testPartFormValidation();
      
      // Test modal action buttons
      await inventoryUtils.verifyPartModalButtons();
      
      await testUtils.takeScreenshot('inventory-add-part-modal', language);
      
      // Close modal
      await inventoryUtils.closePartModal();
    });
  });

  test('Stock Adjustment Modal - Stock management translations (EN/FR/AR)', async ({ page }) => {
    await utils.testAllLanguages(async (testUtils, language) => {
      console.log(`Testing stock adjustment modal in ${language.toUpperCase()}`);
      
      // Switch to parts view
      await inventoryUtils.switchToPartsView();
      
      // Try to open stock adjustment modal (if parts exist)
      const hasStockAdjustment = await inventoryUtils.openStockAdjustmentModal();
      
      if (hasStockAdjustment) {
        // Test modal header
        await inventoryUtils.verifyStockAdjustmentHeader();
        
        // Test adjustment type options
        await inventoryUtils.verifyAdjustmentTypes();
        
        // Test reason field
        await inventoryUtils.verifyAdjustmentReasonField();
        
        // Test quantity field
        await inventoryUtils.verifyQuantityField();
        
        // Test modal buttons
        await inventoryUtils.verifyStockAdjustmentButtons();
        
        await testUtils.takeScreenshot('inventory-stock-adjustment', language);
        
        // Close modal
        await inventoryUtils.closeStockAdjustmentModal();
      } else {
        console.log('No parts available for stock adjustment test');
      }
    });
  });

  test('Suppliers Management - Suppliers list and details (EN/FR/AR)', async ({ page }) => {
    await utils.testAllLanguages(async (testUtils, language) => {
      console.log(`Testing suppliers management in ${language.toUpperCase()}`);
      
      // Switch to suppliers view
      await inventoryUtils.switchToSuppliersView();
      
      // Test suppliers section header
      await inventoryUtils.verifySuppliersHeader();
      
      // Test suppliers list/table
      await inventoryUtils.verifySuppliersTable();
      
      // Test add supplier button
      await inventoryUtils.verifyAddSupplierButton();
      
      // Test supplier actions (Edit, View, Delete)
      await inventoryUtils.verifySupplierActions();
      
      await testUtils.takeScreenshot('inventory-suppliers', language);
    });
  });

  test('Inventory Filters - Category, supplier, and stock status filters (EN/FR/AR)', async ({ page }) => {
    await utils.testAllLanguages(async (testUtils, language) => {
      console.log(`Testing inventory filters in ${language.toUpperCase()}`);
      
      // Switch to parts view
      await inventoryUtils.switchToPartsView();
      
      // Test category filter dropdown
      await inventoryUtils.testCategoryFilter();
      
      // Test supplier filter dropdown  
      await inventoryUtils.testSupplierFilter();
      
      // Test stock status filter
      await inventoryUtils.testStockStatusFilter();
      
      // Test clear filters button
      await inventoryUtils.testClearFilters();
      
      // Test mobile filters (if applicable)
      await inventoryUtils.testMobileFilters();
      
      await testUtils.takeScreenshot('inventory-filters', language);
    });
  });

  test('Inventory Alerts - Low stock and critical alerts (EN/FR/AR)', async ({ page }) => {
    await utils.testAllLanguages(async (testUtils, language) => {
      console.log(`Testing inventory alerts in ${language.toUpperCase()}`);
      
      // Stay on dashboard view to see alerts
      await inventoryUtils.ensureDashboardView();
      
      // Test alerts section header
      await inventoryUtils.verifyAlertsHeader();
      
      // Test individual alert items
      await inventoryUtils.verifyAlertItems();
      
      // Test alert severity indicators
      await inventoryUtils.verifyAlertSeverityIndicators();
      
      // Test alert actions (Mark as read, View details)
      await inventoryUtils.verifyAlertActions();
      
      // Test alert categories/types
      await inventoryUtils.verifyAlertTypes();
      
      await testUtils.takeScreenshot('inventory-alerts', language);
    });
  });

  test('Search and filtering behavior works correctly', async ({ page }) => {
    // Test search functionality across languages
    const searchTerms = {
      'en': 'brake pad',
      'fr': 'plaquette',
      'ar': 'فرامل'
    };

    for (const [lang, searchTerm] of Object.entries(searchTerms)) {
      await utils.switchLanguage(lang as any);
      await inventoryUtils.switchToPartsView();
      
      const searchResults = await inventoryUtils.performSearch(searchTerm);
      console.log(`Search for "${searchTerm}" in ${lang}: ${searchResults} results`);
      
      // Clear search
      await inventoryUtils.clearSearch();
    }
  });
});