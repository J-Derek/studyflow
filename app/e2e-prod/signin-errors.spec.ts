import { expect, test } from '@playwright/test';

type Store = { userId: string | null; isAnonymous: boolean; userEmail: string | null; assignments: Array<{ title: string }>; addAssignment: (a: unknown) => void };
const store = () => (window as unknown as { __store: { getState: () => Store } }).__store.getState();

// In the production build (minified, with Vite's preload helper) a blocked Google pop-up must not leave the
// student stuck: the app signs in on the same page instead and comes back signed in, keeping their records.
test('a blocked Google pop-up falls back to signing in on the same page, in the production build', async ({ page }) => {
  // an ad blocker replaces window.open; installed before the app's own code runs, and kept for the return trip
  await page.addInitScript(() => {
    (window as unknown as { open: unknown }).open = function newOpenWrapper() {
      return null;
    };
  });
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => Store } }).__store?.getState().userId);
  await page.evaluate(() =>
    (window as unknown as { __store: { getState: () => Store } }).__store
      .getState()
      .addAssignment({ title: 'Kept through sign-in', course: 'PROD 101', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 })
  );
  const uidBefore = await page.evaluate(() => (window as unknown as { __store: { getState: () => Store } }).__store.getState().userId);

  await page.getByRole('button', { name: 'Sign in with Google' }).first().click();

  // the page goes to Google (the Auth emulator's stand-in page) instead of opening a window
  await page.waitForURL(/emulator\/auth\/handler/, { timeout: 20_000 });
  await page.locator('button.mdc-button--outlined').first().click(); // "Add new account"
  await page.locator('#autogen-button').click();
  const email = `prod-${Date.now().toString(36)}@example.com`;
  await page.locator('#email-input').fill(email);
  await page.locator('#sign-in').click();
  await page.waitForURL((url) => !url.href.includes('/emulator/'), { timeout: 20_000 });

  // back on the app, signed in as the same person, records intact, no error message
  await page.waitForFunction(() => {
    const s = (window as unknown as { __store?: { getState: () => Store } }).__store?.getState();
    return !!s && s.isAnonymous === false;
  });
  const after = await page.evaluate(() => {
    const s = (window as unknown as { __store: { getState: () => Store } }).__store.getState();
    return { uid: s.userId, email: s.userEmail, titles: s.assignments.map((a) => a.title) };
  });
  expect(after.email).toBe(email);
  expect(after.uid).toBe(uidBefore);
  expect(after.titles).toContain('Kept through sign-in');
  await expect(page.getByRole('alert')).toHaveCount(0);
  void store;
});
