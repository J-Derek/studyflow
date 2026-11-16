import type { Page } from '@playwright/test';

/**
 * Waits until the colours on the page have stopped changing, so an accessibility (contrast) check never reads a colour that is still
 * halfway between two themes. A fixed wait (300 or 400 ms) was not enough on a slow, busy CI runner.
 *
 * It waits at least the old 300 ms (React may not have applied the new theme yet, and then there is nothing to wait for), then checks
 * every 50 ms until no finite transition or animation has been running for two checks in a row, giving up after 3 seconds. Endless
 * animations (a spinner) are ignored, since they never finish.
 */
export async function settleTransitions(page: Page): Promise<void> {
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    const running = () =>
      document.getAnimations().filter((a) => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime ?? 0)).length;
    const deadline = performance.now() + 3000;
    let quiet = 0;
    while (quiet < 2 && performance.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      quiet = running() === 0 ? quiet + 1 : 0;
    }
  });
}
