import { expect, test, type BrowserContext, type Page } from '@playwright/test';

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

const RUN = Date.now().toString(36);

async function signIn(page: Page, email: string): Promise<void> {
  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  // Listen for the close now: the pop-up can close as soon as the account is clicked, and a listener
  // added after that never fires (the test then hung until its 60 s timeout).
  const popupClosed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await popup.waitForLoadState('domcontentloaded');
  const existing = popup.getByText(email, { exact: false });
  if (await existing.count()) {
    await existing.first().click();
  } else {
    await popup.locator('button.mdc-button--outlined').first().click();
    await popup.locator('#autogen-button').click();
    await popup.locator('#email-input').fill(email);
    await popup.locator('#sign-in').click();
  }
  await popupClosed;
  await page.waitForFunction(() => (window as unknown as Partial<W>).__store?.getState().isAnonymous === false, undefined, { timeout: 30000 });
}

const ready = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);

// The app reloads itself after some sign-ins; read through that.
async function prefs(page: Page) {
  for (let i = 0; ; i++) {
    try {
      return await page.evaluate(() => {
        const s = (window as unknown as W).__store.getState();
        return { t: s.timerSettings, a: s.soundscape, b: s.breakSoundscape, v: s.soundscapeVolume };
      });
    } catch (err) {
      if (i > 5) throw err;
      await page.waitForTimeout(500);
    }
  }
}

const DEFAULTS = {
  t: { focusDuration: 25 * 60, shortBreakDuration: 5 * 60, longBreakDuration: 15 * 60, autoStartBreaks: false, autoStartFocus: false },
  a: 'off',
  b: 'off',
  v: 0.35
};
const CHOSEN = {
  t: { focusDuration: 50 * 60, shortBreakDuration: 10 * 60, longBreakDuration: 20 * 60, autoStartBreaks: true, autoStartFocus: false },
  a: 'rain',
  b: 'chimes',
  v: 0.6
};

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).first().click();
  await page.getByRole('dialog', { name: 'Account' }).getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForFunction(() => {
    const s = (window as unknown as Partial<W>).__store?.getState();
    return !!s && !!s.userId && s.isAnonymous === true;
  });
}

async function onAccountValue(page: Page, expected: typeof CHOSEN): Promise<void> {
  await expect.poll(async () => JSON.stringify(await prefs(page)), { timeout: 20000 }).toBe(JSON.stringify(expected));
}

test('timer choices follow the account, not the device', async ({ browser, page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/timer');
  await ready(page);

  const emailA = `timer-a-${RUN}@example.com`;
  await signIn(page, emailA);
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.updateTimerSettings({ focusDuration: 50 * 60, shortBreakDuration: 10 * 60, longBreakDuration: 20 * 60, autoStartBreaks: true });
    s.setSoundscape('rain', 'focus');
    s.setSoundscape('chimes', 'break');
    s.setSoundscapeVolume(0.6);
  });
  expect(await prefs(page)).toEqual(CHOSEN);
  // let the debounced volume save and the others reach the account
  await page.waitForTimeout(2500);

  // A signs out: the next person on this device (a guest) starts from the defaults.
  await signOut(page);
  expect(await prefs(page)).toEqual(DEFAULTS);
  await page.goto('/timer');
  await ready(page);
  await expect(page.getByRole('timer')).toHaveText('25:00');
  await expect(page.getByRole('button', { name: /Focus \(25m\)/ })).toBeVisible();

  // B signs in on the same device: still the defaults, never A's.
  await signIn(page, `timer-b-${RUN}@example.com`);
  await page.waitForTimeout(1500);
  expect(await prefs(page)).toEqual(DEFAULTS);

  // A signs in again on a fresh browser: the account's choices arrive.
  const ctx: BrowserContext = await browser.newContext();
  const fresh = await ctx.newPage();
  await fresh.goto('/timer');
  await ready(fresh);
  expect(await prefs(fresh)).toEqual(DEFAULTS);
  await signIn(fresh, emailA);
  await onAccountValue(fresh, CHOSEN);
  await expect(fresh.getByRole('timer')).toHaveText('50:00');
  await ctx.close();
});

test('an old per-device entry moves to the account that owned this device', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await signIn(page, `timer-legacy-${RUN}@example.com`);
  await page.waitForTimeout(1500);
  await page.evaluate(() =>
    localStorage.setItem('studyflow_device_prefs', JSON.stringify({ timerSettings: { focusDuration: 2400, shortBreakDuration: 420, longBreakDuration: 1200, autoStartBreaks: false, autoStartFocus: false }, soundscape: 'waves' }))
  );
  await page.reload();
  await ready(page);
  await expect.poll(async () => (await prefs(page)).t.focusDuration, { timeout: 20000 }).toBe(2400);
  expect((await prefs(page)).a).toBe('waves');
  // used once: the old entry is gone
  expect(await page.evaluate(() => localStorage.getItem('studyflow_device_prefs'))).toBeNull();
});

test('a damaged saved entry cannot break the timer', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('studyflow_storage_v1') ?? '{}');
    raw.state = { ...(raw.state ?? {}), timerSettings: { focusDuration: 'soon' }, soundscape: 'thunder' };
    localStorage.setItem('studyflow_storage_v1', JSON.stringify(raw));
  });
  await page.reload();
  await ready(page);
  const p = await prefs(page);
  expect(p.t.focusDuration).toBe(25 * 60);
  expect(p.a).toBe('off');
  await expect(page.getByText('25:00').first()).toBeVisible();
});
