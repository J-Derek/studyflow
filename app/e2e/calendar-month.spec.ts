import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** PR7: week and month views, deadlines on the timetable, tap a day, quick add. */
type S = {
  userId: string | null;
  addAssignment: (a: object) => void;
  addSession: (s: object) => void;
  setTheme: (t: 'light' | 'dark') => void;
};
type W = { __store: { getState: () => S } };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

async function setup(page: Page): Promise<void> {
  await page.goto('/calendar');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  const today = iso(new Date());
  const later = iso(plus(2));
  await page.evaluate(
    ([t, l, dow]) => {
      const s = (window as unknown as W).__store.getState();
      s.addAssignment({ title: 'Algorithms final', kind: 'exam', course: 'CS 301', dueDate: t, priority: 'high', status: 'pending', progress: 0 });
      s.addAssignment({ title: 'Read chapter 4', kind: 'reading', course: 'LAW 101', dueDate: l, priority: 'low', status: 'pending', progress: 0 });
      s.addSession({ title: 'Data Structures', course: 'CS 301', dayOfWeek: dow, startTime: '10:00', endTime: '11:00', type: 'lecture' });
    },
    [today, later, new Date().getDay()] as const
  );
}

const cell = (page: Page, d: Date) => page.locator(`[data-date="${iso(d)}"]`);

test('the week view shows each day\'s deadlines, and a due-soon strip lists what is next', async ({ page }) => {
  await setup(page);
  const todayDeadlines = page.getByTestId('week-deadlines').filter({ hasText: 'Algorithms final' });
  await expect(todayDeadlines).toHaveCount(1);
  await expect(todayDeadlines).toContainText('Exam');
  await expect(page.getByTestId('due-soon')).toContainText('Algorithms final');
  await expect(page.getByTestId('due-soon')).toContainText('Read chapter 4');
  await page.getByTestId('week-deadlines').getByRole('button', { name: /Algorithms final/ }).click();
  await expect(page.getByRole('dialog').getByText('Edit Assignment')).toBeVisible();
});

test('the month view marks today, counts classes and deadlines, steps between months, and keeps Week one tap away', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'month', exact: true }).click();
  await expect(page.getByRole('button', { name: 'month', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const grid = page.getByTestId('month-grid');
  await expect(grid).toBeVisible();

  const now = new Date();
  const label = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  await expect(page.getByTestId('month-label')).toHaveText(label);

  const todayCell = page.locator('[aria-current="date"]');
  await expect(todayCell).toHaveCount(1);
  await expect(todayCell).toHaveAccessibleName(/1 class.*1 deadline/);
  // a weekday with no class and nothing due says so
  const quiet = plus(1);
  if (quiet.getDay() !== now.getDay() && iso(quiet) !== iso(plus(2))) await expect(cell(page, quiet)).toHaveAccessibleName(/nothing planned/);

  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByTestId('month-label')).not.toHaveText(label);
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByTestId('month-label')).toHaveText(label);

  await page.getByRole('button', { name: 'week', exact: true }).click();
  await expect(grid).toHaveCount(0);
  await expect(page.getByTestId('week-deadlines').first()).toBeVisible();
});

test('tapping a day lists its classes and deadlines, and a deadline can be added to that day', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'month', exact: true }).click();
  await page.locator('[aria-current="date"]').click();
  const sheet = page.getByTestId('day-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('region', { name: 'Deadlines' })).toContainText('Algorithms final');
  await expect(sheet.getByRole('region', { name: 'Classes' })).toContainText('Data Structures');

  // add a deadline for the day after tomorrow's cell
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  const target = plus(3);
  await cell(page, target).click();
  await sheet.getByRole('button', { name: 'Add a deadline for this day' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('input[type=date]')).toHaveValue(iso(target));
  await dialog.getByPlaceholder('e.g. Problem Set 2').fill('CAT 2');
  await dialog.getByPlaceholder('e.g. CS 101 or Physics').fill('ACS 443');
  await dialog.locator('label').filter({ hasText: /^Test$/ }).click();
  await dialog.getByRole('button', { name: 'Add assignment' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(cell(page, target)).toHaveAccessibleName(/1 deadline/);

  await cell(page, target).click();
  await expect(sheet.getByRole('region', { name: 'Deadlines' })).toContainText('CAT 2');
  await expect(sheet.getByRole('region', { name: 'Deadlines' })).toContainText('Test');
});

test('on a phone: day buttons are at least 44px, the day sheet fits, and there are no accessibility problems in light or dark', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await setup(page);
  await page.getByRole('button', { name: 'month', exact: true }).click();
  const buttons = page.getByTestId('month-grid').locator('button');
  expect(await buttons.count()).toBeGreaterThanOrEqual(28);
  for (const b of (await buttons.all()).slice(0, 10)) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // no sideways scrolling on a phone
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
    await page.waitForTimeout(300);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${theme} ${v.id}: ${v.nodes.map((n) => n.html.slice(0, 90)).join(' | ')}`)).toEqual([]);
  }

  await page.locator('[aria-current="date"]').click();
  const sheet = page.getByTestId('day-sheet');
  const box = (await sheet.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(box.y + box.height).toBeLessThanOrEqual(740);
  for (const b of await sheet.locator('button').all()) expect((await b.boundingBox())!.height, await b.innerText()).toBeGreaterThanOrEqual(44);
  const axe = await new AxeBuilder({ page }).include('[data-testid="day-sheet"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});
