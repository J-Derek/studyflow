import { describe, it, expect } from 'vitest';
import { validateBackupJson, hasPrototypePollution } from './backupValidator';

describe('backupValidator', () => {
  const sampleValidPayload = {
    version: 'StudyFlow-v1.2',
    exportedAt: '2026-11-03T10:00:00.000Z',
    ledger: {
      assignments: [
        {
          id: 'asg-1',
          title: 'Distributed Consensus Algorithm Synthesis',
          course: 'CS 4400',
          dueDate: '2026-11-03',
          dueTime: '23:59',
          priority: 'high',
          status: 'in_progress',
          progress: 75,
          notes: 'Implement Raft leader election',
          subtasks: [
            { id: 'st-1', title: 'Review Raft paper', completed: true },
            { id: 'st-2', title: 'Write tests', completed: false }
          ],
          createdAt: '2026-11-01T00:00:00.000Z'
        }
      ],
      sessions: [
        {
          id: 's-1',
          title: 'Distributed Systems Lecture',
          course: 'CS 4400',
          dayOfWeek: 1,
          startTime: '10:00',
          endTime: '11:30',
          type: 'lecture'
        }
      ],
      grades: [
        {
          id: 'g-1',
          courseCode: 'CS 4400',
          courseName: 'Distributed Systems',
          credits: 4,
          targetLetter: 'A',
          color: '#3B82F6',
          assessments: [
            { id: 'a-1', name: 'Midterm', weight: 30, score: 92 }
          ]
        }
      ]
    }
  };

  it('validates and accepts legitimate academic ledger backup payloads', () => {
    const rawJson = JSON.stringify(sampleValidPayload);
    const result = validateBackupJson(rawJson);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ledger.assignments).toHaveLength(1);
      expect(result.data.ledger.sessions).toHaveLength(1);
      expect(result.data.ledger.grades).toHaveLength(1);
      expect(result.data.ledger.assignments[0].title).toBe('Distributed Consensus Algorithm Synthesis');
    }
  });

  it('rejects prototype pollution attack vectors in raw string and object graphs', () => {
    const maliciousPayload = '{"version": "StudyFlow-v1.2", "__proto__": {"isAdmin": true}, "ledger": {"assignments": []}}';

    const result = validateBackupJson(maliciousPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Security alert');
    }

    const parsedObj = JSON.parse(maliciousPayload);
    expect(hasPrototypePollution(parsedObj)).toBe(true);
  });

  it('rejects constructor pollution payloads', () => {
    const maliciousConstructor = '{"constructor": {"prototype": {"admin": true}}, "ledger": {"assignments": []}}';
    const result = validateBackupJson(maliciousConstructor);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Security alert');
    }
  });

  it('rejects malformed assignments with invalid status or priority enums', () => {
    const invalidStatus = {
      ledger: {
        assignments: [
          {
            id: 'asg-bad',
            title: 'Test',
            course: 'CS 101',
            dueDate: '2026-11-03',
            priority: 'extreme_urgency', // Invalid priority enum
            status: 'in_progress',
            progress: 50,
            createdAt: '2026-11-01'
          }
        ]
      }
    };

    const result = validateBackupJson(JSON.stringify(invalidStatus));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Malformed assignment record');
    }
  });

  it('rejects assignments with invalid date format', () => {
    const badDate = {
      ledger: {
        assignments: [
          {
            id: 'asg-bad-date',
            title: 'Test',
            course: 'CS 101',
            dueDate: 'Tomorrow afternoon', // Invalid date format
            priority: 'high',
            status: 'pending',
            progress: 0,
            createdAt: '2026-11-01'
          }
        ]
      }
    };

    const result = validateBackupJson(JSON.stringify(badDate));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Malformed assignment record');
    }
  });

  it('rejects assignments with progress out of bounds (> 100 or negative)', () => {
    const overflowProgress = {
      ledger: {
        assignments: [
          {
            id: 'asg-overflow',
            title: 'Test',
            course: 'CS 101',
            dueDate: '2026-11-03',
            priority: 'high',
            status: 'completed',
            progress: 150, // Out of bounds
            createdAt: '2026-11-01'
          }
        ]
      }
    };

    const result = validateBackupJson(JSON.stringify(overflowProgress));
    expect(result.success).toBe(false);
  });

  it('enforces DoS protection by rejecting payloads exceeding 1000 assignments', () => {
    const massiveAssignments = Array.from({ length: 1001 }, (_, i) => ({
      id: `asg-${i}`,
      title: `Assignment ${i}`,
      course: 'CS 101',
      dueDate: '2026-11-03',
      priority: 'medium',
      status: 'pending',
      progress: 0,
      createdAt: '2026-11-01'
    }));

    const payload = JSON.stringify({
      ledger: { assignments: massiveAssignments }
    });

    const result = validateBackupJson(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Exceeded maximum allowable assignments');
    }
  });

  it('keeps a kind through a backup, drops the default one, and refuses an unknown one', () => {
    const withKind = (kind: unknown) => {
      const p = JSON.parse(JSON.stringify(sampleValidPayload));
      p.ledger.assignments[0].kind = kind;
      return validateBackupJson(JSON.stringify(p));
    };
    const exam = withKind('exam');
    expect(exam.success).toBe(true);
    if (exam.success) expect(exam.data.ledger.assignments[0].kind).toBe('exam');
    const plain = withKind('assignment');
    expect(plain.success).toBe(true);
    if (plain.success) expect(plain.data.ledger.assignments[0].kind).toBeUndefined();
    expect(withKind('homework').success).toBe(false);
    expect(withKind(7).success).toBe(false);
  });

  it('keeps drafts through a backup, and refuses a malformed or oversized list', () => {
    const withDrafts = (drafts: unknown) => {
      const p = JSON.parse(JSON.stringify(sampleValidPayload));
      p.ledger.drafts = drafts;
      return validateBackupJson(JSON.stringify(p));
    };
    const ok = withDrafts([{ id: 'asg-1', body: 'My essay', editedAt: '2030-01-01T00:00:00.000Z', extra: 'dropped' }]);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.ledger.drafts).toEqual([{ id: 'asg-1', body: 'My essay', editedAt: '2030-01-01T00:00:00.000Z' }]);
    expect(validateBackupJson(JSON.stringify(sampleValidPayload)).success).toBe(true); // older files have no drafts
    expect(withDrafts('nope').success).toBe(false);
    expect(withDrafts([{ id: '', body: 'x', editedAt: 'z' }]).success).toBe(false);
    expect(withDrafts([{ id: 'a', body: 5, editedAt: 'z' }]).success).toBe(false);
    expect(withDrafts([{ id: 'a', body: 'x', editedAt: 'z' }, { id: 'a', body: 'y', editedAt: 'z' }]).success).toBe(false);
  });

  it('keeps archived items with their period, and the list of past semesters', () => {
    const p = JSON.parse(JSON.stringify(sampleValidPayload));
    p.ledger.assignments[0].archivedPeriod = 'p1';
    p.ledger.sessions[0].archivedPeriod = 'p1';
    p.ledger.grades[0].archivedPeriod = 'p1';
    p.ledger.periods = [{ id: 'p1', name: 'Semester 1', label: 'term', archivedAt: '2026-01-01T00:00:00.000Z', counts: { assignments: 1, sessions: 1, grades: 1, notes: 0 } }];
    const r = validateBackupJson(JSON.stringify(p));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ledger.assignments[0].archivedPeriod).toBe('p1');
      expect(r.data.ledger.sessions[0].archivedPeriod).toBe('p1');
      expect(r.data.ledger.grades[0].archivedPeriod).toBe('p1');
      expect(r.data.ledger.periods).toEqual(p.ledger.periods);
    }
  });
  it('refuses a malformed or oversized list of past semesters and cleans odd values', () => {
    const withPeriods = (periods: unknown) => {
      const p = JSON.parse(JSON.stringify(sampleValidPayload));
      p.ledger.periods = periods;
      return validateBackupJson(JSON.stringify(p));
    };
    expect(withPeriods('x').success).toBe(false);
    expect(withPeriods([{ id: '', name: 'a', archivedAt: 'z' }]).success).toBe(false);
    expect(withPeriods([{ id: 'p', name: 5, archivedAt: 'z' }]).success).toBe(false);
    expect(withPeriods(Array.from({ length: 101 }, (_, i) => ({ id: `p${i}`, name: 'n', archivedAt: 'z' }))).success).toBe(false);
    expect(withPeriods([{ id: 'p', name: 'n', archivedAt: 'z' }, { id: 'p', name: 'm', archivedAt: 'z' }]).success).toBe(false);
    const ok = withPeriods([{ id: 'p', name: 'n', label: 'year', archivedAt: 'z', counts: { assignments: -3, sessions: 99999 } }]);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.ledger.periods![0]).toMatchObject({ label: 'semester', counts: { assignments: 0, sessions: 5000, grades: 0, notes: 0 } });
  });

  it('handles empty or malformed JSON syntax gracefully', () => {
    expect(validateBackupJson('').success).toBe(false);
    expect(validateBackupJson('{ broken json').success).toBe(false);
  });
});
