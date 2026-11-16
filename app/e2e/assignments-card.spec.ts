import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** The Assignments list: a card opens its details when clicked or pressed, and unfinished work comes first. */
type S = { userId: string | null; addAssignment: (a: object) => void; setTheme: (t: 'light' | 'dark') => void };
type W = { __store: { getState: () => S } };

const ready = async (page: Page) => {
  await page.goto('/assignments');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};
const seed = (page: Page, items: object[]) =>
  page.evaluate((list) => {
    const s = (window as unknown as W).__store.getState();
    for (const a of list) s.addAssignment({ course: 'TEST 101', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0, ...(a as object) });
  }, items);
const card = (page: Page, title: string) => page.getByRole('group', { name: `Open details for "${title}"` });
const editDialog = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Edit Assignment' }) });

test('clicking a card, or pressing Enter or Space on it, opens its details; its own buttons still do their own job', async ({ page }) => {
  await ready(page);
  await seed(page, [{ title: 'Lab report', notes: 'Graphs on page 3', subtasks: [{ id: 's1', title: 'Draw graphs', completed: false }] }]);
  const c = card(page, 'Lab report');
  await expect(c).toBeVisible();

  // a click on the card's text opens the edit dialog for that item
  await c.getByText('TEST 101').click();
  await expect(editDialog(page)).toBeVisible();
  await expect(editDialog(page).getByPlaceholder('e.g. Problem Set 2')).toHaveValue('Lab report');
  await editDialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(editDialog(page)).toHaveCount(0);

  // the keyboard: the card takes focus, and Enter or Space opens it
  for (const key of ['Enter', ' ']) {
    await c.focus();
    await page.keyboard.press(key);
    await expect(editDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(editDialog(page)).toHaveCount(0);
  }

  // the checklist box ticks without opening anything
  await page.getByRole('checkbox', { name: 'Draw graphs' }).check();
  await expect(editDialog(page)).toHaveCount(0);
  // the Write button opens the writing space, not the edit dialog
  await page.getByRole('button', { name: 'Write for "Lab report"' }).click();
  await expect(editDialog(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  // Delete deletes, and offers Undo, without opening the dialog
  await page.getByRole('button', { name: 'Delete assignment "Lab report"' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Deleted' })).toBeVisible();
  await expect(editDialog(page)).toHaveCount(0);
});

test('marking done from the card does not open the dialog, and a finished card passes the accessibility check in both themes', async ({ page }) => {
  await ready(page);
  await seed(page, [{ title: 'Quiz prep' }]);
  await page.getByRole('button', { name: 'Mark "Quiz prep" complete' }).click();
  await expect(page.getByRole('button', { name: 'Mark "Quiz prep" incomplete' })).toBeVisible();
  await expect(editDialog(page)).toHaveCount(0);
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
    await page.waitForTimeout(400); // let the theme and the card's background transition finish
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${theme} ${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(' | ')}`)).toEqual([]);
  }
});

test('unfinished work comes first (overdue, then by date, priority and time) and finished work goes to the bottom', async ({ page }) => {
  await ready(page);
  // added in a jumbled order; the newest is added last, so the old list would show it first
  await seed(page, [
    { title: 'Later high', dueDate: '2030-02-01', priority: 'high' },
    { title: 'Soon low', priority: 'low' },
    { title: 'Overdue essay', dueDate: '2020-01-05' },
    { title: 'Soon high', priority: 'high' },
    { title: 'Soon high morning', priority: 'high', dueTime: '09:00' },
    { title: 'Finished long ago', dueDate: '2020-01-01', status: 'completed', progress: 100 }
  ]);
  const order = () =>
    page
      .getByRole('group', { name: /^Open details for/ })
      .evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? '').replace(/^Open details for "(.*)"$/, '$1')));
  await expect
    .poll(order)
    .toEqual(['Overdue essay', 'Soon high morning', 'Soon high', 'Soon low', 'Later high', 'Finished long ago']);

  // finishing an item moves it below the unfinished ones
  await page.getByRole('button', { name: 'Mark "Overdue essay" complete' }).click();
  await expect.poll(order).toEqual(['Soon high morning', 'Soon high', 'Soon low', 'Later high', 'Overdue essay', 'Finished long ago']);
});
