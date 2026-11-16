import { expect, test, type Page } from '@playwright/test';

/** The writing done for an assignment can be found in Notes too, clearly marked as coming from Assignments. */
type S = {
  userId: string | null;
  assignments: { id: string; title: string }[];
  addAssignment: (a: object) => void;
  saveDraft: (id: string, body: string) => void;
};
type W = { __store: { getState: () => S } };

async function signedIn(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
}

test('writing for an assignment shows in Notes, is searchable, and opens the writing space', async ({ page }) => {
  await signedIn(page, '/notes');
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.addAssignment({ title: 'Contract law essay', course: 'LAW 101', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 });
    s.addAssignment({ title: 'Nothing written yet', course: 'LAW 101', dueDate: '2030-01-16', priority: 'medium', status: 'pending', progress: 0 });
    const id = (window as unknown as W).__store.getState().assignments.find((a) => a.title === 'Contract law essay')!.id;
    s.saveDraft(id, '## Offer\n\nAn **offer** must be clear.');
  });

  // there are no notes, but the assignment writing is listed, with where it comes from
  const card = page.getByRole('button', { name: /From Assignments: Contract law essay/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText('An offer must be clear.');
  await expect(page.getByText('Nothing written yet')).toHaveCount(0);

  // search finds it by its text, and hides it when nothing matches
  const search = page.getByRole('searchbox', { name: 'Search notes' });
  await search.fill('must be clear');
  await expect(card).toBeVisible();
  await search.fill('pendulum');
  await expect(card).toHaveCount(0);
  await search.fill('');

  // opening it opens the same writing space as on the Assignments page, and edits made there show here
  await card.click();
  const space = page.getByTestId('writing-space');
  await expect(space).toBeVisible();
  await expect(space).toContainText('Writing: Contract law essay');
  const area = page.getByRole('textbox', { name: 'Your writing' });
  await expect(area).toHaveValue('## Offer\n\nAn **offer** must be clear.');
  await area.fill('Acceptance must mirror the offer.');
  await space.getByRole('button', { name: 'Close writing space' }).click();
  await expect(space).toHaveCount(0);
  await expect(page.getByRole('button', { name: /From Assignments: Contract law essay/ })).toContainText('Acceptance must mirror the offer.');
});
