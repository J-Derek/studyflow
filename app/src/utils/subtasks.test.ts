import { describe, it, expect } from 'vitest';
import { calculateSubtaskProgress } from './subtasks';
import type { Subtask } from '../types';

describe('calculateSubtaskProgress', () => {
  it('handles null or empty subtasks array using fallback progress', () => {
    const emptyResult = calculateSubtaskProgress([], 45);
    expect(emptyResult.progress).toBe(45);
    expect(emptyResult.status).toBe('in_progress');
    expect(emptyResult.allDone).toBe(false);
    expect(emptyResult.totalCount).toBe(0);

    const completedFallback = calculateSubtaskProgress(null, 100);
    expect(completedFallback.progress).toBe(100);
    expect(completedFallback.status).toBe('completed');
    expect(completedFallback.allDone).toBe(true);

    const zeroFallback = calculateSubtaskProgress([], 0);
    expect(zeroFallback.status).toBe('pending');
  });

  it('computes exact progress for partial subtask completion', () => {
    const subtasks: Subtask[] = [
      { id: '1', title: 'Task 1', completed: true },
      { id: '2', title: 'Task 2', completed: false },
      { id: '3', title: 'Task 3', completed: false },
      { id: '4', title: 'Task 4', completed: false }
    ];

    const result = calculateSubtaskProgress(subtasks);
    expect(result.progress).toBe(25);
    expect(result.status).toBe('in_progress');
    expect(result.allDone).toBe(false);
    expect(result.completedCount).toBe(1);
    expect(result.totalCount).toBe(4);
  });

  it('strictly enforces the 99% cap invariant when items remain incomplete', () => {
    // 199 out of 200 subtasks completed (99.5% mathematically)
    const largeSet: Subtask[] = Array.from({ length: 200 }, (_, i) => ({
      id: `st-${i}`,
      title: `Subtask ${i}`,
      completed: i < 199 // only the 200th is false
    }));

    const result = calculateSubtaskProgress(largeSet);
    // Strict invariant assertion: Must NOT be 100% or round up to 100%
    expect(result.progress).toBe(99);
    expect(result.status).toBe('in_progress');
    expect(result.allDone).toBe(false);
    expect(result.completedCount).toBe(199);
    expect(result.totalCount).toBe(200);
  });

  it('sets 100% progress and completed status when all subtasks are finished', () => {
    const allFinished: Subtask[] = [
      { id: '1', title: 'A', completed: true },
      { id: '2', title: 'B', completed: true },
      { id: '3', title: 'C', completed: true }
    ];

    const result = calculateSubtaskProgress(allFinished);
    expect(result.progress).toBe(100);
    expect(result.status).toBe('completed');
    expect(result.allDone).toBe(true);
    expect(result.completedCount).toBe(3);
    expect(result.totalCount).toBe(3);
  });

  it('reverts status and caps progress when an item is unchecked', () => {
    const subtasks: Subtask[] = [
      { id: '1', title: 'A', completed: true },
      { id: '2', title: 'B', completed: true },
      { id: '3', title: 'C', completed: true }
    ];

    const beforeUncheck = calculateSubtaskProgress(subtasks);
    expect(beforeUncheck.progress).toBe(100);
    expect(beforeUncheck.status).toBe('completed');

    // Uncheck item C
    subtasks[2].completed = false;
    const afterUncheck = calculateSubtaskProgress(subtasks);
    // 2/3 = 66.66% -> floor = 66%
    expect(afterUncheck.progress).toBe(66);
    expect(afterUncheck.status).toBe('in_progress');
    expect(afterUncheck.allDone).toBe(false);
  });

  it('sets pending status when all subtasks are unchecked', () => {
    const subtasks: Subtask[] = [
      { id: '1', title: 'A', completed: false },
      { id: '2', title: 'B', completed: false }
    ];

    const result = calculateSubtaskProgress(subtasks);
    expect(result.progress).toBe(0);
    expect(result.status).toBe('pending');
    expect(result.allDone).toBe(false);
  });
});

describe('explicit completion (add/delete never complete an assignment)', () => {
  const st = (id: string, completed: boolean) => ({ id, title: id, completed });

  it('deleting the last open subtask does not complete the assignment', () => {
    const afterDelete = [st('a', true), st('b', true)]; // the only open one was deleted
    const r = calculateSubtaskProgress(afterDelete, 50, { allowComplete: false });
    expect(r.status).toBe('in_progress');
    expect(r.progress).toBe(99);
    expect(r.allDone).toBe(false);
  });

  it('an explicit tick of the last subtask still completes', () => {
    const r = calculateSubtaskProgress([st('a', true), st('b', true)], 0);
    expect(r.status).toBe('completed');
    expect(r.progress).toBe(100);
  });

  it('never returns NaN for an empty list', () => {
    for (const input of [[], null, undefined]) {
      const r = calculateSubtaskProgress(input as never, 0, { allowComplete: false });
      expect(Number.isNaN(r.progress)).toBe(false);
    }
  });
});
