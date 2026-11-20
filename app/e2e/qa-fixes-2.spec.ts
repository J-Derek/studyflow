import { expect, test, type Page } from '@playwright/test';

/** Fixes from the second QA sweep: long course names on a phone, the Add course dialog, tap sizes, focus, copy, duplicates and page titles. */
type S = {
  userId: string | null;
  addAssignment: (a: object) => void;
  addCourseGrade: (c: object) => void;
};
type W = { __store: { getState: () => S } };

const ready = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
const course = (code: string, name: string, scores: (number | undefined)[] = []) => ({
  courseCode: code,
  courseName: name,
  credits: 3,
  targetLetter: 'A',
  color: '#4F46E5',
  assessments: [0, 1, 2].map((i) => ({ id: `${code}-${i}`, name: `Part ${i + 1}`, weight: i === 2 ? 40 : 30, score: scores[i] }))
});
const asg = (title: string, course = 'X 1') => ({ title, course, dueDate: '2030-01-15', priority: 'low', status: 'pending', progress: 0 });

test('on a phone a very long course name stays inside the filter card and the list row', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('/assignments');
  await ready(page);
  const longName = 'Introduction to Entrepreneurship Development and Small Business Management 101';
  await page.evaluate(([a]) => (window as unknown as W).__store.getState().addAssignment(a as object), [asg('Write the business plan summary', longName)]);
  const row = page.getByRole('group', { name: /Write the business plan summary/ });
  await expect(row).toBeVisible();

  const select = page.getByLabel('Filter by course');
  const box = await select.boundingBox();
  const card = await select.evaluate((el) => {
    let n: HTMLElement | null = el.parentElement;
    while (n && getComputedStyle(n).borderTopWidth === '0px') n = n.parentElement;
    const r = n!.getBoundingClientRect();
    return { left: r.left, right: r.right };
  });
  expect(box!.x + box!.width, 'select right edge').toBeLessThanOrEqual(card.right + 0.5);

  const rowBox = await row.boundingBox();
  for (const child of await row.locator('span, button').all()) {
    const b = await child.boundingBox();
    if (!b || b.width === 0) continue;
    expect(b.x + b.width, 'nothing in the row passes its right edge').toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 0.5);
  }
  // the title keeps a readable width instead of a sliver
  const title = row.getByText('Write the business plan summary');
  expect((await title.boundingBox())!.width).toBeGreaterThan(150);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});

test('Add course is a real dialog: labelled, Esc closes it, focus stays inside and returns', async ({ page }) => {
  await page.goto('/courses');
  await ready(page);
  const opener = page.getByRole('button', { name: /Add course/i }).first();
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Add a course' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  // Tab never leaves the dialog
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('the same course code again (any capitals, extra spaces) is refused with a message', async ({ page }) => {
  await page.goto('/courses');
  await ready(page);
  await page.evaluate(([c]) => (window as unknown as W).__store.getState().addCourseGrade(c as object), [course('LAW 101', 'Contract law')]);
  await page.getByRole('button', { name: /Add course/i }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add a course' });
  await dialog.getByPlaceholder('e.g. CS 240').fill('  law   101 ');
  await dialog.getByPlaceholder('e.g. Advanced Operating Systems').fill('Another name');
  await expect(dialog.getByRole('alert')).toHaveText('You already have a course with this code.');
  await dialog.getByRole('button', { name: 'Add Course' }).click();
  await expect(dialog).toBeVisible(); // not added
  await dialog.getByPlaceholder('e.g. CS 240').fill('LAW 102');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Add Course' }).click();
  await expect(dialog).toHaveCount(0);
});

test('a score of 69.96 is shown as 70.0% and is banded A, the same figure the student sees', async ({ page }) => {
  await page.goto('/courses');
  await ready(page);
  await page.evaluate(([c]) => (window as unknown as W).__store.getState().addCourseGrade(c as object), [course('MAT 101', 'Calculus', [69.96, 69.96, 69.96])]);
  await expect(page.getByText('70.0%').first()).toBeVisible();
  await expect(page.getByText('Upper Second')).toHaveCount(0);
  await expect(page.getByText('4.00', { exact: true }).first()).toBeVisible();
});

test('the GPA is a dash while the standing says there is not enough graded work, and Today says Courses', async ({ page }) => {
  await page.goto('/courses');
  await ready(page);
  await page.evaluate(([c]) => (window as unknown as W).__store.getState().addCourseGrade(c as object), [course('ENG 101', 'English', [80, 60])]);
  await expect(page.getByText('Not enough graded work yet').first()).toBeVisible();
  await expect(page.getByText('4.00', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Projected GPA')).toBeVisible();
});

test('Today points to Courses, the name of the tab', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(([c]) => (window as unknown as W).__store.getState().addCourseGrade(c as object), [course('BIO 101', 'Biology')]);
  await expect(page.getByText('Add graded work in Courses')).toBeVisible();
  await expect(page.getByText('Add graded work in Grades')).toHaveCount(0);
});

test('timer lengths: a blank box keeps the saved length and says so; one minute reads "1 minute"', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await page.getByText('Change timer lengths').click();
  await page.getByLabel('Focus', { exact: true }).fill('');
  await expect(page.getByText('Focus is empty, so it stays at 25 minutes.')).toBeVisible();
  await page.getByLabel('Focus', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Focus ready, 1 minute' })).toHaveCount(1);
  await expect(page.getByText('1 minutes')).toHaveCount(0);
});

test('Assignments counts read "1 of 1 assignment"', async ({ page }) => {
  await page.goto('/assignments');
  await ready(page);
  await page.evaluate(([a]) => (window as unknown as W).__store.getState().addAssignment(a as object), [asg('Solo')]);
  await expect(page.getByText('1 of 1 assignment', { exact: true })).toBeVisible();
});

test('each page sets its own browser title, and an assignment page uses the assignment title', async ({ page }) => {
  await page.goto('/assignments');
  await ready(page);
  await expect(page).toHaveTitle('Assignments · StudyFlow');
  await page.goto('/timer');
  await expect(page).toHaveTitle('Focus timer · StudyFlow');
  await page.goto('/courses');
  await expect(page).toHaveTitle('Courses · StudyFlow');
  await page.goto('/nope');
  await expect(page).toHaveTitle('Page not found · StudyFlow');
  await page.goto('/assignments');
  await ready(page);
  await page.evaluate(([a]) => (window as unknown as W).__store.getState().addAssignment(a as object), [asg('Lab report')]);
  await page.getByRole('group', { name: /Lab report/ }).getByText('X 1').click();
  await expect(page).toHaveTitle('Lab report · StudyFlow');
});

test('closing full screen with Esc puts focus back on the Full screen button', async ({ page }) => {
  await page.goto('/assignments');
  await ready(page);
  await page.evaluate(([a]) => (window as unknown as W).__store.getState().addAssignment(a as object), [asg('Essay')]);
  await page.getByRole('group', { name: /Essay/ }).getByText('X 1').click();
  await page.getByRole('button', { name: 'Full screen' }).click();
  await expect(page.getByTestId('writing-space')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('writing-space')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Full screen' })).toBeFocused();
});

test('on a phone the modal Close buttons and modal buttons are at least 44px', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('/assignments');
  await ready(page);
  const big = async (loc: ReturnType<Page['locator']>, what: string) => {
    const b = await loc.boundingBox();
    expect(b, what).not.toBeNull();
    expect(b!.height, `${what} height`).toBeGreaterThanOrEqual(43.5);
    expect(b!.width, `${what} width`).toBeGreaterThanOrEqual(43.5);
  };
  await page.evaluate(([a]) => (window as unknown as W).__store.getState().addAssignment(a as object), [asg('Edit me')]);
  await page.getByRole('button', { name: /Edit assignment "Edit me"/ }).click();
  const dlg = page.getByRole('dialog');
  await big(dlg.getByRole('button', { name: 'Close' }), 'assignment modal Close');
  await big(dlg.getByRole('button', { name: 'Cancel' }), 'assignment modal Cancel');
  await big(dlg.getByRole('button', { name: 'Save changes' }), 'assignment modal Save');
  await big(dlg.getByRole('button', { name: 'high', exact: true }), 'priority');
  await page.keyboard.press('Escape');

  await page.goto('/calendar');
  await ready(page);
  await page.getByRole('button', { name: /^Add (a )?(block|class|session)/i }).first().click();
  const block = page.getByRole('dialog');
  await big(block.getByRole('button', { name: 'Close modal' }), 'block modal Close');
  await big(block.getByRole('button', { name: 'Cancel' }), 'block modal Cancel');
  await context.close();
});
