import { expect, test, type Page } from '@playwright/test';

type S = {
  userId: string | null;
  isAnonymous: boolean;
  authDisplayName: string | null;
  user: { name: string; university: string; program: string };
};
type W = { __store: { getState: () => S; setState: (p: Partial<S>) => void }; __auth: { signInOrLinkWithGoogle: () => Promise<unknown> } };

const ready = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);

async function state(page: Page): Promise<S> {
  for (let i = 0; ; i++) {
    try {
      return await page.evaluate(() => (window as unknown as W).__store.getState());
    } catch (err) {
      if (i > 5) throw err;
      await page.waitForTimeout(500);
    }
  }
}

test('a placeholder or old sample profile gives way to the Google name, and stays fixed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await ready(page);

  // An account that an early build filled with the fictional sample profile.
  await page.evaluate(() => {
    const st = (window as unknown as W).__store;
    st.setState({ user: { ...st.getState().user, name: 'Alex Vance', university: 'Polytechnic Institute', program: 'Computer Science & Mathematics' } } as Partial<S>);
  });

  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('button.mdc-button--outlined').first().click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#display-name-input').fill('Wanjiru Kamau');
  await popup.locator('#email-input').fill(`gname-${Date.now().toString(36)}@example.com`);
  await popup.locator('#sign-in').click();
  await popup.waitForEvent('close').catch(() => undefined);
  await page.waitForFunction(() => (window as unknown as Partial<W>).__store?.getState().isAnonymous === false);

  await expect.poll(async () => (await state(page)).user.name, { timeout: 20_000 }).toBe('Wanjiru Kamau');
  const s = await state(page);
  expect(s.authDisplayName).toBe('Wanjiru Kamau');
  expect(s.user.university).toBe('My university');
  expect(s.user.program).toBe('My programme');

  // The account menu shows the real name and no made-up details.
  await page.getByRole('button', { name: 'Account menu' }).first().click();
  const menu = page.getByRole('dialog', { name: 'Account' });
  await expect(menu).toContainText('Wanjiru Kamau');
  await expect(menu).not.toContainText('Alex Vance');
  await expect(menu).not.toContainText('My programme');

  // After a reload the stored profile is the fixed one.
  await page.waitForTimeout(1500);
  await page.reload();
  await ready(page);
  await expect.poll(async () => (await state(page)).user.name, { timeout: 20_000 }).toBe('Wanjiru Kamau');
});
