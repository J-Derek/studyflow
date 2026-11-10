import { expect, test, type Page } from '@playwright/test';

/** UX round, part D: short calm motion (150 to 200 ms, off with "reduce motion"), and the busiest pages fetched after first paint. */
type S = { userId: string | null; addAssignment: (a: object) => void };
type W = { __store: { getState: () => S } };

const ready = async (page: Page, path = '/') => {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};
const seed = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__store.getState().addAssignment({ title: 'Lab report', course: 'PHY 101', dueDate: '2030-01-01', priority: 'medium', status: 'pending', progress: 0 }));

test('the Undo bar after a delete eases in within 200 ms', async ({ page }) => {
  await ready(page, '/assignments');
  await seed(page);
  await page.getByRole('button', { name: /Delete/ }).first().click();
  const bar = page.getByRole('status').filter({ hasText: 'Deleted' });
  await expect(bar).toBeVisible();
  const style = await bar.evaluate((el) => { const c = getComputedStyle(el); return { name: c.animationName, ms: parseFloat(c.animationDuration) * 1000 }; });
  expect(style.name).toBe('sf-enter');
  expect(style.ms).toBeGreaterThanOrEqual(150);
  expect(style.ms).toBeLessThanOrEqual(200);
});

test('with "reduce motion" switched on, the same bar does not animate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page, '/assignments');
  await seed(page);
  await page.getByRole('button', { name: /Delete/ }).first().click();
  const bar = page.getByRole('status').filter({ hasText: 'Deleted' });
  await expect(bar).toBeVisible();
  expect(await bar.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('the Timer and Assignments pages are fetched after the first paint, before they are opened', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => { if (/\/(FocusTimer|Assignments)[-.\w]*\.js|src\/pages\/(FocusTimer|Assignments)/.test(r.url())) requested.push(r.url()); });
  await ready(page, '/');
  await expect.poll(() => requested.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  await page.getByRole('link', { name: /Timer/ }).first().click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
});
