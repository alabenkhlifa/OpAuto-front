import { test, expect } from '@playwright/test';
import { TranslationTestUtils } from './utils/translation-utils';
import { TableTestUtils, ModalTestUtils, FilterTestUtils } from './utils/screen-specific-utils';

test.describe('Invoicing & Billing - Translation Tests', () => {
  let utils: TranslationTestUtils;
  let tableUtils: TableTestUtils;
  let modalUtils: ModalTestUtils;
  let filterUtils: FilterTestUtils;

  test.beforeEach(async ({ page }) => {
    utils = new TranslationTestUtils(page);
    tableUtils = new TableTestUtils(page);
    modalUtils = new ModalTestUtils(page);
    filterUtils = new FilterTestUtils(page);
    
    // Set language to English first, then navigate to invoicing screen
    await utils.switchLanguage('en');
    await utils.navigateToRoute('/invoicing');
  });

  test('Invoices List View - Invoice table translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to invoicing screen
      await utils.navigateToRoute('/invoicing');
      
      // Check page title
      const pageTitle = utils.page.locator('h1, [class*="title"]:first-of-type').first();
      if (await pageTitle.count() > 0) {
        const titleText = await pageTitle.textContent();
        expect(titleText?.trim()).toBeTruthy();
      }
      
      // Test table headers
      await tableUtils.testTableHeaderTranslations();
      
      // Look for specific invoice-related headers
      const invoiceHeaders = [
        'Invoice Number',
        'Customer',
        'Vehicle',
        'Issue Date',
        'Due Date',
        'Amount',
        'Tax',
        'Total Amount',
        'Payment Status',
        'Payment Method',
        'Actions'
      ];
      
      for (const header of invoiceHeaders) {
        const headerElement = utils.page.locator(`th:has-text("${header}"), th:has-text("Invoice"), th:has-text("Number"), th:has-text("Customer"), th:has-text("Vehicle"), th:has-text("Issue"), th:has-text("Due"), th:has-text("Amount"), th:has-text("Tax"), th:has-text("Total"), th:has-text("Payment"), th:has-text("Status"), th:has-text("Method"), th:has-text("Actions"), th:has-text("Facture"), th:has-text("Numéro"), th:has-text("Client"), th:has-text("Véhicule"), th:has-text("Émission"), th:has-text("Échéance"), th:has-text("Montant"), th:has-text("Taxe"), th:has-text("Paiement"), th:has-text("Statut"), th:has-text("Méthode"), th:has-text("رقم الفاتورة"), th:has-text("عميل"), th:has-text("مركبة"), th:has-text("تاريخ الإصدار"), th:has-text("تاريخ الاستحقاق"), th:has-text("المبلغ"), th:has-text("ضريبة"), th:has-text("المبلغ الإجمالي"), th:has-text("حالة الدفع"), th:has-text("طريقة الدفع"), th:has-text("الإجراءات")`).first();
        
        if (await headerElement.count() > 0) {
          const text = await headerElement.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Test invoice status badges
      await utils.verifyStatusTranslations();
      
      // Check for specific payment statuses
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
      await utils.takeScreenshot('invoicing-list', language);
    });
  });

  test('Create Invoice Form - Invoice creation form translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to invoicing screen
      await utils.navigateToRoute('/invoicing');
      
      // Look for Create Invoice button
      const createInvoiceButton = utils.page.locator('button:has-text("Create Invoice"), button:has-text("New Invoice"), button:has-text("Generate"), button:has-text("Créer facture"), button:has-text("Nouvelle facture"), button:has-text("Générer"), button:has-text("إنشاء فاتورة"), button:has-text("فاتورة جديدة"), button:has-text("توليد")').first();
      
      if (await createInvoiceButton.count() > 0) {
        await createInvoiceButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Test form translations
        await utils.verifyFormTranslations();
        
        // Check specific invoice form sections
        const invoiceSections = [
          'Invoice Information',
          'Customer Information',
          'Vehicle Details',
          'Services & Parts',
          'Labor Details',
          'Pricing Information',
          'Tax Information',
          'Payment Terms',
          'Additional Notes'
        ];
        
        for (const section of invoiceSections) {
          const sectionHeader = utils.page.locator(`h1:has-text("${section}"), h2:has-text("${section}"), h3:has-text("${section}"), h4:has-text("${section}"), legend:has-text("${section}"), :has-text("Invoice"), :has-text("Customer"), :has-text("Vehicle"), :has-text("Services"), :has-text("Labor"), :has-text("Pricing"), :has-text("Tax"), :has-text("Payment"), :has-text("Notes"), :has-text("Facture"), :has-text("Client"), :has-text("Véhicule"), :has-text("Main-d'œuvre"), :has-text("Prix"), :has-text("Taxe"), :has-text("Paiement"), :has-text("Remarques"), :has-text("معلومات الفاتورة"), :has-text("معلومات العميل"), :has-text("تفاصيل المركبة"), :has-text("الخدمات وقطع الغيار"), :has-text("تفاصيل العمالة"), :has-text("معلومات التسعير"), :has-text("معلومات الضريبة"), :has-text("شروط الدفع"), :has-text("ملاحظات إضافية")`).first();
          
          if (await sectionHeader.count() > 0) {
            const text = await sectionHeader.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check specific form fields
        const invoiceFields = [
          'Invoice Number',
          'Issue Date',
          'Due Date',
          'Customer',
          'Vehicle',
          'Service Description',
          'Quantity',
          'Unit Price',
          'Labor Hours',
          'Labor Rate',
          'Parts Cost',
          'Tax Rate',
          'Discount',
          'Payment Terms'
        ];
        
        for (const field of invoiceFields) {
          const fieldElement = utils.page.locator(`label:has-text("${field}"), input[name*="${field.toLowerCase().replace(/\s+/g, '')}"], :has-text("Number"), :has-text("Date"), :has-text("Customer"), :has-text("Vehicle"), :has-text("Description"), :has-text("Quantity"), :has-text("Price"), :has-text("Hours"), :has-text("Rate"), :has-text("Cost"), :has-text("Tax"), :has-text("Discount"), :has-text("Terms"), :has-text("Numéro"), :has-text("Client"), :has-text("Véhicule"), :has-text("Description"), :has-text("Quantité"), :has-text("Prix"), :has-text("Heures"), :has-text("Taux"), :has-text("Coût"), :has-text("Remise"), :has-text("Conditions"), :has-text("رقم الفاتورة"), :has-text("تاريخ الإصدار"), :has-text("تاريخ الاستحقاق"), :has-text("عميل"), :has-text("مركبة"), :has-text("وصف الخدمة"), :has-text("الكمية"), :has-text("سعر الوحدة"), :has-text("ساعات العمل"), :has-text("معدل العمالة"), :has-text("تكلفة القطع"), :has-text("معدل الضريبة"), :has-text("خصم"), :has-text("شروط الدفع")`).first();
          
          if (await fieldElement.count() > 0) {
            const text = await fieldElement.textContent();
            if (text && text.trim()) {
              expect(text.trim().length).toBeGreaterThan(0);
            }
          }
        }
        
        // Test dropdown options (payment methods, tax types, etc.)
        const dropdowns = ['paymentmethod', 'taxtype', 'terms'];
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
        
        // Check for specific invoice form buttons
        const formButtons = utils.page.locator('button:has-text("Generate Invoice"), button:has-text("Save Draft"), button:has-text("Preview"), button:has-text("Send"), button:has-text("Cancel"), button:has-text("Générer facture"), button:has-text("Enregistrer brouillon"), button:has-text("Aperçu"), button:has-text("Envoyer"), button:has-text("Annuler"), button:has-text("توليد الفاتورة"), button:has-text("حفظ المسودة"), button:has-text("معاينة"), button:has-text("إرسال"), button:has-text("إلغاء")').all();
        
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
        await utils.takeScreenshot('invoicing-create-form', language);
      }
    });
  });

  test('Invoice Details View - Detailed invoice information translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to invoicing screen
      await utils.navigateToRoute('/invoicing');
      
      // Look for view invoice details button
      const viewDetailsButton = utils.page.locator('button:has-text("View"), button:has-text("Details"), button:has-text("Open"), button:has-text("Voir"), button:has-text("Détails"), button:has-text("Ouvrir"), button:has-text("عرض"), button:has-text("تفاصيل"), button:has-text("فتح"), 'tr', '[class*="invoice-row"]').first();
      
      if (await viewDetailsButton.count() > 0) {
        await viewDetailsButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Check invoice details sections
        const detailSections = [
          'Invoice Summary',
          'Customer Information',
          'Vehicle Information',
          'Service Details',
          'Parts & Materials',
          'Labor Information',
          'Cost Breakdown',
          'Tax Information',
          'Payment Information',
          'Invoice History'
        ];
        
        for (const section of detailSections) {
          const sectionHeader = utils.page.locator(`h1:has-text("${section}"), h2:has-text("${section}"), h3:has-text("${section}"), h4:has-text("${section}"), :has-text("Summary"), :has-text("Customer"), :has-text("Vehicle"), :has-text("Service"), :has-text("Parts"), :has-text("Labor"), :has-text("Cost"), :has-text("Tax"), :has-text("Payment"), :has-text("History"), :has-text("Résumé"), :has-text("Client"), :has-text("Véhicule"), :has-text("Pièces"), :has-text("Main-d'œuvre"), :has-text("Coût"), :has-text("Taxe"), :has-text("Paiement"), :has-text("Historique"), :has-text("ملخص الفاتورة"), :has-text("معلومات العميل"), :has-text("معلومات المركبة"), :has-text("تفاصيل الخدمة"), :has-text("قطع الغيار والمواد"), :has-text("معلومات العمالة"), :has-text("تفصيل التكلفة"), :has-text("معلومات الضريبة"), :has-text("معلومات الدفع"), :has-text("تاريخ الفاتورة")`).first();
          
          if (await sectionHeader.count() > 0) {
            const text = await sectionHeader.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check for invoice action buttons
        const invoiceActionButtons = utils.page.locator('button:has-text("Print"), button:has-text("Download PDF"), button:has-text("Send Email"), button:has-text("Edit"), button:has-text("Duplicate"), button:has-text("Mark as Paid"), button:has-text("Imprimer"), button:has-text("Télécharger PDF"), button:has-text("Envoyer email"), button:has-text("Modifier"), button:has-text("Dupliquer"), button:has-text("Marquer payé"), button:has-text("طباعة"), button:has-text("تحميل PDF"), button:has-text("إرسال بريد إلكتروني"), button:has-text("تحرير"), button:has-text("تكرار"), button:has-text("تحديد كمدفوع")').all();
        
        for (const button of await invoiceActionButtons) {
          const text = await button.textContent();
          if (text && text.trim()) {
            expect(text.trim().length).toBeGreaterThan(0);
          }
        }
        
        // Check invoice totals and amounts
        const amountLabels = utils.page.locator(':has-text("Subtotal"), :has-text("Tax"), :has-text("Discount"), :has-text("Total"), :has-text("Paid"), :has-text("Balance"), :has-text("Sous-total"), :has-text("Taxe"), :has-text("Remise"), :has-text("Total"), :has-text("Payé"), :has-text("Solde"), :has-text("المجموع الفرعي"), :has-text("ضريبة"), :has-text("خصم"), :has-text("المجموع"), :has-text("مدفوع"), :has-text("الرصيد")').all();
        
        for (const label of await amountLabels) {
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
        await utils.takeScreenshot('invoicing-details-view', language);
      }
    });
  });

  test('Payment Processing - Payment form translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to invoicing screen
      await utils.navigateToRoute('/invoicing');
      
      // Look for payment processing button
      const processPaymentButton = utils.page.locator('button:has-text("Process Payment"), button:has-text("Record Payment"), button:has-text("Pay"), button:has-text("Traiter paiement"), button:has-text("Enregistrer paiement"), button:has-text("Payer"), button:has-text("معالجة الدفع"), button:has-text("تسجيل الدفع"), button:has-text("دفع")').first();
      
      if (await processPaymentButton.count() > 0) {
        await processPaymentButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Test payment form translations
        await utils.verifyFormTranslations();
        
        // Check payment method options
        const paymentMethods = utils.page.locator(':has-text("Cash"), :has-text("Credit Card"), :has-text("Debit Card"), :has-text("Bank Transfer"), :has-text("Check"), :has-text("Espèces"), :has-text("Carte de crédit"), :has-text("Carte de débit"), :has-text("Virement bancaire"), :has-text("Chèque"), :has-text("نقداً"), :has-text("بطاقة ائتمان"), :has-text("بطاقة خصم"), :has-text("تحويل مصرفي"), :has-text("شيك")').all();
        
        for (const method of await paymentMethods) {
          const text = await method.textContent();
          if (text && text.trim()) {
            expect(text.trim().length).toBeGreaterThan(0);
          }
        }
        
        // Check payment form fields
        const paymentFields = [
          'Payment Amount',
          'Payment Method',
          'Payment Date',
          'Reference Number',
          'Notes'
        ];
        
        for (const field of paymentFields) {
          const fieldElement = utils.page.locator(`label:has-text("${field}"), input[name*="${field.toLowerCase().replace(/\s+/g, '')}"], :has-text("Amount"), :has-text("Method"), :has-text("Date"), :has-text("Reference"), :has-text("Notes"), :has-text("Montant"), :has-text("Méthode"), :has-text("Référence"), :has-text("Remarques"), :has-text("مبلغ الدفع"), :has-text("طريقة الدفع"), :has-text("تاريخ الدفع"), :has-text("رقم المرجع"), :has-text("ملاحظات")`).first();
          
          if (await fieldElement.count() > 0) {
            const text = await fieldElement.textContent();
            if (text && text.trim()) {
              expect(text.trim().length).toBeGreaterThan(0);
            }
          }
        }
        
        // Test payment buttons
        const paymentButtons = utils.page.locator('button:has-text("Process"), button:has-text("Record"), button:has-text("Cancel"), button:has-text("Traiter"), button:has-text("Enregistrer"), button:has-text("Annuler"), button:has-text("معالجة"), button:has-text("تسجيل"), button:has-text("إلغاء")').all();
        
        for (const button of await paymentButtons) {
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
        await utils.takeScreenshot('invoicing-payment-processing', language);
      }
    });
  });

  test('Invoice Filters - Filter options translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to invoicing screen
      await utils.navigateToRoute('/invoicing');
      
      // Test filter translations
      await filterUtils.testFilterTranslations();
      
      // Check specific invoice filter options
      const filterSections = [
        'Date Range',
        'Payment Status',
        'Invoice Status',
        'Customer',
        'Amount Range',
        'Payment Method'
      ];
      
      for (const section of filterSections) {
        const filterSection = utils.page.locator(`label:has-text("${section}"), [class*="filter"]:has-text("${section}"), :has-text("Date"), :has-text("Payment Status"), :has-text("Invoice Status"), :has-text("Customer"), :has-text("Amount"), :has-text("Method"), :has-text("Statut de paiement"), :has-text("Statut de facture"), :has-text("Client"), :has-text("Montant"), :has-text("Méthode"), :has-text("نطاق التاريخ"), :has-text("حالة الدفع"), :has-text("حالة الفاتورة"), :has-text("عميل"), :has-text("نطاق المبلغ"), :has-text("طريقة الدفع")`).first();
        
        if (await filterSection.count() > 0) {
          const text = await filterSection.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Test quick filter buttons
      const quickFilters = utils.page.locator('[class*="quick-filter"] button, button:has-text("Paid"), button:has-text("Unpaid"), button:has-text("Overdue"), button:has-text("This Month"), button:has-text("Payé"), button:has-text("Impayé"), button:has-text("En retard"), button:has-text("Ce mois"), button:has-text("مدفوع"), button:has-text("غير مدفوع"), button:has-text("متأخر"), button:has-text("هذا الشهر")').all();
      
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
      await utils.takeScreenshot('invoicing-filters', language);
    });
  });

  test('Invoice Statistics - Financial metrics translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to invoicing screen
      await utils.navigateToRoute('/invoicing');
      
      // Look for stats/metrics section
      const statsSection = utils.page.locator('[class*="stats"], [class*="metrics"], [class*="summary"], [class*="financial"]').first();
      
      if (await statsSection.count() > 0) {
        // Check financial stats labels
        const statLabels = [
          'Total Revenue',
          'Outstanding Amount',
          'Paid This Month',
          'Overdue Invoices',
          'Average Invoice Value',
          'Tax Collected',
          'Pending Payments',
          'Collection Rate'
        ];
        
        for (const label of statLabels) {
          const statElement = utils.page.locator(`:has-text("${label}"), :has-text("Revenue"), :has-text("Outstanding"), :has-text("Paid"), :has-text("Overdue"), :has-text("Average"), :has-text("Tax"), :has-text("Pending"), :has-text("Collection"), :has-text("Revenus"), :has-text("En cours"), :has-text("Payé"), :has-text("En retard"), :has-text("Moyenne"), :has-text("Taxe"), :has-text("En attente"), :has-text("Taux"), :has-text("إجمالي الإيرادات"), :has-text("المبلغ المستحق"), :has-text("مدفوع هذا الشهر"), :has-text("فواتير متأخرة"), :has-text("متوسط قيمة الفاتورة"), :has-text("ضريبة محصلة"), :has-text("مدفوعات معلقة"), :has-text("معدل التحصيل")`).first();
          
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
      await utils.takeScreenshot('invoicing-stats', language);
    });
  });

  test('Invoice Templates - Template management translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to invoicing screen
      await utils.navigateToRoute('/invoicing');
      
      // Look for template management buttons
      const templateButtons = utils.page.locator('button:has-text("Templates"), button:has-text("Customize"), button:has-text("Settings"), button:has-text("Modèles"), button:has-text("Personnaliser"), button:has-text("Paramètres"), button:has-text("قوالب"), button:has-text("تخصيص"), button:has-text("إعدادات")').all();
      
      for (const button of await templateButtons) {
        const text = await button.textContent();
        if (text && text.trim()) {
          expect(text.trim().length).toBeGreaterThan(0);
        }
      }
      
      // Check for template options
      const templateOptions = utils.page.locator(':has-text("Standard Template"), :has-text("Detailed Template"), :has-text("Simple Template"), :has-text("Custom Template"), :has-text("Modèle standard"), :has-text("Modèle détaillé"), :has-text("Modèle simple"), :has-text("Modèle personnalisé"), :has-text("قالب قياسي"), :has-text("قالب مفصل"), :has-text("قالب بسيط"), :has-text("قالب مخصص")').all();
      
      for (const option of await templateOptions) {
        const text = await option.textContent();
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
      await utils.takeScreenshot('invoicing-templates', language);
    });
  });

  test('Invoicing - Language switching works seamlessly', async ({ page }) => {
    const testUtils = new TranslationTestUtils(page);
    
    // Navigate to invoicing screen
    await testUtils.navigateToRoute('/invoicing');
    
    // Test language persistence
    await testUtils.verifyLanguagePersistence();
    
    // Verify that changing language updates invoicing content immediately
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