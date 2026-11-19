import { expect, test, type Page } from '@playwright/test';

/** Derek's round of small fixes: no test button on the timer, an honest what-if when all is graded, "Done" on finished work, add from an empty search, a short colour key. */
type S = {
  userId: string | null;
  addCourseGrade: (c: unknown) => void;
  addAssignment: (a: object) => void;
  addSession: (s: object) => void;
  assignments: { id: string; title: string }[];
  toggleAssignmentComplete: (id: string) => void;
};
type W = { __store: { getState: () => S } };

async function ready(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
}

test('the timer has no developer "test celebration" button', async ({ page }) => {
  await ready(page, '/timer');
  await expect(page.getByRole('button', { name: /^Start/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /test milestone/i })).toHaveCount(0);
});

test('when every assessment has a score, the what-if says the result instead of offering a slider that changes nothing', async ({ page }) => {
  await ready(page, '/grades');
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addCourseGrade({
      courseCode: 'ACS211', courseName: 'System Analytics', credits: 4, targetLetter: 'A', color: '#4F46E5',
      assessments: [
        { id: 'm', name: 'Midterm exam', weight: 30, score: 21 },
        { id: 'c', name: 'Coursework', weight: 30, score: 25 },
        { id: 'f', name: 'Final exam', weight: 40, score: 35 }
      ]
    })
  );
  // 21 x 0.3 + 25 x 0.3 + 35 x 0.4 = 27.8
  const done = page.getByTestId('what-if-all-graded');
  await expect(done).toContainText('Every assessment in ACS211 has a score');
  await expect(done).toContainText('27.8%');
  await expect(page.getByRole('slider', { name: /Score on the next assessment/ })).toHaveCount(0);
  await expect(page.getByText('Final assessment')).toHaveCount(0);
});

test('a finished assignment says "Done", not how many days overdue it is', async ({ page }) => {
  await ready(page, '/assignments');
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.addAssignment({ title: 'CAT coming up', course: 'ACS', dueDate: '2026-01-05', priority: 'high', status: 'pending', progress: 0 });
  });
  const card = page.getByRole('group', { name: 'Open details for "CAT coming up"' });
  await expect(card).toContainText('overdue');
  await card.getByRole('button', { name: 'Mark "CAT coming up" complete' }).click();
  await expect(card.getByTestId('done-badge')).toHaveText('Done');
  await expect(card).not.toContainText('overdue');
});

test('a search that finds nothing offers to add it as an assignment, with the title filled in', async ({ page }) => {
  await ready(page, '/assignments');
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addAssignment({ title: 'Lab report', course: 'PHY', dueDate: '2030-01-15', priority: 'low', status: 'pending', progress: 0 })
  );
  await page.getByLabel('Search assignments').fill('Physics quiz');
  await page.getByRole('button', { name: 'Add “Physics quiz” as an assignment' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByPlaceholder('e.g. Problem Set 2')).toHaveValue('Physics quiz');
});

test('the timetable shows a one-line colour key, with nothing to open or read', async ({ page }) => {
  await ready(page, '/calendar');
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addSession({ title: 'Algorithms', course: 'CS 301', dayOfWeek: 1, startTime: '08:00', endTime: '09:00', type: 'lecture' })
  );
  const key = page.getByTestId('legend');
  await expect(key).toBeVisible();
  for (const label of ['Lecture', 'Lab', 'Study', 'Review', 'Exam']) await expect(key).toContainText(label);
  await expect(page.getByText('What do the labels mean?')).toHaveCount(0);
  expect((await key.boundingBox())!.height).toBeLessThan(100);
});
