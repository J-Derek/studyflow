import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** PR6: kinds of deadline, progress that follows the checklist, the celebration, and the keys. */
type A = { id: string; title: string; status: string; progress: number; kind?: string; subtasks?: { id: string; title: string; completed: boolean }[] };
type S = {
  userId: string | null;
  assignments: A[];
  addAssignment: (a: object) => void;
  addSession: (s: object) => void;
  setTheme: (t: 'light' | 'dark') => void;
  toggleAssignmentComplete: (id: string) => void;
};
type W = { __store: { getState: () => S } };

const ready = async (page: Page, path: string) => {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};
const seed = (page: Page, items: object[]) =>
  page.evaluate((list) => {
    const s = (window as unknown as W).__store.getState();
    for (const a of list) s.addAssignment({ course: 'TEST 101', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0, ...(a as object) });
  }, items);
/** Waits for the save to reach the account, so the next tick starts from the saved list (see "known issue" in HANDOFF: two very fast ticks can race a sync echo). */
const settled = (page: Page) =>
  page.waitForFunction(() => !(window as unknown as { __store: { getState: () => { isSyncing: boolean } } }).__store.getState().isSyncing);
const find = (page: Page, title: string) =>
  page.evaluate((t) => (window as unknown as W).__store.getState().assignments.find((a) => a.title === t) ?? null, title);

test('the add dialog asks what it is; the kind shows as a badge, survives a reload, and an ordinary assignment shows no badge', async ({ page }) => {
  await ready(page, '/assignments');
  await page.getByRole('button', { name: 'Add assignment' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('What is it?')).toBeVisible();
  await expect(dialog).toContainText('Exams, tests and readings are easy to forget');
  await dialog.getByPlaceholder('e.g. Problem Set 2').fill('Final exam: Algorithms');
  await dialog.getByPlaceholder('e.g. CS 101 or Physics').fill('CS 301');
  await dialog.locator('label').filter({ hasText: /^Exam$/ }).click(); // the chip itself, as a finger would
  await expect(dialog.locator('input[type=radio][value="exam"]')).toBeChecked();
  await expect(dialog).toContainText('End-of-semester or final exam');
  await dialog.getByRole('button', { name: /Add|Save|Create/ }).last().click();
  await expect(page.getByTestId('kind-badge').filter({ hasText: 'Exam' }).locator('visible=true')).toHaveCount(1);

  await seed(page, [{ title: 'Plain homework' }]);
  const row = page.locator('div.p-3\\.5').filter({ hasText: 'Plain homework' }).first();
  await expect(row).toBeVisible();
  await expect(row.getByTestId('kind-badge')).toHaveCount(0);

  await page.waitForFunction(() => (localStorage.getItem('studyflow_storage_v1') ?? '').includes('"kind":"exam"'));
  await settled(page); // let the saves reach the account before leaving the page
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect(page.getByTestId('kind-badge').filter({ hasText: 'Exam' }).locator('visible=true')).toHaveCount(1);
  expect((await find(page, 'Plain homework'))!.kind).toBeUndefined();
});

test('the first-deadline card on an empty Today asks what it is too', async ({ page }) => {
  await ready(page, '/');
  const card = page.getByRole('heading', { name: 'What is your next deadline?' }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
  await card.getByPlaceholder(/Problem Set 2/).fill('CAT 1');
  await card.getByRole('button', { name: 'More options' }).click();
  await card.getByPlaceholder('e.g. CS 101 or Physics').fill('ACS 443');
  await card.locator('label').filter({ hasText: /^Test$/ }).click();
  await expect(card.locator('input[type=radio][value="test"]')).toBeChecked();
  await card.getByRole('button', { name: /Add|Save|deadline/i }).last().click();
  await expect.poll(async () => (await find(page, 'CAT 1'))?.kind).toBe('test');
});

test('with a checklist, progress comes from the ticks (no slider); without one, the slider stays', async ({ page }) => {
  await ready(page, '/assignments');
  await seed(page, [
    { title: 'With checklist', subtasks: ['a', 'b', 'c', 'd'].map((n) => ({ id: `s-${n}`, title: `Step ${n}`, completed: n === 'a' })) },
    { title: 'By hand', progress: 35, status: 'in_progress' }
  ]);

  // the checklist item: progress 25% from one tick of four, shown on the page and in the edit dialog without a slider
  await page.getByRole('button', { name: 'Edit assignment "With checklist"' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('checklist-progress')).toContainText('Progress 25%');
  await expect(dialog.getByTestId('checklist-progress')).toContainText('Based on your checklist: 1 of 4 done');
  await expect(dialog.getByRole('slider')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  // ticking changes progress; it never reaches 100 until the last tick, which finishes the assignment
  const tick = (n: string) => page.getByRole('checkbox', { name: `Step ${n}` });
  await tick('b').check();
  await settled(page);
  await expect.poll(async () => (await find(page, 'With checklist'))!.progress).toBe(50);
  await tick('c').check();
  await settled(page);
  await expect.poll(async () => (await find(page, 'With checklist'))!.progress).toBe(75);
  await tick('d').check();
  await settled(page);
  await expect.poll(async () => (await find(page, 'With checklist'))!.status).toBe('completed');
  expect((await find(page, 'With checklist'))!.progress).toBe(100);

  // un-marking recalculates from the ticks (all four ticked, so as high as it can go while unfinished)
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.toggleAssignmentComplete(s.assignments.find((a) => a.title === 'With checklist')!.id);
  });
  expect(await find(page, 'With checklist')).toMatchObject({ status: 'in_progress', progress: 99 });

  // the one with no checklist keeps its slider
  await page.getByRole('button', { name: 'Edit assignment "By hand"' }).click();
  await expect(page.getByRole('dialog').getByRole('slider', { name: 'Progress, percent' })).toHaveValue('35');
  await expect(page.getByRole('dialog').getByTestId('checklist-progress')).toHaveCount(0);
});

test('a progress number sent for an item with a checklist is ignored, so the two cannot disagree', async ({ page }) => {
  await ready(page, '/assignments');
  await seed(page, [{ title: 'Guarded', subtasks: [{ id: 'g1', title: 'one', completed: true }, { id: 'g2', title: 'two', completed: false }], progress: 50, status: 'in_progress' }]);
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState() as unknown as { updateAssignment: (id: string, u: object) => void; assignments: A[] };
    s.updateAssignment(s.assignments.find((a) => a.title === 'Guarded')!.id, { progress: 100 });
  });
  expect(await find(page, 'Guarded')).toMatchObject({ status: 'in_progress', progress: 50 });
});

test('marking work done celebrates: a message that is read out, and confetti unless motion is reduced', async ({ browser }) => {
  for (const reduce of [false, true]) {
    const context = await browser.newContext({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    await ready(page, '/assignments');
    await seed(page, [{ title: `Finish me ${reduce ? 'calmly' : 'loudly'}` }]);
    await page.getByRole('button', { name: /Mark ".*" complete/ }).first().click();
    const message = page.getByTestId('celebrate-message');
    await expect(message).toContainText('Nice work!');
    await expect(message).toContainText('Finish me');
    // the message sits in a polite live region, so screen readers announce it
    expect(await message.evaluate((el) => !!el.closest('[aria-live="polite"]'))).toBe(true);
    // confetti draws on a canvas it adds to the page; with reduced motion it adds none
    await page.waitForTimeout(400);
    const canvases = await page.locator('body > canvas').count();
    if (reduce) expect(canvases, 'no confetti with reduced motion').toBe(0);
    else expect(canvases, 'confetti canvas').toBeGreaterThan(0);
    await expect(message).toHaveCount(0, { timeout: 8000 });
    await context.close();
  }
});

test('the keys: kinds on Assignments, class colours on the Timetable, each class type has its own edge colour', async ({ page }) => {
  await ready(page, '/assignments');
  await seed(page, [{ title: 'An exam', kind: 'exam' }, { title: 'A reading', kind: 'reading' }]);
  const legend = page.getByTestId('legend');
  await legend.getByText('What do the labels mean?').click();
  for (const label of ['Assignment', 'Exam', 'Test', 'Reading', 'Project']) await expect(legend).toContainText(label);
  await expect(legend).toContainText('worked out from the items you tick');
  expect((await legend.getByText('What do the labels mean?').boundingBox())!.height).toBeGreaterThanOrEqual(44);

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
    await page.waitForTimeout(300);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${theme} ${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(' | ')}`)).toEqual([]);
  }

  await page.getByRole('link', { name: /Timetable/ }).first().click();
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    const day = new Date().getDay();
    s.addSession({ title: 'Algorithms', course: 'CS 301', dayOfWeek: day, startTime: '08:00', endTime: '09:00', type: 'lecture' });
    s.addSession({ title: 'Finals', course: 'CS 301', dayOfWeek: day, startTime: '13:00', endTime: '14:00', type: 'exam' });
  });
  const lecture = page.locator('[data-class-type="lecture"]').first();
  const exam = page.locator('[data-class-type="exam"]').first();
  await expect(lecture).toContainText('Lecture');
  await expect(exam).toContainText('Exam');
  const edge = (l: ReturnType<Page['locator']>) => l.evaluate((el) => getComputedStyle(el).borderLeftColor);
  const [a, b] = [await edge(lecture), await edge(exam)];
  expect(a).not.toBe(b);
  const cal = page.getByTestId('legend');
  await cal.getByText('What do the labels mean?').click();
  for (const label of ['Lecture', 'Lab', 'Study', 'Review', 'Exam']) await expect(cal).toContainText(label);
});
