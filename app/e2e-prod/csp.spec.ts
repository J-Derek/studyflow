import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * The Content-Security-Policy in vercel.json is shipped as report-only. This test applies the very same policy to the
 * production build as an ENFORCED header (stricter than report-only) and walks the main screens. Any blocked script, style,
 * image, frame or connection is a violation and fails the test, so the policy cannot silently break the app.
 *
 * Added for the local test servers only: the emulators' addresses. Real Google sign-in is NOT covered here (the
 * emulator's pop-up is not Google's), which is why the header ships as report-only first.
 */
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: { headers: { key: string; value: string }[] }[];
};
const REPORT_ONLY = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy-Report-Only')!.value;
const EMULATORS = 'http://127.0.0.1:9099 http://127.0.0.1:8080 ws://127.0.0.1:8080';
const POLICY = REPORT_ONLY.replace("connect-src 'self'", `connect-src 'self' ${EMULATORS}`).replace("frame-src 'self'", `frame-src 'self' ${EMULATORS}`);

type W = {
  __store: { getState: () => { userId: string | null; isAnonymous: boolean; addNote: (n: object) => string } };
  __auth: { signInOrLinkWithGoogle: () => Promise<unknown> };
  __csp: string[];
};

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF\n'
);

// A small static server for the production build that sends the policy as an ENFORCED header. (Rewriting the response inside
// the browser makes Chrome treat the page as "public" and refuse its calls to the local emulators.)
const DIST = join(process.cwd(), 'dist-e2e');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml'
};
let server: Server;
let base = '';

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    let file = join(DIST, path);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html'); // the app's own routes
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'content-security-policy': POLICY });
    res.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(5196, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:5196';
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function enforce(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = seen;
    document.addEventListener('securitypolicyviolation', (e) => seen.push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'} (${e.sourceFile}:${e.lineNumber})`));
  });
}

const violations = (page: Page) => page.evaluate(() => (window as unknown as W).__csp);

test('the production build runs with the policy enforced: theme script, boot, notes with a PDF, sign-in, account dialog', async ({ page }) => {
  await enforce(page);
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) consoleErrors.push(m.text());
  });

  // Boot as a guest. The dark theme must come from the inline script (blocked script means a light flash).
  await page.addInitScript(() => localStorage.setItem('studyflow_theme', 'dark'));
  await page.goto(`${base}/`);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect(page.locator('html')).toHaveClass(/dark/);

  // A note with a PDF: the reader shows it in a frame on a blob: address.
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addNote({ title: 'CSP note', body: 'Slides: https://example.com/a.pdf.', course: '', pinned: false })
  );
  await page.goto(`${base}/notes`);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.getByRole('button', { name: /CSP note/ }).first().click();
  await page.getByRole('button', { name: 'Read full screen' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'slides.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByRole('button', { name: /slides\.pdf.*tap to read/ }).click();
  await expect(page.locator('iframe[title="slides.pdf"]')).toBeVisible({ timeout: 15_000 });
  expect(await page.locator('iframe[title="slides.pdf"]').getAttribute('src')).toMatch(/^blob:/);

  // Sign in through the emulator's pop-up, then open the account dialog.
  await page.goto(`${base}/`);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId && !!(window as unknown as Partial<W>).__auth);
  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  const closed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('button.mdc-button--outlined').first().click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#email-input').fill(`csp-${Date.now().toString(36)}@example.com`);
  await popup.locator('#sign-in').click();
  await closed;
  await page.waitForFunction(() => (window as unknown as W).__store.getState().isAnonymous === false);
  await page.getByRole('button', { name: 'Account menu' }).first().click();
  await page.getByRole('button', { name: 'Your account', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your account' })).toBeVisible();

  // Every main page draws.
  for (const path of ['/assignments', '/calendar', '/timer', '/grades', '/notes']) {
    await page.goto(`${base}${path}`);
    await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
    await expect(page.locator('main')).toBeVisible();
  }

  expect(await violations(page), 'policy violations on the last page').toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('the policy really blocks what it should (an injected script and a foreign frame)', async ({ page }) => {
  await enforce(page);
  await page.goto(`${base}/`);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  const result = await page.evaluate(async () => {
    (window as unknown as { __ran?: boolean }).__ran = false;
    const s = document.createElement('script');
    s.textContent = 'window.__ran = true';
    document.body.appendChild(s);
    const f = document.createElement('iframe');
    f.src = 'https://example.org/';
    document.body.appendChild(f);
    await new Promise((r) => setTimeout(r, 500));
    return { ran: (window as unknown as { __ran: boolean }).__ran, csp: (window as unknown as W).__csp };
  });
  expect(result.ran).toBe(false);
  expect(result.csp.some((v) => v.startsWith('script-src'))).toBe(true);
  expect(result.csp.some((v) => v.startsWith('frame-src'))).toBe(true);
});
