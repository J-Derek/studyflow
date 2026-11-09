import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** PR3: the refreshed "Your account" dialog (who is signed in, whether work is saved, what the plan holds, data). */
type W = {
  __store: {
    getState: () => {
      userId: string | null;
      isAnonymous: boolean;
      isSyncing: boolean;
      setTheme: (t: 'light' | 'dark') => void;
      addAssignment: (a: unknown) => void;
      addNote: (n: object) => string;
      assignments: { title: string }[];
    };
  };
  __auth: { signInOrLinkWithGoogle: () => Promise<unknown> };
};

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  const popupClosed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('button.mdc-button--outlined').first().click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#sign-in').click();
  await popupClosed;
  await page.waitForFunction(() => (window as unknown as W).__store.getState().isAnonymous === false);
}

async function openAccountDialog(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).first().click();
  await page.getByRole('button', { name: 'Your account', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Your account' });
  await expect(dialog).toBeVisible();
  return dialog;
}

for (const [label, width, height] of [['desktop', 1280, 800], ['phone', 375, 700]] as const) {
  test(`${label}: "Your account" shows the account, that work is saved, what the plan holds, and fits the screen`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const email = `account-${label}-${Date.now().toString(36)}@example.com`;
    await signIn(page, email);
    await page.evaluate(() => {
      const s = (window as unknown as W).__store.getState();
      s.addAssignment({ title: 'Dialog essay', course: 'TEST 101', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 });
      s.addNote({ title: 'Dialog note', body: 'x', course: '' });
    });
    await page.waitForFunction(() => !(window as unknown as W).__store.getState().isSyncing);

    const dialog = await openAccountDialog(page);
    await expect(dialog).toContainText(email);
    await expect(dialog).toContainText('Signed in with Google');
    await expect(dialog.getByTestId('account-sync')).toHaveText('Saved to your account', { timeout: 10_000 });
    await expect(dialog.getByTestId('plan-summary')).toContainText('1 assignment');
    await expect(dialog.getByTestId('plan-summary')).toContainText('1 note');
    await expect(dialog.getByRole('button', { name: 'Download my data' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Sign out' })).toBeVisible();

    // nothing sticks out of the screen
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);

    // every control is big enough to tap
    for (const b of await dialog.locator('button, label').all()) {
      const r = (await b.boundingBox())!;
      expect(r.height, await b.innerText()).toBeGreaterThanOrEqual(44);
    }

    // no accessibility problems, light and dark
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => (window as unknown as W).__store.getState().setTheme(t), theme);
      await page.waitForTimeout(400); // let the colour transitions finish, as a11y.spec.ts does
      const results = await new AxeBuilder({ page })
        .include('[role="dialog"][aria-labelledby="backup-modal-title"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${theme}: ${v.id} ${v.nodes.map((n) => n.html.slice(0, 120)).join(' | ')}`)).toEqual([]);
    }

    // Edit profile opens the profile editor in its place
    await dialog.getByRole('button', { name: 'Edit profile' }).click();
    await expect(page.getByRole('dialog', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Your account' })).toHaveCount(0);
    await context.close();
  });
}

test('"Your account" says when it is offline, and restores a backup file', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, `account-offline-${Date.now().toString(36)}@example.com`);

  const dialog = await openAccountDialog(page);
  await context.setOffline(true);
  await expect(dialog.getByTestId('account-sync')).toContainText('Offline');
  await context.setOffline(false);
  await expect(dialog.getByTestId('account-sync')).not.toContainText('Offline');

  const backup = {
    version: 'StudyFlow-v1.2',
    exportedAt: new Date().toISOString(),
    ledger: {
      assignments: [
        { id: 'restored-asg-1', title: 'Restored essay', course: 'TEST 101', dueDate: '2030-02-01', priority: 'high', status: 'pending', progress: 0, createdAt: '2030-01-01T00:00:00.000Z' }
      ],
      sessions: [],
      grades: [],
      notes: []
    }
  };
  await dialog.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(dialog).toContainText('Restored.');
  await page.waitForFunction(() => (window as unknown as W).__store.getState().assignments.some((a) => a.title === 'Restored essay'));

  // a damaged file is refused with a message, and the same file can be chosen again
  const again = await openAccountDialog(page);
  await again.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{not json') });
  await expect(again).toContainText('Could not restore');
  await context.close();
});
