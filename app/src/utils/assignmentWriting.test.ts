import { describe, expect, it } from 'vitest';
import type { Assignment, Draft } from '../types';
import { assignmentWritings, courseCode } from './assignmentWriting';

const a = (id: string, title: string, course: string): Assignment => ({
  id,
  title,
  course,
  dueDate: '2030-01-15',
  priority: 'medium',
  status: 'pending',
  progress: 0,
  createdAt: '2030-01-01T00:00:00.000Z'
});
const d = (id: string, body: string, editedAt: string): Draft => ({ id, body, editedAt });

const assignments = [a('e1', 'Contract law essay', 'LAW 101 — Contract law'), a('r1', 'Lab report', 'PHY 201'), a('x1', 'No writing yet', 'LAW 101')];
const drafts = [d('e1', 'Offer and acceptance', '2030-01-02T10:00:00.000Z'), d('r1', 'Method: a pendulum', '2030-01-03T10:00:00.000Z'), d('gone', 'For an assignment that was deleted', '2030-01-04T10:00:00.000Z'), d('x1', '   ', '2030-01-05T10:00:00.000Z')];

describe('the writing done for assignments, as the Notes page lists it', () => {
  it('lists each assignment that has writing, newest first, with its assignment', () => {
    const list = assignmentWritings(drafts, assignments, { query: '', course: 'all' });
    expect(list.map((w) => [w.assignment.title, w.draft.body])).toEqual([
      ['Lab report', 'Method: a pendulum'],
      ['Contract law essay', 'Offer and acceptance']
    ]);
  });
  it('leaves out blank writing and writing whose assignment is gone', () => {
    const titles = assignmentWritings(drafts, assignments, { query: '', course: 'all' }).map((w) => w.assignment.title);
    expect(titles).not.toContain('No writing yet');
    expect(titles).toHaveLength(2);
  });
  it('is found by the search box, in the title, the text or the course', () => {
    const find = (query: string) => assignmentWritings(drafts, assignments, { query, course: 'all' }).map((w) => w.assignment.id);
    expect(find('ACCEPTANCE')).toEqual(['e1']);
    expect(find('lab')).toEqual(['r1']);
    expect(find('phy 201')).toEqual(['r1']);
    expect(find('nothing like this')).toEqual([]);
  });
  it('follows the course filter: the code of the assignment course matches the course a note is filed under', () => {
    expect(courseCode('LAW 101 — Contract law')).toBe('LAW 101');
    expect(assignmentWritings(drafts, assignments, { query: '', course: 'LAW 101' }).map((w) => w.assignment.id)).toEqual(['e1']);
    expect(assignmentWritings(drafts, assignments, { query: '', course: 'none' })).toEqual([]);
  });
});
