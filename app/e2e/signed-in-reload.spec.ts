import { expect, test, type Page } from '@playwright/test';

/**
 * PR3: a signed-in student who reloads must not see the guest header (Sign in button) flash while
 * Firebase works out who is signed in. An observer added before the page's own scripts records every
 * moment the sign-in button or the account picture is on screen, and whether auth had answered yet.
 */
type W = {
  __store: { getState: () => { userId: string | null; isAnonymous: boolean } };
  __auth: { signInOrLinkWithGoogle: () => Promise<unknown>; signOutUser: () => Promise<unknown> };
  __seen: { signInBeforeAuth: boolean; menuBeforeAuth: boolean; signIn: boolean };
};

async function signIn(page: Page, email = `reload-${Date.now().toString(36)}@example.com`, existing = false): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  const popupClosed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await popup.waitForLoadState('domcontentloaded');
  if (existing) {
    await popup.getByText(email, { exact: false }).first().click();
  } else {
    await popup.locator('button.mdc-button--outlined').first().click();
    await popup.locator('#autogen-button').click();
    await popup.locator('#email-input').fill(email);
    await popup.locator('#sign-in').click();
  }
  await popupClosed;
  if (!existing) await page.waitForFunction(() => (window as unknown as W).__store.getState().isAnonymous === false);
}

/** Watches the page from its very first paint. */
async function watchHeader(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen = { signInBeforeAuth: false, menuBeforeAuth: false, signIn: false };
    (window as unknown as { __seen: typeof seen }).__seen = seen;
    const check = () => {
      const store = (window as unknown as Partial<W>).__store;
      const authAnswered = !!store?.getState().userId;
      // Only what is actually on screen counts: the Today banner keeps its button folded away and inert.
      const visible = (sel: string) =>
        Array.from(document.querySelectorAll(sel)).some((el) => !el.closest('[inert]') && el.getClientRects().length > 0);
      const signIn = visible('[aria-label="Sign in with Google"]');
      const menu = visible('[aria-label="Account menu"]');
      if (signIn) seen.signIn = true;
      if (!authAnswered && signIn) seen.signInBeforeAuth = true;
      if (!authAnswered && menu) seen.menuBeforeAuth = true;
    };
    new MutationObserver(check).observe(document, { childList: true, subtree: true, attributes: true });
  });
}

test('a signed-in student sees their account, not the Sign in button, straight after a reload', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await signIn(page);
  // the saved copy (with the hint) must be on disk before the reload
  await page.waitForFunction(() => (localStorage.getItem('studyflow_storage_v1') ?? '').includes('signedInHint'));

  await watchHeader(page);
  await page.reload();
  await page.waitForFunction(() => {
    const s = (window as unknown as Partial<W>).__store?.getState();
    return !!s?.userId && s.isAnonymous === false;
  });
  await expect(page.getByRole('button', { name: 'Account menu' }).first()).toBeVisible();
  const seen = await page.evaluate(() => (window as unknown as W).__seen);
  expect(seen.signInBeforeAuth, 'the guest Sign in button flashed before auth answered').toBe(false);
  expect(seen.signIn, 'the Sign in button showed at some point').toBe(false);
  expect(seen.menuBeforeAuth, 'the account picture should already show before auth answers').toBe(true);

  // After signing out, the hint is gone: the next reload is a plain guest.
  const reloaded = page.waitForEvent('load');
  await page.evaluate(() => (window as unknown as W).__auth.signOutUser());
  await reloaded;
  await page.waitForFunction(() => {
    const s = (window as unknown as Partial<W>).__store?.getState();
    return !!s?.userId && s.isAnonymous === true;
  });
  expect(await page.evaluate(() => localStorage.getItem('studyflow_storage_v1') ?? '')).not.toContain('reload-');
  await expect(page.getByRole('button', { name: 'Sign in with Google' }).first()).toBeVisible();
  const afterSignOut = await page.evaluate(() => (window as unknown as W).__seen);
  expect(afterSignOut.menuBeforeAuth, 'a signed-out device must not show the old account').toBe(false);
  await context.close();
});

test('a guest never sees an account picture, even before auth answers', async ({ page }) => {
  await watchHeader(page);
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect(page.getByRole('button', { name: 'Sign in with Google' }).first()).toBeVisible();
  expect((await page.evaluate(() => (window as unknown as W).__seen)).menuBeforeAuth).toBe(false);
});

test('signing in to an existing account says "Signing you in…" until the plan has loaded', async ({ browser }) => {
  const email = `progress-${Date.now().toString(36)}@example.com`;
  // The account exists, with one record of its own.
  const first = await browser.newContext();
  const p1 = await first.newPage();
  await signIn(p1, email);
  await p1.evaluate(() =>
    (window as unknown as { __store: { getState: () => { addAssignment: (a: unknown) => void } } }).__store
      .getState()
      .addAssignment({ title: 'PROGRESS-ACCOUNT-1', course: 'TEST 101', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 })
  );
  await p1.waitForFunction(() => !(window as unknown as { __store: { getState: () => { isSyncing: boolean } } }).__store.getState().isSyncing);
  await first.close();

  // A guest on another device signs in to it: records move, the device is cleared, the page reloads.
  const second = await browser.newContext();
  const p2 = await second.newPage();
  await p2.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __progress: string[] }).__progress = seen;
    new MutationObserver(() => {
      const t = document.querySelector('[data-testid="sign-in-progress"]')?.textContent;
      if (t && seen[seen.length - 1] !== t) seen.push(t);
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  await signIn(p2, email, true);
  await expect(p2.getByText('PROGRESS-ACCOUNT-1').first()).toBeVisible({ timeout: 20_000 });
  // The note is gone once the plan is on screen, and the page after the reload said it was loading.
  await expect(p2.getByTestId('sign-in-progress')).toHaveCount(0, { timeout: 10_000 });
  const afterReload = await p2.evaluate(() => (window as unknown as { __progress: string[] }).__progress);
  expect(afterReload.some((t) => t.includes('loading your plan'))).toBe(true);
  await second.close();
});
