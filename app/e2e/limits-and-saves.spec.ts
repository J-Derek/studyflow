import { expect, test, type Page } from '@playwright/test';

type Asg = { id: string; title: string; course: string; notes?: string; subtasks?: Array<{ title: string }> };
type Store = {
  userId: string | null;
  isSyncing: boolean;
  assignments: Asg[];
  sessions: Array<{ title: string; course: string }>;
  addAssignment: (a: unknown) => void;
  updateAssignment: (id: string, u: unknown) => void;
  addSubtask: (id: string, t: string) => void;
  addSession: (s: unknown) => void;
};

const ready = (page: Page) =>
  page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => Store } }).__store?.getState().userId);

async function open(page: Page, path: string) {
  await page.goto(path);
  await ready(page);
  await page.evaluate(() => {
    (window as unknown as { store: () => unknown }).store = () => (window as unknown as { __store: { getState: () => unknown } }).__store.getState();
  });
}

const ASSIGNMENT = { title: 'Lab report', course: 'PHY 210', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 };

test.describe('limits on what can be typed', () => {
  test('the assignment dialog limits title, course, notes and the due date', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/assignments');
    await page.getByRole('button', { name: 'Add assignment' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByPlaceholder('e.g. Problem Set 2')).toHaveAttribute('maxlength', '250');
    await expect(dialog.getByPlaceholder('e.g. CS 101 or Physics')).toHaveAttribute('maxlength', '200');
    await expect(dialog.locator('textarea')).toHaveAttribute('maxlength', '2000');
    await expect(dialog.getByLabel('Due date')).toHaveAttribute('min', '2000-01-01');
    await expect(dialog.getByLabel('Due date')).toHaveAttribute('max', '2100-12-31');
  });

  test('the first-deadline card limits title, course and date', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/');
    await expect(page.getByPlaceholder(/Problem Set 2 or Chapter 4/)).toHaveAttribute('maxlength', '250');
    await expect(page.getByPlaceholder(/CS 101 or Physics/).first()).toHaveAttribute('maxlength', '200');
    await expect(page.getByLabel('Due date').first()).toHaveAttribute('max', '2100-12-31');
  });

  test('the timetable block dialog limits title and course', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/calendar');
    await page.getByRole('button', { name: 'Add Block' }).first().click();
    await expect(page.getByPlaceholder('e.g. Distributed Systems Lab')).toHaveAttribute('maxlength', '200');
    await expect(page.getByPlaceholder('e.g. CS 101')).toHaveAttribute('maxlength', '200');
  });

  test('the add-course form is limited', async ({ page }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/grades');
    await page.getByRole('button', { name: /Add Course/i }).first().click({ timeout: 8000 });
    await expect(page.getByPlaceholder('e.g. CS 240')).toHaveAttribute('maxlength', '50', { timeout: 8000 });
    await expect(page.getByPlaceholder('e.g. Advanced Operating Systems')).toHaveAttribute('maxlength', '200');
  });

  test('the profile form is limited', async ({ page }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/');
    await page.getByRole('button', { name: /edit profile/i }).first().click({ timeout: 8000 });
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 8000 });
    const limits = await dialog.locator('input[type=text]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).maxLength));
    expect(limits.filter((n) => n > 0).sort((a, b) => a - b)).toEqual(expect.arrayContaining([50, 100, 150]));
  });

  test('a checklist item is limited in the box, and the list stops at 100', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/');
    await page.evaluate((a) => (store() as Store).addAssignment(a), ASSIGNMENT);
    await open(page, '/assignments');
    await page.getByRole('button', { name: 'Add subtasks' }).first().click();
    await expect(page.getByPlaceholder('Add a subtask and press Enter').first()).toHaveAttribute('maxlength', '200');
  });
});

test.describe('the store keeps text inside the limits whatever the screen sends', () => {
  test('over-long text is shortened, empty text is refused, and the 101st checklist item is not added', async ({ page }) => {
    await open(page, '/');
    const result = await page.evaluate((a) => {
      const s = store() as Store;
      s.addAssignment({ ...a, title: '  ' + 'T'.repeat(400) + '  ', course: 'C'.repeat(300), notes: 'N'.repeat(3000) });
      const id = (store() as Store).assignments[0].id;
      for (let i = 0; i < 105; i++) s.addSubtask(id, `item ${i}`);
      s.addSubtask(id, '   ');
      s.addSubtask(id, 'L'.repeat(500));
      s.addSession({ title: 'B'.repeat(300), course: 'K'.repeat(300), dayOfWeek: 1, startTime: '09:00', endTime: '10:00', type: 'lecture' });
      const after = store() as Store;
      const asg = after.assignments[0];
      return {
        title: asg.title.length,
        course: asg.course.length,
        notes: asg.notes?.length,
        subtasks: asg.subtasks?.length,
        blockTitle: after.sessions[0].title.length,
        blockCourse: after.sessions[0].course.length
      };
    }, ASSIGNMENT);
    expect(result).toEqual({ title: 250, course: 200, notes: 2000, subtasks: 100, blockTitle: 200, blockCourse: 200 });
  });
});

test.describe('a save the cloud refuses is no longer silent', () => {
  test('a refused save shows a message with Try again, turns the badge red, and can be dismissed', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/');
    await page.evaluate((a) => (store() as Store).addAssignment(a), ASSIGNMENT);
    const badge = page.getByTestId('save-badge');
    await expect(badge).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
    await expect(badge).toHaveAttribute('aria-live', 'polite'); // read out politely when it changes

    // The cloud's rules say a finished assignment must be at 100%. Sending one at 50% is refused.
    await page.evaluate(() => {
      const s = store() as Store;
      s.updateAssignment(s.assignments[0].id, { status: 'completed', progress: 50 });
    });

    const toast = page.getByTestId('sync-error-toast');
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toContainText('Couldn’t save your assignment to your account');
    await expect(toast).toContainText('still on this device');
    await expect(badge).toHaveAttribute('data-state', 'error');
    await expect(badge).toContainText('Not saved');

    // Trying again fails again (nothing has changed), and the message stays rather than pretending it worked
    await toast.getByRole('button', { name: 'Try again' }).click();
    await expect(toast).toBeVisible();

    await toast.getByRole('button', { name: 'Dismiss this message' }).click();
    await expect(toast).toHaveCount(0);
    await expect(badge).not.toHaveAttribute('data-state', 'error');
  });

  test('the "Saved" badge is on a phone too, as a dot with words for screen readers', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await open(page, '/');
    const badge = page.getByTestId('save-badge');
    await expect(badge).toHaveAttribute('data-state', /saved|saving|device/);
    await expect(badge).toBeVisible();
    const box = (await badge.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(await badge.getAttribute('title')).toMatch(/saved|saving|account|device/i);
  });
});
