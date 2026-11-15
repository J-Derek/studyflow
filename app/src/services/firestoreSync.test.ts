import { beforeEach, describe, expect, it, vi } from 'vitest';

// Each committed batch, as the document paths it set (see the commitArchive tests).
const batches = vi.hoisted(() => [] as string[][]);

type SnapCb = (snap: unknown) => void;
const listeners: Array<{ path: string; cb: SnapCb }> = [];

vi.mock('../lib/firebase', () => ({ db: {}, auth: {}, googleProvider: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
  doc: (_db: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
  query: (ref: { path: string }) => ref,
  limit: () => ({}),
  where: () => ({}),
  startAfter: () => ({}),
  serverTimestamp: () => 'SERVER_TS',
  setDoc: vi.fn(async () => undefined),
  deleteDoc: vi.fn(async () => undefined),
  getDocs: vi.fn(async () => ({ docs: [] })),
  writeBatch: () => {
    const sets: string[] = [];
    return {
      set: (ref: { path: string }) => {
        sets.push(ref.path);
      },
      commit: async () => {
        batches.push(sets);
      }
    };
  },
  onSnapshot: (ref: { path: string }, cb: SnapCb) => {
    listeners.push({ path: ref.path, cb });
    return () => undefined;
  }
}));

import { setDoc } from 'firebase/firestore';
import { commitArchive, initFirestoreSync, planMerge, unsubscribeAllFirestoreSync } from './firestoreSync';
import { useStudyFlowStore } from '../store/studyFlowStore';

/** The four lists start once the account's older documents have been checked for the `archived` flag (a moment, in the mock). */
const listenersReady = () => vi.waitFor(() => expect(listeners.some((l) => l.path.endsWith('/grades'))).toBe(true));

function snapshotOf(docs: Array<{ id: string; data: Record<string, unknown>; pending?: boolean }>) {
  return {
    empty: docs.length === 0,
    metadata: { fromCache: false, hasPendingWrites: false },
    forEach: (fn: (d: { id: string; data: () => Record<string, unknown>; metadata: { hasPendingWrites: boolean } }) => void) =>
      docs.forEach((d) => fn({ id: d.id, data: () => d.data, metadata: { hasPendingWrites: !!d.pending } }))
  };
}

const assignmentDoc = (title: string) => ({
  id: 'x1',
  data: { title, course: 'C', dueDate: '2030-01-01', priority: 'low', status: 'pending', progress: 0, createdAt: 'z' }
});

describe('late snapshot race', () => {
  beforeEach(() => {
    listeners.length = 0;
    unsubscribeAllFirestoreSync();
    useStudyFlowStore.getState().resetStore();
  });

  it('applies a snapshot for the active user', async () => {
    useStudyFlowStore.getState().setAuthUser('A', false, 'a@x.com', 'A');
    initFirestoreSync('A');
    await listenersReady();
    const asg = listeners.find((l) => l.path === 'users/A/assignments')!;
    asg.cb(snapshotOf([assignmentDoc('A-PRIVATE')]));
    expect(useStudyFlowStore.getState().assignments.map((a) => a.title)).toEqual(['A-PRIVATE']);
  });

  it('ignores a late snapshot from user A after the store has switched to user B', async () => {
    useStudyFlowStore.getState().setAuthUser('A', false, 'a@x.com', 'A');
    initFirestoreSync('A');
    await listenersReady();
    const asg = listeners.find((l) => l.path === 'users/A/assignments')!;
    const ses = listeners.find((l) => l.path === 'users/A/sessions')!;

    useStudyFlowStore.getState().resetStore();
    useStudyFlowStore.getState().setAuthUser('B', false, 'b@x.com', 'B');

    asg.cb(snapshotOf([assignmentDoc('A-PRIVATE')]));
    ses.cb(snapshotOf([{ id: 's1', data: { title: 'A-LECTURE', course: 'C', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', type: 'lecture' } }]));

    const s = useStudyFlowStore.getState();
    expect(s.assignments).toEqual([]);
    expect(s.sessions).toEqual([]);
  });

  it('ignores a late snapshot after sign-out (userId null)', async () => {
    useStudyFlowStore.getState().setAuthUser('A', false, 'a@x.com', 'A');
    initFirestoreSync('A');
    await listenersReady();
    const asg = listeners.find((l) => l.path === 'users/A/assignments')!;
    useStudyFlowStore.getState().resetStore();
    asg.cb(snapshotOf([assignmentDoc('A-PRIVATE')]));
    expect(useStudyFlowStore.getState().assignments).toEqual([]);
  });

  it('reads subtasks back from a map (they used to be dropped on every snapshot)', async () => {
    useStudyFlowStore.getState().setAuthUser('A', false, 'a@x.com', 'A');
    initFirestoreSync('A');
    await listenersReady();
    const asg = listeners.find((l) => l.path === 'users/A/assignments')!;
    const d = assignmentDoc('With subtasks');
    (d.data as Record<string, unknown>).subtasks = {
      b: { id: 'b', title: 'second', completed: true, order: 1 },
      a: { id: 'a', title: 'first', completed: false, order: 0 }
    };
    asg.cb(snapshotOf([d]));
    expect(useStudyFlowStore.getState().assignments[0].subtasks?.map((s) => s.title)).toEqual(['first', 'second']);
  });
});

describe('stale echo of this device\'s own write', () => {
  beforeEach(() => {
    listeners.length = 0;
    unsubscribeAllFirestoreSync();
    useStudyFlowStore.getState().resetStore();
  });

  it('keeps what is on screen for an item with a pending write, but still applies another device\'s change', async () => {
    useStudyFlowStore.getState().setAuthUser('A', false, 'a@x.com', 'A');
    initFirestoreSync('A');
    await listenersReady();
    const asg = listeners.find((l) => l.path === 'users/A/assignments')!;
    asg.cb(snapshotOf([assignmentDoc('first'), { ...assignmentDoc('other'), id: 'x2' }]));
    // the student edits x1 on screen (a second tick), then the echo of the FIRST write arrives, still pending
    useStudyFlowStore.setState((st) => ({ assignments: st.assignments.map((a) => (a.id === 'x1' ? { ...a, title: 'second tick' } : a)) }));
    asg.cb(snapshotOf([{ ...assignmentDoc('first'), pending: true }, { ...assignmentDoc('changed elsewhere'), id: 'x2' }]));
    const titles = Object.fromEntries(useStudyFlowStore.getState().assignments.map((a) => [a.id, a.title]));
    expect(titles).toEqual({ x1: 'second tick', x2: 'changed elsewhere' });
  });
});

describe('planMerge', () => {
  it('never overwrites ids that already exist in the account', () => {
    const out = planMerge(new Set(['a', 'b']), [{ id: 'b' }, { id: 'c' }]);
    expect(out).toEqual([{ id: 'c' }]);
  });
});

describe('commitArchive: the semester record is committed with the last items, not afterwards', () => {
  const period = { id: 'p1', name: 'Term 2', label: 'term' as const, archivedAt: '2026-11-15T10:00:00.000Z', counts: { assignments: 0, sessions: 0, grades: 0, notes: 0 } };
  const asg = (id: string) => ({ id, title: id, course: 'C', dueDate: '2030-01-01', priority: 'low' as const, status: 'pending' as const, progress: 0, createdAt: 'z', archivedPeriod: 'p1' });
  const empty = { sessions: [], grades: [], notes: [] };

  beforeEach(() => {
    batches.length = 0;
    vi.mocked(setDoc).mockClear();
  });

  it('writes the period record in the same batch as the items, with no separate write after it', async () => {
    await commitArchive('U', period, { assignments: [asg('a1'), asg('a2')], ...empty }, []);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual(['users/U/assignments/a1', 'users/U/assignments/a2', 'users/U/semesters/p1']);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('with several batches, the record is only in the last one, so a half-finished archive never shows as a past semester', async () => {
    const many = Array.from({ length: 450 }, (_, i) => asg(`a${i}`));
    await commitArchive('U', period, { assignments: many, ...empty }, []);
    expect(batches).toHaveLength(2);
    expect(batches[0]!.some((p) => p.includes('/semesters/'))).toBe(false);
    expect(batches[1]!.at(-1)).toBe('users/U/semesters/p1');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('still records an archive with nothing in it (the period alone)', async () => {
    await commitArchive('U', period, { assignments: [], ...empty }, []);
    expect(batches).toEqual([['users/U/semesters/p1']]);
  });
});
