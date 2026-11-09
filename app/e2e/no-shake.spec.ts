import { expect, test, type Page } from '@playwright/test';

type W = {
  __store: { getState: () => { userId: string | null; isAnonymous: boolean } };
  __auth: { signInOrLinkWithGoogle: () => Promise<unknown> };
};

const ready = (page: Page) =>
  page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);

async function signIn(page: Page, email: string) {
  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  // Listen for the close now: the pop-up can close as soon as the account is clicked, and a listener
  // added after that never fires (the test then hung until its 60 s timeout).
  const popupClosed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('button.mdc-button--outlined').first().click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#sign-in').click();
  await popupClosed;
  await page.waitForFunction(() => (window as unknown as Partial<W>).__store?.getState().isAnonymous === false);
}

// Records, in storage that survives reloads, whether the page was already dark the moment its body first
// existed (that is, what the very first paint shows), and the layout shifts that happen afterwards.
const RECORD = () => {
  const dark = () => document.documentElement.classList.contains('dark');
  const sessionKey = 'nr_first_paint_dark';
  const watch = new MutationObserver(() => {
    if (document.body) {
      sessionStorage.setItem(sessionKey, String(dark()));
      watch.disconnect();
    }
  });
  watch.observe(document, { childList: true, subtree: true });
  (window as unknown as { __shifts: number[] }).__shifts = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
      if (!e.hadRecentInput) (window as unknown as { __shifts: number[] }).__shifts.push(e.value);
    }
  }).observe({ type: 'layout-shift', buffered: true });
};

const firstPaintDark = (page: Page) => page.evaluate(() => sessionStorage.getItem('nr_first_paint_dark'));

test.describe('the first paint is already in the right theme (no light flash on reload or sign-out)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(RECORD);
  });

  test('a saved "dark" choice is dark from the very first paint, even after sign-out wiped the saved data', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    // exactly the state right after signing out: the saved data is gone, only the device's theme choice remains
    await page.evaluate(() => {
      localStorage.removeItem('studyflow_storage_v1');
      localStorage.setItem('studyflow_theme', 'dark');
    });
    await page.reload();
    await ready(page);
    expect(await firstPaintDark(page)).toBe('true');
  });

  test('"match my device" follows the device from the first paint', async ({ browser }) => {
    for (const [scheme, expected] of [['dark', 'true'], ['light', 'false']] as const) {
      const context = await browser.newContext({ colorScheme: scheme });
      const page = await context.newPage();
      await page.addInitScript(RECORD);
      await page.goto('/');
      await ready(page);
      await page.evaluate(() => localStorage.setItem('studyflow_theme', 'system'));
      await page.reload();
      await ready(page);
      expect(await firstPaintDark(page), `device is ${scheme}`).toBe(expected);
      await context.close();
    }
  });

  test('with no choice saved the app starts light, even on a dark device, so nothing flips afterwards', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.addInitScript(RECORD);
    await page.goto('/');
    await ready(page);
    await page.evaluate(() => {
      localStorage.removeItem('studyflow_theme');
      localStorage.removeItem('studyflow_storage_v1');
    });
    await page.reload();
    await ready(page);
    expect(await firstPaintDark(page)).toBe('false');
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false); // and it stays light
    await context.close();
  });

  test('an older save that kept "dark" only inside the saved data is still dark from the first paint', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await page.evaluate(() => {
      localStorage.removeItem('studyflow_theme');
      localStorage.setItem('studyflow_storage_v1', JSON.stringify({ state: { theme: 'dark' }, version: 0 }));
    });
    await page.reload();
    await ready(page);
    expect(await firstPaintDark(page)).toBe('true');
  });
});

test('signing in folds the "already use StudyFlow elsewhere" banner away smoothly instead of snapping the page up', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(RECORD);
  await page.goto('/');
  await ready(page);

  const banner = page.getByTestId('signin-banner');
  await expect(banner).toBeVisible();
  const fullHeight = (await banner.boundingBox())!.height;
  expect(fullHeight).toBeGreaterThan(50);
  await page.evaluate(() => ((window as unknown as { __shifts: number[] }).__shifts = []));

  await signIn(page, `noshake-${Date.now().toString(36)}@example.com`);

  // the banner ends up folded away and out of reach (not clickable, not read out)
  await expect.poll(async () => (await banner.boundingBox())?.height ?? 0, { timeout: 5000 }).toBeLessThan(2);
  await expect(banner).toHaveAttribute('aria-hidden', 'true');
  await expect(banner).toHaveAttribute('inert', '');

  // it was a slide: no single frame moved the page by more than a small step (the old snap was one shift of about 0.10)
  const shifts = await page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts);
  expect(Math.max(0, ...shifts), `largest single layout shift ${JSON.stringify(shifts.map((v) => +v.toFixed(3)))}`).toBeLessThan(0.03);
});
