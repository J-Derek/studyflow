import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** PR4: a page for addresses the app does not have, a calm screen when a page crashes, and an offline banner. */
type S = {
  userId: string | null;
  assignments: unknown;
  addAssignment: (a: object) => void;
  setTheme: (t: 'light' | 'dark') => void;
};
type W = { __store: { getState: () => S; setState: (s: object) => void } };

const ready = async (page: Page, path = '/') => {
  await page.goto(path);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: an unknown address shows "We can't find that page", with a way back, and no accessibility problems`, async ({ page }) => {
    await ready(page, '/this-page-does-not-exist');
    await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
    await page.waitForTimeout(400);

    await expect(page.getByRole('heading', { level: 1, name: 'We can’t find that page' })).toBeVisible();
    await expect(page.getByTestId('not-found')).toContainText('nothing was changed');
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
    // the header says so too, and none of the six menu items claims to be the current page
    await expect(page.locator('header')).toContainText('Page not found');
    await expect(page.locator('[aria-current="page"]')).toHaveCount(0);

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);

    // every control is big enough to tap
    for (const b of await page.getByTestId('not-found').locator('button').all()) {
      expect((await b.boundingBox())!.height, await b.innerText()).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole('button', { name: 'Go to Today' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('not-found')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(0);
  });
}

test('a real address is not treated as unknown, and Back returns from the not-found page', async ({ page }) => {
  await ready(page, '/grades');
  await expect(page.getByTestId('not-found')).toHaveCount(0);
  await page.evaluate(() => {
    window.history.pushState({}, '', '/typo');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByTestId('not-found')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('not-found')).toHaveCount(0);
});

test('a page that crashes shows a calm screen, the menus still work, and the data can be downloaded', async ({ page }) => {
  await ready(page, '/notes');
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addAssignment({ title: 'KEEP-ME-777', course: 'TEST 101', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 })
  );
  // let the saved copy on this device catch up
  await page.waitForFunction(() => (localStorage.getItem('studyflow_storage_v1') ?? '').includes('KEEP-ME-777'));

  // Make the Notes page's own data unusable, the way a bad record would: drawing the list now throws.
  await page.evaluate(() => (window as unknown as W).__store.setState({ notes: 'broken' }));
  const screen = page.getByTestId('error-screen');
  await expect(screen).toBeVisible();
  await expect(screen).toContainText('Something went wrong');
  await expect(screen).toContainText('has not been deleted');

  // the menu around the broken page still works, and going to another page tries again
  await expect(page.getByRole('button', { name: 'Add assignment' }).first()).toBeVisible();
  await page.getByRole('link', { name: /^Today/ }).first().click();
  await expect(page.getByTestId('error-screen')).toHaveCount(0);
  await expect(page.locator('main')).toContainText(/Today|assignment/i);
  await page.goBack();
  await expect(screen).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('[data-testid="error-screen"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // "Download my data" saves the copy from this device, including the record, without using the broken page
  const download = page.waitForEvent('download');
  await screen.getByRole('button', { name: 'Download my data' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^studyflow-data-\d{4}-\d{2}-\d{2}\.json$/);
  const text = await (await import('node:fs/promises')).readFile((await file.path())!, 'utf8');
  expect(text).toContain('KEEP-ME-777');

  // Put the notes right again (the forced value was also saved on this device) and Reload brings the page back
  await page.evaluate(() => (window as unknown as W).__store.setState({ notes: [] }));
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await expect(page.getByTestId('error-screen')).toHaveCount(0);
  await page.goto('/assignments');
  await expect(page.getByText('KEEP-ME-777').first()).toBeVisible();
});

test('the offline banner shows while offline, says work is kept, and goes away when back online', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await ready(page);
  await expect(page.getByTestId('offline-banner')).toHaveCount(0);
  await context.setOffline(true);
  const banner = page.getByTestId('offline-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('changes stay on this device');
  const axe = await new AxeBuilder({ page }).include('[data-testid="offline-banner"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await context.setOffline(false);
  await expect(banner).toHaveCount(0);
  await context.close();
});
