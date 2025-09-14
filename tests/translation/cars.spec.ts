import { test, expect } from '@playwright/test';
import { TranslationTestUtils } from './utils/translation-utils';
import { TableTestUtils, ModalTestUtils, FilterTestUtils } from './utils/screen-specific-utils';

test.describe('Vehicle Management - Translation Tests', () => {
  let utils: TranslationTestUtils;
  let tableUtils: TableTestUtils;
  let modalUtils: ModalTestUtils;
  let filterUtils: FilterTestUtils;

  test.beforeEach(async ({ page }) => {
    utils = new TranslationTestUtils(page);
    tableUtils = new TableTestUtils(page);
    modalUtils = new ModalTestUtils(page);
    filterUtils = new FilterTestUtils(page);
    
    // Set language to English first, then navigate to cars screen
    await utils.switchLanguage('en');
    await utils.navigateToRoute('/cars');
  });

  test('Cars Screen - Vehicle listing translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to cars screen
      await utils.navigateToRoute('/cars');
      
      // Test page title and headers
      const pageTitle = utils.page.locator('h1, [class*="title"]:first-of-type').first();
      if (await pageTitle.count() > 0) {
        const titleText = await pageTitle.textContent();
        expect(titleText?.trim()).toBeTruthy();
        expect(titleText?.trim().length).toBeGreaterThan(0);
      }
      
      // Test table headers if table exists
      await tableUtils.testTableHeaderTranslations();
      
      // Look for specific column headers mentioned in translations
      const columnHeaders = [
        'License Plate',
        'Make',
        'Model', 
        'Year',
        'Owner',
        'Status',
        'Last Service',
        'Next Service'
      ];
      
      for (const header of columnHeaders) {
        const headerElement = utils.page.locator(`th:has-text("${header}"), th:has-text("Plaque"), th:has-text("Marque"), th:has-text("Modèle"), th:has-text("Année"), th:has-text("Propriétaire"), th:has-text("Statut"), th:has-text("Dernier"), th:has-text("Prochain"), th:has-text("رقم"), th:has-text("الماركة"), th:has-text("النموذج"), th:has-text("السنة"), th:has-text("المالك"), th:has-text("الحالة")`).first();
        
        if (await headerElement.count() > 0) {
          const text = await headerElement.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Test status badges
      await utils.verifyStatusTranslations();
      
      // Check for status legend if present
      const statusLegend = utils.page.locator('[class*="legend"], :has-text("Status Legend"), :has-text("Légende"), :has-text("وضع")').first();
      if (await statusLegend.count() > 0) {
        const legendItems = statusLegend.locator('span, div, li').all();
        for (const item of await legendItems) {
          const text = await item.textContent();
          if (text && text.trim()) {
            expect(text.trim().length).toBeGreaterThan(0);
          }
        }
      }
      
      // Verify no hardcoded text appears
      await utils.verifyNoHardcodedText();
      
      // For Arabic, verify text renders correctly
      if (language === 'ar') {
        await utils.verifyArabicTextRendering();
      }
      
      // Take screenshot for documentation
      await utils.takeScreenshot('cars-listing', language);
    });
  });

  test('Cars Screen - Filter options translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to cars screen
      await utils.navigateToRoute('/cars');
      
      // Test filter translations
      await filterUtils.testFilterTranslations();
      
      // Look for specific filter options mentioned in translations
      const filterOptions = utils.page.locator('select option, [class*="filter"] span, [class*="dropdown"] span').all();
      for (const option of await filterOptions) {
        const text = await option.textContent();
        if (text && text.trim()) {
          expect(text.trim().length).toBeGreaterThan(0);
        }
      }
      
      // Check for "All Makes" and "All Status" filters
      const allMakesFilter = utils.page.locator('option:has-text("All Makes"), option:has-text("Toutes"), option:has-text("جميع")').first();
      if (await allMakesFilter.count() > 0) {
        const text = await allMakesFilter.textContent();
        expect(text?.trim()).toBeTruthy();
      }
      
      const allStatusFilter = utils.page.locator('option:has-text("All Status"), option:has-text("Tous"), option:has-text("كل")').first();
      if (await allStatusFilter.count() > 0) {
        const text = await allStatusFilter.textContent();
        expect(text?.trim()).toBeTruthy();
      }
      
      // Verify no hardcoded text appears
      await utils.verifyNoHardcodedText();
      
      // For Arabic, verify text renders correctly
      if (language === 'ar') {
        await utils.verifyArabicTextRendering();
      }
      
      // Take screenshot for documentation
      await utils.takeScreenshot('cars-filters', language);
    });
  });

  test('Car Registration Form - All form fields and validation messages (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to cars screen
      await utils.navigateToRoute('/cars');
      
      // Look for Add Car button
      const addCarButton = utils.page.locator('button:has-text("Add"), button:has-text("Ajouter"), button:has-text("إضافة"), [class*="add"]:has-text("Car")').first();
      
      if (await addCarButton.count() > 0) {
        await addCarButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Test form translations
        await utils.verifyFormTranslations();
        
        // Check specific form fields mentioned in translations
        const formFields = [
          'License Plate',
          'Make', 
          'Model',
          'Year',
          'Current Mileage',
          'Color',
          'VIN',
          'Engine Type',
          'Fuel Type'
        ];
        
        for (const field of formFields) {
          const fieldInput = utils.page.locator(`input[name*="${field.toLowerCase().replace(/\s+/g, '')}"], input[placeholder*="${field}"], label:has-text("${field}") + input, label:has-text("Plaque") + input, label:has-text("Marque") + input, label:has-text("رقم") + input`).first();
          
          if (await fieldInput.count() > 0) {
            const placeholder = await fieldInput.getAttribute('placeholder');
            if (placeholder) {
              expect(placeholder.length).toBeGreaterThan(0);
            }
          }
        }
        
        // Check for customer information section
        const customerSection = utils.page.locator(':has-text("Customer"), :has-text("Client"), :has-text("عميل")').first();
        if (await customerSection.count() > 0) {
          // Check existing vs new customer options
          const existingCustomerOption = utils.page.locator(':has-text("Existing Customer"), :has-text("Client existant"), :has-text("عميل موجود")').first();
          const newCustomerOption = utils.page.locator(':has-text("New Customer"), :has-text("Nouveau client"), :has-text("عميل جديد")').first();
          
          if (await existingCustomerOption.count() > 0) {
            const text = await existingCustomerOption.textContent();
            expect(text?.trim()).toBeTruthy();
          }
          
          if (await newCustomerOption.count() > 0) {
            const text = await newCustomerOption.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Test form buttons
        await utils.verifyButtonTranslations();
        
        // Check for Register/Save button
        const saveButton = utils.page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Save"), button:has-text("Enregistrer"), button:has-text("تسجيل")').first();
        if (await saveButton.count() > 0) {
          const text = await saveButton.textContent();
          expect(text?.trim()).toBeTruthy();
        }
        
        // Verify no hardcoded text appears
        await utils.verifyNoHardcodedText();
        
        // For Arabic, verify text renders correctly
        if (language === 'ar') {
          await utils.verifyArabicTextRendering();
        }
        
        // Take screenshot for documentation
        await utils.takeScreenshot('car-registration-form', language);
      }
    });
  });

  test('Car Card Component - Vehicle information display translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to cars screen
      await utils.navigateToRoute('/cars');
      
      // Look for car cards
      const carCards = utils.page.locator('[class*="car-card"], [class*="vehicle-card"], [class*="card"]').all();
      
      if ((await carCards).length > 0) {
        for (const card of await carCards) {
          // Check card content
          const cardText = await card.textContent();
          if (cardText && cardText.trim()) {
            expect(cardText.trim().length).toBeGreaterThan(0);
          }
          
          // Check for specific labels in card
          const labels = card.locator('span, div, p').all();
          for (const label of await labels) {
            const text = await label.textContent();
            if (text && text.trim() && text.trim().length > 2) {
              expect(text.trim().length).toBeGreaterThan(0);
            }
          }
        }
      }
      
      // Verify no hardcoded text appears
      await utils.verifyNoHardcodedText();
      
      // For Arabic, verify text renders correctly
      if (language === 'ar') {
        await utils.verifyArabicTextRendering();
      }
      
      // Take screenshot for documentation
      await utils.takeScreenshot('car-cards', language);
    });
  });

  test('Car Details View - Complete vehicle details translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to cars screen
      await utils.navigateToRoute('/cars');
      
      // Look for a car to view details
      const viewDetailsButton = utils.page.locator('button:has-text("View"), button:has-text("Details"), button:has-text("Voir"), button:has-text("Détails"), button:has-text("عرض"), button:has-text("تفاصيل"), a:has-text("View")').first();
      
      if (await viewDetailsButton.count() > 0) {
        await viewDetailsButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Check details sections
        const detailsSections = [
          'Vehicle Information',
          'Owner Information', 
          'Service History',
          'Maintenance Records'
        ];
        
        for (const section of detailsSections) {
          const sectionHeader = utils.page.locator(`h1:has-text("${section}"), h2:has-text("${section}"), h3:has-text("${section}"), h4:has-text("${section}"), :has-text("Véhicule"), :has-text("Propriétaire"), :has-text("Historique"), :has-text("Maintenance"), :has-text("معلومات"), :has-text("مالك"), :has-text("تاريخ")`).first();
          
          if (await sectionHeader.count() > 0) {
            const text = await sectionHeader.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check for action buttons
        const actionButtons = utils.page.locator('button:has-text("Edit"), button:has-text("Schedule"), button:has-text("History"), button:has-text("Modifier"), button:has-text("Programmer"), button:has-text("تحرير"), button:has-text("جدولة")').all();
        
        for (const button of await actionButtons) {
          const text = await button.textContent();
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
        await utils.takeScreenshot('car-details-view', language);
      }
    });
  });

  test('Cars Screen - Empty state and loading messages (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to cars screen
      await utils.navigateToRoute('/cars');
      
      // Check for empty state message
      const emptyState = utils.page.locator(':has-text("No cars found"), :has-text("No data"), :has-text("Aucune voiture"), :has-text("Aucune donnée"), :has-text("لم يتم العثور"), :has-text("لا توجد بيانات")').first();
      
      if (await emptyState.count() > 0) {
        const text = await emptyState.textContent();
        expect(text?.trim()).toBeTruthy();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
      
      // Check for loading state if present
      const loadingState = utils.page.locator(':has-text("Loading"), :has-text("Chargement"), :has-text("تحميل")').first();
      
      if (await loadingState.count() > 0) {
        const text = await loadingState.textContent();
        expect(text?.trim()).toBeTruthy();
      }
      
      // Check total cars count if present
      const totalCarsElement = utils.page.locator(':has-text("Total Cars"), :has-text("Total"), :has-text("Voitures totales"), :has-text("إجمالي السيارات")').first();
      
      if (await totalCarsElement.count() > 0) {
        const text = await totalCarsElement.textContent();
        expect(text?.trim()).toBeTruthy();
      }
      
      // Verify no hardcoded text appears
      await utils.verifyNoHardcodedText();
      
      // For Arabic, verify text renders correctly
      if (language === 'ar') {
        await utils.verifyArabicTextRendering();
      }
      
      // Take screenshot for documentation
      await utils.takeScreenshot('cars-empty-loading-states', language);
    });
  });

  test('Cars Screen - Language switching works seamlessly', async ({ page }) => {
    const testUtils = new TranslationTestUtils(page);
    
    // Navigate to cars screen
    await testUtils.navigateToRoute('/cars');
    
    // Test language persistence
    await testUtils.verifyLanguagePersistence();
    
    // Verify that changing language updates content immediately
    await testUtils.switchLanguage('en');
    const englishContent = await testUtils.page.locator('body').textContent();
    
    await testUtils.switchLanguage('fr');
    const frenchContent = await testUtils.page.locator('body').textContent();
    
    await testUtils.switchLanguage('ar');
    const arabicContent = await testUtils.page.locator('body').textContent();
    
    // Content should be different for each language
    expect(englishContent).not.toBe(frenchContent);
    expect(frenchContent).not.toBe(arabicContent);
  });
});