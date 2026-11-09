import type { Assignment, CourseGrade, Note, StudySession } from '../types';
import { calculateCoursePercentage } from './academicCalculations';
import { selectPendingDeadlines } from './calendarMonth';

/**
 * A course is the record already kept under Grades (code, name, credits, assessments). Work, classes and notes name their course as free
 * text such as "CS 301" or "CS 301 — Algorithms", so they are matched to a course by the code before the dash, ignoring capitals and spaces
 * at the ends. That also covers everything entered before Courses existed. (Storing a course id on each item is possible later; it would
 * only matter when a course is renamed.)
 */
export function courseKey(text: string): string {
  return text.split('—')[0]!.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function belongsToCourse(itemCourse: string, course: Pick<CourseGrade, 'courseCode'>): boolean {
  const key = courseKey(itemCourse);
  return key !== '' && key === courseKey(course.courseCode);
}

export interface CourseSummary {
  pending: Assignment[];
  done: Assignment[];
  nextDeadline: Assignment | null;
  classes: StudySession[];
  notes: Note[];
  /** The grade so far as a percentage, or null when nothing is graded yet. */
  gradePct: number | null;
}

export function courseSummary(course: CourseGrade, items: { assignments: Assignment[]; sessions: StudySession[]; notes: Note[] }): CourseSummary {
  const mine = items.assignments.filter((a) => belongsToCourse(a.course, course));
  const pending = selectPendingDeadlines(mine);
  const { currentPct, gradedWeight } = calculateCoursePercentage(course);
  return {
    pending,
    done: mine.filter((a) => a.status === 'completed'),
    nextDeadline: pending[0] ?? null,
    classes: items.sessions.filter((s) => belongsToCourse(s.course, course)).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    notes: items.notes.filter((n) => belongsToCourse(n.course, course)),
    gradePct: gradedWeight > 0 ? Math.round(currentPct * 10) / 10 : null
  };
}

/** The course codes already in use, for suggestions in the forms (no repeats, in the order first seen). */
export function knownCourseCodes(courses: CourseGrade[], texts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...courses.map((c) => c.courseCode), ...texts]) {
    const code = raw.split('—')[0]!.trim();
    const key = courseKey(code);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(code);
    }
  }
  return out;
}
