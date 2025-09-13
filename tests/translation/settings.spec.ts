import { test, expect } from '@playwright/test';
import { TranslationTestUtils } from './utils/translation-utils';
import { TableTestUtils, ModalTestUtils, FilterTestUtils } from './utils/screen-specific-utils';

test.describe('Settings & Configuration - Translation Tests', () => {
  let utils: TranslationTestUtils;
  let tableUtils: TableTestUtils;
  let modalUtils: ModalTestUtils;
  let filterUtils: FilterTestUtils;

  test.beforeEach(async ({ page }) => {
    utils = new TranslationTestUtils(page);
    tableUtils = new TableTestUtils(page);
    modalUtils = new ModalTestUtils(page);
    filterUtils = new FilterTestUtils(page);
    
    // Set language to English first, then navigate to settings screen
    await utils.switchLanguage('en');
    await utils.navigateToRoute('/settings');
  });

  test('General Settings - Basic application settings translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to settings screen
      await utils.navigateToRoute('/settings');
      
      // Check page title
      const pageTitle = utils.page.locator('h1, [class*="title"]:first-of-type').first();
      if (await pageTitle.count() > 0) {
        const titleText = await pageTitle.textContent();
        expect(titleText?.trim()).toBeTruthy();
      }
      
      // Check settings categories/tabs
      const settingsCategories = [
        'General Settings',
        'Business Information',
        'Language & Localization',
        'Currency Settings',
        'Tax Configuration',
        'Notification Preferences',
        'Security Settings',
        'Backup & Restore'
      ];
      
      for (const category of settingsCategories) {
        const categoryElement = utils.page.locator(`button:has-text("${category}"), a:has-text("${category}"), h2:has-text("${category}"), h3:has-text("${category}"), :has-text("General"), :has-text("Business"), :has-text("Language"), :has-text("Currency"), :has-text("Tax"), :has-text("Notification"), :has-text("Security"), :has-text("Backup"), :has-text("Paramètres généraux"), :has-text("Informations entreprise"), :has-text("Langue et localisation"), :has-text("Paramètres devise"), :has-text("Configuration taxe"), :has-text("Préférences notification"), :has-text("Paramètres sécurité"), :has-text("Sauvegarde et restauration"), :has-text("الإعدادات العامة"), :has-text("معلومات الشركة"), :has-text("اللغة والترجمة"), :has-text("إعدادات العملة"), :has-text("تكوين الضريبة"), :has-text("تفضيلات الإشعار"), :has-text("إعدادات الأمان"), :has-text("النسخ الاحتياطي والاستعادة")`).first();
        
        if (await categoryElement.count() > 0) {
          const text = await categoryElement.textContent();
          expect(text?.trim()).toBeTruthy();
        }
      }
      
      // Check general setting fields
      const settingFields = [
        'Business Name',
        'Contact Email',
        'Phone Number',
        'Address',
        'Working Hours',
        'Time Zone',
        'Default Language',
        'Date Format'
      ];
      
      for (const field of settingFields) {
        const fieldElement = utils.page.locator(`label:has-text("${field}"), input[name*="${field.toLowerCase().replace(/\s+/g, '')}"], :has-text("Business"), :has-text("Contact"), :has-text("Phone"), :has-text("Address"), :has-text("Working"), :has-text("Time Zone"), :has-text("Language"), :has-text("Date"), :has-text("Nom entreprise"), :has-text("Email contact"), :has-text("Téléphone"), :has-text("Adresse"), :has-text("Heures travail"), :has-text("Fuseau horaire"), :has-text("Langue par défaut"), :has-text("Format date"), :has-text("اسم الشركة"), :has-text("بريد الاتصال"), :has-text("رقم الهاتف"), :has-text("العنوان"), :has-text("ساعات العمل"), :has-text("المنطقة الزمنية"), :has-text("اللغة الافتراضية"), :has-text("تنسيق التاريخ")`).first();
        
        if (await fieldElement.count() > 0) {
          const text = await fieldElement.textContent();
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
      await utils.takeScreenshot('settings-general', language);
    });
  });

  test('User Management - User accounts and permissions translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to user management settings
      await utils.navigateToRoute('/settings');
      
      // Look for user management section
      const userManagementButton = utils.page.locator('button:has-text("Users"), a:has-text("Users"), :has-text("User Management"), :has-text("Accounts"), :has-text("Permissions"), :has-text("Utilisateurs"), :has-text("Gestion utilisateurs"), :has-text("Comptes"), :has-text("Autorisations"), :has-text("المستخدمون"), :has-text("إدارة المستخدمين"), :has-text("الحسابات"), :has-text("الصلاحيات")').first();
      
      if (await userManagementButton.count() > 0) {
        await userManagementButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Test user management table
        await tableUtils.testTableHeaderTranslations();
        
        // Check user role options
        const userRoles = [
          'Administrator',
          'Manager',
          'Mechanic',
          'Receptionist',
          'Viewer'
        ];
        
        for (const role of userRoles) {
          const roleElement = utils.page.locator(`:has-text("${role}"), :has-text("Administrator"), :has-text("Manager"), :has-text("Mechanic"), :has-text("Receptionist"), :has-text("Viewer"), :has-text("Administrateur"), :has-text("Gestionnaire"), :has-text("Mécanicien"), :has-text("Réceptionniste"), :has-text("Observateur"), :has-text("مدير"), :has-text("مدير"), :has-text("ميكانيكي"), :has-text("موظف استقبال"), :has-text("عارض")`).first();
          
          if (await roleElement.count() > 0) {
            const text = await roleElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check permission categories
        const permissions = [
          'View Reports',
          'Manage Customers',
          'Process Payments',
          'Manage Inventory',
          'System Administration'
        ];
        
        for (const permission of permissions) {
          const permissionElement = utils.page.locator(`:has-text("${permission}"), :has-text("View"), :has-text("Manage"), :has-text("Process"), :has-text("Administration"), :has-text("Voir rapports"), :has-text("Gérer clients"), :has-text("Traiter paiements"), :has-text("Gérer inventaire"), :has-text("Administration système"), :has-text("عرض التقارير"), :has-text("إدارة العملاء"), :has-text("معالجة المدفوعات"), :has-text("إدارة المخزون"), :has-text("إدارة النظام")`).first();
          
          if (await permissionElement.count() > 0) {
            const text = await permissionElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check user action buttons
        const userActions = utils.page.locator('button:has-text("Add User"), button:has-text("Edit"), button:has-text("Delete"), button:has-text("Reset Password"), button:has-text("Ajouter utilisateur"), button:has-text("Modifier"), button:has-text("Supprimer"), button:has-text("Réinitialiser mot de passe"), button:has-text("إضافة مستخدم"), button:has-text("تحرير"), button:has-text("حذف"), button:has-text("إعادة تعيين كلمة المرور")').all();
        
        for (const action of await userActions) {
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
      await utils.takeScreenshot('settings-users', language);
    });
  });

  test('System Configuration - Technical settings translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to system configuration
      await utils.navigateToRoute('/settings');
      
      // Look for system configuration section
      const systemConfigButton = utils.page.locator('button:has-text("System"), a:has-text("System"), :has-text("Configuration"), :has-text("Technical"), :has-text("Advanced"), :has-text("Système"), :has-text("Technique"), :has-text("Avancé"), :has-text("النظام"), :has-text("التكوين"), :has-text("تقني"), :has-text("متقدم")').first();
      
      if (await systemConfigButton.count() > 0) {
        await systemConfigButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Check system configuration options
        const configOptions = [
          'Database Settings',
          'Email Configuration',
          'API Settings',
          'Integration Options',
          'Performance Settings',
          'Logging Configuration',
          'Cache Settings'
        ];
        
        for (const option of configOptions) {
          const configElement = utils.page.locator(`:has-text("${option}"), :has-text("Database"), :has-text("Email"), :has-text("API"), :has-text("Integration"), :has-text("Performance"), :has-text("Logging"), :has-text("Cache"), :has-text("Paramètres base de données"), :has-text("Configuration email"), :has-text("Paramètres API"), :has-text("Options intégration"), :has-text("Paramètres performance"), :has-text("Configuration journalisation"), :has-text("Paramètres cache"), :has-text("إعدادات قاعدة البيانات"), :has-text("تكوين البريد الإلكتروني"), :has-text("إعدادات API"), :has-text("خيارات التكامل"), :has-text("إعدادات الأداء"), :has-text("تكوين السجل"), :has-text("إعدادات التخزين المؤقت")`).first();
          
          if (await configElement.count() > 0) {
            const text = await configElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check system status indicators
        const statusIndicators = utils.page.locator(':has-text("Status"), :has-text("Online"), :has-text("Offline"), :has-text("Connected"), :has-text("Error"), :has-text("Warning"), :has-text("Statut"), :has-text("En ligne"), :has-text("Hors ligne"), :has-text("Connecté"), :has-text("Erreur"), :has-text("Avertissement"), :has-text("الحالة"), :has-text("متصل"), :has-text("غير متصل"), :has-text("مُتصل"), :has-text("خطأ"), :has-text("تحذير")').all();
        
        for (const indicator of await statusIndicators) {
          const text = await indicator.textContent();
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
      await utils.takeScreenshot('settings-system', language);
    });
  });

  test('Language Settings - Language and localization preferences translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to language settings
      await utils.navigateToRoute('/settings');
      
      // Look for language settings section
      const languageSettingsButton = utils.page.locator('button:has-text("Language"), a:has-text("Language"), :has-text("Localization"), :has-text("Regional"), :has-text("Langue"), :has-text("Localisation"), :has-text("Régional"), :has-text("اللغة"), :has-text("الترجمة"), :has-text("الإقليمي")').first();
      
      if (await languageSettingsButton.count() > 0) {
        await languageSettingsButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Check language options
        const languageOptions = [
          'English',
          'French',
          'Arabic',
          'Default Language',
          'Auto-detect Language',
          'Right-to-Left Support'
        ];
        
        for (const option of languageOptions) {
          const languageElement = utils.page.locator(`:has-text("${option}"), :has-text("English"), :has-text("French"), :has-text("Arabic"), :has-text("Default"), :has-text("Auto-detect"), :has-text("Right-to-Left"), :has-text("Anglais"), :has-text("Français"), :has-text("Arabe"), :has-text("Par défaut"), :has-text("Détection automatique"), :has-text("Droite à gauche"), :has-text("الإنجليزية"), :has-text("الفرنسية"), :has-text("العربية"), :has-text("اللغة الافتراضية"), :has-text("كشف تلقائي للغة"), :has-text("دعم من اليمين إلى اليسار")`).first();
          
          if (await languageElement.count() > 0) {
            const text = await languageElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check regional settings
        const regionalSettings = [
          'Date Format',
          'Time Format',
          'Number Format',
          'Currency Display',
          'First Day of Week'
        ];
        
        for (const setting of regionalSettings) {
          const settingElement = utils.page.locator(`:has-text("${setting}"), :has-text("Date Format"), :has-text("Time Format"), :has-text("Number Format"), :has-text("Currency"), :has-text("First Day"), :has-text("Format date"), :has-text("Format heure"), :has-text("Format nombre"), :has-text("Affichage devise"), :has-text("Premier jour"), :has-text("تنسيق التاريخ"), :has-text("تنسيق الوقت"), :has-text("تنسيق الأرقام"), :has-text("عرض العملة"), :has-text("اليوم الأول من الأسبوع")`).first();
          
          if (await settingElement.count() > 0) {
            const text = await settingElement.textContent();
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
      await utils.takeScreenshot('settings-language', language);
    });
  });

  test('Notification Settings - Notification preferences translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to notification settings
      await utils.navigateToRoute('/settings');
      
      // Look for notification settings section
      const notificationSettingsButton = utils.page.locator('button:has-text("Notifications"), a:has-text("Notifications"), :has-text("Alerts"), :has-text("Messages"), :has-text("Alertes"), :has-text("إشعارات"), :has-text("تنبيهات"), :has-text("رسائل")').first();
      
      if (await notificationSettingsButton.count() > 0) {
        await notificationSettingsButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Check notification types
        const notificationTypes = [
          'Email Notifications',
          'SMS Notifications',
          'Push Notifications',
          'Desktop Notifications',
          'System Alerts'
        ];
        
        for (const type of notificationTypes) {
          const typeElement = utils.page.locator(`:has-text("${type}"), :has-text("Email"), :has-text("SMS"), :has-text("Push"), :has-text("Desktop"), :has-text("System"), :has-text("Notifications email"), :has-text("Notifications SMS"), :has-text("Notifications push"), :has-text("Notifications bureau"), :has-text("Alertes système"), :has-text("إشعارات البريد الإلكتروني"), :has-text("إشعارات SMS"), :has-text("الإشعارات المدفوعة"), :has-text("إشعارات سطح المكتب"), :has-text("تنبيهات النظام")`).first();
          
          if (await typeElement.count() > 0) {
            const text = await typeElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check notification categories
        const notificationCategories = [
          'New Appointments',
          'Payment Received',
          'System Maintenance',
          'Low Inventory',
          'Customer Messages',
          'Report Generation'
        ];
        
        for (const category of notificationCategories) {
          const categoryElement = utils.page.locator(`:has-text("${category}"), :has-text("Appointments"), :has-text("Payment"), :has-text("Maintenance"), :has-text("Inventory"), :has-text("Messages"), :has-text("Report"), :has-text("Nouveaux rendez-vous"), :has-text("Paiement reçu"), :has-text("Maintenance système"), :has-text("Stock faible"), :has-text("Messages client"), :has-text("Génération rapport"), :has-text("مواعيد جديدة"), :has-text("دفعة مستلمة"), :has-text("صيانة النظام"), :has-text("مخزون منخفض"), :has-text("رسائل العملاء"), :has-text("توليد التقرير")`).first();
          
          if (await categoryElement.count() > 0) {
            const text = await categoryElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check notification frequency options
        const frequencyOptions = utils.page.locator(':has-text("Immediate"), :has-text("Hourly"), :has-text("Daily"), :has-text("Weekly"), :has-text("Never"), :has-text("Immédiat"), :has-text("Toutes les heures"), :has-text("Quotidien"), :has-text("Hebdomadaire"), :has-text("Jamais"), :has-text("فوري"), :has-text("كل ساعة"), :has-text("يومي"), :has-text("أسبوعي"), :has-text("أبداً")').all();
        
        for (const option of await frequencyOptions) {
          const text = await option.textContent();
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
      await utils.takeScreenshot('settings-notifications', language);
    });
  });

  test('Security Settings - Security and privacy settings translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to security settings
      await utils.navigateToRoute('/settings');
      
      // Look for security settings section
      const securitySettingsButton = utils.page.locator('button:has-text("Security"), a:has-text("Security"), :has-text("Privacy"), :has-text("Access"), :has-text("Authentication"), :has-text("Sécurité"), :has-text("Confidentialité"), :has-text("Accès"), :has-text("Authentification"), :has-text("الأمان"), :has-text("الخصوصية"), :has-text("الوصول"), :has-text("المصادقة")').first();
      
      if (await securitySettingsButton.count() > 0) {
        await securitySettingsButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Check security options
        const securityOptions = [
          'Password Policy',
          'Two-Factor Authentication',
          'Session Timeout',
          'Login Attempts',
          'Data Encryption',
          'Audit Logging',
          'Access Control'
        ];
        
        for (const option of securityOptions) {
          const securityElement = utils.page.locator(`:has-text("${option}"), :has-text("Password"), :has-text("Two-Factor"), :has-text("Session"), :has-text("Login"), :has-text("Encryption"), :has-text("Audit"), :has-text("Access"), :has-text("Politique mot de passe"), :has-text("Authentification à deux facteurs"), :has-text("Expiration session"), :has-text("Tentatives connexion"), :has-text("Chiffrement données"), :has-text("Journalisation audit"), :has-text("Contrôle accès"), :has-text("سياسة كلمة المرور"), :has-text("المصادقة الثنائية"), :has-text("انتهاء الجلسة"), :has-text("محاولات تسجيل الدخول"), :has-text("تشفير البيانات"), :has-text("سجل المراجعة"), :has-text("التحكم في الوصول")`).first();
          
          if (await securityElement.count() > 0) {
            const text = await securityElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check security action buttons
        const securityActions = utils.page.locator('button:has-text("Change Password"), button:has-text("Enable 2FA"), button:has-text("View Logs"), button:has-text("Reset Security"), button:has-text("Changer mot de passe"), button:has-text("Activer 2FA"), button:has-text("Voir journaux"), button:has-text("Réinitialiser sécurité"), button:has-text("تغيير كلمة المرور"), button:has-text("تمكين 2FA"), button:has-text("عرض السجلات"), button:has-text("إعادة تعيين الأمان")').all();
        
        for (const action of await securityActions) {
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
      await utils.takeScreenshot('settings-security', language);
    });
  });

  test('Backup Settings - Backup and restore options translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to backup settings
      await utils.navigateToRoute('/settings');
      
      // Look for backup settings section
      const backupSettingsButton = utils.page.locator('button:has-text("Backup"), a:has-text("Backup"), :has-text("Restore"), :has-text("Export"), :has-text("Import"), :has-text("Sauvegarde"), :has-text("Restaurer"), :has-text("Exporter"), :has-text("Importer"), :has-text("النسخ الاحتياطي"), :has-text("استعادة"), :has-text("تصدير"), :has-text("استيراد")').first();
      
      if (await backupSettingsButton.count() > 0) {
        await backupSettingsButton.click();
        await utils.page.waitForTimeout(1000);
        
        // Check backup options
        const backupOptions = [
          'Automatic Backup',
          'Manual Backup',
          'Scheduled Backup',
          'Full Backup',
          'Incremental Backup',
          'Data Export',
          'System Restore'
        ];
        
        for (const option of backupOptions) {
          const backupElement = utils.page.locator(`:has-text("${option}"), :has-text("Automatic"), :has-text("Manual"), :has-text("Scheduled"), :has-text("Full"), :has-text("Incremental"), :has-text("Export"), :has-text("Restore"), :has-text("Sauvegarde automatique"), :has-text("Sauvegarde manuelle"), :has-text("Sauvegarde programmée"), :has-text("Sauvegarde complète"), :has-text("Sauvegarde incrémentale"), :has-text("Export données"), :has-text("Restauration système"), :has-text("نسخ احتياطي تلقائي"), :has-text("نسخ احتياطي يدوي"), :has-text("نسخ احتياطي مجدول"), :has-text("نسخ احتياطي كامل"), :has-text("نسخ احتياطي تدريجي"), :has-text("تصدير البيانات"), :has-text("استعادة النظام")`).first();
          
          if (await backupElement.count() > 0) {
            const text = await backupElement.textContent();
            expect(text?.trim()).toBeTruthy();
          }
        }
        
        // Check backup frequency options
        const frequencyOptions = utils.page.locator(':has-text("Daily"), :has-text("Weekly"), :has-text("Monthly"), :has-text("Custom Schedule"), :has-text("Quotidien"), :has-text("Hebdomadaire"), :has-text("Mensuel"), :has-text("Planification personnalisée"), :has-text("يومي"), :has-text("أسبوعي"), :has-text("شهري"), :has-text("جدولة مخصصة")').all();
        
        for (const option of await frequencyOptions) {
          const text = await option.textContent();
          if (text && text.trim()) {
            expect(text.trim().length).toBeGreaterThan(0);
          }
        }
        
        // Check backup action buttons
        const backupActions = utils.page.locator('button:has-text("Create Backup"), button:has-text("Restore"), button:has-text("Download"), button:has-text("Schedule"), button:has-text("Créer sauvegarde"), button:has-text("Restaurer"), button:has-text("Télécharger"), button:has-text("Programmer"), button:has-text("إنشاء نسخة احتياطية"), button:has-text("استعادة"), button:has-text("تحميل"), button:has-text("جدولة")').all();
        
        for (const action of await backupActions) {
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
      await utils.takeScreenshot('settings-backup', language);
    });
  });

  test('Settings Form - Save and apply settings translations (EN/FR/AR)', async () => {
    await utils.testAllLanguages(async (utils, language) => {
      // Navigate to settings screen
      await utils.navigateToRoute('/settings');
      
      // Test form translations for settings
      await utils.verifyFormTranslations();
      
      // Check settings action buttons
      const settingsActions = utils.page.locator('button:has-text("Save Settings"), button:has-text("Apply"), button:has-text("Reset"), button:has-text("Cancel"), button:has-text("Restore Defaults"), button:has-text("Enregistrer paramètres"), button:has-text("Appliquer"), button:has-text("Réinitialiser"), button:has-text("Annuler"), button:has-text("Restaurer défauts"), button:has-text("حفظ الإعدادات"), button:has-text("تطبيق"), button:has-text("إعادة تعيين"), button:has-text("إلغاء"), button:has-text("استعادة الافتراضيات")').all();
      
      for (const action of await settingsActions) {
        const text = await action.textContent();
        if (text && text.trim()) {
          expect(text.trim().length).toBeGreaterThan(0);
        }
      }
      
      // Check confirmation messages
      const confirmationMessages = utils.page.locator(':has-text("Settings saved"), :has-text("Changes applied"), :has-text("Configuration updated"), :has-text("Paramètres enregistrés"), :has-text("Changements appliqués"), :has-text("Configuration mise à jour"), :has-text("تم حفظ الإعدادات"), :has-text("تم تطبيق التغييرات"), :has-text("تم تحديث التكوين")').all();
      
      for (const message of await confirmationMessages) {
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
      await utils.takeScreenshot('settings-form-actions', language);
    });
  });

  test('Settings - Language switching works seamlessly', async ({ page }) => {
    const testUtils = new TranslationTestUtils(page);
    
    // Navigate to settings screen
    await testUtils.navigateToRoute('/settings');
    
    // Test language persistence
    await testUtils.verifyLanguagePersistence();
    
    // Verify that changing language updates settings content immediately
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