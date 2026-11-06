import { expect, test } from '@playwright/test';

type S = { userId: string | null; addCourseGrade: (c: unknown) => void };

test('a student can change assessment names and weights, add and remove them', async ({ page }) => {
  await page.goto('/grades');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);
  await page.evaluate(() =>
    (window as unknown as { __store: { getState: () => S } }).__store.getState().addCourseGrade({
      courseCode: 'LAW 101', courseName: 'Intro to Law', credits: 3, targetLetter: 'A', color: '#4F46E5',
      assessments: [
        { id: 'a1', name: 'Midterm exam', weight: 30 },
        { id: 'a2', name: 'Coursework', weight: 30 },
        { id: 'a3', name: 'Final exam', weight: 40 }
      ]
    })
  );

  // a score entered first must survive the edit
  await page.getByLabel('Score for Midterm exam, percent').fill('80');

  await page.getByRole('button', { name: 'Edit grading' }).click();
  await page.getByLabel('Name of assessment 1').fill('CAT 1');
  await page.getByLabel('Weight of assessment 1, percent').fill('15');
  await page.getByLabel('Name of assessment 2').fill('Practical');
  await page.getByLabel('Name of assessment 3').fill('Final exam');
  await page.getByRole('button', { name: 'Add assessment' }).click();
  await page.getByLabel('Name of assessment 4').fill('CAT 2');
  await page.getByLabel('Weight of assessment 4, percent').fill('15');

  // 15 + 30 + 40 + 15
  await expect(page.getByRole('status').filter({ hasText: 'Adds up to' })).toHaveText('Adds up to 100%.');

  // removing one makes the total honest, not blocked
  await page.getByRole('button', { name: /Remove assessment 4/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Adds up to' })).toContainText('Adds up to 85%');
  await page.getByRole('button', { name: 'Add assessment' }).click();
  await page.getByLabel('Name of assessment 4').fill('CAT 2');
  await page.getByLabel('Weight of assessment 4, percent').fill('15');
  await page.getByRole('button', { name: 'Save grading' }).click();

  // shown in the course card, with the earlier score kept
  await expect(page.getByText('CAT 1', { exact: true })).toBeVisible();
  await expect(page.getByText('(15%)').first()).toBeVisible();
  await expect(page.getByLabel('Score for CAT 1, percent')).toHaveValue('80');
  await expect(page.getByLabel('Score for CAT 2, percent')).toBeVisible();

  // and it is still there after a reload
  await page.reload();
  await expect(page.getByLabel('Score for CAT 1, percent')).toHaveValue('80');
  await expect(page.getByLabel('Score for Practical, percent')).toBeVisible();
});

test('cancelling the edit changes nothing', async ({ page }) => {
  await page.goto('/grades');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);
  await page.evaluate(() =>
    (window as unknown as { __store: { getState: () => S } }).__store.getState().addCourseGrade({
      courseCode: 'MTH 201', courseName: 'Calculus', credits: 4, targetLetter: 'B', color: '#4F46E5',
      assessments: [{ id: 'b1', name: 'Exam', weight: 100 }]
    })
  );
  await page.getByRole('button', { name: 'Edit grading' }).click();
  await page.getByLabel('Name of assessment 1').fill('Something else');
  // the last assessment cannot be removed
  await expect(page.getByRole('button', { name: /Remove assessment 1/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Score for Exam, percent')).toBeVisible();
});

test('removing a scored assessment asks first, and all-zero weights cannot be saved', async ({ page }) => {
  await page.goto('/grades');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);
  await page.evaluate(() =>
    (window as unknown as { __store: { getState: () => S } }).__store.getState().addCourseGrade({
      courseCode: 'CHE 110', courseName: 'Chemistry', credits: 3, targetLetter: 'B', color: '#4F46E5',
      assessments: [
        { id: 'c1', name: 'CAT 1', weight: 40, score: 78 },
        { id: 'c2', name: 'Final exam', weight: 60 }
      ]
    })
  );
  await page.getByRole('button', { name: 'Edit grading' }).click();
  await expect(page.getByText('Your score: 78%')).toBeVisible();

  // first press only asks; the score is still there
  await page.getByRole('button', { name: /^Remove assessment 1/ }).click();
  await expect(page.getByText(/Press remove again to delete this assessment and its score \(78%\)/)).toBeVisible();
  await expect(page.getByLabel('Name of assessment 1')).toHaveValue('CAT 1');

  // all weights at zero cannot be saved
  await page.getByLabel('Weight of assessment 1, percent').fill('0');
  await page.getByLabel('Weight of assessment 2, percent').fill('0');
  await expect(page.getByRole('button', { name: 'Save grading' })).toBeDisabled();
  await expect(page.getByText(/add up to 0%/)).toBeVisible();

  // second press removes it
  await page.getByRole('button', { name: /^Confirm: remove assessment 1/ }).click();
  await expect(page.getByLabel('Name of assessment 2')).toHaveCount(0);
});
