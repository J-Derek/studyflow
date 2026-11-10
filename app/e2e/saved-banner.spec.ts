import { expect, test, type Page } from '@playwright/test';

/** The "Saved ..." confirmation on Today is for a deadline the student just saved, not for their plan arriving from the cloud. */
type A = { id: string; title: string; course: string; dueDate: string; priority: string; status: string; progress: number; createdAt: string };
type W = { __store: { getState: () => { userId: string | null; addAssignment: (a: Omit<A, 'id' | 'createdAt'>) => void }; setState: (s: { assignments: A[] }) => void } };

const ready = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
};

test('saving the first deadline shows the confirmation', async ({ page }) => {
  await ready(page);
  await page.evaluate(() =>
    (window as unknown as W).__store.getState().addAssignment({ title: 'Fresh deadline', course: 'GEN 1', dueDate: '2030-01-01', priority: 'medium', status: 'pending', progress: 0 })
  );
  await expect(page.getByText('Use Edit to change it, or Add assignment to add more.')).toBeVisible();
  await expect(page.getByText('Saved “Fresh deadline”')).toBeVisible();
});

test('a saved plan arriving after sign-in or a reload does not say "Saved"', async ({ page }) => {
  await ready(page);
  // what the cloud sends: older records, appearing in an empty list all at once
  await page.evaluate(() =>
    (window as unknown as W).__store.setState({
      assignments: [
        { id: 'old-1', title: 'TEST - CSC 101 Assignment 1', course: 'CSC 101', dueDate: '2030-01-01', priority: 'medium', status: 'pending', progress: 0, createdAt: '2026-01-01T10:00:00.000Z' },
        { id: 'old-2', title: 'Types of Distributed Systems', course: 'ACS443', dueDate: '2030-01-02', priority: 'high', status: 'pending', progress: 0, createdAt: '2026-02-01T10:00:00.000Z' }
      ]
    })
  );
  await expect(page.getByText('Types of Distributed Systems').first()).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText('Use Edit to change it, or Add assignment to add more.')).toHaveCount(0);
});
