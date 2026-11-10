import { expect, test, type Page } from '@playwright/test';

/** UX round, part E: quick ticks are never lost, and a change made in one tab reaches the other. */
type Sub = { id: string; title: string; completed: boolean };
type A = { id: string; title: string; status: string; progress: number; subtasks?: Sub[] };
type S = {
  userId: string | null;
  assignments: A[];
  addAssignment: (a: object) => void;
  toggleSubtask: (assignmentId: string, subtaskId: string) => void;
};
type W = { __store: { getState: () => S } };

const ready = async (page: Page) => {
  await page.goto('/assignments');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

const seed = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.addAssignment({
      title: 'Stress test',
      course: 'GEN 1',
      dueDate: '2030-01-01',
      priority: 'medium',
      status: 'pending',
      progress: 0,
      subtasks: ['a', 'b', 'c', 'd', 'e', 'f'].map((n, i) => ({ id: `s-${n}`, title: `Step ${n}`, completed: false, order: i }))
    });
  });

const doneCount = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__store.getState().assignments[0]?.subtasks?.filter((x) => x.completed).length ?? -1);

test('ticking six checklist items as fast as possible loses none, even after the cloud echoes settle', async ({ page }) => {
  await ready(page);
  await seed(page);
  await page.waitForTimeout(800); // let the first write settle
  await page.evaluate(async () => {
    const store = (window as unknown as W).__store;
    const id = store.getState().assignments[0]!.id;
    for (const n of ['a', 'b', 'c', 'd', 'e', 'f']) {
      store.getState().toggleSubtask(id, `s-${n}`);
      await new Promise((r) => setTimeout(r, 4)); // a fast thumb, not an instant loop
    }
  });
  expect(await doneCount(page)).toBe(6);
  // the cloud's echoes arrive over the next moments; none may put an item back
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(150);
    expect(await doneCount(page)).toBe(6);
  }
  // and after a reload the account still holds all six
  await page.reload();
  await page.waitForFunction(() => ((window as unknown as W).__store.getState().assignments[0]?.subtasks?.length ?? 0) === 6, undefined, { timeout: 15_000 });
  expect(await doneCount(page)).toBe(6);
});

test('two tabs: a tick in one tab reaches the other, and quick ticks in both end up in both', async ({ browser }) => {
  const context = await browser.newContext();
  const one = await context.newPage();
  await ready(one);
  await seed(one);
  const two = await context.newPage();
  await ready(two);
  await two.waitForFunction(() => ((window as unknown as W).__store.getState().assignments[0]?.subtasks?.length ?? 0) === 6, undefined, { timeout: 15_000 });

  const tick = (page: Page, names: string[]) =>
    page.evaluate(async (list) => {
      const store = (window as unknown as W).__store;
      const id = store.getState().assignments[0]!.id;
      for (const n of list) {
        store.getState().toggleSubtask(id, `s-${n}`);
        await new Promise((r) => setTimeout(r, 4));
      }
    }, names);

  await tick(one, ['a', 'b', 'c']);
  await expect.poll(() => doneCount(two), { timeout: 15_000 }).toBe(3);

  // and back the other way: quick ticks in the second tab reach the first. (Each tick writes the whole assignment, so two people
  // ticking different items in the same instant would still be last-writer-wins; that limit is not part of this fix.)
  await tick(one, ['d']);
  await expect.poll(() => doneCount(two), { timeout: 15_000 }).toBe(4);
  await tick(two, ['e', 'f']);
  await expect.poll(() => doneCount(one), { timeout: 15_000 }).toBe(6);
  await expect.poll(() => doneCount(two), { timeout: 15_000 }).toBe(6);
  await context.close();
});
