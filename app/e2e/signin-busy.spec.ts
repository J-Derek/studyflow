import { expect, test, type Page } from '@playwright/test';
import { continueThroughAgeGate } from './ageHelper';

/** After Google answers, the sign-in button stays busy ("Signing in…") until the page changes; it used to flip back to "Sign in with Google" for seconds. */
type Auth = { signInOrLinkWithGoogle: () => Promise<unknown>; signOutUser: () => Promise<void> };
type Store = { userId: string | null; isAnonymous: boolean; userEmail: string | null };
type W = { __auth: Auth; __store?: { getState: () => Store } };

async function guestReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const s = (window as unknown as W).__store?.getState();
    return !!s?.userId && s.isAnonymous;
  });
}

async function chooseAccount(page: Page, email: string): Promise<void> {
  const popupPromise = page.waitForEvent('popup');
  return popupPromise.then(async (popup) => {
    const closed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
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
    await closed;
  });
}

test('signing in to an existing account never shows "Sign in with Google" again once it has started', async ({ browser }) => {
  const email = `busy-${Date.now().toString(36)}@example.com`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await guestReady(page);

  // Make the account first (link), then sign out into a fresh guest session.
  const firstPopup = chooseAccount(page, email);
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  await firstPopup;
  await page.waitForFunction(() => (window as unknown as W).__store?.getState().isAnonymous === false);
  await page.waitForTimeout(1500);
  void page.evaluate(() => (window as unknown as W).__auth.signOutUser()).catch(() => undefined);
  await page.waitForFunction(() => {
    const s = (window as unknown as W).__store?.getState();
    return !!s?.userId && s.isAnonymous;
  });

  // Now press the real button; record its label every 40 ms, across the reload that finishes the sign-in.
  const labels: string[] = [];
  await page.exposeFunction('reportLabel', (t: string) => labels.push(t));
  const watch = () => {
    let last = '';
    setInterval(() => {
      // Only the app's own page: the init script also runs in Google's sign-in pop-up, which has "Sign in" buttons of its own.
      if (location.pathname.includes('/emulator/') || location.pathname.startsWith('/__/auth')) return;
      // The sign-in button in the top bar. Once the account has loaded it is replaced by the account menu.
      const b = Array.from(document.querySelectorAll('header button')).find((x) => /Sign(ing)? in/.test(x.textContent ?? '')) ?? null;
      // the top-bar button holds a short and a long label (one shows per screen size), so read what it says, not the raw text
      const raw = b ? (b.textContent ?? '') : '';
      const t = !b ? '(gone)' : /Signing in/.test(raw) ? 'Signing in…' : 'Sign in with Google';
      if (t !== last) {
        last = t;
        (window as unknown as { reportLabel?: (t: string) => void }).reportLabel?.(t);
      }
    }, 40);
  };
  await page.addInitScript(watch);
  await page.evaluate(watch);
  await expect(page.locator('header').getByRole('button', { name: 'Sign in with Google' })).toBeVisible();

  const secondPopup = chooseAccount(page, email);
  await page.locator('header').getByRole('button', { name: 'Sign in with Google' }).click();
  await continueThroughAgeGate(page);
  await secondPopup;
  await page.waitForFunction((e) => (window as unknown as W).__store?.getState().userEmail === e, email, { timeout: 30_000 });
  await page.waitForTimeout(1000);

  const firstBusy = labels.findIndex((l) => l === 'Signing in…');
  expect(firstBusy, `labels seen: ${JSON.stringify(labels)}`).toBeGreaterThanOrEqual(0);
  expect(labels.slice(firstBusy + 1), `labels seen: ${JSON.stringify(labels)}`).not.toContain('Sign in with Google');
  await ctx.close();
});
