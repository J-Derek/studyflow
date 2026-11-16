import { expect, test } from '@playwright/test';

/** One brand mark everywhere, and plain words instead of hype. */
type W = { __store?: { getState: () => { userId: string | null } } };

test('the sidebar shows the StudyFlow layers mark, not a generic icon', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as W).__store?.getState().userId);
  const mark = page.locator('aside svg rect[fill="#312E81"]').first();
  await expect(mark).toBeAttached();
});

test('saving a first deadline says so plainly, with no hype', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as W).__store?.getState().userId);
  await page.getByLabel('What is due?').fill('Essay draft');
  await page.getByRole('button', { name: /Save deadline/ }).click();
  await expect(page.getByText('Saved “Essay draft”')).toBeVisible();
  for (const hype of ['locked in', 'Live countdown', 'immediate momentum', 'Launch Focus Round']) {
    await expect(page.getByText(hype)).toHaveCount(0);
  }
});

test('the page description is plain', async ({ page }) => {
  await page.goto('/');
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toBe('StudyFlow: a study planner for deadlines, your weekly timetable, a focus timer and your grades.');
});
