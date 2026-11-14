import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Item 4: the student's grading scale decides how grades are worded: letters and GPA, percentages, UK classes or Kenyan classes. */
type S = {
  userId: string | null;
  user: { gradingScale?: string };
  updateUser: (u: object) => void;
  addCourseGrade: (c: object) => void;
};
type W = { __store: { getState: () => S } };

async function ready(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
}
async function seed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.addCourseGrade({ courseCode: 'CS 301', courseName: 'Algorithms', credits: 3, targetLetter: 'A', color: '#4F46E5', assessments: [{ id: 'm', name: 'Midterm', weight: 40, score: 80 }, { id: 'f', name: 'Final', weight: 60 }] });
    s.addCourseGrade({ courseCode: 'LAW 101', courseName: 'Contracts', credits: 3, targetLetter: 'B', color: '#0EA5E9', assessments: [{ id: 'x', name: 'Exam', weight: 100, score: 58 }] });
  });
}
const setScale = (page: Page, gradingScale: string) => page.evaluate((g) => (window as unknown as W).__store.getState().updateUser({ gradingScale: g }), gradingScale);

test('letters and GPA are unchanged until a scale is chosen', async ({ page }) => {
  await ready(page, '/');
  await seed(page);
  await expect(page.getByText('Projected GPA').first()).toBeVisible();
  await expect(page.getByText('Average so far')).toHaveCount(0);
  await page.goto('/grades');
  await expect(page.getByText('out of 4.00')).toBeVisible();
});

test('Kenyan classes: the average, the class and the course grades are worded that way, and it survives a reload', async ({ page }) => {
  await ready(page, '/');
  await seed(page);
  // (80 x 3 + 58 x 3) / 6 = 69.0
  await setScale(page, 'ke');
  await expect(page.getByText('Average so far').first()).toBeVisible();
  await expect(page.getByText('69.0%').first()).toBeVisible();
  await expect(page.getByText('Projected: Second Class Honours (Upper)').first()).toBeVisible();
  await expect(page.getByText('Projected GPA')).toHaveCount(0);

  await page.goto('/grades');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect(page.getByText('weighted average')).toBeVisible();
  await expect(page.getByText('First Class Honours').first()).toBeVisible(); // CS 301 at 80
  await expect(page.getByText('Second Class Honours (Lower)').first()).toBeVisible(); // LAW 101 at 58
  expect(((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations)).toEqual([]);

  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__store.getState().user.gradingScale)).toBe('ke');
});

test('UK classes and percentages only', async ({ page }) => {
  await ready(page, '/');
  await seed(page);
  await setScale(page, 'uk');
  await expect(page.getByText('Projected: 2:1').first()).toBeVisible();
  await setScale(page, 'pct');
  await expect(page.getByText('69.0%').first()).toBeVisible();
  await expect(page.getByText('weighted average').first()).toBeVisible();
  await expect(page.getByText('Projected: ')).toHaveCount(0);
});
