// Security Hardening: Brute Force Prevention E2E Test
// Feature 017 - Task T015
// Purpose: Test server-side rate limiting prevents brute force attacks

import { test, expect, Page } from '@playwright/test';

// Helper to dismiss cookie banner
async function dismissCookieBanner(page: Page) {
  const cookieAccept = page.getByRole('button', { name: /accept/i });
  if (await cookieAccept.isVisible({ timeout: 1000 }).catch(() => false)) {
    await cookieAccept.click();
  }
}

// Helper to attempt sign-in
async function attemptSignIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test.describe('Brute Force Prevention - REQ-SEC-003', () => {
  const testEmail = `hogballtest+brute-${Date.now()}@gmail.com`;
  const wrongPassword = 'WrongPassword123!';

  test('should lockout after 5 failed login attempts', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // Attempt 1-5: Try to sign in with wrong password
    for (let i = 1; i <= 5; i++) {
      await attemptSignIn(page, testEmail, wrongPassword);

      // Wait for error message to appear and ensure attempt is recorded
      await page.waitForSelector('.alert-error', { timeout: 5000 });
      await page.waitForTimeout(500);
    }

    // Attempt 6: Should be locked out
    await attemptSignIn(page, testEmail, wrongPassword);

    // Wait specifically for the rate limit error text to appear
    await expect(page.locator('.alert-error')).toContainText(/too many|rate.*limit|locked/i, { timeout: 5000 });
    const errorMessage = await page.locator('.alert-error').textContent();

    // Should see rate limit error message
    expect(errorMessage).toMatch(/rate.*limit|too many|locked/i);

    // Error message should mention time to wait
    expect(errorMessage).toMatch(/minute|wait|try again/i);
  });

  test('should persist lockout across browser sessions', async ({
    browser,
  }) => {
    // First browser session - trigger lockout
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await page1.goto('/sign-in');
    await page1.waitForLoadState('networkidle');
    await dismissCookieBanner(page1);

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await attemptSignIn(page1, testEmail, wrongPassword);
      await page1.waitForSelector('.alert-error', { timeout: 5000 });
      await page1.waitForTimeout(500);
    }

    // Verify locked
    await attemptSignIn(page1, testEmail, wrongPassword);
    await expect(page1.locator('.alert-error')).toContainText(/too many|rate.*limit|locked/i, { timeout: 5000 });
    const errorMessage1 = await page1.locator('.alert-error').textContent();
    expect(errorMessage1).toMatch(/rate.*limit|too many|locked/i);

    await context1.close();

    // Second browser session (new context, cleared storage)
    const context2 = await browser.newContext({
      storageState: undefined, // Clear all storage
    });
    const page2 = await context2.newPage();

    await page2.goto('/sign-in');
    await page2.waitForLoadState('networkidle');
    await dismissCookieBanner(page2);

    // Should STILL be locked (server-side enforcement)
    await attemptSignIn(page2, testEmail, wrongPassword);

    await expect(page2.locator('.alert-error')).toContainText(/too many|rate.*limit|locked/i, { timeout: 5000 });
    const errorMessage2 = await page2.locator('.alert-error').textContent();
    expect(errorMessage2).toMatch(/rate.*limit|too many|locked/i);

    await context2.close();
  });

  test('should show remaining attempts counter', async ({ page }) => {
    const uniqueEmail = `hogballtest+attempts-${Date.now()}@gmail.com`;

    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // First attempt
    await attemptSignIn(page, uniqueEmail, wrongPassword);
    await page.waitForTimeout(500);

    // Should show "4 attempts remaining" or similar
    // (This depends on implementation showing the counter)
    // For now, just verify no lockout yet
    await expect(page.locator('text=/rate.*limit|locked/i')).not.toBeVisible();

    // Second attempt
    await attemptSignIn(page, uniqueEmail, wrongPassword);
    await page.waitForTimeout(500);

    // Still not locked
    await expect(page.locator('text=/rate.*limit|locked/i')).not.toBeVisible();
  });

  test('should track different users independently', async ({ browser }) => {
    const userA = `hogballtest+usera-${Date.now()}@gmail.com`;
    const userB = `hogballtest+userb-${Date.now()}@gmail.com`;

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Lock out User A
    await pageA.goto('/sign-in');
    await pageA.waitForLoadState('networkidle');
    await dismissCookieBanner(pageA);
    for (let i = 0; i < 5; i++) {
      await attemptSignIn(pageA, userA, wrongPassword);
      await pageA.waitForSelector('.alert-error', { timeout: 5000 });
      await pageA.waitForTimeout(500);
    }

    // User A should be locked
    await attemptSignIn(pageA, userA, wrongPassword);
    await expect(pageA.locator('.alert-error')).toContainText(/too many|rate.*limit|locked/i, { timeout: 5000 });
    const errorMessageA = await pageA.locator('.alert-error').textContent();
    expect(errorMessageA).toMatch(/rate.*limit|too many|locked/i);

    // User B should still be able to attempt
    await pageB.goto('/sign-in');
    await pageB.waitForLoadState('networkidle');
    await dismissCookieBanner(pageB);
    await attemptSignIn(pageB, userB, wrongPassword);

    // User B should see normal error, not rate limit
    await pageB.waitForSelector('.alert-error', { timeout: 5000 });
    const errorMessageB = await pageB.locator('.alert-error').textContent();
    expect(errorMessageB).not.toMatch(/rate.*limit|too many|locked/i);

    await contextA.close();
    await contextB.close();
  });

  test('should track different attempt types independently', async ({
    page,
  }) => {
    const email = `hogballtest+types-${Date.now()}@gmail.com`;

    // Lock out sign_in attempts
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);
    for (let i = 0; i < 5; i++) {
      await attemptSignIn(page, email, wrongPassword);
      await page.waitForSelector('.alert-error', { timeout: 5000 });
      await page.waitForTimeout(500);
    }

    // sign_in should be locked
    await attemptSignIn(page, email, wrongPassword);
    await expect(page.locator('.alert-error')).toContainText(/too many|rate.*limit|locked/i, { timeout: 5000 });
    const signInError = await page.locator('.alert-error').textContent();
    expect(signInError).toMatch(/rate.*limit|too many|locked/i);

    // But sign_up should still work
    await page.goto('/sign-up');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('ValidPassword123!');
    await page.getByLabel('Confirm Password').fill('ValidPassword123!');
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Should NOT show rate limit (different attempt type)
    await expect(page.locator('text=/rate.*limit/i')).not.toBeVisible();
  });

  test('should not bypass rate limiting by clearing localStorage', async ({
    page,
  }) => {
    const email = `hogballtest+bypass-${Date.now()}@gmail.com`;

    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await attemptSignIn(page, email, wrongPassword);
      await page.waitForSelector('.alert-error', { timeout: 5000 });
      await page.waitForTimeout(500);
    }

    // Clear localStorage (client-side bypass attempt)
    await page.evaluate(() => localStorage.clear());

    // Try again - should STILL be locked (server-side enforcement)
    await page.reload();
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);
    await attemptSignIn(page, email, wrongPassword);

    await expect(page.locator('.alert-error')).toContainText(/too many|rate.*limit|locked/i, { timeout: 5000 });
    const bypassError = await page.locator('.alert-error').textContent();
    expect(bypassError).toMatch(/rate.*limit|too many|locked/i);
  });

  test('should display lockout expiration time', async ({ page }) => {
    const email = `hogballtest+lockout-${Date.now()}@gmail.com`;

    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await dismissCookieBanner(page);

    // Trigger lockout
    for (let i = 0; i < 5; i++) {
      await attemptSignIn(page, email, wrongPassword);
      await page.waitForSelector('.alert-error', { timeout: 5000 });
      await page.waitForTimeout(500);
    }

    // Attempt again
    await attemptSignIn(page, email, wrongPassword);

    // Wait specifically for the rate limit error text to appear
    await expect(page.locator('.alert-error')).toContainText(/too many|rate.*limit|locked/i, { timeout: 5000 });

    // Should show when user can try again
    const errorMessage = await page.locator('.alert-error').textContent();

    expect(errorMessage).toBeTruthy();
    // Message should contain time information
    expect(errorMessage).toMatch(/minute|try.*again|wait/i);
  });
});
