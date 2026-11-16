import { describe, expect, it } from 'vitest';
import type { Assignment } from '../types';
import { orderAssignmentsList } from './assignmentOrder';

const a = (title: string, over: Partial<Assignment> = {}): Assignment => ({
  id: title,
  title,
  course: 'TEST 101',
  dueDate: '2030-01-15',
  priority: 'medium',
  status: 'pending',
  progress: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over
});

describe('orderAssignmentsList', () => {
  it('puts unfinished work first (overdue, then by date, priority and time) and finished work last', () => {
    const list = [
      a('Done long ago', { status: 'completed', progress: 100, dueDate: '2020-01-01', completedAt: '2026-01-01T00:00:00.000Z' }),
      a('Later high', { dueDate: '2030-02-01', priority: 'high' }),
      a('Soon low', { priority: 'low' }),
      a('Overdue', { dueDate: '2020-01-05' }),
      a('Soon high', { priority: 'high' }),
      a('Soon high morning', { priority: 'high', dueTime: '09:00' }),
      a('Done just now', { status: 'completed', progress: 100, dueDate: '2030-03-01', completedAt: '2026-11-01T00:00:00.000Z' })
    ];
    expect(orderAssignmentsList(list).map((x) => x.title)).toEqual([
      'Overdue',
      'Soon high morning',
      'Soon high',
      'Soon low',
      'Later high',
      // finished: the most recently finished first, so a slip of the finger is easy to find and undo
      'Done just now',
      'Done long ago'
    ]);
  });

  it('does not change the list it is given', () => {
    const list = [a('B', { dueDate: '2030-02-01' }), a('A')];
    orderAssignmentsList(list);
    expect(list.map((x) => x.title)).toEqual(['B', 'A']);
  });
});
