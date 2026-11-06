import { useStudyFlowStore } from '../store/studyFlowStore';
import { downloadICalendarFile } from './icalExport';

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
