import { describe, expect, it } from 'vitest';
import { afterUncomplete, progressInfo } from './progress';
import { isAssignmentKind, kindOf } from './kinds';

const st = (n: number, done: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: `t${i}`, completed: i < done }));

describe('progressInfo', () => {
  it('uses the number the student set when there is no checklist', () => {
    expect(progressInfo({ progress: 35, status: 'in_progress' })).toEqual({ mode: 'manual', progress: 35, done: 0, total: 0, note: '' });
    expect(progressInfo({ progress: 35, status: 'in_progress', subtasks: [] }).mode).toBe('manual');
  });
  it('works it out from the ticks when there is a checklist, whatever number is stored', () => {
    expect(progressInfo({ progress: 90, status: 'in_progress', subtasks: st(5, 2) })).toEqual({
      mode: 'checklist',
      progress: 40,
      done: 2,
      total: 5,
      note: 'Based on your checklist: 2 of 5 done'
    });
  });
  it('never shows 100% for an unfinished checklist, and always 100% for a finished item', () => {
    expect(progressInfo({ progress: 100, status: 'in_progress', subtasks: st(3, 2) }).progress).toBe(66);
    expect(progressInfo({ progress: 100, status: 'completed', subtasks: st(3, 1) }).progress).toBe(100);
    expect(progressInfo({ progress: 100, status: 'completed' }).progress).toBe(100);
  });
});

describe('afterUncomplete', () => {
  it('goes back to the ticks when there is a checklist, but never to 100', () => {
    expect(afterUncomplete({ subtasks: st(4, 4) })).toEqual({ progress: 99, status: 'in_progress' });
    expect(afterUncomplete({ subtasks: st(4, 1) })).toEqual({ progress: 25, status: 'in_progress' });
    expect(afterUncomplete({ subtasks: st(4, 0) })).toEqual({ progress: 0, status: 'pending' });
  });
  it('keeps the old halfway value with no checklist', () => {
    expect(afterUncomplete({})).toEqual({ progress: 50, status: 'in_progress' });
    expect(afterUncomplete({ subtasks: [] })).toEqual({ progress: 50, status: 'in_progress' });
  });
});

describe('kinds', () => {
  it('treats a missing or unknown kind as an assignment', () => {
    expect(kindOf({})).toBe('assignment');
    expect(kindOf({ kind: 'exam' })).toBe('exam');
    expect(kindOf({ kind: 'homework' as never })).toBe('assignment');
    expect(isAssignmentKind('reading')).toBe(true);
    expect(isAssignmentKind('x')).toBe(false);
    expect(isAssignmentKind(5)).toBe(false);
  });
});
