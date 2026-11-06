import { expect, test } from '@playwright/test';

type S = {
  userId: string | null;
  assignments: Array<{ id: string; title: string }>;
  grades: Array<{ id: string; assessments: Array<{ id: string; score?: number }> }>;
  addAssignment: (a: unknown) => void;
  loadSampleData: () => void;
  updateAssessmentScore: (course: string, assessment: string, score: number) => void;
};
type W = { __store: { getState: () => S } };

async function ready(page: import('@playwright/test').Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
}

test('deleting an assignment can be undone, and the assignment comes back', async ({ page }) => {
  await ready(page, '/assignments');
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addAssignment({
      title: 'TEST - undo me', course: 'CS 101', dueDate: '2030-01-01', priority: 'medium', status: 'pending', progress: 0
    })
  );
  await expect(page.getByText('TEST - undo me').first()).toBeVisible();
  // let the new assignment reach the cloud first, as a student's own add-then-delete would
  const ids = await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    return { uid: s.userId, id: s.assignments.find((a) => a.title === 'TEST - undo me')!.id };
  });
  await expect
    .poll(async () => (await fetch(`http://127.0.0.1:8080/v1/projects/studyflow-e2e/databases/(default)/documents/users/${ids.uid}/assignments/${ids.id}`, { headers: { Authorization: 'Bearer owner' } })).status, { timeout: 15_000 })
    .toBe(200);

  await page.getByRole('button', { name: 'Delete assignment "TEST - undo me"' }).click();
  await expect(page.getByRole('status')).toContainText('Deleted');
  await expect(page.getByText('TEST - undo me')).toHaveCount(1); // only inside the notice

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByText('TEST - undo me').first()).toBeVisible();
  const titles = await page.evaluate(() => (window as unknown as W).__store.getState().assignments.map((a) => a.title));
  expect(titles.filter((t) => t === 'TEST - undo me')).toHaveLength(1);
});

test('grade scores are held between 0 and 100', async ({ page }) => {
  await ready(page, '/grades');
  const result = await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.loadSampleData();
    const g = (window as unknown as W).__store.getState().grades[0];
    const a = g.assessments[0];
    const set = (v: number) => {
      (window as unknown as W).__store.getState().updateAssessmentScore(g.id, a.id, v);
      return (window as unknown as W).__store.getState().grades.find((x) => x.id === g.id)!.assessments.find((x) => x.id === a.id)!.score;
    };
    return { high: set(250), low: set(-50), ok: set(82) };
  });
  expect(result).toEqual({ high: 100, low: 0, ok: 82 });
});
