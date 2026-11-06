import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type W = {
  __store: {
    getState: () => { userId: string | null; loadSampleData: () => void; setTheme: (t: 'light' | 'dark') => void; addNote: (n: object) => string };
  };
};

const ROUTES = ['/', '/assignments', '/calendar', '/timer', '/grades', '/notes'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function prepare(page: Page, path: string, theme: 'light' | 'dark'): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.evaluate((t) => {
    const s = (window as unknown as W).__store.getState();
    s.loadSampleData();
    s.setTheme(t);
    s.addNote({ title: 'Week 3: contract law', body: 'Offer, acceptance, consideration.\nSlides: https://example.com/week3', course: 'LAW 101', pinned: true });
    s.addNote({ title: 'Exam tips', body: 'Past papers are on the portal.', course: '' });
  }, theme);
  await page.waitForTimeout(400);
}

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    count: v.nodes.length
  }));
}

for (const [label, size] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 375, height: 812 }]] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test.describe(`axe ${label} ${theme}`, () => {
      test.use({ viewport: size });
      for (const route of ROUTES) {
        test(`${route} has no accessibility violations`, async ({ page }) => {
          await prepare(page, route, theme);
          const violations = await scan(page);
          expect(violations, JSON.stringify(violations, null, 1)).toEqual([]);
        });
      }
    });
  }
}
