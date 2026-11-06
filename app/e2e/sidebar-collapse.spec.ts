import { expect, test } from '@playwright/test';

test('the sidebar collapses to an icon rail, keeps working, and remembers the choice', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);

  const aside = page.locator('aside');
  const wide = (await aside.boundingBox())!.width;
  expect(wide).toBeGreaterThan(200);

  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => (await aside.boundingBox())!.width).toBeLessThan(80);

  // navigation still works by its accessible names
  await page.getByRole('link', { name: 'Assignments' }).click();
  await expect(page).toHaveURL(/\/assignments$/);
  await expect(page.getByRole('heading', { name: 'Assignments', level: 1 })).toBeVisible();

  // the choice survives a reload
  await page.reload();
  await expect.poll(async () => (await page.locator('aside').boundingBox())!.width).toBeLessThan(80);

  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect.poll(async () => (await page.locator('aside').boundingBox())!.width).toBeGreaterThan(200);
});
