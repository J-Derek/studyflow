import { expect, test, type Page } from '@playwright/test';

type S = { userId: string | null; sessions: Array<{ dayOfWeek: number; title: string }>; addSession: (s: object) => void };
const ready = async (page: Page) => {
  await page.goto('/calendar');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);
};

test('two blocks at the same day and time show a warning, but can still be added', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  await page.evaluate(() =>
    (window as unknown as { __store: { getState: () => S } }).__store.getState().addSession({
      title: 'Distributed Systems', course: 'ACS443', dayOfWeek: 3, startTime: '10:00', endTime: '11:30', type: 'lecture'
    })
  );

  await page.getByRole('button', { name: 'Add Block' }).first().click();
  await page.getByPlaceholder('e.g. Distributed Systems Lab').fill('Differential Calculus');
  await page.getByPlaceholder('e.g. CS 101').fill('MAT344');
  await page.getByLabel('Day of the week').selectOption({ label: 'Wed' });
  await expect(page.getByRole('status')).toContainText('clashes with Distributed Systems (10:00-11:30)');

  // the warning does not stop the student
  await page.locator('form').getByRole('button', { name: 'Add Block' }).click();
  await expect(page.getByText('Clashes with another block')).toHaveCount(2);
});

test('an end time that is not after the start time is refused', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  await page.getByRole('button', { name: 'Add Block' }).first().click();
  await page.getByPlaceholder('e.g. Distributed Systems Lab').fill('Backwards');
  await page.getByPlaceholder('e.g. CS 101').fill('XYZ1');
  await page.getByLabel('Start time').fill('12:00');
  await page.getByLabel('End time').fill('11:00');
  await expect(page.getByRole('alert')).toContainText('end time must be after');
  await page.locator('form').getByRole('button', { name: 'Add Block' }).click();
  expect(await page.evaluate(() => (window as unknown as { __store: { getState: () => S } }).__store.getState().sessions.length)).toBe(0);
});

test('a Sunday block is saved as day 0 and shows in the Sunday column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  await page.getByRole('button', { name: 'Add Block' }).first().click();
  await page.getByPlaceholder('e.g. Distributed Systems Lab').fill('Sunday revision');
  await page.getByPlaceholder('e.g. CS 101').fill('REV1');
  await page.getByLabel('Day of the week').selectOption({ label: 'Sun' });
  await page.locator('form').getByRole('button', { name: 'Add Block' }).click();

  const s = await page.evaluate(() => (window as unknown as { __store: { getState: () => S } }).__store.getState().sessions);
  expect(s.map((x) => [x.title, x.dayOfWeek])).toEqual([['Sunday revision', 0]]);
  await expect(page.getByRole('heading', { name: 'Sunday revision' })).toBeVisible();
});
