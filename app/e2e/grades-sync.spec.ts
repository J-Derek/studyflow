import { expect, test } from '@playwright/test';

type W = {
  __store: {
    getState: () => {
      userId: string | null;
      grades: Array<{ id: string }>;
      addCourseGrade: (c: unknown) => void;
      updateAssessmentScore: (course: string, assessment: string, score: number) => void;
      deleteCourseGrade: (id: string) => void;
    };
  };
};

async function readDoc(path: string) {
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/studyflow-e2e/databases/(default)/documents/${path}`, {
    headers: { Authorization: 'Bearer owner' }
  });
  if (res.status === 404) return null;
  return (await res.json()) as { fields?: Record<string, unknown> };
}

test('grades are saved to Firestore, edits update them, delete removes them', async ({ page }) => {
  await page.goto('/grades');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  const uid = await page.evaluate(() => (window as unknown as W).__store.getState().userId as string);

  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addCourseGrade({
      courseCode: 'CS 301', courseName: 'Algorithms', credits: 3, targetLetter: 'A', color: '#6366F1',
      assessments: [{ id: 'a1', name: 'Midterm', weight: 40 }, { id: 'a2', name: 'Final exam', weight: 60 }]
    })
  );
  const id = await page.evaluate(() => (window as unknown as W).__store.getState().grades[0].id);
  await expect.poll(async () => (await readDoc(`users/${uid}/grades/${id}`))?.fields?.courseCode, { timeout: 15_000 }).toBeTruthy();

  await page.evaluate((gid) => (window as unknown as W).__store.getState().updateAssessmentScore(gid, 'a1', 88), id);
  await expect
    .poll(async () => JSON.stringify((await readDoc(`users/${uid}/grades/${id}`))?.fields?.assessments ?? ''), { timeout: 15_000 })
    .toContain('"integerValue":"88"');

  await page.evaluate((gid) => (window as unknown as W).__store.getState().deleteCourseGrade(gid), id);
  await expect.poll(async () => await readDoc(`users/${uid}/grades/${id}`), { timeout: 15_000 }).toBeNull();
});
