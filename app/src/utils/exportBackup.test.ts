import { describe, expect, it } from 'vitest';
import { backupFromSavedCopy, buildBackup } from './exportBackup';
import { validateBackupJson } from './backupValidator';

const now = new Date('2030-01-02T03:04:05.000Z');

describe('buildBackup', () => {
  it('leaves out sample rows and keeps notes', () => {
    const b = buildBackup(
      {
        assignments: [{ sample: true }, {}],
        sessions: [{}, { sample: true }],
        grades: [{ sample: true }],
        notes: [{ id: 'n' }]
      },
      now
    );
    expect(b.version).toBe('StudyFlow-v1.2');
    expect(b.exportedAt).toBe('2030-01-02T03:04:05.000Z');
    expect(b.ledger.assignments).toHaveLength(1);
    expect(b.ledger.sessions).toHaveLength(1);
    expect(b.ledger.grades).toHaveLength(0);
    expect(b.ledger.notes).toEqual([{ id: 'n' }]);
  });
});

describe('backupFromSavedCopy (the error screen reads the saved copy, not the store)', () => {
  it('builds a backup that the restore code accepts', () => {
    const saved = JSON.stringify({
      state: {
        assignments: [
          { id: 'a1', title: 'Essay', course: 'LAW 101', dueDate: '2030-02-01', priority: 'high', status: 'pending', progress: 0, createdAt: '2030-01-01T00:00:00.000Z' },
          { id: 'sample-1', title: 'Demo', sample: true }
        ],
        sessions: [],
        grades: [],
        notes: []
      }
    });
    const b = backupFromSavedCopy(saved, now)!;
    expect(b.ledger.assignments).toHaveLength(1);
    expect(validateBackupJson(JSON.stringify(b)).success).toBe(true);
  });

  it('copes with a missing, damaged or odd saved copy', () => {
    expect(backupFromSavedCopy(null)).toBeNull();
    expect(backupFromSavedCopy('{not json')).toBeNull();
    expect(backupFromSavedCopy('{"state":5}')).toBeNull();
    expect(backupFromSavedCopy('{}')).toBeNull();
    const odd = backupFromSavedCopy('{"state":{"assignments":"nope","notes":[1,null,{"id":"n"}]}}', now)!;
    expect(odd.ledger.assignments).toEqual([]);
    expect(odd.ledger.notes).toEqual([{ id: 'n' }]);
  });
});
