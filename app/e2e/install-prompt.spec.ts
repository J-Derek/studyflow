import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** UX round, part F: "Install StudyFlow" from Help, using the browser's own install prompt where there is one. */
type W = { __store: { getState: () => { userId: string | null } }; __prompted?: number };

const ready = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

const openHelp = async (page: Page) => {
  await page.getByRole('button', { name: 'Help' }).first().click();
  return page.getByRole('dialog');
};

const fakeInstallPrompt = (page: Page, outcome: 'accepted' | 'dismissed') =>
  page.evaluate((o) => {
    const w = window as unknown as W;
    w.__prompted = 0;
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => {
      w.__prompted = (w.__prompted ?? 0) + 1;
    };
    e.userChoice = Promise.resolve({ outcome: o });
    window.dispatchEvent(e);
  }, outcome);

test('without the browser offering install, Help still says how to install', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  const dialog = await openHelp(page);
  const card = dialog.getByTestId('install-card');
  await expect(card).toContainText('Install StudyFlow');
  await expect(card).toContainText('Install app');
  await expect(card.getByRole('button')).toHaveCount(0);
});

test('when the browser offers install, Help has an Install button that opens the browser prompt once', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ready(page);
  await fakeInstallPrompt(page, 'accepted');
  const dialog = await openHelp(page);
  const button = dialog.getByRole('button', { name: 'Install the app' });
  await expect(button).toBeVisible();
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await button.click();
  await expect(dialog.getByRole('status')).toContainText('Installed');
  expect(await page.evaluate(() => (window as unknown as W).__prompted)).toBe(1);
  // the prompt can be used only once, so the button goes away
  await expect(dialog.getByRole('button', { name: 'Install the app' })).toHaveCount(0);
});

test('the install card has no accessibility problems in light and dark', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 740 });
  await ready(page);
  await fakeInstallPrompt(page, 'dismissed');
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => (window as unknown as { __store: { getState: () => { setTheme: (x: string) => void } } }).__store.getState().setTheme(t), theme);
    await page.waitForTimeout(300);
    const dialog = await openHelp(page);
    await expect(dialog.getByTestId('install-card')).toBeVisible();
    const axe = await new AxeBuilder({ page }).include('[data-testid="install-card"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${theme} ${v.id}`)).toEqual([]);
    await page.keyboard.press('Escape');
  }
});
