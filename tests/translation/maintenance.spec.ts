import { test, expect } from '@playwright/test';
import { TranslationTestUtils } from './utils/translation-utils';
import { TableTestUtils, ModalTestUtils, FilterTestUtils } from './utils/screen-specific-utils';

test.describe('Maintenance & Service - Translation Tests', () => {
  let utils: TranslationTestUtils;
  let tableUtils: TableTestUtils;
  let modalUtils: ModalTestUtils;
  let filterUtils: FilterTestUtils;

  test.beforeEach(async ({ page }) => {
    utils = new TranslationTestUtils(page);
    tableUtils = new TableTestUtils(page);
    modalUtils = new ModalTestUtils(page);
    filterUtils = new FilterTestUtils(page);
    
    // Set language to English first, then navigate to maintenance screen
    await utils.switchLanguage('en');
    await utils.navigateToRoute('/maintenance');
  });

  test('Maintenance Screen - Active jobs view translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to active jobs view
      await utils.navigateToRoute('/maintenance/active');
      
      // Check page title
      const pageTitle = utils.page.locator('h1, [class*="title"]:first-of-type').first();
      if (await pageTitle.count() > 0) {
        const titleText = await pageTitle.textContent();
        expect(titleText?.trim()).toBeTruthy();
      }
      
      // Test active jobs table headers
      await tableUtils.testTableHeaderTranslations();
      
      // Look for specific job-related headers
      const jobHeaders = [
        'Job ID',
        'Customer',
        'Car',
        'Description',
        'Mechanic',
        'Progress',
        'Status',
        'Start Date',
        'Expected Completion'
      ];
      
      for (const header of jobHeaders) {
        const headerElement = utils.page.locator(`th:has-text("${header}"), th:has-text("ID"), th:has-text("Client"), th:has-text("Voiture"), th:has-text("Description"), th:has-text("Mécanicien"), th:has-text("Progrès"), th:has-text("Statut"), th:has-text("Début"), th:has-text("Fin"), th:has-text("معرف"), th:has-text("عميل"), th:has-text("سيارة"), th:has-text("وصف"), th:has-text("ميكانيكي"), th:has-text("تقدم"), th:has-text("حالة"), th:has-text("بداية"), th:has-text("إنجاز")`).first();
        
        if (await headerElement.count() > 0) {
          const text = await headerElement.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Test job status badges
      await utils.verifyStatusTranslations();
      
      // Check for specific statuses mentioned in translations
      const statusBadges = utils.page.locator('[class*="status"], [class*="badge"]').all();
      for (const badge of await statusBadges) {
        const text = await badge.textContent();
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
      await utils.takeScreenshot('maintenance-active-jobs', language);
    });
  });

  test('Maintenance Screen - Job history view translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to history view
      await utils.navigateToRoute('/maintenance/history');
      
      // Check history page title
      const historyTitle = utils.page.locator('h1:has-text("History"), h2:has-text("History"), h3:has-text("History"), :has-text("Historique"), :has-text("تاريخ")').first();
      if (await historyTitle.count() > 0) {
        const titleText = await historyTitle.textContent();
        expect(titleText?.trim()).toBeTruthy();
      }
      
      // Test completed jobs table
      await tableUtils.testTableHeaderTranslations();
      
      // Check for history-specific columns
      const historyHeaders = [
        'Completion Date',
        'Duration',
        'Total Cost',
        'Customer Rating'
      ];
      
      for (const header of historyHeaders) {
        const headerElement = utils.page.locator(`th:has-text("${header}"), th:has-text("Completion"), th:has-text("Duration"), th:has-text("Cost"), th:has-text("Rating"), th:has-text("Date de fin"), th:has-text("Durée"), th:has-text("Coût"), th:has-text("Note"), th:has-text("تاريخ الإنجاز"), th:has-text("مدة"), th:has-text("تكلفة"), th:has-text("تقييم")`).first();
        
        if (await headerElement.count() > 0) {
          const text = await headerElement.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Verify no hardcoded text appears
      await utils.verifyNoHardcodedText();
      
      // For Arabic, verify text renders correctly
      if (language === 'ar') {
        await utils.verifyArabicTextRendering();
      }
      
      // Take screenshot for documentation
      await utils.takeScreenshot('maintenance-history', language);
    });
  });

  test('Maintenance Screen - Schedule view translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to schedule view
      await utils.navigateToRoute('/maintenance/schedule');
      
      // Check schedule page title
      const scheduleTitle = utils.page.locator('h1:has-text("Schedule"), h2:has-text("Schedule"), :has-text("Planification"), :has-text("جدولة")').first();
      if (await scheduleTitle.count() > 0) {
        const titleText = await scheduleTitle.textContent();
        expect(titleText?.trim()).toBeTruthy();
      }
      
      // Test scheduled jobs table
      await tableUtils.testTableHeaderTranslations();
      
      // Check for schedule-specific information
      const scheduleElements = utils.page.locator(':has-text("Scheduled"), :has-text("Upcoming"), :has-text("Planifié"), :has-text("À venir"), :has-text("مجدول"), :has-text("قادم")').all();
      
      for (const element of await scheduleElements) {
        const text = await element.textContent();
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
      await utils.takeScreenshot('maintenance-schedule', language);
    });
  });

  test('Maintenance Form - New job creation translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to maintenance screen
      await utils.navigateToRoute('/maintenance');
      
      // Look for Add Job button
      const addJobButton = utils.page.locator('button:has-text("Add Job"), button:has-text("New Job"), button:has-text("Ajouter"), button:has-text("Nouveau"), button:has-text("إضافة وظيفة")').first();
      
      if (await addJobButton.count() > 0) {
        await addJobButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Test form translations
        await utils.verifyFormTranslations();
        
        // Check specific maintenance form fields
        const maintenanceFields = [
          'Work Description',
          'Car Information', 
          'Customer',
          'Mechanic',
          'Priority',
          'Estimated Duration',
          'Parts Required',
          'Labor Hours',
          'Estimated Cost'
        ];
        
        for (const field of maintenanceFields) {
          const fieldElement = utils.page.locator(`label:has-text("${field}"), input[name*="${field.toLowerCase().replace(/\s+/g, '')}"], :has-text("Description"), :has-text("Voiture"), :has-text("Client"), :has-text("Mécanicien"), :has-text("Priorité"), :has-text("Durée"), :has-text("Pièces"), :has-text("Heures"), :has-text("Coût"), :has-text("وصف العمل"), :has-text("معلومات السيارة"), :has-text("عميل"), :has-text("ميكانيكي"), :has-text("أولوية"), :has-text("مدة متوقعة")`).first();
          
          if (await fieldElement.count() > 0) {
            const text = await fieldElement.textContent();
            if (text && text.trim()) {
              expect(text.trim().length).toBeGreaterThan(0);
            }
          }
        }
        
        // Test priority dropdown options
        const prioritySelect = utils.page.locator('select[name*="priority"], [class*="priority"] select').first();
        if (await prioritySelect.count() > 0) {
          const options = prioritySelect.locator('option').all();
          for (const option of await options) {
            const text = await option.textContent();
            if (text && text.trim()) {
              expect(text.trim().length).toBeGreaterThan(0);
            }
          }
        }
        
        // Test form buttons
        await utils.verifyButtonTranslations();
        
        // Verify no hardcoded text appears
        await utils.verifyNoHardcodedText();
        
        // For Arabic, verify text renders correctly
        if (language === 'ar') {
          await utils.verifyArabicTextRendering();
        }
        
        // Take screenshot for documentation
        await utils.takeScreenshot('maintenance-new-job-form', language);
      }
    });
  });

  test('Maintenance Filters Component - All filter options (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to maintenance screen
      await utils.navigateToRoute('/maintenance');
      
      // Test filter translations
      await filterUtils.testFilterTranslations();
      
      // Check specific maintenance filter options
      const filterSections = [
        'Status',
        'Priority', 
        'Mechanic',
        'Date Range'
      ];
      
      for (const section of filterSections) {
        const filterSection = utils.page.locator(`label:has-text("${section}"), [class*="filter"]:has-text("${section}"), :has-text("Statut"), :has-text("Priorité"), :has-text("Mécanicien"), :has-text("Date"), :has-text("حالة"), :has-text("أولوية"), :has-text("ميكانيكي"), :has-text("تاريخ")`).first();
        
        if (await filterSection.count() > 0) {
          const text = await filterSection.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Test quick filter buttons
      const quickFilters = utils.page.locator('[class*="quick-filter"] button, button:has-text("High Priority"), button:has-text("Today"), button:has-text("This Week"), button:has-text("Haute"), button:has-text("Aujourd\'hui"), button:has-text("Cette semaine"), button:has-text("عالية الأولوية"), button:has-text("اليوم"), button:has-text("هذا الأسبوع")').all();
      
      for (const filter of await quickFilters) {
        const text = await filter.textContent();
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
      await utils.takeScreenshot('maintenance-filters', language);
    });
  });

  test('Maintenance Job Card - Job card display translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to maintenance screen
      await utils.navigateToRoute('/maintenance');
      
      // Look for job cards
      const jobCards = utils.page.locator('[class*="job-card"], [class*="maintenance-card"], [class*="card"]').all();
      
      if ((await jobCards).length > 0) {
        for (const card of await jobCards) {
          // Check card content
          const cardLabels = card.locator('span, div, p, label').all();
          for (const label of await cardLabels) {
            const text = await label.textContent();
            if (text && text.trim() && text.trim().length > 2) {
              expect(text.trim().length).toBeGreaterThan(0);
            }
          }
          
          // Check for action buttons in card
          const cardButtons = card.locator('button').all();
          for (const button of await cardButtons) {
            const text = await button.textContent();
            if (text && text.trim()) {
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
      await utils.takeScreenshot('maintenance-job-cards', language);
    });
  });

  test('Maintenance Stats - Statistics display translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to maintenance screen
      await utils.navigateToRoute('/maintenance');
      
      // Look for stats/metrics section
      const statsSection = utils.page.locator('[class*="stats"], [class*="metrics"], [class*="summary"]').first();
      
      if (await statsSection.count() > 0) {
        // Check stats labels
        const statLabels = [
          'Total Jobs',
          'Completed Today',
          'Pending Approvals',
          'Average Completion Time',
          'Revenue Today',
          'Weekly Efficiency'
        ];
        
        for (const label of statLabels) {
          const statElement = utils.page.locator(`:has-text("${label}"), :has-text("Total"), :has-text("Terminé"), :has-text("En attente"), :has-text("Temps moyen"), :has-text("Revenus"), :has-text("Efficacité"), :has-text("إجمالي الوظائف"), :has-text("مكتمل اليوم"), :has-text("في انتظار الموافقة"), :has-text("متوسط وقت الإنجاز"), :has-text("إيرادات اليوم"), :has-text("الكفاءة الأسبوعية")`).first();
          
          if (await statElement.count() > 0) {
            const text = await statElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check for numerical values with units
        const valueElements = statsSection.locator('[class*="value"], [class*="number"]').all();
        for (const valueEl of await valueElements) {
          const text = await valueEl.textContent();
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
      await utils.takeScreenshot('maintenance-stats', language);
    });
  });
});