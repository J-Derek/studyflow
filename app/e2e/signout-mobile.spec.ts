import { expect, test } from '@playwright/test';

type W = { __store: { getState: () => { userId: string | null; isAnonymous: boolean } }; __auth: { signInOrLinkWithGoogle: () => Promise<unknown> } };

test('on a phone, a signed-in student can open Account and sign out', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);

  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('button.mdc-button--outlined').first().click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#email-input').fill(`phone-${Date.now().toString(36)}@example.com`);
  await popup.locator('#sign-in').click();
  await popup.waitForEvent('close').catch(() => undefined);
  await page.waitForFunction(() => (window as unknown as W).__store.getState().isAnonymous === false);

  // The header offers Account (the sidebar is hidden at this width).
  await page.getByRole('button', { name: 'Your account', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Saved to your account');
  await page.evaluate(() => ((window as unknown as { __reloadMarker?: boolean }).__reloadMarker = true));
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();

  // the app reloads into a fresh guest session
  await page.waitForFunction(() => !(window as unknown as { __reloadMarker?: boolean }).__reloadMarker);
  await page.waitForFunction(() => {
    const s = (window as unknown as Partial<W>).__store?.getState();
    return !!s && !!s.userId && s.isAnonymous === true;
  });
  await context.close();
});
