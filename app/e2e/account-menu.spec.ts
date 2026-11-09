import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type W = { __store: { getState: () => { userId: string | null; isAnonymous: boolean } }; __auth: { signInOrLinkWithGoogle: () => Promise<unknown> } };

async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  // Listen for the close now: the pop-up can close as soon as the account is clicked, and a listener
  // added after that never fires (the test then hung until its 60 s timeout).
  const popupClosed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('button.mdc-button--outlined').first().click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#email-input').fill(`menu-${Date.now().toString(36)}@example.com`);
  await popup.locator('#sign-in').click();
  await popupClosed;
  await page.waitForFunction(() => (window as unknown as W).__store.getState().isAnonymous === false);
}

for (const [label, width, height] of [['desktop', 1280, 800], ['phone', 375, 800]] as const) {
  test(`${label}: the signed-in picture opens an account panel with details and quick settings`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await signIn(page);

    // Nothing but the picture is shown until it is clicked (one picture button per visible bar).
    const trigger = page.getByRole('button', { name: 'Account menu' }).first();
    await expect(trigger).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);

    await trigger.click();
    const panel = page.getByRole('dialog', { name: 'Account' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('@example.com');
    await expect(panel.getByRole('button', { name: 'Edit profile' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Your account', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();

    // the panel stays inside the screen
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);

    // no accessibility violations while open
    const results = await new AxeBuilder({ page }).include('[role="dialog"][aria-label="Account"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);

    // theme switch works from the panel
    await panel.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await panel.getByRole('button', { name: 'Light' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // Escape closes it and returns focus to the picture
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // clicking elsewhere closes it too
    await trigger.click();
    await expect(panel).toBeVisible();
    await page.locator('main').click({ position: { x: 5, y: 5 }, force: true });
    await expect(panel).toHaveCount(0);

    // Edit profile opens the profile dialog and closes the panel
    await trigger.click();
    await page.getByRole('dialog', { name: 'Account' }).getByRole('button', { name: 'Edit profile' }).click();
    await expect(page.getByRole('dialog', { name: 'Account' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toContainText('Current semester');
    await context.close();
  });
}

test('a guest still sees the sign-in button and no account menu', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect(page.getByRole('button', { name: 'Account menu' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
});
