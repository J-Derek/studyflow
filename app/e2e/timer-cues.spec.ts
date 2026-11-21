import { expect, test, type Page } from '@playwright/test';

/** The two end-of-block moods: relief when focus ends and a break starts, a firm nudge when a break ends and focus starts. */
type W = { __store: { getState: () => Record<string, (...a: unknown[]) => unknown> & { userId: string | null; timer: { mode: string; status: string }; pomodorosCompleted: number } } };
const ready = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);

test('focus ends: relief words with the real break length, one long vibration, the break is ready, no confetti', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __vibrations: number[][] }).__vibrations = [];
    navigator.vibrate = (p: VibratePattern) => {
      (window as unknown as { __vibrations: number[][] }).__vibrations.push(Array.isArray(p) ? p : [p]);
      return true;
    };
  });
  await page.goto('/timer');
  await ready(page);
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.updateTimerSettings({ focusDuration: 2, shortBreakDuration: 7 * 60 });
    s.startTimer();
  });
  const msg = page.getByTestId('cue-message');
  await expect(msg).toHaveText('Good work. Take 7.', { timeout: 15_000 });
  await expect(msg).toHaveAttribute('data-cue', 'relief');
  await expect(page.getByRole('timer')).toHaveText('07:00');
  expect(await page.evaluate(() => (window as unknown as W).__store.getState().timer.mode)).toBe('shortBreak');
  expect(await page.evaluate(() => (window as unknown as W).__store.getState().timer.status)).toBe('idle');
  expect(await page.evaluate(() => (window as unknown as { __vibrations: number[][] }).__vibrations)).toEqual([[600]]);
  await expect(page.locator('canvas')).toHaveCount(0); // no confetti

  // starting the break clears the words
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(msg).toHaveCount(0);
});

test('a break ends: the firm nudge words, two short vibrations, focus is ready at its own length', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __vibrations: number[][] }).__vibrations = [];
    navigator.vibrate = (p: VibratePattern) => {
      (window as unknown as { __vibrations: number[][] }).__vibrations.push(Array.isArray(p) ? p : [p]);
      return true;
    };
  });
  await page.goto('/timer');
  await ready(page);
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.updateTimerSettings({ shortBreakDuration: 2 });
    s.setTimerMode('shortBreak');
    s.startTimer();
  });
  const msg = page.getByTestId('cue-message');
  await expect(msg).toHaveText("Break's over. Back to it.", { timeout: 15_000 });
  await expect(msg).toHaveAttribute('data-cue', 'nudge');
  await expect(page.getByRole('timer')).toHaveText('25:00');
  expect(await page.evaluate(() => (window as unknown as W).__store.getState().timer.mode)).toBe('focus');
  expect(await page.evaluate(() => (window as unknown as W).__store.getState().pomodorosCompleted)).toBe(0); // a break is not a focus session
  expect(await page.evaluate(() => (window as unknown as { __vibrations: number[][] }).__vibrations)).toEqual([[80, 110, 80]]);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('the end-of-block sound can be muted on this device, and the choice is remembered', async ({ page }) => {
  await page.goto('/timer');
  await ready(page);
  const box = page.getByLabel('Play a sound when a block ends (this device)');
  await page.getByRole('button', { name: 'Change background sound' }).click();
  await expect(box).toBeChecked();
  await box.uncheck();
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: 'Change background sound' }).click();
  await expect(box).not.toBeChecked();
});
