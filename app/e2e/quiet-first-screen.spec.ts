import { expect, test, type Page } from '@playwright/test';

/** A brand-new student sees one promise and one form: no paragraphs, no empty numbers, no empty lists. The rest comes back after the first save. */
type S = { userId: string | null };
type W = { __store: { getState: () => S } };

const ready = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

const mainWords = (page: Page) =>
  page.locator('main').evaluate((m) => (m as HTMLElement).innerText.split(/\s+/).filter(Boolean).length);

for (const size of [{ width: 1280, height: 800 }, { width: 375, height: 740 }]) {
  test(`first visit at ${size.width}px: one promise, one form, nothing else to read`, async ({ page }) => {
    await page.setViewportSize(size);
    await ready(page);
    const card = page.getByTestId('first-screen');
    await expect(card.getByRole('heading', { name: 'Never miss a deadline.' })).toBeVisible();
    await expect(page.getByLabel('What is due?')).toBeVisible();

    // gone: the paragraph, the three steps, the second heading, the sign-in banner, the zero numbers and the empty lists
    await expect(page.getByText('Add what is due and StudyFlow shows')).toHaveCount(0);
    await expect(page.getByTestId('how-it-works')).toHaveCount(0);
    await expect(page.getByText('What is your next deadline?')).toHaveCount(0);
    await expect(page.getByText('A title and a date is enough.')).toHaveCount(0);
    await expect(page.getByTestId('signin-banner')).toHaveCount(0);
    await expect(page.getByText('Focus sessions')).toHaveCount(0);
    await expect(page.getByText('Upcoming deadlines')).toHaveCount(0);

    // the whole Today page reads in a few seconds, and Save is on screen without scrolling
    expect(await mainWords(page)).toBeLessThanOrEqual(45);
    const save = card.getByRole('button', { name: /Save deadline/ });
    const box = (await save.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
  });
}

test('after the first save the numbers and the lists come back', async ({ page }) => {
  await ready(page);
  await page.getByLabel('What is due?').fill('CAT 1 revision');
  await page.getByRole('button', { name: /Save deadline/ }).click();
  await expect(page.getByRole('heading', { name: 'Next up' })).toBeVisible();
  await expect(page.getByText('Focus sessions')).toBeVisible();
  await expect(page.getByText('Upcoming deadlines')).toBeVisible();
});
