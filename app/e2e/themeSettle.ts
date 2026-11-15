import type { Page } from '@playwright/test';

/**
 * Waits until every colour transition and finite animation on the page has finished, so an accessibility (contrast) check never reads a
 * colour that is still halfway between two themes. A fixed wait (300 or 400 ms) was not enough on a slow, busy CI runner and made the
 * contrast checks flaky. Endless animations (a spinner) are ignored, since they never finish.
 */
export async function settleTransitions(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // let the style change that starts the transitions be applied first
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const finite = document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? 0));
    await Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
  });
}
