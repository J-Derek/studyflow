import type { Page } from '@playwright/test';

/**
 * Pressing a "Sign in with Google" button now asks the age question first (once per sign-in). Tests that click the button call this
 * right afterwards: if the question shows, it answers "18 or older" and continues; if this device already has an answer, nothing shows
 * and it returns.
 */
export async function continueThroughAgeGate(page: Page): Promise<void> {
  const dialog = page.getByTestId('age-gate');
  const shown = await dialog.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false);
  if (!shown) return;
  await dialog.getByLabel('18 or older').check();
  await dialog.getByRole('button', { name: 'Continue to sign in' }).click();
  await dialog.waitFor({ state: 'hidden' });
}
