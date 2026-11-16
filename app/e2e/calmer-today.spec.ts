import { expect, test, type Page } from '@playwright/test';

/** First-use clarity: say what StudyFlow is, show one thing to do, and keep the banners and the checklist quiet. */
type S = { userId: string | null; addAssignment: (a: object) => void };
type W = { __store: { getState: () => S } };

const ready = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

test('the first screen says in one line what StudyFlow is for, above the one thing to do', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await ready(page);
  const intro = page.getByTestId('what-is-studyflow');
  await expect(intro).toHaveText('StudyFlow keeps your deadlines, weekly timetable, focus timer and grades in one place.');
  const heading = page.getByRole('heading', { name: 'What is your next deadline?' });
  expect((await intro.boundingBox())!.y).toBeLessThan((await heading.boundingBox())!.y);
});

test('after the first save there is one message at a time, and the checklist is folded', async ({ page }) => {
  await ready(page);
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addAssignment({ title: 'CAT 1', course: 'General', dueDate: '2030-01-15', priority: 'high', status: 'pending', progress: 0 })
  );
  // the green "Saved" line shows; the guest-account warning waits until it has gone
  await expect(page.getByRole('status').filter({ hasText: 'Saved “CAT 1”' })).toBeVisible();
  await expect(page.getByRole('note')).toHaveCount(0);

  // the checklist is one quiet line until asked for
  const toggle = page.getByRole('button', { name: 'Show steps' });
  await expect(toggle).toBeVisible();
  await expect(page.getByText('Add your weekly class schedule')).toHaveCount(0);
  await toggle.click();
  await expect(page.getByText('Add your weekly class schedule')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide steps' })).toBeVisible();
});

test('the guest-account note is calm: no amber box', async ({ page }) => {
  await ready(page);
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addAssignment({ title: 'CAT 1', course: 'General', dueDate: '2030-01-15', priority: 'high', status: 'pending', progress: 0 })
  );
  const note = page.getByRole('note');
  await expect(note).toBeVisible({ timeout: 15_000 });
  await expect(note).toContainText('saved on this device');
  const bg = await note.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toMatch(/^rgb\(25[0-5], 24[0-9], 2[0-3][0-9]\)$/); // not the amber-50 tint
  expect(await note.evaluate((el) => el.className)).not.toContain('amber');
});

test.describe('timetable at a narrower desktop width', () => {
  const addClass = (page: Page) =>
    page.evaluate(() =>
      (window as unknown as { __store: { getState: () => { addSession: (s: object) => void } } }).__store.getState().addSession({
        title: 'Applied Physics', course: 'PHY342', dayOfWeek: new Date().getDay(), startTime: '10:00', endTime: '11:30', type: 'lecture'
      })
    );

  test('the Add block button stays on one line and the class card is readable', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/calendar');
    await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
    await addClass(page);
    const add = page.getByRole('button', { name: 'Add block' }).first();
    expect((await add.boundingBox())!.height).toBeLessThan(40);
    const card = page.getByRole('button', { name: /Edit.*Applied Physics/ });
    expect((await card.boundingBox())!.width).toBeGreaterThan(200);
    await expect(card).toContainText('Applied Physics');
  });

  test('the Today badge does not sit on top of the date', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/calendar');
    await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
    await addClass(page);
    const heading = page.locator('h3').filter({ has: page.locator('span', { hasText: /^Today$/ }) }).first();
    const badge = heading.locator('span', { hasText: /^Today$/ });
    const date = heading.locator('span').first();
    const b = (await badge.boundingBox())!;
    const d = (await date.boundingBox())!;
    const overlap = !(b.x >= d.x + d.width || d.x >= b.x + b.width || b.y >= d.y + d.height || d.y >= b.y + b.height);
    expect(overlap).toBe(false);
  });

  test('the empty timetable and the dialog use the same word for adding', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
    await page.getByRole('button', { name: 'Add a block' }).click();
    await expect(page.getByRole('dialog', { name: 'Add a block' })).toBeVisible();
  });
});
