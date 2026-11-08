import { describe, expect, it } from 'vitest';
import { validateBackupJson } from './backupValidator';

const asg = (over: Record<string, unknown> = {}) => ({
  id: 'asg-1', title: 'Essay', course: 'LAW 101', dueDate: '2026-11-03', priority: 'medium', status: 'pending', progress: 0,
  createdAt: '2026-11-01T00:00:00.000Z', ...over
});
const note = (over: Record<string, unknown> = {}) => ({
  id: 'n-1', title: 'Week 3', body: 'Offer and acceptance.', course: 'LAW 101', pinned: true,
  createdAt: '2026-11-01T00:00:00.000Z', editedAt: '2026-11-02T00:00:00.000Z', ...over
});
const backup = (ledger: Record<string, unknown>) => JSON.stringify({ version: 'StudyFlow-v1.2', exportedAt: '2026-11-03T10:00:00.000Z', ledger });

describe('restoring a backup', () => {
  it('brings the notes back (they used to be checked and then silently dropped)', () => {
    const r = validateBackupJson(backup({ assignments: [asg()], sessions: [], grades: [], notes: [note(), note({ id: 'n-2', title: 'Exam tips', pinned: false })] }));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.ledger.notes?.map((n) => n.title)).toEqual(['Week 3', 'Exam tips']);
    expect(r.data.ledger.notes?.[0].pinned).toBe(true);
  });

  it('still works for an older backup with no notes at all', () => {
    const r = validateBackupJson(backup({ assignments: [asg()], sessions: [], grades: [] }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ledger.notes).toBeUndefined();
  });

  it('shortens an over-long checklist item instead of refusing the whole backup', () => {
    const long = 'x'.repeat(300);
    const r = validateBackupJson(backup({ assignments: [asg({ subtasks: [{ id: 's1', title: `  ${long}  `, completed: false }] })], sessions: [], grades: [] }));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.ledger.assignments[0].subtasks?.[0].title).toHaveLength(200);
  });

  it('still refuses a checklist item that is not text', () => {
    const r = validateBackupJson(backup({ assignments: [asg({ subtasks: [{ id: 's1', title: 42, completed: false }] })], sessions: [], grades: [] }));
    expect(r.success).toBe(false);
  });
});
