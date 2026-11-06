import { expect, test, type Page } from '@playwright/test';

type Settings = { focusDuration: number; shortBreakDuration: number; longBreakDuration: number; autoStartBreaks: boolean; autoStartFocus: boolean };
type S = {
  userId: string | null;
  isAnonymous: boolean;
  timerSettings: Settings;
  soundscape: string;
  breakSoundscape: string;
  soundscapeVolume: number;
  updateTimerSettings: (s: Partial<Settings>) => void;
  setSoundscape: (t: string, mode?: 'focus' | 'break') => void;
  setSoundscapeVolume: (v: number) => void;
};
type W = { __store: { getState: () => S }; __auth: { signInOrLinkWithGoogle: () => Promise<unknown> } };

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

const ready = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
const prefs = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    return { t: s.timerSettings, a: s.soundscape, b: s.breakSoundscape, v: s.soundscapeVolume };
  });

const CHOSEN = {
  t: { focusDuration: 30 * 60, shortBreakDuration: 7 * 60, longBreakDuration: 20 * 60, autoStartBreaks: true, autoStartFocus: false },
  a: 'rain',
  b: 'chimes',
  v: 0.6
};

test('timer lengths and sound choices survive signing out and back in', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/timer');
  await ready(page);

  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.updateTimerSettings({ focusDuration: 30 * 60, shortBreakDuration: 7 * 60, longBreakDuration: 20 * 60, autoStartBreaks: true });
    s.setSoundscape('rain', 'focus');
    s.setSoundscape('chimes', 'break');
    s.setSoundscapeVolume(0.6);
  });
  expect(await prefs(page)).toEqual(CHOSEN);

  await signIn(page, `prefs-${Date.now().toString(36)}@example.com`);
  expect(await prefs(page)).toEqual(CHOSEN);

  // sign out from the account menu: the app reloads into a fresh guest session
  await page.getByRole('button', { name: 'Account menu' }).first().click();
  await page.getByRole('dialog', { name: 'Account' }).getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForFunction(() => {
    const s = (window as unknown as Partial<W>).__store?.getState();
    return !!s && !!s.userId && s.isAnonymous === true;
  });

  // the choices are still there, and the idle timer shows the chosen focus length
  expect(await prefs(page)).toEqual(CHOSEN);
  await page.goto('/timer');
  await ready(page);
  await expect(page.getByText('30:00').first()).toBeVisible();

  // and signing in as someone else on this device keeps them too
  await signIn(page, `prefs2-${Date.now().toString(36)}@example.com`);
  expect(await prefs(page)).toEqual(CHOSEN);
});

test('a damaged saved entry cannot break the timer', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await page.evaluate(() => localStorage.setItem('studyflow_device_prefs', '{"timerSettings":{"focusDuration":"soon"},"soundscape":"thunder"}'));
  await page.reload();
  await ready(page);
  const p = await prefs(page);
  expect(p.t.focusDuration).toBe(25 * 60); // back to the default
  expect(p.a).toBe('off');
  await expect(page.getByText('25:00').first()).toBeVisible();
});
