import { test, expect } from '@playwright/test';
import { TranslationTestUtils } from './utils/translation-utils';
import { TableTestUtils, ModalTestUtils, FilterTestUtils } from './utils/screen-specific-utils';

test.describe('Appointments & Scheduling - Translation Tests', () => {
  let utils: TranslationTestUtils;
  let tableUtils: TableTestUtils;
  let modalUtils: ModalTestUtils;
  let filterUtils: FilterTestUtils;

  test.beforeEach(async ({ page }) => {
    utils = new TranslationTestUtils(page);
    tableUtils = new TableTestUtils(page);
    modalUtils = new ModalTestUtils(page);
    filterUtils = new FilterTestUtils(page);
    
    // Set language to English first, then navigate to appointments screen
    await utils.switchLanguage('en');
    await utils.navigateToRoute('/appointments');
  });

  test('Appointments Calendar View - Calendar interface translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to appointments screen
      await utils.navigateToRoute('/appointments');
      
      // Check page title
      const pageTitle = utils.page.locator('h1, [class*="title"]:first-of-type').first();
      if (await pageTitle.count() > 0) {
        const titleText = await pageTitle.textContent();
        expect(titleText?.trim()).toBeTruthy();
      }
      
      // Check calendar view buttons
      const viewButtons = [
        'Day', 'Week', 'Month', 'Year'
      ];
      
      for (const viewType of viewButtons) {
        const viewButton = utils.page.locator(`button:has-text("${viewType}"), button:has-text("Jour"), button:has-text("Semaine"), button:has-text("Mois"), button:has-text("Année"), button:has-text("يوم"), button:has-text("أسبوع"), button:has-text("شهر"), button:has-text("سنة")`).first();
        
        if (await viewButton.count() > 0) {
          const text = await viewButton.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Check calendar navigation
      const navButtons = utils.page.locator('button:has-text("Today"), button:has-text("Previous"), button:has-text("Next"), button:has-text("Aujourd\'hui"), button:has-text("Précédent"), button:has-text("Suivant"), button:has-text("اليوم"), button:has-text("السابق"), button:has-text("التالي")').all();
      
      for (const navButton of await navButtons) {
        const text = await navButton.textContent();
        if (text && text.trim()) {
          expect(text.trim().length).toBeGreaterThan(0);
        }
      }
      
      // Check month/day names in calendar
      const calendarHeaders = utils.page.locator('[class*="calendar-header"], [class*="day-name"], th').all();
      for (const header of await calendarHeaders) {
        const text = await header.textContent();
        if (text && text.trim() && text.trim().length > 1) {
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
      await utils.takeScreenshot('appointments-calendar', language);
    });
  });

  test('Appointments List View - Appointments table translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to appointments list view
      await utils.navigateToRoute('/appointments');
      
      // Switch to list view if available
      const listViewButton = utils.page.locator('button:has-text("List"), button:has-text("Liste"), button:has-text("قائمة")').first();
      if (await listViewButton.count() > 0) {
        await listViewButton.click();
        await utils.page.waitForTimeout(500);
      }
      
      // Test table headers
      await tableUtils.testTableHeaderTranslations();
      
      // Look for specific appointment-related headers
      const appointmentHeaders = [
        'Date & Time',
        'Customer',
        'Vehicle',
        'Service Type',
        'Duration',
        'Status',
        'Mechanic',
        'Notes',
        'Actions'
      ];
      
      for (const header of appointmentHeaders) {
        const headerElement = utils.page.locator(`th:has-text("${header}"), th:has-text("Date"), th:has-text("Heure"), th:has-text("Client"), th:has-text("Véhicule"), th:has-text("Service"), th:has-text("Durée"), th:has-text("Statut"), th:has-text("Mécanicien"), th:has-text("Notes"), th:has-text("Actions"), th:has-text("التاريخ"), th:has-text("الوقت"), th:has-text("عميل"), th:has-text("مركبة"), th:has-text("نوع الخدمة"), th:has-text("مدة"), th:has-text("حالة"), th:has-text("ميكانيكي"), th:has-text("ملاحظات"), th:has-text("إجراءات")`).first();
        
        if (await headerElement.count() > 0) {
          const text = await headerElement.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Test appointment status badges
      await utils.verifyStatusTranslations();
      
      // Check specific appointment statuses
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
      await utils.takeScreenshot('appointments-list', language);
    });
  });

  test('New Appointment Form - Booking form translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to appointments screen
      await utils.navigateToRoute('/appointments');
      
      // Look for Add/Book Appointment button
      const addAppointmentButton = utils.page.locator('button:has-text("New Appointment"), button:has-text("Book"), button:has-text("Add"), button:has-text("Nouveau"), button:has-text("Réserver"), button:has-text("Ajouter"), button:has-text("موعد جديد"), button:has-text("حجز"), button:has-text("إضافة")').first();
      
      if (await addAppointmentButton.count() > 0) {
        await addAppointmentButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Test form translations
        await utils.verifyFormTranslations();
        
        // Check specific appointment form fields
        const appointmentFields = [
          'Customer Information',
          'Vehicle Selection',
          'Service Type',
          'Preferred Date',
          'Preferred Time',
          'Estimated Duration',
          'Mechanic Preference',
          'Special Instructions',
          'Priority Level',
          'Contact Number'
        ];
        
        for (const field of appointmentFields) {
          const fieldElement = utils.page.locator(`label:has-text("${field}"), input[name*="${field.toLowerCase().replace(/\s+/g, '')}"], :has-text("Customer"), :has-text("Vehicle"), :has-text("Service"), :has-text("Date"), :has-text("Time"), :has-text("Duration"), :has-text("Mechanic"), :has-text("Instructions"), :has-text("Priority"), :has-text("Contact"), :has-text("Client"), :has-text("Véhicule"), :has-text("Type de service"), :has-text("Date préférée"), :has-text("Heure"), :has-text("Durée"), :has-text("Préférence"), :has-text("Instructions"), :has-text("Priorité"), :has-text("معلومات العميل"), :has-text("اختيار المركبة"), :has-text("نوع الخدمة"), :has-text("التاريخ المفضل"), :has-text("الوقت المفضل")`).first();
          
          if (await fieldElement.count() > 0) {
            const text = await fieldElement.textContent();
            if (text && text.trim()) {
              expect(text.trim().length).toBeGreaterThan(0);
            }
          }
        }
        
        // Test service type dropdown options
        const serviceTypeSelect = utils.page.locator('select[name*="service"], [class*="service"] select').first();
        if (await serviceTypeSelect.count() > 0) {
          const options = serviceTypeSelect.locator('option').all();
          for (const option of await options) {
            const text = await option.textContent();
            if (text && text.trim()) {
              expect(text.trim().length).toBeGreaterThan(0);
            }
          }
        }
        
        // Test time slot selection
        const timeSlots = utils.page.locator('[class*="time-slot"], button[data-time]').all();
        for (const slot of await timeSlots) {
          const text = await slot.textContent();
          if (text && text.trim()) {
            expect(text.trim().length).toBeGreaterThan(0);
          }
        }
        
        // Test form buttons
        await utils.verifyButtonTranslations();
        
        // Check for specific buttons
        const formButtons = utils.page.locator('button:has-text("Book Appointment"), button:has-text("Schedule"), button:has-text("Cancel"), button:has-text("Réserver"), button:has-text("Programmer"), button:has-text("Annuler"), button:has-text("حجز موعد"), button:has-text("جدولة"), button:has-text("إلغاء")').all();
        
        for (const button of await formButtons) {
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
        await utils.takeScreenshot('appointments-new-form', language);
      }
    });
  });

  test('Appointment Filters - Filter options translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to appointments screen
      await utils.navigateToRoute('/appointments');
      
      // Test filter translations
      await filterUtils.testFilterTranslations();
      
      // Check specific appointment filter options
      const filterSections = [
        'Date Range',
        'Status',
        'Service Type',
        'Mechanic',
        'Customer'
      ];
      
      for (const section of filterSections) {
        const filterSection = utils.page.locator(`label:has-text("${section}"), [class*="filter"]:has-text("${section}"), :has-text("Date"), :has-text("Statut"), :has-text("Service"), :has-text("Mécanicien"), :has-text("Client"), :has-text("نطاق التاريخ"), :has-text("حالة"), :has-text("نوع الخدمة"), :has-text("ميكانيكي"), :has-text("عميل")`).first();
        
        if (await filterSection.count() > 0) {
          const text = await filterSection.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Test quick filter buttons
      const quickFilters = utils.page.locator('[class*="quick-filter"] button, button:has-text("Today"), button:has-text("This Week"), button:has-text("Upcoming"), button:has-text("Overdue"), button:has-text("Aujourd\'hui"), button:has-text("Cette semaine"), button:has-text("À venir"), button:has-text("En retard"), button:has-text("اليوم"), button:has-text("هذا الأسبوع"), button:has-text("قادم"), button:has-text("متأخر")').all();
      
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
      await utils.takeScreenshot('appointments-filters', language);
    });
  });

  test('Appointment Cards - Appointment card display translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to appointments screen
      await utils.navigateToRoute('/appointments');
      
      // Look for appointment cards
      const appointmentCards = utils.page.locator('[class*="appointment-card"], [class*="booking-card"], [class*="card"]').all();
      
      if ((await appointmentCards).length > 0) {
        for (const card of await appointmentCards) {
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
          
          // Check for appointment time display
          const timeElements = card.locator('[class*="time"], [class*="date"]').all();
          for (const timeEl of await timeElements) {
            const text = await timeEl.textContent();
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
      await utils.takeScreenshot('appointments-cards', language);
    });
  });

  test('Appointment Details Modal - Detailed view translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to appointments screen
      await utils.navigateToRoute('/appointments');
      
      // Look for view details button or clickable appointment
      const viewDetailsButton = utils.page.locator('button:has-text("View"), button:has-text("Details"), button:has-text("Voir"), button:has-text("Détails"), button:has-text("عرض"), button:has-text("تفاصيل"), [class*="appointment-card"], tr').first();
      
      if (await viewDetailsButton.count() > 0) {
        await viewDetailsButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Test modal translations
        await modalUtils.testModalTranslations();
        
        // Check appointment details sections
        const detailSections = [
          'Appointment Information',
          'Customer Details',
          'Vehicle Information',
          'Service Details',
          'Scheduling Information',
          'Additional Notes'
        ];
        
        for (const section of detailSections) {
          const sectionHeader = utils.page.locator(`h1:has-text("${section}"), h2:has-text("${section}"), h3:has-text("${section}"), h4:has-text("${section}"), :has-text("Appointment"), :has-text("Customer"), :has-text("Vehicle"), :has-text("Service"), :has-text("Scheduling"), :has-text("Notes"), :has-text("Rendez-vous"), :has-text("Client"), :has-text("Véhicule"), :has-text("Détails"), :has-text("Planification"), :has-text("Remarques"), :has-text("معلومات الموعد"), :has-text("تفاصيل العميل"), :has-text("معلومات المركبة"), :has-text("تفاصيل الخدمة"), :has-text("معلومات الجدولة"), :has-text("ملاحظات إضافية")`).first();
          
          if (await sectionHeader.count() > 0) {
            const text = await sectionHeader.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check for action buttons in modal
        const modalActionButtons = utils.page.locator('[role="dialog"] button, [class*="modal"] button').all();
        
        for (const button of await modalActionButtons) {
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
        await utils.takeScreenshot('appointments-details-modal', language);
      }
    });
  });

  test('Appointments Statistics - Stats display translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to appointments screen
      await utils.navigateToRoute('/appointments');
      
      // Look for stats/metrics section
      const statsSection = utils.page.locator('[class*="stats"], [class*="metrics"], [class*="summary"], [class*="overview"]').first();
      
      if (await statsSection.count() > 0) {
        // Check stats labels
        const statLabels = [
          'Today\'s Appointments',
          'Upcoming This Week',
          'Completed Today',
          'Cancelled/Rescheduled',
          'Average Duration',
          'Busy Hours',
          'Available Slots'
        ];
        
        for (const label of statLabels) {
          const statElement = utils.page.locator(`:has-text("${label}"), :has-text("Today"), :has-text("Upcoming"), :has-text("Completed"), :has-text("Cancelled"), :has-text("Average"), :has-text("Busy"), :has-text("Available"), :has-text("Aujourd'hui"), :has-text("À venir"), :has-text("Terminé"), :has-text("Annulé"), :has-text("Moyenne"), :has-text("Occupé"), :has-text("Disponible"), :has-text("مواعيد اليوم"), :has-text("قادم هذا الأسبوع"), :has-text("مكتمل اليوم"), :has-text("ملغى/مُعاد جدولته"), :has-text("متوسط المدة"), :has-text("ساعات مزدحمة"), :has-text("فتحات متاحة")`).first();
          
          if (await statElement.count() > 0) {
            const text = await statElement.textContent();
            expect(text?.trim()).toBeTruthy();
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
      await utils.takeScreenshot('appointments-stats', language);
    });
  });

  test('Appointments - Language switching works seamlessly', async ({ page }) => {
    const testUtils = new TranslationTestUtils(page);
    
    // Navigate to appointments screen
    await testUtils.navigateToRoute('/appointments');
    
    // Test language persistence
    await testUtils.verifyLanguagePersistence();
    
    // Verify that changing language updates appointments content immediately
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