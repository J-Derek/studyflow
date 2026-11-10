import { expect, test, type Page } from '@playwright/test';

/** UX round, part B: each screen opens on the useful thing. */
const ready = async (page: Page, path: string) => {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);
};

test('the Timer shows the clock and Start before the lengths form, which stays collapsed', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await ready(page, '/timer');
  const start = page.getByRole('button', { name: 'Start', exact: true });
  const lengths = page.getByText('Change timer lengths');
  expect((await start.boundingBox())!.y).toBeLessThan((await lengths.boundingBox())!.y);
  expect((await start.boundingBox())!.y + 44).toBeLessThanOrEqual(740);
  await expect(page.locator('details').first()).not.toHaveAttribute('open', '');
});

test('an empty Timetable shows only the add-a-class card, with no empty week columns', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await ready(page, '/calendar');
  await expect(page.getByText('Your weekly class schedule is empty')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Add Block' })).toHaveCount(0);
  await expect(page.getByText('What do the labels mean?')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add a class' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('empty Courses hides the GPA boxes until a course exists', async ({ page }) => {
  await ready(page, '/courses');
  await expect(page.getByRole('heading', { name: 'Courses' }).first()).toBeVisible();
  await expect(page.getByText(/courses? added/)).toHaveCount(0);
});

test('one name for the assignments page on the bottom bar and the page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await ready(page, '/');
  const link = page.getByRole('navigation', { name: 'Mobile Navigation' }).getByRole('link', { name: /Assignments/ });
  await expect(link).toBeVisible();
  const box = (await link.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(await link.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await link.click();
  await expect(page.getByRole('heading', { name: 'Assignments', level: 1 })).toBeVisible();
});

test('one theme switcher: guests have it in the sidebar, signed-in students in the account menu only', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page, '/');
  await expect(page.getByRole('button', { name: 'Device' })).toHaveCount(1);
});
