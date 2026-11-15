import { expect, test, type Page } from '@playwright/test';

/**
 * Safari (WebKit) smoke run: Today, adding a deadline, the timetable, the focus timer and Google sign-in through the emulator.
 * Not a copy of the whole suite: the paths where Safari has surprised web apps (storage, timers, pop-ups).
 */
type Store = {
  userId: string | null;
  isAnonymous: boolean;
  userEmail: string | null;
  assignments: { id: string; title: string }[];
  addSession: (s: object) => void;
  addAssignment: (a: object) => void;
};
type W = { __store: { getState: () => Store }; __auth: { signInOrLinkWithGoogle: () => Promise<unknown> } };

const pageErrors = new WeakMap<Page, string[]>();

/**
 * When the page reloads, WebKit cancels Firestore's long-poll requests that are still open to the LOCAL emulator and reports each as
 * "... due to access control checks". That is reload noise from the emulator host, not an app error, so only that exact message is
 * ignored. Every other uncaught error still fails the test.
 */
const isEmulatorReloadNoise = (message: string) => message.includes('127.0.0.1:8080/google.firestore.v1.Firestore/') && message.includes('due to access control checks');

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (e) => {
    if (!isEmulatorReloadNoise(e.message)) errors.push(e.message);
  });
});

async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
}

const titles = (page: Page) => page.evaluate(() => (window as unknown as W).__store.getState().assignments.map((a) => a.title));

test('Today opens, with no script errors', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await expect(page.getByLabel('What is due?')).toBeVisible();
  expect(pageErrors.get(page)).toEqual([]);
});

test('a deadline added on Today is kept after a reload', async ({ page }) => {
  await open(page, '/');
  await page.getByLabel('What is due?').fill('Safari essay');
  await page.getByRole('button', { name: /Save deadline/ }).click();
  await expect.poll(() => titles(page)).toContain('Safari essay');
  await page.waitForTimeout(1500); // let the save reach the emulator
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect.poll(() => titles(page), { timeout: 15_000 }).toContain('Safari essay');
  expect(pageErrors.get(page)).toEqual([]);
});

test('the timetable shows a class, switches to the month view and steps a month', async ({ page }) => {
  await open(page, '/calendar');
  await page.evaluate(() => (window as unknown as W).__store.getState().addSession({ title: 'Safari lecture', course: 'CS 301', dayOfWeek: new Date().getDay(), startTime: '10:00', endTime: '11:00', type: 'lecture' }));
  await expect(page.getByText('Safari lecture').first()).toBeVisible();
  await page.getByRole('button', { name: 'month', exact: true }).click();
  await expect(page.getByTestId('month-grid')).toBeVisible();
  const label = await page.getByTestId('month-label').innerText();
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByTestId('month-label')).not.toHaveText(label);
  expect(pageErrors.get(page)).toEqual([]);
});

test('the focus timer starts and counts down', async ({ page }) => {
  await open(page, '/timer');
  const clock = page.getByRole('timer');
  const before = await clock.innerText();
  await page.getByRole('button', { name: /^Start$/ }).click();
  await expect(page.getByRole('button', { name: /^Pause/ })).toBeVisible();
  await expect.poll(() => clock.innerText(), { timeout: 8000 }).not.toBe(before);
  await page.getByRole('button', { name: /^Pause/ }).click();
  expect(pageErrors.get(page)).toEqual([]);
});

test('Google sign-in through the emulator pop-up works, and the account is kept after a reload', async ({ page }) => {
  const email = `safari-${Date.now().toString(36)}@example.com`;
  await open(page, '/');
  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  const closed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('button.mdc-button--outlined').first().click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#sign-in').click();
  await closed;
  await page.waitForFunction((e) => {
    const s = (window as unknown as W).__store.getState();
    return !s.isAnonymous && s.userEmail === e;
  }, email, { timeout: 30_000 });
  await page.waitForTimeout(1000);
  await page.reload();
  await page.waitForFunction((e) => {
    const s = (window as unknown as Partial<W>).__store?.getState();
    return !!s && !s.isAnonymous && s.userEmail === e;
  }, email, { timeout: 30_000 });
  expect(pageErrors.get(page)).toEqual([]);
});
