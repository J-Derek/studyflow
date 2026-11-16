import { expect, test, type Page } from '@playwright/test';

const ready = (page: Page) =>
  page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);

test('a student can change the timer lengths with Apply, and they stick', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);

  await expect(page.getByRole('timer')).toHaveText('25:00');
  await page.getByText('Change timer lengths').click();
  const apply = page.getByRole('button', { name: 'Apply', exact: true });
  await expect(apply).toBeDisabled(); // nothing changed yet

  await page.getByLabel('Focus', { exact: true }).fill('45');
  // typing alone changes nothing
  await expect(page.getByRole('timer')).toHaveText('25:00');
  await apply.click();
  await expect(page.getByRole('timer')).toHaveText('45:00');
  await expect(page.getByRole('button', { name: /Focus \(45m\)/ })).toBeVisible();

  // silly values are held to the limits when applied
  await page.getByLabel('Short break').fill('500');
  await page.getByLabel('Long break').fill('0');
  await apply.click();
  await expect(page.getByLabel('Short break')).toHaveValue('60');
  await expect(page.getByLabel('Long break')).toHaveValue('1');

  // remembered after a reload
  await page.reload();
  await expect(page.getByRole('timer')).toHaveText('45:00');
  await expect(page.getByRole('button', { name: /Short Break \(60m\)/ })).toBeVisible();
});

test('Cancel puts the saved lengths back', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await page.getByText('Change timer lengths').click();
  await page.getByLabel('Focus', { exact: true }).fill('99');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Focus', { exact: true })).toHaveValue('25');
  await expect(page.getByRole('timer')).toHaveText('25:00');
});

test('while a block runs, the student chooses: next block or restart now', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  await page.getByRole('button', { name: /^Start/ }).click();
  await page.waitForTimeout(1500);
  await page.getByText('Change timer lengths').click();
  await page.getByLabel('Focus', { exact: true }).fill('90');

  // keep the running block: it carries on from 25 minutes
  await page.getByRole('button', { name: 'Apply to the next block' }).click();
  // still the 25-minute block it started as (24:5x, or 25:00 if the clock has not ticked yet on a slow machine), not the new 90
  await expect(page.getByRole('timer')).toHaveText(/^2[45]:/);
  await expect(page.getByLabel('Focus', { exact: true })).toHaveValue('90');

  // restart with the new length
  await page.getByLabel('Focus', { exact: true }).fill('60');
  await page.getByRole('button', { name: 'Restart with the new length' }).click();
  await expect(page.getByRole('timer')).toHaveText('60:00');
});
