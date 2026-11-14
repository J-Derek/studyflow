import { useStudyFlowStore } from '../store/studyFlowStore';
import { downloadICalendarFile, monthIcsOptions } from './icalExport';

/** Exports the student's own timetable and open deadlines (never sample data) with term dates, zone and a rising SEQUENCE. */
export function exportTimetable(): void {
  const s = useStudyFlowStore.getState();
  const sequence = s.icsExportCount;
  s.bumpIcsExport();
  downloadICalendarFile(s.sessions, {
    timeZone: s.user.timeZone,
    semesterStart: s.user.semesterStart,
    semesterEnd: s.user.semesterEnd,
    assignments: s.assignments,
    sequence
  });
}

/** Exports just one month (month is 1 to 12): that month's classes and deadlines, in a file named after it. */
export function exportMonth(year: number, month: number): void {
  const s = useStudyFlowStore.getState();
  const sequence = s.icsExportCount;
  s.bumpIcsExport();
  downloadICalendarFile(s.sessions, monthIcsOptions(year, month, { timeZone: s.user.timeZone, assignments: s.assignments, sequence }));
}
