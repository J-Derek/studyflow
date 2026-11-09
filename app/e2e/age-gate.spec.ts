import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** PR5: the age question before the first sign-in. Under 13 gets no account; 13 to 17 need the guardian tick; the answer reaches the account. */
type W = {
  __store: { getState: () => { userId: string | null; isAnonymous: boolean } };
};

const ready = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

const signInButton = (page: Page) => page.locator('header').getByRole('button', { name: 'Sign in with Google' });

async function userDoc(uid: string): Promise<Record<string, { mapValue?: { fields: Record<string, { stringValue?: string; booleanValue?: boolean }> } }> | null> {
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/studyflow-e2e/databases/(default)/documents/users/${uid}`, { headers: { Authorization: 'Bearer owner' } });
  if (res.status === 404) return null;
  return ((await res.json()) as { fields?: never }).fields ?? null;
}

test('the question appears before Google opens, is accessible in light and dark, and Cancel opens nothing', async ({ page }) => {
  await ready(page);
  let popups = 0;
  page.on('popup', () => popups++);
  await signInButton(page).click();
  const dialog = page.getByTestId('age-gate');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Before you sign in' })).toBeVisible();
  await expect(dialog).toContainText('We do not ask for your date of birth');
  await expect(dialog.getByRole('button', { name: 'Continue to sign in' })).toBeDisabled(); // no answer yet

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme);
    await page.waitForTimeout(300);
    const axe = await new AxeBuilder({ page }).include('[data-testid="age-gate"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${theme} ${v.id}`)).toEqual([]);
  }
  for (const b of await dialog.locator('label, button').all()) {
    expect((await b.boundingBox())!.height, await b.innerText()).toBeGreaterThanOrEqual(44);
  }

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(popups).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('studyflow_age_confirmed'))).toBeNull();
});

test('under 13: no account, a kind explanation, no Google window, nothing stored; they carry on as a guest', async ({ page }) => {
  await ready(page);
  let popups = 0;
  page.on('popup', () => popups++);
  await signInButton(page).click();
  const dialog = page.getByTestId('age-gate');
  await dialog.getByLabel('Under 13').check();
  await expect(page.getByTestId('age-under13')).toContainText('keep using StudyFlow as a guest');
  await expect(dialog.getByRole('button', { name: 'Continue to sign in' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Keep using as a guest' }).click();
  await expect(dialog).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(popups).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('studyflow_age_confirmed'))).toBeNull();
  expect(await page.evaluate(() => (window as unknown as W).__store.getState().isAnonymous)).toBe(true);
});

test('13 to 17 needs the parent or guardian tick, then signs in and the account keeps the answer', async ({ page }) => {
  await ready(page);
  await signInButton(page).click();
  const dialog = page.getByTestId('age-gate');
  await dialog.getByLabel('13 to 17').check();
  const next = dialog.getByRole('button', { name: 'Continue to sign in' });
  await expect(next).toBeDisabled();
  await dialog.getByLabel(/parent or guardian knows/).check();
  await expect(next).toBeEnabled();

  const popupPromise = page.waitForEvent('popup');
  await next.click();
  const popup = await popupPromise;
  const closed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('button.mdc-button--outlined').first().click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#email-input').fill(`teen-${Date.now().toString(36)}@example.com`);
  await popup.locator('#sign-in').click();
  await closed;
  await page.waitForFunction(() => (window as unknown as W).__store.getState().isAnonymous === false);
  const uid = await page.evaluate(() => (window as unknown as W).__store.getState().userId as string);

  // the answer is in the account: band, guardian tick and a time, and no birth date
  await expect
    .poll(async () => {
      const f = await userDoc(uid);
      const a = f?.ageConfirmed?.mapValue?.fields;
      return a ? `${a.band?.stringValue}|${a.guardian?.booleanValue}|${Object.keys(a).sort().join(',')}` : null;
    }, { timeout: 15_000 })
    .toBe('13-17|true|at,band,guardian');

  // signing out forgets the answer on the device, so the next person is asked
  await page.getByRole('button', { name: 'Account menu' }).first().click();
  await page.getByRole('dialog', { name: 'Account' }).getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForFunction(() => {
    const s = (window as unknown as Partial<W>).__store?.getState();
    return !!s?.userId && s.isAnonymous === true;
  });
  expect(await page.evaluate(() => localStorage.getItem('studyflow_age_confirmed'))).toBeNull();
  await signInButton(page).click();
  await expect(page.getByTestId('age-gate')).toBeVisible();
});

test('an adult answer is kept for this device, so the question is not asked again until sign-out', async ({ page }) => {
  await ready(page);
  await signInButton(page).click();
  await page.getByTestId('age-gate').getByLabel('18 or older').check();
  const popupPromise = page.waitForEvent('popup');
  await page.getByTestId('age-gate').getByRole('button', { name: 'Continue to sign in' }).click();
  const popup = await popupPromise;
  // close Google's window without signing in
  await popup.close();
  await page.waitForTimeout(500);
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('studyflow_age_confirmed')))!)).toMatchObject({ band: '18+', guardian: false });

  // pressing the button again goes straight to Google (no second question)
  const again = page.waitForEvent('popup');
  await signInButton(page).click();
  await expect(page.getByTestId('age-gate')).toHaveCount(0);
  await (await again).close();
});
