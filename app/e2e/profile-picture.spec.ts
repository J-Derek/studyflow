import { expect, test } from '@playwright/test';

test('a student can choose, change back and remove a profile picture', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);
  // a real picture, drawn in the browser
  const base64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 60;
    c.height = 30;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, 60, 30);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  const PNG = Buffer.from(base64, 'base64');
  await page.getByRole('button', { name: /edit profile/i }).first().click();
  const dialog = page.getByRole('dialog');

  await dialog.locator('input[type=file]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  // a small square picture is shown in the dialog
  const img = dialog.locator('img').first();
  await expect(img).toBeVisible();
  expect(await img.getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/);
  await expect(dialog.getByRole('button', { name: 'Remove' })).toBeVisible();

  // it is kept after a reload
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: /edit profile/i }).first().click();
  await expect(page.getByRole('dialog').locator('img').first()).toBeVisible();

  // a file that is not a picture is refused politely
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.getByRole('alert')).toContainText('picture');

  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('dialog').locator('img')).toHaveCount(0);
});
