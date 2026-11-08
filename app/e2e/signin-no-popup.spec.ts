import { expect, test, type Page } from '@playwright/test';

type State = { uid: string | null; anonymous: boolean; email: string | null; titles: string[] };
type Store = {
  userId: string | null;
  isAnonymous: boolean;
  userEmail: string | null;
  assignments: Array<{ title: string }>;
  addAssignment: (a: unknown) => void;
};

const ready = (page: Page) =>
  page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => Store } }).__store?.getState().userId);

const state = (page: Page): Promise<State> =>
  page.evaluate(() => {
    const s = (window as unknown as { __store: { getState: () => Store } }).__store.getState();
    return { uid: s.userId, anonymous: s.isAnonymous, email: s.userEmail, titles: s.assignments.map((a) => a.title) };
  });

const addAssignment = (page: Page, title: string) =>
  page.evaluate((t) => {
    (window as unknown as { __store: { getState: () => Store } }).__store
      .getState()
      .addAssignment({ title: t, course: 'TEST 101', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 });
  }, title);

// Two ways a browser can stop the Google window from opening. Both are installed before the page's own code runs.
const BLOCKERS: Record<string, () => void> = {
  'an ad blocker replaced window.open': () => {
    (window as unknown as { open: unknown }).open = function newOpenWrapper() {
      return null;
    };
  },
  'the browser refuses the window (it still looks like the real window.open)': () => {
    const real = window.open;
    (window as unknown as { open: unknown }).open = new Proxy(real, { apply: () => null });
  }
};

/** On the fake Google page the Auth emulator serves: pick the account, or create a new one. */
async function chooseGoogleAccount(page: Page, email: string): Promise<void> {
  await page.waitForURL(/emulator\/auth\/handler/);
  const existing = page.getByText(email, { exact: false });
  if (await existing.count()) {
    await existing.first().click();
  } else {
    await page.locator('button.mdc-button--outlined').first().click(); // "Add new account"
    await page.locator('#autogen-button').click();
    await page.locator('#email-input').fill(email);
    await page.locator('#sign-in').click();
  }
  await page.waitForURL((url) => !url.href.includes('/emulator/'));
}

for (const [name, blocker] of Object.entries(BLOCKERS)) {
  test.describe(name, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.addInitScript(blocker);
    });

    test('a guest signs in on the same page and keeps their records', async ({ page }) => {
      await page.goto('/');
      await ready(page);
      await addAssignment(page, 'Guest record kept');
      const before = await state(page);
      expect(before.anonymous).toBe(true);

      await page.locator('aside').getByRole('button', { name: 'Sign in with Google' }).click();
      const email = `nopopup-${Date.now().toString(36)}@example.com`;
      await chooseGoogleAccount(page, email);

      await ready(page);
      await page.waitForFunction(() => (window as unknown as { __store: { getState: () => Store } }).__store.getState().isAnonymous === false);
      const after = await state(page);
      expect(after.email).toBe(email);
      expect(after.uid).toBe(before.uid); // the guest became the account: nothing moved, nothing lost
      expect(after.titles).toContain('Guest record kept');
      // no leftover error message
      await expect(page.getByRole('alert')).toHaveCount(0);
    });
  });
}

test('signing in to an existing account on the same page merges the guest records into it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(BLOCKERS['an ad blocker replaced window.open']);
  await page.goto('/');
  await ready(page);

  // 1. create the account, give it a record, sign out
  await addAssignment(page, 'Record from the account');
  const email = `merge-${Date.now().toString(36)}@example.com`;
  await page.locator('aside').getByRole('button', { name: 'Sign in with Google' }).click();
  await chooseGoogleAccount(page, email);
  await ready(page);
  await page.waitForFunction(() => (window as unknown as { __store: { getState: () => Store } }).__store.getState().isAnonymous === false);
  await expect.poll(async () => (await state(page)).email).toBe(email);
  // wait until the account's record has reached the database, as it would within a moment in real use
  const uid = (await state(page)).uid;
  await expect
    .poll(async () => {
      const res = await page.request.get(`http://127.0.0.1:8080/v1/projects/studyflow-e2e/databases/(default)/documents/users/${uid}/assignments`, {
        headers: { Authorization: 'Bearer owner' }
      });
      return JSON.stringify(await res.json()).includes('Record from the account');
    })
    .toBe(true);
  await page.getByRole('button', { name: 'Account menu' }).first().click();
  await page.getByRole('dialog', { name: 'Account' }).getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForFunction(() => {
    const s = (window as unknown as { __store?: { getState: () => Store } }).__store?.getState();
    return !!s && !!s.userId && s.isAnonymous === true;
  });

  // 2. a new guest makes a record, then signs in to the SAME account
  await addAssignment(page, 'Record from the guest');
  await page.locator('aside').getByRole('button', { name: 'Sign in with Google' }).click();
  await chooseGoogleAccount(page, email);

  // 3. the app finishes the merge and reloads into the account, holding both records
  await ready(page);
  await expect.poll(async () => (await state(page)).email, { timeout: 30_000 }).toBe(email);
  await expect
    .poll(async () => (await state(page)).titles.sort(), { timeout: 30_000 })
    .toEqual(['Record from the account', 'Record from the guest']);
});
