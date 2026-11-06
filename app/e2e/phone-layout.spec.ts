import { expect, test, type Page } from '@playwright/test';

type S = {
  userId: string | null;
  loadSampleData: () => void;
  addNote: (n: object) => string;
  addSession: (s: object) => void;
};

// Real content, including the awkward kinds: a very long link, a long title, clashing blocks.
async function seed(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);
  await page.evaluate(() => {
    const st = (window as unknown as { __store: { getState: () => S } }).__store.getState();
    st.loadSampleData();
    st.addNote({
      title: 'Week 3: contract law with a fairly long title that should wrap nicely',
      body: 'Slides: https://example.com/a/very/long/link/that/should/not/overflow/the/screen/at/all/week3.pdf',
      course: 'LAW 101',
      pinned: true
    });
    st.addSession({ title: 'Distributed Systems', course: 'ACS443', dayOfWeek: 3, startTime: '10:00', endTime: '11:30', type: 'lecture' });
    st.addSession({ title: 'Differential Calculus', course: 'MAT344', dayOfWeek: 3, startTime: '10:00', endTime: '11:30', type: 'lecture' });
  });
}

for (const width of [320, 375, 414]) {
  test(`at ${width}px wide, nothing on any screen runs off the edge`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await seed(page);

    for (const path of ['/', '/assignments', '/calendar', '/timer', '/grades', '/notes']) {
      await page.goto(path);
      await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);
      await page.waitForTimeout(400);
      const problems = await page.evaluate((w) => {
        const bad: string[] = [];
        if (document.documentElement.scrollWidth > w) bad.push(`page scrolls sideways (${document.documentElement.scrollWidth})`);
        const visible = (el: Element) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('.sr-only');
        };
        for (const el of document.querySelectorAll('main *')) {
          if (!visible(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.right > w + 1) bad.push(`${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}" ends at ${Math.round(r.right)}`);
        }
        return bad.slice(0, 5);
      }, width);
      expect(problems, `${path} at ${width}px`).toEqual([]);
    }
  });
}

test('on a phone an assignment title stays readable next to its course and due date', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await seed(page);
  await page.goto('/assignments');
  const title = page.getByText('Sample: Algorithms problem set').first();
  await expect(title).toBeVisible();
  expect((await title.boundingBox())!.width).toBeGreaterThan(90);
});

test('on a phone the timetable controls are easy to tap and a block cannot be deleted by a stray tap', async ({ browser }) => {
  // a touch device cannot hover, so the hover-only delete cross must not exist there
  const context = await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await seed(page);
  await page.goto('/calendar');
  for (const name of ['Previous week', 'Next week', 'Add Block']) {
    const box = (await page.getByRole('button', { name, exact: name !== 'Add Block' }).first().boundingBox())!;
    expect(box.height, name).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByRole('button', { name: /^Delete block/ }).first()).toBeHidden();
  await context.close();
});
