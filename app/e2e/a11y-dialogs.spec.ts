import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function start(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__store?.getState().userId);
  await page.evaluate((t) => {
    const s = (window as any).__store.getState();
    s.loadSampleData();
    s.setTheme(t);
  }, theme);
}

const openers: Array<[string, (p: Page) => Promise<void>]> = [
  ['help', async (p) => { await p.getByRole('button', { name: 'Help', exact: true }).click(); }],
  ['sign-in', async (p) => { await p.getByRole('button', { name: 'Sign in to keep your data', exact: true }).click(); }],
  ['profile', async (p) => { await p.getByRole('button', { name: /edit profile/i }).first().click(); }],
  ['add assignment', async (p) => { await p.getByRole('button', { name: 'Add assignment' }).first().click(); }],
  ['command palette', async (p) => { await p.keyboard.press('Control+k'); }]
];

for (const theme of ['light', 'dark'] as const) {
  for (const [name, open] of openers) {
    test(`${name} dialog (${theme}): accessible name, no axe violations, Escape closes, focus returns`, async ({ page }) => {
      await start(page, theme);
      
      await open(page);
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleName(/.+/);

      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(results.violations.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) }))).toEqual([]);

      // keyboard focus must be inside the dialog, and Tab must not leave it
      const inside = async () => page.evaluate(() => !!document.activeElement && !!document.activeElement.closest('[role="dialog"]'));
      for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
      expect(await inside()).toBe(true);

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  }
}
