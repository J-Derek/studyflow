import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Student-facing polish: the Week/Month choice is kept, Due soon stands out, important days get a ring, the timer's sound card follows the mode, a living flame and a glowing Start button. */
type S = {
  userId: string | null;
  addAssignment: (a: object) => void;
  setTheme: (t: 'light' | 'dark') => void;
};
type W = { __store: { getState: () => S; setState: (p: object) => void } };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function ready(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
}

/** Waits for theme colour transitions and one-off animations to end (the slow flame and glow loops are left running). */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.effect?.getTiming().iterations === Infinity || a.playState !== 'running')
  );
}

async function seedDeadlines(page: Page): Promise<void> {
  await page.evaluate(
    ([over, today, tomorrow, later]) => {
      const s = (window as unknown as W).__store.getState();
      s.addAssignment({ title: 'Lab write-up', course: 'PHY 101', dueDate: over, priority: 'medium', status: 'pending', progress: 0 });
      s.addAssignment({ title: 'Algorithms final', kind: 'exam', course: 'CS 301', dueDate: today, priority: 'medium', status: 'pending', progress: 0 });
      s.addAssignment({ title: 'Problem set 3', course: 'MAT 201', dueDate: tomorrow, priority: 'medium', status: 'pending', progress: 0 });
      s.addAssignment({ title: 'Read chapter 4', kind: 'reading', course: 'LAW 101', dueDate: later, priority: 'low', status: 'pending', progress: 0 });
    },
    [iso(plus(-2)), iso(new Date()), iso(plus(1)), iso(plus(3))] as const
  );
}

test('the Month choice is still there after a reload, and so is Week after switching back', async ({ page }) => {
  await ready(page, '/calendar');
  await page.getByRole('button', { name: 'month', exact: true }).click();
  await expect(page.getByTestId('month-grid')).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect(page.getByRole('button', { name: 'month', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('month-grid')).toBeVisible();

  await page.getByRole('button', { name: 'week', exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect(page.getByRole('button', { name: 'week', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('month-grid')).toHaveCount(0);
});

test('Due soon says overdue, today and tomorrow in words, each with its own colour', async ({ page }) => {
  await ready(page, '/calendar');
  await seedDeadlines(page);
  const strip = page.getByTestId('due-soon');
  const item = (title: string) => strip.getByRole('listitem').filter({ hasText: title });
  await expect(item('Lab write-up')).toContainText('Overdue');
  await expect(item('Lab write-up')).toHaveAttribute('data-tone', 'overdue');
  await expect(item('Algorithms final')).toContainText('Today');
  await expect(item('Algorithms final')).toHaveAttribute('data-tone', 'today');
  await expect(item('Problem set 3')).toContainText('Tomorrow');
  await expect(item('Problem set 3')).toHaveAttribute('data-tone', 'tomorrow');
  // something overdue or due today makes the whole strip stand out
  await expect(strip).toHaveAttribute('data-urgent', 'true');
});

test('a day with an unfinished exam gets an attention ring that is also spoken; a reading alone does not', async ({ page }) => {
  await ready(page, '/calendar');
  await seedDeadlines(page);
  await page.getByRole('button', { name: 'month', exact: true }).click();
  const todayCell = page.locator(`[data-date="${iso(new Date())}"]`);
  await expect(todayCell).toHaveAttribute('data-attention', 'true');
  await expect(todayCell).toHaveAccessibleName(/needs attention/);
  const readingDay = page.locator(`[data-date="${iso(plus(3))}"]`);
  await expect(readingDay).not.toHaveAttribute('data-attention', 'true');
  await expect(readingDay).not.toHaveAccessibleName(/needs attention/);
  const ring = todayCell.getByTestId('attention-ring');
  await expect(ring).toHaveCount(1);
  expect(await ring.evaluate((el) => getComputedStyle(el).animationName)).not.toBe('none');
});

test('with "reduce motion" on, the attention ring stands still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page, '/calendar');
  await seedDeadlines(page);
  await page.getByRole('button', { name: 'month', exact: true }).click();
  const ring = page.locator(`[data-date="${iso(new Date())}"]`).getByTestId('attention-ring');
  await expect(ring).toHaveCount(1);
  expect(await ring.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('the Timetable (both views) stays accessible in light and dark', async ({ page }) => {
  await ready(page, '/calendar');
  await seedDeadlines(page);
  for (const view of ['week', 'month'] as const) {
    await page.getByRole('button', { name: view, exact: true }).click();
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
      await settle(page);
      const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(axe.violations.map((v) => `${view}/${theme}: ${v.id} ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
    }
  }
});

test('the "Choose sound for" switch follows the timer mode, and can still be switched by hand', async ({ page }) => {
  await ready(page, '/timer');
  const group = page.getByRole('group', { name: 'Choose sound for' });
  const focus = group.getByRole('button', { name: 'When I focus' });
  const onBreaks = group.getByRole('button', { name: 'On breaks' });
  await expect(focus).toHaveAttribute('aria-pressed', 'true');

  // a manual switch works
  await onBreaks.click();
  await expect(onBreaks).toHaveAttribute('aria-pressed', 'true');

  // changing the timer mode brings the card back in line with it
  await page.getByRole('button', { name: /^Short Break/ }).click();
  await expect(onBreaks).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Focus \(/ }).click();
  await expect(focus).toHaveAttribute('aria-pressed', 'true');

  // and a manual switch still works in the new mode
  await onBreaks.click();
  await expect(onBreaks).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Long Break/ }).click();
  await page.getByRole('button', { name: /^Focus \(/ }).click();
  await expect(focus).toHaveAttribute('aria-pressed', 'true');
});

test('finished focus sessions show a gently moving flame; unfinished ones and "reduce motion" stay still', async ({ page }) => {
  await ready(page, '/timer');
  await page.evaluate(() => (window as unknown as W).__store.setState({ pomodorosCompleted: 2 }));
  const flames = page.getByTestId('focus-flame');
  await expect(flames).toHaveCount(4);
  await expect(page.locator('[data-testid="focus-flame"][data-lit="true"]')).toHaveCount(2);
  const lit = page.locator('[data-testid="focus-flame"][data-lit="true"]').first();
  const anim = await lit.evaluate((el) => {
    const moving = [el, ...Array.from(el.querySelectorAll('*'))].map((n) => getComputedStyle(n)).find((c) => c.animationName !== 'none');
    return moving ? { name: moving.animationName, s: parseFloat(moving.animationDuration) } : null;
  });
  expect(anim).not.toBeNull();
  expect(anim!.s).toBeGreaterThanOrEqual(1.5); // slow and gentle
  const unlitMoving = await page.locator('[data-testid="focus-flame"][data-lit="false"]').first().evaluate((el) =>
    [el, ...Array.from(el.querySelectorAll('*'))].some((n) => getComputedStyle(n).animationName !== 'none')
  );
  expect(unlitMoving).toBe(false);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const stillMoving = await lit.evaluate((el) => [el, ...Array.from(el.querySelectorAll('*'))].some((n) => getComputedStyle(n).animationName !== 'none'));
  expect(stillMoving).toBe(false);
});

test('the Focus timer page stays accessible in light and dark', async ({ page }) => {
  await ready(page, '/timer');
  await page.evaluate(() => (window as unknown as W).__store.setState({ pomodorosCompleted: 2 }));
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
    await settle(page);
    const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(axe.violations.map((v) => `${theme}: ${v.id} ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  }
});

test('the Start focus timer button on Today glows softly, and holds still with "reduce motion"', async ({ page }) => {
  await ready(page, '/');
  const start = page.getByRole('button', { name: 'Start focus timer' });
  await expect(start).toBeVisible();
  const style = await start.evaluate((el) => {
    const c = getComputedStyle(el);
    return { name: c.animationName, s: parseFloat(c.animationDuration) };
  });
  expect(style.name).toBe('sf-glow');
  expect(style.s).toBeGreaterThanOrEqual(2);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await start.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  // still visibly highlighted without the motion
  expect(await start.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
    await settle(page);
    const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(axe.violations.map((v) => `${theme}: ${v.id} ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  }
});
