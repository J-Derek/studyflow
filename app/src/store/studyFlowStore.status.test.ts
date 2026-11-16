import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Without a checklist an item has a simple status (not started, in progress, done) and its stored progress follows that status. */
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
  writeBatch: () => ({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => undefined) }),
  onSnapshot: () => () => undefined
}));

import { useStudyFlowStore } from './studyFlowStore';

const s = () => useStudyFlowStore.getState();
const add = (extra: object = {}) => {
  s().addAssignment({ title: 'Essay', course: 'ENG 1', dueDate: '2030-01-01', priority: 'medium', status: 'pending', progress: 0, ...extra });
  return s().assignments[0]!.id;
};
const get = (id: string) => s().assignments.find((a) => a.id === id)!;

beforeEach(() => {
  s().resetStore();
});

describe('status without a checklist', () => {
  it('"in progress" and "not started" set the progress that goes with them', () => {
    const id = add({ progress: 35, status: 'in_progress' });
    s().updateAssignment(id, { status: 'pending' });
    expect(get(id)).toMatchObject({ status: 'pending', progress: 0 });
    s().updateAssignment(id, { status: 'in_progress' });
    expect(get(id)).toMatchObject({ status: 'in_progress', progress: 50 });
    expect(get(id).completedAt).toBeUndefined();
  });

  it('a status sent for an item with a checklist is ignored, since the ticks decide it', () => {
    const id = add({ subtasks: [{ id: 'a', title: 'one', completed: true }, { id: 'b', title: 'two', completed: false }], progress: 50, status: 'in_progress' });
    s().updateAssignment(id, { status: 'pending' });
    expect(get(id)).toMatchObject({ status: 'in_progress', progress: 50 });
  });
});
