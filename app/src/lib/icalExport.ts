import type { StudySession } from '../types';

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string for recurring weekly study sessions
 */
export function generateICalendarFeed(sessions: StudySession[]): string {
  const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // Compute standard 16-week academic semester endpoint for RRULE UNTIL
  const semesterEnd = new Date(now.getTime() + 16 * 7 * 24 * 60 * 60 * 1000);
  const untilStr = semesterEnd.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // Compute the upcoming dates corresponding to dayOfWeek (0-6)
  const todayDay = now.getDay();

  let icsLines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyFlow//Academic Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:StudyFlow Academic Schedule',
    `X-WR-TIMEZONE:${userTz}`
  ];

  function escapeIcsText(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  function formatLocalDateTime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  sessions.forEach((s) => {
    // Calculate reference start date for this weekday
    const dayDiff = (s.dayOfWeek - todayDay + 7) % 7;
    const sessionDate = new Date(now);
    sessionDate.setDate(now.getDate() + dayDiff);

    const [startH, startM] = s.startTime.split(':').map(Number);
    const [endH, endM] = s.endTime.split(':').map(Number);

    sessionDate.setHours(startH, startM, 0, 0);
    const dtStart = formatLocalDateTime(sessionDate);

    const sessionEndDate = new Date(sessionDate);
    sessionEndDate.setHours(endH, endM, 0, 0);
    const dtEnd = formatLocalDateTime(sessionEndDate);

    const byDay = dayNames[s.dayOfWeek] || 'MO';

    icsLines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@studyflow.app`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;TZID=${userTz}:${dtStart}`,
      `DTEND;TZID=${userTz}:${dtEnd}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${untilStr}`,
      `SUMMARY:${escapeIcsText(s.title + ' (' + s.course + ')')}`,
      `DESCRIPTION:${escapeIcsText('StudyFlow scheduled ' + s.type + ' block for ' + s.course + '.')}`,
      `CATEGORIES:${s.type.toUpperCase()}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  });

  icsLines.push('END:VCALENDAR');
  return icsLines.join('\r\n');
}

/**
 * Triggers a browser download of the .ics calendar file
 */
export function downloadICalendarFile(sessions: StudySession[]): void {
  const icsData = generateICalendarFeed(sessions);
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
