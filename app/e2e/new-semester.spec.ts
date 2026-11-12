import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** PR10: start a new semester (or term): archive what is not carried over, keep it readable, never delete it. */
type S = {
  userId: string | null;
  isAnonymous: boolean;
  isSyncing: boolean;
  assignments: { id: string; title: string }[];
  sessions: unknown[];
  grades: { courseCode: string; assessments: { score?: number }[] }[];
  notes: { title: string }[];
  periods: { id: string; name: string; counts: Record<string, number> }[];
  archived: { assignments: { title: string; archivedPeriod?: string }[]; sessions: unknown[]; grades: unknown[]; notes: unknown[] };
  user: { semester: string; periodLabel?: string };
  addAssignment: (a: object) => void;
  addSession: (s: object) => void;
  addNote: (n: object) => string;
  addCourseGrade: (c: object) => void;
  toggleAssignmentComplete: (id: string) => void;
  setTheme: (t: 'light' | 'dark') => void;
};
type W = { __store: { getState: () => S }; __auth: { signInOrLinkWithGoogle: () => Promise<unknown> } };

const DOCS = 'http://127.0.0.1:8080/v1/projects/studyflow-e2e/databases/(default)/documents';
const H = { Authorization: 'Bearer owner' };

async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  const closed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('button.mdc-button--outlined').first().click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#email-input').fill(`semester-${Date.now().toString(36)}@example.com`);
  await popup.locator('#sign-in').click();
  await closed;
  await page.waitForFunction(() => (window as unknown as W).__store.getState().isAnonymous === false);
}

async function seed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.addCourseGrade({ courseCode: 'CS 301', courseName: 'Algorithms', credits: 3, targetLetter: 'A', color: '#4F46E5', assessments: [{ id: 'm', name: 'Midterm', weight: 40, score: 80 }, { id: 'f', name: 'Final', weight: 60 }] });
    for (const title of ['Open one', 'Open two', 'Finished one']) {
      s.addAssignment({ title, course: 'CS 301', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 });
    }
    s.addSession({ title: 'Algorithms lecture', course: 'CS 301', dayOfWeek: 2, startTime: '10:00', endTime: '11:30', type: 'lecture' });
    s.addNote({ title: 'Keep this note', body: 'x', course: 'CS 301', pinned: false });
    s.addNote({ title: 'Old note', body: 'y', course: 'CS 301', pinned: false });
  });
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.toggleAssignmentComplete(s.assignments.find((a) => a.title === 'Finished one')!.id);
  });
  await page.waitForFunction(() => !(window as unknown as W).__store.getState().isSyncing);
}

async function openNewSemester(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).first().click();
  await page.getByRole('button', { name: 'Your account', exact: true }).click();
  await page.getByRole('button', { name: 'Start a new semester' }).click();
  const dialog = page.getByTestId('new-semester');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('start a new semester: ticked work and notes carry over, the rest is archived, nothing is lost, and Past terms shows it', async ({ page }) => {
  await signIn(page);
  await seed(page);
  const uid = await page.evaluate(() => (window as unknown as W).__store.getState().userId as string);

  const dialog = await openNewSemester(page);
  // unfinished work is ticked by default; finished work is not offered (it is always archived)
  await expect(dialog.getByRole('region', { name: 'Unfinished work' })).toContainText('Open one');
  await expect(dialog.getByRole('region', { name: 'Unfinished work' })).toContainText('Open two');
  await expect(dialog.getByRole('region', { name: 'Unfinished work' })).not.toContainText('Finished one');
  await expect(dialog.getByTestId('archive-summary')).toContainText('5 items will be archived'); // 1 finished + 1 course + 1 class + 2 notes
  await expect(dialog.getByTestId('archive-summary')).toContainText('2 carried over');

  // untick one task, tick one note: the summary follows
  await dialog.getByLabel(/Open two/).uncheck();
  await dialog.getByLabel(/Keep this note/).check();
  await expect(dialog.getByTestId('archive-summary')).toContainText('carried over');
  await dialog.getByPlaceholder(/e\.g\. Semester 2, 2027/).fill('Term 3, 2027');
  await dialog.getByLabel('Called a').selectOption('term');
  await expect(dialog.getByPlaceholder(/e\.g\. Term 2, 2027/)).toBeVisible();
  await dialog.getByRole('button', { name: /Archive and start the new term/ }).click();
  await expect(page.getByTestId('new-semester-done')).toContainText('Your new term has started');

  // what is current now: only the carried work and note; the timetable and courses were archived
  const now = await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    return {
      assignments: s.assignments.map((a) => a.title),
      notes: s.notes.map((n) => n.title),
      sessions: s.sessions.length,
      grades: s.grades.length,
      archivedAssignments: s.archived.assignments.map((a) => a.title).sort(),
      archivedNotes: s.archived.notes.length,
      archivedGrades: s.archived.grades.length,
      archivedSessions: s.archived.sessions.length,
      semester: s.user.semester,
      label: s.user.periodLabel
    };
  });
  expect(now).toMatchObject({
    assignments: ['Open one'],
    notes: ['Keep this note'],
    sessions: 0,
    grades: 0,
    archivedAssignments: ['Finished one', 'Open two'],
    archivedNotes: 1,
    archivedGrades: 1,
    archivedSessions: 1,
    semester: 'Term 3, 2027',
    label: 'term'
  });

  // the cloud has it all: the archived documents carry the period, the carried ones do not, and the period record exists
  await page.waitForFunction(() => !(window as unknown as W).__store.getState().isSyncing);
  // (a sync echo can briefly empty the list before the saved record arrives, so wait for it)
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__store.getState().periods.length), { timeout: 15_000 }).toBe(1);
  const periodId = await page.evaluate(() => (window as unknown as W).__store.getState().periods[0]!.id);
  const list = async (c: string) => ((await (await fetch(`${DOCS}/users/${uid}/${c}?pageSize=100`, { headers: H })).json()) as { documents?: { name: string; fields: Record<string, { stringValue?: string }> }[] }).documents ?? [];
  await expect.poll(async () => (await list('assignments')).filter((d) => d.fields.archivedPeriod?.stringValue === periodId).length, { timeout: 15_000 }).toBe(2);
  expect((await list('assignments')).filter((d) => !d.fields.archivedPeriod).map((d) => d.fields.title?.stringValue)).toEqual(['Open one']);
  expect((await list('sessions')).every((d) => d.fields.archivedPeriod?.stringValue === periodId)).toBe(true);
  expect((await list('notes')).filter((d) => d.fields.archivedPeriod?.stringValue === periodId)).toHaveLength(1);
  const sem = await list('semesters');
  expect(sem).toHaveLength(1);
  expect(JSON.stringify(sem[0])).toContain('Current semester'); // the period that ended keeps its name
  const profile = await (await fetch(`${DOCS}/users/${uid}`, { headers: H })).json();
  expect(JSON.stringify(profile)).toContain('"term"');

  // Past terms: read-only record with the archived work, the grade and the note
  await page.getByTestId('new-semester-done').getByRole('button', { name: /See Past terms/ }).click();
  const past = page.getByTestId('past-semesters');
  await expect(past).toContainText('Current semester');
  await past.locator('[data-period="Current semester"]').click();
  await expect(past.getByRole('region', { name: 'Work' })).toContainText('Finished one');
  await expect(past.getByRole('region', { name: 'Work' })).toContainText('Open two');
  await expect(past.getByRole('region', { name: 'Courses and grades' })).toContainText('CS 301');
  await expect(past.getByRole('region', { name: 'Courses and grades' })).toContainText('80%');
  await expect(past.getByRole('region', { name: 'Classes' })).toContainText('Algorithms lecture');
  await expect(past.getByRole('region', { name: 'Notes' })).toContainText('Old note');
  await expect(past).toContainText('cannot be edited');
  await past.getByRole('button', { name: 'Close' }).click();

  // it all survives a reload. The current work and the record come back straight away; the archived work stays in the account
  // (a signed-in device no longer keeps past semesters in its own storage) and loads when it is needed.
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect
    .poll(() => page.evaluate(() => { const s = (window as unknown as W).__store.getState(); return `${s.assignments.length}/${s.periods.length}`; }), { timeout: 15_000 })
    .toBe('1/1');
  const archivedAfterLoad = await page.evaluate(async () => {
    const s = (window as unknown as W).__store.getState();
    const mod = await import(/* @vite-ignore */ '/src/services/firestoreSync.ts');
    await mod.loadArchivedFromCloud(s.userId!);
    return (window as unknown as W).__store.getState().archived.assignments.length;
  });
  expect(archivedAfterLoad).toBe(2);
});

test('keeping the timetable and the courses carries them over, with the old scores cleared and kept in the archive', async ({ page }) => {
  await signIn(page);
  await seed(page);
  const dialog = await openNewSemester(page);
  await dialog.getByLabel(/Keep my timetable/).check();
  await dialog.getByLabel(/Keep my courses/).check();
  await dialog.getByRole('button', { name: /Archive and start the new semester/ }).click();
  await expect(page.getByTestId('new-semester-done')).toBeVisible();
  const state = await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    return { sessions: s.sessions.length, grades: s.grades.map((g) => g.assessments.map((a) => a.score)), archivedGrades: s.archived.grades.length, archivedSessions: s.archived.sessions.length };
  });
  expect(state.sessions).toBe(1);
  expect(state.grades).toEqual([[undefined, undefined]]); // same course, scores cleared
  expect(state.archivedGrades).toBe(1); // the old copy, with its scores, is in the archive
  expect(state.archivedSessions).toBe(0);
});

test('on a phone, in light and dark: the dialogs fit, tap targets are 44px and there are no accessibility problems', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await signIn(page);
  await seed(page);
  const dialog = await openNewSemester(page);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(box.y + box.height).toBeLessThanOrEqual(740);
  for (const b of await dialog.locator('button').all()) if (await b.isVisible()) expect((await b.boundingBox())!.height, await b.innerText()).toBeGreaterThanOrEqual(44);
  for (const label of await dialog.locator('label').all()) if (await label.isVisible() && (await label.locator('input[type=checkbox]').count()) > 0) expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
    await page.waitForTimeout(300);
    const axe = await new AxeBuilder({ page }).include('[data-testid="new-semester"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${theme} ${v.id}: ${v.nodes.map((n) => n.html.slice(0, 90)).join(' | ')}`)).toEqual([]);
  }
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: /Past semesters/ }).click();
  const past = page.getByTestId('past-semesters');
  await expect(past).toContainText('No past semesters yet');
  const axe = await new AxeBuilder({ page }).include('[data-testid="past-semesters"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test('the profile uses the word the student chose: term, trimester or semester', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.getByRole('button', { name: 'Edit profile' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Profile' });
  await expect(dialog).toContainText('Current semester');
  await dialog.getByLabel('Your school calls it a').selectOption('trimester');
  await expect(dialog).toContainText('Current trimester');
  await expect(dialog).toContainText('Trimester starts');
  await expect(dialog).toContainText('Trimester ends');
});
