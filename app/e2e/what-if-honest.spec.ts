import { expect, test, type Page } from '@playwright/test';

/** The what-if calculator says what its number covers, can try a failing score, and a score above 100 is explained. */
type S = { userId: string | null; addCourseGrade: (c: unknown) => void };
type W = { __store: { getState: () => S } };

async function setup(page: Page): Promise<void> {
  await page.goto('/grades');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addCourseGrade({
      courseCode: 'LAW 101', courseName: 'Intro to Law', credits: 3, targetLetter: 'A', color: '#4F46E5',
      assessments: [
        { id: 'a1', name: 'Midterm exam', weight: 30 },
        { id: 'a2', name: 'Coursework', weight: 30 },
        { id: 'a3', name: 'Final exam', weight: 40 }
      ]
    })
  );
}

test('with no scores yet, the projection says how much of the course it covers', async ({ page }) => {
  await setup(page);
  const basis = page.getByTestId('what-if-basis');
  await expect(basis).toContainText('Counts the 30% of the course');
  await expect(basis).toContainText('The other 70% has no score yet and is not in this number.');
  await expect(page.getByText('Projected Course Grade')).toHaveCount(0);
});

test('the slider can try a failing score', async ({ page }) => {
  await setup(page);
  const slider = page.getByRole('slider', { name: /Score on the next assessment/ });
  await expect(slider).toHaveAttribute('min', '0');
  await slider.fill('0');
  await expect(page.getByText('If you score 0%')).toBeVisible();
  await expect(page.getByText('0.0%', { exact: true }).first()).toBeVisible();
});

test('a score above 100 is held at 100 and the student is told', async ({ page }) => {
  await setup(page);
  const box = page.getByLabel('Score for Midterm exam, percent');
  await box.fill('150');
  await expect(page.getByTestId('score-range-note')).toHaveText('Scores go from 0 to 100, so Midterm exam was set to 100.');
  await expect(box).toHaveValue('100');
  await box.fill('80');
  await expect(page.getByTestId('score-range-note')).toHaveCount(0);
});
