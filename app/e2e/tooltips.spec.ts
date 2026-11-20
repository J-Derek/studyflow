import { expect, test, type Page } from '@playwright/test';

/** Icon-only controls have a name (aria-label) and a tooltip on hover, keyboard focus and long press. */
type W = { __store: { getState: () => Record<string, (...a: unknown[]) => unknown> & { userId: string | null } } };
const ready = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);

async function seed(page: Page) {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.loadSampleData();
    s.addNote({ title: 'A note', body: 'Body', course: 'LAW 101', pinned: false });
    s.addSession({ title: 'Lecture', course: 'LAW 101', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', type: 'lecture' });
  });
}

// Controls that show no words of their own must carry a name, or a screen reader and a tooltip have nothing to say.
const unnamed = (page: Page) =>
  page.evaluate(() => {
    const words = (el: Element): string => {
      let out = '';
      const walk = (n: Node) => {
        if (n.nodeType === Node.TEXT_NODE) out += n.textContent ?? '';
        else if (n instanceof Element && n.getAttribute('aria-hidden') !== 'true') n.childNodes.forEach(walk);
      };
      el.childNodes.forEach(walk);
      return out.trim();
    };
    const bad: string[] = [];
    for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (words(el) !== '') continue;
      if (!(el.getAttribute('aria-label') || el.getAttribute('data-tip') || el.getAttribute('title') || el.getAttribute('aria-labelledby'))) {
        bad.push(`${el.tagName.toLowerCase()} ${(el.className?.toString() ?? '').slice(0, 60)}`);
      }
    }
    return bad;
  });

for (const [name, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`${name}: every icon-only control on every page has a name`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: size, hasTouch: name === 'phone', isMobile: name === 'phone' });
    const page = await context.newPage();
    await seed(page);
    for (const path of ['/', '/assignments', '/calendar', '/timer', '/courses', '/notes']) {
      await page.goto(path);
      await ready(page);
      await page.waitForTimeout(300);
      expect(await unnamed(page), `${name} ${path}: icon-only controls without a name`).toEqual([]);
    }
    await context.close();
  });
}

test('hovering an icon-only button shows its tooltip, and it goes away again', async ({ page }) => {
  await page.goto('/calendar');
  await ready(page);
  await page.getByRole('button', { name: 'Next week', exact: true }).hover();
  const tip = page.getByRole('tooltip');
  await expect(tip).toHaveText('Next week');
  await page.mouse.move(5, 400);
  await expect(tip).toHaveCount(0);
});

test('reaching an icon-only button with the keyboard shows its tooltip, and Escape hides it', async ({ page }) => {
  await page.goto('/calendar');
  await ready(page);
  const prev = page.getByRole('button', { name: 'Previous week', exact: true });
  await page.keyboard.press('Tab'); // make the page keyboard-driven so :focus-visible applies
  await prev.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(prev).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveText('Previous week');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('a button that shows words does not get a tooltip', async ({ page }) => {
  await page.goto('/calendar');
  await ready(page);
  await page.getByRole('button', { name: 'Add block' }).first().hover();
  await page.waitForTimeout(600);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('on a touch screen a long press on an icon-only button shows its name', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('/calendar');
  await ready(page);
  const next = page.getByRole('button', { name: 'Next week', exact: true });
  await next.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
  await expect(page.getByRole('tooltip')).toHaveText('Next week');
  await context.close();
});
