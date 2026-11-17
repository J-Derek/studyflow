import { expect, test, type Page } from '@playwright/test';

/** Exams and reviews happen once, on a date; lectures, labs and study blocks repeat weekly, but only inside the semester dates. */
type Ses = { id: string; title: string; type: string; dayOfWeek: number; date?: string };
type S = {
  userId: string | null;
  sessions: Ses[];
  user: { semesterStart?: string; semesterEnd?: string };
  addSession: (s: object) => void;
  updateUser: (u: object) => void;
};
type W = { __store: { getState: () => S } };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};
/** The Monday of this week, as the timetable counts weeks (Sunday belongs to the week before). */
const monday = () => {
  const d = new Date();
  const dow = d.getDay();
  return plus(dow === 0 ? -6 : 1 - dow);
};
const fromMonday = (days: number) => {
  const d = monday();
  d.setDate(d.getDate() + days);
  return d;
};

async function ready(page: Page, path = '/calendar'): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
}
const state = (page: Page) => page.evaluate(() => (window as unknown as W).__store.getState().sessions);
const block = (page: Page, title: string) => page.getByRole('button', { name: new RegExp(`Edit .*${title}`) });

test('an exam takes a date instead of a weekday, and shows only in its own week', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Add Block' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add a block' });
  await dialog.getByPlaceholder('e.g. Distributed Systems Lab').fill('Algorithms final');
  await expect(dialog.getByLabel('Day of the week')).toBeVisible();

  await dialog.getByLabel('Block type').selectOption('exam');
  await expect(dialog.getByLabel('Day of the week')).toHaveCount(0);
  await expect(dialog.getByText('Exams and reviews happen once, on this date.')).toBeVisible();
  // next week's Wednesday
  const examDate = iso(fromMonday(9));
  await dialog.getByLabel('Date', { exact: true }).fill(examDate);
  await dialog.getByRole('button', { name: 'Add Block' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const saved = await state(page);
  expect(saved.map((s) => [s.title, s.type, s.date, s.dayOfWeek])).toEqual([['Algorithms final', 'exam', examDate, 3]]);

  await expect(block(page, 'Algorithms final')).toHaveCount(0); // not this week
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(block(page, 'Algorithms final')).toHaveCount(1);
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(block(page, 'Algorithms final')).toHaveCount(0); // and not the week after
});

test('choosing a lecture again brings back the weekday, and a review is one-off too', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Add Block' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add a block' });
  await dialog.getByLabel('Block type').selectOption('review');
  await expect(dialog.getByLabel('Date', { exact: true })).toBeVisible();
  await dialog.getByLabel('Block type').selectOption('lecture');
  await expect(dialog.getByLabel('Date', { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('Day of the week')).toBeVisible();
});

test('the month view shows a dated exam on its day only, and an old exam without a date stays weekly', async ({ page }) => {
  await ready(page);
  const examDate = iso(fromMonday(2)); // this week's Wednesday
  await page.evaluate((d) => {
    const s = (window as unknown as W).__store.getState();
    s.addSession({ title: 'Algorithms final', course: 'CS 301', dayOfWeek: 3, date: d, startTime: '09:00', endTime: '12:00', type: 'exam' });
    s.addSession({ title: 'Old midterm', course: 'MAT 101', dayOfWeek: 5, startTime: '09:00', endTime: '10:00', type: 'exam' });
  }, examDate);

  await expect(block(page, 'Algorithms final')).toHaveCount(1);
  await expect(block(page, 'Old midterm')).toHaveCount(1);
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(block(page, 'Algorithms final')).toHaveCount(0);
  await expect(block(page, 'Old midterm')).toHaveCount(1);

  await page.getByRole('button', { name: /^month$/i }).click();
  const target = new Date(fromMonday(2));
  // show the month that holds the exam
  const now = new Date();
  const step = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
  for (let i = 0; i < Math.abs(step); i++) await page.getByRole('button', { name: step < 0 ? 'Previous month' : 'Next month' }).click();
  await expect(page.locator(`[data-date="${examDate}"]`)).toHaveAccessibleName(/, 1 class,/);
  const weekLater = new Date(target);
  weekLater.setDate(weekLater.getDate() + 7);
  if (weekLater.getMonth() === target.getMonth()) {
    await expect(page.locator(`[data-date="${iso(weekLater)}"]`)).not.toHaveAccessibleName(/class/);
  }
});

test('an exam only warns about a clash with classes that meet that day', async ({ page }) => {
  await ready(page);
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addSession({ title: 'Distributed Systems', course: 'ACS443', dayOfWeek: 3, startTime: '10:00', endTime: '11:30', type: 'lecture' })
  );
  await page.getByRole('button', { name: 'Add Block' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add a block' });
  await dialog.getByPlaceholder('e.g. Distributed Systems Lab').fill('Calculus exam');
  await dialog.getByLabel('Block type').selectOption('exam');
  await dialog.getByLabel('Date', { exact: true }).fill(iso(fromMonday(3))); // a Thursday
  await expect(dialog.getByRole('status')).toHaveCount(0);
  await dialog.getByLabel('Date', { exact: true }).fill(iso(fromMonday(9))); // next Wednesday
  await expect(dialog.getByRole('status')).toContainText('clashes with Distributed Systems');

  // once the semester has ended before that Wednesday, the lecture no longer meets, so no clash
  await page.evaluate((end) => (window as unknown as W).__store.getState().updateUser({ semesterEnd: end }), iso(fromMonday(6)));
  await expect(dialog.getByRole('status')).toHaveCount(0);
});

test('semester dates: asked once on the Timetable, and weekly classes stop outside them', async ({ page }) => {
  await ready(page);
  await page.evaluate(
    ([dow, examDate]) => {
      const s = (window as unknown as W).__store.getState();
      s.addSession({ title: 'Data Structures', course: 'CS 301', dayOfWeek: dow, startTime: '10:00', endTime: '11:00', type: 'lecture' });
      s.addSession({ title: 'Algorithms final', course: 'CS 301', dayOfWeek: 3, date: examDate, startTime: '09:00', endTime: '12:00', type: 'exam' });
    },
    [new Date().getDay(), iso(fromMonday(9))] as const
  );
  await expect(block(page, 'Data Structures')).toHaveCount(1);

  await page.getByRole('button', { name: 'Set semester dates' }).click();
  const form = page.getByRole('dialog', { name: 'Semester dates' });
  await form.getByLabel('First day').fill(iso(fromMonday(-14)));
  await form.getByLabel('Last day').fill(iso(fromMonday(6))); // ends this Sunday
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Set semester dates' })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as W).__store.getState().user))
    .toMatchObject({ semesterStart: iso(fromMonday(-14)), semesterEnd: iso(fromMonday(6)) });

  // this week still has the class; next week is after the semester, but the dated exam is still there
  await expect(block(page, 'Data Structures')).toHaveCount(1);
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(block(page, 'Data Structures')).toHaveCount(0);
  await expect(block(page, 'Algorithms final')).toHaveCount(1);
  await expect(page.getByText(/Outside your semester/)).toBeVisible();

  // the dates are kept after a reload
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect(page.getByRole('button', { name: 'Set semester dates' })).toHaveCount(0);
});

test('Today leaves out classes once the semester is over, but shows an exam dated today', async ({ page }) => {
  await ready(page, '/');
  await page.evaluate(
    ([dow, today, yesterday]) => {
      const s = (window as unknown as W).__store.getState();
      s.addSession({ title: 'Data Structures', course: 'CS 301', dayOfWeek: dow, startTime: '10:00', endTime: '11:00', type: 'lecture' });
      s.addSession({ title: 'Algorithms final', course: 'CS 301', dayOfWeek: dow, date: today, startTime: '14:00', endTime: '16:00', type: 'exam' });
      s.addSession({ title: 'Last week review', course: 'CS 301', dayOfWeek: dow, date: yesterday, startTime: '08:00', endTime: '09:00', type: 'review' });
      s.updateUser({ semesterStart: '2020-01-06', semesterEnd: yesterday });
    },
    [new Date().getDay(), iso(new Date()), iso(plus(-7))] as const
  );
  await expect(page.getByText('Algorithms final')).toBeVisible();
  await expect(page.getByText('Data Structures')).toHaveCount(0);
  await expect(page.getByText('Last week review')).toHaveCount(0);
  await expect(page.getByText(/1 class today/)).toBeVisible();
});
