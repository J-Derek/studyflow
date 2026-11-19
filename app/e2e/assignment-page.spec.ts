import { expect, test, type Page } from '@playwright/test';

/** Derek: an assignment opens as its own page with room to work, and it has one kind of note (shown on the page or full screen). */
type A = { id: string; title: string; notes?: string };
type S = {
  userId: string | null;
  isSyncing: boolean;
  assignments: A[];
  drafts: { id: string; body: string }[];
  addAssignment: (a: object) => void;
  saveDraft: (id: string, body: string) => void;
};
type W = { __store: { getState: () => S } };

const ready = async (page: Page, path = '/assignments') => {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};
const add = (page: Page, item: object) =>
  page.evaluate((a) => {
    const s = (window as unknown as W).__store.getState();
    s.addAssignment({ course: 'LAW 101', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0, ...(a as object) });
    const title = (a as { title: string }).title;
    return (window as unknown as W).__store.getState().assignments.find((x) => x.title === title)?.id ?? '';
  }, item);
const card = (page: Page, title: string) => page.getByRole('group', { name: `Open details for "${title}"` });
const notesBox = (page: Page) => page.getByRole('textbox', { name: 'Notes' });

test('a card opens the assignment as its own page; Back returns to the list; a reload stays on the page', async ({ page }) => {
  await ready(page);
  const id = await add(page, { title: 'Contract law essay', subtasks: [{ id: 's1', title: 'Find cases', completed: false }] });

  await card(page, 'Contract law essay').getByText('LAW 101').click();
  await expect(page).toHaveURL(new RegExp(`/assignments/${id}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Contract law essay' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0); // a page, not a pop-up
  await expect(page.getByRole('checkbox', { name: 'Find cases' })).toBeVisible();
  await expect(notesBox(page)).toBeVisible();

  // the browser's Back goes to the list, Forward to the page again
  await page.goBack();
  await expect(page).toHaveURL(/\/assignments$/);
  await expect(card(page, 'Contract law essay')).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1, name: 'Contract law essay' })).toBeVisible();

  // the page's own back link, and the keyboard on a card
  await page.getByRole('button', { name: 'All assignments' }).click();
  await expect(page).toHaveURL(/\/assignments$/);
  await card(page, 'Contract law essay').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/assignments/${id}$`));

  // mark done and back again from the page
  await page.getByRole('button', { name: 'Mark done' }).click();
  await expect(page.getByTestId('done-badge')).toHaveText('Done');
  await page.getByRole('button', { name: 'Mark not done' }).click();
  await expect(page.getByTestId('done-badge')).toHaveCount(0);

  // a reload on the address shows the page
  await page.waitForFunction(() => !(window as unknown as W).__store.getState().isSyncing);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Contract law essay' })).toBeVisible();

  // an address for an assignment that is not there says so, with the way back
  await ready(page, '/assignments/not-a-real-id');
  await expect(page.getByText("This assignment isn't here")).toBeVisible();
  await page.getByRole('button', { name: 'All assignments' }).click();
  await expect(page).toHaveURL(/\/assignments$/);
});

test('an old short note is moved into the notes once, and the card offers one kind of note', async ({ page }) => {
  await ready(page);
  const id = await add(page, { title: 'Moot court', notes: 'Bring the bundle' });
  await page.evaluate((i) => (window as unknown as W).__store.getState().saveDraft(i, 'Opening speech'), id);

  // the card shows one notes line, and no separate "Add a note" / "Write"
  const c = card(page, 'Moot court');
  await expect(c.getByRole('button', { name: /^Write/ })).toHaveCount(0);
  await expect(c.getByText('Add a note', { exact: true })).toHaveCount(0);

  await c.getByText('LAW 101').click();
  await expect(notesBox(page)).toHaveValue('Bring the bundle\n\nOpening speech');
  const stored = () =>
    page.evaluate((i) => {
      const s = (window as unknown as W).__store.getState();
      return { notes: s.assignments.find((a) => a.id === i)?.notes ?? '', draft: s.drafts.find((d) => d.id === i)?.body ?? '' };
    }, id);
  await expect.poll(stored).toEqual({ notes: '', draft: 'Bring the bundle\n\nOpening speech' });

  // opening it again does not add the old note a second time
  await page.getByRole('button', { name: 'All assignments' }).click();
  await card(page, 'Moot court').getByText('LAW 101').click();
  await expect(notesBox(page)).toHaveValue('Bring the bundle\n\nOpening speech');

  // the edit dialog has no notes box of its own
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('textbox', { name: /notes/i })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await expect.poll(stored).toEqual({ notes: '', draft: 'Bring the bundle\n\nOpening speech' });

  // the card previews the notes, and search finds them
  await page.getByRole('button', { name: 'All assignments' }).click();
  await expect(card(page, 'Moot court')).toContainText('Bring the bundle');
  await page.getByLabel('Search assignments').fill('opening speech');
  await expect(card(page, 'Moot court')).toBeVisible();
  await page.getByLabel('Search assignments').fill('nothing like this');
  await expect(card(page, 'Moot court')).toHaveCount(0);
});

test('notes save on the page, Full screen opens them, and closing keeps the text', async ({ page }) => {
  await ready(page);
  await add(page, { title: 'Tort essay' });
  await card(page, 'Tort essay').getByText('LAW 101').click();

  await notesBox(page).fill('Duty of care');
  await expect(page.getByTestId('notes-status')).toContainText('Saved', { timeout: 5000 });

  await page.getByRole('button', { name: 'Full screen' }).click();
  const space = page.getByTestId('writing-space');
  await expect(space).toBeVisible();
  const area = page.getByRole('textbox', { name: 'Your writing' });
  await expect(area).toHaveValue('Duty of care');
  await area.fill('Duty of care and breach');
  await space.getByRole('button', { name: 'Close writing space' }).click();
  await expect(space).toHaveCount(0);
  await expect(notesBox(page)).toHaveValue('Duty of care and breach');

  // what was typed just before Full screen is there too (saved before it opens)
  await notesBox(page).fill('Typed then straight to full screen');
  await page.getByRole('button', { name: 'Full screen' }).click();
  await expect(area).toHaveValue('Typed then straight to full screen');
  await page.keyboard.press('Escape');
  await expect(space).toHaveCount(0);
});

test('a broken address says the assignment is not there instead of an error page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  // (the dev server itself refuses to serve a malformed address on a fresh load, so go there inside the app)
  await page.evaluate(() => {
    window.history.pushState({}, '', '/assignments/%E0%A4%A');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByText("This assignment isn't here")).toBeVisible();
  await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a cold reload of an assignment address shows the assignment, never the not-found message first', async ({ page }) => {
  await ready(page);
  const id = await add(page, { title: 'Cold reload essay' });
  await page.waitForFunction(() => !(window as unknown as W).__store.getState().isSyncing);
  await page.goto(`/assignments/${id}`);
  // from the first paint of the next load, record whether the not-found message ever appears
  await page.addInitScript(() => {
    const w = window as unknown as { __sawMissing: boolean };
    w.__sawMissing = false;
    new MutationObserver(() => {
      if (document.body?.innerText.includes("This assignment isn't here")) w.__sawMissing = true;
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Cold reload essay' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __sawMissing?: boolean }).__sawMissing ?? false)).toBe(false);
});
