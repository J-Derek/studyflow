import type { Assignment, StudySession } from '../types';
import { kindOf, KIND_META } from './kinds';

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

export interface BusyWeek {
  /** How many exams, tests and projects fall in the window. */
  count: number;
  /** First and last due date inside the window ("YYYY-MM-DD"). */
  from: string;
  to: string;
  /** "Busy week: 2 exams, 1 test, 18 to 22 Nov" */
  label: string;
}

/** Number of heavy items (exam, test, project) within one 7-day window that makes a week "busy". */
export const BUSY_WEEK_COUNT = 3;
const HEAVY_KINDS = ['exam', 'test', 'project'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortRange(from: string, to: string): string {
  const [, fm, fd] = from.split('-').map(Number);
  const [, tm, td] = to.split('-').map(Number);
  if (from === to) return `${fd} ${SHORT_MONTHS[fm - 1]}`;
  if (fm === tm) return `${fd} to ${td} ${SHORT_MONTHS[tm - 1]}`;
  return `${fd} ${SHORT_MONTHS[fm - 1]} to ${td} ${SHORT_MONTHS[tm - 1]}`;
}

/**
 * The first stretch of 7 days (from `today` on) that holds 3 or more unfinished exams, tests or projects, or null. Overdue, finished and
 * sample items do not count. A window starts on the due date of one of the items, so "18 to 22 Nov" is exactly the dates of the pile-up.
 */
export function findBusyWeek(assignments: Assignment[], today: string): BusyWeek | null {
  const heavy = assignments
    .filter((a) => a.status !== 'completed' && !a.sample && a.dueDate >= today && HEAVY_KINDS.includes(kindOf(a)))
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate));
  for (let i = 0; i < heavy.length; i++) {
    const end = addDays(heavy[i].dueDate, 6);
    const inWindow = heavy.slice(i).filter((a) => a.dueDate <= end);
    if (inWindow.length < BUSY_WEEK_COUNT) continue;
    const from = inWindow[0].dueDate;
    const to = inWindow[inWindow.length - 1].dueDate;
    const counts = new Map<string, number>();
    for (const a of inWindow) counts.set(kindOf(a), (counts.get(kindOf(a)) ?? 0) + 1);
    const parts = HEAVY_KINDS.filter((k) => counts.has(k)).map((k) => {
      const n = counts.get(k)!;
      return `${n} ${KIND_META[k as keyof typeof KIND_META].label.toLowerCase()}${n === 1 ? '' : 's'}`;
    });
    return { count: inWindow.length, from, to, label: `Busy week: ${parts.join(', ')}, ${shortRange(from, to)}` };
  }
  return null;
}

/** "November 2026" */
export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
