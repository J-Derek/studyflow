import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type Store = {
  userId: string | null;
  assignments: Array<{ id: string; title: string }>;
  addAssignment: (a: unknown) => void;
  toggleAssignmentComplete: (id: string) => void;
  addNote: (n: unknown) => string;
  setTheme: (t: 'light' | 'dark') => void;
};
const store = () => (window as unknown as { __store: { getState: () => Store } }).__store.getState();

const ready = (page: Page) =>
  page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => Store } }).__store?.getState().userId);

async function open(page: Page, path: string) {
  await page.goto(path);
  await ready(page);
  // `store()` is used inside page.evaluate callbacks, so it has to exist in the page, not just in this file
  await page.evaluate(() => {
    (window as unknown as { store: () => unknown }).store = () => (window as unknown as { __store: { getState: () => unknown } }).__store.getState();
  });
}

const illustration = (page: Page, kind: string) => page.locator(`svg[data-illustration="${kind}"]`);

// What each empty screen should show.
const SCREENS: Array<[string, string, string[]]> = [
  ['Assignments', '/assignments', ['assignments']],
  ['Notes', '/notes', ['notes']],
  ['Timetable', '/calendar', ['timetable']],
  ['Today', '/', ['assignments', 'sunrise']]
];

for (const [name, path, kinds] of SCREENS) {
  test(`${name}: the empty screen shows its animation, which moves and is hidden from screen readers`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, path);
    for (const kind of kinds) {
      const svg = illustration(page, kind).first();
      await expect(svg).toBeVisible();
      await expect(svg).toHaveAttribute('aria-hidden', 'true');
      // at least one part of it is really animating
      const running = await svg.evaluate((el) =>
        [...el.querySelectorAll('[class*="sf-"]')].some((p) => getComputedStyle(p).animationName !== 'none')
      );
      expect(running, `${kind} should be animating`).toBe(true);
    }
  });

  test(`${name}: with "reduce motion" switched on, the animation stands still but is still shown`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, path);
    for (const kind of kinds) {
      const svg = illustration(page, kind).first();
      await expect(svg).toBeVisible();
      const moving = await svg.evaluate((el) =>
        [...el.querySelectorAll('[class*="sf-"]')].filter((p) => getComputedStyle(p).animationName !== 'none').length
      );
      expect(moving, `${kind} must not animate`).toBe(0);
    }
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`${name}: the empty screen has no accessibility problems (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page, path);
      await page.evaluate((t) => store().setTheme(t), theme);
      await expect(illustration(page, kinds[0]).first()).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test(`${name}: nothing runs off the screen on a small phone`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page, path);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const kind of kinds) {
      const box = await illustration(page, kind).first().boundingBox();
      if (box) expect(box.x + box.width, `${kind} right edge`).toBeLessThanOrEqual(320);
    }
  });
}

test('the animations go away once there is real content to show', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, '/assignments');
  await expect(illustration(page, 'assignments').first()).toBeVisible();
  await page.evaluate(() =>
    store().addAssignment({ title: 'Lab report', course: 'PHY 210', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 })
  );
  await expect(illustration(page, 'assignments')).toHaveCount(0);

  await open(page, '/notes');
  await expect(illustration(page, 'notes').first()).toBeVisible();
  await page.evaluate(() => store().addNote({ title: 'Week 3', body: 'Offer and acceptance.', course: 'LAW 101', pinned: false }));
  await expect(illustration(page, 'notes')).toHaveCount(0);
});

test('Today celebrates with the "all done" animation when every assignment is finished', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, '/');
  await page.evaluate(() =>
    store().addAssignment({ title: 'Lab report', course: 'PHY 210', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 })
  );
  await page.evaluate(() => {
    const a = store().assignments.find((x) => x.title === 'Lab report')!;
    store().toggleAssignmentComplete(a.id);
  });
  await expect(illustration(page, 'done').first()).toBeVisible();
  await expect(illustration(page, 'done').first()).toHaveAttribute('aria-hidden', 'true');
});
