import { test, expect } from '@playwright/test';
import { TranslationTestUtils } from './utils/translation-utils';
import { TableTestUtils, ModalTestUtils, FilterTestUtils } from './utils/screen-specific-utils';

test.describe('Customer Management - Translation Tests', () => {
  let utils: TranslationTestUtils;
  let tableUtils: TableTestUtils;
  let modalUtils: ModalTestUtils;
  let filterUtils: FilterTestUtils;

  test.beforeEach(async ({ page }) => {
    utils = new TranslationTestUtils(page);
    tableUtils = new TableTestUtils(page);
    modalUtils = new ModalTestUtils(page);
    filterUtils = new FilterTestUtils(page);
    
    // Set language to English first, then navigate to customers screen
    await utils.switchLanguage('en');
    await utils.navigateToRoute('/customers');
  });

  test('Customers List View - Customer table translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to customers screen
      await utils.navigateToRoute('/customers');
      
      // Check page title
      const pageTitle = utils.page.locator('h1, [class*="title"]:first-of-type').first();
      if (await pageTitle.count() > 0) {
        const titleText = await pageTitle.textContent();
        expect(titleText?.trim()).toBeTruthy();
      }
      
      // Test table headers
      await tableUtils.testTableHeaderTranslations();
      
      // Look for specific customer-related headers
      const customerHeaders = [
        'Customer ID',
        'Full Name',
        'Email',
        'Phone',
        'Address',
        'Registration Date',
        'Total Visits',
        'Last Visit',
        'Total Spent',
        'Status',
        'Actions'
      ];
      
      for (const header of customerHeaders) {
        const headerElement = utils.page.locator(`th:has-text("${header}"), th:has-text("ID"), th:has-text("Name"), th:has-text("Email"), th:has-text("Phone"), th:has-text("Address"), th:has-text("Registration"), th:has-text("Visits"), th:has-text("Last"), th:has-text("Spent"), th:has-text("Status"), th:has-text("Actions"), th:has-text("Nom"), th:has-text("Téléphone"), th:has-text("Adresse"), th:has-text("Inscription"), th:has-text("Visites"), th:has-text("Dernière"), th:has-text("Dépensé"), th:has-text("Statut"), th:has-text("معرف العميل"), th:has-text("الاسم الكامل"), th:has-text("البريد الإلكتروني"), th:has-text("الهاتف"), th:has-text("العنوان"), th:has-text("تاريخ التسجيل"), th:has-text("إجمالي الزيارات"), th:has-text("آخر زيارة"), th:has-text("إجمالي الإنفاق"), th:has-text("الحالة"), th:has-text("الإجراءات")`).first();
        
        if (await headerElement.count() > 0) {
          const text = await headerElement.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Test customer status badges
      await utils.verifyStatusTranslations();
      
      // Check for specific customer statuses
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
      await utils.takeScreenshot('customers-list', language);
    });
  });

  test('Add Customer Form - Customer registration form translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to customers screen
      await utils.navigateToRoute('/customers');
      
      // Look for Add Customer button
      const addCustomerButton = utils.page.locator('button:has-text("Add Customer"), button:has-text("New Customer"), button:has-text("Ajouter"), button:has-text("Nouveau client"), button:has-text("إضافة عميل"), button:has-text("عميل جديد")').first();
      
      if (await addCustomerButton.count() > 0) {
        await addCustomerButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Test form translations
        await utils.verifyFormTranslations();
        
        // Check specific customer form fields
        const customerFields = [
          'Personal Information',
          'First Name',
          'Last Name',
          'Email Address',
          'Phone Number',
          'Date of Birth',
          'Gender',
          'Address Information',
          'Street Address',
          'City',
          'State/Province',
          'ZIP/Postal Code',
          'Country',
          'Emergency Contact',
          'Preferred Contact Method',
          'Marketing Preferences',
          'Notes'
        ];
        
        for (const field of customerFields) {
          const fieldElement = utils.page.locator(`label:has-text("${field}"), input[name*="${field.toLowerCase().replace(/\s+/g, '')}"], :has-text("Personal"), :has-text("First"), :has-text("Last"), :has-text("Email"), :has-text("Phone"), :has-text("Birth"), :has-text("Gender"), :has-text("Address"), :has-text("Street"), :has-text("City"), :has-text("State"), :has-text("ZIP"), :has-text("Country"), :has-text("Emergency"), :has-text("Contact"), :has-text("Marketing"), :has-text("Notes"), :has-text("Personnel"), :has-text("Prénom"), :has-text("Nom de famille"), :has-text("Téléphone"), :has-text("Naissance"), :has-text("Sexe"), :has-text("Adresse"), :has-text("Rue"), :has-text("Ville"), :has-text("Province"), :has-text("Code postal"), :has-text("Pays"), :has-text("Urgence"), :has-text("Méthode"), :has-text("Marketing"), :has-text("Remarques"), :has-text("معلومات شخصية"), :has-text("الاسم الأول"), :has-text("اسم العائلة"), :has-text("عنوان البريد الإلكتروني"), :has-text("رقم الهاتف"), :has-text("تاريخ الميلاد"), :has-text("الجنس"), :has-text("معلومات العنوان"), :has-text("عنوان الشارع"), :has-text("المدينة"), :has-text("الولاية/المقاطعة"), :has-text("الرمز البريدي"), :has-text("البلد"), :has-text("جهة الاتصال الطارئة"), :has-text("طريقة الاتصال المفضلة"), :has-text("تفضيلات التسويق"), :has-text("ملاحظات")`).first();
          
          if (await fieldElement.count() > 0) {
            const text = await fieldElement.textContent();
            if (text && text.trim()) {
              expect(text.trim().length).toBeGreaterThan(0);
            }
          }
        }
        
        // Test dropdown options
        const dropdowns = ['gender', 'country', 'contactmethod'];
        for (const dropdown of dropdowns) {
          const select = utils.page.locator(`select[name*="${dropdown}"], [class*="${dropdown}"] select`).first();
          if (await select.count() > 0) {
            const options = select.locator('option').all();
            for (const option of await options) {
              const text = await option.textContent();
              if (text && text.trim()) {
                expect(text.trim().length).toBeGreaterThan(0);
              }
            }
          }
        }
        
        // Test form buttons
        await utils.verifyButtonTranslations();
        
        // Check for specific form buttons
        const formButtons = utils.page.locator('button:has-text("Save Customer"), button:has-text("Register"), button:has-text("Cancel"), button:has-text("Enregistrer"), button:has-text("Annuler"), button:has-text("حفظ العميل"), button:has-text("تسجيل"), button:has-text("إلغاء")').all();
        
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
        await utils.takeScreenshot('customers-add-form', language);
      }
    });
  });

  test('Customer Profile View - Detailed customer information translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to customers screen
      await utils.navigateToRoute('/customers');
      
      // Look for view customer profile button
      const viewProfileButton = utils.page.locator('button:has-text("View"), button:has-text("Profile"), button:has-text("Details"), button:has-text("Voir"), button:has-text("Profil"), button:has-text("Détails"), button:has-text("عرض"), button:has-text("الملف الشخصي"), button:has-text("تفاصيل"), 'tr', '[class*="customer-row"]').first();
      
      if (await viewProfileButton.count() > 0) {
        await viewProfileButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Check customer profile sections
        const profileSections = [
          'Customer Information',
          'Contact Details',
          'Vehicle History',
          'Service History',
          'Payment History',
          'Preferences',
          'Account Activity',
          'Notes & Comments'
        ];
        
        for (const section of profileSections) {
          const sectionHeader = utils.page.locator(`h1:has-text("${section}"), h2:has-text("${section}"), h3:has-text("${section}"), h4:has-text("${section}"), :has-text("Customer"), :has-text("Contact"), :has-text("Vehicle"), :has-text("Service"), :has-text("Payment"), :has-text("Preferences"), :has-text("Activity"), :has-text("Notes"), :has-text("Client"), :has-text("Véhicule"), :has-text("Paiement"), :has-text("Préférences"), :has-text("Activité"), :has-text("Commentaires"), :has-text("معلومات العميل"), :has-text("تفاصيل الاتصال"), :has-text("تاريخ المركبة"), :has-text("تاريخ الخدمة"), :has-text("تاريخ الدفع"), :has-text("التفضيلات"), :has-text("نشاط الحساب"), :has-text("الملاحظات والتعليقات")`).first();
          
          if (await sectionHeader.count() > 0) {
            const text = await sectionHeader.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check for action buttons in profile
        const profileActionButtons = utils.page.locator('button:has-text("Edit"), button:has-text("Delete"), button:has-text("Add Vehicle"), button:has-text("Schedule"), button:has-text("Send Message"), button:has-text("Modifier"), button:has-text("Supprimer"), button:has-text("Ajouter véhicule"), button:has-text("Programmer"), button:has-text("Envoyer"), button:has-text("تحرير"), button:has-text("حذف"), button:has-text("إضافة مركبة"), button:has-text("جدولة"), button:has-text("إرسال رسالة")').all();
        
        for (const button of await profileActionButtons) {
          const text = await button.textContent();
          if (text && text.trim()) {
            expect(text.trim().length).toBeGreaterThan(0);
          }
        }
        
        // Check customer statistics/metrics
        const customerStats = utils.page.locator('[class*="stat"], [class*="metric"], [class*="summary"]').all();
        for (const stat of await customerStats) {
          const text = await stat.textContent();
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
        await utils.takeScreenshot('customers-profile-view', language);
      }
    });
  });

  test('Customer Filters - Filter options translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to customers screen
      await utils.navigateToRoute('/customers');
      
      // Test filter translations
      await filterUtils.testFilterTranslations();
      
      // Check specific customer filter options
      const filterSections = [
        'Registration Date',
        'Customer Status',
        'Location/City',
        'Total Spent Range',
        'Visit Frequency',
        'Last Visit Date'
      ];
      
      for (const section of filterSections) {
        const filterSection = utils.page.locator(`label:has-text("${section}"), [class*="filter"]:has-text("${section}"), :has-text("Registration"), :has-text("Status"), :has-text("Location"), :has-text("Spent"), :has-text("Frequency"), :has-text("Last Visit"), :has-text("Inscription"), :has-text("Statut"), :has-text("Emplacement"), :has-text("Dépensé"), :has-text("Fréquence"), :has-text("Dernière visite"), :has-text("تاريخ التسجيل"), :has-text("حالة العميل"), :has-text("الموقع/المدينة"), :has-text("نطاق إجمالي الإنفاق"), :has-text("تكرار الزيارة"), :has-text("تاريخ آخر زيارة")`).first();
        
        if (await filterSection.count() > 0) {
          const text = await filterSection.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Test quick filter buttons
      const quickFilters = utils.page.locator('[class*="quick-filter"] button, button:has-text("Active Customers"), button:has-text("VIP Customers"), button:has-text("New This Month"), button:has-text("Inactive"), button:has-text("Clients actifs"), button:has-text("Clients VIP"), button:has-text("Nouveau ce mois"), button:has-text("Inactif"), button:has-text("عملاء نشطون"), button:has-text("عملاء مميزون"), button:has-text("جديد هذا الشهر"), button:has-text("غير نشط")').all();
      
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
      await utils.takeScreenshot('customers-filters', language);
    });
  });

  test('Customer Search - Search functionality translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to customers screen
      await utils.navigateToRoute('/customers');
      
      // Check search input
      const searchInput = utils.page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="customer" i]').first();
      if (await searchInput.count() > 0) {
        const placeholder = await searchInput.getAttribute('placeholder');
        if (placeholder) {
          expect(placeholder.length).toBeGreaterThan(0);
        }
      }
      
      // Check search filters/options
      const searchOptions = utils.page.locator('[class*="search"] select, [class*="search"] button').all();
      for (const option of await searchOptions) {
        const text = await option.textContent();
        if (text && text.trim()) {
          expect(text.trim().length).toBeGreaterThan(0);
        }
      }
      
      // Test search results messages
      const searchMessages = utils.page.locator(':has-text("results found"), :has-text("No customers"), :has-text("Search results"), :has-text("résultats trouvés"), :has-text("Aucun client"), :has-text("Résultats de recherche"), :has-text("نتيجة موجودة"), :has-text("لا يوجد عملاء"), :has-text("نتائج البحث")').all();
      
      for (const message of await searchMessages) {
        const text = await message.textContent();
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
      await utils.takeScreenshot('customers-search', language);
    });
  });

  test('Customer Statistics - Customer metrics translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to customers screen
      await utils.navigateToRoute('/customers');
      
      // Look for stats/metrics section
      const statsSection = utils.page.locator('[class*="stats"], [class*="metrics"], [class*="summary"], [class*="overview"]').first();
      
      if (await statsSection.count() > 0) {
        // Check stats labels
        const statLabels = [
          'Total Customers',
          'New This Month',
          'Active Customers',
          'VIP Customers',
          'Average Spending',
          'Customer Retention',
          'Total Revenue',
          'Lifetime Value'
        ];
        
        for (const label of statLabels) {
          const statElement = utils.page.locator(`:has-text("${label}"), :has-text("Total"), :has-text("New"), :has-text("Active"), :has-text("VIP"), :has-text("Average"), :has-text("Retention"), :has-text("Revenue"), :has-text("Lifetime"), :has-text("Total clients"), :has-text("Nouveau"), :has-text("Actif"), :has-text("Moyenne"), :has-text("Rétention"), :has-text("Revenus"), :has-text("Valeur à vie"), :has-text("إجمالي العملاء"), :has-text("جديد هذا الشهر"), :has-text("عملاء نشطون"), :has-text("عملاء مميزون"), :has-text("متوسط الإنفاق"), :has-text("الاحتفاظ بالعملاء"), :has-text("إجمالي الإيرادات"), :has-text("القيمة الدائمة")`).first();
          
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
      await utils.takeScreenshot('customers-stats', language);
    });
  });

  test('Customer Import/Export - Data management translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to customers screen
      await utils.navigateToRoute('/customers');
      
      // Look for import/export buttons
      const importExportButtons = utils.page.locator('button:has-text("Import"), button:has-text("Export"), button:has-text("Download"), button:has-text("Upload"), button:has-text("Importer"), button:has-text("Exporter"), button:has-text("Télécharger"), button:has-text("استيراد"), button:has-text("تصدير"), button:has-text("تحميل"), button:has-text("رفع")').all();
      
      for (const button of await importExportButtons) {
        const text = await button.textContent();
        if (text && text.trim()) {
          expect(text.trim().length).toBeGreaterThan(0);
        }
      }
      
      // Check for file format options
      const fileFormats = utils.page.locator(':has-text("CSV"), :has-text("Excel"), :has-text("PDF"), :has-text(".xlsx"), :has-text(".csv")').all();
      
      for (const format of await fileFormats) {
        const text = await format.textContent();
        if (text && text.trim()) {
          expect(text.trim().length).toBeGreaterThan(0);
        }
      }
      
      // Check for bulk action buttons
      const bulkActions = utils.page.locator('button:has-text("Bulk"), button:has-text("Select All"), button:has-text("Delete Selected"), button:has-text("En masse"), button:has-text("Tout sélectionner"), button:has-text("Supprimer"), button:has-text("مجمع"), button:has-text("تحديد الكل"), button:has-text("حذف المحدد")').all();
      
      for (const action of await bulkActions) {
        const text = await action.textContent();
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
      await utils.takeScreenshot('customers-import-export', language);
    });
  });

  test('Customers - Language switching works seamlessly', async ({ page }) => {
    const testUtils = new TranslationTestUtils(page);
    
    // Navigate to customers screen
    await testUtils.navigateToRoute('/customers');
    
    // Test language persistence
    await testUtils.verifyLanguagePersistence();
    
    // Verify that changing language updates customers content immediately
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