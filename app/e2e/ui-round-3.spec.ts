import { expect, test, type Page } from '@playwright/test';

/** UI round 3: the semester prompt, the one colour system, note previews, the top bar and a phone's one-day week. */
type W = { __store: { getState: () => Record<string, (...a: unknown[]) => unknown> & { userId: string | null } } };
const ready = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

test('Timetable asks for semester dates with a card, can put it away for the week, and keeps a quiet line once they are set', async ({ page }) => {
  await page.goto('/calendar');
  await ready(page);
  const card = page.getByTestId('semester-card');
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: 'Set semester dates' })).toBeVisible();

  // put away for this week: the card goes, a quiet line stays, and it is still gone after a reload
  await card.getByRole('button', { name: 'Hide for this week' }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByTestId('semester-line')).toContainText('Semester dates are not set');
  await page.reload();
  await ready(page);
  await expect(page.getByTestId('semester-card')).toHaveCount(0);

  // setting the dates leaves only "Semester: ... Change"
  await page.getByTestId('semester-line').getByRole('button', { name: 'Set semester dates' }).click();
  const form = page.getByRole('dialog', { name: 'Semester dates' });
  await form.getByLabel('First day').fill(plus(-30));
  await form.getByLabel('Last day').fill(plus(60));
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('semester-card')).toHaveCount(0);
  await expect(page.getByTestId('semester-line')).toContainText('Semester:');
  await expect(page.getByTestId('semester-line').getByRole('button', { name: 'Change semester dates' })).toBeVisible();
});

test('the key is plain dots and words in two groups, and a finished deadline is grey, never green', async ({ page }) => {
  await page.goto('/calendar');
  await ready(page);
  await page.evaluate(
    ([done, open]) => {
      const s = (window as unknown as W).__store.getState();
      s.addSession({ title: 'Lecture', course: 'X 1', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', type: 'lecture' });
      s.addAssignment({ title: 'Finished', course: 'X 1', dueDate: done, priority: 'low', status: 'completed', progress: 100, kind: 'assignment' });
      s.addAssignment({ title: 'Still to do', course: 'X 1', dueDate: open, priority: 'low', status: 'pending', progress: 0, kind: 'reading' });
    },
    [plus(1), plus(1)] as const
  );
  const key = page.getByTestId('legend');
  await expect(key).toContainText('Classes');
  await expect(key).toContainText('Deadlines');
  for (const label of ['Lecture', 'Lab', 'Study', 'Review', 'Exam', 'Assignment', 'Test', 'Reading', 'Project', 'Done']) await expect(key).toContainText(label);
  // no boxed chips in the key
  await expect(key.getByTestId('kind-badge')).toHaveCount(0);

  await page.getByRole('button', { name: 'month', exact: true }).click();
  const cell = page.locator(`[data-date="${plus(1)}"]`);
  await expect(cell).toBeVisible();
  const dots = await cell.locator('span[title]').evaluateAll((els) =>
    els.map((el) => ({ title: el.getAttribute('title'), cls: (el.firstElementChild as HTMLElement | null)?.className ?? '' }))
  );
  const done = dots.find((d) => d.title === '1 Done');
  const reading = dots.find((d) => d.title === '1 Reading');
  expect(done, 'a grey mark for the finished deadline').toBeTruthy();
  expect(done!.cls).toContain('bg-zinc-300');
  expect(done!.cls).not.toContain('emerald');
  expect(reading!.cls).toContain('bg-cyan');
});

test('a long note shows about four lines and fades, and cards in a row stay equal height', async ({ page }) => {
  await page.goto('/notes');
  await ready(page);
  const long = Array.from({ length: 40 }, (_, i) => `Line ${i + 1}: contract law notes about offer and acceptance.`).join('\n');
  await page.evaluate((body) => {
    const s = (window as unknown as W).__store.getState();
    s.addNote({ title: 'Long one', body, course: 'LAW 101', pinned: false });
    s.addNote({ title: 'Short one', body: 'Just this.', course: 'LAW 101', pinned: false });
  }, long);
  const previews = page.getByTestId('note-preview');
  await expect(previews).toHaveCount(2);
  const longPreview = previews.filter({ hasText: 'Line 1:' });
  await expect(longPreview).toHaveAttribute('data-clamped', 'true');
  expect((await longPreview.boundingBox())!.height).toBeLessThan(100);
  const cards = page.locator('ul > li').filter({ has: page.getByTestId('note-preview') });
  const [a, b] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
  expect(Math.abs(a!.height - b!.height)).toBeLessThan(2);
});

test('the top bar is not an empty strip: the page name is always there, and search sits beside it on wide screens', async ({ page }) => {
  await page.goto('/notes');
  await ready(page);
  const header = page.locator('header').first();
  await expect(header).toContainText('Notes');
  const search = header.getByRole('button', { name: /Search assignments/ });
  await expect(search).toBeVisible();
  const [t, s] = await Promise.all([header.getByText('Notes', { exact: true }).boundingBox(), search.boundingBox()]);
  expect(s!.x - (t!.x + t!.width)).toBeLessThan(80); // search starts right after the title, not at the far side
});

test('on a phone the week shows one day, picked from a strip, and Add block stays in reach', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('/calendar');
  await ready(page);
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.addSession({ title: 'Monday class', course: 'X 1', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', type: 'lecture' });
    s.addSession({ title: 'Tuesday class', course: 'X 1', dayOfWeek: 2, startTime: '09:00', endTime: '10:00', type: 'lab' });
  });
  const strip = page.getByTestId('day-strip');
  await expect(strip).toBeVisible();
  await strip.getByRole('button', { name: /^Mon / }).click();
  await expect(page.getByText('Monday class')).toBeVisible();
  await expect(page.getByText('Tuesday class')).toHaveCount(0);
  await strip.getByRole('button', { name: /^Tue / }).click();
  await expect(page.getByText('Tuesday class')).toBeVisible();
  await expect(page.getByText('Monday class')).toHaveCount(0);
  const add = page.getByRole('button', { name: 'Add block' }).first();
  const box = await add.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(812);
  expect(box!.y).toBeGreaterThan(400); // fixed near the bottom, above the navigation
  await context.close();
});
