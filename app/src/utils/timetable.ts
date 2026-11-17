import type { StudySession } from '../types';
import { meetsOn, type Term } from './calendarMonth';

/** Exams and reviews happen once, on a date. Lectures, labs and study blocks repeat every week. */
export function isOneOff(type: StudySession['type']): boolean {
  return type === 'exam' || type === 'review';
}

/** Minutes since midnight for "HH:mm", or NaN when the text is not a time. */
export function toMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? NaN : h * 60 + min;
}

type Slot = Pick<StudySession, 'dayOfWeek' | 'startTime' | 'endTime' | 'date'>;

/**
 * True when two blocks can meet on the same day: two weekly blocks on the same weekday, two dated blocks on the same date, or a dated
 * block on a date the weekly one meets (its weekday, inside the semester).
 */
function sameDay(a: Slot, b: Slot, term?: Term): boolean {
  if (a.date && b.date) return a.date === b.date;
  if (a.date) return meetsOn(b, a.date, term);
  if (b.date) return meetsOn(a, b.date, term);
  return a.dayOfWeek === b.dayOfWeek;
}

/** True when two blocks meet on the same day and their times overlap. Back-to-back blocks do not clash. */
export function overlaps(a: Slot, b: Slot, term?: Term): boolean {
  if (!sameDay(a, b, term)) return false;
  const aStart = toMinutes(a.startTime);
  const aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime);
  const bEnd = toMinutes(b.endTime);
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
  return aStart < bEnd && bStart < aEnd;
}

/** The existing blocks a new block would overlap. */
export function findClashes(sessions: StudySession[], candidate: Slot, term?: Term): StudySession[] {
  return sessions.filter((s) => overlaps(s, candidate, term));
}

/** Ids of every block that overlaps at least one other block. */
export function clashingIds(sessions: StudySession[], term?: Term): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      if (overlaps(sessions[i], sessions[j], term)) {
        ids.add(sessions[i].id);
        ids.add(sessions[j].id);
      }
    }
  }
  return ids;
}

/** Day numbers use the same convention as StudySession.dayOfWeek: 0 = Sunday ... 6 = Saturday. An older build saved Sunday as 7. */
export function normaliseDayOfWeek(day: number): number {
  return day === 7 ? 0 : day;
}
