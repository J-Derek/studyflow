import { expect, test, type Page } from '@playwright/test';

/** Item 3: weekly repeating deadlines. Finishing one (or letting its date pass) makes next week's, once. */
type A = { id: string; title: string; dueDate: string; status: string; kind?: string; repeat?: { every: string; until?: string }; repeatOf?: string; subtasks?: { id: string; title: string; completed: boolean }[] };
type S = {
  userId: string | null;
  assignments: A[];
  addAssignment: (a: object) => void;
  toggleAssignmentComplete: (id: string) => void;
  toggleSubtask: (id: string, st: string) => void;
};
type W = { __store: { getState: () => S } };

const iso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const list = (page: Page, title: string) =>
  page.evaluate((t) => (window as unknown as W).__store.getState().assignments.filter((a) => a.title === t).map((a) => ({ ...a })), title);

async function ready(page: Page): Promise<void> {
  await page.goto('/assignments');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
}

test('finishing a repeating deadline makes next week\'s, with the checklist unticked, and only once', async ({ page }) => {
  await ready(page);
  await page.evaluate((due) => {
    const s = (window as unknown as W).__store.getState();
    s.addAssignment({ title: 'Weekly quiz', kind: 'test', course: 'MATH 101', dueDate: due, priority: 'high', status: 'pending', progress: 0, repeat: { every: 'week' }, subtasks: [{ id: 'q1', title: 'Revise', completed: false }] });
  }, iso(2));
  const first = (await list(page, 'Weekly quiz'))[0];
  await page.evaluate((id) => (window as unknown as W).__store.getState().toggleSubtask(id, 'q1'), first.id);
  await expect.poll(async () => (await list(page, 'Weekly quiz')).length).toBe(2);
  const all = await list(page, 'Weekly quiz');
  const next = all.find((a) => a.id !== first.id)!;
  expect(next.dueDate).toBe(iso(9));
  expect(next.kind).toBe('test');
  expect(next.status).toBe('pending');
  expect(next.repeat).toEqual({ every: 'week' });
  expect(next.repeatOf).toBe(first.id);
  expect(next.subtasks?.map((s) => s.completed)).toEqual([false]);
  expect(all.find((a) => a.id === first.id)!.repeat).toBeUndefined();
  // Un-ticking and ticking again must not make a third one.
  await page.evaluate((id) => (window as unknown as W).__store.getState().toggleAssignmentComplete(id), first.id);
  await page.evaluate((id) => (window as unknown as W).__store.getState().toggleAssignmentComplete(id), first.id);
  await page.waitForTimeout(500);
  expect(await list(page, 'Weekly quiz')).toHaveLength(2);
});

test('a repeating deadline whose date passed makes the next one when the account loads, and survives a reload without duplicates', async ({ page }) => {
  await ready(page);
  await page.evaluate((due) => {
    (window as unknown as W).__store.getState().addAssignment({ title: 'Lab report', course: 'PHY 101', dueDate: due, priority: 'medium', status: 'pending', progress: 0, repeat: { every: 'week', until: '2099-01-01' } });
  }, iso(-3));
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect.poll(async () => (await list(page, 'Lab report')).length, { timeout: 15000 }).toBe(2);
  const next = (await list(page, 'Lab report')).find((a) => a.repeat);
  expect(next?.dueDate).toBe(iso(4));
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.waitForTimeout(2000);
  expect(await list(page, 'Lab report')).toHaveLength(2);
});

test('the Repeats weekly switch is under More options when adding, and in the edit dialog', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.getByLabel('What is due?').fill('Seminar reading');
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByLabel('Repeats weekly').check();
  await page.getByRole('button', { name: /Save deadline/ }).click();
  await expect.poll(async () => (await list(page, 'Seminar reading'))[0]?.repeat).toEqual({ every: 'week' });
  await page.goto('/assignments');
  await page.getByRole('button', { name: 'Edit assignment "Seminar reading"' }).click();
  await expect(page.getByLabel('Repeats weekly')).toBeChecked();
  await page.getByLabel('Repeats weekly').uncheck();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(async () => (await list(page, 'Seminar reading'))[0]?.repeat).toBeUndefined();
});
