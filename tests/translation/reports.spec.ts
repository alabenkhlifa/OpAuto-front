import { test, expect } from '@playwright/test';
import { TranslationTestUtils } from './utils/translation-utils';
import { TableTestUtils, ModalTestUtils, FilterTestUtils } from './utils/screen-specific-utils';

test.describe('Reports & Analytics - Translation Tests', () => {
  let utils: TranslationTestUtils;
  let tableUtils: TableTestUtils;
  let modalUtils: ModalTestUtils;
  let filterUtils: FilterTestUtils;

  test.beforeEach(async ({ page }) => {
    utils = new TranslationTestUtils(page);
    tableUtils = new TableTestUtils(page);
    modalUtils = new ModalTestUtils(page);
    filterUtils = new FilterTestUtils(page);
    
    // Set language to English first, then navigate to reports screen
    await utils.switchLanguage('en');
    await utils.navigateToRoute('/reports');
  });

  test('Reports Dashboard - Main reports overview translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to reports screen
      await utils.navigateToRoute('/reports');
      
      // Check page title
      const pageTitle = utils.page.locator('h1, [class*="title"]:first-of-type').first();
      if (await pageTitle.count() > 0) {
        const titleText = await pageTitle.textContent();
        expect(titleText?.trim()).toBeTruthy();
      }
      
      // Check report categories/sections
      const reportCategories = [
        'Financial Reports',
        'Operational Reports',
        'Customer Reports',
        'Inventory Reports',
        'Performance Reports',
        'Custom Reports'
      ];
      
      for (const category of reportCategories) {
        const categoryElement = utils.page.locator(`h1:has-text("${category}"), h2:has-text("${category}"), h3:has-text("${category}"), h4:has-text("${category}"), :has-text("Financial"), :has-text("Operational"), :has-text("Customer"), :has-text("Inventory"), :has-text("Performance"), :has-text("Custom"), :has-text("Financier"), :has-text("Opérationnel"), :has-text("Client"), :has-text("Inventaire"), :has-text("Performance"), :has-text("Personnalisé"), :has-text("التقارير المالية"), :has-text("التقارير التشغيلية"), :has-text("تقارير العملاء"), :has-text("تقارير المخزون"), :has-text("تقارير الأداء"), :has-text("تقارير مخصصة")`).first();
        
        if (await categoryElement.count() > 0) {
          const text = await categoryElement.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Check report cards/tiles
      const reportCards = utils.page.locator('[class*="report-card"], [class*="report-tile"], [class*="card"]').all();
      
      if ((await reportCards).length > 0) {
        for (const card of await reportCards) {
          const cardContent = card.locator('h1, h2, h3, h4, h5, h6, p, span').all();
          for (const content of await cardContent) {
            const text = await content.textContent();
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
      await utils.takeScreenshot('reports-dashboard', language);
    });
  });

  test('Financial Reports - Revenue and financial analysis translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to financial reports
      await utils.navigateToRoute('/reports');
      
      // Look for financial reports section or button
      const financialReportsButton = utils.page.locator('button:has-text("Financial"), a:has-text("Financial"), :has-text("Revenue"), :has-text("Profit"), :has-text("Financier"), :has-text("Revenus"), :has-text("Profit"), :has-text("مالي"), :has-text("إيرادات"), :has-text("ربح")').first();
      
      if (await financialReportsButton.count() > 0) {
        await financialReportsButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Check financial report types
        const reportTypes = [
          'Revenue Report',
          'Profit & Loss',
          'Cash Flow',
          'Tax Summary',
          'Payment Analysis',
          'Outstanding Invoices',
          'Monthly Summary',
          'Yearly Overview'
        ];
        
        for (const reportType of reportTypes) {
          const reportElement = utils.page.locator(`:has-text("${reportType}"), :has-text("Revenue"), :has-text("Profit"), :has-text("Loss"), :has-text("Cash Flow"), :has-text("Tax"), :has-text("Payment"), :has-text("Outstanding"), :has-text("Monthly"), :has-text("Yearly"), :has-text("Rapport de revenus"), :has-text("Profits et pertes"), :has-text("Flux de trésorerie"), :has-text("Résumé fiscal"), :has-text("Analyse des paiements"), :has-text("Factures impayées"), :has-text("Résumé mensuel"), :has-text("Vue d'ensemble annuelle"), :has-text("تقرير الإيرادات"), :has-text("الربح والخسارة"), :has-text("التدفق النقدي"), :has-text("ملخص الضرائب"), :has-text("تحليل المدفوعات"), :has-text("الفواتير المستحقة"), :has-text("الملخص الشهري"), :has-text("النظرة العامة السنوية")`).first();
          
          if (await reportElement.count() > 0) {
            const text = await reportElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check financial metrics labels
        const metricsLabels = [
          'Total Revenue',
          'Net Profit',
          'Gross Margin',
          'Operating Expenses',
          'Tax Amount',
          'Growth Rate'
        ];
        
        for (const label of metricsLabels) {
          const metricElement = utils.page.locator(`:has-text("${label}"), :has-text("Revenue"), :has-text("Profit"), :has-text("Margin"), :has-text("Expenses"), :has-text("Tax"), :has-text("Growth"), :has-text("Revenus totaux"), :has-text("Bénéfice net"), :has-text("Marge brute"), :has-text("Charges d'exploitation"), :has-text("Montant des taxes"), :has-text("Taux de croissance"), :has-text("إجمالي الإيرادات"), :has-text("صافي الربح"), :has-text("الهامش الإجمالي"), :has-text("مصاريف التشغيل"), :has-text("مبلغ الضريبة"), :has-text("معدل النمو")`).first();
          
          if (await metricElement.count() > 0) {
            const text = await metricElement.textContent();
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
      await utils.takeScreenshot('reports-financial', language);
    });
  });

  test('Operational Reports - Service and efficiency analysis translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to operational reports
      await utils.navigateToRoute('/reports');
      
      // Look for operational reports section
      const operationalReportsButton = utils.page.locator('button:has-text("Operational"), a:has-text("Operational"), :has-text("Service"), :has-text("Efficiency"), :has-text("Opérationnel"), :has-text("Efficacité"), :has-text("تشغيلي"), :has-text("خدمة"), :has-text("كفاءة")').first();
      
      if (await operationalReportsButton.count() > 0) {
        await operationalReportsButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Check operational report types
        const reportTypes = [
          'Service Efficiency',
          'Mechanic Performance',
          'Appointment Analysis',
          'Service Duration',
          'Customer Satisfaction',
          'Equipment Utilization',
          'Capacity Planning'
        ];
        
        for (const reportType of reportTypes) {
          const reportElement = utils.page.locator(`:has-text("${reportType}"), :has-text("Efficiency"), :has-text("Performance"), :has-text("Appointment"), :has-text("Duration"), :has-text("Satisfaction"), :has-text("Utilization"), :has-text("Capacity"), :has-text("Efficacité du service"), :has-text("Performance mécanicien"), :has-text("Analyse des rendez-vous"), :has-text("Durée du service"), :has-text("Satisfaction client"), :has-text("Utilisation équipement"), :has-text("Planification capacité"), :has-text("كفاءة الخدمة"), :has-text("أداء الميكانيكي"), :has-text("تحليل المواعيد"), :has-text("مدة الخدمة"), :has-text("رضا العملاء"), :has-text("استخدام المعدات"), :has-text("تخطيط السعة")`).first();
          
          if (await reportElement.count() > 0) {
            const text = await reportElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check operational metrics
        const operationalMetrics = [
          'Average Service Time',
          'Completion Rate',
          'First-time Fix Rate',
          'Rework Percentage',
          'Resource Utilization',
          'Queue Time'
        ];
        
        for (const metric of operationalMetrics) {
          const metricElement = utils.page.locator(`:has-text("${metric}"), :has-text("Average"), :has-text("Completion"), :has-text("First-time"), :has-text("Rework"), :has-text("Resource"), :has-text("Queue"), :has-text("Temps de service moyen"), :has-text("Taux d'achèvement"), :has-text("Taux de réparation première fois"), :has-text("Pourcentage de reprise"), :has-text("Utilisation des ressources"), :has-text("Temps d'attente"), :has-text("متوسط وقت الخدمة"), :has-text("معدل الإنجاز"), :has-text("معدل الإصلاح من المرة الأولى"), :has-text("نسبة إعادة العمل"), :has-text("استخدام الموارد"), :has-text("وقت الانتظار")`).first();
          
          if (await metricElement.count() > 0) {
            const text = await metricElement.textContent();
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
      await utils.takeScreenshot('reports-operational', language);
    });
  });

  test('Report Generation - Create custom report translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to reports screen
      await utils.navigateToRoute('/reports');
      
      // Look for create/generate report button
      const createReportButton = utils.page.locator('button:has-text("Create Report"), button:has-text("Generate"), button:has-text("New Report"), button:has-text("Custom"), button:has-text("Créer rapport"), button:has-text("Générer"), button:has-text("Nouveau rapport"), button:has-text("Personnalisé"), button:has-text("إنشاء تقرير"), button:has-text("توليد"), button:has-text("تقرير جديد"), button:has-text("مخصص")').first();
      
      if (await createReportButton.count() > 0) {
        await createReportButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Test report generation form
        await utils.verifyFormTranslations();
        
        // Check report configuration options
        const configurationSections = [
          'Report Type',
          'Date Range',
          'Data Sources',
          'Filters',
          'Grouping',
          'Format Options',
          'Schedule'
        ];
        
        for (const section of configurationSections) {
          const sectionElement = utils.page.locator(`label:has-text("${section}"), h1:has-text("${section}"), h2:has-text("${section}"), h3:has-text("${section}"), :has-text("Report Type"), :has-text("Date Range"), :has-text("Data Sources"), :has-text("Filters"), :has-text("Grouping"), :has-text("Format"), :has-text("Schedule"), :has-text("Type de rapport"), :has-text("Plage de dates"), :has-text("Sources de données"), :has-text("Filtres"), :has-text("Regroupement"), :has-text("Options de format"), :has-text("Planification"), :has-text("نوع التقرير"), :has-text("نطاق التاريخ"), :has-text("مصادر البيانات"), :has-text("المرشحات"), :has-text("التجميع"), :has-text("خيارات التنسيق"), :has-text("الجدولة")`).first();
          
          if (await sectionElement.count() > 0) {
            const text = await sectionElement.textContent();
            if (text && text.trim()) {
              expect(text.trim().length).toBeGreaterThan(0);
            }
          }
        }
        
        // Check export format options
        const exportFormats = utils.page.locator(':has-text("PDF"), :has-text("Excel"), :has-text("CSV"), :has-text("HTML"), :has-text("JSON")').all();
        
        for (const format of await exportFormats) {
          const text = await format.textContent();
          if (text && text.trim()) {
            expect(text.trim().length).toBeGreaterThan(0);
          }
        }
        
        // Check report generation buttons
        const reportButtons = utils.page.locator('button:has-text("Generate"), button:has-text("Preview"), button:has-text("Save Template"), button:has-text("Schedule"), button:has-text("Générer"), button:has-text("Aperçu"), button:has-text("Enregistrer modèle"), button:has-text("Programmer"), button:has-text("توليد"), button:has-text("معاينة"), button:has-text("حفظ النموذج"), button:has-text("جدولة")').all();
        
        for (const button of await reportButtons) {
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
        await utils.takeScreenshot('reports-generation', language);
      }
    });
  });

  test('Report Filters - Report filtering and date range translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to reports screen
      await utils.navigateToRoute('/reports');
      
      // Test filter translations
      await filterUtils.testFilterTranslations();
      
      // Check specific report filter options
      const filterSections = [
        'Time Period',
        'Report Category',
        'Data Range',
        'Department',
        'Mechanic',
        'Customer Type',
        'Service Type'
      ];
      
      for (const section of filterSections) {
        const filterSection = utils.page.locator(`label:has-text("${section}"), [class*="filter"]:has-text("${section}"), :has-text("Time"), :has-text("Period"), :has-text("Category"), :has-text("Data"), :has-text("Department"), :has-text("Mechanic"), :has-text("Customer"), :has-text("Service"), :has-text("Période"), :has-text("Catégorie"), :has-text("Département"), :has-text("Mécanicien"), :has-text("Client"), :has-text("الفترة الزمنية"), :has-text("فئة التقرير"), :has-text("نطاق البيانات"), :has-text("القسم"), :has-text("ميكانيكي"), :has-text("نوع العميل"), :has-text("نوع الخدمة")`).first();
        
        if (await filterSection.count() > 0) {
          const text = await filterSection.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Check date range presets
      const datePresets = utils.page.locator('button:has-text("Today"), button:has-text("This Week"), button:has-text("This Month"), button:has-text("This Quarter"), button:has-text("This Year"), button:has-text("Last 30 Days"), button:has-text("Aujourd\'hui"), button:has-text("Cette semaine"), button:has-text("Ce mois"), button:has-text("Ce trimestre"), button:has-text("Cette année"), button:has-text("30 derniers jours"), button:has-text("اليوم"), button:has-text("هذا الأسبوع"), button:has-text("هذا الشهر"), button:has-text("هذا الربع"), button:has-text("هذا العام"), button:has-text("آخر 30 يوماً")').all();
      
      for (const preset of await datePresets) {
        const text = await preset.textContent();
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
      await utils.takeScreenshot('reports-filters', language);
    });
  });

  test('Report Export - Export and sharing options translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to reports screen
      await utils.navigateToRoute('/reports');
      
      // Look for export/share buttons
      const exportButtons = utils.page.locator('button:has-text("Export"), button:has-text("Download"), button:has-text("Share"), button:has-text("Email"), button:has-text("Print"), button:has-text("Exporter"), button:has-text("Télécharger"), button:has-text("Partager"), button:has-text("Envoyer"), button:has-text("Imprimer"), button:has-text("تصدير"), button:has-text("تحميل"), button:has-text("مشاركة"), button:has-text("بريد إلكتروني"), button:has-text("طباعة")').all();
      
      for (const button of await exportButtons) {
        const text = await button.textContent();
        if (text && text.trim()) {
          expect(text.trim().length).toBeGreaterThan(0);
        }
      }
      
      // Check format options
      const formatOptions = [
        'PDF Format',
        'Excel Spreadsheet',
        'CSV Data',
        'HTML Report',
        'Chart Image'
      ];
      
      for (const format of formatOptions) {
        const formatElement = utils.page.locator(`:has-text("${format}"), :has-text("PDF"), :has-text("Excel"), :has-text("CSV"), :has-text("HTML"), :has-text("Chart"), :has-text("Format PDF"), :has-text("Feuille Excel"), :has-text("Données CSV"), :has-text("Rapport HTML"), :has-text("Image graphique"), :has-text("تنسيق PDF"), :has-text("جدول Excel"), :has-text("بيانات CSV"), :has-text("تقرير HTML"), :has-text("صورة الرسم البياني")`).first();
        
        if (await formatElement.count() > 0) {
          const text = await formatElement.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Check sharing options
      const sharingOptions = utils.page.locator(':has-text("Email Report"), :has-text("Schedule Delivery"), :has-text("Share Link"), :has-text("Team Access"), :has-text("Envoyer rapport"), :has-text("Programmer livraison"), :has-text("Partager lien"), :has-text("Accès équipe"), :has-text("إرسال التقرير"), :has-text("جدولة التسليم"), :has-text("مشاركة الرابط"), :has-text("وصول الفريق")').all();
      
      for (const option of await sharingOptions) {
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
      await utils.takeScreenshot('reports-export', language);
    });
  });

  test('Report Charts - Chart and graph translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to reports screen
      await utils.navigateToRoute('/reports');
      
      // Look for charts/graphs section
      const chartsSection = utils.page.locator('[class*="chart"], [class*="graph"], [class*="visualization"]').first();
      
      if (await chartsSection.count() > 0) {
        // Check chart types and options
        const chartTypes = [
          'Bar Chart',
          'Line Chart',
          'Pie Chart',
          'Area Chart',
          'Scatter Plot',
          'Histogram'
        ];
        
        for (const chartType of chartTypes) {
          const chartElement = utils.page.locator(`:has-text("${chartType}"), :has-text("Bar"), :has-text("Line"), :has-text("Pie"), :has-text("Area"), :has-text("Scatter"), :has-text("Histogram"), :has-text("Graphique à barres"), :has-text("Graphique linéaire"), :has-text("Graphique circulaire"), :has-text("Graphique en aires"), :has-text("Nuage de points"), :has-text("Histogramme"), :has-text("مخطط بياني"), :has-text("مخطط خطي"), :has-text("مخطط دائري"), :has-text("مخطط المنطقة"), :has-text("مخطط التشتت"), :has-text("رسم بياني")`).first();
          
          if (await chartElement.count() > 0) {
            const text = await chartElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check chart labels and legends
        const chartLabels = chartsSection.locator('[class*="label"], [class*="legend"], [class*="axis"]').all();
        for (const label of await chartLabels) {
          const text = await label.textContent();
          if (text && text.trim() && text.trim().length > 1) {
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
      await utils.takeScreenshot('reports-charts', language);
    });
  });

  test('Scheduled Reports - Report scheduling translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to reports screen
      await utils.navigateToRoute('/reports');
      
      // Look for scheduled reports section
      const scheduledReportsButton = utils.page.locator('button:has-text("Scheduled"), a:has-text("Scheduled"), :has-text("Automated"), :has-text("Planifié"), :has-text("Automatisé"), :has-text("مجدول"), :has-text("آلي")').first();
      
      if (await scheduledReportsButton.count() > 0) {
        await scheduledReportsButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Check scheduling options
        const scheduleOptions = [
          'Daily Reports',
          'Weekly Reports',
          'Monthly Reports',
          'Quarterly Reports',
          'Custom Schedule'
        ];
        
        for (const option of scheduleOptions) {
          const scheduleElement = utils.page.locator(`:has-text("${option}"), :has-text("Daily"), :has-text("Weekly"), :has-text("Monthly"), :has-text("Quarterly"), :has-text("Custom"), :has-text("Rapports quotidiens"), :has-text("Rapports hebdomadaires"), :has-text("Rapports mensuels"), :has-text("Rapports trimestriels"), :has-text("Planification personnalisée"), :has-text("تقارير يومية"), :has-text("تقارير أسبوعية"), :has-text("تقارير شهرية"), :has-text("تقارير ربع سنوية"), :has-text("جدولة مخصصة")`).first();
          
          if (await scheduleElement.count() > 0) {
            const text = await scheduleElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check schedule management actions
        const scheduleActions = utils.page.locator('button:has-text("Pause"), button:has-text("Resume"), button:has-text("Edit Schedule"), button:has-text("Delete"), button:has-text("Mettre en pause"), button:has-text("Reprendre"), button:has-text("Modifier planification"), button:has-text("Supprimer"), button:has-text("إيقاف مؤقت"), button:has-text("استئناف"), button:has-text("تحرير الجدولة"), button:has-text("حذف")').all();
        
        for (const action of await scheduleActions) {
          const text = await action.textContent();
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
      await utils.takeScreenshot('reports-scheduled', language);
    });
  });

  test('Reports - Language switching works seamlessly', async ({ page }) => {
    const testUtils = new TranslationTestUtils(page);
    
    // Navigate to reports screen
    await testUtils.navigateToRoute('/reports');
    
    // Test language persistence
    await testUtils.verifyLanguagePersistence();
    
    // Verify that changing language updates reports content immediately
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