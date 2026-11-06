import { expect, test, type Page } from '@playwright/test';

type W = {
  __store: { getState: () => { userId: string | null; isAnonymous: boolean; theme: string; setTheme: (t: 'light' | 'dark') => void } };
  __auth: { signInOrLinkWithGoogle: () => Promise<unknown> };
};

async function signIn(page: Page, email: string): Promise<void> {
  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('button.mdc-button--outlined').first().click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#sign-in').click();
  await popup.waitForEvent('close').catch(() => undefined);
  await page.waitForFunction(() => (window as unknown as W).__store.getState().isAnonymous === false);
}

const ready = (page: Page) =>
  page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);

test('dark mode survives signing out and signing back in', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await ready(page);

  // choose dark as a guest, then sign in
  await page.evaluate(() => (window as unknown as W).__store.getState().setTheme('dark'));
  await expect(page.locator('html')).toHaveClass(/dark/);
  await signIn(page, `theme-${Date.now().toString(36)}@example.com`);
  await expect(page.locator('html')).toHaveClass(/dark/);

  // sign out from the account menu: the app reloads into a fresh guest session, still dark
  await page.getByRole('button', { name: 'Account menu' }).first().click();
  await page.getByRole('dialog', { name: 'Account' }).getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForFunction(() => {
    const s = (window as unknown as Partial<W>).__store?.getState();
    return !!s && !!s.userId && s.isAnonymous === true;
  });
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => (window as unknown as W).__store.getState().theme)).toBe('dark');

  // and signing back in keeps it
  await signIn(page, `theme2-${Date.now().toString(36)}@example.com`);
  await expect(page.locator('html')).toHaveClass(/dark/);

  // choosing light is remembered the same way
  await page.evaluate(() => (window as unknown as W).__store.getState().setTheme('light'));
  await page.reload();
  await ready(page);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('"Device" follows the phone or laptop setting, live, and is remembered', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/');
  await ready(page);

  // until the student chooses, the app stays light, as before
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  await page.getByRole('button', { name: 'Device' }).click();
  await expect(page.getByRole('button', { name: 'Device' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveClass(/dark/); // the device is dark

  // the device switches to light: the app follows without a reload
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark/);

  // remembered after a reload
  await page.reload();
  await ready(page);
  await expect(page.getByRole('button', { name: 'Device' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveClass(/dark/);

  // choosing Light by hand stops following the device
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await context.close();
});

test('on a phone, "Match my device" is in the profile dialog', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 }, colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Edit profile' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Match my device' }).click();
  await expect(dialog.getByRole('button', { name: 'Matching my device' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await context.close();
});
