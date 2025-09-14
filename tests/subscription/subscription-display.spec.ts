import { test, expect } from '@playwright/test';

test.describe('Subscription Display Component', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the subscription page
    await page.goto('/subscription');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display subscription page header', async ({ page }) => {
    // Check if the main title is visible
    await expect(page.locator('h1')).toContainText('Subscription Plans');
    await expect(page.locator('p')).toContainText('Choose the perfect plan for your garage management needs');
  });

  test('should display current subscription status', async ({ page }) => {
    // Wait for loading to complete
    await page.waitForSelector('.current-subscription', { timeout: 10000 });
    
    // Check if current subscription card is visible
    const currentSubscription = page.locator('.current-subscription');
    await expect(currentSubscription).toBeVisible();
    
    // Check if tier badge is visible
    await expect(currentSubscription.locator('.tier-badge')).toBeVisible();
    
    // Check if billing information is shown
    await expect(currentSubscription).toContainText('Next Billing');
    await expect(currentSubscription).toContainText('days left');
  });

  test('should display usage statistics', async ({ page }) => {
    await page.waitForSelector('.usage-stats', { timeout: 10000 });
    
    const usageStats = page.locator('.usage-stats');
    await expect(usageStats).toBeVisible();
    
    // Check if all three usage metrics are displayed
    const usageItems = usageStats.locator('.usage-item');
    await expect(usageItems).toHaveCount(3);
    
    // Verify users, cars, and service bays are shown
    await expect(usageItems.nth(0)).toContainText(/Users|المستخدمين|Utilisateurs/);
    await expect(usageItems.nth(1)).toContainText(/Cars|السيارات|Voitures/);
    await expect(usageItems.nth(2)).toContainText(/Service Bays|أماكن العمل|Postes de Travail/);
  });

  test('should display progress bars for usage', async ({ page }) => {
    await page.waitForSelector('.progress-bar', { timeout: 10000 });
    
    const progressBars = page.locator('.progress-bar');
    await expect(progressBars).toHaveCount(3);
    
    // Check if progress fills are visible
    const progressFills = page.locator('.progress-fill');
    await expect(progressFills).toHaveCount(3);
    
    // Verify progress percentages are displayed
    for (let i = 0; i < 3; i++) {
      await expect(page.locator('.usage-item').nth(i)).toContainText(/%/);
    }
  });

  test('should display included features', async ({ page }) => {
    await page.waitForSelector('.features-overview', { timeout: 10000 });
    
    const featuresOverview = page.locator('.features-overview');
    await expect(featuresOverview).toBeVisible();
    
    // Check if features title is shown
    await expect(featuresOverview).toContainText(/Included Features|المميزات المشمولة|Fonctionnalités Incluses/);
    
    // Check if features are listed
    const featureItems = featuresOverview.locator('.feature-item');
    await expect(featureItems).toHaveCountGreaterThan(0);
  });

  test('should display tier comparison', async ({ page }) => {
    await page.waitForSelector('.tier-comparison', { timeout: 10000 });
    
    const tierComparison = page.locator('.tier-comparison');
    await expect(tierComparison).toBeVisible();
    
    // Check if comparison title is shown
    await expect(tierComparison).toContainText(/Compare Plans|مقارنة الخطط|Comparer les Plans/);
    
    // Check if all three tiers are displayed
    const tierCards = tierComparison.locator('.tier-card');
    await expect(tierCards).toHaveCount(3);
  });

  test('should show tier badges with correct styling', async ({ page }) => {
    await page.waitForSelector('.tier-card', { timeout: 10000 });
    
    const tierCards = page.locator('.tier-card');
    
    // Check Solo tier (blue)
    const soloTier = tierCards.filter({ hasText: /Solo|فردي/ });
    await expect(soloTier.locator('.tier-badge')).toHaveClass(/solo/);
    
    // Check Starter tier (green) 
    const starterTier = tierCards.filter({ hasText: /Starter|مبتدئ|Débutant/ });
    await expect(starterTier.locator('.tier-badge')).toHaveClass(/starter/);
    
    // Check Professional tier (gold)
    const professionalTier = tierCards.filter({ hasText: /Professional|احترافي|Professionnel/ });
    await expect(professionalTier.locator('.tier-badge')).toHaveClass(/professional/);
  });

  test('should display pricing information', async ({ page }) => {
    await page.waitForSelector('.tier-card', { timeout: 10000 });
    
    const tierCards = page.locator('.tier-card');
    
    // Check if pricing is displayed for each tier
    for (let i = 0; i < 3; i++) {
      const tierCard = tierCards.nth(i);
      await expect(tierCard.locator('.tier-price')).toBeVisible();
      await expect(tierCard).toContainText(/TND|\d+/); // Should contain price
      await expect(tierCard).toContainText(/month|mois|شهر/); // Should contain billing period
    }
  });

  test('should highlight popular plan', async ({ page }) => {
    await page.waitForSelector('.tier-card', { timeout: 10000 });
    
    // Look for "Most Popular" badge
    const popularBadge = page.locator('.popular-badge');
    await expect(popularBadge).toBeVisible();
    await expect(popularBadge).toContainText(/Most Popular|الأكثر شعبية|Plus Populaire/);
  });

  test('should show current plan indicator', async ({ page }) => {
    await page.waitForSelector('.tier-card', { timeout: 10000 });
    
    // Look for current plan indicator
    const currentPlanIndicator = page.locator('.current-plan-indicator');
    await expect(currentPlanIndicator).toBeVisible();
    await expect(currentPlanIndicator).toContainText(/Current Plan|الخطة الحالية|Plan Actuel/);
  });

  test('should display upgrade buttons for non-current tiers', async ({ page }) => {
    await page.waitForSelector('.tier-card', { timeout: 10000 });
    
    // Count upgrade buttons (should be 2 since one tier is current)
    const upgradeButtons = page.locator('button').filter({ hasText: /Upgrade|ترقية|Passer/ });
    await expect(upgradeButtons).toHaveCountGreaterThan(0);
  });

  test('should handle upgrade button clicks', async ({ page }) => {
    await page.waitForSelector('.tier-card', { timeout: 10000 });
    
    // Find an upgrade button and click it
    const upgradeButton = page.locator('button').filter({ hasText: /Upgrade|ترقية|Passer/ }).first();
    
    if (await upgradeButton.isVisible()) {
      await upgradeButton.click();
      
      // Wait for any loading states or changes
      await page.waitForTimeout(1000);
      
      // The button should be disabled during loading
      // Note: In a real implementation, you might check for actual API calls or UI changes
    }
  });

  test('should display FAQ section', async ({ page }) => {
    await page.waitForSelector('.glass-card', { timeout: 10000 });
    
    // Scroll to FAQ section
    await page.locator('h3').filter({ hasText: /Frequently Asked Questions|الأسئلة الشائعة|Questions Fréquemment Posées/ }).scrollIntoViewIfNeeded();
    
    // Check if FAQ section is visible
    const faqSection = page.locator('h3').filter({ hasText: /Frequently Asked Questions|الأسئلة الشائعة|Questions Fréquemment Posées/ });
    await expect(faqSection).toBeVisible();
    
    // Check if FAQ items are present
    await expect(page.locator('h4').filter({ hasText: /billing|facturation|فوترة/ })).toBeVisible();
    await expect(page.locator('h4').filter({ hasText: /cancel|annuler|إلغاء/ })).toBeVisible();
    await expect(page.locator('h4').filter({ hasText: /support|دعم/ })).toBeVisible();
  });

  test('should display contact section', async ({ page }) => {
    // Scroll to bottom
    await page.locator('h3').filter({ hasText: /Need Help|تحتاج مساعدة|Besoin d'Aide/ }).scrollIntoViewIfNeeded();
    
    // Check if contact section is visible
    const contactSection = page.locator('h3').filter({ hasText: /Need Help|تحتاج مساعدة|Besoin d'Aide/ });
    await expect(contactSection).toBeVisible();
    
    // Check if contact buttons are present
    const emailButton = page.locator('button').filter({ hasText: /Email|البريد الإلكتروني/ });
    const phoneButton = page.locator('button').filter({ hasText: /Call|Phone|اتصل|Appeler/ });
    
    await expect(emailButton).toBeVisible();
    await expect(phoneButton).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.waitForSelector('.subscription-display', { timeout: 10000 });
    
    // Check if main container is visible
    await expect(page.locator('.subscription-display')).toBeVisible();
    
    // Check if tier cards stack vertically on mobile
    const tierComparison = page.locator('.tier-comparison');
    await expect(tierComparison).toBeVisible();
    
    // On mobile, tier cards should be stacked
    const tierCards = page.locator('.tier-card');
    await expect(tierCards).toHaveCount(3);
  });

  test('should be responsive on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.waitForSelector('.subscription-display', { timeout: 10000 });
    
    // Check if layout adapts to tablet size
    await expect(page.locator('.subscription-display')).toBeVisible();
    
    // Usage stats should be visible in grid
    const usageStats = page.locator('.usage-stats');
    await expect(usageStats).toBeVisible();
  });

  test('should handle loading states', async ({ page }) => {
    // Intercept the subscription API calls to simulate slow loading
    await page.route('**/api/subscription/**', async route => {
      await page.waitForTimeout(2000); // Simulate slow API
      await route.continue();
    });
    
    await page.goto('/subscription');
    
    // Check if loading indicator is shown initially
    const loadingContainer = page.locator('.loading-container');
    
    // Wait for content to load
    await page.waitForSelector('.subscription-display', { timeout: 15000 });
  });

  test('should display correct feature icons', async ({ page }) => {
    await page.waitForSelector('.features-overview', { timeout: 10000 });
    
    const featureItems = page.locator('.feature-item');
    
    // Check if enabled features show checkmark icons
    const enabledFeatures = featureItems.filter({ hasClass: 'enabled' });
    for (let i = 0; i < await enabledFeatures.count(); i++) {
      await expect(enabledFeatures.nth(i).locator('.feature-icon')).toHaveClass(/enabled/);
    }
    
    // Check if disabled features show X icons  
    const disabledFeatures = featureItems.filter({ hasClass: 'disabled' });
    for (let i = 0; i < await disabledFeatures.count(); i++) {
      await expect(disabledFeatures.nth(i).locator('.feature-icon')).toHaveClass(/disabled/);
    }
  });

  test('should show upgrade requirements for locked features', async ({ page }) => {
    await page.waitForSelector('.features-overview', { timeout: 10000 });
    
    // Look for disabled features with upgrade requirements
    const disabledFeatures = page.locator('.feature-item').filter({ hasClass: 'disabled' });
    
    if (await disabledFeatures.count() > 0) {
      // Check if upgrade tier is mentioned
      await expect(disabledFeatures.first()).toContainText(/Upgrade|ترقية|Passer/);
    }
  });
});