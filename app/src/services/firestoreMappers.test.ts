import { describe, expect, it } from 'vitest';
import { assignmentToDoc, docToAssignment, sessionToDoc } from './firestoreMappers';
import type { Assignment } from '../types';

const base: Assignment = {
  id: 'a1', title: 'T', course: 'C', dueDate: '2030-01-01', priority: 'low', status: 'pending', progress: 0, createdAt: 'z'
};

describe('assignmentToDoc', () => {
  it('never emits undefined (Firestore rejects it) or unknown keys', () => {
    const doc = assignmentToDoc({ ...base, dueTime: undefined, notes: undefined, completedAt: undefined });
    expect(Object.values(doc).some((v) => v === undefined)).toBe(false);
    expect(Object.keys(doc).sort()).toEqual(['course', 'createdAt', 'dueDate', 'id', 'priority', 'progress', 'status', 'title']);
  });
  it('drops an invalid dueTime and replaces NaN progress', () => {
    const doc = assignmentToDoc({ ...base, dueTime: '5pm', progress: NaN });
    expect('dueTime' in doc).toBe(false);
    expect(doc.progress).toBe(0);
  });
  it('stores subtasks as a map keyed by id and round-trips order', () => {
    const subtasks = [
      { id: 's2', title: 'second', completed: false },
      { id: 's1', title: 'first', completed: true }
    ];
    const doc = assignmentToDoc({ ...base, subtasks });
    expect(Array.isArray(doc.subtasks)).toBe(false);
    expect(Object.keys(doc.subtasks as object).sort()).toEqual(['s1', 's2']);
    expect(docToAssignment('a1', doc).subtasks).toEqual(subtasks);
  });
  it('accepts a legacy list of subtasks when reading', () => {
    const a = docToAssignment('a1', { ...assignmentToDoc(base), subtasks: [{ id: 'x', title: 't', completed: true }] });
    expect(a.subtasks).toEqual([{ id: 'x', title: 't', completed: true }]);
  });
  it('keeps the sample flag', () => {
    expect(assignmentToDoc({ ...base, sample: true }).sample).toBe(true);
    expect(docToAssignment('a1', assignmentToDoc({ ...base, sample: true })).sample).toBe(true);
  });
  it('survives hostile remote data without throwing', () => {
    const a = docToAssignment('a1', { title: 5, progress: 'x', subtasks: 'nope', priority: { __proto__: 1 } });
    expect(a.title).toBe('');
    expect(a.progress).toBe(0);
    expect(a.subtasks).toBeUndefined();
  });
});

describe('sessionToDoc', () => {
  it('omits undefined colour', () => {
    const doc = sessionToDoc({ id: 's', title: 't', course: 'c', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', type: 'lecture' });
    expect('color' in doc).toBe(false);
  });
});
