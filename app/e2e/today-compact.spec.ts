import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** UX round, part A: a phone-first Today. A title and a date are enough; the rest waits behind "More options". */
type S = { userId: string | null; assignments: { title: string; course: string; kind?: string; priority: string }[]; addAssignment: (a: object) => void; toggleAssignmentComplete: (id: string) => void; setTheme: (t: 'light' | 'dark') => void };
type W = { __store: { getState: () => S } };

const ready = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

test('a deadline can be saved from just a title: two steps, and nothing else is asked', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await ready(page);
  const card = page.getByRole('heading', { name: 'What is your next deadline?' }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
  // the optional fields are not on screen yet
  await expect(page.getByTestId('more-options')).toHaveCount(0);
  await expect(card.getByPlaceholder(/CS 101/)).toHaveCount(0);
  // the Save button is on the first screen, without scrolling
  const save = card.getByRole('button', { name: /Save deadline/ });
  expect((await save.boundingBox())!.y + (await save.boundingBox())!.height).toBeLessThanOrEqual(740);

  await card.getByPlaceholder(/Problem Set 2/).fill('CAT 1 revision');
  await save.click();
  await expect(page.getByRole('heading', { name: 'Next up' })).toBeVisible();
  const a = await page.evaluate(() => (window as unknown as W).__store.getState().assignments[0]!);
  expect(a).toMatchObject({ title: 'CAT 1 revision', course: 'General', priority: 'high' });
  expect(a.kind ?? 'assignment').toBe('assignment');
});

test('"More options" brings back course, kind and priority, and what is chosen is saved', async ({ page }) => {
  await ready(page);
  const card = page.getByRole('heading', { name: 'What is your next deadline?' }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
  const toggle = card.getByRole('button', { name: 'More options' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(card.getByRole('button', { name: 'Fewer options' })).toHaveAttribute('aria-expanded', 'true');
  const more = page.getByTestId('more-options');
  await expect(more.getByPlaceholder(/CS 101/)).toBeVisible();
  await expect(more.getByText('What is it?')).toBeVisible();
  await card.getByPlaceholder(/Problem Set 2/).fill('Final exam');
  await more.getByPlaceholder(/CS 101/).fill('ACS 443');
  await more.locator('label').filter({ hasText: /^Exam$/ }).click();
  await more.getByRole('button', { name: 'low' }).click();
  await card.getByRole('button', { name: /Save deadline/ }).click();
  const a = await page.evaluate(() => (window as unknown as W).__store.getState().assignments[0]!);
  expect(a).toMatchObject({ title: 'Final exam', course: 'ACS 443', kind: 'exam', priority: 'low' });
});

test('the add card comes before the sign-in nudge, and both are accessible in light and dark', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await ready(page);
  const card = page.getByRole('heading', { name: 'What is your next deadline?' });
  const nudge = page.getByTestId('signin-banner');
  expect((await card.boundingBox())!.y).toBeLessThan((await nudge.boundingBox())!.y);
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
    await page.waitForTimeout(300);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${theme} ${v.id}: ${v.nodes.map((n) => n.html.slice(0, 90)).join(' | ')}`)).toEqual([]);
  }
});

test('on a phone the save badge stays quiet while all is well and speaks up when offline', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 740 } });
  const page = await context.newPage();
  await ready(page);
  await expect(page.getByTestId('save-badge')).toBeHidden();
  await context.setOffline(true);
  await expect(page.getByTestId('save-badge')).toBeVisible();
  await expect(page.getByTestId('save-badge')).toContainText('Offline');
  await context.setOffline(false);
  await expect(page.getByTestId('save-badge')).toBeHidden();
  await context.close();
  // on a wider screen it is always there
  const wide = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p2 = await wide.newPage();
  await ready(p2);
  await expect(p2.getByTestId('save-badge')).toBeVisible();
  await wide.close();
});

test('the getting-started list goes away once the student has finished something', async ({ page }) => {
  await ready(page);
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addAssignment({ title: 'First thing', course: 'C', dueDate: '2030-01-15', priority: 'low', status: 'pending', progress: 0 })
  );
  await expect(page.getByText('Getting Started').first()).toBeVisible();
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState() as unknown as { assignments: { id: string }[]; toggleAssignmentComplete: (id: string) => void };
    s.toggleAssignmentComplete(s.assignments[0]!.id);
  });
  await expect(page.getByText('Getting Started')).toHaveCount(0);
});
