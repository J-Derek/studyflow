import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** PR5: the five rules pages (drafts), reachable from Help, the account menu, Your account, and by their own addresses. */
type S = { userId: string | null; setTheme: (t: 'light' | 'dark') => void };
type W = { __store: { getState: () => S } };

const PAGES = [
  { path: '/privacy', heading: 'Privacy', text: 'What we keep' },
  { path: '/terms', heading: 'Terms of use', text: 'Fair use' },
  { path: '/children', heading: 'Children and parents', text: 'Under 13' },
  { path: '/storage', heading: 'Storage on your device', text: 'does not use cookies' },
  { path: '/accessibility', heading: 'Accessibility', text: 'What we cannot promise' }
] as const;

const ready = async (page: Page, path: string) => {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: every rules page opens at its own address, says it is a draft, and has no accessibility problems`, async ({ page }) => {
    for (const p of PAGES) {
      await ready(page, p.path);
      await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
      const article = page.getByTestId('legal-page');
      await expect(article.getByRole('heading', { level: 1, name: p.heading })).toBeVisible();
      await expect(article).toContainText(p.text);
      await expect(page.getByTestId('legal-draft-notice')).toContainText('not been checked by a lawyer');
      await expect(page.getByTestId('not-found')).toHaveCount(0);
      await page.waitForTimeout(300);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(axe.violations.map((v) => `${p.path} ${v.id}`)).toEqual([]);
    }
  });
}

test('no footer of rules links on every screen; Help lists all five, each opens its page, and a link inside a page opens another without reloading', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page, '/');
  await expect(page.locator('footer')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'About StudyFlow' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Help', exact: true }).first().click();
  const help = page.getByRole('dialog');
  await help.getByRole('button', { name: 'Sample data' }).click();
  const nav = help.getByRole('navigation', { name: 'About StudyFlow' });
  await expect(nav.getByRole('link')).toHaveCount(5);
  for (const a of await nav.getByRole('link').all()) {
    expect((await a.boundingBox())!.height, await a.innerText()).toBeGreaterThanOrEqual(44);
  }
  await nav.getByRole('link', { name: 'Privacy' }).click();
  await expect(help).toHaveCount(0);
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByTestId('legal-page').getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();

  // the draft line is quiet: after the text, not an amber box at the top
  const notice = page.getByTestId('legal-draft-notice');
  await expect(notice).toContainText('not been checked by a lawyer');
  const noticeBox = (await notice.boundingBox())!;
  const headingBox = (await page.getByTestId('legal-page').getByRole('heading', { level: 1 }).boundingBox())!;
  expect(noticeBox.y).toBeGreaterThan(headingBox.y);

  // a link inside the text goes to the next page in the app, not a full reload
  await page.evaluate(() => ((window as unknown as { __marker?: boolean }).__marker = true));
  await page.getByTestId('legal-page').getByRole('link', { name: 'Children and parents' }).click();
  await expect(page).toHaveURL(/\/children$/);
  await expect(page.getByTestId('legal-page').getByRole('heading', { level: 1, name: 'Children and parents' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker)).toBe(true);
});

test('the sitemap lists the rules pages', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const p of PAGES) expect(sitemap).toContain(`app-beta-lilac-23.vercel.app${p.path}</loc>`);
});
