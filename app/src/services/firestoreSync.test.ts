import { beforeEach, describe, expect, it, vi } from 'vitest';

type SnapCb = (snap: unknown) => void;
const listeners: Array<{ path: string; cb: SnapCb }> = [];

vi.mock('../lib/firebase', () => ({ db: {}, auth: {}, googleProvider: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
  doc: (_db: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
  query: (ref: { path: string }) => ref,
  limit: () => ({}),
  serverTimestamp: () => 'SERVER_TS',
  setDoc: vi.fn(async () => undefined),
  deleteDoc: vi.fn(async () => undefined),
  getDocs: vi.fn(async () => ({ docs: [] })),
  writeBatch: () => ({ set: vi.fn(), commit: vi.fn(async () => undefined) }),
  onSnapshot: (ref: { path: string }, cb: SnapCb) => {
    listeners.push({ path: ref.path, cb });
    return () => undefined;
  }
}));

import { initFirestoreSync, planMerge, unsubscribeAllFirestoreSync } from './firestoreSync';
import { useStudyFlowStore } from '../store/studyFlowStore';

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

  it('applies a snapshot for the active user', () => {
    useStudyFlowStore.getState().setAuthUser('A', false, 'a@x.com', 'A');
    initFirestoreSync('A');
    const asg = listeners.find((l) => l.path === 'users/A/assignments')!;
    asg.cb(snapshotOf([assignmentDoc('A-PRIVATE')]));
    expect(useStudyFlowStore.getState().assignments.map((a) => a.title)).toEqual(['A-PRIVATE']);
  });

  it('ignores a late snapshot from user A after the store has switched to user B', () => {
    useStudyFlowStore.getState().setAuthUser('A', false, 'a@x.com', 'A');
    initFirestoreSync('A');
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

  it('ignores a late snapshot after sign-out (userId null)', () => {
    useStudyFlowStore.getState().setAuthUser('A', false, 'a@x.com', 'A');
    initFirestoreSync('A');
    const asg = listeners.find((l) => l.path === 'users/A/assignments')!;
    useStudyFlowStore.getState().resetStore();
    asg.cb(snapshotOf([assignmentDoc('A-PRIVATE')]));
    expect(useStudyFlowStore.getState().assignments).toEqual([]);
  });

  it('reads subtasks back from a map (they used to be dropped on every snapshot)', () => {
    useStudyFlowStore.getState().setAuthUser('A', false, 'a@x.com', 'A');
    initFirestoreSync('A');
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

  it('keeps what is on screen for an item with a pending write, but still applies another device\'s change', () => {
    useStudyFlowStore.getState().setAuthUser('A', false, 'a@x.com', 'A');
    initFirestoreSync('A');
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
