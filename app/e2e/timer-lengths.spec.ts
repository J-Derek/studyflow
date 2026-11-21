import { expect, test, type Page } from '@playwright/test';

/** Tap the time on the ring to change the length of the mode it is in. */
type W = { __store: { getState: () => Record<string, (...a: unknown[]) => unknown> & { userId: string | null; timerSettings: Record<string, number>; timer: { mode: string; status: string; durationSec: number } } } };
const ready = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
const tap = (page: Page) => page.getByTestId('change-length');
const dialog = (page: Page) => page.getByRole('dialog', { name: /^Change the .* length$/ });

test('tapping the time edits the focus length, and it is still there after a reload', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await expect(page.getByRole('timer')).toHaveText('25:00');
  await expect(tap(page)).toHaveAccessibleName('Change focus length, 25 minutes');
  await tap(page).click();
  const d = dialog(page);
  await expect(d).toBeVisible();
  await d.getByLabel('Minutes').fill('20');
  await d.getByRole('button', { name: 'One minute less' }).click();
  await expect(d.getByLabel('Minutes')).toHaveValue('19');
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(d).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveText('19:00');
  await expect(tap(page)).toHaveAccessibleName('Change focus length, 19 minutes');

  await page.reload();
  await ready(page);
  await expect(page.getByRole('timer')).toHaveText('19:00');
  // only the focus length changed
  await page.getByRole('button', { name: /^Short Break/ }).click();
  await expect(page.getByRole('timer')).toHaveText('05:00');
});

test('a break has its own length, Reset to default puts back the app default, and Cancel changes nothing', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await page.getByRole('button', { name: /^Short Break/ }).click();
  await tap(page).click();
  const d = dialog(page);
  await d.getByLabel('Minutes').fill('9');
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('timer')).toHaveText('09:00');

  await tap(page).click();
  await d.getByRole('button', { name: 'Reset to default' }).click();
  await expect(d.getByLabel('Minutes')).toHaveValue('5');
  await d.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('timer')).toHaveText('09:00'); // reset only fills the box; Cancel keeps the saved 9

  await tap(page).click();
  await d.getByRole('button', { name: 'Reset to default' }).click();
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('timer')).toHaveText('05:00');
});

test('a length outside the limits says what it will become, and a blank box keeps the saved length', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await tap(page).click();
  const d = dialog(page);
  await d.getByLabel('Minutes').fill('0');
  await expect(d.getByText('A focus can be 1 to 180 minutes, so 0 will be saved as 1.')).toBeVisible();
  await d.getByLabel('Minutes').fill('500');
  await expect(d.getByText('A focus can be 1 to 180 minutes, so 500 will be saved as 180.')).toBeVisible();
  await d.getByLabel('Minutes').fill('');
  await expect(d.getByText('Empty, so it stays at 25 minutes.')).toBeVisible();
  await d.getByLabel('Minutes').fill('1');
  await expect(d.getByRole('status')).toHaveCount(0);
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('timer')).toHaveText('01:00');
  await expect(tap(page)).toHaveAccessibleName('Change focus length, 1 minute');
});

test('Escape closes the dialog and focus goes back to the time', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await tap(page).click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(tap(page)).toBeFocused();
});

test('while the block runs the time cannot be tapped (it says why); paused, saving restarts the block at the new length', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await page.getByRole('button', { name: /^Start/ }).click();
  await expect(tap(page)).toHaveAttribute('aria-disabled', 'true');
  await tap(page).hover();
  await expect(page.getByRole('tooltip')).toHaveText('Pause to change the length');
  await tap(page).click({ force: true });
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveText(/^2[45]:/); // the running block was not touched

  await page.getByRole('button', { name: 'Pause' }).click();
  await tap(page).click();
  await expect(dialog(page)).toContainText('starts this block again at the new length');
  await dialog(page).getByLabel('Minutes').fill('10');
  await dialog(page).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('timer')).toHaveText('10:00');
});

test('a guest is told the length stays on this device', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await tap(page).click();
  await expect(dialog(page)).toContainText('Saved on this device.');
});

test('the old "Change timer lengths" box is gone, and the time is a 44px button', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await expect(page.getByText('Change timer lengths')).toHaveCount(0);
  const box = await tap(page).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);
});
