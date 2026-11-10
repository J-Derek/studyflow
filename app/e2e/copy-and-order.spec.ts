import { expect, test, type Page } from '@playwright/test';

/** UX round, part C: less copy, and "Next up" in the order a student should look at it. */
type S = { userId: string | null; addAssignment: (a: object) => void };
type W = { __store: { getState: () => S } };

const ready = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};
test('the "easy to forget" hint shows for the first few items only, and Next up puts high priority first on the same day', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    const d = new Date(Date.now() + 2 * 86400000);
    const due = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const [title, priority] of [['Low one', 'low'], ['High one', 'high'], ['Medium one', 'medium']]) s.addAssignment({ title, course: 'General', dueDate: due, priority, status: 'pending', progress: 0 });
  });
  await page.getByRole('button', { name: 'Add assignment' }).first().click();
  await expect(page.getByRole('dialog')).not.toContainText('easy to forget');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: /Assignments/ }).first().click();
  await expect(page.getByTestId('legend')).toHaveCount(0);
  await page.getByRole('link', { name: /Today/ }).first().click();
  await expect(page.locator('#next-up-heading + p')).toHaveText('High one');
});
