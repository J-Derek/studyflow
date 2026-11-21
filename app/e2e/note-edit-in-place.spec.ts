import { expect, test, type Page } from '@playwright/test';

/** Read a note full screen, tap Edit: the same full-screen view becomes the editor (no second pop-up), and Save goes back to reading. */
type W = { __store: { getState: () => Record<string, (...a: unknown[]) => unknown> & { userId: string | null } } };
const ready = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);

async function openInReader(page: Page) {
  await page.goto('/notes');
  await ready(page);
  const body = Array.from({ length: 60 }, (_, i) => `Line ${i + 1} of the contract notes.`).join('\n');
  await page.evaluate((b) => (window as unknown as W).__store.getState().addNote({ title: 'Contracts', body: b, course: 'LAW 101', pinned: false }), body);
  await page.getByRole('button', { name: /Contracts/ }).first().click();
  await page.getByRole('button', { name: 'Read full screen' }).click();
  await expect(page.getByRole('dialog', { name: 'Contracts' })).toBeVisible();
}

for (const [label, size] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`${label}: Edit from the full-screen reader edits in place, keeps full screen, and Save returns to the reader`, async ({ page }) => {
    await page.setViewportSize(size);
    await openInReader(page);

    // scroll the reader a little, then Edit
    await page.getByRole('dialog').locator('div.overflow-y-auto').evaluate((el) => (el.scrollTop = 300));
    await page.getByRole('button', { name: 'Edit', exact: true }).click();

    const editor = page.locator('[data-fullscreen="true"]');
    await expect(editor).toBeVisible(); // full screen, not a second small pop-up
    const area = page.getByLabel('Note', { exact: true });
    await expect(area).toBeFocused();
    const caretAtEnd = await area.evaluate((el) => (el as HTMLTextAreaElement).selectionStart === (el as HTMLTextAreaElement).value.length);
    expect(caretAtEnd).toBe(true);
    expect(await area.evaluate((el) => el.scrollTop)).toBeGreaterThan(0); // opened part-way down, not at the top
    const vp = page.viewportSize()!;
    const box = await editor.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(box!.height).toBeGreaterThanOrEqual(vp.height - 1);

    await page.keyboard.type(' ADDED');
    await page.getByRole('button', { name: 'Save note' }).click();
    // back in the full-screen reader, showing the saved text
    await expect(page.getByRole('dialog', { name: 'Contracts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close reader' })).toBeVisible();
    await expect(page.getByText('ADDED').first()).toBeVisible();

    await page.reload();
    await ready(page);
    const kept = await page.evaluate(() => (window as unknown as { __store: { getState: () => { notes: { body: string }[] } } }).__store.getState().notes[0]?.body ?? '');
    expect(kept.endsWith('contract notes. ADDED')).toBe(true);
  });
}

test('Escape leaves the edit first (back to the reader), then the reader, then the note; unsaved changes are asked about', async ({ page }) => {
  await openInReader(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('[data-fullscreen="true"]')).toBeVisible();
  await page.keyboard.type(' unsaved');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alert')).toContainText('not saved'); // asks before throwing text away
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('button', { name: 'Close reader' })).toBeVisible(); // back in the reader
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Close reader' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Read full screen' })).toBeVisible(); // the note's normal view
  const body = await page.evaluate(() => (window as unknown as { __store: { getState: () => { notes: { body: string }[] } } }).__store.getState().notes[0]?.body ?? '');
  expect(body).not.toContain('unsaved');
});

test('Escape in the editor with nothing changed goes straight back to the reader', async ({ page }) => {
  await openInReader(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Close reader' })).toBeVisible();
});
