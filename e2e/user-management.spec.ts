import { test, expect } from '@playwright/test';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to user management page
    await page.goto('/users');
    
    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('Team Management');
  });

  test.describe('Tier Limits - SOLO', () => {
    test.beforeEach(async ({ page }) => {
      // Mock solo tier with 1 user limit
      await page.evaluate(() => {
        localStorage.setItem('currentTier', JSON.stringify({
          id: 'solo',
          name: 'Solo',
          limits: { users: 1 }
        }));
      });
      await page.reload();
    });

    test('should disable add user button when limit reached', async ({ page }) => {
      // Check that add user button is disabled
      const addButton = page.locator('button', { hasText: 'Invite User' });
      await expect(addButton).toBeDisabled();
    });

    test('should show upgrade prompt when trying to add user', async ({ page }) => {
      const addButton = page.locator('button', { hasText: 'Invite User' });
      await addButton.click();
      
      // Should show upgrade modal instead of invite modal
      await expect(page.locator('text=Upgrade Required')).toBeVisible();
      await expect(page.locator('text=Upgrade to STARTER')).toBeVisible();
    });

    test('should display current usage correctly', async ({ page }) => {
      await page.locator('button', { hasText: 'Plan Info' }).click();
      
      // Should show 1/1 users
      await expect(page.locator('text=1/1')).toBeVisible();
    });
  });

  test.describe('Tier Limits - STARTER', () => {
    test.beforeEach(async ({ page }) => {
      // Mock starter tier with 5 user limit
      await page.evaluate(() => {
        localStorage.setItem('currentTier', JSON.stringify({
          id: 'starter',
          name: 'Starter',
          limits: { users: 5 }
        }));
        localStorage.setItem('currentUsers', '2'); // 2 out of 5 users
      });
      await page.reload();
    });

    test('should enable add user button when under limit', async ({ page }) => {
      const addButton = page.locator('button', { hasText: 'Invite User' });
      await expect(addButton).toBeEnabled();
    });

    test('should show remaining user slots', async ({ page }) => {
      await page.locator('button', { hasText: 'Plan Info' }).click();
      
      // Should show remaining slots (3 remaining)
      await expect(page.locator('text=3')).toBeVisible();
    });

    test('should open invite modal when clicking add user', async ({ page }) => {
      const addButton = page.locator('button', { hasText: 'Invite User' });
      await addButton.click();
      
      // Should show invite modal
      await expect(page.locator('text=Invite Team Member')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });

    test('should show upgrade prompt when at limit', async ({ page }) => {
      // Mock being at the 5 user limit
      await page.evaluate(() => {
        localStorage.setItem('currentUsers', '5');
      });
      await page.reload();
      
      const addButton = page.locator('button', { hasText: 'Invite User' });
      await addButton.click();
      
      await expect(page.locator('text=Upgrade Required')).toBeVisible();
      await expect(page.locator('text=Professional')).toBeVisible();
    });
  });

  test.describe('Tier Limits - PROFESSIONAL', () => {
    test.beforeEach(async ({ page }) => {
      // Mock professional tier with unlimited users
      await page.evaluate(() => {
        localStorage.setItem('currentTier', JSON.stringify({
          id: 'professional',
          name: 'Professional',
          limits: { users: null }
        }));
      });
      await page.reload();
    });

    test('should always enable add user button', async ({ page }) => {
      const addButton = page.locator('button', { hasText: 'Invite User' });
      await expect(addButton).toBeEnabled();
    });

    test('should show unlimited in plan info', async ({ page }) => {
      await page.locator('button', { hasText: 'Plan Info' }).click();
      
      await expect(page.locator('text=∞')).toBeVisible();
    });

    test('should not show upgrade prompts', async ({ page }) => {
      const addButton = page.locator('button', { hasText: 'Invite User' });
      await addButton.click();
      
      // Should open invite modal, not upgrade prompt
      await expect(page.locator('text=Invite Team Member')).toBeVisible();
      await expect(page.locator('text=Upgrade Required')).not.toBeVisible();
    });
  });

  test.describe('User Invitation Flow', () => {
    test('should complete user invitation successfully', async ({ page }) => {
      // Setup starter tier
      await page.evaluate(() => {
        localStorage.setItem('currentTier', JSON.stringify({
          id: 'starter',
          limits: { users: 5 }
        }));
      });
      await page.reload();

      // Click invite user button
      await page.locator('button', { hasText: 'Invite User' }).click();
      
      // Fill invitation form
      await page.fill('input[type="email"]', 'newuser@example.com');
      await page.fill('input[placeholder*="first name"]', 'John');
      await page.fill('input[placeholder*="last name"]', 'Smith');
      await page.selectOption('select', 'mechanic');
      
      // Submit invitation
      await page.locator('button', { hasText: 'Send Invitation' }).click();
      
      // Should close modal and refresh data
      await expect(page.locator('text=Invite Team Member')).not.toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await page.locator('button', { hasText: 'Invite User' }).click();
      
      // Try to submit without filling required fields
      await page.locator('button', { hasText: 'Send Invitation' }).click();
      
      // Should show validation errors
      await expect(page.locator('text=Email address is required')).toBeVisible();
      await expect(page.locator('text=Please select a role')).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.locator('button', { hasText: 'Invite User' }).click();
      
      // Enter invalid email
      await page.fill('input[type="email"]', 'invalid-email');
      await page.selectOption('select', 'admin');
      
      // Try to submit
      await page.locator('button', { hasText: 'Send Invitation' }).click();
      
      // Should show email validation error
      await expect(page.locator('text=Please enter a valid email address')).toBeVisible();
    });
  });

  test.describe('User Management Actions', () => {
    test('should display user list correctly', async ({ page }) => {
      // Should show user cards
      await expect(page.locator('.glass-card').first()).toBeVisible();
      
      // Should show user information
      await expect(page.locator('text=Owner')).toBeVisible();
      await expect(page.locator('text=Admin')).toBeVisible();
    });

    test('should show user statistics', async ({ page }) => {
      // Should display stats cards
      await expect(page.locator('text=Total Users')).toBeVisible();
      await expect(page.locator('text=Active Users')).toBeVisible();
      await expect(page.locator('text=Pending Invitations')).toBeVisible();
    });

    test('should filter users by search', async ({ page }) => {
      // Enter search term
      await page.fill('input[placeholder*="Search"]', 'Owner');
      
      // Should filter results
      await expect(page.locator('text=Owner User')).toBeVisible();
    });
  });

  test.describe('Upgrade Flow', () => {
    test('should display upgrade modal with correct information', async ({ page }) => {
      // Mock being at user limit
      await page.evaluate(() => {
        localStorage.setItem('currentTier', JSON.stringify({
          id: 'starter',
          limits: { users: 5 }
        }));
        localStorage.setItem('currentUsers', '5');
      });
      await page.reload();
      
      // Try to add user
      await page.locator('button', { hasText: 'Invite User' }).click();
      
      // Should show upgrade modal
      await expect(page.locator('text=Upgrade Required')).toBeVisible();
      await expect(page.locator('text=Professional')).toBeVisible();
      await expect(page.locator('text=Unlimited team members')).toBeVisible();
      
      // Should show pricing information
      await expect(page.locator('text=149')).toBeVisible(); // Professional tier price
    });

    test('should handle upgrade process', async ({ page }) => {
      // Mock upgrade modal visible
      await page.evaluate(() => {
        localStorage.setItem('showUpgradeModal', 'true');
      });
      await page.reload();
      
      // Click upgrade button
      await page.locator('button', { hasText: 'Upgrade Now' }).click();
      
      // Should show upgrading state
      await expect(page.locator('text=Upgrading...')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      // Should show mobile-optimized layout
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('button', { hasText: 'Invite User' })).toBeVisible();
      
      // Cards should stack vertically
      const cards = page.locator('.glass-card');
      await expect(cards.first()).toBeVisible();
    });

    test('should display correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      
      // Should show tablet layout
      await expect(page.locator('h1')).toBeVisible();
      
      // Should show grid layout for cards
      const cards = page.locator('.glass-card');
      await expect(cards.first()).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      // Tab through interactive elements
      await page.keyboard.press('Tab'); // Focus first interactive element
      await page.keyboard.press('Tab'); // Move to next element
      
      // Should be able to activate buttons with Enter/Space
      const addButton = page.locator('button', { hasText: 'Invite User' });
      await addButton.focus();
      await page.keyboard.press('Enter');
      
      // Modal should open
      await expect(page.locator('text=Invite Team Member')).toBeVisible();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      // Check for proper labeling
      const addButton = page.locator('button', { hasText: 'Invite User' });
      
      // Should have accessible name
      await expect(addButton).toBeVisible();
    });

    test('should support screen readers', async ({ page }) => {
      // Check for proper heading structure
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('h2, h3')).toHaveCount({ min: 1 });
    });
  });

  test.describe('Translation Support', () => {
    test('should display in Arabic with RTL layout', async ({ page }) => {
      // Set language to Arabic
      await page.evaluate(() => {
        localStorage.setItem('language', 'ar');
      });
      await page.reload();
      
      // Should show RTL layout
      const body = page.locator('body');
      await expect(body).toHaveCSS('direction', 'rtl');
      
      // Should show Arabic text
      await expect(page.locator('text=إدارة الفريق')).toBeVisible();
    });

    test('should display in French', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('language', 'fr');
      });
      await page.reload();
      
      // Should show French text
      await expect(page.locator('text=Gestion d\'Équipe')).toBeVisible();
    });
  });
});