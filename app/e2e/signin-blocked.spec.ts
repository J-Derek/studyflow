import { expect, test, type Browser, type Page } from '@playwright/test';

const ready = (page: Page) =>
  page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);

// A pop-up that is blocked no longer shows an error (the app signs in on the same page instead, see
// signin-no-popup.spec.ts). Google sign-in genuinely cannot run inside an in-app browser such as
// Instagram's, so that is where the message still appears, and where its position matters.
const INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0';

async function openAsInstagram(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: INSTAGRAM });
  const page = await context.newPage();
  await page.goto('/');
  await ready(page);
  return { context, page };
}

async function expectFullyOnScreen(page: Page, locator: ReturnType<Page['getByRole']>, label: string) {
  const box = (await locator.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${label} top edge`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${label} right edge`).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height, `${label} bottom edge`).toBeLessThanOrEqual(vp.height);
}

test('a sign-in message is fully visible and says what to do (sidebar button, bottom of the screen)', async ({ browser }) => {
  const { context, page } = await openAsInstagram(browser);
  await page.locator('aside').getByRole('button', { name: 'Sign in with Google' }).click();
  const message = page.getByRole('alert').filter({ hasText: 'does not work inside this app' });
  await expect(message).toBeVisible();
  await expect(message).toContainText('Open StudyFlow in Chrome or Safari');
  await expectFullyOnScreen(page, message, 'sidebar message');
  await context.close();
});

test('the same message is fully visible from the top bar button', async ({ browser }) => {
  const { context, page } = await openAsInstagram(browser);
  await page.locator('header').getByRole('button', { name: 'Sign in with Google' }).click();
  const message = page.getByRole('alert').filter({ hasText: 'does not work inside this app' });
  await expect(message).toBeVisible();
  await expectFullyOnScreen(page, message, 'top bar message');
  await context.close();
});
