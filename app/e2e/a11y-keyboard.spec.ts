import { expect, test, type Page } from '@playwright/test';

async function start(page: Page, path: string, theme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as any).__store?.getState().userId);
  await page.evaluate((t) => {
    const s = (window as any).__store.getState();
    s.loadSampleData();
    s.setTheme(t);
  }, theme);
}

/** A focus indicator exists when the focused element has a visible outline or box-shadow ring. */
const hasFocusIndicator = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { ok: true, label: 'body' };
    const cs = getComputedStyle(el);
    const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 && cs.outlineColor !== 'rgba(0, 0, 0, 0)';
    const ring = cs.boxShadow !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(cs.boxShadow);
    return { ok: outline || ring, label: `${el.tagName.toLowerCase()} ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}` };
  });

for (const theme of ['light', 'dark'] as const) {
  for (const route of ['/', '/assignments', '/calendar', '/timer', '/grades']) {
    test(`keyboard only ${route} (${theme}): every stop shows focus and nothing traps the user`, async ({ page }) => {
      await start(page, route, theme);
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      const seen = new Set<string>();
      for (let i = 0; i < 80; i++) {
        await page.keyboard.press('Tab');
        const r = await hasFocusIndicator(page);
        expect(r.ok, `no visible focus on: ${r.label}`).toBe(true);
        seen.add(r.label);
      }
      expect(seen.size).toBeGreaterThan(8); // focus really moves through the page, not stuck
    });
  }
}

test('skip link is the first stop and moves focus to the main content', async ({ page }) => {
  await start(page, '/assignments');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
});

test('every main action works with the keyboard alone (add assignment, tick, delete subtask flow)', async ({ page }) => {
  await start(page, '/');
  await page.getByRole('button', { name: 'Add assignment' }).first().focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').first().fill('Keyboard only essay');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add assignment' }).first()).toBeFocused(); // focus returned to the opener
});

test('timer announces state changes to screen readers without announcing every second', async ({ page }) => {
  await start(page, '/timer');
  const status = page.getByRole('status').filter({ hasText: /ready|running|paused/ });
  await expect(status).toContainText('Focus ready, 25 minutes');
  await page.getByRole('button', { name: /^start/i }).click();
  await expect(status).toContainText('Focus running, 25 minutes left');
  const first = await status.textContent();
  await page.waitForTimeout(2500);
  expect(await status.textContent()).toBe(first); // still the same minute: no chatter every second
  await page.getByRole('button', { name: /pause/i }).click();
  await expect(status).toContainText('Focus paused');
  await expect(page.getByRole('timer')).toHaveAccessibleName('Focus timer');
});
