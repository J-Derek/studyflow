import { expect, test, type Page } from '@playwright/test';

type Store = {
  getState: () => {
    userId: string | null;
    isAnonymous: boolean;
    userEmail: string | null;
    timer: { status: string; mode: string; durationSec: number; startedAtMs: number | null; elapsedBeforeMs: number };
    pomodorosCompleted: number;
    startTimer: () => void;
    pauseTimer: () => void;
    setTimerMode: (m: string) => void;
    updateTimerSettings: (s: Record<string, number>) => void;
  };
};
type W = { __store: Store; __auth: { signInOrLinkWithGoogle: () => Promise<unknown> } };

async function boot(page: Page, path = '/timer'): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => {
    const w = window as unknown as Partial<W>;
    return !!w.__store && !!w.__store.getState().userId && !!w.__auth;
  });
}

async function googleSignIn(page: Page, email: string): Promise<void> {
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
  await page.waitForFunction(() => {
    const s = (window as unknown as W).__store.getState();
    return !s.isAnonymous && !!s.userEmail;
  });
}

const uidOf = (page: Page) => page.evaluate(() => (window as unknown as W).__store.getState().userId as string);

async function readDoc(path: string): Promise<Record<string, { stringValue?: string; integerValue?: string }> | null> {
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/studyflow-e2e/databases/(default)/documents/${path}`, {
    headers: { Authorization: 'Bearer owner' }
  });
  if (res.status === 404) return null;
  return ((await res.json()) as { fields?: Record<string, { stringValue?: string; integerValue?: string }> }).fields ?? null;
}

async function waitForDoc(path: string, pred: (f: NonNullable<Awaited<ReturnType<typeof readDoc>>>) => boolean) {
  await expect
    .poll(async () => {
      const f = await readDoc(path);
      return f ? pred(f) : false;
    }, { timeout: 15_000 })
    .toBe(true);
}

test.describe('focus timer', () => {
  test('keeps real time across a refresh and does not drift while paused', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => (window as unknown as W).__store.getState().startTimer());
    await page.waitForTimeout(2500);
    await page.reload();
    await boot(page);
    const afterReload = await page.evaluate(() => {
      const t = (window as unknown as W).__store.getState().timer;
      return { status: t.status, startedAtMs: t.startedAtMs, now: Date.now() };
    });
    expect(afterReload.status).toBe('running');
    expect(afterReload.now - (afterReload.startedAtMs as number)).toBeGreaterThanOrEqual(2500); // time kept running while reloading

    await page.evaluate(() => (window as unknown as W).__store.getState().pauseTimer());
    const paused1 = await page.evaluate(() => (window as unknown as W).__store.getState().timer.elapsedBeforeMs);
    await page.waitForTimeout(1500);
    const paused2 = await page.evaluate(() => (window as unknown as W).__store.getState().timer.elapsedBeforeMs);
    expect(paused2).toBe(paused1); // paused: nothing moves
    expect(paused1).toBeGreaterThanOrEqual(2500);
  });

  test('a finished focus block is counted once and recorded in the cloud', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await boot(page);
    // A fresh account each run: a reused local emulator already has a fixed one, which takes the merge-and-reload path.
    await googleSignIn(page, `timer-owner-${Date.now().toString(36)}@example.com`);
    const uid = await uidOf(page);

    await page.evaluate(() => {
      const s = (window as unknown as W).__store.getState();
      s.updateTimerSettings({ focusDuration: 3 });
      s.setTimerMode('focus');
    });
    await waitForDoc(`users/${uid}/liveState/timer`, (f) => f.status?.stringValue === 'idle');
    await page.evaluate(() => (window as unknown as W).__store.getState().startTimer());
    await waitForDoc(`users/${uid}/liveState/timer`, (f) => f.status?.stringValue === 'running');

    // the block finishes without anyone touching the page
    await expect
      .poll(() => page.evaluate(() => (window as unknown as W).__store.getState().pomodorosCompleted), { timeout: 15_000 })
      .toBe(1);
    await waitForDoc(`users/${uid}/liveState/timer`, (f) => f.status?.stringValue === 'idle');

    const timerDoc = await readDoc(`users/${uid}/liveState/timer`);
    const rev = Number(timerDoc?.rev?.integerValue);
    const session = await readDoc(`users/${uid}/focusSessions/run-${rev - 1}`);
    expect(session?.mode?.stringValue).toBe('focus');
    expect(Number(session?.durationSeconds?.integerValue)).toBe(3);

    await page.waitForTimeout(2500);
    expect(await page.evaluate(() => (window as unknown as W).__store.getState().pomodorosCompleted)).toBe(1);
    await context.close();
  });

  test('a second tab follows a timer started in the first', async ({ browser }) => {
    const context = await browser.newContext();
    const tab1 = await context.newPage();
    await boot(tab1);
    await googleSignIn(tab1, 'timer-two-tabs@example.com');
    const uid = await uidOf(tab1);
    await waitForDoc(`users/${uid}`, () => true).catch(() => undefined);

    const tab2 = await context.newPage();
    await boot(tab2);
    await tab1.evaluate(() => (window as unknown as W).__store.getState().startTimer());
    await waitForDoc(`users/${uid}/liveState/timer`, (f) => f.status?.stringValue === 'running');
    await expect
      .poll(() => tab2.evaluate(() => (window as unknown as W).__store.getState().timer.status), { timeout: 15_000 })
      .toBe('running');

    await tab1.evaluate(() => (window as unknown as W).__store.getState().pauseTimer());
    await expect
      .poll(() => tab2.evaluate(() => (window as unknown as W).__store.getState().timer.status), { timeout: 15_000 })
      .toBe('paused');
    await context.close();
  });
});
