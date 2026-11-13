import type { Assignment, StudySession } from '../types';

export interface IcsOptions {
  /** IANA zone the lectures happen in, e.g. "Africa/Nairobi". Defaults to the device zone. */
  timeZone?: string;
  /** First and last day of term, YYYY-MM-DD. Events repeat weekly between them (inclusive). */
  semesterStart?: string;
  semesterEnd?: string;
  /** Rises by one on every export so calendars treat re-imports as updates, not duplicates. */
  sequence?: number;
  /** Deadlines to export as events with reminders. Completed and sample ones are skipped. */
  assignments?: Assignment[];
  now?: Date;
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DAY_MS = 86_400_000;

// ---------- text helpers (RFC 5545) ----------

/** Escapes a TEXT value: backslash, semicolon, comma and newlines. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const encoder = new TextEncoder();

/** Folds a content line at 75 octets (UTF-8 bytes), never splitting a multi-byte character. */
export function foldLine(line: string): string[] {
  if (encoder.encode(line).length <= 75) return [line];
  const out: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    if (currentBytes + bytes > 75) {
      out.push(current);
      current = ' '; // continuation lines start with one space, which counts toward their 75
      currentBytes = 1;
    }
    current += ch;
    currentBytes += bytes;
  }
  out.push(current);
  return out;
}

// ---------- date / zone helpers ----------

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

/** UTC offset (minutes east of UTC) of `zone` at the instant `ms`. */
export function offsetMinutesAt(ms: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date(ms));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

function localStamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

const utcStamp = (ms: number) => `${localStamp(ms)}Z`;

/** Instant at which the wall clock in `zone` reads the given local date and time. */
function zonedWallToInstant(y: number, mo: number, d: number, hh: number, mm: number, zone: string): number {
  const guess = Date.UTC(y, mo - 1, d, hh, mm);
  let ms = guess - offsetMinutesAt(guess, zone) * 60_000;
  ms = guess - offsetMinutesAt(ms, zone) * 60_000; // second pass settles times near a transition
  return ms;
}

/**
 * VTIMEZONE built from the zone's real offset changes inside the export window, so any importer
 * resolves TZID without needing its own copy of the tz database.
 */
export function buildVTimezone(zone: string, fromMs: number, toMs: number): string[] {
  const lines = ['BEGIN:VTIMEZONE', `TZID:${zone}`];
  const transitions: Array<{ at: number; from: number; to: number }> = [];
  let prevMs = fromMs;
  let prevOff = offsetMinutesAt(prevMs, zone);
  for (let t = fromMs + DAY_MS; t <= toMs + DAY_MS; t += DAY_MS) {
    const off = offsetMinutesAt(t, zone);
    if (off !== prevOff) {
      let lo = prevMs;
      let hi = t;
      while (hi - lo > 60_000) {
        const mid = Math.floor((lo + hi) / 2);
        if (offsetMinutesAt(mid, zone) === prevOff) lo = mid;
        else hi = mid;
      }
      transitions.push({ at: hi, from: prevOff, to: off });
      prevOff = off;
    }
    prevMs = t;
  }

  const initialOff = offsetMinutesAt(fromMs, zone);
  if (transitions.length === 0) {
    lines.push(
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      `TZOFFSETFROM:${formatOffset(initialOff)}`,
      `TZOFFSETTO:${formatOffset(initialOff)}`,
      'END:STANDARD'
    );
  } else {
    // The offset in force at the start, then each transition as an explicit onset (wall time of the old offset).
    const first = transitions[0];
    lines.push(
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      `TZOFFSETFROM:${formatOffset(first.from)}`,
      `TZOFFSETTO:${formatOffset(first.from)}`,
      'END:STANDARD'
    );
    for (const tr of transitions) {
      const kind = tr.to > tr.from ? 'DAYLIGHT' : 'STANDARD';
      lines.push(
        `BEGIN:${kind}`,
        `DTSTART:${localStamp(tr.at + tr.from * 60_000)}`,
        `TZOFFSETFROM:${formatOffset(tr.from)}`,
        `TZOFFSETTO:${formatOffset(tr.to)}`,
        `END:${kind}`
      );
    }
  }
  lines.push('END:VTIMEZONE');
  return lines;
}

function addDays(y: number, m: number, d: number, n: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function parseTime(s: string): { h: number; m: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
}

/**
 * Builds an RFC 5545 calendar. Sample sessions are excluded. Lines are CRLF-terminated, folded at
 * 75 octets, and every text property is escaped.
 */
export function generateICalendarFeed(allSessions: StudySession[], options: IcsOptions = {}): string {
  const sessions = allSessions.filter((s) => !s.sample);
  const now = options.now ?? new Date();
  const zone = options.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const sequence = Math.max(0, Math.floor(options.sequence ?? 0));

  const today = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  const start = parseYmd(options.semesterStart ?? '') ?? today;
  const defaultEnd = addDays(start.y, start.m, start.d, 16 * 7 - 1);
  let end = parseYmd(options.semesterEnd ?? '') ?? defaultEnd;
  if (Date.UTC(end.y, end.m - 1, end.d) < Date.UTC(start.y, start.m - 1, start.d)) end = defaultEnd;

  const deadlines = (options.assignments ?? [])
    .filter((a) => !a.sample && a.status !== 'completed')
    .map((a) => ({ a, due: parseYmd(a.dueDate) }))
    .filter((x): x is { a: Assignment; due: { y: number; m: number; d: number } } => x.due !== null);

  let windowFrom = Date.UTC(start.y, start.m - 1, start.d) - DAY_MS;
  let windowTo = Date.UTC(end.y, end.m - 1, end.d) + DAY_MS;
  for (const { due } of deadlines) {
    const t = Date.UTC(due.y, due.m - 1, due.d);
    windowFrom = Math.min(windowFrom, t - DAY_MS);
    windowTo = Math.max(windowTo, t + 2 * DAY_MS);
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyFlow//Timetable//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText('StudyFlow timetable')}`,
    `X-WR-TIMEZONE:${escapeIcsText(zone)}`,
    ...buildVTimezone(zone, windowFrom, windowTo)
  ];

  const dtstamp = utcStamp(now.getTime());
  // UNTIL is the last second of the final day, in the stored zone, expressed in UTC.
  const until = utcStamp(zonedWallToInstant(end.y, end.m, end.d, 23, 59, zone) + 59_000);

  for (const s of sessions) {
    const st = parseTime(s.startTime);
    const en = parseTime(s.endTime);
    if (!st || !en || !Number.isInteger(s.dayOfWeek) || s.dayOfWeek < 0 || s.dayOfWeek > 6) continue;

    // First matching weekday on or after the semester start, by calendar arithmetic only.
    const startDow = new Date(Date.UTC(start.y, start.m - 1, start.d)).getUTCDay();
    const first = addDays(start.y, start.m, start.d, (s.dayOfWeek - startDow + 7) % 7);
    if (Date.UTC(first.y, first.m - 1, first.d) > Date.UTC(end.y, end.m - 1, end.d)) continue;

    const day = `${first.y}${pad(first.m)}${pad(first.d)}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id.replace(/[^A-Za-z0-9._-]/g, '-')}@studyflow.app`,
      `DTSTAMP:${dtstamp}`,
      `SEQUENCE:${sequence}`,
      `DTSTART;TZID=${zone}:${day}T${pad(st.h)}${pad(st.m)}00`,
      `DTEND;TZID=${zone}:${day}T${pad(en.h)}${pad(en.m)}00`,
      `RRULE:FREQ=WEEKLY;BYDAY=${DAY_CODES[s.dayOfWeek]};UNTIL=${until}`,
      `SUMMARY:${escapeIcsText(`${s.title} (${s.course})`)}`,
      `DESCRIPTION:${escapeIcsText(`StudyFlow ${s.type} block for ${s.course}.`)}`,
      `CATEGORIES:${escapeIcsText(s.type.toUpperCase())}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  }

  // Deadlines: a timed event (30 minutes) when there is a due time, otherwise an all-day event.
  // Each carries two display alarms so the phone or laptop calendar reminds the student.
  for (const { a, due } of deadlines) {
    const t = a.dueTime ? parseTime(a.dueTime) : null;
    const day = `${due.y}${pad(due.m)}${pad(due.d)}`;
    const uid = `a-${a.id.replace(/[^A-Za-z0-9._-]/g, '-')}@studyflow.app`;
    const summary = escapeIcsText(`Due: ${a.title}${a.course ? ` (${a.course})` : ''}`);
    const alarm = (trigger: string, text: string) => [
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(text)}`,
      `TRIGGER:${trigger}`,
      'END:VALARM'
    ];
    const head = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${dtstamp}`, `SEQUENCE:${sequence}`];
    // A weekly repeat goes to the calendar as one repeating event: to its end date, or for a year when it has none.
    const stop = a.repeat?.until ? parseYmd(a.repeat.until) : null;
    const rrule = !a.repeat
      ? []
      : !stop
        ? ['RRULE:FREQ=WEEKLY;COUNT=52']
        : t
          ? [`RRULE:FREQ=WEEKLY;UNTIL=${utcStamp(zonedWallToInstant(stop.y, stop.m, stop.d, 23, 59, zone) + 59_000)}`]
          : [`RRULE:FREQ=WEEKLY;UNTIL=${stop.y}${pad(stop.m)}${pad(stop.d)}`];
    const tail = [
      `SUMMARY:${summary}`,
      `DESCRIPTION:${escapeIcsText(`StudyFlow deadline for ${a.course || 'your course'}.`)}`,
      'CATEGORIES:DEADLINE',
      'STATUS:CONFIRMED'
    ];
    if (t) {
      const endMin = Math.min(t.h * 60 + t.m + 30, 23 * 60 + 59);
      lines.push(
        ...head,
        `DTSTART;TZID=${zone}:${day}T${pad(t.h)}${pad(t.m)}00`,
        `DTEND;TZID=${zone}:${day}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`,
        ...rrule,
        ...tail,
        ...alarm('-P1D', `Due tomorrow: ${a.title}`),
        ...alarm('-PT1H', `Due in 1 hour: ${a.title}`),
        'END:VEVENT'
      );
    } else {
      const next = addDays(due.y, due.m, due.d, 1);
      lines.push(
        ...head,
        `DTSTART;VALUE=DATE:${day}`,
        `DTEND;VALUE=DATE:${next.y}${pad(next.m)}${pad(next.d)}`,
        'TRANSP:TRANSPARENT',
        ...rrule,
        ...tail,
        // 09:00 the day before, and 08:00 on the day itself (all-day events start at 00:00).
        ...alarm('-PT15H', `Due tomorrow: ${a.title}`),
        ...alarm('PT8H', `Due today: ${a.title}`),
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.flatMap(foldLine).join('\r\n') + '\r\n';
}

/** Triggers a browser download of the .ics calendar file */
export function downloadICalendarFile(sessions: StudySession[], options: IcsOptions = {}): void {
  const icsData = generateICalendarFeed(sessions, options);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'StudyFlow_Schedule.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
