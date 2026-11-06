import { describe, expect, it } from 'vitest';
import { clashingIds, findClashes, normaliseDayOfWeek, overlaps, toMinutes } from './timetable';
import type { StudySession } from '../types';

const block = (over: Partial<StudySession> = {}): StudySession => ({
  id: 'b1', title: 'Calculus', course: 'MAT344', dayOfWeek: 3, startTime: '10:00', endTime: '11:30', type: 'lecture', ...over
});

describe('timetable clashes', () => {
  it('parses times and rejects junk', () => {
    expect(toMinutes('09:05')).toBe(545);
    expect(toMinutes('24:00')).toBeNaN();
    expect(toMinutes('')).toBeNaN();
  });
  it('flags the same day and the same time (the case in the bug report)', () => {
    expect(overlaps(block(), block({ id: 'b2' }))).toBe(true);
  });
  it('flags partial overlap', () => {
    expect(overlaps(block(), block({ startTime: '11:00', endTime: '12:00' }))).toBe(true);
  });
  it('does not flag back-to-back blocks or different days', () => {
    expect(overlaps(block(), block({ startTime: '11:30', endTime: '12:30' }))).toBe(false);
    expect(overlaps(block(), block({ dayOfWeek: 4 }))).toBe(false);
  });
  it('ignores blocks with unreadable times', () => {
    expect(overlaps(block(), block({ startTime: 'x' }))).toBe(false);
  });
  it('finds clashes for a candidate and lists clashing ids', () => {
    const list = [block(), block({ id: 'b2', startTime: '13:00', endTime: '14:00' }), block({ id: 'b3', startTime: '10:30', endTime: '11:00' })];
    expect(findClashes(list, { dayOfWeek: 3, startTime: '10:15', endTime: '10:45' }).map((s) => s.id)).toEqual(['b1', 'b3']);
    expect([...clashingIds(list)].sort()).toEqual(['b1', 'b3']);
  });
  it('maps the old Sunday value 7 to 0', () => {
    expect(normaliseDayOfWeek(7)).toBe(0);
    expect(normaliseDayOfWeek(3)).toBe(3);
  });
});
