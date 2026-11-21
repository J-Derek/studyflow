import { expect, test, type Browser, type Page } from '@playwright/test';

/** Phone polish at 360x640 with a mobile user agent and touch. */
type W = { __store: { getState: () => Record<string, (...a: unknown[]) => unknown> & { userId: string | null } } };
const ready = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const phone = async (browser: Browser) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, userAgent: UA });
  return { context, page: await context.newPage() };
};

test('Today: focus time reads in minutes under an hour, not "about 0.0 h"', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => (window as unknown as W).__store.setState({ pomodorosCompleted: 1, focusMinutes: 12 }));
  await expect(page.getByText('12 min focused')).toBeVisible();
  await expect(page.getByText(/about .* h/)).toHaveCount(0);
  await page.evaluate(() => (window as unknown as W).__store.setState({ focusMinutes: 125 }));
  await expect(page.getByText('2.1 h focused')).toBeVisible();
  await context.close();
});

test('Today: the empty "all cleared" state is one compact line in plain words, without the big picture', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.addAssignment({ title: 'Done already', course: 'X 1', dueDate: '2030-01-15', priority: 'low', status: 'completed', progress: 100 });
  });
  await expect(page.getByText('All assignments cleared')).toBeVisible();
  await expect(page.getByText('Nothing due soon.')).toBeVisible();
  await expect(page.getByText(/pending on your course/)).toHaveCount(0);
  const card = page.getByText('All assignments cleared').locator('xpath=ancestor::div[contains(@class,"text-center")][1]');
  expect((await card.boundingBox())!.height).toBeLessThan(110);
  await context.close();
});

test('Courses: one short line and "Add these courses" turns the mentioned codes into courses', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await page.goto('/courses');
  await ready(page);
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.addAssignment({ title: 'Lab', course: 'PHY 101', dueDate: '2030-01-15', priority: 'low', status: 'pending', progress: 0 });
    s.addAssignment({ title: 'Essay', course: 'LAW 101', dueDate: '2030-01-16', priority: 'low', status: 'pending', progress: 0 });
  });
  const note = page.getByTestId('unlisted-courses');
  await expect(note).toContainText('PHY 101');
  await expect(note).toContainText('LAW 101');
  expect((await note.boundingBox())!.height).toBeLessThan(110);
  await note.getByRole('button', { name: 'Add these courses' }).click();
  await expect(page.getByTestId('unlisted-courses')).toHaveCount(0);
  const codes = await page.evaluate(() => (window as unknown as { __store: { getState: () => { grades: { courseCode: string }[] } } }).__store.getState().grades.map((g) => g.courseCode).sort());
  expect(codes).toEqual(['LAW 101', 'PHY 101']);
  await context.close();
});

test('a dialog with an input still fits, with Save in view, when the visible height shrinks to 360x360 (as with a keyboard open)', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await page.goto('/timer');
  await ready(page);
  await page.getByTestId('change-length').click();
  const dlg = page.getByRole('dialog', { name: /^Change the .* length$/ });
  await expect(dlg).toBeVisible();
  await page.setViewportSize({ width: 360, height: 360 });
  await expect(dlg.getByRole('button', { name: 'Save' })).toBeInViewport();
  const box = await dlg.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(360); // never taller than what is visible
  await expect(dlg.getByRole('button', { name: 'Cancel' })).toBeInViewport();
  await context.close();
});

test('Background sound is one row, and its choices open in a sheet that closes with Escape', async ({ browser }) => {
  const { context, page } = await phone(browser);
  await page.goto('/timer');
  await ready(page);
  const row = page.getByRole('button', { name: 'Change background sound' });
  await expect(page.getByText('Background sound:')).toBeVisible();
  await expect(page.getByText('Soft rain')).toHaveCount(0); // the tiles are in the sheet
  await row.click();
  const sheet = page.getByRole('dialog', { name: 'Background sound' });
  await expect(sheet.getByText('Soft rain')).toBeVisible();
  await expect(sheet.getByLabel('Play a sound when a block ends (this device)')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(row).toBeFocused();
  await context.close();
});
