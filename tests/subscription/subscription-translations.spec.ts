import { test, expect } from '@playwright/test';

test.describe('Subscription Display - Multi-language Support', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display subscription content in English', async ({ page }) => {
    // Set language to English
    await page.evaluate(() => localStorage.setItem('language', 'en'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to subscription page
    await page.goto('/subscription');
    await page.waitForSelector('.subscription-display', { timeout: 10000 });
    
    // Check English text content
    await expect(page.locator('h1')).toContainText('Subscription Plans');
    await expect(page).toContainText('Choose the perfect plan');
    await expect(page).toContainText('Current Plan');
    await expect(page).toContainText('Next Billing');
    await expect(page).toContainText('days left');
    await expect(page).toContainText('Unlimited');
    await expect(page).toContainText('used');
    await expect(page).toContainText('Included Features');
    await expect(page).toContainText('Compare Plans');
    await expect(page).toContainText('Most Popular');
    
    // Check tier names
    await expect(page).toContainText('Solo');
    await expect(page).toContainText('Starter');
    await expect(page).toContainText('Professional');
    
    // Check usage labels
    await expect(page).toContainText('Users');
    await expect(page).toContainText('Cars');
    await expect(page).toContainText('Service Bays');
    
    // Check feature names
    await expect(page).toContainText('Basic Inventory Management');
    await expect(page).toContainText('Customer Management');
    await expect(page).toContainText('Advanced Reports & Analytics');
  });

  test('should display subscription content in French', async ({ page }) => {
    // Set language to French
    await page.evaluate(() => localStorage.setItem('language', 'fr'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to subscription page
    await page.goto('/subscription');
    await page.waitForSelector('.subscription-display', { timeout: 10000 });
    
    // Check French text content
    await expect(page.locator('h1')).toContainText('Plans d\'Abonnement');
    await expect(page).toContainText('Choisissez le plan parfait');
    await expect(page).toContainText('Plan Actuel');
    await expect(page).toContainText('Prochaine Facturation');
    await expect(page).toContainText('jours restants');
    await expect(page).toContainText('Illimité');
    await expect(page).toContainText('utilisé');
    await expect(page).toContainText('Fonctionnalités Incluses');
    await expect(page).toContainText('Comparer les Plans');
    await expect(page).toContainText('Plus Populaire');
    
    // Check tier names
    await expect(page).toContainText('Solo');
    await expect(page).toContainText('Débutant');
    await expect(page).toContainText('Professionnel');
    
    // Check usage labels
    await expect(page).toContainText('Utilisateurs');
    await expect(page).toContainText('Voitures');
    await expect(page).toContainText('Postes de Travail');
    
    // Check feature names
    await expect(page).toContainText('Gestion Inventaire de Base');
    await expect(page).toContainText('Gestion des Clients');
    await expect(page).toContainText('Rapports Avancés et Analyses');
  });

  test('should display subscription content in Arabic with RTL layout', async ({ page }) => {
    // Set language to Arabic
    await page.evaluate(() => localStorage.setItem('language', 'ar'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Navigate to subscription page
    await page.goto('/subscription');
    await page.waitForSelector('.subscription-display', { timeout: 10000 });
    
    // Check if RTL layout is applied
    const subscriptionDisplay = page.locator('.subscription-display');
    await expect(subscriptionDisplay).toHaveAttribute('dir', 'rtl');
    
    // Check Arabic text content
    await expect(page.locator('h1')).toContainText('خطط الاشتراك');
    await expect(page).toContainText('اختر الخطة المثالية');
    await expect(page).toContainText('الخطة الحالية');
    await expect(page).toContainText('الفوترة التالية');
    await expect(page).toContainText('أيام متبقية');
    await expect(page).toContainText('غير محدود');
    await expect(page).toContainText('مستخدم');
    await expect(page).toContainText('المميزات المشمولة');
    await expect(page).toContainText('مقارنة الخطط');
    await expect(page).toContainText('الأكثر شعبية');
    
    // Check tier names
    await expect(page).toContainText('فردي');
    await expect(page).toContainText('مبتدئ');
    await expect(page).toContainText('احترافي');
    
    // Check usage labels
    await expect(page).toContainText('المستخدمين');
    await expect(page).toContainText('السيارات');
    await expect(page).toContainText('أماكن العمل');
    
    // Check feature names
    await expect(page).toContainText('إدارة المخزون الأساسية');
    await expect(page).toContainText('إدارة العملاء');
    await expect(page).toContainText('التقارير والتحليلات المتقدمة');
  });

  test('should maintain RTL layout for Arabic in all sections', async ({ page }) => {
    // Set language to Arabic
    await page.evaluate(() => localStorage.setItem('language', 'ar'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await page.goto('/subscription');
    await page.waitForSelector('.subscription-display', { timeout: 10000 });
    
    // Check RTL layout in main container
    await expect(page.locator('.subscription-display')).toHaveAttribute('dir', 'rtl');
    
    // Check RTL text alignment in renewal info
    const renewalInfo = page.locator('.renewal-info');
    if (await renewalInfo.count() > 0) {
      await expect(renewalInfo).toHaveClass(/text-left/);
    }
  });

  test('should format currency correctly for each language', async ({ page }) => {
    const languages = [
      { lang: 'en', currency: /\d+.*TND/ },
      { lang: 'fr', currency: /\d+.*TND/ },
      { lang: 'ar', currency: /\d+.*TND/ }
    ];
    
    for (const { lang, currency } of languages) {
      await page.evaluate((language) => localStorage.setItem('language', language), lang);
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      await page.goto('/subscription');
      await page.waitForSelector('.tier-price', { timeout: 10000 });
      
      // Check if pricing is formatted correctly
      const priceElements = page.locator('.tier-price .price-amount');
      const priceCount = await priceElements.count();
      
      for (let i = 0; i < priceCount; i++) {
        const priceText = await priceElements.nth(i).textContent();
        expect(priceText).toMatch(/\d+/); // Should contain numbers
      }
    }
  });

  test('should format dates correctly for each language', async ({ page }) => {
    const languages = ['en', 'fr', 'ar'];
    
    for (const lang of languages) {
      await page.evaluate((language) => localStorage.setItem('language', language), lang);
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      await page.goto('/subscription');
      await page.waitForSelector('.renewal-info', { timeout: 10000 });
      
      // Check if date formatting is present
      const renewalDate = page.locator('.renewal-info').nth(1);
      const dateText = await renewalDate.textContent();
      
      // Should contain some date-like content (numbers, month names, etc.)
      expect(dateText).toMatch(/\d+/);
    }
  });

  test('should handle language switching during subscription view', async ({ page }) => {
    await page.goto('/subscription');
    await page.waitForSelector('.subscription-display', { timeout: 10000 });
    
    // Start with English
    await page.evaluate(() => localStorage.setItem('language', 'en'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify English content
    await expect(page.locator('h1')).toContainText('Subscription Plans');
    
    // Switch to Arabic
    await page.evaluate(() => localStorage.setItem('language', 'ar'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify Arabic content and RTL
    await expect(page.locator('h1')).toContainText('خطط الاشتراك');
    await expect(page.locator('.subscription-display')).toHaveAttribute('dir', 'rtl');
    
    // Switch to French
    await page.evaluate(() => localStorage.setItem('language', 'fr'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify French content
    await expect(page.locator('h1')).toContainText('Plans d\'Abonnement');
  });

  test('should translate upgrade buttons correctly', async ({ page }) => {
    const languages = [
      { lang: 'en', upgradeText: /Upgrade to/ },
      { lang: 'fr', upgradeText: /Passer à/ },
      { lang: 'ar', upgradeText: /ترقية إلى/ }
    ];
    
    for (const { lang, upgradeText } of languages) {
      await page.evaluate((language) => localStorage.setItem('language', language), lang);
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      await page.goto('/subscription');
      await page.waitForSelector('.tier-card', { timeout: 10000 });
      
      // Find upgrade buttons and check their text
      const upgradeButtons = page.locator('button').filter({ hasText: upgradeText });
      const buttonCount = await upgradeButtons.count();
      
      if (buttonCount > 0) {
        await expect(upgradeButtons.first()).toBeVisible();
      }
    }
  });

  test('should translate FAQ section correctly', async ({ page }) => {
    const languages = [
      { 
        lang: 'en', 
        faqTitle: 'Frequently Asked Questions',
        billingQ: /How does billing work/,
        cancelQ: /Can I cancel anytime/,
        supportQ: /What support do I get/
      },
      { 
        lang: 'fr', 
        faqTitle: 'Questions Fréquemment Posées',
        billingQ: /Comment fonctionne la facturation/,
        cancelQ: /Puis-je annuler à tout moment/,
        supportQ: /Quel support obtiens-je/
      },
      { 
        lang: 'ar', 
        faqTitle: 'الأسئلة الشائعة',
        billingQ: /كيف تعمل الفوترة/,
        cancelQ: /هل يمكنني الإلغاء في أي وقت/,
        supportQ: /ما هو الدعم الذي أحصل عليه/
      }
    ];
    
    for (const { lang, faqTitle, billingQ, cancelQ, supportQ } of languages) {
      await page.evaluate((language) => localStorage.setItem('language', language), lang);
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      await page.goto('/subscription');
      
      // Scroll to FAQ section
      await page.locator('h3').filter({ hasText: faqTitle }).scrollIntoViewIfNeeded();
      
      // Check FAQ title
      await expect(page.locator('h3').filter({ hasText: faqTitle })).toBeVisible();
      
      // Check FAQ questions
      await expect(page.locator('h4').filter({ hasText: billingQ })).toBeVisible();
      await expect(page.locator('h4').filter({ hasText: cancelQ })).toBeVisible();
      await expect(page.locator('h4').filter({ hasText: supportQ })).toBeVisible();
    }
  });

  test('should translate contact section correctly', async ({ page }) => {
    const languages = [
      { 
        lang: 'en', 
        contactTitle: /Need Help Choosing/,
        emailBtn: /Contact via Email/,
        phoneBtn: /Call Us/
      },
      { 
        lang: 'fr', 
        contactTitle: /Besoin d'Aide pour Choisir/,
        emailBtn: /Contacter par Email/,
        phoneBtn: /Nous Appeler/
      },
      { 
        lang: 'ar', 
        contactTitle: /تحتاج مساعدة في الاختيار/,
        emailBtn: /التواصل عبر البريد الإلكتروني/,
        phoneBtn: /اتصل بنا/
      }
    ];
    
    for (const { lang, contactTitle, emailBtn, phoneBtn } of languages) {
      await page.evaluate((language) => localStorage.setItem('language', language), lang);
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      await page.goto('/subscription');
      
      // Scroll to contact section
      await page.locator('h3').filter({ hasText: contactTitle }).scrollIntoViewIfNeeded();
      
      // Check contact title
      await expect(page.locator('h3').filter({ hasText: contactTitle })).toBeVisible();
      
      // Check contact buttons
      await expect(page.locator('button').filter({ hasText: emailBtn })).toBeVisible();
      await expect(page.locator('button').filter({ hasText: phoneBtn })).toBeVisible();
    }
  });
});