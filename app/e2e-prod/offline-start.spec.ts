import { expect, test, type Page } from '@playwright/test';

/**
 * UX round, part F: installable, and it opens with no connection after the first visit. Runs against the PRODUCTION build (the service
 * worker only exists there). The control test proves the offline check is real: with the service worker removed, the same reload fails.
 */
async function firstVisit(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today' }).first()).toBeVisible();
  // wait until the service worker is active and has saved the app shell and its files
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) return false;
    const names = (await caches.keys()).filter((n) => n.startsWith('studyflow-'));
    if (names.length === 0) return false;
    const cache = await caches.open(names[0]!);
    const saved = (await cache.keys()).map((k) => k.url);
    // the app shell, the start-up files and the Firebase file (sign-in and saving) must all be there
    return saved.length >= 25 && !!(await cache.match('/index.html')) && saved.some((u) => /\/assets\/vendor-firebase-/.test(u)) && saved.some((u) => /\/assets\/index-.*\.js$/.test(u));
  }, undefined, { timeout: 30_000 });
  // let the page be controlled by it (it claims open pages when it activates)
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 10_000 });
}

test('after one visit, a reload with no connection still opens the app, and so does another page of it', async ({ context, page }) => {
  await firstVisit(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today' }).first()).toBeVisible({ timeout: 15_000 });
  // another page of the app (its code was saved at install), reached by its own address while offline
  await page.goto('/assignments');
  await expect(page.getByRole('heading', { name: 'Assignments', level: 1 })).toBeVisible({ timeout: 15_000 });
  await page.goto('/timer');
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
});

test('control: without the service worker, the same offline reload does not open the app', async ({ context, page }) => {
  await firstVisit(page);
  await page.evaluate(async () => {
    for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    for (const name of await caches.keys()) await caches.delete(name);
  });
  await context.setOffline(true);
  await page.reload().catch(() => undefined);
  await expect(page.getByRole('heading', { name: 'Today' })).toHaveCount(0);
  await context.setOffline(false);
});

test('the sign-in handler and other websites are never answered by the service worker', async ({ page }) => {
  await firstVisit(page);
  const answered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const src = await (await fetch(reg.active!.scriptURL)).text();
    return { handler: src.includes("'/__/'"), sameOriginOnly: src.includes('url.origin !== self.location.origin'), getOnly: src.includes("request.method !== 'GET'") };
  });
  expect(answered).toEqual({ handler: true, sameOriginOnly: true, getOnly: true });
});

test('the manifest is installable: real PNG icons of the right size, a maskable one, and a name', async ({ page, request }) => {
  await page.goto('/');
  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as { name: string; start_url: string; display: string; icons: { src: string; sizes: string; type: string; purpose?: string }[] };
  expect(manifest.name).toBeTruthy();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((i) => i.sizes === '192x192' && i.type === 'image/png')).toBe(true);
  expect(manifest.icons.some((i) => i.sizes === '512x512' && i.type === 'image/png')).toBe(true);
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type'], icon.src).toContain('image/png');
  }
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('/icons/apple-touch-icon.png');
});
