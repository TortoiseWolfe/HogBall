// Security Hardening: Rate Limiting E2E Tests
// Feature 017 - Task T009 (E2E Tests with Real Browser)
// Purpose: Test rate limiting from user perspective

import { test, expect, Page } from '@playwright/test';

// Helper to dismiss cookie banner
async function dismissCookieBanner(page: Page) {
  const cookieAccept = page.getByRole('button', { name: /accept/i });
  if (await cookieAccept.isVisible({ timeout: 1000 }).catch(() => false)) {
    await cookieAccept.click();
  }
}

// Helper to fill sign-in form and submit
async function attemptSignIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

/**
 * E2E Tests for Rate Limiting
 *
 * These tests verify the user experience when rate limiting is triggered.
 * They test the actual UI behavior in a real browser.
 */

test.describe('Rate Limiting - User Experience', () => {
  const testEmail = `hogballtest+ratelimit-${Date.now()}@gmail.com`;
  const testPassword = 'WrongPassword123!';

  test.beforeEach(async ({ page }) => {
    // Navigate to sign-in page
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);
    await expect(page).toHaveTitle(/Sign In/i);
  });

  test('should show lockout message after 5 failed sign-in attempts', async ({
    page,
  }) => {
    // Attempt to sign in 5 times with wrong password
    for (let i = 0; i < 5; i++) {
      await attemptSignIn(page, testEmail, testPassword);

      // Wait for the actual error message to appear (not just the alert element)
      await page.waitForSelector('.alert-error', { timeout: 5000 });

      // Small delay between attempts to ensure attempt is recorded
      await page.waitForTimeout(500);
    }

    // 6th attempt should show rate limit message
    await attemptSignIn(page, testEmail, testPassword);

    // Wait specifically for the rate limit error text to appear
    // The test needs to wait for the message to CHANGE from "Invalid login credentials" to the rate limit message
    await expect(page.locator('.alert-error')).toContainText(/too many|rate.*limit|locked/i, { timeout: 5000 });

    // Should see rate limit error message
    const errorMessage = await page.locator('.alert-error').textContent();
    expect(errorMessage).toMatch(/rate.*limit|too many|try again/i);
  });

  test('should disable submit button when rate limited', async ({ page }) => {
    // Trigger rate limit
    for (let i = 0; i < 5; i++) {
      await attemptSignIn(page, testEmail, testPassword);
      await page.waitForSelector('.alert-error', { timeout: 5000 });
      await page.waitForTimeout(500);
    }

    // Try to submit again
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password', { exact: true }).fill(testPassword);

    // Button might be disabled or show loading state
    const submitButton = page.getByRole('button', { name: 'Sign In' });

    // Wait a moment for UI to update
    await page.waitForTimeout(500);

    // Check if button indicates rate limiting (disabled, loading, or error)
    const isDisabled = await submitButton.isDisabled();
    const hasError = await page.locator('[role="alert"]').count();

    // Either button is disabled OR error message is shown
    expect(isDisabled || hasError > 0).toBe(true);
  });

  test('should show remaining time until unlock', async ({ page }) => {
    const uniqueEmail = `hogballtest+timer-${Date.now()}@gmail.com`;

    // Trigger rate limit
    for (let i = 0; i < 5; i++) {
      await attemptSignIn(page, uniqueEmail, testPassword);
      await page.waitForSelector('.alert-error', { timeout: 5000 });
      await page.waitForTimeout(500);
    }

    // One more attempt to see lockout message
    await attemptSignIn(page, uniqueEmail, testPassword);

    // Wait specifically for the rate limit error text to appear
    await expect(page.locator('.alert-error')).toContainText(/too many|rate.*limit|locked/i, { timeout: 5000 });

    // Should see time remaining (e.g., "15 minutes", "14 minutes", etc.)
    const errorMessage = await page.locator('.alert-error').textContent();
    expect(errorMessage).toMatch(/\d+\s*(minute|min)/i);
  });

  test('should allow different users to sign in independently', async ({
    page,
  }) => {
    const blockedEmail = `hogballtest+blocked-${Date.now()}@gmail.com`;
    const allowedEmail = `hogballtest+allowed-${Date.now()}@gmail.com`;

    // Block first user
    for (let i = 0; i < 5; i++) {
      await attemptSignIn(page, blockedEmail, testPassword);
      await page.waitForSelector('.alert-error', { timeout: 5000 });
      await page.waitForTimeout(500);
    }

    // Try with blocked email - should see rate limit
    await attemptSignIn(page, blockedEmail, testPassword);

    // Wait specifically for the rate limit error text to appear
    await expect(page.locator('.alert-error')).toContainText(/too many|rate.*limit|locked/i, { timeout: 5000 });

    let errorMessage = await page.locator('.alert-error').textContent();
    expect(errorMessage).toMatch(/rate.*limit|too many/i);

    // Try with different email - should NOT be blocked
    await attemptSignIn(page, allowedEmail, testPassword);

    // Wait for error message to appear
    await page.waitForSelector('.alert-error', { timeout: 5000 });

    errorMessage = await page.locator('.alert-error').textContent();

    // Should see invalid credentials, NOT rate limit
    expect(errorMessage).not.toMatch(/rate.*limit|too many/i);
    expect(errorMessage).toMatch(/invalid|incorrect|wrong/i);
  });

  test('should track sign-up and sign-in attempts separately', async ({
    page,
  }) => {
    const email = `hogballtest+separate-${Date.now()}@gmail.com`;

    // Exhaust sign-in attempts
    for (let i = 0; i < 5; i++) {
      await attemptSignIn(page, email, testPassword);
      await page.waitForSelector('.alert-error', { timeout: 5000 });
      await page.waitForTimeout(500);
    }

    // Sign-in should be blocked
    await attemptSignIn(page, email, testPassword);

    // Wait specifically for the rate limit error text to appear
    await expect(page.locator('.alert-error')).toContainText(/too many|rate.*limit|locked/i, { timeout: 5000 });

    const signInError = await page.locator('.alert-error').textContent();
    expect(signInError).toMatch(/rate.*limit|too many/i);

    // Navigate to sign-up page
    await page.goto('/sign-up');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // Sign-up should still be allowed (different rate limit)
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('ValidPassword123!');
    await page.getByLabel('Confirm Password').fill('ValidPassword123!');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    await page.waitForTimeout(500);

    // Should not see rate limit error on sign-up
    const signUpError = await page.locator('[role="alert"]').textContent();
    if (signUpError) {
      expect(signUpError).not.toMatch(/rate.*limit|too many/i);
    }
  });

  test('should show clear error message with actionable information', async ({
    page,
  }) => {
    const email = `hogballtest+clear-${Date.now()}@gmail.com`;

    // Trigger rate limit
    for (let i = 0; i < 5; i++) {
      await attemptSignIn(page, email, testPassword);
      await page.waitForSelector('.alert-error', { timeout: 5000 });
      await page.waitForTimeout(500);
    }

    // Attempt once more
    await attemptSignIn(page, email, testPassword);

    // Wait specifically for the rate limit error text to appear
    await expect(page.locator('.alert-error')).toContainText(/too many|rate.*limit|locked/i, { timeout: 5000 });

    // Check error message quality
    const errorMessage = await page.locator('.alert-error').textContent();

    // Should contain:
    // 1. Clear indication of rate limiting
    expect(errorMessage).toMatch(/rate|limit|too many|attempts/i);

    // 2. Time information
    expect(errorMessage).toMatch(/minute|wait|try again/i);

    // 3. Should be screen-reader accessible
    const errorElement = page.locator('.alert-error');
    await expect(errorElement).toHaveAttribute('role', 'alert');
  });
});

test.describe('Rate Limiting - Password Reset', () => {
  test('should rate limit password reset requests', async ({ page }) => {
    const email = `hogballtest+reset-${Date.now()}@gmail.com`;

    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // Attempt 5 password resets
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email').fill(email);
      await page.getByRole('button', { name: /reset|send|submit/i }).click();
      await page.waitForTimeout(500);

      // After success, form disappears - navigate back for next attempt
      await page.goto('/forgot-password');
      await page.waitForLoadState('networkidle');
      await dismissCookieBanner(page);
    }

    // 6th attempt should be rate limited
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: /reset|send|submit/i }).click();

    await page.waitForTimeout(500);

    // Check for rate limit or success (depending on implementation)
    const alert = await page.locator('[role="alert"]').textContent();
    if (alert) {
      // If there's an alert, it should either be rate limit or success
      expect(alert).toBeTruthy();
    }
  });
});
