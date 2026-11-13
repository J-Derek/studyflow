import { describe, expect, it } from 'vitest';
import type { Assignment } from '../types';
import { rollRepeats } from './repeat';

const asg = (over: Partial<Assignment>): Assignment => ({
  id: 'a1', title: 'Weekly quiz', course: 'MATH 101', dueDate: '2026-11-16', priority: 'high', status: 'pending', progress: 0, createdAt: 'z',
  repeat: { every: 'week' }, ...over
});

describe('rollRepeats', () => {
  it('creates next week\'s item when a repeating one is completed, and stops the old one repeating', () => {
    const src = asg({
      status: 'completed', progress: 100, completedAt: 'x', kind: 'test', dueTime: '10:00', notes: 'ch 3',
      subtasks: [{ id: 's1', title: 'Revise', completed: true }, { id: 's2', title: 'Practice', completed: true }]
    });
    const { spawned, updated } = rollRepeats([src], '2026-11-14');
    expect(spawned).toHaveLength(1);
    const n = spawned[0];
    expect(n.id).not.toBe('a1');
    expect(n).toMatchObject({ title: 'Weekly quiz', course: 'MATH 101', kind: 'test', priority: 'high', dueTime: '10:00', notes: 'ch 3', dueDate: '2026-11-23', status: 'pending', progress: 0, repeat: { every: 'week' }, repeatOf: 'a1' });
    expect(n.completedAt).toBeUndefined();
    expect(n.subtasks?.map((s) => [s.title, s.completed])).toEqual([['Revise', false], ['Practice', false]]);
    expect(new Set([...(n.subtasks ?? []).map((s) => s.id), 's1', 's2']).size).toBe(4);
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('a1');
    expect(updated[0].repeat).toBeUndefined();
  });
  it('creates the next item when the due date has passed, landing on the first date not in the past', () => {
    const { spawned } = rollRepeats([asg({ dueDate: '2026-11-02' })], '2026-11-14');
    expect(spawned[0].dueDate).toBe('2026-11-16');
    expect(rollRepeats([asg({ dueDate: '2026-11-13' })], '2026-11-14').spawned[0].dueDate).toBe('2026-11-20');
  });
  it('does nothing for a pending one that is not yet due, or one that does not repeat', () => {
    expect(rollRepeats([asg({ dueDate: '2026-11-14' })], '2026-11-14')).toEqual({ spawned: [], updated: [] });
    expect(rollRepeats([asg({ repeat: undefined, status: 'completed', progress: 100 })], '2026-11-14')).toEqual({ spawned: [], updated: [] });
  });
  it('is the same item on every device, so two devices cannot make two, and never twice on one', () => {
    const src = asg({ status: 'completed', progress: 100 });
    const a = rollRepeats([src], '2026-11-14').spawned[0];
    const b = rollRepeats([src], '2026-11-15').spawned[0];
    expect(a.id).toBe(b.id);
    expect(rollRepeats([src, a], '2026-11-14').spawned).toEqual([]);
    const after = rollRepeats([src], '2026-11-14');
    expect(rollRepeats([after.updated[0], ...after.spawned], '2026-11-14')).toEqual({ spawned: [], updated: [] });
  });
  it('keeps ids short however long the series runs', () => {
    let list: Assignment[] = [asg({ id: 'asg-1700000000000-ab12', status: 'completed', progress: 100 })];
    let today = '2026-11-14';
    for (let i = 0; i < 60; i++) {
      const r = rollRepeats(list, today);
      const next = r.spawned[0];
      expect(next.id.length).toBeLessThanOrEqual(100);
      expect(next.repeatOf).toBe('asg-1700000000000-ab12');
      list = [...r.updated, { ...next, status: 'completed', progress: 100 }];
      today = next.dueDate;
    }
  });
  it('stops at the end date, and ignores sample and archived items', () => {
    const r = rollRepeats([asg({ status: 'completed', progress: 100, repeat: { every: 'week', until: '2026-11-20' } })], '2026-11-14');
    expect(r.spawned).toEqual([]);
    expect(r.updated[0].repeat).toBeUndefined();
    expect(rollRepeats([asg({ status: 'completed', progress: 100, repeat: { every: 'week', until: '2026-11-23' } })], '2026-11-14').spawned[0].dueDate).toBe('2026-11-23');
    expect(rollRepeats([asg({ status: 'completed', progress: 100, sample: true })], '2026-11-14')).toEqual({ spawned: [], updated: [] });
    expect(rollRepeats([asg({ status: 'completed', progress: 100, archivedPeriod: 'p1' })], '2026-11-14')).toEqual({ spawned: [], updated: [] });
  });
});
