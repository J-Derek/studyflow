import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Actions that cannot be undone ask first, in an accessible dialog where Cancel has focus and Escape cancels. */
type S = {
  userId: string | null;
  isAnonymous: boolean;
  userEmail: string | null;
  grades: { courseCode: string }[];
  sessions: { title: string }[];
  addCourseGrade: (c: object) => void;
  addSession: (s: object) => void;
};
type W = { __store: { getState: () => S }; __auth: { signInOrLinkWithGoogle: () => Promise<unknown> } };

async function ready(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
}
const state = (page: Page) => page.evaluate(() => (window as unknown as W).__store.getState());
const confirmDialog = (page: Page) => page.getByRole('alertdialog');

test('deleting a course asks first: Cancel and Escape keep it, the dialog is accessible, confirming deletes it', async ({ page }) => {
  await ready(page, '/grades');
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.addCourseGrade({ courseCode: 'CS 301', courseName: 'Algorithms', credits: 3, targetLetter: 'A', color: '#4F46E5', assessments: [{ id: 'm', name: 'Midterm', weight: 100, score: 80 }] });
    s.addCourseGrade({ courseCode: 'LAW 101', courseName: 'Contracts', credits: 2, targetLetter: 'B', color: '#0EA5E9', assessments: [{ id: 'x', name: 'Exam', weight: 100 }] });
  });
  const del = page.getByRole('button', { name: 'Delete course CS 301' });

  await del.click();
  await expect(confirmDialog(page)).toHaveAccessibleName('Delete CS 301?');
  await expect(confirmDialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
  const axe = await new AxeBuilder({ page }).include('[data-testid="confirm-dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(confirmDialog(page)).toHaveCount(0);
  expect((await state(page)).grades.map((g) => g.courseCode)).toContain('CS 301');

  await del.click();
  await page.keyboard.press('Escape');
  await expect(confirmDialog(page)).toHaveCount(0);
  expect((await state(page)).grades.map((g) => g.courseCode)).toContain('CS 301');

  await del.click();
  await confirmDialog(page).getByRole('button', { name: 'Delete course' }).click();
  await expect.poll(async () => (await state(page)).grades.map((g) => g.courseCode)).toEqual(['LAW 101']);
});

test('the quick delete on a timetable block asks first', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page, '/calendar');
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addSession({ title: 'Data Structures', course: 'CS 301', dayOfWeek: new Date().getDay(), startTime: '10:00', endTime: '11:00', type: 'lecture' })
  );
  const del = page.getByRole('button', { name: 'Delete block Data Structures' });
  await del.click();
  await expect(confirmDialog(page)).toHaveAccessibleName('Delete Data Structures?');
  await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click();
  expect((await state(page)).sessions).toHaveLength(1);
  await del.click();
  await confirmDialog(page).getByRole('button', { name: 'Delete block' }).click();
  await expect.poll(async () => (await state(page)).sessions.length).toBe(0);
});

test('signing out asks first; Cancel keeps you signed in', async ({ page }) => {
  const email = `confirm-${Date.now().toString(36)}@example.com`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page, '/');
  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  const closed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('button.mdc-button--outlined').first().click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#sign-in').click();
  await closed;
  await page.waitForFunction((e) => (window as unknown as W).__store.getState().userEmail === e, email, { timeout: 30_000 });

  const openMenu = async () => {
    await page.getByRole('button', { name: 'Account menu' }).first().click();
    await page.getByRole('dialog', { name: 'Account' }).getByRole('button', { name: 'Sign out', exact: true }).click();
  };
  await openMenu();
  await expect(confirmDialog(page)).toHaveAccessibleName('Sign out?');
  await expect(confirmDialog(page)).toContainText('Your work stays saved in your account');
  await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(500);
  expect(await state(page)).toMatchObject({ isAnonymous: false, userEmail: email });

  await openMenu();
  await confirmDialog(page).getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForFunction(() => {
    const s = (window as unknown as Partial<W>).__store?.getState();
    return !!s?.userId && s.isAnonymous === true;
  }, undefined, { timeout: 30_000 });
});
