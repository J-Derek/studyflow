import { expect, test } from '@playwright/test';

test('a blocked Google pop-up shows a message and does not reload the app', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);
  // A real browser returns null from window.open when it blocks a pop-up.
  await page.evaluate(() => {
    (window as unknown as { __reloadMarker?: boolean }).__reloadMarker = true;
    window.open = () => null;
  });
  await page.getByRole('button', { name: 'Sign in with Google' }).first().click();

  await expect(page.getByText(/blocked the Google sign-in window/i)).toBeVisible({ timeout: 10_000 });
  // still the same document: no reload happened
  expect(await page.evaluate(() => (window as unknown as { __reloadMarker?: boolean }).__reloadMarker)).toBe(true);
});
