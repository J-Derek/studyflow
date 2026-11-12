import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Store behaviour fixed after the independent audit (findings F5 and F13). Firestore is replaced by fakes that can refuse a path. */
const refuse = new Set<string>();
const deleted: string[] = [];
const written: string[] = [];

vi.mock('../lib/firebase', () => ({ db: {}, auth: {}, googleProvider: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
  doc: (_db: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
  query: (ref: { path: string }) => ref,
  limit: () => ({}),
  where: () => ({}),
  startAfter: () => ({}),
  serverTimestamp: () => 'SERVER_TS',
  setDoc: vi.fn(async (ref: { path: string }) => {
    if ([...refuse].some((p) => ref.path.endsWith(p))) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    written.push(ref.path);
  }),
  deleteDoc: vi.fn(async (ref: { path: string }) => {
    if ([...refuse].some((p) => ref.path.endsWith(p))) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    deleted.push(ref.path);
  }),
  getDocs: vi.fn(async () => ({ docs: [] })),
  writeBatch: () => ({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => undefined) }),
  onSnapshot: () => () => undefined
}));

import { useStudyFlowStore } from './studyFlowStore';

// Cloud saves go through a lazy import (services/cloud.ts), so give them a moment.
const flush = () => new Promise((r) => setTimeout(r, 30));
const s = () => useStudyFlowStore.getState();

beforeEach(() => {
  refuse.clear();
  deleted.length = 0;
  written.length = 0;
  s().resetStore();
  s().setAuthUser('A', false, 'a@x.com', 'A');
});

describe('F5: writing goes with its assignment', () => {
  it('deleting an assignment deletes its writing too, on the device and in the account', async () => {
    s().addAssignment({ title: 'Essay', course: 'ENG 1', dueDate: '2030-01-01', priority: 'medium', status: 'pending', progress: 0 });
    const id = s().assignments[0]!.id;
    s().saveDraft(id, 'My essay text');
    expect(s().drafts.map((d) => d.id)).toEqual([id]);
    s().deleteAssignment(id);
    expect(s().drafts).toEqual([]);
    await flush();
    await flush();
    expect(deleted).toContain(`users/A/assignments/${id}`);
    expect(deleted).toContain(`users/A/drafts/${id}`);
  });

  it('Undo brings the writing back with the assignment', async () => {
    s().addAssignment({ title: 'Essay', course: 'ENG 1', dueDate: '2030-01-01', priority: 'medium', status: 'pending', progress: 0 });
    const asg = s().assignments[0]!;
    s().saveDraft(asg.id, 'My essay text');
    s().deleteAssignment(asg.id);
    s().restoreAssignment(asg);
    expect(s().drafts.map((d) => d.body)).toEqual(['My essay text']);
    await flush();
    expect(written).toContain(`users/A/drafts/${asg.id}`);
  });

  it('when the account refuses the delete, the assignment and its writing both come back', async () => {
    s().addAssignment({ title: 'Essay', course: 'ENG 1', dueDate: '2030-01-01', priority: 'medium', status: 'pending', progress: 0 });
    const id = s().assignments[0]!.id;
    s().saveDraft(id, 'Keep me');
    refuse.add(`assignments/${id}`);
    s().deleteAssignment(id);
    await flush();
    await flush();
    expect(s().assignments.map((a) => a.id)).toEqual([id]);
    expect(s().drafts.map((d) => d.body)).toEqual(['Keep me']);
    expect(deleted).not.toContain(`users/A/drafts/${id}`);
  });
});

describe('F13: a refused class save undoes only that class', () => {
  const add = (title: string) =>
    s().addSession({ title, course: 'C 1', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', type: 'lecture' });

  it('a refused edit rolls back that class only; another class edited meanwhile keeps its change', async () => {
    add('One');
    add('Two');
    const [one, two] = s().sessions;
    refuse.add(`sessions/${one!.id}`);
    s().updateSession(one!.id, { title: 'One edited' });
    s().updateSession(two!.id, { title: 'Two edited' });
    await flush();
    await flush();
    const titles = Object.fromEntries(s().sessions.map((x) => [x.id, x.title]));
    expect(titles).toEqual({ [one!.id]: 'One', [two!.id]: 'Two edited' });
  });

  it('a refused delete brings back that class only; a class added meanwhile stays', async () => {
    add('One');
    const one = s().sessions[0]!;
    refuse.add(`sessions/${one.id}`);
    s().deleteSession(one.id);
    add('Added later');
    await flush();
    await flush();
    expect(s().sessions.map((x) => x.title).sort()).toEqual(['Added later', 'One']);
  });
});
