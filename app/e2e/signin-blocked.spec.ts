import { expect, test, type Page } from '@playwright/test';

const ready = (page: Page) =>
  page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);

// A browser that blocks pop-ups hands back nothing from window.open.
const blockPopups = (page: Page) => page.evaluate(() => void ((window as unknown as { open: () => null }).open = () => null));

async function expectFullyOnScreen(page: Page, locator: ReturnType<Page['getByRole']>, label: string) {
  const box = (await locator.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${label} top edge`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${label} right edge`).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height, `${label} bottom edge`).toBeLessThanOrEqual(vp.height);
}

test('when the browser blocks the Google window, the message is fully visible and says what to do (sidebar)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await ready(page);
  await blockPopups(page);

  await page.locator('aside').getByRole('button', { name: 'Sign in with Google' }).click();
  const message = page.getByRole('alert').filter({ hasText: 'blocked the Google sign-in window' });
  await expect(message).toBeVisible();
  await expect(message).toContainText('address bar');
  await expect(message).toContainText('Always allow');
  await expectFullyOnScreen(page, message, 'sidebar message');
});

test('the same message is fully visible from the top bar button', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await ready(page);
  await blockPopups(page);

  await page.locator('header').getByRole('button', { name: 'Sign in with Google' }).click();
  const message = page.getByRole('alert').filter({ hasText: 'blocked the Google sign-in window' });
  await expect(message).toBeVisible();
  await expectFullyOnScreen(page, message, 'top bar message');
});
