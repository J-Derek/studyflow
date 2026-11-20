import { expect, test, type Page } from '@playwright/test';

/** Share a note by link: a read-only copy anyone with the link can open without signing in, until the owner stops sharing. */
type S = { userId: string | null; addNote: (n: { title: string; body: string; course: string }) => string; notes: { id: string; shareId?: string }[] };
type W = { __store: { getState: () => S } };

const ready = async (page: Page, path: string) => {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

test('share a note, open the link signed out, then stop sharing and the link is dead', async ({ page, browser, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ready(page, '/notes');
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addNote({ title: 'Contract law week 3', body: '## Offer\n\nAn **offer** must be clear.\n\n<script>alert(1)</script>', course: 'LAW 101' })
  );

  await page.getByRole('button', { name: 'Share note Contract law week 3' }).click();
  const dialog = page.getByRole('dialog', { name: /Share/ });
  await dialog.getByRole('button', { name: 'Create link' }).click();
  const urlBox = dialog.getByTestId('share-url');
  await expect(urlBox).toHaveValue(/\/s\/[A-Za-z0-9_-]{24}$/);
  const url = await urlBox.inputValue();
  const id = url.split('/s/')[1];
  // the note keeps its link id
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__store.getState().notes[0]?.shareId)).toBe(id);

  // on a computer the link is copied, with a short message
  await dialog.getByRole('button', { name: 'Copy link' }).click();
  await expect(dialog.getByTestId('share-status')).toHaveText('Link copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);

  // someone else, in a separate browser with no account of theirs, opens the link
  const other = await browser.newContext();
  const viewer = await other.newPage();
  const viewerErrors: string[] = [];
  viewer.on('pageerror', (e) => viewerErrors.push(e.message));
  await viewer.goto(`/s/${id}`);
  await expect(viewer.getByRole('heading', { level: 1, name: 'Contract law week 3' })).toBeVisible();
  const body = viewer.getByTestId('shared-note-body');
  await expect(body.getByRole('heading', { name: 'Offer' })).toBeVisible();
  await expect(body.locator('strong')).toHaveText('offer');
  // typed HTML stays text: no script element is made from it
  await expect(body).toContainText('<script>alert(1)</script>');
  await expect(body.locator('script')).toHaveCount(0);
  await expect(viewer.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(viewer.getByRole('button', { name: 'Save a copy to my notes' })).toHaveCount(0); // a guest, not signed in
  await expect(viewer.getByText('Sign in to save a copy to your own notes.')).toBeVisible();

  // the owner updates the copy, and the viewer sees the new text after a reload
  await page.evaluate(() => {
    const s = (window as unknown as { __store: { getState: () => { notes: { id: string }[]; updateNote: (id: string, u: { body: string }) => void } } }).__store.getState();
    s.updateNote(s.notes[0].id, { body: 'Acceptance must mirror the offer.' });
  });
  await dialog.getByRole('button', { name: 'Update shared copy' }).click();
  await expect(dialog.getByTestId('share-status')).toHaveText('Shared copy updated.');
  await viewer.reload();
  await expect(viewer.getByTestId('shared-note-body')).toContainText('Acceptance must mirror the offer.');

  // the owner stops sharing: the link is dead and the note forgets it
  await dialog.getByRole('button', { name: 'Stop sharing' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Stop sharing' }).click();
  await expect(dialog.getByTestId('share-status')).toHaveText('Sharing stopped. The link no longer works.');
  await expect(dialog.getByRole('button', { name: 'Create link' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__store.getState().notes[0]?.shareId ?? null)).toBeNull();

  await viewer.reload();
  await expect(viewer.getByRole('heading', { name: 'This link no longer works' })).toBeVisible();
  // a made-up link says the same
  await viewer.goto('/s/not-a-real-link-not-a-real-link');
  await expect(viewer.getByRole('heading', { name: 'This link no longer works' })).toBeVisible();
  expect(viewerErrors).toEqual([]);
  await other.close();
});
