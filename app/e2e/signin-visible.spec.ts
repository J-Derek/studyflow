import { expect, test } from '@playwright/test';

// A brand-new student must be able to find "Sign in" without hunting for it.
for (const [name, width, height] of [['desktop', 1280, 800], ['phone', 375, 800]] as const) {
  test(`a first-time visitor sees a Sign in with Google button right away (${name})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);

    const buttons = page.getByRole('button', { name: 'Sign in with Google' });
    // top bar (always) and the first-run card on the Today screen
    await expect(buttons.first()).toBeVisible();
    expect(await buttons.count()).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < (await buttons.count()); i++) {
      if (await buttons.nth(i).isVisible()) {
        const box = (await buttons.nth(i).boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(40);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
    }
    // no sideways scrolling
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await context.close();
  });
}
