import { expect, test, type Browser, type Page } from '@playwright/test';

/** A real Android phone has browser bars top and bottom, so the usable screen is about 360x640. Mobile user agent and touch. */
type W = { __store: { getState: () => Record<string, (...a: unknown[]) => unknown> & { userId: string | null } } };
const ready = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

async function phone(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, userAgent: UA });
  return { context, page: await context.newPage() };
}

const scrollContainers = (page: Page, rootSelector: string) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return -1;
    let n = 0;
    for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) n += 1;
    }
    return n;
  }, rootSelector);

const longBody = Array.from({ length: 80 }, (_, i) => `Line ${i + 1} of the contract notes, long enough to need scrolling on a phone.`).join('\n');

test('notes at 360x640: actions are reachable without scrolling, Edit stays full screen with one scroll area and Save in view', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await page.goto('/notes');
  await ready(page);
  await page.evaluate((b) => (window as unknown as W).__store.getState().addNote({ title: 'Contracts', body: b, course: 'LAW 101', pinned: false }), longBody);
  await page.getByRole('button', { name: /Contracts/ }).first().click();

  // the note pop-up shows a very long note, and its actions are still on screen without scrolling to the end
  const actions = page.getByTestId('note-actions');
  await expect(actions).toBeVisible();
  const ab = await actions.boundingBox();
  expect(ab!.y + ab!.height).toBeLessThanOrEqual(640);
  await expect(page.getByRole('button', { name: 'Read full screen' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Delete' })).toBeInViewport();

  await page.getByRole('button', { name: 'Read full screen' }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const sheet = page.locator('[data-fullscreen="true"]');
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(359);
  expect(box!.height).toBeGreaterThanOrEqual(639);
  expect(await scrollContainers(page, '[data-fullscreen="true"]')).toBe(1);
  const save = page.getByRole('button', { name: 'Save note' });
  await expect(save).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeInViewport();
  await expect(page.getByRole('toolbar', { name: 'Formatting' })).toBeInViewport();

  await page.keyboard.type(' ADDED');
  await save.click();
  await expect(page.getByRole('button', { name: 'Close reader' })).toBeVisible();
  await context.close();
});

test('a new note at 360x640 is a full-screen sheet with Cancel and Save in the top bar and a collapsible course', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await page.goto('/notes');
  await ready(page);
  await page.getByRole('button', { name: 'New note' }).first().click();
  const sheet = page.locator('[data-fullscreen="true"]');
  await expect(sheet).toBeVisible();
  const save = page.getByRole('button', { name: 'Save note' });
  expect((await save.boundingBox())!.y).toBeLessThan(80); // top bar, not the bottom
  await expect(page.getByLabel('Course (optional)')).toBeHidden(); // folded away until opened
  await page.getByText('Course and pin').click();
  await expect(page.getByLabel('Course (optional)')).toBeVisible();
  expect(await scrollContainers(page, '[data-fullscreen="true"]')).toBeLessThanOrEqual(1);
  await context.close();
});

test('timer at 360x640: Start is above the bottom nav and the length dialog fits', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await page.goto('/timer');
  await ready(page);
  const navTop = (await page.getByRole('navigation', { name: 'Mobile Navigation' }).boundingBox())!.y;
  const start = await page.getByRole('button', { name: 'Start', exact: true }).boundingBox();
  expect(start!.y + start!.height).toBeLessThanOrEqual(navTop);
  await page.getByTestId('change-length').click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  const d = await dlg.boundingBox();
  expect(d!.y).toBeGreaterThanOrEqual(0);
  expect(d!.y + d!.height).toBeLessThanOrEqual(640);
  await expect(dlg.getByRole('button', { name: 'Save' })).toBeInViewport();
  await context.close();
});

test('timetable at 360x640: the day strip is in view and Add block sits above the bottom nav', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await page.goto('/calendar');
  await ready(page);
  await page.evaluate(() => (window as unknown as W).__store.getState().addSession({ title: 'Class', course: 'X 1', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', type: 'lecture' }));
  const navTop = (await page.getByRole('navigation', { name: 'Mobile Navigation' }).boundingBox())!.y;
  const add = await page.getByRole('button', { name: 'Add block' }).first().boundingBox();
  expect(add!.y + add!.height).toBeLessThanOrEqual(navTop);
  await expect(page.getByTestId('day-strip')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});
