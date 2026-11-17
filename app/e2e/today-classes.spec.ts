import { expect, test } from '@playwright/test';

/** Today's classes come in time order, the class on right now says "Now", and Next up shows how many steps are done. */
type S = { userId: string | null; addSession: (s: object) => void; addAssignment: (a: object) => void };
type W = { __store: { getState: () => S } };

test('classes in time order, "Now" on the one in progress, steps done on Next up', async ({ page }) => {
  // Monday 14 January 2030, 10:30 local time
  await page.clock.setFixedTime(new Date(2030, 0, 14, 10, 30));
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    // added out of order on purpose
    s.addSession({ title: 'Afternoon lab', course: 'CHE 210', dayOfWeek: 1, startTime: '14:00', endTime: '16:00', type: 'lab' });
    s.addSession({ title: 'Morning lecture', course: 'PHY 342', dayOfWeek: 1, startTime: '10:00', endTime: '11:00', type: 'lecture' });
    s.addAssignment({
      title: 'Lab report', course: 'CHE 210', dueDate: '2030-01-16', priority: 'high', status: 'pending', progress: 0,
      subtasks: [{ id: 'a', title: 'Graphs', completed: true }, { id: 'b', title: 'Discussion', completed: false }]
    });
  });

  const titles = page.locator('h3').filter({ hasText: /Morning lecture|Afternoon lab/ });
  await expect(titles).toHaveText(['Morning lecture', 'Afternoon lab']);

  const morning = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Morning lecture' }) }).last();
  await expect(morning.getByText('Now', { exact: true })).toBeVisible();
  const afternoon = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Afternoon lab' }) }).last();
  await expect(afternoon.getByText('Now', { exact: true })).toHaveCount(0);

  await expect(page.getByText('1 of 2 steps done')).toBeVisible();
});
