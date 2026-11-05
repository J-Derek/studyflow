import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/assignments', '/calendar', '/timer', '/grades'];
const WIDTHS = [320, 375, 768, 1440];

for (const width of WIDTHS) {
  for (const route of ROUTES) {
    test(`no horizontal scrolling at ${width}px on ${route}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.waitForFunction(() => !!(window as any).__store?.getState().userId);
      await page.evaluate(() => (window as any).__store.getState().loadSampleData());
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
      }));
      expect(overflow.scroll, `page is ${overflow.scroll}px wide in a ${overflow.client}px window`).toBeLessThanOrEqual(overflow.client + 1);
    });
  }
}
