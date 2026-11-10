import { describe, expect, it } from 'vitest';
import type { Assignment, StudySession } from '../types';
import { addDays, classesOn, dayOfWeekOf, deadlinesByDate, isoDate, mondayOf, monthGrid, monthLabel, occurrencesInRange, selectPendingDeadlines } from './calendarMonth';

const asg = (over: Partial<Assignment>): Assignment => ({
  id: 'a', title: 'T', course: 'C', dueDate: '2026-11-20', priority: 'medium', status: 'pending', progress: 0, createdAt: 'z', ...over
});
const ses = (over: Partial<StudySession>): StudySession => ({ id: 's', title: 'Class', course: 'C', dayOfWeek: 1, startTime: '10:00', endTime: '11:00', type: 'lecture', ...over });

describe('dates', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('knows the weekday, Sunday being 0', () => {
    expect(dayOfWeekOf('2026-11-09')).toBe(1); // a Monday
    expect(dayOfWeekOf('2026-11-15')).toBe(0); // a Sunday
  });
  it('finds the Monday of any week, with Sunday belonging to the week before', () => {
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
    expect(mondayOf('2026-11-12')).toBe('2026-11-09');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09');
    expect(mondayOf('2026-11-16')).toBe('2026-11-16');
  });
  it('formats a month name', () => expect(monthLabel(2026, 11)).toBe('November 2026'));
});

describe('monthGrid', () => {
  it('is full Monday-to-Sunday rows that cover the month exactly once', () => {
    for (const [y, m] of [[2026, 11], [2026, 2], [2028, 2], [2026, 3], [2027, 8], [2026, 12], [2025, 6]] as const) {
      const rows = monthGrid(y, m);
      expect(rows.length).toBeGreaterThanOrEqual(4);
      expect(rows.length).toBeLessThanOrEqual(6);
      for (const row of rows) {
        expect(row).toHaveLength(7);
        expect(row[0]!.dayOfWeek).toBe(1); // starts on Monday
        expect(row[6]!.dayOfWeek).toBe(0); // ends on Sunday
      }
      const inMonth = rows.flat().filter((c) => c.inMonth);
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      expect(inMonth.map((c) => c.day)).toEqual(Array.from({ length: days }, (_, i) => i + 1));
      // dates run on without gaps or repeats
      const all = rows.flat().map((c) => c.date);
      expect(new Set(all).size).toBe(all.length);
      for (let i = 1; i < all.length; i++) expect(all[i]).toBe(addDays(all[i - 1]!, 1));
    }
  });
  it('handles a month that starts on a Monday, a month that starts on a Sunday, and February in a leap year', () => {
    expect(monthGrid(2026, 6)[0]![0]).toMatchObject({ date: '2026-06-01', inMonth: true }); // 1 June 2026 is a Monday
    expect(monthGrid(2026, 3)[0]![0]).toMatchObject({ date: '2026-02-23', inMonth: false }); // 1 March 2026 is a Sunday: six filler days first
    expect(monthGrid(2028, 2).flat().filter((c) => c.inMonth)).toHaveLength(29);
    expect(monthGrid(2027, 2).flat().filter((c) => c.inMonth)).toHaveLength(28);
  });
  it('marks the filler days from the next year as not in the month', () => {
    const rows = monthGrid(2026, 12);
    const last = rows[rows.length - 1]!;
    expect(last.some((c) => c.date.startsWith('2027') && !c.inMonth)).toBe(true);
    expect(isoDate(2026, 12, 5)).toBe('2026-12-05');
  });
});

describe('classes repeat every week', () => {
  const list = [ses({ id: 'mon', dayOfWeek: 1, startTime: '14:00' }), ses({ id: 'mon2', dayOfWeek: 1, startTime: '08:00' }), ses({ id: 'sun', dayOfWeek: 0 })];
  it('puts each class on every date with its weekday, earliest first', () => {
    expect(classesOn(list, '2026-11-09').map((s) => s.id)).toEqual(['mon2', 'mon']);
    expect(classesOn(list, '2026-11-16').map((s) => s.id)).toEqual(['mon2', 'mon']);
    expect(classesOn(list, '2026-11-15').map((s) => s.id)).toEqual(['sun']);
    expect(classesOn(list, '2026-11-10')).toEqual([]);
  });
  it('lists only the dates in a range that have a class', () => {
    const map = occurrencesInRange(list, '2026-11-09', '2026-11-22');
    expect([...map.keys()]).toEqual(['2026-11-09', '2026-11-15', '2026-11-16', '2026-11-22']);
  });
});

describe('deadlines', () => {
  it('groups by date, earliest time first, and can leave out sample items', () => {
    const list = [
      asg({ id: '1', title: 'B', dueDate: '2026-11-20', dueTime: '17:00' }),
      asg({ id: '2', title: 'A', dueDate: '2026-11-20', dueTime: '09:00' }),
      asg({ id: '3', title: 'S', dueDate: '2026-11-21', sample: true }),
      asg({ id: '4', title: 'N', dueDate: '2026-11-20' })
    ];
    const all = deadlinesByDate(list);
    expect(all.get('2026-11-20')!.map((a) => a.id)).toEqual(['2', '1', '4']); // no time = end of day
    expect(all.has('2026-11-21')).toBe(true);
    expect(deadlinesByDate(list, { withoutSample: true }).has('2026-11-21')).toBe(false);
  });
  it('selectPendingDeadlines drops finished work and orders soonest first, overdue leading', () => {
    const list = [
      asg({ id: 'late', dueDate: '2026-12-01' }),
      asg({ id: 'done', dueDate: '2026-10-01', status: 'completed', progress: 100 }),
      asg({ id: 'overdue', dueDate: '2026-10-15', status: 'in_progress' }),
      asg({ id: 'soon', dueDate: '2026-11-10', dueTime: '08:00' })
    ];
    expect(selectPendingDeadlines(list).map((a) => a.id)).toEqual(['overdue', 'soon', 'late']);
    expect(selectPendingDeadlines([])).toEqual([]);
  });

  it('selectPendingDeadlines sorts by date, then priority (high first), then time, with overdue still leading',()=>{
    const list = [
      asg({ id: 'low', dueDate: '2026-11-20', priority: 'low' }),
      asg({ id: 'high-late', dueDate: '2026-11-20', priority: 'high', dueTime: '18:00' }),
      asg({ id: 'high-early', dueDate: '2026-11-20', priority: 'high', dueTime: '09:00' }),
      asg({ id: 'medium', dueDate: '2026-11-20', priority: 'medium' }),
      asg({ id: 'overdue-low', dueDate: '2026-11-01', priority: 'low' }),
    ];
    expect(selectPendingDeadlines(list).map((x) => x.id)).toEqual(['overdue-low', 'high-early', 'high-late', 'medium', 'low']);
  });
});
