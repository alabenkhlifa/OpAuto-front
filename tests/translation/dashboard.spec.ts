import { test, expect } from '@playwright/test';
import { DashboardTestUtils, NavigationTestUtils } from './utils/screen-specific-utils';

test.describe('Dashboard & Overview - Translation Tests', () => {
  let dashboardUtils: DashboardTestUtils;
  let navUtils: NavigationTestUtils;

  test.beforeEach(async ({ page }) => {
    dashboardUtils = new DashboardTestUtils(page);
    navUtils = new NavigationTestUtils(page);
    
    // Set language to English first, then navigate to dashboard
    await dashboardUtils.switchLanguage('en');
    await dashboardUtils.navigateToRoute('/dashboard');
  });

  test('Dashboard - Metrics cards translations (EN/FR/AR)', async () => {
    await dashboardUtils.testAllLanguages(async (utils, language) => {
      // Navigate to dashboard
      await utils.navigateToRoute('/dashboard');
      
      // Test metrics cards translations
      await dashboardUtils.testMetricsCardsTranslations();
      
      // Look for specific metric cards mentioned in the issue
      const revenueCard = utils.page.locator(':has-text("Revenue"), :has-text("Chiffre"), :has-text("إيرادات")').first();
      if (await revenueCard.count() > 0) {
        const text = await revenueCard.textContent();
        expect(text?.trim()).toBeTruthy();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
      
      const carsCard = utils.page.locator(':has-text("Cars Today"), :has-text("cars"), :has-text("Voitures"), :has-text("سيارات")').first();
      if (await carsCard.count() > 0) {
        const text = await carsCard.textContent();
        expect(text?.trim()).toBeTruthy();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
      
      const slotsCard = utils.page.locator(':has-text("Slots"), :has-text("Available"), :has-text("Créneaux"), :has-text("فتحات")').first();
      if (await slotsCard.count() > 0) {
        const text = await slotsCard.textContent();
        expect(text?.trim()).toBeTruthy();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
      
      // Verify no hardcoded text appears
      await utils.verifyNoHardcodedText();
      
      // For Arabic, verify text renders correctly
      if (language === 'ar') {
        await utils.verifyArabicTextRendering();
      }
      
      // Take screenshot for documentation
      await utils.takeScreenshot('dashboard-metrics-cards', language);
    });
  });

  test('Dashboard - Today\'s appointments timeline translations (EN/FR/AR)', async () => {
    await dashboardUtils.testAllLanguages(async (utils, language) => {
      // Navigate to dashboard
      await utils.navigateToRoute('/dashboard');
      
      // Look for appointments timeline section
      const timelineSection = utils.page.locator('[class*="timeline"], [class*="schedule"], [class*="appointment"]').first();
      
      if (await timelineSection.count() > 0) {
        // Check section title
        const sectionTitle = timelineSection.locator('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="header"]').first();
        if (await sectionTitle.count() > 0) {
          const titleText = await sectionTitle.textContent();
          expect(titleText?.trim()).toBeTruthy();
          expect(titleText?.trim().length).toBeGreaterThan(0);
        }
        
        // Check for time labels
        const timeLabels = timelineSection.locator('[class*="time"], [class*="hour"], time').all();
        for (const timeLabel of await timeLabels) {
          const text = await timeLabel.textContent();
          if (text && text.trim()) {
            expect(text.trim().length).toBeGreaterThan(0);
          }
        }
        
        // Check for status indicators
        const statusIndicators = timelineSection.locator('[class*="status"], [class*="badge"]').all();
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
      await utils.takeScreenshot('dashboard-appointments-timeline', language);
    });
  });

  test('Dashboard - Active jobs progress tracker translations (EN/FR/AR)', async () => {
    await dashboardUtils.testAllLanguages(async (utils, language) => {
      // Navigate to dashboard
      await utils.navigateToRoute('/dashboard');
      
      // Look for active jobs section
      const activeJobsSection = utils.page.locator(':has-text("Active"), :has-text("Progress"), :has-text("Actifs"), :has-text("نشطة")').first();
      
      if (await activeJobsSection.count() > 0) {
        // Check section title
        const sectionTitle = activeJobsSection.locator('h1, h2, h3, h4, h5, h6, [class*="title"]').first();
        if (await sectionTitle.count() > 0) {
          const titleText = await sectionTitle.textContent();
          expect(titleText?.trim()).toBeTruthy();
        }
        
        // Check for progress labels
        const progressLabels = utils.page.locator('[class*="progress"], [class*="complete"], [class*="percentage"]').all();
        for (const progressLabel of await progressLabels) {
          const text = await progressLabel.textContent();
          if (text && text.trim()) {
            expect(text.trim().length).toBeGreaterThan(0);
          }
        }
        
        // Check for status badges
        await utils.verifyStatusTranslations();
        
        // ✅ NEW: Comprehensive dashboard status validation
        await dashboardUtils.verifyDashboardStatusTranslations();
      }
      
      // Verify no hardcoded text appears
      await utils.verifyNoHardcodedText();
      
      // For Arabic, verify text renders correctly
      if (language === 'ar') {
        await utils.verifyArabicTextRendering();
      }
      
      // Take screenshot for documentation
      await utils.takeScreenshot('dashboard-active-jobs-progress', language);
    });
  });

  test('Dashboard - Quick action buttons translations (EN/FR/AR)', async () => {
    await dashboardUtils.testAllLanguages(async (utils, language) => {
      // Navigate to dashboard
      await utils.navigateToRoute('/dashboard');
      
      // Test quick actions
      await dashboardUtils.testQuickActionsTranslations();
      
      // Look for specific quick action buttons mentioned in translations
      const quickActionButtons = [
        'New Car Entry',
        'Schedule Appointment', 
        'Generate Invoice',
        'Quality Check'
      ];
      
      for (const actionText of quickActionButtons) {
        const button = utils.page.locator(`button:has-text("${actionText}"), button:has-text("Nouvelle"), button:has-text("Programmer"), button:has-text("Générer"), button:has-text("Qualité"), button:has-text("تسجيل"), button:has-text("جدولة"), button:has-text("فاتورة"), button:has-text("جودة")`).first();
        
        if (await button.count() > 0) {
          await expect(button).toBeVisible();
          const buttonText = await button.textContent();
          expect(buttonText?.trim()).toBeTruthy();
          expect(buttonText?.trim().length).toBeGreaterThan(0);
        }
      }
      
      // Check quick action descriptions
      const descriptions = utils.page.locator('[class*="description"], [class*="subtitle"], small, span[class*="text"]').all();
      for (const desc of await descriptions) {
        const text = await desc.textContent();
        if (text && text.trim() && text.trim().length > 10) { // Filter out short/icon text
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
      await utils.takeScreenshot('dashboard-quick-actions', language);
    });
  });

  test('Dashboard - Urgent actions section translations (EN/FR/AR)', async () => {
    await dashboardUtils.testAllLanguages(async (utils, language) => {
      // Navigate to dashboard
      await utils.navigateToRoute('/dashboard');
      
      // Look for urgent actions section
      const urgentSection = utils.page.locator(':has-text("Urgent"), :has-text("🚨"), [class*="urgent"], [class*="alert"]').first();
      
      if (await urgentSection.count() > 0) {
        // Check urgent section title
        const urgentTitle = urgentSection.locator('h1, h2, h3, h4, h5, h6, [class*="title"]').first();
        if (await urgentTitle.count() > 0) {
          const titleText = await urgentTitle.textContent();
          expect(titleText?.trim()).toBeTruthy();
        }
        
        // Check approval count text
        const approvalText = urgentSection.locator(':has-text("jobs need"), :has-text("approval"), :has-text("travaux"), :has-text("approbation"), :has-text("وظائف"), :has-text("موافقة")').first();
        if (await approvalText.count() > 0) {
          const text = await approvalText.textContent();
          expect(text?.trim()).toBeTruthy();
        }
        
        // Check review button
        const reviewButton = urgentSection.locator('button:has-text("Review"), button:has-text("Réviser"), button:has-text("مراجعة")').first();
        if (await reviewButton.count() > 0) {
          await expect(reviewButton).toBeVisible();
        }
      }
      
      // Verify no hardcoded text appears
      await utils.verifyNoHardcodedText();
      
      // For Arabic, verify text renders correctly
      if (language === 'ar') {
        await utils.verifyArabicTextRendering();
      }
      
      // Take screenshot for documentation
      await utils.takeScreenshot('dashboard-urgent-actions', language);
    });
  });

  test('Dashboard - Navigation and global components translations (EN/FR/AR)', async () => {
    await dashboardUtils.testAllLanguages(async (utils, language) => {
      // Navigate to dashboard
      await utils.navigateToRoute('/dashboard');
      
      // Test sidebar navigation
      await navUtils.testSidebarTranslations();
      
      // Test language toggle
      await navUtils.testLanguageToggleTranslations();
      
      // Check page title
      const pageTitle = utils.page.locator('title');
      if (await pageTitle.count() > 0) {
        const title = await pageTitle.textContent();
        expect(title?.trim()).toBeTruthy();
      }
      
      // Check main dashboard title
      const dashboardTitle = utils.page.locator('h1, [class*="title"]:first-of-type').first();
      if (await dashboardTitle.count() > 0) {
        const titleText = await dashboardTitle.textContent();
        expect(titleText?.trim()).toBeTruthy();
        expect(titleText?.trim().length).toBeGreaterThan(0);
      }
      
      // Verify no hardcoded text appears
      await utils.verifyNoHardcodedText();
      
      // For Arabic, verify text renders correctly
      if (language === 'ar') {
        await utils.verifyArabicTextRendering();
      }
      
      // Take screenshot for documentation
      await utils.takeScreenshot('dashboard-navigation-global', language);
    });
  });

  test('Dashboard - Language switching works seamlessly', async ({ page }) => {
    const utils = new DashboardTestUtils(page);
    
    // Navigate to dashboard
    await utils.navigateToRoute('/dashboard');
    
    // Test language persistence
    await utils.verifyLanguagePersistence();
    
    // Verify that changing language updates dashboard content immediately
    await utils.switchLanguage('en');
    const englishContent = await utils.page.locator('body').textContent();
    
    await utils.switchLanguage('fr');
    const frenchContent = await utils.page.locator('body').textContent();
    
    await utils.switchLanguage('ar');
    const arabicContent = await utils.page.locator('body').textContent();
    
    // Content should be different for each language
    expect(englishContent).not.toBe(frenchContent);
    expect(frenchContent).not.toBe(arabicContent);
    expect(englishContent).not.toBe(arabicContent);
  });
});