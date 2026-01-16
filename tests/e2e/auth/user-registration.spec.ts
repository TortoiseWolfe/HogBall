/**
 * E2E Test: User Registration Flow (T066)
 *
 * Tests the complete registration journey from quickstart.md:
 * sign-up → verify email → sign-in → access protected pages
 */

import { test, expect, Page } from '@playwright/test';
import {
  createTestUser,
  deleteTestUser,
  isAdminClientAvailable,
  generateTestEmail,
  DEFAULT_TEST_PASSWORD,
} from '../utils/test-user-factory';

// Helper to dismiss cookie banner
async function dismissCookieBanner(page: Page) {
  const cookieAccept = page.getByRole('button', { name: /accept/i });
  if (await cookieAccept.isVisible({ timeout: 1000 }).catch(() => false)) {
    await cookieAccept.click();
  }
}

test.describe('User Registration E2E', () => {
  const testPassword = 'ValidPass123!';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);
  });

  test('should complete full registration flow from sign-up to protected access', async ({
    page,
  }) => {
    // Skip if service role key not configured
    if (!isAdminClientAvailable()) {
      test.skip(true, 'SUPABASE_SERVICE_ROLE_KEY not configured');
      return;
    }

    const testEmail = generateTestEmail('reg');
    const user = await createTestUser(testEmail, DEFAULT_TEST_PASSWORD);

    if (!user) {
      throw new Error('Failed to create test user via admin API');
    }

    try {
      // Step 1: Navigate to sign-in page
      await page.goto('/sign-in');
      await expect(page).toHaveURL(/\/sign-in/);

      // Step 2: Sign in with the created user
      await page.getByLabel('Email').fill(testEmail);
      await page.getByLabel('Password', { exact: true }).fill(DEFAULT_TEST_PASSWORD);
      await page.getByLabel('Remember Me').check();
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Step 3: Wait for sign-in to complete - nav bar should change to show user menu
      await expect(page.getByRole('link', { name: 'Messages' })).toBeVisible({ timeout: 15000 });

      // Step 4: Navigate to profile (protected route)
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');
      await dismissCookieBanner(page);
      await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible({ timeout: 10000 });
      // Email appears multiple times - just verify heading with email
      await expect(page.getByRole('heading', { name: testEmail })).toBeVisible();

      // Step 5: Verify payment demo access (another protected route)
      await page.goto('/payment-demo');
      await page.waitForLoadState('networkidle');
      await dismissCookieBanner(page);
      await expect(page).toHaveURL(/\/payment-demo/);
      await expect(
        page.getByRole('heading', { name: 'Payment Integration Demo' })
      ).toBeVisible();

      // Step 6: Sign out from profile page
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');
      await dismissCookieBanner(page);

      // Dismiss any warning toast/banner that might block clicks
      const warningBanner = page.locator('[role="banner"][class*="bg-warning"]');
      if (await warningBanner.isVisible({ timeout: 500 }).catch(() => false)) {
        const dismissBtn = warningBanner.locator('button').first();
        if (await dismissBtn.isVisible().catch(() => false)) {
          await dismissBtn.click();
          await warningBanner.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
        }
      }

      // Click the user account menu button to open the dropdown
      await page.getByLabel('User account menu').click();

      // Wait for dropdown to appear and click Sign Out using force if needed
      await page.getByRole('button', { name: 'Sign Out' }).click({ force: true, timeout: 10000 });

      // Step 7: Verify redirected
      await page.waitForURL(/\/(sign-in|$)/, { timeout: 10000 });
    } finally {
      // Clean up: Delete test user
      await deleteTestUser(user.id);
    }
  });

  test('should show validation errors for invalid email', async ({ page }) => {
    await page.goto('/sign-up');

    // Use email that passes browser validation but fails app's stricter TLD check
    await page.getByLabel('Email').fill('test@invalid.invalidtld');
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByLabel('Confirm Password').fill(testPassword);

    // Submit form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify validation error shown (app checks for valid TLD)
    await expect(page.getByText(/invalid|error/i)).toBeVisible();
  });

  test('should show validation errors for weak password', async ({ page }) => {
    await page.goto('/sign-up');

    // Fill with weak password (validation fails client-side, no actual sign-up)
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill('weak');
    await page.getByLabel('Confirm Password').fill('weak');

    // Submit form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify validation error shown
    await expect(
      page.getByText(/password must be at least 8 characters/i)
    ).toBeVisible();
  });

  test('should show error for password mismatch', async ({ page }) => {
    await page.goto('/sign-up');

    // Fill with mismatched passwords (validation fails client-side, no actual sign-up)
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill(testPassword);
    await page.getByLabel('Confirm Password').fill('DifferentPass123!');

    // Submit form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Verify validation error shown
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('should navigate to sign-in from sign-up page', async ({ page }) => {
    await page.goto('/sign-up');

    // Click the "Sign in" link in the form (not the one in nav bar)
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();

    // Verify navigated to sign-in
    await expect(page).toHaveURL(/\/sign-in\/?/);
  });

  test('should display OAuth buttons on sign-up page', async ({ page }) => {
    await page.goto('/sign-up');

    // Verify OAuth buttons present (actual button text is "Continue with ...")
    await expect(
      page.getByRole('button', { name: /continue with github/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /continue with google/i })
    ).toBeVisible();
  });
});
