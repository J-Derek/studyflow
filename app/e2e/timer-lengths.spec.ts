import { expect, test } from '@playwright/test';

test('a student can change the timer lengths, and they stick', async ({ page }) => {
  await page.goto('/timer');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);

  await expect(page.getByRole('timer')).toHaveText('25:00');
  await page.getByText('Change timer lengths').click();
  await page.getByLabel('Focus', { exact: true }).fill('45');
  await page.getByLabel('Focus', { exact: true }).press('Enter');

  // the idle clock and the tab label follow right away
  await expect(page.getByRole('timer')).toHaveText('45:00');
  await expect(page.getByRole('button', { name: /Focus \(45m\)/ })).toBeVisible();

  // silly values are held to the limits
  await page.getByLabel('Short break').fill('500');
  await page.getByLabel('Short break').press('Enter');
  await expect(page.getByLabel('Short break')).toHaveValue('60');
  await page.getByLabel('Long break').fill('0');
  await page.getByLabel('Long break').press('Enter');
  await expect(page.getByLabel('Long break')).toHaveValue('1');

  // remembered after a reload
  await page.reload();
  await expect(page.getByRole('timer')).toHaveText('45:00');
  await expect(page.getByRole('button', { name: /Short Break \(60m\)/ })).toBeVisible();
});

test('changing the length while a block is running does not disturb it', async ({ page }) => {
  await page.goto('/timer');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);
  await page.getByRole('button', { name: /^Start/ }).click();
  await page.waitForTimeout(1500);
  await page.getByText('Change timer lengths').click();
  await page.getByLabel('Focus', { exact: true }).fill('90');
  await page.getByLabel('Focus', { exact: true }).press('Enter');
  // still counting down from the 25-minute block, not jumped to 90
  const text = await page.getByRole('timer').innerText();
  expect(text.startsWith('24:')).toBe(true);
  await expect(page.getByRole('button', { name: /Focus \(90m\)/ })).toBeVisible();
});
