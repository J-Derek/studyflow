import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** The month view names busy days' exams on bigger screens, shades busy days, sums the month up, and downloads just that month. */
type S = { userId: string | null; addAssignment: (a: object) => void; addSession: (s: object) => void; setTheme: (t: 'light' | 'dark') => void };
type W = { __store: { getState: () => S } };

const pad = (n: number) => String(n).padStart(2, '0');
const first = new Date();
const Y = first.getFullYear();
const M = first.getMonth() + 1;
const day = (d: number) => `${Y}-${pad(M)}-${pad(d)}`;
const lastDay = new Date(Y, M, 0).getDate();

async function setup(page: Page): Promise<void> {
  await page.goto('/calendar');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.evaluate(
    ([a, b, c]) => {
      const s = (window as unknown as W).__store.getState();
      const add = (title: string, kind: string, dueDate: string) => s.addAssignment({ title, kind, course: 'CS 301', dueDate, priority: 'high', status: 'pending', progress: 0 });
      add('Algorithms final', 'exam', a);
      add('Physics CAT', 'test', a);
      add('Group project demo', 'project', a);
      add('Essay draft', 'assignment', b);
      s.addSession({ title: 'Data Structures', course: 'CS 301', dayOfWeek: 1, startTime: '10:00', endTime: '11:00', type: 'lecture' });
      s.addAssignment({ title: 'Other month thing', course: 'X', dueDate: c, priority: 'low', status: 'pending', progress: 0 });
    },
    [day(Math.min(10, lastDay)), day(Math.min(12, lastDay)), `${M === 12 ? Y + 1 : Y}-${pad(M === 12 ? 1 : M + 1)}-05`] as const
  );
  await page.getByRole('button', { name: 'month', exact: true }).click();
  await expect(page.getByTestId('month-grid')).toBeVisible();
}

test('on a big screen a busy day names its exams, tests and projects, and the month is summed up', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setup(page);
  const busy = page.locator(`[data-date="${day(Math.min(10, lastDay))}"]`);
  await expect(busy).toContainText('Algorithms final'); // exam first, then test, then project
  await expect(busy).toContainText('Physics CAT');
  await expect(busy).not.toContainText('Group project demo');
  await expect(busy).toContainText('+1 more');
  await expect(busy).toHaveAccessibleName(/3 deadlines/);
  await expect(page.getByTestId('month-summary')).toContainText('4 of 4 deadlines still to do: 1 exam, 1 test, 1 project');
  await expect(page.getByTestId('month-summary')).toContainText('Busiest day');
});

test('Download this month gives a calendar file for that month only', async ({ page }) => {
  await setup(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download this month' }).click()]);
  expect(download.suggestedFilename()).toBe(`StudyFlow_${Y}-${pad(M)}.ics`);
  const ics = readFileSync((await download.path())!, 'utf8');
  expect(ics).toContain('BEGIN:VCALENDAR');
  expect(ics).toContain('Due: Algorithms final');
  expect(ics).toContain('Due: Essay draft');
  expect(ics).toContain('Data Structures');
  expect(ics).not.toContain('Other month thing');
});

for (const [label, width, height] of [['desktop', 1280, 900], ['phone', 375, 740]] as const) {
  test(`${label}: the livelier month has no accessibility problems in light or dark, and does not scroll sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await setup(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(axe.violations.map((v) => `${theme} ${v.id}: ${v.nodes.map((n) => n.html.slice(0, 100)).join(' | ')}`)).toEqual([]);
    }
    for (const b of (await page.getByTestId('month-summary').locator('button').all())) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
}
