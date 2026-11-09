import { expect, test, type Page } from '@playwright/test';

/** PR5: "Delete my account" removes every record, the profile and the sign-in account, and leaves this device clean. */
type S = {
  userId: string | null;
  isAnonymous: boolean;
  isSyncing: boolean;
  addAssignment: (a: object) => void;
  addNote: (n: object) => string;
};
type W = { __store: { getState: () => S }; __auth: { signInOrLinkWithGoogle: () => Promise<unknown> } };

const DOCS = 'http://127.0.0.1:8080/v1/projects/studyflow-e2e/databases/(default)/documents';
const H = { Authorization: 'Bearer owner' };

async function chooseGoogleAccount(page: Page, popupTrigger: () => Promise<void>, email: string, existing: boolean): Promise<void> {
  const popupPromise = page.waitForEvent('popup');
  void popupTrigger(); // the sign-in call only finishes after the pop-up is handled, so it is not awaited
  const popup = await popupPromise;
  const closed = popup.waitForEvent('close', { timeout: 30_000 }).catch(() => undefined);
  await popup.waitForLoadState('domcontentloaded');
  if (existing) {
    await popup.getByText(email, { exact: false }).first().click({ timeout: 30_000 });
  } else {
    await popup.locator('button.mdc-button--outlined').first().click();
    await popup.locator('#autogen-button').click();
    await popup.locator('#email-input').fill(email);
    await popup.locator('#sign-in').click();
  }
  await closed;
}

async function listIds(path: string): Promise<string[]> {
  const res = await fetch(`${DOCS}/${path}?pageSize=100`, { headers: H });
  const body = (await res.json()) as { documents?: { name: string }[] };
  return (body.documents ?? []).map((d) => d.name.split('/').pop()!);
}

async function accountExists(uid: string): Promise<boolean> {
  const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/studyflow-e2e/accounts:lookup', {
    method: 'POST',
    headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify({ localId: [uid] })
  });
  return (((await res.json()) as { users?: unknown[] }).users ?? []).length > 0;
}

test('deleting the account removes every record, the profile and the sign-in account, and clears the device', async ({ page }) => {
  const email = `delete-${Date.now().toString(36)}@example.com`;
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await chooseGoogleAccount(page, () => page.evaluate(() => (window as unknown as W).__auth.signInOrLinkWithGoogle()).then(() => undefined, () => undefined), email, false);
  await page.waitForFunction(() => (window as unknown as W).__store.getState().isAnonymous === false);
  const uid = await page.evaluate(() => (window as unknown as W).__store.getState().userId as string);

  // some of every kind of record (timetable, grades and the timer are written straight to the cloud, as the app would)
  await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    s.addAssignment({ title: 'DELETE-ME-ASG', course: 'TEST 101', dueDate: '2030-01-15', priority: 'medium', status: 'pending', progress: 0 });
    s.addNote({ title: 'DELETE-ME-NOTE', body: 'x', course: '', pinned: false });
  });
  await page.waitForFunction(() => !(window as unknown as W).__store.getState().isSyncing);
  for (const [path, id, fields] of [
    [`users/${uid}/sessions`, 's1', { id: { stringValue: 's1' }, title: { stringValue: 'Class' }, course: { stringValue: 'TEST 101' }, dayOfWeek: { integerValue: '2' }, startTime: { stringValue: '10:00' }, endTime: { stringValue: '11:00' }, type: { stringValue: 'lecture' } }],
    [`users/${uid}/grades`, 'g1', { id: { stringValue: 'g1' }, courseCode: { stringValue: 'TEST 101' }, courseName: { stringValue: 'Test' }, credits: { integerValue: '3' }, targetLetter: { stringValue: 'A' }, color: { stringValue: '#4F46E5' }, assessments: { arrayValue: {} } }],
    [`users/${uid}/focusSessions`, 'run-9', { durationSeconds: { integerValue: '60' }, mode: { stringValue: 'focus' }, localDate: { stringValue: '2030-01-15' } }],
    [`users/${uid}/drafts`, 'd1', { id: { stringValue: 'd1' }, body: { stringValue: 'DELETE-ME-DRAFT' }, format: { stringValue: 'markdown' }, editedAt: { stringValue: '2030-01-01T00:00:00.000Z' } }],
    [`users/${uid}/semesters`, 'p1', { id: { stringValue: 'p1' }, name: { stringValue: 'Old semester' }, label: { stringValue: 'semester' }, archivedAt: { stringValue: '2030-01-01T00:00:00.000Z' }, counts: { mapValue: { fields: { assignments: { integerValue: '1' }, sessions: { integerValue: '0' }, grades: { integerValue: '0' }, notes: { integerValue: '0' } } } } }],
    [`users/${uid}/liveState`, 'timer', { rev: { integerValue: '3' }, status: { stringValue: 'idle' }, mode: { stringValue: 'focus' }, durationSeconds: { integerValue: '1500' } }]
  ] as const) {
    const r = await fetch(`${DOCS}/${path}/${id}`, { method: 'PATCH', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ fields }) });
    expect(r.status, `${path}/${id}`).toBe(200);
  }
  expect(await listIds(`users/${uid}/assignments`)).toHaveLength(1);
  expect(await listIds(`users/${uid}/notes`)).toHaveLength(1);
  expect(await accountExists(uid)).toBe(true);

  // the button asks first, then Google asks them to sign in again
  await page.getByRole('button', { name: 'Account menu' }).first().click();
  await page.getByRole('button', { name: 'Your account', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Your account' });
  await dialog.getByRole('button', { name: 'Delete my account…' }).click();
  await expect(dialog.getByTestId('delete-confirm')).toContainText('This cannot be undone');
  // changing their mind deletes nothing
  await dialog.getByRole('button', { name: 'Keep my account' }).click();
  expect(await listIds(`users/${uid}/assignments`)).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Delete my account…' }).click();

  const reloaded = page.waitForEvent('load', { timeout: 60_000 });
  await chooseGoogleAccount(page, () => dialog.getByRole('button', { name: 'Sign in again and delete' }).click(), email, true);
  await reloaded;

  // back to a clean guest session on this device
  await page.waitForFunction(() => {
    const s = (window as unknown as Partial<W>).__store?.getState();
    return !!s?.userId && s.isAnonymous === true;
  });
  const guestUid = await page.evaluate(() => (window as unknown as W).__store.getState().userId);
  expect(guestUid).not.toBe(uid);
  const local = await page.evaluate(() => JSON.stringify({ ...localStorage }) + document.documentElement.innerText);
  expect(local).not.toContain('DELETE-ME');
  expect(local).not.toContain(email);

  // and nothing is left in the cloud
  for (const c of ['assignments', 'sessions', 'grades', 'notes', 'drafts', 'semesters', 'focusSessions', 'liveState']) {
    expect(await listIds(`users/${uid}/${c}`), c).toEqual([]);
  }
  expect((await fetch(`${DOCS}/users/${uid}`, { headers: H })).status).toBe(404);
  expect(await accountExists(uid)).toBe(false);
});

test('a guest has no delete button (there is no account to re-confirm)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  await page.locator('header').getByRole('button', { name: 'Sign in with Google' }).waitFor();
  await expect(page.getByRole('button', { name: 'Delete my account…' })).toHaveCount(0);
});
