import { expect, test } from '@playwright/test';

type S = { userId: string | null; isAnonymous: boolean };
const ready = async (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);

// The page hides overflow, so a plain "no sideways scrolling" check cannot see buttons pushed off the edge.
// This checks that every control in the top bar sits fully inside the screen.
for (const width of [320, 360, 375, 390, 414, 600, 768, 1024, 1280]) {
  for (const signedIn of [false, true]) {
    test(`the top bar fits at ${width}px (${signedIn ? 'signed in' : 'guest'})`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 760 } });
      const page = await context.newPage();
      await page.goto('/');
      await ready(page);
      if (signedIn) {
        await page.evaluate(() => (window as unknown as { __store: { setState: (s: object) => void } }).__store.setState({ isAnonymous: false, userEmail: 'a@b.co' }));
      }
      const buttons = page.locator('header button:visible');
      expect(await buttons.count()).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < (await buttons.count()); i++) {
        const box = (await buttons.nth(i).boundingBox())!;
        const label = (await buttons.nth(i).innerText()) || (await buttons.nth(i).getAttribute('aria-label')) || `button ${i}`;
        expect(box.x, `${label} starts inside the screen`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${label} ends inside the screen`).toBeLessThanOrEqual(width + 0.5);
      }
      // the Add button is always reachable
      await expect(page.getByRole('button', { name: 'Add assignment' }).first()).toBeVisible();
      // and nothing in the bar is wider than the bar
      expect(await page.locator('header').evaluate((h) => h.scrollWidth <= h.clientWidth + 1)).toBe(true);
      await context.close();
    });
  }
}

test('on a phone, profile, theme and help are all reachable from the profile dialog', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 760 } });
  const page = await context.newPage();
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Edit profile' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Current semester');
  await expect(dialog).toContainText('Semester starts');
  // the default wording is semester, not the old "Term" labels (the dropdown's own option names are allowed)
  await expect(dialog).not.toContainText(/Current term|Term starts|Term ends/i);
  await dialog.getByRole('button', { name: /Use dark theme/ }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await dialog.getByRole('button', { name: 'Help' }).click();
  await expect(page.getByRole('dialog')).toContainText('A quick tour');
  await context.close();
});
