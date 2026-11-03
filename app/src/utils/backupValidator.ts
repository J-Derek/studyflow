import type { Assignment, StudySession, CourseGrade, Priority, AssignmentStatus } from '../types';

export interface ValidatedBackupPayload {
  version: string;
  exportedAt: string;
  ledger: {
    assignments: Assignment[];
    sessions: StudySession[];
    grades: CourseGrade[];
  };
}

export type ValidationResult =
  | { success: true; data: ValidatedBackupPayload }
  | { success: false; error: string };

const MAX_ASSIGNMENTS = 1000;
const MAX_SESSIONS = 500;
const MAX_GRADES = 100;
const MAX_SUBTASKS_PER_ASSIGNMENT = 100;
const MAX_ASSESSMENTS_PER_GRADE = 50;

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

    // Check dangerous properties
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
  if (a.dueTime !== undefined && (typeof a.dueTime !== 'string' || a.dueTime.length > 10)) return false;
  if (!VALID_PRIORITIES.has(a.priority as Priority)) return false;
  if (!VALID_STATUSES.has(a.status as AssignmentStatus)) return false;
  if (typeof a.progress !== 'number' || a.progress < 0 || a.progress > 100 || Number.isNaN(a.progress)) return false;
  if (a.notes !== undefined && (typeof a.notes !== 'string' || a.notes.length > 5000)) return false;
  if (typeof a.createdAt !== 'string') return false;

  if (a.subtasks !== undefined) {
    if (!Array.isArray(a.subtasks) || a.subtasks.length > MAX_SUBTASKS_PER_ASSIGNMENT) return false;
    for (const st of a.subtasks) {
      if (!st || typeof st !== 'object') return false;
      const sub = st as Record<string, unknown>;
      if (typeof sub.id !== 'string' || typeof sub.title !== 'string' || typeof sub.completed !== 'boolean') {
        return false;
      }
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
  if (typeof s.startTime !== 'string' || typeof s.endTime !== 'string') return false;
  if (!['lecture', 'lab', 'study', 'review', 'exam'].includes(s.type as string)) return false;

  return true;
}

function isValidGrade(item: unknown): item is CourseGrade {
  if (!item || typeof item !== 'object') return false;
  const g = item as Record<string, unknown>;

  if (typeof g.id !== 'string' || g.id.trim().length === 0) return false;
  if (typeof g.courseCode !== 'string' || g.courseCode.trim().length === 0) return false;
  if (typeof g.courseName !== 'string' || g.courseName.trim().length === 0) return false;
  if (typeof g.credits !== 'number' || g.credits < 0 || g.credits > 30 || Number.isNaN(g.credits)) return false;
  if (typeof g.targetLetter !== 'string') return false;
  if (typeof g.color !== 'string') return false;

  if (!Array.isArray(g.assessments) || g.assessments.length > MAX_ASSESSMENTS_PER_GRADE) return false;
  for (const asmt of g.assessments) {
    if (!asmt || typeof asmt !== 'object') return false;
    const a = asmt as Record<string, unknown>;
    if (typeof a.id !== 'string' || typeof a.name !== 'string' || typeof a.weight !== 'number') return false;
    if (a.weight < 0 || a.weight > 100 || Number.isNaN(a.weight)) return false;
    if (a.score !== undefined && a.score !== null) {
      if (typeof a.score !== 'number' || a.score < 0 || a.score > 200 || Number.isNaN(a.score)) return false;
    }
  }

  return true;
}

/**
 * Validates, sanitizes, and verifies a raw JSON string for StudyFlow backup restore.
 */
export function validateBackupJson(rawJsonString: string): ValidationResult {
  if (typeof rawJsonString !== 'string' || rawJsonString.trim().length === 0) {
    return { success: false, error: 'Backup file is empty.' };
  }

  // Pre-parse security check for prototype pollution strings
  if (
    rawJsonString.includes('"__proto__"') ||
    rawJsonString.includes('"constructor"') ||
    rawJsonString.includes('"prototype"')
  ) {
    return {
      success: false,
      error: 'Security alert: Disallowed prototype modification detected in backup payload.'
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonString);
  } catch {
    return { success: false, error: 'Malformed JSON: Unable to parse backup file.' };
  }

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

  // Assignments check
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

  // Sessions check
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

  // Grades check
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

  return {
    success: true,
    data: {
      version: typeof root.version === 'string' ? root.version : 'StudyFlow-v1.2',
      exportedAt: typeof root.exportedAt === 'string' ? root.exportedAt : new Date().toISOString(),
      ledger: {
        assignments: ledger.assignments as Assignment[],
        sessions,
        grades
      }
    }
  };
}
