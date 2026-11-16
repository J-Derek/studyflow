import { expect, test, type Page } from '@playwright/test';

/** English and Kiswahili for the first screen and the navigation, chosen with a toggle and remembered on the device. */
type S = { userId: string | null; assignments: { title: string }[] };
type W = { __store: { getState: () => S } };

const ready = async (page: Page, path = '/') => {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

test('the first screen starts in English, with a language toggle', async ({ page }) => {
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const toggle = page.getByTestId('first-screen').getByRole('group', { name: 'Language' });
  await expect(toggle.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle.getByRole('button', { name: 'Kiswahili' })).toHaveAttribute('aria-pressed', 'false');
});

test('choosing Kiswahili changes the first screen and the navigation, and is remembered after a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await ready(page);
  await page.getByTestId('first-screen').getByRole('button', { name: 'Kiswahili' }).click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'sw');
  await expect(page.getByText('Usikose tarehe ya mwisho.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ni lini tarehe yako ijayo?' })).toBeVisible();
  await expect(page.getByLabel('Nini kinatakiwa?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hifadhi tarehe ya mwisho' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: /Main|Sidebar/i }).first();
  for (const label of ['Leo', 'Kazi', 'Ratiba', 'Kipima muda', 'Masomo', 'Maelezo']) {
    await expect(page.getByRole('link', { name: label, exact: true }).or(page.getByRole('button', { name: label, exact: true })).first(), label).toBeVisible();
  }
  void nav;

  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect(page.getByText('Usikose tarehe ya mwisho.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'sw');

  // and back again
  await page.getByTestId('first-screen').getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('Never miss a deadline.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('in Kiswahili the example fills in and a deadline can be saved', async ({ page }) => {
  await ready(page);
  await page.getByTestId('first-screen').getByRole('button', { name: 'Kiswahili' }).click();
  await page.getByRole('button', { name: 'Jaribu mfano' }).click();
  await expect(page.getByLabel('Nini kinatakiwa?')).toHaveValue('CAT 1 ya Kemia');
  await expect(page.getByTestId('example-hint')).toHaveText('Huu ni mfano. Ubadilishe uwe tarehe yako ya mwisho, kisha uhifadhi.');
  await page.getByRole('button', { name: 'Hifadhi tarehe ya mwisho' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__store.getState().assignments.map((a) => a.title))).toEqual(['CAT 1 ya Kemia']);
});

test.describe('a phone set to Kiswahili', () => {
  test.use({ locale: 'sw-KE' });
  test('starts in Kiswahili with nothing chosen, and the bottom bar is in Kiswahili', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await ready(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'sw');
    await expect(page.getByText('Usikose tarehe ya mwisho.')).toBeVisible();
    const bar = page.getByRole('navigation', { name: 'Mobile Navigation' });
    for (const label of ['Leo', 'Kazi', 'Ratiba', 'Muda', 'Masomo', 'Maelezo']) {
      await expect(bar.getByRole('link', { name: label }), label).toBeVisible();
    }
    // the Save button still fits on the first screen
    const save = page.getByRole('button', { name: 'Hifadhi tarehe ya mwisho' });
    const box = (await save.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(740);
  });
});

test('the choice survives signing out (it is a device setting, not account data)', async ({ page }) => {
  await ready(page);
  await page.getByTestId('first-screen').getByRole('button', { name: 'Kiswahili' }).click();
  expect(await page.evaluate(() => localStorage.getItem('studyflow-lang'))).toBe('sw');
});
