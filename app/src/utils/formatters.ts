import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeLeft(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})/;

/** Calendar date (y, m, d) of `now` in the given IANA zone, or the device zone when omitted. */
export function todayInZone(now: Date, timeZone?: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/**
 * Whole calendar days from today to the due date. Pure date arithmetic: a due date is a calendar
 * day, not an instant, so daylight-saving shifts and the device zone cannot move it by a day.
 */
export function getDaysRemaining(
  dateString?: string,
  now: Date = new Date(),
  timeZone?: string
): { days: number; label: string; isUrgent: boolean } {
  if (!dateString) {
    return { days: 0, label: 'Pending date', isUrgent: false };
  }
  const match = YMD.exec(dateString);
  if (!match) {
    return { days: 0, label: 'Upcoming', isUrgent: false };
  }
  const due = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const t = todayInZone(now, timeZone);
  const today = Date.UTC(t.y, t.m - 1, t.d);
  const diffDays = Math.round((due - today) / 86_400_000);

  if (diffDays < 0) {
    return { days: diffDays, label: `${Math.abs(diffDays)}d overdue`, isUrgent: true };
  } else if (diffDays === 0) {
    return { days: 0, label: 'Due today', isUrgent: true };
  } else if (diffDays === 1) {
    return { days: 1, label: 'Due tomorrow', isUrgent: true };
  }
  return { days: diffDays, label: `Due in ${diffDays}d`, isUrgent: diffDays <= 3 };
}
