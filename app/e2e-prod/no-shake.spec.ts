import { expect, test } from '@playwright/test';

// On the production build the two main fonts are fetched straight away. Without that they arrive after the
// first paint and the text and header visibly change width, which looks like the page twitching on every reload.
test('the main fonts are preloaded and the first load does not shift the layout', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __shifts: number[] }).__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
        if (!e.hadRecentInput) (window as unknown as { __shifts: number[] }).__shifts.push(e.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);

  const hrefs = await page.$$eval('head link[rel="preload"][as="font"]', (links) => links.map((l) => (l as HTMLLinkElement).href));
  expect(hrefs.some((h) => /inter-latin-wght-normal/.test(h)), 'Inter is preloaded').toBe(true);
  expect(hrefs.some((h) => /bricolage-grotesque-latin-wght-normal/.test(h)), 'Bricolage Grotesque is preloaded').toBe(true);
  for (const href of hrefs) {
    const res = await page.request.get(href);
    expect(res.status(), href).toBe(200);
  }

  await page.waitForTimeout(2000);
  const shifts = await page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts);
  expect(shifts.reduce((a, b) => a + b, 0), `layout shifts on first load ${JSON.stringify(shifts)}`).toBeLessThan(0.005);
});
