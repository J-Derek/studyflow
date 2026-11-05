import { describe, expect, it } from 'vitest';
import { MAX_BACKUP_BYTES, validateBackupJson } from './backupValidator';

const asg = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  title: 'T',
  course: 'C',
  dueDate: '2026-11-03',
  priority: 'low',
  status: 'pending',
  progress: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...over
});
const wrap = (assignments: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ version: 'StudyFlow-v1.2', exportedAt: 'x', ledger: { assignments, sessions: [], grades: [], ...extra } });

describe('backup import: hostile input', () => {
  it('rejects a file over the size cap', () => {
    const r = validateBackupJson('{"ledger":{"assignments":[]},"pad":"' + 'x'.repeat(MAX_BACKUP_BYTES) + '"}');
    expect(r.success).toBe(false);
  });
  it('rejects duplicate ids', () => {
    const r = validateBackupJson(wrap([asg(), asg({ title: 'copy' })]));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain('Duplicate assignment id');
  });
  it('rejects __proto__ nested deep and leaves Object.prototype untouched', () => {
    const raw = '{"ledger":{"assignments":[],"x":{"y":[{"z":{"__proto__":{"polluted":true}}}]}}}';
    expect(validateBackupJson(raw).success).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('accepts the words "constructor" and "prototype" as ordinary text (they used to be rejected)', () => {
    const r = validateBackupJson(wrap([asg({ title: 'constructor', notes: 'prototype' })]));
    expect(r.success).toBe(true);
  });
  it('strips unknown keys and the sample flag', () => {
    const r = validateBackupJson(wrap([asg({ sample: true, isAdmin: true, role: 'x' })]));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(Object.keys(r.data.ledger.assignments[0]).sort()).toEqual([
        'course', 'createdAt', 'dueDate', 'id', 'priority', 'progress', 'status', 'title'
      ]);
    }
  });
  it('rejects bad time formats, null progress and completed-below-100', () => {
    expect(validateBackupJson(wrap([asg({ dueTime: '25:61' })])).success).toBe(false);
    expect(validateBackupJson(wrap([asg({ progress: null })])).success).toBe(false);
    expect(validateBackupJson(wrap([asg({ status: 'completed', progress: 50 })])).success).toBe(false);
  });
  it('rejects oversized strings and too many subtasks', () => {
    expect(validateBackupJson(wrap([asg({ title: 'x'.repeat(251) })])).success).toBe(false);
    const subs = Array.from({ length: 101 }, (_, i) => ({ id: `s${i}`, title: 't', completed: false }));
    expect(validateBackupJson(wrap([asg({ subtasks: subs })])).success).toBe(false);
  });
  it('does not blow the stack on a deeply nested object', () => {
    let deep = '1';
    for (let i = 0; i < 2000; i++) deep = `{"a":${deep}}`;
    const r = validateBackupJson(`{"ledger":{"assignments":[]},"deep":${deep}}`);
    expect(typeof r.success).toBe('boolean');
  });
});
