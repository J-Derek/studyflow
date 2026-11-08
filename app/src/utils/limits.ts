/**
 * The longest text the cloud will accept for each field. These mirror the limits in firestore.rules.
 * Inputs use them as maxLength, and the store trims to them before saving, so nothing a student types
 * can look saved on their device and then be quietly refused by the cloud.
 */
export const LIMITS = {
  assignmentTitle: 250,
  assignmentCourse: 200,
  assignmentNotes: 2000, // the rules allow 5000; the form keeps notes short on purpose
  subtaskTitle: 200,
  subtasksPerAssignment: 100,
  blockTitle: 200,
  blockCourse: 200,
  courseCode: 50,
  courseName: 200,
  assessmentName: 60,
  profileName: 100,
  profileUniversity: 150,
  profileProgram: 150,
  profileSemester: 50
} as const;

/** Due dates outside this range are almost certainly typing mistakes (a year of 20256, say). */
export const DATE_MIN = '2000-01-01';
export const DATE_MAX = '2100-12-31';

/** Trims and shortens text to a limit. */
export function clampText(value: string, max: number): string {
  return value.trim().slice(0, max);
}

/**
 * Today's date as YYYY-MM-DD in the student's own time zone. `toISOString()` uses UTC, which in Nairobi
 * (UTC+3) gives yesterday's date between midnight and 3 am.
 */
export function localDateISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True for a real YYYY-MM-DD date inside DATE_MIN..DATE_MAX. */
export function isDateInRange(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const real = new Date(Date.UTC(y, m - 1, d));
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) return false;
  return value >= DATE_MIN && value <= DATE_MAX;
}
