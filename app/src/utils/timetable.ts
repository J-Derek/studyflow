import type { StudySession } from '../types';

/** Minutes since midnight for "HH:mm", or NaN when the text is not a time. */
export function toMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? NaN : h * 60 + min;
}

type Slot = Pick<StudySession, 'dayOfWeek' | 'startTime' | 'endTime'>;

/** True when two blocks are on the same day and their times overlap. Back-to-back blocks do not clash. */
export function overlaps(a: Slot, b: Slot): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) return false;
  const aStart = toMinutes(a.startTime);
  const aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime);
  const bEnd = toMinutes(b.endTime);
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
  return aStart < bEnd && bStart < aEnd;
}

/** The existing blocks a new block would overlap. */
export function findClashes(sessions: StudySession[], candidate: Slot): StudySession[] {
  return sessions.filter((s) => overlaps(s, candidate));
}

/** Ids of every block that overlaps at least one other block. */
export function clashingIds(sessions: StudySession[]): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      if (overlaps(sessions[i], sessions[j])) {
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
