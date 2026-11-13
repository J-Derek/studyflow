import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Item 2: a "Busy week" note on Today and the Timetable when 3 or more exams, tests or projects fall within 7 days. */
type W = { __store: { getState: () => { userId: string | null; addAssignment: (a: object) => void } } };

const iso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function add(page: Page, items: Array<[string, string, number]>): Promise<void> {
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.evaluate(
    (list) => {
      const s = (window as unknown as W).__store.getState();
      for (const [title, kind, dueDate] of list as unknown as Array<[string, string, string]>) {
        s.addAssignment({ title, kind, course: 'CS 301', dueDate, priority: 'high', status: 'pending', progress: 0 });
      }
    },
    items.map(([t, k, d]) => [t, k, iso(d)])
  );
}

test('Today and the Timetable warn about a week with three exams, tests or projects', async ({ page }) => {
  await page.goto('/');
  await add(page, [['Calculus final', 'exam', 3], ['Physics CAT', 'test', 4], ['Group project', 'project', 6], ['Read ch 2', 'reading', 4]]);
  await expect(page.getByTestId('busy-week')).toContainText(/Busy week: 1 exam, 1 test, 1 project/);
  expect(((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations)).toEqual([]);
  await page.goto('/calendar');
  await expect(page.getByTestId('busy-week')).toContainText(/Busy week: 1 exam, 1 test, 1 project/);
});

test('no warning for two exams or for ordinary assignments', async ({ page }) => {
  await page.goto('/');
  await add(page, [['Calculus final', 'exam', 3], ['Physics CAT', 'test', 4], ['Essay', 'assignment', 5], ['Problem set', 'assignment', 5]]);
  await expect(page.getByText('Calculus final').first()).toBeVisible();
  await expect(page.getByTestId('busy-week')).toHaveCount(0);
});
