import { expect, test, type Page } from '@playwright/test';

/**
 * UX round, part E: the 500-document limit counts current work only. Every record carries an `archived` flag; older records get it once;
 * the lists listen to current items; past semesters are fetched when needed (a page at a time, so there is no limit on them).
 */
type Asg = { id: string; title: string };
type S = { userId: string | null; assignments: Asg[]; archived: { assignments: Asg[] } };
type W = { __store: { getState: () => S } };

const REST = 'http://127.0.0.1:8080/v1/projects/studyflow-e2e/databases/(default)/documents';
const H = { Authorization: 'Bearer owner', 'content-type': 'application/json' };

const ready = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__store?.getState().userId);
  return page.evaluate(() => (window as unknown as W).__store.getState().userId as string);
};

const fields = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id: { stringValue: id },
  title: { stringValue: title },
  course: { stringValue: 'GEN 1' },
  dueDate: { stringValue: '2030-01-01' },
  priority: { stringValue: 'medium' },
  status: { stringValue: 'pending' },
  progress: { integerValue: '0' },
  createdAt: { stringValue: '2026-01-01T00:00:00.000Z' },
  updatedAt: { timestampValue: new Date().toISOString() },
  ...extra
});

/** Writes assignments straight to the emulator (owner token, no rules), in commits of up to 400. */
async function writeDocs(uid: string, docs: { id: string; title: string; extra?: Record<string, unknown> }[]) {
  for (let i = 0; i < docs.length; i += 400) {
    const writes = docs.slice(i, i + 400).map((d) => ({
      update: { name: `projects/studyflow-e2e/databases/(default)/documents/users/${uid}/assignments/${d.id}`, fields: fields(d.id, d.title, d.extra) }
    }));
    const res = await fetch(`${REST}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes }) });
    expect(res.status, await res.clone().text()).toBe(200);
  }
}

async function readDoc(uid: string, id: string) {
  const res = await fetch(`${REST}/users/${uid}/assignments/${id}`, { headers: H });
  return (await res.json()) as { fields: Record<string, { booleanValue?: boolean }> };
}

const clearFlagMemory = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('studyflow_archived_flag_v1_')).forEach((k) => localStorage.removeItem(k)));

test('records saved by an older version get the flag once, then everything still shows, and past work stays out of the current list', async ({ page }) => {
  const uid = await ready(page);
  await writeDocs(uid, [
    { id: 'old-current', title: 'Saved by the old app' },
    { id: 'old-archived', title: 'An old past-semester item', extra: { archivedPeriod: { stringValue: 'p-2025-1' } } }
  ]);
  await clearFlagMemory(page);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as W).__store.getState().assignments.some((a) => a.title === 'Saved by the old app'), undefined, { timeout: 15_000 });

  const titles = await page.evaluate(() => (window as unknown as W).__store.getState().assignments.map((a) => a.title));
  expect(titles).toContain('Saved by the old app');
  expect(titles).not.toContain('An old past-semester item');

  expect((await readDoc(uid, 'old-current')).fields.archived?.booleanValue).toBe(false);
  expect((await readDoc(uid, 'old-archived')).fields.archived?.booleanValue).toBe(true);

  // a second load goes straight to the current-items list (the device remembers the check)
  expect(await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('studyflow_archived_flag_v1_')).map(([, v]) => v))).toEqual(['1']);
  expect(await page.evaluate((u) => Object.keys(localStorage).some((k) => k.includes(u)), uid)).toBe(false); // no user id on the device
});

test('600 past-semester items do not count against the 500 limit: current work shows, and all 600 past items can be fetched on demand', async ({ page }) => {
  test.setTimeout(120_000);
  const uid = await ready(page);
  const past = Array.from({ length: 600 }, (_, i) => ({ id: `past-${i}`, title: `Past ${i}`, extra: { archivedPeriod: { stringValue: 'p-2025-1' }, archived: { booleanValue: true } } }));
  const current = [0, 1, 2].map((i) => ({ id: `now-${i}`, title: `Current ${i}`, extra: { archived: { booleanValue: false } } }));
  await writeDocs(uid, [...past, ...current]);
  await clearFlagMemory(page);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as W).__store.getState().assignments.length >= 3, undefined, { timeout: 20_000 });

  const state = await page.evaluate(() => {
    const s = (window as unknown as W).__store.getState();
    return { current: s.assignments.map((a) => a.title).sort(), archived: s.archived.assignments.length };
  });
  expect(state.current).toEqual(['Current 0', 'Current 1', 'Current 2']);
  expect(state.archived).toBe(0); // not in memory until asked for

  const loaded = await page.evaluate(async (u) => {
    const mod = await import(/* @vite-ignore */ '/src/services/firestoreSync.ts');
    await mod.loadArchivedFromCloud(u);
    const s = (window as unknown as W).__store.getState();
    return { archived: s.archived.assignments.length, current: s.assignments.length };
  }, uid);
  expect(loaded.archived).toBe(600);
  expect(loaded.current).toBe(3);
});

test('a student who adds work after the check still sees it, and it is stored with the flag', async ({ page }) => {
  const uid = await ready(page);
  await page.evaluate(() =>
    (window as unknown as { __store: { getState: () => { addAssignment: (a: object) => void } } }).__store.getState().addAssignment({ title: 'Fresh work', course: 'GEN 1', dueDate: '2030-01-01', priority: 'low', status: 'pending', progress: 0 })
  );
  await expect.poll(async () => {
    const id = await page.evaluate(() => (window as unknown as W).__store.getState().assignments.find((a) => a.title === 'Fresh work')?.id ?? '');
    return id ? (await readDoc(uid, id)).fields?.archived?.booleanValue : 'waiting';
  }, { timeout: 15_000 }).toBe(false);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as W).__store.getState().assignments.some((a) => a.title === 'Fresh work'), undefined, { timeout: 15_000 });
});
