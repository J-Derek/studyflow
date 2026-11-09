import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** PR8: Grades became Courses: a list of courses with their work, classes, notes and grade; the old address still works; still six links. */
type S = {
  userId: string | null;
  addAssignment: (a: object) => void;
  addSession: (s: object) => void;
  addNote: (n: object) => string;
  addCourseGrade: (c: object) => void;
  setTheme: (t: 'light' | 'dark') => void;
};
type W = { __store: { getState: () => S } };

const ready = async (page: Page, path: string) => {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

async function seed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.addCourseGrade({
      courseCode: 'CS 301', courseName: 'Algorithms', credits: 3, targetLetter: 'A', color: '#4F46E5',
      assessments: [{ id: 'm', name: 'Midterm', weight: 40, score: 80 }, { id: 'f', name: 'Final', weight: 60 }]
    });
    s.addCourseGrade({ courseCode: 'LAW 101', courseName: 'Contracts', credits: 2, targetLetter: 'B', color: '#0EA5E9', assessments: [{ id: 'x', name: 'Exam', weight: 100 }] });
    s.addAssignment({ title: 'Problem set 2', course: 'cs 301', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 });
    s.addAssignment({ title: 'Final exam', kind: 'exam', course: 'CS 301 — Algorithms', dueDate: '2030-02-01', priority: 'high', status: 'pending', progress: 0 });
    s.addAssignment({ title: 'Contracts essay', course: 'LAW 101', dueDate: '2030-01-20', priority: 'low', status: 'pending', progress: 0 });
    s.addSession({ title: 'Algorithms lecture', course: 'CS 301', dayOfWeek: 2, startTime: '10:00', endTime: '11:30', type: 'lecture' });
    s.addNote({ title: 'Big-O cheat sheet', body: 'x', course: 'CS 301', pinned: false });
  });
}

test('the Courses page lists each course with what is still to do, and tapping one shows its work, classes, notes and grade', async ({ page }) => {
  await ready(page, '/courses');
  await seed(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Courses' })).toBeVisible();
  const card = page.locator('[data-course="CS 301"]');
  await expect(card).toContainText('2 to do');
  await expect(card).toContainText('1 class');
  await expect(card).toContainText('1 note');
  await expect(card).toContainText('80% so far');
  await expect(card).toContainText('Next: Problem set 2');
  await expect(page.locator('[data-course="LAW 101"]')).toContainText('1 to do');
  await expect(page.locator('[data-course="LAW 101"]')).toContainText('no grades yet');

  await card.click();
  const detail = page.getByTestId('course-detail');
  await expect(detail).toContainText('CS 301');
  await expect(detail.getByRole('region', { name: 'Work still to do' })).toContainText('Problem set 2');
  await expect(detail.getByRole('region', { name: 'Work still to do' })).toContainText('Final exam');
  await expect(detail.getByRole('region', { name: 'Work still to do' })).not.toContainText('Contracts essay');
  await expect(detail.getByRole('region', { name: 'Classes' })).toContainText('Tuesday 10:00 - 11:30');
  await expect(detail.getByRole('region', { name: 'Notes' })).toContainText('Big-O cheat sheet');
  await detail.getByRole('button', { name: 'All courses' }).click();
  await expect(page.getByTestId('course-list')).toBeVisible();
  // the grades calculator is still there below the list
  await expect(page.getByRole('heading', { name: 'Grades and GPA' })).toBeVisible();
});

test('the old /grades address lands on Courses and the address bar shows /courses', async ({ page }) => {
  await ready(page, '/grades');
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Courses' })).toBeVisible();
  await expect(page.getByTestId('not-found')).toHaveCount(0);
});

test('the menus say Courses and there are still exactly six links in the bottom bar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await ready(page, '/');
  const bar = page.getByRole('navigation', { name: 'Mobile Navigation' });
  await expect(bar.getByRole('link')).toHaveCount(6);
  await expect(bar.getByRole('link', { name: /Courses/ })).toBeVisible();
  await expect(bar.getByRole('link', { name: /Grades/ })).toHaveCount(0);
  await bar.getByRole('link', { name: /Courses/ }).click();
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.locator('header')).toContainText('Courses');
});

test('on a phone and in dark mode: course cards are easy to tap and there are no accessibility problems', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await ready(page, '/courses');
  await seed(page);
  const cards = page.getByTestId('course-list').locator('button');
  await expect(cards).toHaveCount(2);
  for (let i = 0; i < 2; i++) await expect.poll(async () => (await cards.nth(i).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
    await page.waitForTimeout(300);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${theme} ${v.id}: ${v.nodes.map((n) => n.html.slice(0, 90)).join(' | ')}`)).toEqual([]);
  }
  await page.locator('[data-course="CS 301"]').click();
  const axe = await new AxeBuilder({ page }).include('[data-testid="course-detail"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test('course fields suggest the courses already in use', async ({ page }) => {
  await ready(page, '/assignments');
  await seed(page);
  const options = await page.locator('datalist#course-suggestions option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
  expect(options).toEqual(expect.arrayContaining(['CS 301', 'LAW 101']));
  expect(options.filter((o) => o.toLowerCase() === 'cs 301')).toHaveLength(1);
  await page.getByRole('button', { name: 'Add assignment' }).first().click();
  await expect(page.getByRole('dialog').getByPlaceholder('e.g. CS 101 or Physics')).toHaveAttribute('list', 'course-suggestions');
});
