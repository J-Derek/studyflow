import { expect, test } from '@playwright/test';

/** A note can be written full screen: the editor fills the window, typing and formatting keep working, and Escape steps back out. */
type W = { __store?: { getState: () => { userId: string | null } } };

test('the note editor goes full screen and back, keeping what was typed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/notes');
  await page.waitForFunction(() => !!(window as unknown as W).__store?.getState().userId);
  await page.getByRole('button', { name: 'New note' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Physics');
  const body = dialog.getByLabel('Note', { exact: true });
  await body.fill('First line');

  await dialog.getByRole('button', { name: 'Full screen' }).click();
  await expect(dialog).toHaveAttribute('data-fullscreen', 'true');
  const box = (await dialog.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(1270);
  expect(box.height).toBeGreaterThanOrEqual(790);
  expect((await body.boundingBox())!.height).toBeGreaterThan(400);

  // still editable, and the formatting buttons still work
  await body.press('End');
  await body.pressSequentially(' and more');
  await dialog.getByRole('button', { name: 'Bold' }).click();
  await expect(body).toHaveValue(/First line and more.*\*\*/s);

  // Escape leaves full screen first; the note is still open with the text
  await page.keyboard.press('Escape');
  await expect(dialog).not.toHaveAttribute('data-fullscreen', 'true');
  await expect(dialog.getByRole('button', { name: 'Full screen' })).toBeVisible();
  await expect(body).toHaveValue(/First line and more/);

  await dialog.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText('Physics').first()).toBeVisible();
});
