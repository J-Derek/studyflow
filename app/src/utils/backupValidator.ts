import type { Assignment, StudySession, CourseGrade, Note, Priority, AssignmentStatus } from '../types';
import { LIMITS } from './limits';
import { isAssignmentKind } from './kinds';

export interface ValidatedBackupPayload {
  version: string;
  exportedAt: string;
  ledger: {
    assignments: Assignment[];
    sessions: StudySession[];
    grades: CourseGrade[];
    /** Absent when the file predates notes, so restoring it leaves the student's notes alone. */
    notes?: Note[];
  };
}

export type ValidationResult =
  | { success: true; data: ValidatedBackupPayload }
  | { success: false; error: string };

// Matches the 500-document list cap in firestore.rules, so an import can never exceed what syncs back.
const MAX_ASSIGNMENTS = 500;
const MAX_SESSIONS = 500;
const MAX_GRADES = 100;
const MAX_NOTES = 500;
const MAX_SUBTASKS_PER_ASSIGNMENT = 100;
const MAX_ASSESSMENTS_PER_GRADE = 50;
/** A realistic backup is well under 1 MB; anything near this is an attack or a mistake. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Checks for prototype pollution attack vectors in raw JSON string or object keys.
 */
export function hasPrototypePollution(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;

  const stack: unknown[] = [input];
  const seen = new Set<unknown>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);

    if (
      Object.prototype.hasOwnProperty.call(current, '__proto__') ||
      Object.prototype.hasOwnProperty.call(current, 'constructor') ||
      Object.prototype.hasOwnProperty.call(current, 'prototype')
    ) {
      return true;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        if (item && typeof item === 'object') stack.push(item);
      }
    } else {
      for (const [key, val] of Object.entries(current as Record<string, unknown>)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          return true;
        }
        if (val && typeof val === 'object') {
          stack.push(val);
        }
      }
    }
  }

  return false;
}

const VALID_PRIORITIES = new Set<Priority>(['low', 'medium', 'high']);
const VALID_STATUSES = new Set<AssignmentStatus>(['pending', 'in_progress', 'completed']);

function isValidAssignment(item: unknown): item is Assignment {
  if (!item || typeof item !== 'object') return false;
  const a = item as Record<string, unknown>;

  if (typeof a.id !== 'string' || a.id.trim().length === 0 || a.id.length > 100) return false;
  if (typeof a.title !== 'string' || a.title.trim().length === 0 || a.title.length > 250) return false;
  if (typeof a.course !== 'string' || a.course.trim().length === 0 || a.course.length > 200) return false;
  if (typeof a.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.dueDate)) return false;
  if (a.dueTime !== undefined && (typeof a.dueTime !== 'string' || !TIME_RE.test(a.dueTime))) return false;
  if (!VALID_PRIORITIES.has(a.priority as Priority)) return false;
  if (!VALID_STATUSES.has(a.status as AssignmentStatus)) return false;
  if (a.kind !== undefined && !isAssignmentKind(a.kind)) return false;
  if (typeof a.progress !== 'number' || a.progress < 0 || a.progress > 100 || Number.isNaN(a.progress)) return false;
  if (a.status === 'completed' && a.progress !== 100) return false;
  if (a.notes !== undefined && (typeof a.notes !== 'string' || a.notes.length > 5000)) return false;
  if (typeof a.createdAt !== 'string' || a.createdAt.length === 0 || a.createdAt.length > 50) return false;

  if (a.subtasks !== undefined) {
    if (!Array.isArray(a.subtasks) || a.subtasks.length > MAX_SUBTASKS_PER_ASSIGNMENT) return false;
    for (const st of a.subtasks) {
      if (!st || typeof st !== 'object') return false;
      const sub = st as Record<string, unknown>;
      if (typeof sub.id !== 'string' || sub.id.length === 0 || sub.id.length > 100) return false;
      // An over-long checklist item is shortened when cleaned (below) instead of rejecting the whole backup.
      if (typeof sub.title !== 'string') return false;
      if (typeof sub.completed !== 'boolean') return false;
    }
  }

  return true;
}

function isValidSession(item: unknown): item is StudySession {
  if (!item || typeof item !== 'object') return false;
  const s = item as Record<string, unknown>;

  if (typeof s.id !== 'string' || s.id.trim().length === 0 || s.id.length > 100) return false;
  if (typeof s.title !== 'string' || s.title.trim().length === 0 || s.title.length > 200) return false;
  if (typeof s.course !== 'string' || s.course.trim().length === 0 || s.course.length > 200) return false;
  if (typeof s.dayOfWeek !== 'number' || s.dayOfWeek < 0 || s.dayOfWeek > 6 || !Number.isInteger(s.dayOfWeek)) return false;
  if (typeof s.startTime !== 'string' || !TIME_RE.test(s.startTime)) return false;
  if (typeof s.endTime !== 'string' || !TIME_RE.test(s.endTime)) return false;
  if (!['lecture', 'lab', 'study', 'review', 'exam'].includes(s.type as string)) return false;

  return true;
}

function isValidGrade(item: unknown): item is CourseGrade {
  if (!item || typeof item !== 'object') return false;
  const g = item as Record<string, unknown>;

  if (typeof g.id !== 'string' || g.id.trim().length === 0 || g.id.length > 100) return false;
  if (typeof g.courseCode !== 'string' || g.courseCode.trim().length === 0 || g.courseCode.length > 50) return false;
  if (typeof g.courseName !== 'string' || g.courseName.trim().length === 0 || g.courseName.length > 200) return false;
  if (typeof g.credits !== 'number' || g.credits < 0 || g.credits > 30 || Number.isNaN(g.credits)) return false;
  if (typeof g.targetLetter !== 'string' || g.targetLetter.length > 3) return false;
  if (typeof g.color !== 'string' || g.color.length > 50) return false;

  if (!Array.isArray(g.assessments) || g.assessments.length > MAX_ASSESSMENTS_PER_GRADE) return false;
  for (const asmt of g.assessments) {
    if (!asmt || typeof asmt !== 'object') return false;
    const a = asmt as Record<string, unknown>;
    if (typeof a.id !== 'string' || typeof a.name !== 'string' || a.name.length > 200 || typeof a.weight !== 'number') return false;
    if (a.weight < 0 || a.weight > 100 || Number.isNaN(a.weight)) return false;
    if (a.score !== undefined && a.score !== null) {
      if (typeof a.score !== 'number' || a.score < 0 || a.score > 200 || Number.isNaN(a.score)) return false;
    }
  }

  return true;
}

function firstDuplicate(items: Array<{ id: string }>): string | null {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return null;
}

/** Copies only known fields, so unexpected keys never reach the store or Firestore. `sample` is never imported. */
function cleanAssignment(a: Assignment): Assignment {
  return {
    id: a.id,
    title: a.title,
    course: a.course,
    dueDate: a.dueDate,
    ...(a.dueTime !== undefined ? { dueTime: a.dueTime } : {}),
    priority: a.priority,
    status: a.status,
    ...(isAssignmentKind(a.kind) && a.kind !== 'assignment' ? { kind: a.kind } : {}),
    progress: a.progress,
    ...(a.notes !== undefined ? { notes: a.notes } : {}),
    ...(a.subtasks !== undefined
      ? { subtasks: a.subtasks.map((t) => ({ id: t.id, title: t.title.trim().slice(0, LIMITS.subtaskTitle), completed: t.completed })) }
      : {}),
    createdAt: a.createdAt,
    ...(typeof a.completedAt === 'string' ? { completedAt: a.completedAt.slice(0, 50) } : {})
  };
}

function cleanSession(x: StudySession): StudySession {
  return {
    id: x.id,
    title: x.title,
    course: x.course,
    dayOfWeek: x.dayOfWeek,
    startTime: x.startTime,
    endTime: x.endTime,
    type: x.type,
    ...(typeof x.color === 'string' ? { color: x.color.slice(0, 50) } : {})
  };
}

function cleanGrade(g: CourseGrade): CourseGrade {
  return {
    id: g.id,
    courseCode: g.courseCode,
    courseName: g.courseName,
    credits: g.credits,
    targetLetter: g.targetLetter,
    color: g.color,
    assessments: g.assessments.map((m) => ({
      id: m.id,
      name: m.name,
      weight: m.weight,
      ...(m.score !== undefined && m.score !== null ? { score: m.score } : {})
    }))
  };
}

/**
 * Validates, sanitizes, and verifies a raw JSON string for StudyFlow backup restore.
 */
export function validateBackupJson(rawJsonString: string): ValidationResult {
  if (typeof rawJsonString !== 'string' || rawJsonString.trim().length === 0) {
    return { success: false, error: 'Backup file is empty.' };
  }

  if (rawJsonString.length > MAX_BACKUP_BYTES) {
    return { success: false, error: 'Backup file is too large to import.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonString);
  } catch {
    return { success: false, error: 'Malformed JSON: Unable to parse backup file.' };
  }

  // JSON.parse creates "__proto__" as an own key without polluting; the graph walk below rejects it.
  if (hasPrototypePollution(parsed)) {
    return {
      success: false,
      error: 'Security alert: Object hierarchy contains unsafe properties.'
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { success: false, error: 'Invalid root structure: Expected an object.' };
  }

  const root = parsed as Record<string, unknown>;
  if (!root.ledger || typeof root.ledger !== 'object') {
    return { success: false, error: 'Invalid backup structure: Missing "ledger" key.' };
  }

  const ledger = root.ledger as Record<string, unknown>;

  if (!Array.isArray(ledger.assignments)) {
    return { success: false, error: 'Invalid ledger structure: "assignments" must be an array.' };
  }
  if (ledger.assignments.length > MAX_ASSIGNMENTS) {
    return { success: false, error: `Exceeded maximum allowable assignments (${MAX_ASSIGNMENTS}).` };
  }
  for (let i = 0; i < ledger.assignments.length; i++) {
    if (!isValidAssignment(ledger.assignments[i])) {
      return { success: false, error: `Malformed assignment record at index ${i}.` };
    }
  }

  const sessions: StudySession[] = [];
  if (ledger.sessions !== undefined) {
    if (!Array.isArray(ledger.sessions)) {
      return { success: false, error: 'Invalid ledger structure: "sessions" must be an array.' };
    }
    if (ledger.sessions.length > MAX_SESSIONS) {
      return { success: false, error: `Exceeded maximum allowable sessions (${MAX_SESSIONS}).` };
    }
    for (let i = 0; i < ledger.sessions.length; i++) {
      if (!isValidSession(ledger.sessions[i])) {
        return { success: false, error: `Malformed session record at index ${i}.` };
      }
      sessions.push(ledger.sessions[i] as StudySession);
    }
  }

  const grades: CourseGrade[] = [];
  if (ledger.grades !== undefined) {
    if (!Array.isArray(ledger.grades)) {
      return { success: false, error: 'Invalid ledger structure: "grades" must be an array.' };
    }
    if (ledger.grades.length > MAX_GRADES) {
      return { success: false, error: `Exceeded maximum allowable grades (${MAX_GRADES}).` };
    }
    for (let i = 0; i < ledger.grades.length; i++) {
      if (!isValidGrade(ledger.grades[i])) {
        return { success: false, error: `Malformed course grade record at index ${i}.` };
      }
      grades.push(ledger.grades[i] as CourseGrade);
    }
  }

  let notes: Note[] | undefined;
  if (ledger.notes !== undefined) {
    if (!Array.isArray(ledger.notes)) {
      return { success: false, error: 'Invalid ledger structure: "notes" must be an array.' };
    }
    if (ledger.notes.length > MAX_NOTES) {
      return { success: false, error: `Exceeded maximum allowable notes (${MAX_NOTES}).` };
    }
    notes = [];
    for (let i = 0; i < ledger.notes.length; i++) {
      const n = ledger.notes[i] as Record<string, unknown> | null;
      const ok =
        n !== null && typeof n === 'object' &&
        typeof n.id === 'string' && n.id.length > 0 && n.id.length <= 100 &&
        typeof n.title === 'string' && typeof n.body === 'string' && typeof n.course === 'string' &&
        typeof n.createdAt === 'string' && typeof n.editedAt === 'string';
      if (!ok) return { success: false, error: `Malformed note at index ${i}.` };
      const note = n as unknown as Note;
      notes.push({
        id: note.id,
        title: note.title.trim().slice(0, 200) || 'Untitled note',
        body: note.body.slice(0, 20000),
        course: note.course.trim().slice(0, 50),
        pinned: note.pinned === true,
        createdAt: note.createdAt.slice(0, 50),
        editedAt: note.editedAt.slice(0, 50)
      });
    }
  }

  const cleanAssignments = (ledger.assignments as Assignment[]).map(cleanAssignment);
  const cleanSessions = sessions.map(cleanSession);
  const cleanGrades = grades.map(cleanGrade);

  const lists: Array<[string, Array<{ id: string }>]> = [
    ['assignment', cleanAssignments],
    ['session', cleanSessions],
    ['course', cleanGrades],
    ['note', notes ?? []]
  ];
  for (const [label, list] of lists) {
    const dup = firstDuplicate(list);
    if (dup) return { success: false, error: `Duplicate ${label} id "${dup.slice(0, 40)}" in backup.` };
  }

  return {
    success: true,
    data: {
      version: typeof root.version === 'string' ? root.version.slice(0, 50) : 'StudyFlow-v1.2',
      exportedAt: typeof root.exportedAt === 'string' ? root.exportedAt.slice(0, 50) : new Date().toISOString(),
      ledger: {
        assignments: cleanAssignments,
        sessions: cleanSessions,
        grades: cleanGrades,
        // Notes were checked above but used to be left out here, so restoring a backup silently lost them.
        ...(notes ? { notes } : {})
      }
    }
  };
}
