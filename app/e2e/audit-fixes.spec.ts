import { expect, test, type Page } from '@playwright/test';

/** Fixes from the independent audit: F1 (a full browser storage must not stop cloud saves) and F4 (profile edits survive an update). */
type A = { id: string; title: string };
type S = {
  userId: string | null;
  assignments: A[];
  addAssignment: (a: object) => void;
  addNote: (n: object) => string;
};
type W = { __store: { getState: () => S; setState: (fn: (s: { user: object }) => object) => void } };

const ready = async (page: Page, path = '/') => {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

test("F1: when the device's storage has no room for the plan, a new assignment still reaches the account, and the student is told", async ({ page }) => {
  await ready(page);
  // Fill this site's storage until less than about 16,000 characters are free: room for the small keys Firebase keeps there,
  // but not for the plan itself once it holds a long note. (A storage with no room at all stops Firebase too.)
  await page.evaluate(() => {
    let chunk = 'x'.repeat(1024 * 1024);
    let i = 0;
    while (chunk.length >= 16_000) {
      try {
        localStorage.setItem(`filler-${i++}`, chunk);
      } catch {
        chunk = chunk.slice(0, chunk.length / 2);
      }
    }
  });
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.addNote({ title: 'Long lecture notes', body: 'n'.repeat(20_000), course: '' });
    s.addAssignment({ title: 'Saved despite a full device', course: 'GEN 1', dueDate: '2030-01-01', priority: 'medium', status: 'pending', progress: 0 });
  });
  const { uid, id } = await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    return { uid: s.userId!, id: s.assignments.find((a) => a.title === 'Saved despite a full device')!.id };
  });
  await expect
    .poll(async () => {
      const res = await page.request.get(`http://127.0.0.1:8080/v1/projects/studyflow-e2e/databases/(default)/documents/users/${uid}/assignments/${id}`, {
        headers: { Authorization: 'Bearer owner' }
      });
      return res.status();
    }, { timeout: 15_000 })
    .toBe(200);
  await expect(page.getByTestId('sync-error-toast')).toContainText('storage is full');
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('filler-')).forEach((k) => localStorage.removeItem(k)));
});

test('F4: an update to the profile while Edit profile is open does not wipe what the student chose', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  await page.getByRole('button', { name: 'Edit profile' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Profile' });
  await dialog.getByLabel('Your school calls it a').selectOption('trimester');
  await dialog.getByPlaceholder('e.g. Amina Wanjiru').fill('Typed but not saved');
  // what a profile snapshot from the cloud does: a new profile object with the same values
  await page.evaluate(() => (window as unknown as W).__store.setState((st) => ({ user: { ...st.user } })));
  await page.waitForTimeout(300);
  await expect(dialog.getByLabel('Your school calls it a')).toHaveValue('trimester');
  await expect(dialog.getByPlaceholder('e.g. Amina Wanjiru')).toHaveValue('Typed but not saved');
  await expect(dialog).toContainText('Trimester ends');
});
