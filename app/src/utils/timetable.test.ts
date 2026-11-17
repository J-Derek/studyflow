import { describe, expect, it } from 'vitest';
import { clashingIds, findClashes, isOneOff, normaliseDayOfWeek, overlaps, toMinutes } from './timetable';
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

describe('one-off blocks only clash when they actually meet', () => {
  // 2026-11-18 is a Wednesday (day 3)
  const exam = block({ id: 'e', type: 'exam', date: '2026-11-18' });
  it('knows which types happen once', () => {
    expect(isOneOff('exam')).toBe(true);
    expect(isOneOff('review')).toBe(true);
    expect(isOneOff('lecture')).toBe(false);
    expect(isOneOff('lab')).toBe(false);
    expect(isOneOff('study')).toBe(false);
  });
  it('a dated block clashes with a weekly class on that weekday', () => {
    expect(overlaps(exam, block())).toBe(true);
  });
  it('a dated block on another weekday does not clash with the weekly class', () => {
    expect(overlaps(block({ id: 'e', type: 'exam', date: '2026-11-19', dayOfWeek: 4 }), block({ dayOfWeek: 4 }))).toBe(true);
    expect(overlaps(block({ id: 'e', type: 'exam', date: '2026-11-19', dayOfWeek: 4 }), block())).toBe(false);
  });
  it('two dated blocks clash only on the same date', () => {
    expect(overlaps(exam, block({ id: 'r', type: 'review', date: '2026-11-18' }))).toBe(true);
    expect(overlaps(exam, block({ id: 'r', type: 'review', date: '2026-11-25' }))).toBe(false);
  });
  it('a weekly class outside the semester does not clash with a dated block', () => {
    expect(overlaps(exam, block(), { end: '2026-11-13' })).toBe(false);
    expect(overlaps(exam, block(), { start: '2026-09-07', end: '2026-11-20' })).toBe(true);
    expect([...clashingIds([exam, block()], { end: '2026-11-13' })]).toEqual([]);
    expect(findClashes([block()], { dayOfWeek: 3, date: '2026-11-18', startTime: '10:00', endTime: '11:00' }).map((s) => s.id)).toEqual(['b1']);
  });
});
