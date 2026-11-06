import { expect, test } from '@playwright/test';

for (const [name, width, height] of [['phone', 375, 760], ['desktop', 1280, 800]] as const) {
  test(`a new student can add, edit and add more straight from Today (${name})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);

    // the top bar stays one line even with the sign-in button
    const header = await page.locator('header').boundingBox();
    expect(header!.height).toBeLessThan(64);

    // 1) add the first assignment with the quick card
    await page.getByPlaceholder(/Problem Set 2/).fill('Essay on Kenyan law');
    await page.getByPlaceholder(/CS 101/).first().fill('LAW 101');
    await page.getByRole('button', { name: /Save deadline/ }).click();

    // it is shown right away, with a message saying where to change it
    await expect(page.getByRole('heading', { name: 'Next up' })).toBeVisible();
    await expect(page.getByText('Essay on Kenyan law').first()).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Edit');

    // 2) edit it without leaving Today
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder(/Problem Set 2/)).toHaveValue('Essay on Kenyan law');
    await dialog.getByPlaceholder(/Problem Set 2/).fill('Essay on Kenyan constitutional law');
    await dialog.getByRole('button', { name: /Save changes/ }).click();
    await expect(page.getByText('Essay on Kenyan constitutional law').first()).toBeVisible();

    // 3) the deadline list has its own edit and add controls
    await expect(page.getByRole('button', { name: /Edit assignment "Essay on Kenyan constitutional law"/ })).toBeVisible();
    await page.getByRole('button', { name: 'Add assignment' }).last().click();
    await expect(page.getByRole('dialog')).toContainText('New assignment');
    await context.close();
  });
}

test('a short note can be added to an assignment and is shown afterwards', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);
  await page.getByPlaceholder(/Problem Set 2/).fill('Lab report');
  await page.getByPlaceholder(/CS 101/).first().fill('PHY 210');
  await page.getByRole('button', { name: /Save deadline/ }).click();

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('dialog').getByPlaceholder(/lecturer said/).fill('Include the error analysis. Lecturer wants graphs in colour.');
  await page.getByRole('dialog').getByRole('button', { name: /Save changes/ }).click();
  await expect(page.getByText('Include the error analysis.').first()).toBeVisible(); // on Today

  await page.getByRole('link', { name: 'Assignments' }).first().click().catch(() => undefined);
  await page.goto('/assignments');
  await expect(page.getByText('Include the error analysis.').first()).toBeVisible(); // on Assignments
  await expect(page.getByRole('button', { name: /edit note for Lab report/i })).toBeVisible();
});
