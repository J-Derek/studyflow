import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type W = {
  __store: {
    getState: () => {
      userId: string | null;
      addAssignment: (a: unknown) => void;
      addSession: (s: unknown) => void;
      updateUser: (u: Record<string, unknown>) => void;
    };
  };
};

async function boot(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => {
    const w = window as unknown as Partial<W>;
    return !!w.__store && !!w.__store.getState().userId;
  });
}

test.describe('guest notice', () => {
  test('is absent on first load, appears after the first saved assignment, and stays dismissed', async ({ page }) => {
    await boot(page, '/');
    await expect(page.getByRole('note')).toHaveCount(0);

    await page.evaluate(() =>
      (window as unknown as W).__store.getState().addAssignment({
        title: 'First deadline', course: 'CS 101', dueDate: '2030-01-15', priority: 'low', status: 'pending', progress: 0
      })
    );
    const notice = page.getByRole('note');
    await expect(notice).toContainText('saved to a guest account');

    await notice.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByRole('note')).toHaveCount(0);
    await page.reload();
    await boot(page, '/');
    await expect(page.getByRole('note')).toHaveCount(0);
  });

  test('sample data alone does not trigger the notice', async ({ page }) => {
    await boot(page, '/');
    await page.evaluate(() => {
      (window as unknown as { __store: { getState: () => { loadSampleData: () => void } } }).__store.getState().loadSampleData();
    });
    await expect(page.getByRole('note')).toHaveCount(0);
  });
});

test.describe('calendar export uses the profile settings', () => {
  test('downloads an .ics with the chosen zone and term dates', async ({ page }) => {
    await boot(page, '/calendar');
    await page.evaluate(() => {
      const s = (window as unknown as W).__store.getState();
      s.updateUser({ timeZone: 'Africa/Nairobi', semesterStart: '2026-03-02', semesterEnd: '2026-06-26' });
      s.addSession({ title: 'Algorithms', course: 'CS 301', dayOfWeek: 1, startTime: '09:00', endTime: '10:30', type: 'lecture' });
    });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /export/i }).first().click();
    const file = await (await download).path();
    const ics = readFileSync(file as string, 'utf8');

    expect(ics).toContain('BEGIN:VTIMEZONE\r\nTZID:Africa/Nairobi');
    expect(ics).toContain('DTSTART;TZID=Africa/Nairobi:20260302T090000'); // first Monday on or after term start
    expect(ics).toMatch(/UNTIL=20260626T205959Z/); // last second of the final day in Nairobi (23:59:59 EAT), in UTC
    expect(ics).toContain('SEQUENCE:0');
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  test('a second export raises SEQUENCE', async ({ page }) => {
    await boot(page, '/calendar');
    await page.evaluate(() =>
      (window as unknown as W).__store.getState().addSession({ title: 'Lab', course: 'PHY 210', dayOfWeek: 3, startTime: '14:00', endTime: '16:00', type: 'lab' })
    );
    const exportOnce = async () => {
      const d = page.waitForEvent('download');
      await page.getByRole('button', { name: /export/i }).first().click();
      return readFileSync((await (await d).path()) as string, 'utf8');
    };
    const first = await exportOnce();
    const second = await exportOnce();
    expect(first).toContain('SEQUENCE:0');
    expect(second).toContain('SEQUENCE:1');
  });
});
