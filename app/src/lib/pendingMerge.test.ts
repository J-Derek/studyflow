import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPendingMerge, readPendingMerge, savePendingMerge } from './pendingMerge';

const asg = { id: 'a1', title: 'Essay', course: 'LAW 101', dueDate: '2030-01-01', priority: 'low', status: 'pending', progress: 0, createdAt: '2026-01-01' };

describe('pending guest merge', () => {
  beforeEach(() => {
    // the unit-test environment has no browser storage, so give it a small stand-in
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear()
    });
  });

  it('keeps guest records for the account they were meant for', () => {
    savePendingMerge({ uid: 'google-1', assignments: [asg as never], sessions: [], grades: [] });
    const got = readPendingMerge('google-1');
    expect(got?.assignments).toHaveLength(1);
    expect(got?.assignments[0]?.title).toBe('Essay');
  });

  it('never hands them to a different account, and forgets them', () => {
    savePendingMerge({ uid: 'google-1', assignments: [asg as never], sessions: [], grades: [] });
    expect(readPendingMerge('someone-else')).toBeNull();
    expect(readPendingMerge('google-1')).toBeNull();
  });

  it('can be cleared once the merge has finished', () => {
    savePendingMerge({ uid: 'google-1', assignments: [], sessions: [], grades: [] });
    clearPendingMerge();
    expect(readPendingMerge('google-1')).toBeNull();
  });

  it('survives garbage in storage', () => {
    localStorage.setItem('studyflow_pending_merge_v1', '{not json');
    expect(readPendingMerge('google-1')).toBeNull();
  });
});
