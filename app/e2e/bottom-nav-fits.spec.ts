import { expect, test } from '@playwright/test';

// Six items share the phone's bottom bar. Each must sit inside the screen, not overlap its neighbour,
// and show its whole label (nothing cut off or spilling over).
for (const width of [320, 360, 375, 390, 414, 600]) {
  test(`the bottom navigation fits at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 760 } });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => { userId: string | null } } }).__store?.getState().userId);

    const links = page.getByRole('navigation', { name: 'Mobile Navigation' }).getByRole('link');
    expect(await links.count()).toBe(6);

    let previousRight = 0;
    for (let i = 0; i < 6; i++) {
      const link = links.nth(i);
      const box = (await link.boundingBox())!;
      expect(box.x, `item ${i} starts on screen`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `item ${i} ends on screen`).toBeLessThanOrEqual(width + 0.5);
      expect(box.x, `item ${i} does not overlap the previous one`).toBeGreaterThanOrEqual(previousRight - 0.5);
      previousRight = box.x + box.width;
      // the visible label is not wider than its own tap target
      const overflows = await link.evaluate((el) => {
        const label = el.querySelector('span:not(.sr-only)') as HTMLElement | null;
        return label ? label.scrollWidth > el.clientWidth + 1 : false;
      });
      expect(overflows, `item ${i} label fits`).toBe(false);
    }
    await context.close();
  });
}
