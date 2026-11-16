import { expect, test } from '@playwright/test';

/** The browser tab shows the real StudyFlow mark: real files, linked from the page, and a /favicon.ico for browsers that ask for it. */
test('the page links real favicon files and they are served as images', async ({ page, request }) => {
  await page.goto('/');
  const links = await page.$$eval('head link[rel="icon"]', (els) => els.map((e) => ({ href: e.getAttribute('href') ?? '', type: e.getAttribute('type') ?? '' })));
  expect(links.map((l) => l.href)).toEqual(expect.arrayContaining(['/favicon.ico', '/favicon.svg', '/favicon-32.png']));
  expect(links.some((l) => l.href.startsWith('data:'))).toBe(false);
  for (const [href, type] of [['/favicon.ico', /image\/(x-icon|vnd\.microsoft\.icon)/], ['/favicon.svg', /image\/svg\+xml/], ['/favicon-32.png', /image\/png/], ['/icons/apple-touch-icon.png', /image\/png/]] as const) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
    expect(res.headers()['content-type'] ?? '', href).toMatch(type);
    expect((await res.body()).length, href).toBeGreaterThan(200);
  }
});
