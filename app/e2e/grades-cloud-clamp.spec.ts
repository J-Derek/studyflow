import { expect, test, type Page } from '@playwright/test';

/**
 * The cloud rules cannot check every assessment inside a course, so a record written outside the app (a tool using the
 * student's own sign-in token) could hold a score of 8585. A security audit found the Grades page showing "8837.5% A"
 * for exactly that. Whatever the cloud sends is now held to 0..100, and the figures are worked out from the held values.
 */
type W = {
  __store: { getState: () => { userId: string | null; isAnonymous: boolean } };
  __auth: { signInOrLinkWithGoogle: () => Promise<unknown> };
};

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/grades');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  const popupPromise = page.waitForEvent('popup');
  void page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).catch(() => undefined);
  const popup = await popupPromise;
  const popupClosed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await popup.waitForLoadState('domcontentloaded');
  await popup.locator('button.mdc-button--outlined').first().click();
  await popup.locator('#autogen-button').click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#sign-in').click();
  await popupClosed;
  await page.waitForFunction(() => (window as unknown as W).__store.getState().isAnonymous === false);
}

test('a score of 8585 written straight to the cloud shows as 100, and the course percentage stays within 100', async ({ page }) => {
  await signIn(page, `grades-clamp-${Date.now().toString(36)}@example.com`);
  const uid = await page.evaluate(() => (window as unknown as W).__store.getState().userId as string);

  // Written the way an outside tool would: straight to the emulator's REST API with the owner token (no rules).
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/studyflow-e2e/databases/(default)/documents/users/${uid}/grades/audit-grade`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({
      fields: {
        id: { stringValue: 'audit-grade' },
        courseCode: { stringValue: 'CSC 201' },
        courseName: { stringValue: 'Data Structures' },
        credits: { integerValue: '3' },
        targetLetter: { stringValue: 'A' },
        color: { stringValue: '#4F46E5' },
        assessments: {
          arrayValue: {
            values: [
              { mapValue: { fields: { id: { stringValue: 'm' }, name: { stringValue: 'Midterm' }, weight: { integerValue: '40' }, score: { integerValue: '8585' } } } },
              { mapValue: { fields: { id: { stringValue: 'f' }, name: { stringValue: 'Final' }, weight: { integerValue: '60' }, score: { integerValue: '-30' } } } }
            ]
          }
        },
        updatedAt: { timestampValue: new Date().toISOString() }
      }
    })
  });
  expect(res.status, await res.clone().text()).toBe(200);

  // The live listener hands it to the page without a reload.
  const midterm = page.getByLabel('Score for Midterm, percent');
  await expect(midterm).toHaveValue('100', { timeout: 15_000 });
  await expect(page.getByLabel('Score for Final, percent')).toHaveValue('0');

  const text = await page.locator('main').innerText();
  expect(text).not.toContain('8585');
  expect(text).not.toMatch(/8837/);
  // every percentage on the page is within 0 to 100
  for (const m of text.matchAll(/(-?\d+(?:\.\d+)?)\s*%/g)) {
    const n = Number(m[1]);
    expect(n, `percentage "${m[0]}" on the Grades page`).toBeGreaterThanOrEqual(0);
    expect(n, `percentage "${m[0]}" on the Grades page`).toBeLessThanOrEqual(100);
  }
});
