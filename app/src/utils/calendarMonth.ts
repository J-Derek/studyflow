import type { Assignment, StudySession } from '../types';
import { kindOf } from './kinds';

/**
 * The maths behind the month and week calendar. Dates are plain "YYYY-MM-DD" text in the student's own calendar (no time zones involved),
 * weeks start on Monday, and classes repeat every week on their day (the same rule the .ics export uses).
 */
export interface DayCell {
  /** "YYYY-MM-DD" */
  date: string;
  /** Day of the month, 1 to 31. */
  day: number;
  /** 0 = Sunday ... 6 = Saturday, the same numbers a class uses for `dayOfWeek`. */
  dayOfWeek: number;
  /** False for the greyed days from the month before or after that fill the first and last rows. */
  inMonth: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" for a calendar day (month is 1 to 12). */
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** The day after (or before, with a negative number) an "YYYY-MM-DD" date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 0 = Sunday ... 6 = Saturday for an "YYYY-MM-DD" date. */
export function dayOfWeekOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The Monday of the week that holds `date`. */
export function mondayOf(date: string): string {
  const dow = dayOfWeekOf(date);
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

/** Every day of a month as full Monday-to-Sunday rows (4 to 6 rows of 7), with the filler days marked `inMonth: false`. */
export function monthGrid(year: number, month: number): DayCell[][] {
  const first = isoDate(year, month, 1);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = isoDate(year, month, lastDay);
  const start = mondayOf(first);
  const end = addDays(mondayOf(last), 6);
  const rows: DayCell[][] = [];
  for (let cursor = start; cursor <= end; ) {
    const row: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const [, m, d] = cursor.split('-').map(Number);
      row.push({ date: cursor, day: d, dayOfWeek: dayOfWeekOf(cursor), inMonth: m === month && cursor.startsWith(String(year)) });
      cursor = addDays(cursor, 1);
    }
    rows.push(row);
  }
  return rows;
}

/** Classes that happen on one date (a class repeats every week on its day), earliest first. */
export function classesOn(sessions: StudySession[], date: string): StudySession[] {
  const dow = dayOfWeekOf(date);
  return sessions.filter((s) => s.dayOfWeek === dow).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Every date from `from` to `to` (both included) that has at least one class, with its classes. */
export function occurrencesInRange(sessions: StudySession[], from: string, to: string): Map<string, StudySession[]> {
  const out = new Map<string, StudySession[]>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const list = classesOn(sessions, d);
    if (list.length > 0) out.set(d, list);
  }
  return out;
}

/** Deadlines grouped by their due date, earliest time first. Sample items are the student's demo data and are left out when `withoutSample` is set. */
export function deadlinesByDate(assignments: Assignment[], opts: { withoutSample?: boolean } = {}): Map<string, Assignment[]> {
  const out = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (opts.withoutSample && a.sample) continue;
    const list = out.get(a.dueDate) ?? [];
    list.push(a);
    out.set(a.dueDate, list);
  }
  for (const list of out.values()) list.sort((x, y) => (x.dueTime ?? '23:59').localeCompare(y.dueTime ?? '23:59') || x.title.localeCompare(y.title));
  return out;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * The deadlines that are still to do, in the order a student should look at them: overdue first (an earlier date), then by date, then by
 * priority (high, medium, low), then by time, then by title. One shared rule used by Today, the Timetable and Courses, so a "pending" item
 * means the same thing everywhere.
 */
export function selectPendingDeadlines(assignments: Assignment[]): Assignment[] {
  return assignments
    .filter((a) => a.status !== 'completed')
    .sort(
      (x, y) =>
        x.dueDate.localeCompare(y.dueDate) ||
        (PRIORITY_RANK[x.priority] ?? 1) - (PRIORITY_RANK[y.priority] ?? 1) ||
        (x.dueTime ?? '23:59').localeCompare(y.dueTime ?? '23:59') ||
        x.title.localeCompare(y.title)
    );
}

export interface MonthSummary {
  /** Deadlines due in the month. */
  total: number;
  pending: number;
  done: number;
  /** Unfinished exams, tests and projects due in the month. */
  exams: number;
  tests: number;
  projects: number;
  /** The day with the most unfinished deadlines, when that is two or more (the earliest on a tie). */
  busiest: { date: string; count: number } | null;
}

/** First and last day of a month as "YYYY-MM-DD" (month is 1 to 12). */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: isoDate(year, month, 1), to: isoDate(year, month, last) };
}

/** What a month holds, for the strip above the month grid. */
export function monthSummary(deadlines: Map<string, Assignment[]>, year: number, month: number): MonthSummary {
  const { from, to } = monthRange(year, month);
  const out: MonthSummary = { total: 0, pending: 0, done: 0, exams: 0, tests: 0, projects: 0, busiest: null };
  for (const [date, items] of [...deadlines.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (date < from || date > to) continue;
    let pendingToday = 0;
    for (const a of items) {
      out.total++;
      if (a.status === 'completed') {
        out.done++;
        continue;
      }
      out.pending++;
      pendingToday++;
      const k = kindOf(a);
      if (k === 'exam') out.exams++;
      else if (k === 'test') out.tests++;
      else if (k === 'project') out.projects++;
    }
    if (pendingToday >= 2 && (!out.busiest || pendingToday > out.busiest.count)) out.busiest = { date, count: pendingToday };
  }
  return out;
}

/** "November 2026" */
export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
